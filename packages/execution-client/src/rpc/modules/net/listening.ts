import { safeResult } from "../../../../utils/safe.ts";
import type { ExecutionNode } from "../../../node/index.ts";
import { createRpcMethod } from "../../validation.ts";
import { listeningSchema } from "./schema.ts";

export const listening = (_node: ExecutionNode) =>
	createRpcMethod(listeningSchema, async (_params, _c) => {
		return safeResult(client.opened);
	});
