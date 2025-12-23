import type { Block } from '../../../../block/index'
import type { LegacyTx } from '../../../../tx/index'
import { hexToBytes, isHexString } from '../../../../utils/index'
import { safeError, safeResult } from '../../../../utils/safe'
import type { VM } from '../../../../vm/index'
import { runBlock } from '../../../../vm/index'
import type { ReceiptsManager } from '../../../execution/receipt'
import type { ExecutionNode } from '../../../node/index'
import { getBlockByOption } from '../../helpers'
import { createRpcMethod } from '../../validation'
import { toJSONRPCReceipt } from './helpers'
import { getBlockReceiptsSchema } from './schema'

export const getBlockReceipts = (node: ExecutionNode) => {
  const chain = node.chain
  const vm: VM | undefined = node.execution?.vm
  const receiptsManager: ReceiptsManager | undefined =
    node.execution?.receiptsManager
  return createRpcMethod(
    getBlockReceiptsSchema,
    async (params: [string], _c) => {
      const [blockOpt] = params
      let block: Block
      try {
        if (isHexString(blockOpt, 64)) {
          block = await chain.getBlock(hexToBytes(blockOpt))
        } else {
          block = await getBlockByOption(blockOpt, chain)
        }
      } catch {
        return safeResult(null)
      }
      const blockHash = block.hash()
      if (!receiptsManager)
        return safeError(new Error('missing receiptsManager'))
      const result = await receiptsManager.getReceipts(blockHash, true, true)
      if (result.length === 0) return safeResult([])
      const parentBlock = await chain.getBlock(block.header.parentHash)
      const vmCopy = await vm!.shallowCopy()
      const runBlockResult = await runBlock(vmCopy, {
        block,
        root: parentBlock.header.stateRoot,
        skipBlockValidation: true,
      })

      const receipts = await Promise.all(
        result.map(async (r, i) => {
          const tx = block.transactions[i]
          const { totalGasSpent } = runBlockResult.results[i]
          const effectiveGasPrice = (tx as LegacyTx).gasPrice

          return toJSONRPCReceipt(
            r,
            totalGasSpent,
            effectiveGasPrice,
            block,
            tx,
            i,
            i,
            undefined,
          )
        }),
      )
      return safeResult(receipts)
    },
  )
}
