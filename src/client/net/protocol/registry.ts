import type { Protocol } from "./protocol.ts";
import type { ProtocolStream } from "./protocol-stream.ts";

/**
 * Protocol handler function signature
 * Similar to libp2p's protocol handler: (stream) => Promise<void>
 */
export type ProtocolHandler = (
	stream: ProtocolStream,
) => Promise<void> | void;

/**
 * Protocol registration entry
 */
interface ProtocolRegistration {
	protocol: Protocol;
	handler: ProtocolHandler;
	versions: number[];
}

/**
 * Protocol Registry - manages protocol handlers similar to libp2p's Registrar
 *
 * @example
 * ```typescript
 * const registry = new ProtocolRegistry();
 *
 * // Register ETH protocol handler
 * registry.handle(ethProtocol, async (stream) => {
 *   stream.onMessage((code, payload) => {
 *     console.log('Received:', code, payload);
 *   });
 * });
 *
 * // Get handler for a protocol
 * const handler = registry.getHandler('eth', 68);
 * ```
 */
export class ProtocolRegistry {
	private handlers = new Map<string, ProtocolRegistration>();

	/**
	 * Register a protocol handler
	 * @param protocol Protocol instance
	 * @param handler Handler function for incoming protocol streams
	 */
	handle(protocol: Protocol, handler: ProtocolHandler): void {
		// Register for each version
		for (const version of protocol.versions) {
			const protocolString = this.getProtocolString(protocol.name, version);
			this.handlers.set(protocolString, {
				protocol,
				handler,
				versions: protocol.versions,
			});
		}
	}

	/**
	 * Unregister a protocol handler
	 */
	unhandle(protocolName: string, version: number): void {
		const protocolString = this.getProtocolString(protocolName, version);
		this.handlers.delete(protocolString);
	}

	/**
	 * Get protocol handler for a given protocol name and version
	 */
	getHandler(
		protocolName: string,
		version: number,
	): ProtocolRegistration | undefined {
		const protocolString = this.getProtocolString(protocolName, version);
		return this.handlers.get(protocolString);
	}

	/**
	 * Get all registered protocol strings
	 */
	getProtocols(): string[] {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Check if a protocol is registered
	 */
	hasProtocol(protocolName: string, version: number): boolean {
		return this.getHandler(protocolName, version) !== undefined;
	}

	/**
	 * Convert protocol name and version to libp2p-style string
	 * Format: /{name}/{version}/1.0.0
	 */
	private getProtocolString(name: string, version: number): string {
		return `/${name}/${version}/1.0.0`;
	}
}

