import { safeError, safeResult } from '../../../../utils/safe.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { INTERNAL_ERROR, INVALID_PARAMS } from '../../error-code.ts'
import { getBlockByOption } from '../../helpers.ts'
import { createRpcMethod } from '../../validation.ts'
import { setHeadSchema } from './schema.ts'

export const setHead = (node: ExecutionNode) => {
  const chain = node.chain
  return createRpcMethod(setHeadSchema, async (params: [string], _c) => {
    const [blockOpt] = params
    if (blockOpt === 'pending') {
      const err = new Error(`"pending" is not supported`)
      ;(err as any).code = INVALID_PARAMS
      return safeError(err)
    }

    const block = await getBlockByOption(blockOpt, chain)
    try {
      await node.execution.execution.setHead([block])
      return safeResult(null)
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error))
      if (!(err as any).code) {
        ;(err as any).code = INTERNAL_ERROR
      }
      return safeError(err)
    }
  })
}
