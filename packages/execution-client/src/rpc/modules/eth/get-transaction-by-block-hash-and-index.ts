import type { PrefixedHexString } from '@ts-ethereum/utils'
import { hexToBytes, safeError, safeResult } from '@ts-ethereum/utils'
import type { ExecutionNode } from '../../../node/index'
import { toJSONRPCTx } from '../../helpers'
import { createRpcMethod } from '../../validation'
import { getTransactionByBlockHashAndIndexSchema } from './schema'

export const getTransactionByBlockHashAndIndex = (node: ExecutionNode) => {
  const chain = node.chain
  return createRpcMethod(
    getTransactionByBlockHashAndIndexSchema,
    async (params: [PrefixedHexString, string], _c) => {
      try {
        const [blockHash, txIndexHex] = params
        const txIndex = Number.parseInt(txIndexHex, 16)
        const block = await chain.getBlock(hexToBytes(blockHash))
        if (block.transactions.length <= txIndex) {
          return safeResult(null)
        }

        const tx = block.transactions[txIndex]
        return safeResult(toJSONRPCTx(tx, block, txIndex))
      } catch (error: any) {
        return safeError(error)
      }
    },
  )
}
