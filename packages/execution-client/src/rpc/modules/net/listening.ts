import { safeResult } from '../../../../utils/safe'
import type { ExecutionNode } from '../../../node/index'
import { createRpcMethod } from '../../validation'
import { listeningSchema } from './schema'

export const listening = (_node: ExecutionNode) =>
  createRpcMethod(listeningSchema, async (_params, _c) => {
    return safeResult(client.opened)
  })
