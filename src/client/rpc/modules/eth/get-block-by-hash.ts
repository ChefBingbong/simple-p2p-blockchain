import type { PrefixedHexString } from '../../../../utils/index.ts'
import { hexToBytes } from '../../../../utils/index.ts'
import { safeResult } from '../../../../utils/safe.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { createRpcMethod } from '../../validation.ts'
import { toJSONRPCBlock } from './helpers.ts'
import { getBlockByHashSchema } from './schema.ts'

export const getBlockByHash = (node: ExecutionNode) => {
  const chain = node.chain
  return createRpcMethod(
    getBlockByHashSchema,
    async (params: [PrefixedHexString, boolean], _c) => {
      const [blockHash, includeTransactions] = params
      try {
        const block = await chain.getBlock(hexToBytes(blockHash))
        return safeResult(
          await toJSONRPCBlock(block, chain, includeTransactions),
        )
      } catch {
        return safeResult(null)
      }
    },
  )
}
