import {
  BIGINT_0,
  BIGINT_1,
  BIGINT_32,
  bigIntToBytes,
  setLengthLeft,
} from '../../utils'

import { EVMError } from '../errors.ts'

import {
  createAddressFromStackBigInt,
  divCeil,
  setLengthLeftStorage,
  subMemUsage,
  trap,
  updateSstoreGas,
} from './util.ts'

import type { Common } from '../../chain-config'
import type { RunState } from '../interpreter.ts'

/**
 * This file returns the dynamic parts of opcodes which have dynamic gas
 * Simplified for Frontier - no EIP-specific gas calculations
 */

export interface AsyncDynamicGasHandler {
  (runState: RunState, gas: bigint, common: Common): Promise<bigint>
}

export interface SyncDynamicGasHandler {
  (runState: RunState, gas: bigint, common: Common): bigint
}

export const dynamicGasHandlers: Map<number, AsyncDynamicGasHandler | SyncDynamicGasHandler> =
  new Map<number, AsyncDynamicGasHandler>([
    [
      /* EXP */
      0x0a,
      async function (runState, gas, common): Promise<bigint> {
        const [_base, exponent] = runState.stack.peek(2)
        if (exponent === BIGINT_0) {
          return gas
        }
        let byteLength = exponent.toString(2).length / 8
        if (byteLength > Math.trunc(byteLength)) {
          byteLength = Math.trunc(byteLength) + 1
        }
        if (byteLength < 1 || byteLength > 32) {
          trap(EVMError.errorMessages.OUT_OF_RANGE)
        }
        const expPricePerByte = common.param('expByteGas')
        gas += BigInt(byteLength) * expPricePerByte
        return gas
      },
    ],
    [
      /* KECCAK256 */
      0x20,
      async function (runState, gas, common): Promise<bigint> {
        const [offset, length] = runState.stack.peek(2)
        gas += subMemUsage(runState, offset, length, common)
        gas += common.param('keccak256WordGas') * divCeil(length, BIGINT_32)
        return gas
      },
    ],
    [
      /* BALANCE */
      0x31,
      async function (runState, gas, _common): Promise<bigint> {
        // Frontier: simple static gas (base fee only)
        return gas
      },
    ],
    [
      /* CALLDATACOPY */
      0x37,
      async function (runState, gas, common): Promise<bigint> {
        const [memOffset, _dataOffset, dataLength] = runState.stack.peek(3)

        gas += subMemUsage(runState, memOffset, dataLength, common)
        if (dataLength !== BIGINT_0) {
          gas += common.param('copyGas') * divCeil(dataLength, BIGINT_32)
        }
        return gas
      },
    ],
    [
      /* CODECOPY */
      0x39,
      async function (runState, gas, common): Promise<bigint> {
        const [memOffset, _codeOffset, dataLength] = runState.stack.peek(3)

        gas += subMemUsage(runState, memOffset, dataLength, common)
        if (dataLength !== BIGINT_0) {
          gas += common.param('copyGas') * divCeil(dataLength, BIGINT_32)
        }
        return gas
      },
    ],
    [
      /* EXTCODESIZE */
      0x3b,
      async function (runState, gas, _common): Promise<bigint> {
        // Frontier: simple static gas (base fee only)
        return gas
      },
    ],
    [
      /* EXTCODECOPY */
      0x3c,
      async function (runState, gas, common): Promise<bigint> {
        const [_addressBigInt, memOffset, _codeOffset, dataLength] = runState.stack.peek(4)

        gas += subMemUsage(runState, memOffset, dataLength, common)

        if (dataLength !== BIGINT_0) {
          gas += common.param('copyGas') * divCeil(dataLength, BIGINT_32)
        }
        return gas
      },
    ],
    [
      /* MLOAD */
      0x51,
      async function (runState, gas, common): Promise<bigint> {
        const pos = runState.stack.peek()[0]
        gas += subMemUsage(runState, pos, BIGINT_32, common)
        return gas
      },
    ],
    [
      /* MSTORE */
      0x52,
      async function (runState, gas, common): Promise<bigint> {
        const offset = runState.stack.peek()[0]
        gas += subMemUsage(runState, offset, BIGINT_32, common)
        return gas
      },
    ],
    [
      /* MSTORE8 */
      0x53,
      async function (runState, gas, common): Promise<bigint> {
        const offset = runState.stack.peek()[0]
        gas += subMemUsage(runState, offset, BIGINT_1, common)
        return gas
      },
    ],
    [
      /* SLOAD */
      0x54,
      async function (runState, gas, _common): Promise<bigint> {
        // Frontier: simple static gas (base fee only)
        return gas
      },
    ],
    [
      /* SSTORE */
      0x55,
      async function (runState, gas, common): Promise<bigint> {
        if (runState.interpreter.isStatic()) {
          trap(EVMError.errorMessages.STATIC_STATE_CHANGE)
        }
        const [key, val] = runState.stack.peek(2)

        const keyBytes = setLengthLeft(bigIntToBytes(key), 32)
        let value
        if (val === BIGINT_0) {
          value = Uint8Array.from([])
        } else {
          value = bigIntToBytes(val)
        }

        const currentStorage = setLengthLeftStorage(
          await runState.interpreter.storageLoad(keyBytes),
        )

        // Frontier SSTORE gas - simple model
        gas += updateSstoreGas(runState, currentStorage, setLengthLeftStorage(value), common)

        return gas
      },
    ],
    [
      /* LOG */
      0xa0,
      async function (runState, gas, common): Promise<bigint> {
        if (runState.interpreter.isStatic()) {
          trap(EVMError.errorMessages.STATIC_STATE_CHANGE)
        }

        const [memOffset, memLength] = runState.stack.peek(2)

        const topicsCount = runState.opCode - 0xa0

        if (topicsCount < 0 || topicsCount > 4) {
          trap(EVMError.errorMessages.OUT_OF_RANGE)
        }

        gas += subMemUsage(runState, memOffset, memLength, common)
        gas +=
          common.param('logTopicGas') * BigInt(topicsCount) + memLength * common.param('logDataGas')
        return gas
      },
    ],
    [
      /* CREATE */
      0xf0,
      async function (runState, gas, common): Promise<bigint> {
        if (runState.interpreter.isStatic()) {
          trap(EVMError.errorMessages.STATIC_STATE_CHANGE)
        }
        const [_value, offset, length] = runState.stack.peek(3)

        gas += subMemUsage(runState, offset, length, common)

        // Frontier: gas limit is remaining gas minus current gas
        let gasLimit = BigInt(runState.interpreter.getGasLeft()) - gas
        runState.messageGasLimit = gasLimit
        return gas
      },
    ],
    [
      /* CALL */
      0xf1,
      async function (runState, gas, common): Promise<bigint> {
        const [currentGasLimit, toAddr, value, inOffset, inLength, outOffset, outLength] =
          runState.stack.peek(7)
        const toAddress = createAddressFromStackBigInt(toAddr)

        if (runState.interpreter.isStatic() && value !== BIGINT_0) {
          trap(EVMError.errorMessages.STATIC_STATE_CHANGE)
        }
        gas += subMemUsage(runState, inOffset, inLength, common)
        gas += subMemUsage(runState, outOffset, outLength, common)

        if (value !== BIGINT_0) {
          gas += common.param('callValueTransferGas')
        }

        // Frontier: check if account exists
        if ((await runState.stateManager.getAccount(toAddress)) === undefined) {
          gas += common.param('callNewAccountGas')
        }

        // Frontier: gas limit calculation
        const gasLimit = currentGasLimit
        if (gasLimit > runState.interpreter.getGasLeft() - gas) {
          trap(EVMError.errorMessages.OUT_OF_GAS)
        }

        if (gas > runState.interpreter.getGasLeft()) {
          trap(EVMError.errorMessages.OUT_OF_GAS)
        }

        runState.messageGasLimit = gasLimit
        return gas
      },
    ],
    [
      /* CALLCODE */
      0xf2,
      async function (runState, gas, common): Promise<bigint> {
        const [currentGasLimit, _toAddr, value, inOffset, inLength, outOffset, outLength] =
          runState.stack.peek(7)

        gas += subMemUsage(runState, inOffset, inLength, common)
        gas += subMemUsage(runState, outOffset, outLength, common)

        if (value !== BIGINT_0) {
          gas += common.param('callValueTransferGas')
        }

        // Frontier: gas limit calculation
        const gasLimit = currentGasLimit
        if (gasLimit > runState.interpreter.getGasLeft() - gas) {
          trap(EVMError.errorMessages.OUT_OF_GAS)
        }

        runState.messageGasLimit = gasLimit
        return gas
      },
    ],
    [
      /* RETURN */
      0xf3,
      async function (runState, gas, common): Promise<bigint> {
        const [offset, length] = runState.stack.peek(2)
        gas += subMemUsage(runState, offset, length, common)
        return gas
      },
    ],
    [
      /* SELFDESTRUCT */
      0xff,
      async function (runState, gas, common): Promise<bigint> {
        if (runState.interpreter.isStatic()) {
          trap(EVMError.errorMessages.STATIC_STATE_CHANGE)
        }
        const selfdestructToaddressBigInt = runState.stack.peek()[0]
        const selfdestructToAddress = createAddressFromStackBigInt(selfdestructToaddressBigInt)

        // Frontier: check if account exists, charge new account gas if not
        if ((await runState.stateManager.getAccount(selfdestructToAddress)) === undefined) {
          gas += common.param('callNewAccountGas')
        }

        return gas
      },
    ],
  ])

// Set the range [0xa0, 0xa4] to the LOG handler
const logDynamicFunc = dynamicGasHandlers.get(0xa0)!
for (let i = 0xa1; i <= 0xa4; i++) {
  dynamicGasHandlers.set(i, logDynamicFunc)
}
