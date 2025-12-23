import type { ExecutionNode } from '../../../node/index.ts'
import { NetRpcMethods, RpcMethods } from '../types.ts'
import { listening } from './listening.ts'
import { peerCount } from './peer-count.ts'
import { version } from './version.ts'

export const createNetRpcMethods = (
  node: ExecutionNode,
): RpcMethods<typeof NetRpcMethods> => {
  return {
    net_version: version(node),
    net_listening: listening(node),
    net_peerCount: peerCount(node),
  }
}
