import type { P2PNode } from "../../p2p/libp2p/types.ts";
import type { Chain } from "../blockchain/chain.ts";
import type { Config } from "../config/index.ts";
import type { VMExecution } from "../execution/index.ts";
import { Event } from "../types.ts";
import { NetworkCore } from "./core/index.ts";
import type { Peer } from "./peer/peer.ts";
import type { EthHandlerContext } from "./protocol/eth/handlers.ts";
import {
  handleGetBlockBodies,
  handleGetBlockHeaders,
  handleGetPooledTransactions,
  handleGetReceipts,
  handleNewBlock,
  handleNewBlockHashes,
  handleNewPooledTransactionHashes,
  handleTransactions,
} from "./protocol/eth/handlers.ts";

export interface NetworkServiceModules {
	config: Config;
	node: P2PNode;
	chain: Chain;
	execution: VMExecution;
}

export interface NetworkServiceInitOptions {
	config: Config;
	node: P2PNode;
	chain: Chain;
	execution: VMExecution;
}

/**
 * NetworkService handles peer communication, protocol routing, and network operations.
 * Owns NetworkCore and routes protocol messages to execution handlers.
 */
export class NetworkService {
	public readonly core: NetworkCore;
	public readonly config: Config;
	private handlerContext?: EthHandlerContext;

	static async init(options: NetworkServiceInitOptions): Promise<NetworkService> {
		const core = await NetworkCore.init({
			config: options.config,
			node: options.node,
			chain: options.chain,
			execution: options.execution,
		});

		const service = new NetworkService({
			config: options.config,
			core,
		});

		return service;
	}

	constructor(modules: { config: Config; core: NetworkCore }) {
		this.config = modules.config;
		this.core = modules.core;

		this.setupEventListeners();
	}

	/**
	 * Set the handler context for protocol message processing.
	 * This is called by ExecutionNode after ExecutionService is created.
	 */
	setHandlerContext(context: EthHandlerContext): void {
		this.handlerContext = context;
	}

	private setupEventListeners(): void {
		this.config.events.on(Event.PROTOCOL_MESSAGE, this.onProtocolMessage);
	}

	private removeEventListeners(): void {
		this.config.events.off(Event.PROTOCOL_MESSAGE, this.onProtocolMessage);
	}

	private onProtocolMessage = async (message: {
		message: { name: string; data: unknown };
		protocol: string;
		peer: Peer;
	}): Promise<void> => {
		if (message.protocol !== "eth") return;
		if (!this.handlerContext) return;

		try {
			switch (message.message.name) {
				case "GetBlockHeaders":
					await handleGetBlockHeaders(
						message.message.data as Parameters<typeof handleGetBlockHeaders>[0],
						message.peer,
						this.handlerContext,
					);
					break;

				case "GetBlockBodies":
					await handleGetBlockBodies(
						message.message.data as Parameters<typeof handleGetBlockBodies>[0],
						message.peer,
						this.handlerContext,
					);
					break;

				case "NewBlockHashes":
					handleNewBlockHashes(
						message.message.data as Parameters<typeof handleNewBlockHashes>[0],
						this.handlerContext,
					);
					break;

				case "Transactions":
					await handleTransactions(
						message.message.data as Parameters<typeof handleTransactions>[0],
						message.peer,
						this.handlerContext,
					);
					break;

				case "NewBlock":
					await handleNewBlock(
						message.message.data as Parameters<typeof handleNewBlock>[0],
						message.peer,
						this.handlerContext,
					);
					break;

				case "NewPooledTransactionHashes":
					await handleNewPooledTransactionHashes(
						message.message.data as Parameters<
							typeof handleNewPooledTransactionHashes
						>[0],
						message.peer,
						this.handlerContext,
					);
					break;

				case "GetPooledTransactions":
					handleGetPooledTransactions(
						message.message.data as Parameters<
							typeof handleGetPooledTransactions
						>[0],
						message.peer,
						this.handlerContext,
					);
					break;

				case "GetReceipts":
					await handleGetReceipts(
						message.message.data as Parameters<typeof handleGetReceipts>[0],
						message.peer,
						this.handlerContext,
					);
					break;
			}
		} catch (error) {
			// Error handling is done in individual handlers
		}
	};

	async stop(): Promise<boolean> {
		this.removeEventListeners();
		return await this.core.stop();
	}

	async close(): Promise<void> {
		this.removeEventListeners();
		await this.core.close();
	}

	get running(): boolean {
		return this.core.running;
	}
}

