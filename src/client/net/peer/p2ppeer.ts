import { Connection } from "../../../p2p/connection/connection.ts";
import { Registrar } from "../../../p2p/connection/registrar.ts";
import { MplexStream } from "../../../p2p/muxer/index.ts";
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
					// Note: The actual protocol handshake happens when a stream is opened
					// The StreamEthProtocol registers handlers with the registrar
					
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
						
						// Send status message
						await protocol.sendStatus(stream);
						this.config.logger?.info(
							`📤 Sent STATUS message to peer ${this.id.slice(0, 8)}...`,
						);
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

