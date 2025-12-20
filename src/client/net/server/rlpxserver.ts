import type { ComponentLogger, Logger } from "@libp2p/interface";
import { multiaddr } from "@multiformats/multiaddr";
import { LRUCache } from "lru-cache";

import { DPT as Devp2pDPT } from "../../../devp2p/dpt-1/index.ts";
import { DISCONNECT_REASON, type PeerInfo } from "../../../devp2p/types.ts";
import {
	type RLPxConnection,
	RLPxListener,
	RLPxTransport,
} from "../../../p2p/transport/rlpx/index.ts";
import {
	bytesToInt,
	bytesToUnprefixedHex,
	equalsBytes,
	utf8ToBytes,
} from "../../../utils";
import { getHostPortFromMultiaddr } from "../../../utils/utils.ts";
import { Event } from "../../types.ts";
import { getClientVersion } from "../../util";
import { RlpxPeer } from "../peer/rlpxpeer.ts";
import type { ProtocolStream } from "../protocol/protocol-stream.ts";
import { ProtocolRegistry } from "../protocol/registry.ts";
import type { ServerOptions } from "./server.ts";
import { Server } from "./server.ts";

export interface RlpxServerOptions extends ServerOptions {
	/* List of supported clients */
	clientFilter?: string[];
}

const ignoredErrors = new RegExp(
	[
		// Peer socket connection
		"ECONNRESET",
		"EPIPE", // (?)
		"ETIMEDOUT", // (?)

		// ETH status handling
		"Genesis block mismatch",
		"NetworkId mismatch",
		"Unknown fork hash",

		// DPT message decoding
		"Hash verification failed",
		"Invalid address bytes",
		"Invalid timestamp bytes",
		"Invalid type",
		"Timeout error: ping", // connection
		"Peer is banned", // connection

		// ECIES message encryption
		"Invalid MAC",

		// Client
		"Handshake timed out", // Protocol handshake
		"Server already destroyed", // Bootstrap retrigger
	].join("|"),
);

/**
 * Simple logger adapter that wraps console for ComponentLogger interface
 */
function createSimpleLogger(name: string): Logger {
	const log = (formatter: string, ...args: any[]) => {
		// Silent by default, only log errors
	};
	log.enabled = false;
	log.trace = (_formatter: string, ..._args: any[]) => {};
	log.error = (formatter: string, ...args: any[]) => {
		console.error(`[${name}] ERROR:`, formatter, ...args);
	};
	return log as Logger;
}

function createLoggerComponent(name: string): { logger: ComponentLogger } {
	return {
		logger: {
			forComponent: (component: string) =>
				createSimpleLogger(`${name}:${component}`),
		},
	};
}

/**
 * DevP2P/RLPx server using the new libp2p-style transport
 * @memberof module:net/server
 */
export class RlpxServer extends Server {
	private peers: Map<string, RlpxPeer> = new Map();
	private connections: Map<string, RLPxConnection> = new Map();

	public discovery: boolean;
	private clientFilter: string[];

	public transport: RLPxTransport | null = null;
	public listener: RLPxListener | null = null;
	public dpt: Devp2pDPT | null = null;
	public ip: string;

	// Peer queue management (from old RLPx)
	private peersLRU: LRUCache<string, boolean>;
	private peersQueue: { peer: PeerInfo; ts: number }[] = [];
	private refillIntervalId: NodeJS.Timeout | null = null;
	private refillIntervalSelectionCounter: number = 0;

	// Protocol registry for libp2p-style protocol registration
	private protocolRegistry: ProtocolRegistry;

	/**
	 * Create new DevP2P/RLPx server
	 */
	constructor(options: RlpxServerOptions) {
		super(options);
		// As of now, the devp2p dpt server listens on the ip4 protocol by default and hence the ip in the
		// bootnode needs to be of ip4 by default
		this.ip = options.config.extIP ?? "127.0.0.1";
		this.discovery = options.config.discV4;
		this.clientFilter = options.clientFilter ?? [
			"go1.5",
			"go1.6",
			"go1.7",
			"quorum",
			"pirl", // cspell:disable-line
			"ubiq", // cspell:disable-line
			"gmc", // cspell:disable-line
			"gwhale", // cspell:disable-line
			"prichain", // cspell:disable-line
		];

		// Initialize peer tracking
		this.peersLRU = new LRUCache({ max: 25000 });

		// Initialize protocol registry
		this.protocolRegistry = new ProtocolRegistry();
	}

	/**
	 * Server name
	 */
	get name() {
		return "rlpx";
	}

	/**
	 * Return Rlpx info
	 */
	getRlpxInfo() {
		const listenAddr = this.ip.match(/^(\d+\.\d+\.\d+\.\d+)$/)
			? `${this.ip}:${this.config.port}`
			: `[${this.ip}]:${this.config.port}`;

		if (this.transport === null) {
			return {
				enode: undefined,
				id: undefined,
				ip: this.ip,
				listenAddr,
				ports: { discovery: this.config.port, listener: this.config.port },
			};
		}
		const id = bytesToUnprefixedHex(this.transport.getNodeId());
		return {
			enode: `enode://${id}@${listenAddr}`,
			id,
			ip: this.ip,
			listenAddr,
			ports: { discovery: this.config.port, listener: this.config.port },
		};
	}

	/**
	 * Start Devp2p/RLPx server.
	 * Returns a promise that resolves once server has been started.
	 * @returns true if server successfully started
	 */
	async start(): Promise<boolean> {
		if (this.started) {
			return false;
		}
		await super.start();

		// Register protocols with registry (optional - for libp2p-style API)
		for (const protocol of this.protocols) {
			if (protocol.setRegistry) {
				protocol.setRegistry(this.protocolRegistry);
			}
		}

		await this.initDpt();
		await this.initRlpx();
		this.started = true;

		return true;
	}

	/**
	 * Bootstrap bootnode from the network
	 */
	async bootstrap(): Promise<void> {
		// Bootnodes
		let promises = this.bootnodes.map((ma) => {
			const { host, port } = getHostPortFromMultiaddr(ma);
			const bootnode = {
				address: host,
				udpPort: Number(port),
				tcpPort: Number(port),
			};
			return this.dpt!.bootstrap(bootnode);
		});

		for (const promise of promises) {
			try {
				await promise;
			} catch (e: any) {
				this.error(e);
			}
		}
	}

	/**
	 * Stop Devp2p/RLPx server. Returns a promise that resolves once server has been stopped.
	 */
	async stop(): Promise<boolean> {
		if (this.started) {
			// Stop refill interval
			if (this.refillIntervalId) {
				clearInterval(this.refillIntervalId);
				this.refillIntervalId = null;
			}

			// Close all connections
			for (const connection of this.connections.values()) {
				connection.close();
			}
			this.connections.clear();

			// Close listener
			if (this.listener) {
				await this.listener.close();
			}

			// Destroy DPT
			this.dpt!.destroy();
			await super.stop();
			this.started = false;
		}
		return this.started;
	}

	/**
	 * Ban peer for a specified time
	 * @param peerId id of peer
	 * @param maxAge how long to ban peer in ms
	 * @returns true if ban was successfully executed
	 */
	ban(peerId: string, maxAge = 60000): boolean {
		if (!this.started) {
			return false;
		}
		this.dpt!.banPeer(peerId, maxAge);

		// Disconnect the connection if it exists
		const connection = this.connections.get(peerId);
		if (connection) {
			connection.disconnect();
		}
		return true;
	}

	/**
	 * Handles errors from server and peers
	 * @param error
	 * @emits {@link Event.SERVER_ERROR}
	 */
	private error(error: Error) {
		if (ignoredErrors.test(error.message)) {
			return;
		}
		this.config.events.emit(Event.SERVER_ERROR, error, this);
	}

	/**
	 * Initializes DPT for peer discovery
	 */
	private async initDpt() {
		return new Promise<void>((resolve) => {
			this.dpt = new Devp2pDPT(this.key, {
				refreshInterval: this.refreshInterval,
				endpoint: {
					address: "127.0.0.1",
					udpPort: null,
					tcpPort: null,
				},
				onlyConfirmed: false,
				shouldFindNeighbours: this.config.discV4,
				common: this.config.chainCommon,
			});

			this.dpt.events.on("error", (e: Error) => {
				this.error(e);
				// If DPT can't bind to port, resolve anyway so client startup doesn't hang
				if (e.message.includes("EADDRINUSE") === true) resolve();
			});

			this.dpt.events.on("listening", () => {
				resolve();
			});

			// Handle new peers discovered via DPT - this triggers outbound connections!
			this.dpt.events.on("peer:new", (peer: PeerInfo) => {
				if (peer.tcpPort === null || peer.tcpPort === undefined) {
					this.dpt!.banPeer(peer, 300000); // 5 min
					this.config.logger?.debug(
						`Banning peer with missing tcp port: ${peer.address}`,
					);
					return;
				}

				const key = bytesToUnprefixedHex(peer.id!);
				if (this.peersLRU.has(key)) return;
				this.peersLRU.set(key, true);

				if (this.getOpenSlots() > 0) {
					this.connectToPeer(peer);
				} else if (this.getOpenQueueSlots() > 0) {
					this.peersQueue.push({ peer, ts: 0 }); // save to queue
				}
			});

			// Handle removed peers from DPT
			this.dpt.events.on("peer:removed", (peer: PeerInfo) => {
				// Remove from queue
				this.peersQueue = this.peersQueue.filter(
					(item) =>
						!equalsBytes(item.peer.id! as Uint8Array, peer.id as Uint8Array),
				);
			});

			this.config.events.on(Event.PEER_CONNECTED, (peer) => {
				this.dpt?.confirmPeer(peer.id);
			});

			if (typeof this.config.port === "number") {
				this.dpt.bind(this.config.port, "127.0.0.1");
			}
			this.config.logger?.info(
				`Started discovery service discV4=${this.config.discV4}  refreshInterval=${this.refreshInterval}`,
			);
		});
	}

	/**
	 * Initializes RLPx transport and listener for peer management
	 */
	private async initRlpx() {
		return new Promise<void>((resolve) => {
			// Create the transport with our node key and capabilities
			this.transport = new RLPxTransport(createLoggerComponent("rlpx-server"), {
				privateKey: this.key,
				clientId: utf8ToBytes(getClientVersion()),
				capabilities: RlpxPeer.capabilities(Array.from(this.protocols)),
				common: this.config.chainCommon,
				timeout: 10000,
				maxPeers: this.config.maxPeers,
				remoteClientIdFilter: this.clientFilter,
				listeningPort: this.config.port,
			});

			// Create the listener (RLPx doesn't use upgrader since it handles its own handshake)
			this.listener = this.transport.createListener({
				listenPort: this.config.port,
			}) as RLPxListener;

			// Handle incoming connections (after Hello exchange is complete)
			this.listener.addEventListener("rlpx:connection", async (event) => {
				const connection = event.detail;
				await this.handleConnection(connection, true);
			});

			this.listener.addEventListener("error", (event) => {
				this.error(event.detail as Error);
				// If can't bind to port, resolve anyway so client startup doesn't hang
				if ((event.detail as Error).message?.includes("EADDRINUSE") === true)
					resolve();
			});

			this.listener.addEventListener("listening", () => {
				this.config.events.emit(Event.SERVER_LISTENING, {
					transport: this.name,
					url: this.getRlpxInfo().enode ?? "",
				});
				resolve();
			});

			// Start connection refill interval (every 1 second, subdivided)
			const REFILL_INTERVAL = 10000; // 10 sec
			const refillIntervalSubdivided = Math.floor(REFILL_INTERVAL / 10);
			this.refillIntervalId = setInterval(
				() => this.refillConnections(),
				refillIntervalSubdivided,
			);

			// Start listening
			if (typeof this.config.port === "number") {
				const listenAddr = multiaddr(`/ip4/${this.ip}/tcp/${this.config.port}`);
				this.listener.listen(listenAddr).catch((e: Error) => {
					this.error(e);
					if (e.message?.includes("EADDRINUSE") === true) resolve();
				});
			}
		});
	}

	/**
	 * Handle a new RLPx connection (inbound or outbound)
	 */
	private async handleConnection(
		connection: RLPxConnection,
		isInbound: boolean,
	): Promise<void> {
		const remoteAddress = connection.remoteAddress!;
		const remotePort = connection.remotePort!;
		const peerId = connection.getId()!;
		const peerIdHex = bytesToUnprefixedHex(peerId);

		// Check for self-connection
		const ourNodeId = this.transport!.getNodeId();
		if (equalsBytes(peerId, ourNodeId)) {
			this.config.logger?.debug(
				`Rejecting self-connection from ${remoteAddress}:${remotePort}`,
			);
			connection.disconnect(DISCONNECT_REASON.SAME_IDENTITY);
			return;
		}

		// Check for already connected peer
		if (this.peers.has(peerIdHex) || this.connections.has(peerIdHex)) {
			this.config.logger?.debug(
				`Rejecting duplicate connection from ${remoteAddress}:${remotePort} (id: ${peerIdHex.slice(0, 8)}...)`,
			);
			connection.disconnect(DISCONNECT_REASON.ALREADY_CONNECTED);
			return;
		}

		let peer: RlpxPeer | null = new RlpxPeer({
			config: this.config,
			id: peerIdHex,
			host: remoteAddress,
			port: remotePort,
			protocols: Array.from(this.protocols),
			inbound: isInbound,
		});

		try {
			await peer.accept(connection, this);
			this.peers.set(peer.id, peer);
			this.connections.set(peerIdHex, connection);
			this.config.logger?.debug(`Peer connected: ${peer}`);
			this.config.events.emit(Event.PEER_CONNECTED, peer);

			// Handle connection close
			connection.once("close", (reason: number | undefined) => {
				const disconnectedPeer = this.peers.get(peerIdHex);
				if (disconnectedPeer) {
					this.peers.delete(peerIdHex);
					this.connections.delete(peerIdHex);
					this.config.logger?.debug(
						`Peer disconnected (${connection.getDisconnectPrefix(reason ?? 0)}): ${disconnectedPeer}`,
					);
					this.config.events.emit(Event.PEER_DISCONNECTED, disconnectedPeer);
				}
			});

			// Handle connection errors
			connection.on("error", (err: Error) => {
				this.error(err);
			});

			// Add inbound peers to DPT so they can be shared with other nodes
			// This enables proper peer discovery propagation
			if (isInbound && this.dpt) {
				// Get the peer's advertised listening port from HELLO message
				const helloMsg = connection.getHelloMessage();
				const listeningPort = helloMsg?.port ?? remotePort;

				// Only add to DPT if we have a valid port
				if (listeningPort > 0 && listeningPort < 65536) {
					const peerInfo = {
						id: peerId,
						address: remoteAddress,
						udpPort: listeningPort,
						tcpPort: listeningPort,
					};
					// Add verified peer directly (skip UDP ping since we have RLPx connection)
					const added = this.dpt.kademlia.addPeer(peerInfo);
					if (added) {
						this.config.logger?.info(
							`Added inbound peer to DPT: ${remoteAddress}:${listeningPort} (DPT size: ${this.dpt.numPeers()})`,
						);
					}
				} else {
					this.config.logger?.debug(
						`Skipping DPT add for peer ${remoteAddress} - no valid listen port (${listeningPort})`,
					);
				}
			}
		} catch (error: any) {
			// Fixes a memory leak where RlpxPeer objects could not be GCed,
			// likely to the complex two-way bound-protocol logic
			peer = null;
			this.error(error);
		}
	}

	/**
	 * Get number of open connection slots
	 */
	private getOpenSlots(): number {
		return Math.max(this.config.maxPeers - this.peers.size, 0);
	}

	/**
	 * Get number of open queue slots
	 */
	private getOpenQueueSlots(): number {
		return this.config.maxPeers * 2 - this.peersQueue.length;
	}

	/**
	 * Connect to a peer discovered via DPT
	 */
	private connectToPeer(peer: PeerInfo): void {
		if (
			peer.tcpPort === undefined ||
			peer.tcpPort === null ||
			peer.address === undefined ||
			peer.id === undefined
		) {
			return;
		}

		const peerKey = bytesToUnprefixedHex(peer.id);

		// Check for self-connection
		const ourNodeId = this.transport!.getNodeId();
		if (equalsBytes(peer.id, ourNodeId)) {
			return;
		}

		// Already connected?
		if (this.peers.has(peerKey) || this.connections.has(peerKey)) {
			return;
		}

		this.config.logger?.debug(
			`Connecting to peer ${peer.address}:${peer.tcpPort} (id: ${peerKey.slice(0, 8)}...)`,
		);

		const dialAddr = multiaddr(`/ip4/${peer.address}/tcp/${peer.tcpPort}`);

		this.transport!.dial(dialAddr, {
			remoteId: peer.id,
			// signal: AbortSignal.timeout(10000),
			// listenPort: this.config.port, // Advertise our listen port
		})
			.then((connection) => {
				this.handleConnection(connection, false);
			})
			.catch((err) => {
				if (this.dpt === null) return;
				if (
					err.code === "ECONNRESET" ||
					(err.toString() as string).includes("Connection timeout")
				) {
					this.dpt.banPeer(peer, 300000); // 5 min
				}
				this.error(err);
			});
	}

	/**
	 * Refill connections from the peer queue
	 */
	private refillConnections(): void {
		if (!this.started) return;

		if (this.refillIntervalSelectionCounter === 0) {
			this.config.logger?.debug(
				`Refill connections: peers=${this.peers.size}, queue=${this.peersQueue.length}, openSlots=${this.getOpenSlots()}`,
			);
		}

		// Rotating selection counter going in loop from 0..9
		this.refillIntervalSelectionCounter =
			(this.refillIntervalSelectionCounter + 1) % 10;

		this.peersQueue = this.peersQueue.filter((item) => {
			if (this.getOpenSlots() === 0) return true;
			if (item.ts > Date.now()) return true;

			// Randomly distributed selector based on peer ID
			// to decide on subdivided execution
			const selector =
				bytesToInt((item.peer.id! as Uint8Array).subarray(0, 1)) % 10;
			if (selector === this.refillIntervalSelectionCounter) {
				this.connectToPeer(item.peer);
				return false;
			} else {
				// Still keep peer in queue
				return true;
			}
		});
	}

	/**
	 * Dial a peer with a specific protocol (libp2p-style API)
	 *
	 * @param peerId Peer ID (hex string)
	 * @param protocol Protocol string (e.g., "/eth/68/1.0.0")
	 * @returns Promise resolving to ProtocolStream
	 *
	 * @example
	 * ```typescript
	 * const stream = await server.dialProtocol(peerId, "/eth/68/1.0.0");
	 * stream.onMessage((code, payload) => {
	 *   console.log("Received:", code, payload);
	 * });
	 * stream.send(0x03, encodedGetBlockHeaders);
	 * ```
	 */
	async dialProtocol(
		peerId: string,
		protocol: string,
	): Promise<ProtocolStream> {
		// Find peer
		const peer = this.peers.get(peerId);
		if (!peer) {
			throw new Error(`Peer ${peerId} not found`);
		}

		// Get connection from peer
		const connection = this.connections.get(peerId);
		if (!connection) {
			throw new Error(`No connection found for peer ${peerId}`);
		}

		// Parse protocol string
		const match = protocol.match(/^\/(\w+)\/(\d+)\//);
		if (!match) {
			throw new Error(`Invalid protocol string: ${protocol}`);
		}

		const protocolName = match[1];
		const version = parseInt(match[2], 10);

		// Get protocol stream from connection
		const stream = connection.getProtocolStream(protocolName, version);
		if (!stream) {
			const availableProtocols = connection
				.getProtocols()
				.map((p) => p.constructor.name)
				.join(", ");
			throw new Error(
				`Protocol ${protocol} not available on peer ${peerId}. Available: ${availableProtocols}`,
			);
		}

		return stream;
	}
}
