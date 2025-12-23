import { intToHex } from '../../../../utils/index.ts'
import { safeResult } from '../../../../utils/safe.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { createRpcMethod } from '../../validation.ts'
import { protocolVersionSchema } from './schema.ts'

export const protocolVersion = (_node: ExecutionNode) => {
  // For P2P, protocols are handled via EthHandler - default to ETH/68
  const ethVersion = 68 // ETH/68 is the current version
  return createRpcMethod(protocolVersionSchema, async (_params, _c) => {
    return safeResult(intToHex(ethVersion))
  })
}
