import { EventEmitter } from "eventemitter3";
import type { BigIntLike, PrefixedHexString } from "../utils/index.ts";
import {
	BIGINT_0,
	bytesToHex,
	concatBytes,
	hexToBytes,
	intToBytes,
	toType,
	TypeOutput,
} from "../utils/index.ts";
import { crc32 } from "./crc.ts";
import { eipsDict } from "./eips.ts";
import type { ConsensusAlgorithm, ConsensusType } from "./enums.ts";
import { Hardfork } from "./enums.ts";
import { hardforksDict } from "./hardforks.ts";
import type {
	BootstrapNodeConfig,
	ChainConfig,
	CommonEvent,
	CommonOpts,
	CustomCrypto,
	EthashConfig,
	GenesisBlockConfig,
	HardforkByOpts,
	HardforkConfig,
	HardforkTransitionConfig,
	ParamsConfig,
	ParamsDict,
} from "./types.ts";

/**
 * Common class to access chain and hardfork parameters and to provide
 * a unified and shared view on the network and hardfork state.
 *
 * Simplified to only support Chainstart/Frontier with PoW consensus.
 */
export class Common {
	readonly DEFAULT_HARDFORK: string | Hardfork = Hardfork.Chainstart;

	protected _chainParams: ChainConfig;
	protected _hardfork: string | Hardfork = Hardfork.Chainstart;
	protected _eips: number[] = [];
	protected _params: ParamsDict;

	public readonly customCrypto: CustomCrypto;

	protected _paramsCache: ParamsConfig = {};
	protected _activatedEIPsCache: number[] = [];

	protected HARDFORK_CHANGES: [string, HardforkConfig][];

	public events: EventEmitter<CommonEvent>;

	constructor(opts: CommonOpts) {
		this.events = new EventEmitter<CommonEvent>();

		this._chainParams = JSON.parse(JSON.stringify(opts.chain)); // copy
		// Always use Chainstart
		this.HARDFORK_CHANGES = this.hardforks().map((hf) => [
			hf.name,
			(this._chainParams.customHardforks &&
				this._chainParams.customHardforks[hf.name]) ??
				hardforksDict[hf.name],
		]);
		this._hardfork = Hardfork.Chainstart;
		this._params = opts.params ? JSON.parse(JSON.stringify(opts.params)) : {}; // copy

		// Ignore hardfork option - always Chainstart
		// Ignore eips option - no additional EIPs supported

		this.customCrypto = opts.customCrypto ?? {};

		if (Object.keys(this._paramsCache).length === 0) {
			this._buildParamsCache();
			this._buildActivatedEIPsCache();
		}
	}

	/**
	 * Update the internal Common EIP params set.
	 */
	updateParams(params: ParamsDict) {
		for (const [eip, paramsConfig] of Object.entries(params)) {
			if (!(eip in this._params)) {
				this._params[eip] = JSON.parse(JSON.stringify(paramsConfig));
			} else {
				this._params[eip] = JSON.parse(
					JSON.stringify({ ...this._params[eip], ...params[eip] }),
				);
			}
		}
		this._buildParamsCache();
	}

	/**
	 * Fully resets the internal Common EIP params set.
	 */
	resetParams(params: ParamsDict) {
		this._params = JSON.parse(JSON.stringify(params));
		this._buildParamsCache();
	}

	/**
	 * Sets the hardfork - simplified to always use Chainstart
	 */
	setHardfork(hardfork: string | Hardfork): void {
		// Only Chainstart is supported
		if (hardfork !== Hardfork.Chainstart && hardfork !== "chainstart") {
			throw Error(`Only Chainstart hardfork is supported, got: ${hardfork}`);
		}
		this._hardfork = Hardfork.Chainstart;
	}

	/**
	 * Returns the hardfork - always Chainstart
	 */
	getHardforkBy(_opts: HardforkByOpts): string {
		return Hardfork.Chainstart;
	}

	/**
	 * Sets a new hardfork - always returns Chainstart
	 */
	setHardforkBy(_opts: HardforkByOpts): string {
		return Hardfork.Chainstart;
	}

	/**
	 * Internal helper function, returns the params for Chainstart
	 */
	protected _getHardfork(
		hardfork: string | Hardfork,
	): HardforkTransitionConfig | null {
		const hfs = this.hardforks();
		for (const hf of hfs) {
			if (hf["name"] === hardfork) return hf;
		}
		return null;
	}

	/**
	 * Sets the active EIPs - no additional EIPs supported
	 */
	setEIPs(eips: number[] = []) {
		if (eips.length > 0) {
			// Only EIP 1 (Frontier) is implicitly supported
			for (const eip of eips) {
				if (eip !== 1 && !(eip in eipsDict)) {
					throw Error(`EIP ${eip} not supported - only Chainstart/Frontier behavior`);
				}
			}
		}
		this._eips = [];
		this._buildParamsCache();
		this._buildActivatedEIPsCache();
	}

	/**
	 * Internal helper for _buildParamsCache()
	 */
	protected _mergeWithParamsCache(params: ParamsConfig) {
		for (const [key, value] of Object.entries(params)) {
			this._paramsCache[key] = value;
		}
	}

	/**
	 * Build up a cache for all parameter values
	 */
	protected _buildParamsCache() {
		this._paramsCache = {};

		// Only process Chainstart hardfork
		for (const hfChanges of this.HARDFORK_CHANGES) {
			if ("eips" in hfChanges[1]) {
				const hfEIPs = hfChanges[1].eips ?? [];
				for (const eip of hfEIPs) {
					if (this._params[eip] !== undefined && this._params[eip] !== null) {
						this._mergeWithParamsCache(this._params[eip]);
					}
				}
			}
			const hfScopedParams = this._params[hfChanges[0]];
			if (hfScopedParams !== undefined && hfScopedParams !== null) {
				this._mergeWithParamsCache(hfScopedParams);
			}
			if (hfChanges[1].params !== undefined && hfChanges[1].params !== null) {
				this._mergeWithParamsCache(hfChanges[1].params);
			}
		}
	}

	/**
	 * Builds the cache of EIPs activated
	 */
	protected _buildActivatedEIPsCache() {
		this._activatedEIPsCache = [];

		for (const [name, hf] of this.HARDFORK_CHANGES) {
			if (this.gteHardfork(name) && "eips" in hf) {
				this._activatedEIPsCache = this._activatedEIPsCache.concat(
					hf.eips ?? [],
				);
			}
		}
	}

	/**
	 * Returns a parameter for the current chain setup
	 */
	param(name: string): bigint {
		if (!(name in this._paramsCache)) {
			throw Error(`Missing parameter value for ${name}`);
		}
		const value = this._paramsCache[name];
		return BigInt(value ?? 0);
	}

	/**
	 * Returns the parameter corresponding to a hardfork
	 */
	paramByHardfork(name: string, _hardfork: string | Hardfork): bigint {
		// Always use Chainstart params
		return this.param(name);
	}

	/**
	 * Returns a parameter corresponding to an EIP
	 */
	paramByEIP(name: string, eip: number): bigint | undefined {
		if (!(eip in eipsDict)) {
			throw Error(`${eip} not supported`);
		}

		const eipParams = this._params[eip];
		if (eipParams?.[name] === undefined) {
			throw Error(`Missing parameter value for ${name}`);
		}
		const value = eipParams![name];
		return BigInt(value ?? 0);
	}

	/**
	 * Returns a parameter for the hardfork active on block number
	 */
	paramByBlock(
		name: string,
		_blockNumber: BigIntLike,
		_timestamp?: BigIntLike,
	): bigint {
		// Always Chainstart
		return this.param(name);
	}

	/**
	 * Checks if an EIP is activated - only EIP 1 is active
	 */
	isActivatedEIP(eip: number): boolean {
		return eip === 1 || this._activatedEIPsCache.includes(eip);
	}

	/**
	 * Checks if set or provided hardfork is active on block number
	 */
	hardforkIsActiveOnBlock(
		hardfork: string | Hardfork | null,
		blockNumber: BigIntLike,
	): boolean {
		blockNumber = toType(blockNumber, TypeOutput.BigInt);
		// Chainstart is always active from block 0
		return blockNumber >= BIGINT_0;
	}

	/**
	 * Alias to hardforkIsActiveOnBlock when hardfork is set
	 */
	activeOnBlock(blockNumber: BigIntLike): boolean {
		return this.hardforkIsActiveOnBlock(null, blockNumber);
	}

	/**
	 * Sequence based check if given or set HF1 is greater than or equal HF2
	 */
	hardforkGteHardfork(
		hardfork1: string | Hardfork | null,
		hardfork2: string | Hardfork,
	): boolean {
		// Only Chainstart exists, so it's always >= Chainstart
		return hardfork2 === Hardfork.Chainstart || hardfork2 === "chainstart";
	}

	/**
	 * Alias to hardforkGteHardfork when hardfork is set
	 */
	gteHardfork(hardfork: string | Hardfork): boolean {
		return this.hardforkGteHardfork(null, hardfork);
	}

	/**
	 * Returns the hardfork change block for hardfork provided or set
	 */
	hardforkBlock(hardfork?: string | Hardfork): bigint | null {
		hardfork = hardfork ?? this._hardfork;
		const block = this._getHardfork(hardfork)?.["block"];
		if (block === undefined || block === null) {
			return null;
		}
		return BigInt(block);
	}

	/**
	 * Returns the timestamp at which a given hardfork is scheduled
	 */
	hardforkTimestamp(hardfork?: string | Hardfork): bigint | null {
		hardfork = hardfork ?? this._hardfork;
		const timestamp = this._getHardfork(hardfork)?.["timestamp"];
		if (timestamp === undefined || timestamp === null) {
			return null;
		}
		return BigInt(timestamp);
	}

	/**
	 * Returns the hardfork change block for eip
	 */
	eipBlock(eip: number): bigint | null {
		// Only EIP 1 at block 0
		if (eip === 1) return BIGINT_0;
		return null;
	}

	/**
	 * Returns the scheduled timestamp of the EIP
	 */
	eipTimestamp(_eip: number): bigint | null {
		return null;
	}

	/**
	 * Returns the block number or timestamp at which the next hardfork will occur.
	 * Returns null since there is no next hardfork after Chainstart.
	 */
	nextHardforkBlockOrTimestamp(_hardfork?: string | Hardfork): bigint | null {
		return null;
	}

	/**
	 * Internal helper function to calculate a fork hash
	 */
	protected _calcForkHash(
		hardfork: string | Hardfork,
		genesisHash: Uint8Array,
	): PrefixedHexString {
		let hfBytes = new Uint8Array(0);
		let prevBlockOrTime = 0;
		for (const hf of this.hardforks()) {
			const { block, timestamp, name } = hf;
			let blockOrTime = timestamp ?? block;
			blockOrTime = blockOrTime !== null ? Number(blockOrTime) : null;

			if (
				typeof blockOrTime === "number" &&
				blockOrTime !== 0 &&
				blockOrTime !== prevBlockOrTime
			) {
				const hfBlockBytes = hexToBytes(
					`0x${blockOrTime.toString(16).padStart(16, "0")}`,
				);
				hfBytes = concatBytes(hfBytes, hfBlockBytes);
				prevBlockOrTime = blockOrTime;
			}

			if (hf.name === hardfork) break;
		}
		const inputBytes = concatBytes(genesisHash, hfBytes);
		const forkhash = bytesToHex(intToBytes(crc32(inputBytes) >>> 0));
		return forkhash;
	}

	/**
	 * Returns an eth/64 compliant fork hash (EIP-2124)
	 */
	forkHash(
		hardfork?: string | Hardfork,
		genesisHash?: Uint8Array,
	): PrefixedHexString {
		hardfork = hardfork ?? this._hardfork;
		const data = this._getHardfork(hardfork);
		if (
			data === null ||
			(data?.block === null && data?.timestamp === undefined)
		) {
			const msg = "No fork hash calculation possible for future hardfork";
			throw Error(msg);
		}
		if (data?.forkHash !== null && data?.forkHash !== undefined) {
			return data.forkHash;
		}
		if (!genesisHash)
			throw Error("genesisHash required for forkHash calculation");
		return this._calcForkHash(hardfork, genesisHash);
	}

	/**
	 * Returns hardfork data for a given fork hash
	 */
	hardforkForForkHash(forkHash: string): HardforkTransitionConfig | null {
		const resArray = this.hardforks().filter((hf: HardforkTransitionConfig) => {
			return hf.forkHash === forkHash;
		});
		return resArray.length >= 1 ? resArray[resArray.length - 1] : null;
	}

	/**
	 * Sets any missing forkHashes on this Common instance.
	 */
	setForkHashes(genesisHash: Uint8Array) {
		for (const hf of this.hardforks()) {
			const blockOrTime = hf.timestamp ?? hf.block;
			if (
				(hf.forkHash === null || hf.forkHash === undefined) &&
				blockOrTime !== null &&
				blockOrTime !== undefined
			) {
				hf.forkHash = this.forkHash(hf.name, genesisHash);
			}
		}
	}

	/**
	 * Returns the Genesis parameters of the current chain
	 */
	genesis(): GenesisBlockConfig {
		return this._chainParams.genesis;
	}

	/**
	 * Returns the hardfork definitions for the current chain.
	 */
	hardforks(): HardforkTransitionConfig[] {
		return this._chainParams.hardforks;
	}

	/**
	 * Returns bootstrap nodes for the current chain.
	 */
	bootstrapNodes(): BootstrapNodeConfig[] {
		return this._chainParams.bootstrapNodes;
	}

	/**
	 * Returns DNS networks for the current chain
	 */
	dnsNetworks(): string[] {
		return this._chainParams.dnsNetworks!;
	}

	/**
	 * Returns the hardfork set - always Chainstart
	 */
	hardfork(): string | Hardfork {
		return this._hardfork;
	}

	/**
	 * Returns the Id of current chain
	 */
	chainId(): bigint {
		return BigInt(this._chainParams.chainId);
	}

	/**
	 * Returns the name of current chain
	 */
	chainName(): string {
		return this._chainParams.name;
	}

	/**
	 * Returns the additionally activated EIPs - always empty for Chainstart-only
	 */
	eips(): number[] {
		return this._eips;
	}

	/**
	 * Returns the consensus type of the network - always PoW
	 */
	consensusType(): string | ConsensusType {
		return this._chainParams["consensus"]["type"];
	}

	/**
	 * Returns the concrete consensus implementation algorithm - always Ethash
	 */
	consensusAlgorithm(): string | ConsensusAlgorithm {
		return this._chainParams["consensus"]["algorithm"] as ConsensusAlgorithm;
	}

	/**
	 * Returns a dictionary with consensus configuration parameters
	 */
	consensusConfig(): {
		[key: string]: EthashConfig;
	} {
		return (
			this._chainParams["consensus"][
				this.consensusAlgorithm() as ConsensusAlgorithm
			] ?? {}
		);
	}

	/**
	 * Returns a deep copy of this Common instance.
	 */
	copy(): Common {
		const copy = Object.assign(
			Object.create(Object.getPrototypeOf(this)),
			this,
		);
		copy.events = new EventEmitter();
		return copy;
	}
}
