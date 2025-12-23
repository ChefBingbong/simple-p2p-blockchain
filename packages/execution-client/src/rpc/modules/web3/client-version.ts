import { getClientVersion } from '../../../util/index.ts'
import { safeResult } from '../../../../utils/safe.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { createRpcMethod } from '../../validation.ts'
import { clientVersionSchema } from './schema.ts'

export const clientVersion = (_node: ExecutionNode) =>
  createRpcMethod(clientVersionSchema, async (_params, _c) => {
    return safeResult(getClientVersion())
  })
