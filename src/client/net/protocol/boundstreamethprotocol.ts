import { EventEmitter } from "eventemitter3";
import type { Block, BlockBodyBytes, BlockHeader } from "../../../block";
import type { Connection } from "../../../p2p/connection/connection.ts";
import * as RLP from "../../../rlp";
import type { TypedTransaction } from "../../../tx";
import { BIGINT_0, bigIntToUnpaddedBytes } from "../../../utils";
import type { TxReceipt } from "../../../vm";
import type { Config } from "../../config.ts";
import type { StreamEthProtocol } from "./streamethprotocol.ts";

/**
 * Stream-based bound protocol that bridges StreamEthProtocol to BoundProtocol interface
 * This provides the methods that Synchronizer expects (getBlockHeaders, etc.)
 */
export class BoundStreamEthProtocol extends EventEmitter {
	public config: Config;
	public name: string = "eth";
	public _status: any = {};
	public updatedBestHeader?: BlockHeader;

	private connection: Connection;
	private protocol: StreamEthProtocol;
	private peerId: string;
	private requestId: bigint = BIGINT_0;
	private pendingRequests: Map<bigint, { resolve: Function; reject: Function }> = new Map();

	constructor(connection: Connection, protocol: StreamEthProtocol, peerId: string, config: Config) {
		super();
		this.connection = connection;
		this.protocol = protocol;
		this.peerId = peerId;
		this.config = config;
	}

	get status(): any {
		return this._status;
	}

	set status(status: any) {
		Object.assign(this._status, status);
	}

	/**
	 * Get block headers from peer
	 */
	async getBlockHeaders(opts: {
		block: bigint | Uint8Array;
		max: number;
		skip?: number;
		reverse?: boolean;
	}): Promise<[bigint, BlockHeader[]] | undefined> {
		try {
			const reqId = ++this.requestId;

			// Open a new stream for this request
			const stream = await this.connection.newStream([this.protocol.getProtocolStrings()[0]]);

			// Send GetBlockHeaders message
			// TODO: Implement proper request/response over stream
			// For now, return empty to prevent errors
			this.config.logger?.debug(
				`GetBlockHeaders request (reqId=${reqId}) - not yet implemented`,
			);

			return [reqId, []];
		} catch (err: any) {
			this.config.logger?.error(
				`Failed to get block headers: ${err.message}`,
			);
			return undefined;
		}
	}

	/**
	 * Get block bodies from peer
	 */
	async getBlockBodies(opts: {
		hashes: Uint8Array[];
	}): Promise<[bigint, BlockBodyBytes[]] | undefined> {
		try {
			const reqId = ++this.requestId;

			// TODO: Implement proper request/response over stream
			this.config.logger?.debug(
				`GetBlockBodies request (reqId=${reqId}) - not yet implemented`,
			);

			return [reqId, []];
		} catch (err: any) {
			this.config.logger?.error(
				`Failed to get block bodies: ${err.message}`,
			);
			return undefined;
		}
	}

	/**
	 * Get pooled transactions from peer
	 */
	async getPooledTransactions(opts: {
		hashes: Uint8Array[];
	}): Promise<[bigint, TypedTransaction[]] | undefined> {
		try {
			const reqId = ++this.requestId;

			// TODO: Implement proper request/response over stream
			this.config.logger?.debug(
				`GetPooledTransactions request (reqId=${reqId}) - not yet implemented`,
			);

			return [reqId, []];
		} catch (err: any) {
			this.config.logger?.error(
				`Failed to get pooled transactions: ${err.message}`,
			);
			return undefined;
		}
	}

	/**
	 * Get receipts from peer
	 */
	async getReceipts(opts: {
		hashes: Uint8Array[];
	}): Promise<[bigint, TxReceipt[]] | undefined> {
		try {
			const reqId = ++this.requestId;

			// TODO: Implement proper request/response over stream
			this.config.logger?.debug(
				`GetReceipts request (reqId=${reqId}) - not yet implemented`,
			);

			return [reqId, []];
		} catch (err: any) {
			this.config.logger?.error(
				`Failed to get receipts: ${err.message}`,
			);
			return undefined;
		}
	}

	/**
	 * Send a message to peer (for announcements like NewBlock, Transactions, etc.)
	 * @param name Message name (NewBlock, NewBlockHashes, Transactions, etc.)
	 * @param args Message arguments
	 */
	send(name: string, args?: any): void {
		this.config.logger?.info(
			`📢 Broadcasting ${name} to peer ${this.peerId.slice(0, 8)}...`,
		);

		try {
			// Map message names to codes
			const messageMap: Record<string, number> = {
				NewBlockHashes: 0x01,
				Transactions: 0x02,
				NewBlock: 0x07,
				NewPooledTransactionHashes: 0x08,
			};

			const code = messageMap[name];
			if (code === undefined) {
				this.config.logger?.warn(
					`Unknown message type for broadcasting: ${name}`,
				);
				return;
			}

			// Open a new stream for the announcement (fire and forget)
			this.connection
				.newStream([this.protocol.getProtocolStrings()[0]])
				.then(async (stream) => {
					// Encode message based on type
					let payload: any;
					if (name === "NewBlock") {
						const [block, td] = args as [Block, bigint];
						payload = [block.raw(), bigIntToUnpaddedBytes(td)];
					} else {
						payload = args;
					}

					// Send the message
					const encoded = RLP.encode(payload);
					const message = new Uint8Array(1 + encoded.length);
					message[0] = code;
					message.set(encoded, 1);
					stream.send(message);

					this.config.logger?.info(
						`✅ Sent ${name} announcement (${message.length} bytes)`,
					);

					// Close stream after sending announcement
					stream.close();
				})
				.catch((err) => {
					this.config.logger?.error(
						`Failed to send ${name}: ${err.message}`,
					);
				});
		} catch (err: any) {
			this.config.logger?.error(
				`Error sending ${name}: ${err.message}`,
			);
		}
	}
}

