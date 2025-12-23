import { addHexPrefix } from '../../../../utils/index'
import { safeResult } from '../../../../utils/safe'
import type { ExecutionNode } from '../../../node/index'
import { createRpcMethod } from '../../validation'
import { peerCountSchema } from './schema'

export const peerCount = (node: ExecutionNode) => {
  return createRpcMethod(peerCountSchema, async (_params, _c) => {
    return safeResult(addHexPrefix(node.network.getPeerCount().toString(16)))
  })
}
