import type { ExecutionNode } from "../../node/index.ts";
import type { RpcHandler, RpcMethodFn } from "../types.ts";
import { createRpcHandler } from "../validation.ts";
import { createAdminRpcMethods } from "./admin/admin.ts";
import { createDebugRpcMethods } from "./debug/index.ts";
import { createEthRpcMethods } from "./eth/eth.ts";
import { createNetRpcMethods } from "./net/net.ts";
import { createTxPoolRpcMethods } from "./txpool/txpool.ts";
import { AllRpcMethods } from "./types.ts";
import { createWeb3RpcMethods } from "./web3/web3.ts";

export const list = ["Eth", "Web3", "Net", "Admin", "TxPool", "Debug"];

// New functional module exports
export * from "./admin/index.ts";
export * from "./debug/index.ts";
// Backward compatibility: export old class-based modules
export * from "./eth/index.ts";
export * from "./net/index.ts";
export * from "./txpool/index.ts";
export * from "./web3/index.ts";

export const createRpcHandlers = (
	node: ExecutionNode,
	debug: boolean,
): {
	methods: string[];
	rpcHandlers: RpcHandler<Record<string, RpcMethodFn>>;
} => {
	const methods: Record<AllRpcMethods, RpcMethodFn> = {
		...createAdminRpcMethods(node),
		...createEthRpcMethods(node),
		...createNetRpcMethods(node),
		...createTxPoolRpcMethods(node),
		...createWeb3RpcMethods(node),
		...createDebugRpcMethods(node),
	};
	return {
		rpcHandlers: createRpcHandler(methods, { debug }),
		methods: Object.keys(methods),
	};
};

export const createP2PRpcHandlers = (
	node: ExecutionNode,
	debug: boolean,
): {
	methods: string[];
	rpcHandlers: RpcHandler<Record<string, RpcMethodFn>>;
} => {
	const methods: Record<AllRpcMethods, RpcMethodFn> = {
		...createAdminRpcMethods(node),
		...createEthRpcMethods(node),
		...createNetRpcMethods(node),
		...createTxPoolRpcMethods(node),
		...createWeb3RpcMethods(node),
		...createDebugRpcMethods(node),
	};
	return {
		rpcHandlers: createRpcHandler(methods, { debug }),
		methods: Object.keys(methods),
	};
};
