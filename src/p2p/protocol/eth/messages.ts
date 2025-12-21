/**
 * ETH Protocol Message Handlers
 *
 * Handlers for all ETH protocol message codes using protocol definitions.
 * These handlers process incoming messages and emit events for the service layer.
 *
 * Note: Payloads are already decoded by devp2p ETH protocol before reaching handlers.
 * The payload format matches the RLP-decoded structure from the protocol definitions.
 */

import debug from "debug";
import {
	ETH_MESSAGES,
	EthMessageCode,
} from "../../../client/net/protocol/eth/definitions";
import type { TypedTransaction } from "../../../tx";
import type { TxReceipt } from "../../../vm";
import type { EthHandler } from "./handler";

const log = debug("p2p:eth:messages");

/**
 * Handle GET_BLOCK_HEADERS request
 * Payload is already decoded by devp2p protocol: [reqId, [block, max, skip, reverse]]
 */
export async function handleGetBlockHeaders(
	handler: EthHandler,
	payload: any,
): Promise<void> {
	try {
		// Payload is already decoded: [reqId, [block, max, skip, reverse]]
		// Use protocol definitions to decode (handles both formats)
		const decoded =
			ETH_MESSAGES[EthMessageCode.GET_BLOCK_HEADERS].decode(payload);
		const { reqId, block, max, skip, reverse } = decoded;

		log(
			"GET_BLOCK_HEADERS: reqId=%d, block=%s, max=%d, skip=%d, reverse=%s",
			reqId,
			typeof block === "bigint" ? block.toString() : "hash",
			max,
			skip,
			reverse,
		);

		// Get headers from chain
		const headers = await handler.chain.getHeaders(block, max, skip, reverse);

		log("Sending %d headers in response to reqId=%d", headers.length, reqId);

		// Send response using devp2p protocol's sendMessage
		// sendMessage expects RLP-encodable data (array)
		const ethProtocol = (handler as any).ethProtocol;
		if (!ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		// Encode response using protocol definitions
		const responseData = ETH_MESSAGES[EthMessageCode.BLOCK_HEADERS].encode({
			reqId,
			headers,
		});

		// sendMessage will RLP-encode the data internally
		ethProtocol.sendMessage(EthMessageCode.BLOCK_HEADERS, responseData);
	} catch (error: any) {
		log("Error handling GET_BLOCK_HEADERS: %s", error.message);
		throw error;
	}
}

/**
 * Handle GET_BLOCK_BODIES request
 * Payload is already decoded: [reqId, hashes]
 */
export async function handleGetBlockBodies(
	handler: EthHandler,
	payload: any,
): Promise<void> {
	try {
		// Payload is already decoded: [reqId, hashes]
		const decoded =
			ETH_MESSAGES[EthMessageCode.GET_BLOCK_BODIES].decode(payload);
		const { reqId, hashes } = decoded;

		log("GET_BLOCK_BODIES: reqId=%d, hashes=%d", reqId, hashes.length);

		// Get blocks from chain
		const blocks = await Promise.all(
			hashes.map((hash) => handler.chain.getBlock(hash)),
		);

		// Extract bodies: [transactions, uncles]
		// Block.raw() returns [header, transactions, uncles]
		// BlockBodyBytes is [transactions, uncles] - slice(1) removes header
		const bodies = blocks.map((block) => block.raw().slice(1) as any);

		log("Sending %d bodies in response to reqId=%d", bodies.length, reqId);

		// Send response using devp2p protocol's sendMessage
		const ethProtocol = (handler as any).ethProtocol;
		if (!ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		const responseData = ETH_MESSAGES[EthMessageCode.BLOCK_BODIES].encode({
			reqId,
			bodies,
		});

		ethProtocol.sendMessage(EthMessageCode.BLOCK_BODIES, responseData);
	} catch (error: any) {
		log("Error handling GET_BLOCK_BODIES: %s", error.message);
		throw error;
	}
}

/**
 * Handle GET_RECEIPTS request
 * Payload is already decoded: [reqId, hashes]
 */
export async function handleGetReceipts(
	handler: EthHandler,
	payload: any,
): Promise<void> {
	try {
		// Payload is already decoded: [reqId, hashes]
		const decoded = ETH_MESSAGES[EthMessageCode.GET_RECEIPTS].decode(payload);
		const { reqId, hashes } = decoded;

		log("GET_RECEIPTS: reqId=%d, hashes=%d", reqId, hashes.length);

		// Get receipts from execution receiptsManager
		const receipts: TxReceipt[][] = [];
		for (const hash of hashes) {
			if (handler.execution.receiptsManager) {
				const blockReceipts =
					await handler.execution.receiptsManager.getReceipts(
						hash,
						false,
						true, // includeTxType for encoding
					);
				receipts.push((blockReceipts as any) || []);
			} else {
				receipts.push([]);
			}
		}

		log(
			"Sending %d receipt sets in response to reqId=%d",
			receipts.length,
			reqId,
		);

		// Send response using devp2p protocol's sendMessage
		const ethProtocol = (handler as any).ethProtocol;
		if (!ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		const responseData = ETH_MESSAGES[EthMessageCode.RECEIPTS].encode({
			reqId,
			receipts: receipts as any, // Type compatibility
		});

		ethProtocol.sendMessage(EthMessageCode.RECEIPTS, responseData);
	} catch (error: any) {
		log("Error handling GET_RECEIPTS: %s", error.message);
		throw error;
	}
}

/**
 * Handle GET_NODE_DATA request
 * Payload is already decoded: [reqId, hashes]
 */
export async function handleGetNodeData(
	handler: EthHandler,
	payload: any,
): Promise<void> {
	try {
		// Payload is already decoded: [reqId, hashes]
		const decoded = ETH_MESSAGES[EthMessageCode.GET_NODE_DATA].decode(payload);
		const { reqId, hashes } = decoded;

		log("GET_NODE_DATA: reqId=%d, hashes=%d", reqId, hashes.length);

		// Get node data from state manager
		// TODO: Implement node data retrieval from state manager
		// For now, return empty array
		const nodes: Uint8Array[] = [];

		log("Sending %d nodes in response to reqId=%d", nodes.length, reqId);

		// Send response using devp2p protocol's sendMessage
		const ethProtocol = (handler as any).ethProtocol;
		if (!ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		const responseData = ETH_MESSAGES[EthMessageCode.NODE_DATA].encode({
			reqId,
			data: nodes,
		});

		ethProtocol.sendMessage(EthMessageCode.NODE_DATA, responseData as any);
	} catch (error: any) {
		log("Error handling GET_NODE_DATA: %s", error.message);
		throw error;
	}
}

/**
 * Handle GET_POOLED_TRANSACTIONS request
 * Payload is already decoded: [reqId, hashes]
 */
export function handleGetPooledTransactions(
	handler: EthHandler,
	payload: any,
): void {
	try {
		// Payload is already decoded: [reqId, hashes]
		const decoded =
			ETH_MESSAGES[EthMessageCode.GET_POOLED_TRANSACTIONS].decode(payload);
		const { reqId, hashes } = decoded;

		log("GET_POOLED_TRANSACTIONS: reqId=%d, hashes=%d", reqId, hashes.length);

		// Get transactions from tx pool
		// Note: txPool is accessed via service, not config
		// For now, we'll need to access it through the service if available
		// This will be fixed when we integrate with P2PFullEthereumService
		const txs: TypedTransaction[] = [];
		// TODO: Access txPool from service when handler is integrated with service
		// For now, return empty array
		log("GET_POOLED_TRANSACTIONS: txPool not accessible from handler yet");

		log("Sending %d transactions in response to reqId=%d", txs.length, reqId);

		// Send response using devp2p protocol's sendMessage
		const ethProtocol = (handler as any).ethProtocol;
		if (!ethProtocol) {
			throw new Error("ETH protocol not available");
		}

		const responseData = ETH_MESSAGES[
			EthMessageCode.POOLED_TRANSACTIONS
		].encode({
			reqId,
			txs,
		});

		ethProtocol.sendMessage(
			EthMessageCode.POOLED_TRANSACTIONS,
			responseData as any,
		);
	} catch (error: any) {
		log("Error handling GET_POOLED_TRANSACTIONS: %s", error.message);
		throw error;
	}
}
