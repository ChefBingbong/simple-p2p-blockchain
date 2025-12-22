import { ServerType, serve } from "@hono/node-server";
import debug from "debug";
import { Env, Hono } from "hono";
import { requestId } from "hono/request-id";
import type { Block } from "../../block";
import { Chain } from "../blockchain";
import { Config } from "../config/index.ts";
import { VMExecution } from "../execution/vmexecution.ts";
import { Miner } from "../miner";
import { P2PPeerPool } from "../net/p2p-peerpool.ts";
import type { Peer } from "../net/peer/peer.ts";
import {
	type EthHandlerContext,
	handleGetBlockBodies,
	handleGetBlockHeaders,
	handleGetPooledTransactions,
	handleGetReceipts,
	handleNewBlock,
	handleNewBlockHashes,
	handleNewPooledTransactionHashes,
	handleTransactions,
} from "../net/protocol/eth/handlers.ts";
import { RPCArgs } from "../rpc/index.ts";
import { createRpcHandlers } from "../rpc/modules/index.ts";
import { rpcRequestSchema } from "../rpc/types.ts";
import { rpcValidator } from "../rpc/validation.ts";
import { TxPool } from "../service/txpool.ts";
import { FullSynchronizer } from "../sync";
import { TxFetcher } from "../sync/fetcher/txFetcher.ts";
import { Event } from "../types.ts";
import type { V8Engine } from "../util/index.ts";
import { getPackageJSON, getV8Engine } from "../util/index.ts";
import type {
	ExecutionNodeInitOptions,
	ExecutionNodeModules,
} from "./types.ts";

const log = debug("p2p:node");

export const STATS_INTERVAL = 1000 * 30; // 30 seconds
export const MEMORY_SHUTDOWN_THRESHOLD = 92;

export type ProtocolMessage = {
	message: { name: string; data: unknown };
	protocol: string;
	peer: Peer;
};

type RpcManager = {
	server: ServerType;
	client: Hono<Env>;
	methods: string[];
	namespaces: string[];
};

/**
 * ExecutionNode - Main execution layer node combining client and service functionality
 * Following lodestar's beacon-node architecture pattern
 */
export class ExecutionNode {
	public config: Config;
	public chain: Chain;
	public execution: VMExecution;
	public pool: P2PPeerPool;
	public synchronizer: FullSynchronizer;
	public txPool: TxPool;
	public miner?: Miner;
	public txFetcher: TxFetcher;
	public rpcManager?: RpcManager;

	public opened: boolean;
	public running: boolean;
	public interval: number;
	public timeout: number;
	public name: string;
	public protocols: string[];

	protected v8Engine?: V8Engine;
	protected statsInterval: NodeJS.Timeout | undefined;
	protected statsCounter = 0;
	private building = false;
	private started = false;
	/**
	 * Initialize an ExecutionNode. Creates and initializes all components.
	 * Following lodestar's static init() pattern.
	 */
	public static async init(
		options: ExecutionNodeInitOptions,
	): Promise<ExecutionNode> {
		const chain = await Chain.create(options);

		const execution = new VMExecution({
			config: options.config,
			stateDB: options.stateDB,
			metaDB: options.metaDB,
			chain,
		});

		log("Creating P2PPeerPool");
		const pool = new P2PPeerPool({
			config: options.config,
			node: options.config.node,
			chain,
			execution,
		});

		pool.setExecution(execution);

		const txPool = new TxPool({
			config: options.config,
			pool,
			chain,
			execution,
		});

		const synchronizer = new FullSynchronizer({
			config: options.config,
			pool,
			chain,
			txPool,
			execution,
			interval: options.interval ?? 200,
		});

		const miner = new Miner({
			config: options.config,
			txPool,
			synchronizer,
			chain,
			execution,
		});

		const txFetcher = new TxFetcher({
			config: options.config,
			pool,
			txPool,
		});

		return new ExecutionNode({
			config: options.config,
			chain,
			execution,
			pool,
			synchronizer,
			txPool,
			miner,
			txFetcher,
		});
	}

	protected constructor(modules: ExecutionNodeModules) {
		this.config = modules.config;
		this.chain = modules.chain;
		this.execution = modules.execution;
		this.pool = modules.pool;
		this.synchronizer = modules.synchronizer;
		this.txPool = modules.txPool;
		this.miner = modules.miner;
		this.txFetcher = modules.txFetcher;

		this.name = "eth";
		this.protocols = [];
		this.opened = false;
		this.running = false;
		this.interval = 200;
		this.timeout = 6000;

		// Set up RPC manager on sync completion
		this.config.events.once(Event.SYNC_SYNCHRONIZED, async () => {
			if (this.rpcManager || !this.started) return;
			this.started = true;
			this.rpcManager = await this.createRpcManager({
				rpc: true,
				rpcAddr: "127.0.0.1",
				rpcPort: this.config.options.port + 300,
			});
			this.log(
				`RPC server listening on http://127.0.0.1:${this.config.options.port + 300}`,
			);
		});

		this.config.events.on(Event.CLIENT_SHUTDOWN, async () => {
			if (this.rpcManager !== undefined) return;
			await this.close();
		});

		log("ExecutionNode created");
	}

	private createRpcManager = async (rpcArgs: RPCArgs) => {
		return await new Promise<RpcManager>((resolve, reject) => {
			const { rpcHandlers, methods } = createRpcHandlers(this, true);
			const namespaces = methods.map((m) => m.split("_")[0]);

			const onTimeout = () => {
				reject(new Error("RPC server timed out"));
			};

			const timeout = setTimeout(onTimeout, 30000);

			const client = new Hono<Env>()
				.use("*", requestId({ generator: () => Date.now().toString() }))
				.post("/", rpcValidator(rpcRequestSchema), rpcHandlers);

			const server = serve(
				{
					fetch: client.fetch,
					port: rpcArgs.rpcPort,
					hostname: rpcArgs.rpcAddr,
				},
				(i) => {
					console.log(`Rpc listening on ${i?.address}`);
					clearTimeout(timeout);
					resolve({ server, client, methods, namespaces });
				},
			);
		});
	};

	async open(): Promise<boolean> {
		try {
			if (this.opened) return false;

			const name = this.config.chainCommon.chainName();
			const chainId = this.config.chainCommon.chainId();
			const packageJSON = getPackageJSON();

			this.config.options.logger?.info(
				`Initializing P2P Ethereumjs node version=v${packageJSON.version} network=${name} chainId=${chainId}`,
			);

			this.setupBasicEventListeners();

			await this.pool.open();
			await this.chain.open();
			await this.synchronizer?.open();
			this.opened = true;

			await this.execution.open();
			this.txPool.open();
			this.txPool.start();

			return true;
		} catch (error) {
			this.error(error as Error);
			this.debug(`Error opening: ${(error as Error).message}`);
			this.opened = false;
			return false;
		}
	}

	async start(): Promise<boolean> {
		try {
			if (!this.opened) await this.open();

			this.config.updateSynchronizedState(this.chain.headers.latest, true);
			this.txPool.checkRunState();

			if (this.running) return false;

			await this.pool.start();
			void this.synchronizer?.start();

			if (!this.v8Engine) {
				this.v8Engine = await getV8Engine();
			}

			this.statsInterval = setInterval(this.stats.bind(this), STATS_INTERVAL);

			this.running = true;
			this.miner?.start();
			await this.execution.start();
			await this.execution.run();

			void this.buildHeadState();
			this.txFetcher.start();

			await this.config.node.start();

			this.log("Waiting for synchronization...");

			const chainHeight = await new Promise<bigint | null>((resolve) => {
				const timeout = setTimeout(() => {
					cleanup();
					resolve(null);
				}, 30000);

				const onSynchronized = (chainHeight: bigint) => {
					cleanup();
					resolve(chainHeight);
				};

				const cleanup = () => {
					clearTimeout(timeout);
					this.config.events.off(Event.SYNC_SYNCHRONIZED, onSynchronized);
				};
				this.config.events.on(Event.SYNC_SYNCHRONIZED, onSynchronized);
			});

			this.started = true;
			if (chainHeight === null) return;

			this.rpcManager = await this.createRpcManager({
				rpc: true,
				rpcAddr: "127.0.0.1",
				rpcPort: this.config.options.port + 300,
			});
			this.log(
				`RPC server listening on http://127.0.0.1:${this.config.options.port + 300}`,
			);
			return true;
		} catch (error) {
			this.error(error as Error);
			this.debug(`Error starting: ${(error as Error).message}`);
			this.running = false;
			await this.close();
			return false;
		}
	}

	async stop(): Promise<boolean> {
		try {
			if (!this.running) return false;

			this.config.events.emit(Event.CLIENT_SHUTDOWN);

			this.txPool.stop();
			this.miner?.stop();

			await this.synchronizer?.stop();
			await this.execution.stop();

			if (this.opened) {
				await this.close();
				await this.synchronizer?.close();
			}

			await this.pool.stop();
			clearInterval(this.statsInterval);
			await this.synchronizer?.stop();

			await this.config.node.stop();

			this.running = false;
			this.txFetcher.stop();

			log("ExecutionNode stopped");
			return true;
		} catch (error) {
			this.error(error as Error);
			this.debug(`Error stopping: ${(error as Error).message}`);
			this.running = false;
			return false;
		}
	}

	async close(): Promise<boolean> {
		if (!this.opened) return false;
		try {
			this.closeEventListeners();
			this.txPool.close();

			const result = !!this.opened;
			if (this.opened) {
				await this.pool.close();
				this.opened = false;
			}

			return result;
		} catch (error) {
			this.error(error as Error);
			this.debug(`Error closing: ${(error as Error).message}`);
			this.opened = false;
			return false;
		}
	}

	async buildHeadState(): Promise<void> {
		try {
			if (this.building) return;
			this.building = true;

			if (!this.execution.started) return;
			await this.synchronizer.runExecution();
		} catch (error) {
			this.error(error as Error);
			this.debug(`Error building headstate: ${(error as Error).message}`);
		} finally {
			this.building = false;
		}
	}

	async handle(_message: ProtocolMessage): Promise<void> {
		if (_message.protocol !== "eth") return;
		const { message, peer } = _message;

		const context: EthHandlerContext = {
			chain: this.chain,
			txPool: this.txPool,
			synchronizer: this.synchronizer,
			execution: this.execution,
			pool: this.pool,
		};

		try {
			switch (message.name) {
				case "GetBlockHeaders":
					await handleGetBlockHeaders(
						message.data as Parameters<typeof handleGetBlockHeaders>[0],
						peer,
						context,
					);
					break;

				case "GetBlockBodies":
					await handleGetBlockBodies(
						message.data as Parameters<typeof handleGetBlockBodies>[0],
						peer,
						context,
					);
					break;

				case "NewBlockHashes":
					handleNewBlockHashes(
						message.data as Parameters<typeof handleNewBlockHashes>[0],
						context,
					);
					break;

				case "Transactions":
					await handleTransactions(
						message.data as Parameters<typeof handleTransactions>[0],
						peer,
						context,
					);
					break;

				case "NewBlock":
					await handleNewBlock(
						message.data as Parameters<typeof handleNewBlock>[0],
						peer,
						context,
					);
					break;

				case "NewPooledTransactionHashes":
					await handleNewPooledTransactionHashes(
						message.data as Parameters<
							typeof handleNewPooledTransactionHashes
						>[0],
						peer,
						context,
					);
					break;

				case "GetPooledTransactions":
					handleGetPooledTransactions(
						message.data as Parameters<typeof handleGetPooledTransactions>[0],
						peer,
						context,
					);
					break;

				case "GetReceipts":
					await handleGetReceipts(
						message.data as Parameters<typeof handleGetReceipts>[0],
						peer,
						context,
					);
					break;
			}
		} catch (error) {
			const err = error as Error;
			this.error(err);
			this.debug(`Error handling ${message.name}: ${err.message}`);
		}
	}

	private onProtocolMessage = async (message: ProtocolMessage) => {
		try {
			if (!this.running) return;
			await this.handle(message);
		} catch (error) {
			this.error(error as Error);
			this.debug(`Error handling message: ${(error as Error).message}`);
		}
	};

	private onPoolPeerAdded = (peer: Peer) => {
		const txs: [number[], number[], Uint8Array[]] = [[], [], []];
		for (const [_addr, txObjs] of this.txPool.pending) {
			for (const txObj of txObjs) {
				const rawTx = txObj.tx;
				txs[0].push(rawTx.type);
				txs[1].push(rawTx.serialize().byteLength);
				txs[2].push(new Uint8Array(Buffer.from(txObj.hash, "hex")));
			}
		}
		for (const [_addr, txObjs] of this.txPool.queued) {
			for (const txObj of txObjs) {
				const rawTx = txObj.tx;
				txs[0].push(rawTx.type);
				txs[1].push(rawTx.serialize().byteLength);
				txs[2].push(new Uint8Array(Buffer.from(txObj.hash, "hex")));
			}
		}
		if (txs[0].length > 0) this.txPool.sendNewTxHashes(txs, [peer]);
	};

	private onSyncNewBlocks = async (blocks: Block[]) => {
		this.txPool.removeNewBlockTxs(blocks);

		for (const block of blocks) {
			for (const tx of block.transactions) {
				this.txPool.clearNonceCache(tx.getSenderAddress().toString().slice(2));
			}
		}
		try {
			await Promise.all([
				this.txPool.demoteUnexecutables(),
				this.txPool.promoteExecutables(),
			]);
		} catch (error) {
			this.error(error as Error);
			this.debug(`${(error as Error).message}`);
		}
	};

	private onChainReorg = async (oldBlocks: Block[], newBlocks: Block[]) => {
		try {
			await this.txPool.handleReorg(oldBlocks, newBlocks);
		} catch (error) {
			this.error(error as Error);
			this.debug(`${(error as Error).message}`);
		}
	};

	setupBasicEventListeners() {
		this.config.events.on(Event.PROTOCOL_MESSAGE, this.onProtocolMessage);
		this.config.events.on(Event.POOL_PEER_ADDED, this.onPoolPeerAdded);
		this.config.events.on(Event.SYNC_FETCHED_BLOCKS, this.onSyncNewBlocks);
		this.config.events.on(Event.CHAIN_REORG, this.onChainReorg);
	}

	closeEventListeners() {
		this.config.events.off(Event.PROTOCOL_MESSAGE, this.onProtocolMessage);
		this.config.events.off(Event.POOL_PEER_ADDED, this.onPoolPeerAdded);
		this.config.events.off(Event.SYNC_FETCHED_BLOCKS, this.onSyncNewBlocks);
		this.config.events.off(Event.CHAIN_REORG, this.onChainReorg);
	}

	protected stats() {
		if (!this.v8Engine) return;

		const heapStats = this.v8Engine.getHeapStatistics();
		const { used_heap_size, heap_size_limit } = heapStats;

		const heapUsed = Math.round(used_heap_size / 1000 / 1000); // MB
		const percentage = Math.round((100 * used_heap_size) / heap_size_limit);

		this.log(`Memory stats usage=${heapUsed} MB percentage=${percentage}%`);

		if (this.statsCounter % 4 === 0) this.statsCounter = 0;

		if (percentage >= MEMORY_SHUTDOWN_THRESHOLD && !this.config.shutdown) {
			this.log("EMERGENCY SHUTDOWN DUE TO HIGH MEMORY LOAD...");
			process.kill(process.pid, "SIGINT");
		}
		this.statsCounter += 1;
	}

	protected log(message: string) {
		this.config.options.logger?.info(`ExecutionNode log: ${message}`);
	}

	protected error(err: Error) {
		this.config.options.logger?.error(
			`ExecutionNode error: ${err} stack: ${err.stack}`,
		);
	}

	protected debug(message: string, method: string = "debug") {
		this.config.options.logger?.debug(
			`ExecutionNode ${method} msg: ${message}}`,
		);
	}

	public peers = () => {
		return this.pool.peers
			.values()
			.toArray()
			.map((p) => p.id);
	};

	public node = () => this.config.node;
	public server = () => this.config.node;
	public peerCount = () => this.pool.size;
}
