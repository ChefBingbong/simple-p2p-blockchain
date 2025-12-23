import type { ExecutionNode } from '../../../node/index.ts'
import { RpcMethods, Web3RpcMethods } from '../types.ts'
import { clientVersion } from './client-version.ts'
import { sha3 } from './sha3.ts'

export const createWeb3RpcMethods = (
  node: ExecutionNode,
): RpcMethods<typeof Web3RpcMethods> => {
  return {
    web3_clientVersion: clientVersion(node),
    web3_sha3: sha3(node),
  }
}
