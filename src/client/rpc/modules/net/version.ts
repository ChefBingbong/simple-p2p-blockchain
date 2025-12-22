import { safeResult } from "../../../../utils/safe.ts";
import type { ExecutionNode } from "../../../node/index.ts";
import { createRpcMethod } from "../../validation.ts";
import { versionSchema } from "./schema.ts";

export const version = (node: ExecutionNode) => {
	return createRpcMethod(versionSchema, async (_params, _c) => {
		return safeResult(node.chain.config.chainCommon.chainId().toString());
	});
};
