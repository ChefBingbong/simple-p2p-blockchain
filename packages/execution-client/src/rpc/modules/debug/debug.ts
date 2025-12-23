import type { ExecutionNode } from "../../../node/index.ts";
import { DebugRpcMethods, RpcMethods } from "../types.ts";
import { getRawBlock } from "./get-raw-block.ts";
import { getRawHeader } from "./get-raw-header.ts";
import { getRawReceipts } from "./get-raw-receipts.ts";
import { getRawTransaction } from "./get-raw-transaction.ts";
import { setHead } from "./set-head.ts";
import { verbosity } from "./verbosity.ts";

export const createDebugRpcMethods = (
	node: ExecutionNode,
): RpcMethods<typeof DebugRpcMethods> => {
	return {
		debug_getRawBlock: getRawBlock(node),
		debug_getRawHeader: getRawHeader(node),
		debug_getRawReceipts: getRawReceipts(node),
		debug_getRawTransaction: getRawTransaction(node),
		debug_setHead: setHead(node),
		debug_verbosity: verbosity(node),
	};
};
