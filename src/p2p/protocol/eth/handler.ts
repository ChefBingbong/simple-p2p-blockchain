import debug from "debug";
import { EventEmitter } from "eventemitter3";
import type { BlockHeader } from "../../../block";
import type { Chain } from "../../../client/blockchain";
import type { Config } from "../../../client/config";
import type { VMExecution } from "../../../client/execution";
import {
	ETH_MESSAGES,
	EthMessageCode,
} from "../../../client/net/protocol/eth/definitions";
import { ETH } from "../../../devp2p/protocol/eth";
import { BIGINT_0, bigIntToUnpaddedBytes, bytesToBigInt } from "../../../utils";
import type { RLPxConnection } from "../../transport/rlpx/connection";
import {
	handleGetBlockBodies,
	handleGetBlockHeaders,
	handleGetNodeData,
	handleGetPooledTransactions,
	handleGetReceipts,
} from "./messages";
import { validateStatus } from "./status";
import type { EthStatus, RequestResolver } from "./types";

const log = debug("p2p:eth:handler");

/**
 * ETH Protocol Handler
 *
 * Handles ETH protocol messages through RLPxConnection socket.
 * Messages are sent/received via ECIES-encrypted RLPx connection,
 * not through libp2p streams.
 */
export class EthHandler extends EventEmitter {
	public readonly config: Config;
	public readonly chain: Chain;
	public readonly execution: VMExecution;
	private readonly rlpxConnection: RLPxConnection;

	// Protocol state
	private _status: EthStatus | null = null;
	private _peerStatus: EthStatus | null = null;
	private _statusExchanged: boolean = false;
	public updatedBestHeader?: BlockHeader;

	// Request tracking for async request/response matching
	private resolvers: Map<bigint, RequestResolver> = new Map();
	private readonly timeout: number = 8000; // 8 second timeout
	private nextReqId = BIGINT_0;

	// Request deduplication: track in-flight requests to avoid duplicates
	private inFlightRequests: Map<string, Promise<any>> = new Map();

	// ETH protocol instance from RLPxConnection (for compatibility)
	private ethProtocol: ETH | null = null;
	private protocolOffset: number = 0;

	constructor(options: {
		config: Config;
		chain: Chain;
		execution: VMExecution;
		rlpxConnection: RLPxConnection;
	}) {
		super();
		this.config = options.config;
		this.chain = options.chain;
		this.execution = options.execution;
		this.rlpxConnection = options.rlpxConnection;

		// Find ETH protocol from RLPxConnection
		this.setupProtocol();
	}

	/**
	 * Setup ETH protocol from RLPxConnection
	 */
	private setupProtocol(): void {
		const protocols = this.rlpxConnection.getProtocols();
		const ethProtocol = protocols.find((p) => p.constructor.name === "ETH") as
			| ETH
			| undefined;

		if (!ethProtocol) {
			log("No ETH protocol found in RLPxConnection");
			return;
		}

		this.ethProtocol = ethProtocol;

		// Find protocol offset
		const protocolsDesc = (this.rlpxConnection as any)._protocols as Array<{
			protocol: ETH;
			offset: number;
			length: number;
		}>;
		const ethDesc = protocolsDesc.find(
			(p) => p.protocol.constructor.name === "ETH",
		);
		if (ethDesc) {
			this.protocolOffset = ethDesc.offset;
		}

		// Listen to protocol events
		ethProtocol.events.on("message", (code: number, payload: any) => {
			this.handleMessage(code, payload);
		});

		ethProtocol.events.on("status", (status: any) => {
			this.handleStatus(status);
		});

		// Check if STATUS was already received (protocol might have received it before we set up listener)
		// The ETH protocol emits "status" event when both _status and _peerStatus are set
		// If _peerStatus is already set, STATUS was received but event might have fired already
		const peerStatus = (ethProtocol as any)._peerStatus;
		const localStatus = (ethProtocol as any)._status;
		if (peerStatus && localStatus) {
			// Both STATUS messages received, construct the status object and handle it
			try {
				const statusObj = {
					chainId: peerStatus[1] as Uint8Array,
					td: peerStatus[2] as Uint8Array,
					bestHash: peerStatus[3] as Uint8Array,
					genesisHash: peerStatus[4] as Uint8Array,
					forkId: peerStatus.length > 5 ? peerStatus[5] : undefined,
				};
				this.handleStatus(statusObj);
			} catch (err: any) {
				log("Error handling existing STATUS: %s", err.message);
			}
		}

		// Note: STATUS is sent by P2PPeerPool after protocols:ready
		// We just listen for incoming STATUS messages
	}

	/**
	 * Send STATUS message (called by P2PPeerPool or external code)
	 */
	sendStatus(): void {
		if (!this.ethProtocol) {
			log("Cannot send STATUS: ETH protocol not available");
			return;
		}

		if (this._status !== null) {
			log("STATUS already sent");
			return;
		}

		try {
			const header = this.chain.headers.latest;
			if (!header) {
				throw new Error("No chain header available for STATUS");
			}

			const genesis = this.chain.genesis;
			if (!genesis) {
				throw new Error("No genesis block available for STATUS");
			}

			// Use devp2p ETH protocol's sendStatus method for now
			// This ensures compatibility with RLPx message format
			// TODO: Replace with our own STATUS encoding once we remove devp2p dependency
			this.ethProtocol.sendStatus({
				td: bigIntToUnpaddedBytes(this.chain.headers.td),
				bestHash: header.hash(),
				genesisHash: genesis.hash(),
				latestBlock: bigIntToUnpaddedBytes(header.number),
			});

			this._status = {
				chainId: this.config.chainCommon.chainId(),
				td: this.chain.headers.td,
				bestHash: header.hash(),
				genesisHash: genesis.hash(),
				forkId: undefined,
			};

			log("Sent STATUS message");
		} catch (error: any) {
			log("Error sending STATUS: %s", error.message);
			this.emit("error", error);
		}
	}

	/**
	 * Handle incoming STATUS message
	 */
	private handleStatus(status: any): void {
		try {
			// Decode peer status
			const peerStatus: EthStatus = {
				chainId: bytesToBigInt(status.chainId),
				td: bytesToBigInt(status.td),
				bestHash: status.bestHash,
				genesisHash: status.genesisHash,
				forkId: status.forkId,
			};

			// Get local status
			const localStatus: EthStatus = {
				chainId: this.config.chainCommon.chainId(),
				td: this.chain.headers.td,
				bestHash: this.chain.headers.latest?.hash() ?? new Uint8Array(32),
				genesisHash: this.chain.genesis?.hash() ?? new Uint8Array(32),
				forkId: undefined,
			};

			// Validate status
			validateStatus(localStatus, peerStatus);

			this._peerStatus = peerStatus;
			this._statusExchanged = true;

			log("STATUS exchange completed successfully");
			this.emit("status", peerStatus);
		} catch (error: any) {
			log("Error handling STATUS: %s", error.message);
			// Note: Peer reference not available yet, emit without peer
			this.emit("error", error);
			this.rlpxConnection.disconnect();
		}
	}

	/**
	 * Handle incoming protocol message
	 */
	private handleMessage(code: number, payload: any): void {
		if (!this._statusExchanged && code !== 0x00) {
			log("Received message before STATUS exchange: code=%d", code);
			return;
		}

		// Route to appropriate handler based on message code
		switch (code) {
			case 0x00: // STATUS - already handled
				break;
			case 0x01: // NEW_BLOCK_HASHES
				this.handleNewBlockHashes(payload);
				break;
			case 0x02: // TRANSACTIONS
				this.handleTransactions(payload);
				break;
			case 0x03: // GET_BLOCK_HEADERS
				handleGetBlockHeaders(this, payload).catch((err) => {
					log("Error handling GET_BLOCK_HEADERS: %s", err.message);
					this.emit("error", err);
				});
				break;
			case 0x04: // BLOCK_HEADERS
				this.handleBlockHeaders(payload);
				break;
			case 0x05: // GET_BLOCK_BODIES
				handleGetBlockBodies(this, payload).catch((err) => {
					log("Error handling GET_BLOCK_BODIES: %s", err.message);
					this.emit("error", err);
				});
				break;
			case 0x06: // BLOCK_BODIES
				this.handleBlockBodies(payload);
				break;
			case 0x07: // NEW_BLOCK
				this.handleNewBlock(payload);
				break;
			case 0x08: // NEW_POOLED_TRANSACTION_HASHES
				this.handleNewPooledTransactionHashes(payload);
				break;
			case 0x09: // GET_POOLED_TRANSACTIONS
				handleGetPooledTransactions(this, payload);
				break;
			case 0x0a: // POOLED_TRANSACTIONS
				this.handlePooledTransactions(payload);
				break;
			case 0x0d: // GET_NODE_DATA
				handleGetNodeData(this, payload).catch((err) => {
					log("Error handling GET_NODE_DATA: %s", err.message);
					this.emit("error", err);
				});
				break;
			case 0x0e: // NODE_DATA
				this.handleNodeData(payload);
				break;
			case 0x0f: // GET_RECEIPTS
				handleGetReceipts(this, payload).catch((err) => {
					log("Error handling GET_RECEIPTS: %s", err.message);
					this.emit("error", err);
				});
				break;
			case 0x10: // RECEIPTS
				this.handleReceipts(payload);
				break;
			default:
				log("Unknown message code: %d", code);
		}
	}

	/**
	 * Send a protocol message
	 */
	sendMessage(code: number, data: Uint8Array): void {
		if (!this.ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		this.rlpxConnection.sendSubprotocolMessage(
			this.protocolOffset + code,
			data,
		);
	}

	/**
	 * Request block headers from peer
	 */
	async getBlockHeaders(opts: {
		reqId?: bigint;
		block: bigint | Uint8Array;
		max: number;
		skip?: number;
		reverse?: boolean;
	}): Promise<[bigint, BlockHeader[]]> {
		if (!this.ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		if (!this._statusExchanged) {
			throw new Error("STATUS exchange not completed");
		}

		// Request deduplication: check if same request is already in flight
		const blockKey =
			typeof opts.block === "bigint"
				? opts.block.toString()
				: Array.from(opts.block.slice(0, 8))
						.map((b) => b.toString(16).padStart(2, "0"))
						.join("");
		const requestKey = `headers-${blockKey}-${opts.max}-${opts.skip || 0}-${opts.reverse || false}`;

		if (this.inFlightRequests.has(requestKey)) {
			log("Deduplicating GET_BLOCK_HEADERS request: %s", requestKey);
			return this.inFlightRequests.get(requestKey)!;
		}

		// Generate request ID if not provided
		const reqId = opts.reqId ?? ++this.nextReqId;

		// Encode request using protocol definitions
		const requestData = ETH_MESSAGES[EthMessageCode.GET_BLOCK_HEADERS].encode(
			{ ...opts, reqId },
			{ value: this.nextReqId },
		);

		// Send request
		this.ethProtocol.sendMessage(EthMessageCode.GET_BLOCK_HEADERS, requestData);

		log("Sent GET_BLOCK_HEADERS request: reqId=%d", reqId);

		// Wait for response
		const promise = new Promise<[bigint, BlockHeader[]]>((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this.resolvers.has(reqId)) {
					this.resolvers.delete(reqId);
					this.inFlightRequests.delete(requestKey);
					reject(
						new Error(`GET_BLOCK_HEADERS request timed out (reqId=${reqId})`),
					);
				}
			}, this.timeout);

			this.resolvers.set(reqId, {
				resolve: (value: unknown) => {
					clearTimeout(timeout);
					this.inFlightRequests.delete(requestKey);
					const result = value as [bigint, BlockHeader[]];
					resolve(result);
				},
				reject: (err) => {
					clearTimeout(timeout);
					this.inFlightRequests.delete(requestKey);
					reject(err);
				},
				timeout,
			});
		});

		this.inFlightRequests.set(requestKey, promise);
		return promise;
	}

	/**
	 * Request block bodies from peer
	 */
	async getBlockBodies(opts: {
		reqId?: bigint;
		hashes: Uint8Array[];
	}): Promise<[bigint, any[]]> {
		if (!this.ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		if (!this._statusExchanged) {
			throw new Error("STATUS exchange not completed");
		}

		// Request deduplication: check if same request is already in flight
		const hashesKey = opts.hashes
			.map((h) =>
				Array.from(h.slice(0, 4))
					.map((b) => b.toString(16).padStart(2, "0"))
					.join(""),
			)
			.join("-");
		const requestKey = `bodies-${hashesKey}`;

		if (this.inFlightRequests.has(requestKey)) {
			log(
				"Deduplicating GET_BLOCK_BODIES request: %d hashes",
				opts.hashes.length,
			);
			return this.inFlightRequests.get(requestKey)!;
		}

		// Generate request ID if not provided
		const reqId = opts.reqId ?? ++this.nextReqId;

		// Encode request using protocol definitions
		const requestData = ETH_MESSAGES[EthMessageCode.GET_BLOCK_BODIES].encode(
			{ ...opts, reqId },
			{ value: this.nextReqId },
		);

		// Send request
		this.ethProtocol.sendMessage(EthMessageCode.GET_BLOCK_BODIES, requestData);

		log(
			"Sent GET_BLOCK_BODIES request: reqId=%d, hashes=%d",
			reqId,
			opts.hashes.length,
		);

		// Wait for response
		const promise = new Promise<[bigint, any[]]>((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this.resolvers.has(reqId)) {
					this.resolvers.delete(reqId);
					this.inFlightRequests.delete(requestKey);
					reject(
						new Error(`GET_BLOCK_BODIES request timed out (reqId=${reqId})`),
					);
				}
			}, this.timeout);

			this.resolvers.set(reqId, {
				resolve: (value: unknown) => {
					clearTimeout(timeout);
					this.inFlightRequests.delete(requestKey);
					const result = value as [bigint, any[]];
					resolve(result);
				},
				reject: (err) => {
					clearTimeout(timeout);
					this.inFlightRequests.delete(requestKey);
					reject(err);
				},
				timeout,
			});
		});

		this.inFlightRequests.set(requestKey, promise);
		return promise;
	}

	/**
	 * Request pooled transactions from peer
	 */
	async getPooledTransactions(opts: {
		reqId?: bigint;
		hashes: Uint8Array[];
	}): Promise<[bigint, any[]]> {
		if (!this.ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		if (!this._statusExchanged) {
			throw new Error("STATUS exchange not completed");
		}

		// Request deduplication: check if same request is already in flight
		const hashesKey = opts.hashes
			.map((h) =>
				Array.from(h.slice(0, 4))
					.map((b) => b.toString(16).padStart(2, "0"))
					.join(""),
			)
			.join("-");
		const requestKey = `pooled-txs-${hashesKey}`;

		if (this.inFlightRequests.has(requestKey)) {
			log(
				"Deduplicating GET_POOLED_TRANSACTIONS request: %d hashes",
				opts.hashes.length,
			);
			return this.inFlightRequests.get(requestKey)!;
		}

		// Generate request ID if not provided
		const reqId = opts.reqId ?? ++this.nextReqId;

		// Encode request using protocol definitions
		const requestData = ETH_MESSAGES[
			EthMessageCode.GET_POOLED_TRANSACTIONS
		].encode({ ...opts, reqId }, { value: this.nextReqId });

		// Send request
		this.ethProtocol.sendMessage(
			EthMessageCode.GET_POOLED_TRANSACTIONS,
			requestData,
		);

		log(
			"Sent GET_POOLED_TRANSACTIONS request: reqId=%d, hashes=%d",
			reqId,
			opts.hashes.length,
		);

		// Wait for response
		const promise = new Promise<[bigint, any[]]>((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this.resolvers.has(reqId)) {
					this.resolvers.delete(reqId);
					this.inFlightRequests.delete(requestKey);
					reject(
						new Error(
							`GET_POOLED_TRANSACTIONS request timed out (reqId=${reqId})`,
						),
					);
				}
			}, this.timeout);

			this.resolvers.set(reqId, {
				resolve: (value: unknown) => {
					clearTimeout(timeout);
					this.inFlightRequests.delete(requestKey);
					const result = value as [bigint, any[]];
					resolve(result);
				},
				reject: (err) => {
					clearTimeout(timeout);
					this.inFlightRequests.delete(requestKey);
					reject(err);
				},
				timeout,
			});
		});

		this.inFlightRequests.set(requestKey, promise);
		return promise;
	}

	/**
	 * Request receipts from peer
	 */
	async getReceipts(opts: {
		reqId?: bigint;
		hashes: Uint8Array[];
	}): Promise<[bigint, any[]]> {
		if (!this.ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		if (!this._statusExchanged) {
			throw new Error("STATUS exchange not completed");
		}

		// Request deduplication: check if same request is already in flight
		const hashesKey = opts.hashes
			.map((h) =>
				Array.from(h.slice(0, 4))
					.map((b) => b.toString(16).padStart(2, "0"))
					.join(""),
			)
			.join("-");
		const requestKey = `receipts-${hashesKey}`;

		if (this.inFlightRequests.has(requestKey)) {
			log("Deduplicating GET_RECEIPTS request: %d hashes", opts.hashes.length);
			return this.inFlightRequests.get(requestKey)!;
		}

		// Generate request ID if not provided
		const reqId = opts.reqId ?? ++this.nextReqId;

		// Encode request using protocol definitions
		const requestData = ETH_MESSAGES[EthMessageCode.GET_RECEIPTS].encode(
			{ ...opts, reqId },
			{ value: this.nextReqId },
		);

		// Send request
		this.ethProtocol.sendMessage(EthMessageCode.GET_RECEIPTS, requestData);

		log(
			"Sent GET_RECEIPTS request: reqId=%d, hashes=%d",
			reqId,
			opts.hashes.length,
		);

		// Wait for response
		const promise = new Promise<[bigint, any[]]>((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this.resolvers.has(reqId)) {
					this.resolvers.delete(reqId);
					this.inFlightRequests.delete(requestKey);
					reject(new Error(`GET_RECEIPTS request timed out (reqId=${reqId})`));
				}
			}, this.timeout);

			this.resolvers.set(reqId, {
				resolve: (value: unknown) => {
					clearTimeout(timeout);
					this.inFlightRequests.delete(requestKey);
					const result = value as [bigint, any[]];
					resolve(result);
				},
				reject: (err) => {
					clearTimeout(timeout);
					this.inFlightRequests.delete(requestKey);
					reject(err);
				},
				timeout,
			});
		});

		this.inFlightRequests.set(requestKey, promise);
		return promise;
	}

	// Message handlers (stubs for now - will be implemented in messages.ts)
	private handleNewBlockHashes(payload: any): void {
		// Decode NewBlockHashes message
		try {
			const decoded =
				ETH_MESSAGES[EthMessageCode.NEW_BLOCK_HASHES].decode(payload);
			this.emit("message", {
				code: 0x01,
				name: "NewBlockHashes",
				data: decoded,
			});
		} catch (error: any) {
			log("Error handling NEW_BLOCK_HASHES: %s", error.message);
			this.emit("error", error);
		}
	}

	private handleTransactions(payload: any): void {
		// Decode Transactions message
		// Payload is already decoded by devp2p protocol: array of transaction bytes
		try {
			const decoded = ETH_MESSAGES[EthMessageCode.TRANSACTIONS].decode(
				payload,
				{
					chainCommon: this.config.chainCommon,
					synchronized: this._statusExchanged,
				},
			);
			this.emit("message", {
				code: 0x02,
				name: "Transactions",
				data: decoded,
			});
		} catch (error: any) {
			log("Error handling TRANSACTIONS: %s", error.message);
			this.emit("error", error);
		}
	}

	private handleGetBlockHeaders(payload: any): void {
		this.emit("message", { code: 0x03, payload });
	}

	private handleBlockHeaders(payload: any): void {
		// Payload is already decoded: [reqId, headers]
		// Decode using protocol definitions
		try {
			const decoded = ETH_MESSAGES[EthMessageCode.BLOCK_HEADERS].decode(
				payload,
				{ chainCommon: this.config.chainCommon },
			) as [bigint, BlockHeader[]];
			const reqId = decoded[0] as bigint;
			const headers = decoded[1] as BlockHeader[];

			log(
				"BLOCK_HEADERS response: reqId=%d, headers=%d",
				reqId,
				headers.length,
			);

			// Resolve pending request if exists
			const resolver = this.resolvers.get(reqId);
			if (resolver) {
				clearTimeout(resolver.timeout);
				this.resolvers.delete(reqId);
				resolver.resolve([reqId, headers]);
				log("Resolved GET_BLOCK_HEADERS request for reqId=%d", reqId);
			} else {
				// No pending request, emit as event for service layer
				this.emit("message", {
					code: 0x04,
					name: "BlockHeaders",
					data: { reqId, headers },
				});
			}
		} catch (error: any) {
			log("Error handling BLOCK_HEADERS: %s", error.message);
			this.emit("error", error);
		}
	}

	private handleGetBlockBodies(payload: any): void {
		this.emit("message", { code: 0x05, payload });
	}

	private handleBlockBodies(payload: any): void {
		// Payload is already decoded: [reqId, bodies]
		try {
			const decoded = ETH_MESSAGES[EthMessageCode.BLOCK_BODIES].decode(payload);
			const reqId = decoded[0] as bigint;
			const bodies = decoded[1] as any[];

			log("BLOCK_BODIES response: reqId=%d, bodies=%d", reqId, bodies.length);

			// Resolve pending request if exists
			const resolver = this.resolvers.get(reqId);
			if (resolver) {
				clearTimeout(resolver.timeout);
				this.resolvers.delete(reqId);
				resolver.resolve([reqId, bodies]);
				log("Resolved GET_BLOCK_BODIES request for reqId=%d", reqId);
			} else {
				// No pending request, emit as event for service layer
				this.emit("message", {
					code: 0x06,
					name: "BlockBodies",
					data: { reqId, bodies },
				});
			}
		} catch (error: any) {
			log("Error handling BLOCK_BODIES: %s", error.message);
			this.emit("error", error);
		}
	}

	private handleNewBlock(payload: any): void {
		// Decode NewBlock message: [block, td]
		// Payload is already decoded by devp2p protocol: [blockBytes, tdBytes]
		try {
			const decoded = ETH_MESSAGES[EthMessageCode.NEW_BLOCK].decode(payload, {
				chainCommon: this.config.chainCommon,
			});
			const block = decoded[0];
			const td = decoded[1];
			this.emit("message", {
				code: 0x07,
				name: "NewBlock",
				data: [block, td],
			});
		} catch (error: any) {
			log("Error handling NEW_BLOCK: %s", error.message);
			this.emit("error", error);
		}
	}

	private handleNewPooledTransactionHashes(payload: any): void {
		this.emit("message", { code: 0x08, payload });
	}

	private handleGetPooledTransactions(payload: any): void {
		this.emit("message", { code: 0x09, payload });
	}

	private handlePooledTransactions(payload: any): void {
		// Payload is already decoded: [reqId, txs]
		try {
			const decoded = ETH_MESSAGES[EthMessageCode.POOLED_TRANSACTIONS].decode(
				payload,
				{ chainCommon: this.config.chainCommon },
			) as [bigint, any[]];
			const reqId = decoded[0] as bigint;
			const txs = decoded[1] as any[];

			log("POOLED_TRANSACTIONS response: reqId=%d, txs=%d", reqId, txs.length);

			// Resolve pending request if exists
			const resolver = this.resolvers.get(reqId);
			if (resolver) {
				clearTimeout(resolver.timeout);
				this.resolvers.delete(reqId);
				resolver.resolve([reqId, txs]);
				log("Resolved GET_POOLED_TRANSACTIONS request for reqId=%d", reqId);
			} else {
				// No pending request, emit as event for service layer
				this.emit("message", {
					code: 0x0a,
					name: "PooledTransactions",
					data: { reqId, txs },
				});
			}
		} catch (error: any) {
			log("Error handling POOLED_TRANSACTIONS: %s", error.message);
			this.emit("error", error);
		}
	}

	private handleGetNodeData(payload: any): void {
		this.emit("message", { code: 0x0d, payload });
	}

	private handleNodeData(payload: any): void {
		this.emit("message", { code: 0x0e, payload });
	}

	private handleGetReceipts(payload: any): void {
		this.emit("message", { code: 0x0f, payload });
	}

	private handleReceipts(payload: any): void {
		// Payload is already decoded: [reqId, receipts]
		try {
			const decoded = ETH_MESSAGES[EthMessageCode.RECEIPTS].decode(payload);
			const reqId = decoded[0] as bigint;
			const receipts = decoded[1] as any[];

			log("RECEIPTS response: reqId=%d, receipts=%d", reqId, receipts.length);

			// Resolve pending request if exists
			const resolver = this.resolvers.get(reqId);
			if (resolver) {
				clearTimeout(resolver.timeout);
				this.resolvers.delete(reqId);
				resolver.resolve([reqId, receipts]);
				log("Resolved GET_RECEIPTS request for reqId=%d", reqId);
			} else {
				// No pending request, emit as event for service layer
				this.emit("message", {
					code: 0x10,
					name: "Receipts",
					data: { reqId, receipts },
				});
			}
		} catch (error: any) {
			log("Error handling RECEIPTS: %s", error.message);
			this.emit("error", error);
		}
	}

	/**
	 * Get peer status
	 */
	get status(): EthStatus | null {
		return this._peerStatus;
	}

	/**
	 * Check if STATUS exchange completed
	 */
	get isReady(): boolean {
		return this._statusExchanged;
	}
}
