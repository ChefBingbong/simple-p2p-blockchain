import { BIGINT_0, bigIntToHex } from '../../../../utils/index'
import { safeResult } from '../../../../utils/safe'
import type { ExecutionNode } from '../../../node/index'
import { createRpcMethod } from '../../validation'
import { blockNumberSchema } from './schema'

export const blockNumber = (node: ExecutionNode) => {
  return createRpcMethod(blockNumberSchema, async (_params, _c) => {
    return safeResult(
      bigIntToHex(node.chain.headers.latest?.number ?? BIGINT_0),
    )
  })
}
