import type { ExecutionNode } from '../../../node/index.ts'
import { RpcMethods, TxpoolRpcMethods } from '../types.ts'
import { content } from './content.ts'

export const createTxPoolRpcMethods = (
  node: ExecutionNode,
): RpcMethods<typeof TxpoolRpcMethods> => {
  return {
    txpool_content: content(node),
  }
}
