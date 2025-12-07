import type { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import type { BigIntLike, KZG, PrefixedHexString } from "../utils/index.ts";
import type { ConsensusAlgorithm, ConsensusType, Hardfork } from "./enums.ts";

export interface ChainName {
	[chainId: string]: string;
}
export interface ChainsConfig {
	[key: string]: ChainConfig | ChainName;
}

export interface CommonEvent {
	hardforkChanged: [hardfork: string];
}

// Kept for compatibility but Clique is not used
export type CliqueConfig = {
	period: number;
	epoch: number;
};

export type EthashConfig = {};

// Kept for compatibility but Casper is not used
export type CasperConfig = {};

type ConsensusConfig = {
	type: ConsensusType | string;
	algorithm: ConsensusAlgorithm | string;
	clique?: CliqueConfig;
	ethash?: EthashConfig;
	casper?: CasperConfig;
};

export interface ChainConfig {
	name: string;
	chainId: number | string;
	defaultHardfork?: string;
	comment?: string;
	url?: string;
	genesis: GenesisBlockConfig;
	hardforks: HardforkTransitionConfig[];
	customHardforks?: HardforksDict;
	bootstrapNodes: BootstrapNodeConfig[];
	dnsNetworks?: string[];
	consensus: ConsensusConfig;
}

export interface GenesisBlockConfig {
	timestamp?: PrefixedHexString;
	gasLimit: number | PrefixedHexString;
	difficulty: number | PrefixedHexString;
	nonce: PrefixedHexString;
	extraData: PrefixedHexString;
}

export interface HardforkTransitionConfig {
	name: Hardfork | string;
	block: number | null;
	timestamp?: number | string;
	forkHash?: PrefixedHexString | null;
}

export interface BootstrapNodeConfig {
	ip: string;
	port: number | string;
	network?: string;
	chainId?: number;
	id: string;
	location: string;
	comment: string;
}

export interface CustomCrypto {
	keccak256?: (msg: Uint8Array) => Uint8Array;
	ecrecover?: (
		msgHash: Uint8Array,
		v: bigint,
		r: Uint8Array,
		s: Uint8Array,
		chainId?: bigint,
	) => Uint8Array;
	sha256?: (msg: Uint8Array) => Uint8Array;
	ecsign?: (
		msg: Uint8Array,
		pk: Uint8Array,
		ecSignOpts?: { extraEntropy?: Uint8Array | boolean },
	) => Pick<ReturnType<typeof secp256k1.sign>, "recovery" | "r" | "s">;
	ecdsaRecover?: (
		sig: Uint8Array,
		recId: number,
		hash: Uint8Array,
	) => Uint8Array;
	kzg?: KZG;
}

export interface BaseOpts {
	/**
	 * String identifier ('chainstart') for hardfork or {@link Hardfork} enum.
	 * Only Chainstart is supported.
	 */
	hardfork?: string | Hardfork;
	/**
	 * EIPs - not used, only Frontier/Chainstart behavior supported
	 */
	eips?: number[];
	/**
	 * Optionally pass in an EIP params dictionary
	 */
	params?: ParamsDict;
	/**
	 * Custom crypto implementations
	 */
	customCrypto?: CustomCrypto;
}

/**
 * Options for instantiating a {@link Common} instance.
 */
export interface CommonOpts extends BaseOpts {
	chain: ChainConfig;
}

export interface GethConfigOpts extends BaseOpts {
	chain?: string;
	genesisHash?: Uint8Array;
}

export interface HardforkByOpts {
	blockNumber?: BigIntLike;
	timestamp?: BigIntLike;
}

export type EIPConfig = {
	minimumHardfork: Hardfork;
	requiredEIPs?: number[];
};

export type ParamsConfig = {
	[key: string]: number | string | null;
};

export type HardforkConfig = {
	eips?: number[];
	consensus?: ConsensusConfig;
	params?: ParamsConfig;
};

export type EIPsDict = {
	[key: string]: EIPConfig;
};

export type ParamsDict = {
	[key: string]: ParamsConfig;
};

export type HardforksDict = {
	[key: string]: HardforkConfig;
};
