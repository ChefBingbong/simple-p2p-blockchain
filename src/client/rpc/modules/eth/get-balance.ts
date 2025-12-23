import {
  bigIntToHex,
  createAddressFromString,
  EthereumJSErrorWithoutCode,
} from '../../../../utils/index.ts'
import { safeError, safeResult } from '../../../../utils/safe.ts'
import type { VM } from '../../../../vm/index.ts'
import type { ExecutionNode } from '../../../node/index.ts'
import { getBlockByOption } from '../../helpers.ts'
import { createRpcMethod } from '../../validation.ts'
import { getBalanceSchema } from './schema.ts'

export const getBalance = (node: ExecutionNode) => {
  const chain = node.chain
  const vm: VM | undefined = node.execution?.vm
  return createRpcMethod(
    getBalanceSchema,
    async (params: [string, string], _c) => {
      const [addressHex, blockOpt] = params
      const address = createAddressFromString(addressHex)
      const block = await getBlockByOption(blockOpt, chain)

      if (vm === undefined) {
        return safeError(EthereumJSErrorWithoutCode('missing vm'))
      }

      const vmCopy = await vm.shallowCopy()
      await vmCopy.stateManager.setStateRoot(block.header.stateRoot)
      const account = await vmCopy.stateManager.getAccount(address)
      if (account === undefined) {
        return safeResult('0x0')
      }
      return safeResult(bigIntToHex(account.balance))
    },
  )
}
