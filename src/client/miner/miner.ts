import { MemoryLevel } from "memory-level";
import type { BlockHeader } from "../../block";
import { ConsensusType } from "../../chain-config";
import { Ethash, Miner as EthashMiner, Solution } from "../../eth-hash";
import {
	BIGINT_0,
	BIGINT_1,
	bytesToHex,
	equalsBytes,
} from "../../utils";
import { buildBlock, type TxReceipt } from "../../vm";
import type { Config } from "../config.ts";
import type { VMExecution } from "../execution";
import { LevelDB } from "../execution/level.ts";
import { IndexOperation, IndexType } from "../execution/txIndex.ts";
import type { FullEthereumService } from "../service";
import type { FullSynchronizer } from "../sync";
import { Event } from "../types.ts";

export interface MinerOptions {
	/* Config */
	config: Config;

	/* FullEthereumService */
	service: FullEthereumService;

	/* Skip hardfork validation */
	skipHardForkValidation?: boolean;
}

/**
 * @module miner
 */

/**
 * Implements Ethereum block creation and mining.
 * @memberof module:miner
 */
export class Miner {
	private DEFAULT_PERIOD = 10;
	private _nextAssemblyTimeoutId:
		| NodeJS.Timeout
		| undefined; /* global NodeJS */
	private _boundChainUpdatedHandler: (() => void) | undefined;
	private config: Config;
	private service: FullEthereumService;
	private execution: VMExecution;
	private assembling: boolean;
	private period: number;
	private ethash: Ethash | undefined;
	private ethashMiner: EthashMiner | undefined;
	private nextSolution: Solution | undefined;
	private skipHardForkValidation?: boolean;
	public running: boolean;

	/**
	 * Create miner
	 * @param options constructor parameters
	 */
	constructor(options: MinerOptions) {
		this.config = options.config;
		this.service = options.service;
		this.execution = this.service.execution;
		this.running = false;
		this.assembling = false;
		this.skipHardForkValidation = options.skipHardForkValidation;
		// PoW only - use default period
		this.period = this.DEFAULT_PERIOD * 1000; // defined in ms for setTimeout use
		this.ethash = new Ethash(new LevelDB(new MemoryLevel()) as any);
	}

	/**
	 * Convenience alias to return the latest block in the blockchain
	 */
	private latestBlockHeader(): BlockHeader {
		return this.service.chain.headers.latest!;
	}

	/**
	 * Sets the timeout for the next block assembly
	 */
	private async queueNextAssembly(timeout?: number) {
		if (this._nextAssemblyTimeoutId) {
			clearTimeout(this._nextAssemblyTimeoutId);
		}
		if (!this.running) {
			return;
		}

		// Frontier/Chainstart only - PoW mining
		timeout = timeout ?? this.period;

		this._nextAssemblyTimeoutId = setTimeout(
			this.assembleBlock.bind(this),
			timeout,
		);

		// PoW only - find next solution while waiting for next block assembly to start
		void this.findNextSolution();
	}

	/**
	 * Finds the next PoW solution.
	 */
	private async findNextSolution() {
		if (typeof this.ethash === "undefined") {
			return;
		}
		this.config.logger?.info("Miner: Finding next PoW solution 🔨");
		const header = this.latestBlockHeader();
		this.ethashMiner = this.ethash.getMiner(header);
		const solution = await this.ethashMiner.iterate(-1);
		if (!equalsBytes(header.hash(), this.latestBlockHeader().hash())) {
			// New block was inserted while iterating so we will discard solution
			return;
		}
		this.nextSolution = solution;
		this.config.logger?.info("Miner: Found PoW solution 🔨");
		return solution;
	}

	/**
	 * Sets the next block assembly to latestBlock.timestamp + period
	 */
	private async chainUpdated() {
		this.ethashMiner?.stop();
		const latestBlockHeader = this.latestBlockHeader();
		const target =
			Number(latestBlockHeader.timestamp) * 1000 + this.period - Date.now();
		const timeout = BIGINT_0 > target ? 0 : target;
		this.config.logger?.debug(
			`Miner: Chain updated with block ${
				latestBlockHeader.number
			}. Queuing next block assembly in ${Math.round(timeout / 1000)}s`,
		);
		await this.queueNextAssembly(timeout);
	}

	/**
	 * Start miner
	 */
	start(): boolean {
		if (!this.config.mine || this.running) {
			return false;
		}
		this.running = true;
		this._boundChainUpdatedHandler = this.chainUpdated.bind(this);
		this.config.events.on(Event.CHAIN_UPDATED, this._boundChainUpdatedHandler);
		this.config.logger?.info(
			`Miner started. Assembling next block in ${this.period / 1000}s`,
		);
		void this.queueNextAssembly();
		return true;
	}

	/**
	 * Assembles a block from txs in the TxPool and adds it to the chain.
	 * If a new block is received while assembling it will abort.
	 */
	async assembleBlock() {
		if (this.assembling) {
			return;
		}
		this.assembling = true;

		// Abort if a new block is received while assembling this block
		// eslint-disable-next-line prefer-const
		let _boundSetInterruptHandler: () => void;
		let interrupt = false;
		const setInterrupt = () => {
			interrupt = true;
			this.assembling = false;
			this.config.events.removeListener(
				Event.CHAIN_UPDATED,
				_boundSetInterruptHandler,
			);
		};
		_boundSetInterruptHandler = setInterrupt.bind(this);
		this.config.events.once(Event.CHAIN_UPDATED, _boundSetInterruptHandler);

		const parentBlock = this.service.chain.blocks.latest!;

		const number = parentBlock.header.number + BIGINT_1;
		let { gasLimit } = parentBlock.header;

		// PoW only - wait for solution
		while (this.nextSolution === undefined) {
			this.config.logger?.info(`Miner: Waiting to find next PoW solution 🔨`);
			await new Promise((r) => setTimeout(r, 1000));
		}

		// Use a copy of the vm to not modify the existing state.
		// The state will be updated when the newly assembled block
		// is inserted into the canonical chain.
		const vmCopy = await this.execution.vm.shallowCopy();

		// Set the state root to ensure the resulting state
		// is based on the parent block's state
		await vmCopy.stateManager.setStateRoot(parentBlock.header.stateRoot);

		// IMPORTANT: Set the hardfork for the NEW block being mined
		// This ensures miner rewards and other hardfork-dependent parameters
		// are correct (e.g., 5 ETH pre-byzantium vs 3 ETH post-byzantium)
		vmCopy.common.setHardforkBy({ blockNumber: number });

		// PoW only - calculate difficulty from parent header
		const calcDifficultyFromHeader = parentBlock.header;
		const coinbase = this.config.minerCoinbase ?? this.config.accounts[0][0];

		const blockBuilder = await buildBlock(vmCopy, {
			parentBlock,
			headerData: {
				number,
				gasLimit,
				coinbase,
			},
			blockOpts: {
				calcDifficultyFromHeader,
				putBlockIntoBlockchain: false,
			},
		});

		// Frontier/Chainstart - no base fee
		const txs = await this.service.txPool.txsByPriceAndNonce(vmCopy, {});
		this.config.logger?.info(
			`Miner: Assembling block from ${txs.length} eligible txs`,
		);
		let index = 0;
		let blockFull = false;
		const receipts: TxReceipt[] = [];
		while (index < txs.length && !blockFull && !interrupt) {
			try {
				const txResult = await blockBuilder.addTransaction(txs[index], {
					skipHardForkValidation: this.skipHardForkValidation,
				});
				if (this.config.saveReceipts) {
					receipts.push(txResult.receipt);
				}
			} catch (error) {
				if (
					(error as Error).message ===
					"tx has a higher gas limit than the remaining gas in the block"
				) {
					if (blockBuilder.gasUsed > gasLimit - BigInt(21000)) {
						// If block has less than 21000 gas remaining, consider it full
						blockFull = true;
						this.config.logger?.info(
							`Miner: Assembled block full (gasLeft: ${gasLimit - blockBuilder.gasUsed})`,
						);
					}
				} else {
					// If there is an error adding a tx, it will be skipped
					const hash = bytesToHex(txs[index].hash());
					this.config.logger?.debug(
						`Skipping tx ${hash}, error encountered when trying to add tx:\n${error}`,
					);
				}
			}
			index++;
		}
		if (interrupt) return;
		// Build block, sealing it
		const { block } = await blockBuilder.build(this.nextSolution);
		if (this.config.saveReceipts) {
			await this.execution.receiptsManager?.saveReceipts(block, receipts);
		}
		if (this.execution.txIndex) {
			void this.execution.txIndex.updateIndex(
				IndexOperation.Save,
				IndexType.TxHash,
				block,
			);
		}
		this.config.logger?.info(
			`Miner: Sealed block with ${block.transactions.length} txs (difficulty: ${block.header.difficulty})`,
		);
		this.assembling = false;
		if (interrupt) return;
		// Put block in blockchain
		await (this.service.synchronizer as FullSynchronizer).handleNewBlock(block);
		// Remove included txs from TxPool
		this.service.txPool.removeNewBlockTxs([block]);
		this.config.events.removeListener(
			Event.CHAIN_UPDATED,
			_boundSetInterruptHandler,
		);
	}

	/**
	 * Stop miner execution
	 */
	stop(): boolean {
		if (!this.running) {
			return false;
		}
		this.config.events.removeListener(
			Event.CHAIN_UPDATED,
			this._boundChainUpdatedHandler!,
		);
		if (this._nextAssemblyTimeoutId) {
			clearTimeout(this._nextAssemblyTimeoutId);
		}
		this.running = false;
		this.config.logger?.info("Miner stopped.");
		return true;
	}
}
