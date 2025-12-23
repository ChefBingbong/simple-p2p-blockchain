import { safeError, safeResult } from '../../../../utils/safe.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { createRpcMethod } from '../../validation.ts'
import { coinbaseSchema } from './schema.ts'

export const coinbase = (node: ExecutionNode) =>
  createRpcMethod(coinbaseSchema, async (_params, _c) => {
    const cb = node.config.options.minerCoinbase
    if (cb === undefined) {
      return safeError(new Error('Coinbase must be explicitly specified'))
    }
    return safeResult(cb.toString())
  })
