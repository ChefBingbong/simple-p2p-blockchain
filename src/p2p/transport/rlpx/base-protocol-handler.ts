import type { ProtocolHandler, MessageHandler } from './protocol-handler';
import type { RlpxConnection } from './RlpxConnection';

/**
 * Base class for protocol handlers with message code mapping
 */
export abstract class BaseProtocolHandler implements ProtocolHandler {
	public readonly name: string;
	public readonly version: number;
	public readonly length: number;

	protected handlers: Map<number, MessageHandler> = new Map();
	protected connection?: RlpxConnection;

	constructor(name: string, version: number, length: number = 16) {
		this.name = name;
		this.version = version;
		this.length = length;
	}

	/**
	 * Register a handler for a specific message code
	 */
	protected on(code: number, handler: MessageHandler): void {
		this.handlers.set(code, handler);
	}

	/**
	 * Called when protocol is activated
	 */
	async onActivate(connection: RlpxConnection): Promise<void> {
		this.connection = connection;
	}

	/**
	 * Route message to registered handler
	 */
	async handleMessage(
		code: number,
		data: Uint8Array,
		connection: RlpxConnection,
	): Promise<void> {
		const handler = this.handlers.get(code);
		if (handler) {
			await handler(data, connection);
		} else {
			console.warn(
				`[${this.name}] No handler for code 0x${code.toString(16)}`,
			);
		}
	}

	/**
	 * Send a message for this protocol
	 */
	protected async send(code: number, data: Uint8Array): Promise<void> {
		if (!this.connection) {
			throw new Error('Protocol not activated');
		}

		// Connection will add the protocol offset automatically via routing
		await this.connection.sendMessage(code, data);
	}

	async onClose(): Promise<void> {
		this.connection = undefined;
	}
}

