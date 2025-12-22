import {
	bytesToHex,
	EthereumJSErrorWithoutCode,
} from "../../../../utils/index.ts";
import { safeError, safeResult } from "../../../../utils/safe.ts";
import { encodeReceipt } from "../../../../vm/index.ts";
import type { ExecutionNode } from "../../../node/index.ts";
import { getBlockByOption } from "../../helpers.ts";
import { createRpcMethod } from "../../validation.ts";
import { getRawReceiptsSchema } from "./schema.ts";

export const getRawReceipts = (node: ExecutionNode) => {
	const chain = node.chain;
	return createRpcMethod(getRawReceiptsSchema, async (params: [string], _c) => {
		const [blockOpt] = params;
		if (!node.execution.execution.receiptsManager)
			return safeError(EthereumJSErrorWithoutCode("missing receiptsManager"));
		const block = await getBlockByOption(blockOpt, chain);
		const receipts = await node.execution.execution.receiptsManager.getReceipts(
			block.hash(),
			true,
			true,
		);
		return safeResult(
			receipts.map((r) => bytesToHex(encodeReceipt(r, r.txType))),
		);
	});
};
