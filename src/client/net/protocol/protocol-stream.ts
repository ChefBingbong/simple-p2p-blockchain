import { EventEmitter } from "eventemitter3";
import type { RLPxConnection } from "../../../p2p/transport/rlpx/index.ts";
import type { ProtocolDescriptor } from "../../../p2p/transport/rlpx/types.ts";
import * as RLP from "../../../rlp/index.ts";

/**
 * Protocol stream interface - abstracts RLPx subprotocol communication
 * Similar to libp2p's Stream interface
 */
export interface ProtocolStream {
	/**
	 * Protocol name (e.g., "eth")
	 */
	readonly protocol: string;

	/**
	 * Protocol version (e.g., 68)
	 */
	readonly version: number;

	/**
	 * Underlying RLPx connection
	 */
	readonly connection: RLPxConnection;

	/**
	 * Send a message with the given code and payload
	 * Messages are automatically encrypted via ECIES
	 * @param code Protocol message code (relative to protocol offset)
	 * @param payload Message payload (will be RLP encoded)
	 * @returns true if message was sent successfully
	 */
	send(code: number, payload: Uint8Array | any[]): boolean;

	/**
	 * Register a handler for incoming messages
	 * @param handler Function that receives (code, payload) when messages arrive
	 */
	onMessage(
		handler: (code: number, payload: Uint8Array) => void,
	): void;

	/**
	 * Close the stream (closes underlying connection)
	 */
	close(): void;
}

/**
 * ProtocolStream implementation for RLPx subprotocols
 * Wraps RLPxConnection's subprotocol messaging with ECIES encryption
 */
export class RLPxProtocolStream
	extends EventEmitter<{
		message: [code: number, payload: Uint8Array];
		close: [];
	}>
	implements ProtocolStream
{
	public readonly protocol: string;
	public readonly version: number;
	public readonly connection: RLPxConnection;
	private readonly protocolDescriptor: ProtocolDescriptor;
	private messageHandler?: (code: number, payload: Uint8Array) => void;
	private originalMessageHandler?: (code: number, payload: Uint8Array) => void;

	constructor(
		protocol: string,
		version: number,
		connection: RLPxConnection,
		protocolDescriptor: ProtocolDescriptor,
	) {
		super();
		this.protocol = protocol;
		this.version = version;
		this.connection = connection;
		this.protocolDescriptor = protocolDescriptor;

		// Setup message listener by intercepting protocol's _handleMessage
		this.setupMessageListener();
	}

	/**
	 * Setup listener for protocol messages
	 * Intercepts the protocol's _handleMessage to emit stream events
	 */
	private setupMessageListener(): void {
		const rlpxProtocol = this.protocolDescriptor.protocol;

		// Store original handler if it exists
		this.originalMessageHandler = (rlpxProtocol as any)._handleMessage;

		// Wrap the handler to emit events
		(rlpxProtocol as any)._handleMessage = (
			code: number,
			payload: Uint8Array,
		) => {
			// Call original handler if it exists (for existing protocol logic)
			if (this.originalMessageHandler) {
				this.originalMessageHandler.call(rlpxProtocol, code, payload);
			}

			// Emit message event for stream listeners
			this.emit("message", code, payload);

			// Call registered handler
			if (this.messageHandler) {
				this.messageHandler(code, payload);
			}
		};
	}

	/**
	 * Send a message with the given code and payload
	 * Messages are automatically encrypted via ECIES through sendSubprotocolMessage
	 * @param code Protocol message code (relative to protocol offset)
	 * @param payload Message payload (will be RLP encoded if not already Uint8Array)
	 */
	send(code: number, payload: Uint8Array | any[]): boolean {
		if (code > (this.protocolDescriptor.length ?? 0)) {
			return false;
		}

		// Calculate full message code (offset + protocol code)
		const fullCode = this.protocolDescriptor.offset + code;

		// Encode payload if not already Uint8Array
		let encodedPayload: Uint8Array;
		if (payload instanceof Uint8Array) {
			encodedPayload = payload;
		} else {
			encodedPayload = RLP.encode(payload);
		}

		// Use sendSubprotocolMessage which encrypts via ECIES
		return this.connection.sendSubprotocolMessage(fullCode, encodedPayload);
	}

	/**
	 * Register a handler for incoming messages
	 */
	onMessage(handler: (code: number, payload: Uint8Array) => void): void {
		this.messageHandler = handler;
	}

	/**
	 * Close the stream (closes underlying connection)
	 */
	close(): void {
		// Restore original handler
		if (this.originalMessageHandler) {
			const rlpxProtocol = this.protocolDescriptor.protocol;
			(rlpxProtocol as any)._handleMessage = this.originalMessageHandler;
		}

		this.connection.close();
		this.emit("close");
	}
}

