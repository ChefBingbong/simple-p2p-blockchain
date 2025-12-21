import debug from "debug";
import type { ETH as Devp2pETH } from "../../../devp2p/protocol/eth.ts";
import type { Connection } from "../../../p2p/libp2p/types.ts";
import { peerIdToString } from "../../../p2p/libp2p/types.ts";
import type { RLPxConnection } from "../../../p2p/transport/rlpx/index.ts";
import { Event } from "../../types.ts";
import type {
	BoundEthProtocol,
	BoundProtocol,
} from "../protocol/boundprotocol.ts";
import { P2PBoundEthProtocol } from "../protocol/p2p-bound-eth-protocol.ts";
import type { PeerOptions } from "./peer.ts";
import { Peer } from "./peer.ts";

const log = debug("p2p:peer");

export interface P2PPeerOptions
	extends Omit<PeerOptions, "address" | "transport"> {
	/* P2P Connection from P2PNode */
	connection: Connection;

	/* RLPx Connection (extracted from connection) */
	rlpxConnection: RLPxConnection;

	/* Pass true if peer initiated connection (default: false) */
	inbound?: boolean;
}

/**
 * P2P Peer - Wraps a libp2p-style Connection + RLPxConnection
 * to provide the same interface as RlpxPeer for compatibility
 * with existing synchronizer/txpool code
 *
 * @memberof module:net/peer
 */
export class P2PPeer extends Peer {
	public readonly connection: Connection;
	public readonly rlpxConnection: RLPxConnection;

	/**
	 * Create new P2P peer
	 */
	constructor(options: P2PPeerOptions) {
		// Derive ID from remote peer
		const peerIdHex = peerIdToString(options.connection.remotePeer);

		log("Creating P2PPeer: %s", peerIdHex.slice(0, 8));

		// Derive address from remote address
		const address = options.connection.remoteAddr.toString();

		super({
			config: options.config,
			id: peerIdHex,
			address,
			transport: "p2p",
			inbound: options.inbound ?? options.connection.direction === "inbound",
			protocols: [], // Protocols are accessed via RLPxConnection
			server: options.server,
		});

		this.connection = options.connection;
		this.rlpxConnection = options.rlpxConnection;

		log("Binding protocols for peer %s", peerIdHex.slice(0, 8));
		// Bind protocols immediately (connection is already established)
		this.bindProtocols();

		// Listen for RLPx connection close events
		this.rlpxConnection.once("close", () => {
			log("RLPx connection closed for peer %s", peerIdHex.slice(0, 8));
			this.config.events.emit(Event.PEER_DISCONNECTED, this);
		});

		// Listen for RLPx connection errors
		this.rlpxConnection.on("error", (err: Error) => {
			log("RLPx connection error for peer %s: %s", peerIdHex.slice(0, 8), err.message);
			this.config.events.emit(Event.PEER_ERROR, err, this);
		});
		log("P2PPeer created: %s", peerIdHex.slice(0, 8));
	}

	/**
	 * Bind protocols from RLPxConnection
	 */
	private bindProtocols(): void {
		const protocols = this.rlpxConnection.getProtocols();
		log("Found %d protocols for peer %s", protocols.length, this.id.slice(0, 8));

		// Find ETH protocol
		const ethProtocol = protocols.find((p) => p.constructor.name === "ETH") as
			| Devp2pETH
			| undefined;

		if (ethProtocol) {
			log("Binding ETH protocol for peer %s", this.id.slice(0, 8));
			// Create P2PBoundEthProtocol wrapper
			const p2pEth = new P2PBoundEthProtocol({
				config: this.config,
				peer: this,
				protocol: ethProtocol,
			});

			// Assign to eth property (cast to BoundEthProtocol for compatibility)
			// P2PBoundEthProtocol implements the same interface methods used by Peer
			this.eth = p2pEth as unknown as BoundEthProtocol;

			// Store in boundProtocols for handleMessageQueue compatibility
			this.boundProtocols.push(p2pEth as unknown as BoundProtocol);
			log("ETH protocol bound for peer %s", this.id.slice(0, 8));
		} else {
			log("No ETH protocol found for peer %s", this.id.slice(0, 8));
		}
	}

	/**
	 * Connect peer (no-op for P2P peers - connection already established)
	 */
	async connect(): Promise<void> {
		log("connect() called for peer %s (already connected)", this.id.slice(0, 8));
		// Connection is already established when P2PPeer is created
		// This method exists for interface compatibility
		if (this.connection.status === "open") {
			this.config.events.emit(Event.PEER_CONNECTED, this);
		}
	}

	/**
	 * Disconnect peer
	 */
	async disconnect(): Promise<void> {
		log("Disconnecting peer %s", this.id.slice(0, 8));
		await this.connection.close();
		log("Peer %s disconnected", this.id.slice(0, 8));
	}

	/**
	 * Handle queued messages (compatibility - no-op for P2P)
	 */
	handleMessageQueue(): void {
		// No-op - messages flow through events directly
		// But call parent for compatibility
		super.handleMessageQueue();
	}

	/**
	 * String representation of peer
	 */
	toString(withFullId = false): string {
		const properties = {
			id: withFullId ? this.id : this.id.slice(0, 8),
			address: this.address,
			transport: this.transport,
			protocols: this.boundProtocols.map((e) => e.name),
			inbound: this.inbound,
		};
		return Object.entries(properties)
			.filter(
				([, value]) =>
					value !== undefined && value !== null && value.toString() !== "",
			)
			.map((keyValue) => keyValue.join("="))
			.join(" ");
	}
}
