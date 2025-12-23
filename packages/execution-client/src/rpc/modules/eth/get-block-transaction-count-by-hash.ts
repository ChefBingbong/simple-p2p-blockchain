import type { PrefixedHexString } from '../../../../utils/index'
import { hexToBytes, intToHex } from '../../../../utils/index'
import { safeError, safeResult } from '../../../../utils/safe'
import type { ExecutionNode } from '../../../node/index'
import { createRpcMethod } from '../../validation'
import { getBlockTransactionCountByHashSchema } from './schema'

export const getBlockTransactionCountByHash = (node: ExecutionNode) => {
  const chain = node.chain
  return createRpcMethod(
    getBlockTransactionCountByHashSchema,
    async (params: [PrefixedHexString], _c) => {
      const [blockHash] = params
      try {
        const block = await chain.getBlock(hexToBytes(blockHash))
        return safeResult(intToHex(block.transactions.length))
      } catch {
        return safeError(new Error('Unknown block'))
      }
    },
  )
}
