import debug from "debug";
import {
	Block,
	type BlockBodyBytes,
	type BlockBytes,
	type BlockHeader,
	type BlockHeaderBytes,
	createBlockFromBytesArray,
	createBlockHeaderFromBytesArray,
} from "../../../block";
import type {
	ETH as Devp2pETH,
	EthMessageCodes,
	EthStatusEncoded,
} from "../../../devp2p/protocol/eth.ts";
import type { Input } from "../../../rlp";
import * as RLP from "../../../rlp";
import {
	createTxFromBlockBodyData,
	createTxFromRLP,
	isLegacyTx,
	type TypedTransaction,
} from "../../../tx";
import {
	BIGINT_0,
	bigIntToUnpaddedBytes,
	bytesToBigInt,
	bytesToHex,
	bytesToInt,
	EthereumJSErrorWithoutCode,
	hexToBytes,
	intToUnpaddedBytes,
	isNestedUint8Array,
	Lock,
	type PrefixedHexString,
} from "../../../utils";
import {
	encodeReceipt,
	type PostByzantiumTxReceipt,
	type PreByzantiumTxReceipt,
	type TxReceipt,
} from "../../../vm";
import type { Config } from "../../config.ts";
import type { TxReceiptWithType } from "../../execution/receipt.ts";
import { Event } from "../../types.ts";
import type { Peer } from "../peer/peer.ts";
import type { EthProtocolMethods } from "./ethprotocol.ts";
import type { Message } from "./protocol.ts";

// Log type for receipts (simplified - logs are always empty in value-transfer-only mode)
type Log = [address: Uint8Array, topics: Uint8Array[], data: Uint8Array];

const log = debug("p2p:bound-eth-protocol");

export interface P2PBoundEthProtocolOptions {
	/* Config */
	config: Config;

	/* Peer */
	peer: Peer;

	/* DevP2P ETH protocol instance */
	protocol: Devp2pETH;
}

/**
 * Mapping from devp2p ETH message codes to EthProtocol message names
 * (devp2p uses UPPER_SNAKE_CASE, EthProtocol uses camelCase)
 */
const CODE_TO_NAME_MAP: Record<number, string> = {
	0: "Status",
	1: "NewBlockHashes",
	2: "Transactions",
	3: "GetBlockHeaders",
	4: "BlockHeaders",
	5: "GetBlockBodies",
	6: "BlockBodies",
	7: "NewBlock",
	8: "NewPooledTransactionHashes",
	9: "GetPooledTransactions",
	10: "PooledTransactions",
	13: "GetNodeData",
	14: "NodeData",
	15: "GetReceipts",
	16: "Receipts",
};

/**
 * Mapping from EthProtocol message names to devp2p ETH message codes
 */
const NAME_TO_CODE_MAP: Record<string, number> = {
	Status: 0,
	NewBlockHashes: 1,
	Transactions: 2,
	GetBlockHeaders: 3,
	BlockHeaders: 4,
	GetBlockBodies: 5,
	BlockBodies: 6,
	NewBlock: 7,
	NewPooledTransactionHashes: 8,
	GetPooledTransactions: 9,
	PooledTransactions: 10,
	GetNodeData: 13,
	NodeData: 14,
	GetReceipts: 15,
	Receipts: 16,
};

/**
 * Mapping from request message names to response message codes
 */
const REQUEST_TO_RESPONSE_CODE: Record<string, number> = {
	GetBlockHeaders: 4, // BlockHeaders
	GetBlockBodies: 6, // BlockBodies
	GetPooledTransactions: 10, // PooledTransactions
	GetReceipts: 16, // Receipts
	GetNodeData: 14, // NodeData
};

/**
 * P2P Bound ETH Protocol - Wraps devp2p ETH protocol instance
 * to provide the same interface as BoundEthProtocol
 *
 * This adapter bridges the devp2p ETH protocol (used by RLPxConnection)
 * with the client's protocol message handling system.
 */
export class P2PBoundEthProtocol implements EthProtocolMethods {
	public readonly config: Config;
	public readonly peer: Peer;
	public readonly name = "eth";

	private readonly protocol: Devp2pETH;
	private _status: EthStatusEncoded | null = null;
	public updatedBestHeader?: BlockHeader;

	// Request tracking
	private resolvers: Map<
		number,
		{
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
			timeout: NodeJS.Timeout;
			lock: Lock;
		}
	> = new Map();
	private readonly timeout: number = 8000; // 8 second timeout
	private nextReqId = BIGINT_0;

	// Message definitions with encode/decode methods (similar to EthProtocol)
	private readonly messages: Message[] = [
		{
			name: "NewBlockHashes",
			code: 0x01,
			encode: (hashes: any[]) =>
				hashes.map((hn) => [hn[0], bigIntToUnpaddedBytes(hn[1])]),
			decode: (hashes: any[]) =>
				hashes.map((hn) => [hn[0], bytesToBigInt(hn[1])]),
		},
		{
			name: "Transactions",
			code: 0x02,
			encode: (txs: TypedTransaction[]) => {
				const serializedTxs = [];
				for (const tx of txs) {
					serializedTxs.push(tx.serialize());
				}
				return serializedTxs;
			},
			decode: (txs: Uint8Array[]) => {
				if (!this.config.synchronized) return;
				const common = this.config.chainCommon.copy();
				return txs.map((txData) => createTxFromRLP(txData, { common }));
			},
		},
		{
			name: "GetBlockHeaders",
			code: 0x03,
			response: 0x04,
			encode: ({
				reqId,
				block,
				max,
				skip = 0,
				reverse = false,
			}: {
				reqId?: bigint;
				block: bigint | Uint8Array;
				max: number;
				skip?: number;
				reverse?: boolean;
			}) => [
				bigIntToUnpaddedBytes(reqId ?? ++this.nextReqId),
				[
					typeof block === "bigint" ? bigIntToUnpaddedBytes(block) : block,
					intToUnpaddedBytes(max),
					intToUnpaddedBytes(skip),
					intToUnpaddedBytes(!reverse ? 0 : 1),
				],
			],
			decode: ([reqId, [block, max, skip, reverse]]: any) => ({
				reqId: bytesToBigInt(reqId),
				block: block.length === 32 ? block : bytesToBigInt(block),
				max: bytesToInt(max),
				skip: bytesToInt(skip),
				reverse: bytesToInt(reverse) === 0 ? false : true,
			}),
		},
		{
			name: "BlockHeaders",
			code: 0x04,
			encode: ({
				reqId,
				headers,
			}: {
				reqId: bigint;
				headers: BlockHeader[];
			}) => [bigIntToUnpaddedBytes(reqId), headers.map((h) => h.raw())],
			decode: ([reqId, headers]: [Uint8Array, BlockHeaderBytes[]]) => [
				bytesToBigInt(reqId),
				headers.map((h) => {
					const common = this.config.chainCommon;
					const header = createBlockHeaderFromBytesArray(h, { common });
					return header;
				}),
			],
		},
		{
			name: "GetBlockBodies",
			code: 0x05,
			response: 0x06,
			encode: ({ reqId, hashes }: { reqId?: bigint; hashes: Uint8Array[] }) => [
				bigIntToUnpaddedBytes(reqId ?? ++this.nextReqId),
				hashes,
			],
			decode: ([reqId, hashes]: [Uint8Array, Uint8Array[]]) => ({
				reqId: bytesToBigInt(reqId),
				hashes,
			}),
		},
		{
			name: "BlockBodies",
			code: 0x06,
			encode: ({
				reqId,
				bodies,
			}: {
				reqId: bigint;
				bodies: BlockBodyBytes[];
			}) => [bigIntToUnpaddedBytes(reqId), bodies],
			decode: ([reqId, bodies]: [Uint8Array, BlockBodyBytes[]]) => [
				bytesToBigInt(reqId),
				bodies,
			],
		},
		{
			name: "NewBlock",
			code: 0x07,
			encode: ([block, td]: [Block, bigint]) => [
				block.raw(),
				bigIntToUnpaddedBytes(td),
			],
			decode: ([block, td]: [BlockBytes, Uint8Array]) => [
				createBlockFromBytesArray(block, {
					common: this.config.chainCommon,
				}),
				td,
			],
		},
		{
			name: "NewPooledTransactionHashes",
			code: 0x08,
			encode: (
				params:
					| Uint8Array[]
					| [types: number[], sizes: number[], hashes: Uint8Array[]],
			) => {
				return isNestedUint8Array(params) === true
					? params
					: [
							bytesToHex(new Uint8Array(params[0])), // This matches the Geth implementation
							params[1],
							params[2],
						];
			},
			decode: (
				params:
					| Uint8Array[]
					| [types: PrefixedHexString, sizes: number[], hashes: Uint8Array[]],
			) => {
				if (isNestedUint8Array(params) === true) {
					return params;
				} else {
					const [types, sizes, hashes] = params as [
						PrefixedHexString,
						number[],
						Uint8Array[],
					];
					return [hexToBytes(types), sizes.map((size) => BigInt(size)), hashes];
				}
			},
		},
		{
			name: "GetPooledTransactions",
			code: 0x09,
			response: 0x0a,
			encode: ({ reqId, hashes }: { reqId?: bigint; hashes: Uint8Array[] }) => [
				bigIntToUnpaddedBytes(reqId ?? ++this.nextReqId),
				hashes,
			],
			decode: ([reqId, hashes]: [Uint8Array, Uint8Array[]]) => ({
				reqId: bytesToBigInt(reqId),
				hashes,
			}),
		},
		{
			name: "PooledTransactions",
			code: 0x0a,
			encode: ({ reqId, txs }: { reqId: bigint; txs: TypedTransaction[] }) => {
				const serializedTxs = [];
				for (const tx of txs) {
					// Only legacy transactions supported
					if (isLegacyTx(tx)) {
						serializedTxs.push(tx.raw());
					}
				}

				return [bigIntToUnpaddedBytes(reqId), serializedTxs];
			},
			decode: ([reqId, txs]: [Uint8Array, any[]]) => {
				const common = this.config.chainCommon.copy();
				return [
					bytesToBigInt(reqId),
					txs.map((txData) => {
						return createTxFromBlockBodyData(txData, { common });
					}),
				];
			},
		},
		{
			name: "GetReceipts",
			code: 0x0f,
			response: 0x10,
			encode: ({ reqId, hashes }: { reqId?: bigint; hashes: Uint8Array[] }) => [
				bigIntToUnpaddedBytes(reqId ?? ++this.nextReqId),
				hashes,
			],
			decode: ([reqId, hashes]: [Uint8Array, Uint8Array[]]) => ({
				reqId: bytesToBigInt(reqId),
				hashes,
			}),
		},
		{
			name: "Receipts",
			code: 0x10,
			encode: ({
				reqId,
				receipts,
			}: {
				reqId: bigint;
				receipts: TxReceiptWithType[];
			}) => {
				const serializedReceipts = [];
				for (const receipt of receipts) {
					const encodedReceipt = encodeReceipt(receipt, receipt.txType);
					serializedReceipts.push(encodedReceipt);
				}
				return [bigIntToUnpaddedBytes(reqId), serializedReceipts];
			},
			decode: ([reqId, receipts]: [Uint8Array, Uint8Array[]]) => [
				bytesToBigInt(reqId),
				receipts.map((r) => {
					// Legacy receipt if r[0] >= 0xc0, otherwise typed receipt with first byte as TransactionType
					const decoded = RLP.decode(r[0] >= 0xc0 ? r : r.subarray(1));
					const [stateRootOrStatus, cumulativeGasUsed, logsBloom, logs] =
						decoded as [Uint8Array, Uint8Array, Uint8Array, Log[]];
					const receipt = {
						cumulativeBlockGasUsed: bytesToBigInt(cumulativeGasUsed),
						bitvector: logsBloom,
						logs,
					} as TxReceipt;
					if (stateRootOrStatus.length === 32) {
						(receipt as PreByzantiumTxReceipt).stateRoot = stateRootOrStatus;
					} else {
						(receipt as PostByzantiumTxReceipt).status = bytesToInt(
							stateRootOrStatus,
						) as 0 | 1;
					}
					return receipt;
				}),
			],
		},
	];

	constructor(options: P2PBoundEthProtocolOptions) {
		log(
			"Creating P2PBoundEthProtocol for peer %s",
			options.peer.id.slice(0, 8),
		);
		this.config = options.config;
		this.peer = options.peer;
		this.protocol = options.protocol;

		// Listen for protocol messages
		this.protocol.events.on(
			"message",
			(code: number, payload: Uint8Array | unknown[]) => {
				this.handleMessage(code, payload);
			},
		);

		// Listen for status
		this.protocol.events.on("status", (status: EthStatusEncoded) => {
			log("STATUS received for peer %s", options.peer.id.slice(0, 8));
			this._status = status;
		});
		log("P2PBoundEthProtocol created for peer %s", options.peer.id.slice(0, 8));
	}

	get status(): EthStatusEncoded {
		if (!this._status) {
			throw new Error("Status not yet received");
		}
		return this._status;
	}

	get versions(): number[] {
		return [this.protocol.getVersion()];
	}

	/**
	 * Find message definition by code
	 */
	private getMessage(code: number): Message | undefined {
		return this.messages.find((m) => m.code === code);
	}

	/**
	 * Find message definition by name
	 */
	private getMessageByName(name: string): Message | undefined {
		return this.messages.find((m) => m.name === name);
	}

	/**
	 * Handle incoming message from devp2p ETH protocol
	 */
	private handleMessage(code: number, payload: Uint8Array | unknown[]): void {
		const message = this.getMessage(code);
		const messageName = message?.name || this.getMessageName(code);
		log(
			"Received message: %s (code: 0x%x) from peer %s",
			messageName || "unknown",
			code,
			this.peer.id.slice(0, 8),
		);

		// Check for pending request (response code)
		const resolver = this.resolvers.get(code);
		if (resolver) {
			log("Resolving pending request for code 0x%x", code);
			clearTimeout(resolver.timeout);
			this.resolvers.delete(code);
			resolver.lock.release();
			// Decode response if decoder is available
			if (message?.decode) {
				try {
					const decoded = message.decode(payload as any);
					resolver.resolve(decoded);
				} catch (error) {
					log("Error decoding response: %s", error);
					resolver.reject(
						error instanceof Error ? error : new Error(String(error)),
					);
				}
			} else {
				resolver.resolve(payload);
			}
			return;
		}

		// Map code to message name
		if (!message) {
			log("Unknown ETH message code: 0x%x", code);
			this.config.logger?.warn(
				`Unknown ETH message code: 0x${code.toString(16)}`,
			);
			return;
		}

		// Decode payload using message decoder
		let decodedData: unknown = payload;
		if (message.decode) {
			try {
				decodedData = message.decode(payload as any);
				log("Decoded message %s successfully", messageName);
			} catch (error: unknown) {
				const err = error instanceof Error ? error : new Error(String(error));
				log("Error decoding message %s: %s", messageName, err.message);
				this.config.events.emit(Event.PROTOCOL_ERROR, err, this.peer);
				return;
			}
		}

		// Emit as protocol message event (for FullEthereumService.handleEth)
		log("Emitting PROTOCOL_MESSAGE event: %s", messageName);
		this.config.events.emit(
			Event.PROTOCOL_MESSAGE,
			{ name: messageName, data: decodedData },
			"eth",
			this.peer,
		);
	}

	/**
	 * Get message name from code
	 */
	private getMessageName(code: number): string | undefined {
		return CODE_TO_NAME_MAP[code];
	}

	/**
	 * Get message code from name
	 */
	private getMessageCode(name: string): number | undefined {
		return NAME_TO_CODE_MAP[name];
	}

	/**
	 * Get response code for a request name
	 */
	private getResponseCode(name: string): number | undefined {
		return REQUEST_TO_RESPONSE_CODE[name];
	}

	/**
	 * Send ETH message
	 */
	send(name: string, args?: unknown) {
		log("Sending message: %s to peer %s", name, this.peer.id.slice(0, 8));

		// Status should use sendStatus, not send
		if (name === "Status") {
			throw new Error("Please send status message through sendStatus()");
		}

		const message = this.getMessageByName(name);
		if (!message) {
			log("Unknown message name: %s", name);
			throw EthereumJSErrorWithoutCode(`Unknown message: ${name}`);
		}

		const code = message.code;

		// Encode payload using message encoder
		let payload: Input;
		try {
			if (message.encode) {
				payload = message.encode(args as any) as Input;
				log("Encoded message %s successfully", name);
			} else {
				// Fallback: use args as-is if no encoder
				payload = args as Input;
			}

			// Send via protocol
			log("Sending message via protocol: %s (code: 0x%x)", name, code);
			this.protocol.sendMessage(code as EthMessageCodes, payload);
			return message;
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			log("Error sending message %s: %s", name, err.message);
			this.config.events.emit(Event.PROTOCOL_ERROR, err, this.peer);
			throw err;
		}
	}

	/**
	 * Request with response
	 */
	private async request(name: string, args: unknown): Promise<unknown> {
		log("Requesting: %s from peer %s", name, this.peer.id.slice(0, 8));
		try {
			const message = this.send(name, args);
			const requestCode = this.getMessageCode(message.name);
			if (requestCode === undefined) {
				log("Unknown request message: %s", name);
				throw EthereumJSErrorWithoutCode(`Unknown request message: ${name}`);
			}

			const responseCode = this.getResponseCode(name);
			if (responseCode === undefined) {
				log("Message %s does not have a response", name);
				throw EthereumJSErrorWithoutCode(
					`Message ${name} does not have a response`,
				);
			}

			// Check if there's already a pending request for this response code
			let lock: Lock | undefined;
			const existingResolver = this.resolvers.get(responseCode);
			if (existingResolver) {
				lock = existingResolver.lock;
				await lock.acquire();
			} else {
				lock = new Lock();
				await lock.acquire();
			}

			// Create resolver
			const resolver: {
				resolve: (value: unknown) => void;
				reject: (error: Error) => void;
				timeout: NodeJS.Timeout;
				lock: Lock;
			} = {
				resolve: () => {},
				reject: () => {},
				timeout: null as unknown as NodeJS.Timeout,
				lock,
			};

			// Set timeout
			resolver.timeout = setTimeout(() => {
				if (this.resolvers.has(responseCode)) {
					this.resolvers.delete(responseCode);
					lock.release();
					resolver.reject(
						EthereumJSErrorWithoutCode(
							`Request ${name} timed out after ${this.timeout}ms`,
						),
					);
				}
			}, this.timeout);

			// Store resolver
			this.resolvers.set(responseCode, resolver);

			// Send request

			log("Request sent, waiting for response (code: 0x%x)", responseCode);
		} catch (error: unknown) {
			log(
				"Error sending request %s: %s",
				name,
				error instanceof Error ? error.message : String(error),
			);
			this.resolvers.delete(responseCode);
			lock.release();
			clearTimeout(resolver.timeout);
			const err = error instanceof Error ? error : new Error(String(error));
			throw err;
		}

		// Wait for response
		return new Promise<unknown>((resolve, reject) => {
			resolver.resolve = (value: unknown) => {
				resolve(value);
			};
			resolver.reject = (error: Error) => {
				reject(error);
			};
		});
	}

	/**
	 * Handle queued messages (compatibility - no-op for P2P)
	 */
	handleMessageQueue(): void {
		// No-op - messages flow through events directly
	}

	// ETH Protocol Methods (same interface as BoundEthProtocol)

	async getBlockHeaders(opts: {
		reqId?: bigint | undefined;
		block: bigint | Uint8Array;
		max: number;
		skip?: number | undefined;
		reverse?: boolean | undefined;
	}): Promise<[bigint, BlockHeader[]] | undefined> {
		try {
			const response = await this.request("GetBlockHeaders", opts);
			// Response is already decoded by handleMessage: [reqId, headers]
			return response as [bigint, BlockHeader[]];
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.config.events.emit(Event.PROTOCOL_ERROR, err, this.peer);
			return undefined;
		}
	}

	async getBlockBodies(opts: {
		reqId?: bigint | undefined;
		hashes: Uint8Array[];
	}): Promise<[bigint, BlockBodyBytes[]] | undefined> {
		try {
			const response = await this.request("GetBlockBodies", opts);
			// Response is already decoded by handleMessage: [reqId, bodies]
			return response as [bigint, BlockBodyBytes[]];
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.config.events.emit(Event.PROTOCOL_ERROR, err, this.peer);
			return undefined;
		}
	}

	async getPooledTransactions(opts: {
		reqId?: bigint | undefined;
		hashes: Uint8Array[];
	}): Promise<[bigint, TypedTransaction[]] | undefined> {
		try {
			const response = await this.request("GetPooledTransactions", opts);
			// Response is already decoded by handleMessage: [reqId, txs]
			return response as [bigint, TypedTransaction[]];
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.config.events.emit(Event.PROTOCOL_ERROR, err, this.peer);
			return undefined;
		}
	}

	async getReceipts(opts: {
		reqId?: bigint | undefined;
		hashes: Uint8Array[];
	}): Promise<[bigint, TxReceipt[]] | undefined> {
		try {
			const response = await this.request("GetReceipts", opts);
			// Response is already decoded by handleMessage: [reqId, receipts]
			return response as [bigint, TxReceipt[]];
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.config.events.emit(Event.PROTOCOL_ERROR, err, this.peer);
			return undefined;
		}
	}
}
