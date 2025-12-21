import debug from "debug";
import type { BlockBodyBytes, BlockHeader } from "../../../block";
import type { EthStatusEncoded } from "../../../devp2p/protocol/eth.ts";
import type { Connection } from "../../../p2p/libp2p/types.ts";
import { peerIdToString } from "../../../p2p/libp2p/types.ts";
import { EthHandler } from "../../../p2p/protocol/eth/handler.ts";
import type { RLPxConnection } from "../../../p2p/transport/rlpx/index.ts";
import type { TypedTransaction } from "../../../tx";
import { bigIntToUnpaddedBytes } from "../../../utils";
import type { TxReceipt } from "../../../vm";
import type { Chain } from "../../blockchain";
import type { VMExecution } from "../../execution";
import { Event } from "../../types.ts";
import { ETH_MESSAGES, EthMessageCode } from "../protocol/eth/definitions.ts";
import type { EthProtocolMethods } from "../protocol/ethprotocol.ts";
import type { PeerOptions } from "./peer.ts";
import { Peer } from "./peer.ts";

const log = debug("p2p:peer");

/**
 * Adapter that wraps EthHandler to match BoundEthProtocol interface
 */
class EthHandlerAdapter implements EthProtocolMethods {
	public readonly name = "eth";
	public readonly config: typeof this.handler.config;
	public readonly peer: Peer;
	public updatedBestHeader?: BlockHeader;

	constructor(
		private readonly handler: EthHandler,
		peer: Peer,
	) {
		this.config = handler.config;
		this.peer = peer;
		this.updatedBestHeader = handler.updatedBestHeader;

		// Forward updatedBestHeader updates
		handler.on("status", () => {
			this.updatedBestHeader = handler.updatedBestHeader;
		});

		// Forward messages from EthHandler to service via PROTOCOL_MESSAGE event
		handler.on("message", (message: any) => {
			// Emit PROTOCOL_MESSAGE event so service can handle it
			this.config.events.emit(Event.PROTOCOL_MESSAGE, message, "eth", peer);
		});
	}

	get status(): EthStatusEncoded {
		// Return status in format expected by BoundEthProtocol
		const handlerStatus = this.handler.status;
		if (!handlerStatus) {
			throw new Error("Status not yet received");
		}
		// Convert EthStatus to EthStatusEncoded format
		return {
			chainId: bigIntToUnpaddedBytes(handlerStatus.chainId),
			td: bigIntToUnpaddedBytes(handlerStatus.td),
			bestHash: handlerStatus.bestHash,
			genesisHash: handlerStatus.genesisHash,
			forkId: handlerStatus.forkId,
		};
	}

	get versions(): number[] {
		return [68]; // ETH/68
	}

	async getBlockHeaders(opts: {
		reqId?: bigint;
		block: bigint | Uint8Array;
		max: number;
		skip?: number;
		reverse?: boolean;
	}): Promise<[bigint, BlockHeader[]]> {
		return this.handler.getBlockHeaders(opts);
	}

	async getBlockBodies(opts: {
		reqId?: bigint;
		hashes: Uint8Array[];
	}): Promise<[bigint, BlockBodyBytes[]]> {
		const result = await this.handler.getBlockBodies(opts);
		return result as [bigint, BlockBodyBytes[]];
	}

	async getPooledTransactions(opts: {
		reqId?: bigint;
		hashes: Uint8Array[];
	}): Promise<[bigint, TypedTransaction[]]> {
		const result = await this.handler.getPooledTransactions(opts);
		return result as [bigint, TypedTransaction[]];
	}

	async getReceipts(opts: {
		reqId?: bigint;
		hashes: Uint8Array[];
	}): Promise<[bigint, TxReceipt[]]> {
		const result = await this.handler.getReceipts(opts);
		return result as [bigint, TxReceipt[]];
	}

	handleMessageQueue(): void {
		// No-op - messages handled by EthHandler
	}

	/**
	 * Send ETH protocol message
	 * Maps message names to codes and encodes data using protocol definitions
	 */
	send(name: string, args?: unknown): void {
		// Map message name to code
		const nameToCode: Record<string, EthMessageCode> = {
			Status: EthMessageCode.STATUS,
			NewBlockHashes: EthMessageCode.NEW_BLOCK_HASHES,
			Transactions: EthMessageCode.TRANSACTIONS,
			GetBlockHeaders: EthMessageCode.GET_BLOCK_HEADERS,
			BlockHeaders: EthMessageCode.BLOCK_HEADERS,
			GetBlockBodies: EthMessageCode.GET_BLOCK_BODIES,
			BlockBodies: EthMessageCode.BLOCK_BODIES,
			NewBlock: EthMessageCode.NEW_BLOCK,
			NewPooledTransactionHashes: EthMessageCode.NEW_POOLED_TRANSACTION_HASHES,
			GetPooledTransactions: EthMessageCode.GET_POOLED_TRANSACTIONS,
			PooledTransactions: EthMessageCode.POOLED_TRANSACTIONS,
			GetNodeData: EthMessageCode.GET_NODE_DATA,
			NodeData: EthMessageCode.NODE_DATA,
			GetReceipts: EthMessageCode.GET_RECEIPTS,
			Receipts: EthMessageCode.RECEIPTS,
		};

		const code = nameToCode[name];
		if (code === undefined) {
			throw new Error(`Unknown message name: ${name}`);
		}

		// Get message definition
		const messageDef = ETH_MESSAGES[code];
		if (!messageDef) {
			throw new Error(`No message definition for code: ${code}`);
		}

		// Encode data using protocol definitions
		let encodedData: any;
		if (messageDef.encode) {
			// Handle different argument formats based on message type
			if (name === "NewBlock" && Array.isArray(args)) {
				// NewBlock: [block, td] - encode takes tuple
				const encodeFn = messageDef.encode as (args: [any, bigint]) => any;
				encodedData = encodeFn(args as [any, bigint]);
			} else if (name === "NewBlockHashes" && Array.isArray(args)) {
				// NewBlockHashes: array of [hash, number] - encode takes array
				const encodeFn = messageDef.encode as (args: any[]) => any;
				encodedData = encodeFn(args as any[]);
			} else if (name === "Transactions" && Array.isArray(args)) {
				// Transactions: array of transactions - encode takes array
				const encodeFn = messageDef.encode as (args: TypedTransaction[]) => any;
				encodedData = encodeFn(args as TypedTransaction[]);
			} else if (name === "NewPooledTransactionHashes" && Array.isArray(args)) {
				// NewPooledTransactionHashes: can be array or tuple
				const encodeFn = messageDef.encode as (
					params:
						| Uint8Array[]
						| [types: number[], sizes: number[], hashes: Uint8Array[]],
				) => any;
				encodedData = encodeFn(args as any);
			} else if (typeof args === "object" && args !== null) {
				// Object format: { reqId, headers }, { reqId, bodies }, etc.
				// Responses don't need nextReqId, only requests do
				const encodeFn = messageDef.encode as (args: any) => any;
				encodedData = encodeFn(args as any);
			} else {
				const encodeFn = messageDef.encode as (args: any) => any;
				encodedData = encodeFn(args as any);
			}
		} else {
			encodedData = args;
		}

		// Get ethProtocol from handler (it's private, so we need to access it)
		const ethProtocol = (this.handler as any).ethProtocol;
		if (!ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		// Send via ethProtocol (it will RLP-encode internally)
		ethProtocol.sendMessage(code, encodedData);
	}

	/**
	 * Request with response (for compatibility with BoundProtocol interface)
	 * For announcements like "Transactions", this just calls send() without waiting
	 */
	async request(name: string, args?: unknown): Promise<unknown> {
		// Check if this is a request/response message or an announcement
		const responseMessages = [
			"BlockHeaders",
			"BlockBodies",
			"PooledTransactions",
			"Receipts",
			"NodeData",
		];
		const requestMessages = [
			"GetBlockHeaders",
			"GetBlockBodies",
			"GetPooledTransactions",
			"GetReceipts",
			"GetNodeData",
		];

		// If it's an announcement (like "Transactions"), just send it
		if (!requestMessages.includes(name) && !responseMessages.includes(name)) {
			this.send(name, args);
			return Promise.resolve(undefined);
		}

		// For actual requests, use the specific methods
		if (name === "GetBlockHeaders") {
			return this.getBlockHeaders(args as any);
		} else if (name === "GetBlockBodies") {
			return this.getBlockBodies(args as any);
		} else if (name === "GetPooledTransactions") {
			return this.getPooledTransactions(args as any);
		} else if (name === "GetReceipts") {
			return this.getReceipts(args as any);
		}

		// Fallback: just send
		this.send(name, args);
		return Promise.resolve(undefined);
	}
}

export interface P2PPeerOptions
	extends Omit<PeerOptions, "address" | "transport"> {
	/* P2P Connection from P2PNode */
	connection: Connection;

	/* RLPx Connection (extracted from connection) */
	rlpxConnection: RLPxConnection;

	/* Pass true if peer initiated connection (default: false) */
	inbound?: boolean;

	/* Chain instance (for ETH handler) */
	chain?: Chain;

	/* VMExecution instance (for ETH handler) */
	execution?: VMExecution;
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
	private readonly chain?: Chain;
	private readonly execution?: VMExecution;

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
		this.chain = options.chain;
		this.execution = options.execution;

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
			log(
				"RLPx connection error for peer %s: %s",
				peerIdHex.slice(0, 8),
				err.message,
			);
			this.config.events.emit(Event.PEER_ERROR, err, this);
		});
		log("P2PPeer created: %s", peerIdHex.slice(0, 8));
	}

	/**
	 * Bind protocols from RLPxConnection
	 */
	private bindProtocols(): void {
		const protocols = this.rlpxConnection.getProtocols();
		log(
			"Found %d protocols for peer %s",
			protocols.length,
			this.id.slice(0, 8),
		);

		// Find ETH protocol
		const ethProtocol = protocols.find((p) => p.constructor.name === "ETH");

		if (ethProtocol) {
			log("Binding ETH protocol for peer %s", this.id.slice(0, 8));

			if (this.chain && this.execution) {
				// Use new EthHandler
				log("Creating EthHandler for peer %s", this.id.slice(0, 8));
				const ethHandler = new EthHandler({
					config: this.config,
					chain: this.chain,
					execution: this.execution,
					rlpxConnection: this.rlpxConnection,
				});

				// Create adapter to match EthProtocolMethods interface
				const ethAdapter = new EthHandlerAdapter(ethHandler, this);
				this.eth = ethAdapter;
				this.boundProtocols.push(ethAdapter);
				log(
					"ETH protocol bound using EthHandler for peer %s",
					this.id.slice(0, 8),
				);
			} else {
				log(
					"Chain or execution not available, skipping ETH handler creation for peer %s",
					this.id.slice(0, 8),
				);
			}
		} else {
			log("No ETH protocol found for peer %s", this.id.slice(0, 8));
		}
	}

	/**
	 * Connect peer (no-op for P2P peers - connection already established)
	 */
	async connect(): Promise<void> {
		log(
			"connect() called for peer %s (already connected)",
			this.id.slice(0, 8),
		);
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
