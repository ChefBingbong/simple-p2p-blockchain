import type { PrefixedHexString } from '../../../../utils/index'
import { hexToBytes } from '../../../../utils/index'
import { safeError, safeResult } from '../../../../utils/safe'
import type { TxIndex } from '../../../execution/txIndex'
import type { ExecutionNode } from '../../../node/index'
import { toJSONRPCTx } from '../../helpers'
import { createRpcMethod } from '../../validation'
import { getTransactionByHashSchema } from './schema'

export const getTransactionByHash = (node: ExecutionNode) => {
  const chain = node.chain
  const txIndex: TxIndex | undefined = node.execution.execution.txIndex
  return createRpcMethod(
    getTransactionByHashSchema,
    async (params: [PrefixedHexString], _c) => {
      const [txHash] = params
      if (!txIndex) return safeError(new Error('missing txIndex'))
      const txHashIndex = await txIndex.getIndex(hexToBytes(txHash))
      if (!txHashIndex) return safeResult(null)
      const [blockHash, txIdx] = txHashIndex
      const block = await chain.getBlock(blockHash)
      const tx = block.transactions[txIdx]
      return safeResult(toJSONRPCTx(tx, block, txIdx))
    },
  )
}
