import type { PrefixedHexString } from "../../../../utils/index.ts";
import { hexToBytes } from "../../../../utils/index.ts";
import { safeError, safeResult } from "../../../../utils/safe.ts";
import type { TxIndex } from "../../../execution/txIndex.ts";
import type { ExecutionNode } from "../../../node/index.ts";
import { toJSONRPCTx } from "../../helpers.ts";
import { createRpcMethod } from "../../validation.ts";
import { getTransactionByHashSchema } from "./schema.ts";

export const getTransactionByHash = (node: ExecutionNode) => {
	const chain = node.chain;
	const txIndex: TxIndex | undefined = node.execution.execution.txIndex;
	return createRpcMethod(
		getTransactionByHashSchema,
		async (params: [PrefixedHexString], _c) => {
			const [txHash] = params;
			if (!txIndex) return safeError(new Error("missing txIndex"));
			const txHashIndex = await txIndex.getIndex(hexToBytes(txHash));
			if (!txHashIndex) return safeResult(null);
			const [blockHash, txIdx] = txHashIndex;
			const block = await chain.getBlock(blockHash);
			const tx = block.transactions[txIdx];
			return safeResult(toJSONRPCTx(tx, block, txIdx));
		},
	);
};
