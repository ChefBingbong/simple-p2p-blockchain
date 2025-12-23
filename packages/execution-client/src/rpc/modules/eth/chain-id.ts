import { bigIntToHex } from '../../../../utils/index.ts'
import { safeResult } from '../../../../utils/safe.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { createRpcMethod } from '../../validation.ts'
import { chainIdSchema } from './schema.ts'

export const chainId = (node: ExecutionNode) => {
  return createRpcMethod(chainIdSchema, async (_params, _c) => {
    const chainId = node.chain.config.chainCommon.chainId()
    return safeResult(bigIntToHex(chainId))
  })
}
