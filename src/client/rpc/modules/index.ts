import type { ExecutionNode } from '../../node/index.ts'
import type { RpcHandler, RpcMethodFn } from '../types'
import { createRpcHandler } from '../validation'
import { createAdminRpcMethods } from './admin/admin'
import { createDebugRpcMethods } from './debug'
import { createEthRpcMethods } from './eth/eth'
import { createNetRpcMethods } from './net/net'
import { createTxPoolRpcMethods } from './txpool/txpool'
import { AllRpcMethods } from './types'
import { createWeb3RpcMethods } from './web3/web3'

export const list = ['Eth', 'Web3', 'Net', 'Admin', 'TxPool', 'Debug']

// New functional module exports
export * from './admin'
export * from './debug'
// Backward compatibility: export old class-based modules
export * from './eth'
export * from './net'
export * from './txpool'
export * from './web3'

export const createRpcHandlers = (
  node: ExecutionNode,
  debug: boolean,
): {
  methods: string[]
  rpcHandlers: RpcHandler<Record<string, RpcMethodFn>>
} => {
  const methods: Record<AllRpcMethods, RpcMethodFn> = {
    ...createAdminRpcMethods(node),
    ...createEthRpcMethods(node),
    ...createNetRpcMethods(node),
    ...createTxPoolRpcMethods(node),
    ...createWeb3RpcMethods(node),
    ...createDebugRpcMethods(node),
  }
  return {
    rpcHandlers: createRpcHandler(methods, { debug }),
    methods: Object.keys(methods),
  }
}

export const createP2PRpcHandlers = (
  node: ExecutionNode,
  debug: boolean,
): {
  methods: string[]
  rpcHandlers: RpcHandler<Record<string, RpcMethodFn>>
} => {
  const methods: Record<AllRpcMethods, RpcMethodFn> = {
    ...createAdminRpcMethods(node),
    ...createEthRpcMethods(node),
    ...createNetRpcMethods(node),
    ...createTxPoolRpcMethods(node),
    ...createWeb3RpcMethods(node),
    ...createDebugRpcMethods(node),
  }
  return {
    rpcHandlers: createRpcHandler(methods, { debug }),
    methods: Object.keys(methods),
  }
}
