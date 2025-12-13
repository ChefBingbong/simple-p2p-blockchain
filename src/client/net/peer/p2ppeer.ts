import { Connection } from "../../../p2p/connection/connection.ts";
import { Registrar } from "../../../p2p/connection/registrar.ts";
import { MplexStream } from "../../../p2p/muxer/index.ts";
import * as RLP from "../../../rlp";
import { bytesToBigInt, bytesToInt } from "../../../utils";
import { BoundStreamEthProtocol } from "../protocol/boundstreamethprotocol.ts";
import { StreamEthProtocol } from "../protocol/streamethprotocol.ts";
import { Peer } from "./peer.ts";

import type { P2PServer } from "../server/p2pserver.ts";
import type { PeerOptions } from "./peer.ts";

export interface P2PPeerOptions extends Omit<PeerOptions, "address" | "transport"> {
	/* Peer address */
	address: string;

	/* Connection instance */
	connection: Connection;

	/* Registrar for protocol handling */
	registrar: Registrar;
}

/**
 * P2P peer using modular connection + streams
 * @memberof module:net/peer
 */
export class P2PPeer extends Peer {
	public connection: Connection | null;
	public registrar: Registrar;
	public connected: boolean;
	private streams: Map<string, MplexStream> = new Map();

	/**
	 * Create new P2P peer
	 */
	constructor(options: P2PPeerOptions) {
		super({
			...options,
			transport: "p2p",
		});

		this.connection = options.connection;
		this.registrar = options.registrar;
		this.connected = false;
	}

	/**
	 * Initiate peer connection (not used for P2PPeer since connection is provided)
	 */
	async connect(): Promise<void> {
		if (this.connected) {
			return;
		}
		// Connection is already established when P2PPeer is created
		this.connected = true;
	}

	/**
	 * Accept new peer connection
	 */
	async accept(server: P2PServer): Promise<void> {
		if (this.connected) {
			return;
		}
		await this.bindProtocols();
		this.server = server;
		this.connected = true;
	}

	/**
	 * Bind protocols to this peer's connection
	 */
	private async bindProtocols(): Promise<void> {
		if (!this.connection) {
			throw new Error("No connection available");
		}

		this.config.logger?.info(
			`🔧 Binding ${this.protocols.length} protocol(s) for peer ${this.id.slice(0, 8)}...`,
		);

		// For each protocol, we'll set up stream handlers
		// The actual protocol negotiation happens when streams are opened
		for (const protocol of this.protocols) {
			if (protocol.name === "eth") {
				this.config.logger?.info(
					`📡 Setting up ETH protocol for peer ${this.id.slice(0, 8)}...`,
				);

				// For ETH protocol, check if it's a StreamEthProtocol
				// If it is, we can use it directly
				if (protocol instanceof StreamEthProtocol) {
					await protocol.open();
					this.config.logger?.info(
						`✅ StreamEthProtocol opened for peer ${this.id.slice(0, 8)}...`,
					);

					// CRITICAL: Create BoundStreamEthProtocol and attach it to this.eth
					// This is what the Synchronizer expects!
					const boundProtocol = new BoundStreamEthProtocol(
						this.connection,
						protocol,
						this.id,
						this.config,
					);
					this.eth = boundProtocol as any;
					
					this.config.logger?.info(
						`✅ Created BoundStreamEthProtocol - peer.eth now available for Synchronizer`,
					);
					
					// Try to open a status stream to initiate handshake
					try {
						const ethProtocols = protocol.getProtocolStrings();
						this.config.logger?.info(
							`🤝 Opening status stream for protocols: ${ethProtocols.join(", ")}`,
						);
						const stream = await this.connection.newStream(ethProtocols);
						this.config.logger?.info(
							`✅ Status stream opened: ${stream.id} using protocol ${stream.protocol}`,
						);
						
						// Track this stream
						this.streams.set(stream.id, stream);
						
						// Send status message
						await protocol.sendStatus(stream);
						this.config.logger?.info(
							`📤 Sent STATUS message to peer ${this.id.slice(0, 8)}...`,
						);

						// Listen for STATUS response on this specific stream
						const handleStatusResponse = async (evt: any) => {
							try {
								// Extract data
								let data: Uint8Array;
								if (typeof evt.data?.subarray === 'function') {
									data = evt.data.subarray();
								} else if (evt.data instanceof Uint8Array) {
									data = evt.data;
								} else {
									return;
								}

								// Parse STATUS response
								const code = data[0];
								if (code === 0x00) {  // STATUS
									const payload = data.slice(1);
									const decoded = RLP.decode(payload);
									
									if (Array.isArray(decoded) && decoded.length >= 5) {
										const [version, chainId, td, bestHash, genesisHash] = decoded as any[];
										const status = {
											version: bytesToInt(version),
											chainId: bytesToBigInt(chainId),
											td: bytesToBigInt(td),
											bestHash: bestHash,
											genesisHash: genesisHash,
										};

										this.config.logger?.info(
											`✅ Received STATUS response: chainId=${status.chainId}, td=${status.td}`,
										);

										// Set status on boundProtocol so Synchronizer can use it
										boundProtocol.status = status;
									}
								}
							} catch (err: any) {
								this.config.logger?.error(
									`Error parsing STATUS response: ${err.message}`,
								);
							}
						};

						stream.addEventListener("message", handleStatusResponse);
					} catch (err: any) {
						this.config.logger?.error(
							`❌ Failed to open status stream: ${err.message}`,
						);
					}
				} else {
					// Legacy protocol - open it
					await protocol.open();
					this.config.logger?.info(
						`✅ Legacy protocol opened for peer ${this.id.slice(0, 8)}...`,
					);
				}
			}
		}

		this.config.logger?.info(
			`✅ All protocols bound for peer ${this.id.slice(0, 8)}...`,
		);
	}

	/**
	 * Open a new stream for a specific protocol
	 */
	async openStream(protocols: string | string[]): Promise<MplexStream> {
		if (!this.connection) {
			throw new Error("No connection available");
		}

		const stream = await this.connection.newStream(protocols);
		
		// Track the stream
		if (!Array.isArray(protocols)) {
			protocols = [protocols];
		}
		this.streams.set(stream.id, stream);

		// Remove from tracking when closed
		stream.addEventListener("close", () => {
			this.streams.delete(stream.id);
		});

		return stream;
	}

	/**
	 * Get all active streams
	 */
	getStreams(): MplexStream[] {
		return Array.from(this.streams.values());
	}

	/**
	 * Close a specific stream
	 */
	async closeStream(streamId: string): Promise<void> {
		const stream = this.streams.get(streamId);
		if (stream) {
			stream.close();
			this.streams.delete(streamId);
		}
	}

	/**
	 * Get stream by ID
	 */
	getStream(streamId: string): MplexStream | undefined {
		return this.streams.get(streamId);
	}

	/**
	 * Override toString to show stream count
	 */
	override toString(withFullId = false): string {
		const baseStr = super.toString(withFullId);
		const streamCount = this.streams.size;
		return `${baseStr} streams=${streamCount}`;
	}
}

