import type { ExecutionNode } from "../../../node/index.ts";
import { AdminRpcMethods, RpcMethods } from "../types.ts";
import { addPeer } from "./add-peer.ts";
import { nodeInfo } from "./node-info.ts";
import { peers } from "./peers.ts";

export const createAdminRpcMethods = (
	node: ExecutionNode,
): RpcMethods<typeof AdminRpcMethods> => {
	// P2PNode handles peer discovery internally - DPT is not directly accessible
	// TODO: Update addPeer to work with P2PNode if needed
	const dpt = null as any; // DPT not available in P2P architecture
	return {
		admin_addPeer: addPeer(node, dpt),
		admin_nodeInfo: nodeInfo(node),
		admin_peers: peers(node),
	};
};
