import {
	bytesToHex,
	EthereumJSErrorWithoutCode,
} from '../../../../utils/index'
import { safeError, safeResult } from '../../../../utils/safe'
import { encodeReceipt } from '../../../../vm/index'
import type { ExecutionNode } from '../../../node/index'
import { getBlockByOption } from '../../helpers'
import { createRpcMethod } from '../../validation'
import { getRawReceiptsSchema } from './schema'

export const getRawReceipts = (node: ExecutionNode) => {
  const chain = node.chain
  return createRpcMethod(getRawReceiptsSchema, async (params: [string], _c) => {
    const [blockOpt] = params
    if (!node.execution.execution.receiptsManager)
      return safeError(EthereumJSErrorWithoutCode('missing receiptsManager'))
    const block = await getBlockByOption(blockOpt, chain)
    const receipts = await node.execution.execution.receiptsManager.getReceipts(
      block.hash(),
      true,
      true,
    )
    return safeResult(
      receipts.map((r) => bytesToHex(encodeReceipt(r, r.txType))),
    )
  })
}
