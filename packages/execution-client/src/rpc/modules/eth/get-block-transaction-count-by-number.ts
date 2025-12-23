import { intToHex } from '../../../../utils/index.ts'
import { safeResult } from '../../../../utils/safe.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { getBlockByOption } from '../../helpers.ts'
import { createRpcMethod } from '../../validation.ts'
import { getBlockTransactionCountByNumberSchema } from './schema.ts'

export const getBlockTransactionCountByNumber = (node: ExecutionNode) => {
  const chain = node.chain
  return createRpcMethod(
    getBlockTransactionCountByNumberSchema,
    async (params: [string], _c) => {
      const [blockOpt] = params
      const block = await getBlockByOption(blockOpt, chain)
      return safeResult(intToHex(block.transactions.length))
    },
  )
}
