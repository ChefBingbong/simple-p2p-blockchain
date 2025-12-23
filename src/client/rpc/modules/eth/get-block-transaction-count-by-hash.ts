import type { PrefixedHexString } from '../../../../utils/index.ts'
import { hexToBytes, intToHex } from '../../../../utils/index.ts'
import { safeError, safeResult } from '../../../../utils/safe.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { createRpcMethod } from '../../validation.ts'
import { getBlockTransactionCountByHashSchema } from './schema.ts'

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
