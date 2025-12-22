import { safeResult } from "../../../../utils/safe.ts";
import type { ExecutionNode } from "../../../node/index.ts";
import { createRpcMethod } from "../../validation.ts";
import { logLevels, verbositySchema } from "./schema.ts";

export const verbosity = (node: ExecutionNode) =>
	createRpcMethod(verbositySchema, async (params: [number], _c) => {
		const [level] = params;
		node.config.options.logger?.configure({ level: logLevels[level] });
		return safeResult(`level: ${node.config.options.logger?.level}`);
	});
