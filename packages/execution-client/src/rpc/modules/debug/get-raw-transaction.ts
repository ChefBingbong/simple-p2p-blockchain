import type { PrefixedHexString } from '../../../../utils/index'
import {
	bytesToHex,
	EthereumJSErrorWithoutCode,
	hexToBytes,
} from '../../../../utils/index'
import { safeError, safeResult } from '../../../../utils/safe'
import type { ExecutionNode } from '../../../node/index'
import { createRpcMethod } from '../../validation'
import { getRawTransactionSchema } from './schema'

export const getRawTransaction = (node: ExecutionNode) => {
  const chain = node.chain
  return createRpcMethod(
    getRawTransactionSchema,
    async (params: [PrefixedHexString], _c) => {
      const [txHash] = params
      if (!node.execution.execution.receiptsManager)
        return safeError(EthereumJSErrorWithoutCode('missing receiptsManager'))
      if (!node.execution.execution.txIndex)
        return safeError(EthereumJSErrorWithoutCode('missing txIndex'))
      const txHashIndex = await node.execution.execution.txIndex.getIndex(
        hexToBytes(txHash),
      )
      if (!txHashIndex) return safeResult(null)
      const [blockHash, txIndex] = txHashIndex
      const block = await chain.getBlock(blockHash)
      const tx = block.transactions[txIndex]
      return safeResult(bytesToHex(tx.serialize()))
    },
  )
}
