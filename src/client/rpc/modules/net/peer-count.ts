import { addHexPrefix } from "../../../../utils/index.ts";
import { safeResult } from "../../../../utils/safe.ts";
import type { ExecutionNode } from "../../../node/index.ts";
import { createRpcMethod } from "../../validation.ts";
import { peerCountSchema } from "./schema.ts";

export const peerCount = (node: ExecutionNode) => {
	return createRpcMethod(peerCountSchema, async (_params, _c) => {
		return safeResult(addHexPrefix(node.pool.peers.length.toString(16)));
	});
};
