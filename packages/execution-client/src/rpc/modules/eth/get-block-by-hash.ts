import type { PrefixedHexString } from '../../../../utils/index'
import { hexToBytes } from '../../../../utils/index'
import { safeResult } from '../../../../utils/safe'
import type { ExecutionNode } from '../../../node/index'
import { createRpcMethod } from '../../validation'
import { toJSONRPCBlock } from './helpers'
import { getBlockByHashSchema } from './schema'

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
