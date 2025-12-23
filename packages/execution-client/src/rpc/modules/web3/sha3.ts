import { keccak256 } from 'ethereum-cryptography/keccak.js'
import type { PrefixedHexString } from '../../../../utils/index'
import { bytesToHex, hexToBytes } from '../../../../utils/index'
import { safeResult } from '../../../../utils/safe'
import type { ExecutionNode } from '../../../node/index'
import { createRpcMethod } from '../../validation'
import { sha3Schema } from './schema'

export const sha3 = (_node: ExecutionNode) =>
  createRpcMethod(sha3Schema, async (params: [PrefixedHexString], _c) => {
    const hexEncodedDigest = bytesToHex(keccak256(hexToBytes(params[0])))
    return safeResult(hexEncodedDigest)
  })
