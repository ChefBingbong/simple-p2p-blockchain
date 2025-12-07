import type { PrefixedHexString } from "../utils/index.ts";
import {
	addHexPrefix,
	intToHex,
	isHexString,
	stripHexPrefix,
} from "../utils/index.ts";
import { Holesky, Hoodi, Mainnet, Sepolia } from "./chains.ts";
import { Hardfork } from "./enums.ts";
import type { GethGenesis } from "./gethGenesis.ts";

type ConfigHardfork =
	| { name: string; block: null; timestamp: number }
	| { name: string; block: number; timestamp?: number };

/**
 * Transforms Geth formatted nonce (i.e. hex string) to 8 byte 0x-prefixed string used internally
 * @param nonce string parsed from the Geth genesis file
 * @returns nonce as a 0x-prefixed 8 byte string
 */
function formatNonce(nonce: string): PrefixedHexString {
	if (!nonce || nonce === "0x0") {
		return "0x0000000000000000";
	}
	if (isHexString(nonce)) {
		return `0x${stripHexPrefix(nonce).padStart(16, "0")}`;
	}
	return `0x${nonce.padStart(16, "0")}`;
}

/**
 * Converts Geth genesis parameters to an EthereumJS compatible `CommonOpts` object
 * Simplified for Frontier/Chainstart only - PoW Ethash consensus
 * @param gethGenesis GethGenesis object
 * @returns genesis parameters in a `CommonOpts` compliant object
 */
function parseGethParams(gethGenesis: GethGenesis) {
	const {
		name,
		config,
		difficulty,
		mixHash,
		gasLimit,
		coinbase,
		extraData: unparsedExtraData,
		nonce: unparsedNonce,
		timestamp: unparsedTimestamp,
	} = gethGenesis;
	const { chainId } = config;

	// geth is not strictly putting empty fields with a 0x prefix
	const extraData = addHexPrefix(unparsedExtraData ?? "");

	// geth may use number for timestamp
	const timestamp: PrefixedHexString = isHexString(unparsedTimestamp)
		? unparsedTimestamp
		: intToHex(parseInt(unparsedTimestamp));

	// geth may not give us a nonce strictly formatted to an 8 byte 0x-prefixed hex string
	const nonce =
		unparsedNonce.length !== 18
			? formatNonce(unparsedNonce)
			: addHexPrefix(unparsedNonce);

	const params = {
		name,
		chainId,
		genesis: {
			timestamp,
			gasLimit,
			difficulty,
			nonce,
			extraData,
			mixHash,
			coinbase,
		},
		hardfork: Hardfork.Chainstart,
		hardforks: [{ name: Hardfork.Chainstart, block: 0 }] as ConfigHardfork[],
		bootstrapNodes: [],
		consensus: {
			type: "pow",
			algorithm: "ethash",
			ethash: {},
		},
	};

	return params;
}

/**
 * Parses a genesis object exported from Geth into parameters for Common instance
 * Simplified for Frontier/Chainstart only
 * @param gethGenesis GethGenesis object
 * @param name optional chain name
 * @returns parsed params
 */
export function parseGethGenesis(gethGenesis: GethGenesis, name?: string) {
	try {
		const required = ["config", "difficulty", "gasLimit", "nonce", "alloc"];
		if (required.some((field) => !(field in gethGenesis))) {
			const missingField = required.filter((field) => !(field in gethGenesis));
			throw Error(
				`Invalid format, expected geth genesis field "${missingField}" missing`,
			);
		}

		// We copy the object here because it's frozen in browser and properties can't be modified
		const finalGethGenesis = { ...gethGenesis };

		if (name !== undefined) {
			finalGethGenesis.name = name;
		}
		return parseGethParams(finalGethGenesis);
	} catch (e: any) {
		throw Error(`Error parsing parameters file: ${e.message}`);
	}
}

/**
 * Return the preset chain config for one of the predefined chain configurations
 * @param chain the representing a network name (e.g. 'mainnet') or number representing the chain ID
 * @returns a {@link ChainConfig}
 */
export const getPresetChainConfig = (chain: string | number) => {
	switch (chain) {
		case "holesky":
		case 17000:
			return Holesky;
		case "hoodi":
		case 560048:
			return Hoodi;
		case "sepolia":
		case 11155111:
			return Sepolia;
		case "mainnet":
		case 1:
		default:
			return Mainnet;
	}
};
