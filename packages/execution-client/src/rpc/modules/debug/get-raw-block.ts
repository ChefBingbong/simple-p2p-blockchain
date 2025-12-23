import { bytesToHex } from "../../../../utils/index.ts";
import { safeResult } from "../../../../utils/safe.ts";
import type { ExecutionNode } from "../../../node/index.ts";
import { getBlockByOption } from "../../helpers.ts";
import { createRpcMethod } from "../../validation.ts";
import { getRawBlockSchema } from "./schema.ts";

export const getRawBlock = (node: ExecutionNode) => {
	const chain = node.chain;
	return createRpcMethod(getRawBlockSchema, async (params: [string], _c) => {
		const [blockOpt] = params;
		const block = await getBlockByOption(blockOpt, chain);
		return safeResult(bytesToHex(block.serialize()));
	});
};
