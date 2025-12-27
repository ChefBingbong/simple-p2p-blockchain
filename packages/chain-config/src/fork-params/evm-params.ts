import { EIP } from './enums'
import type { ParamsDict } from '../types'

export const paramsEVM: ParamsDict = {
  /**
   * Frontier/Chainstart
   */
  [EIP.EIP_1]: {
    // gasConfig
    maxRefundQuotient: 2n, // Maximum refund quotient; max tx refund is min(tx.gasUsed/maxRefundQuotient, tx.gasRefund)
    // gasPrices
    basefeeGas: 2n, // Gas base cost, used e.g. for ChainID opcode (Istanbul)
    expGas: 10n, // Base fee of the EXP opcode
    expByteGas: 10n, // Times ceil(log256(exponent)) for the EXP instruction
    keccak256Gas: 30n, // Base fee of the SHA3 opcode
    keccak256WordGas: 6n, // Once per word of the SHA3 operation's data
    sloadGas: 50n, // Base fee of the SLOAD opcode
    sstoreSetGas: 20000n, // Once per SSTORE operation if the zeroness changes from zero
    sstoreResetGas: 5000n, // Once per SSTORE operation if the zeroness does not change from zero
    sstoreRefundGas: 15000n, // Once per SSTORE operation if the zeroness changes to zero
    jumpdestGas: 1n, // Base fee of the JUMPDEST opcode
    logGas: 375n, // Base fee of the LOG opcode
    logDataGas: 8n, // Per byte in a LOG* operation's data
    logTopicGas: 375n, // Multiplied by the * of the LOG*, per LOG transaction. e.g. LOG0 incurs 0 * c_txLogTopicGas, LOG4 incurs 4 * c_txLogTopicGas
    createGas: 32000n, // Base fee of the CREATE opcode
    callGas: 40n, // Base fee of the CALL opcode
    callStipendGas: 2300n, // Free gas given at beginning of call
    callValueTransferGas: 9000n, // Paid for CALL when the value transfer is non-zero
    callNewAccountGas: 25000n, // Paid for CALL when the destination address didn't exist prior
    selfdestructRefundGas: 24000n, // Refunded following a selfdestruct operation
    memoryGas: 3n, // Times the address of the (highest referenced byte in memory + 1). NOTE: referencing happens on read, write and in instructions such as RETURN and CALL
    quadCoefficientDivGas: 512n, // Divisor for the quadratic particle of the memory cost equation
    createDataGas: 200n, //
    copyGas: 3n, // Multiplied by the number of 32-byte words that are copied (round up) for any *COPY operation and added
    ecRecoverGas: 3000n,
    sha256Gas: 60n,
    sha256WordGas: 12n,
    ripemd160Gas: 600n,
    ripemd160WordGas: 120n,
    identityGas: 15n,
    identityWordGas: 3n,
    stopGas: 0n, // Base fee of the STOP opcode
    addGas: 3n, // Base fee of the ADD opcode
    mulGas: 5n, // Base fee of the MUL opcode
    subGas: 3n, // Base fee of the SUB opcode
    divGas: 5n, // Base fee of the DIV opcode
    sdivGas: 5n, // Base fee of the SDIV opcode
    modGas: 5n, // Base fee of the MOD opcode
    smodGas: 5n, // Base fee of the SMOD opcode
    addmodGas: 8n, // Base fee of the ADDMOD opcode
    mulmodGas: 8n, // Base fee of the MULMOD opcode
    signextendGas: 5n, // Base fee of the SIGNEXTEND opcode
    ltGas: 3n, // Base fee of the LT opcode
    gtGas: 3n, // Base fee of the GT opcode
    sltGas: 3n, // Base fee of the SLT opcode
    sgtGas: 3n, // Base fee of the SGT opcode
    eqGas: 3n, // Base fee of the EQ opcode
    iszeroGas: 3n, // Base fee of the ISZERO opcode
    andGas: 3n, // Base fee of the AND opcode
    orGas: 3n, // Base fee of the OR opcode
    xorGas: 3n, // Base fee of the XOR opcode
    notGas: 3n, // Base fee of the NOT opcode
    byteGas: 3n, // Base fee of the BYTE opcode
    addressGas: 2n, // Base fee of the ADDRESS opcode
    balanceGas: 20n, // Base fee of the BALANCE opcode
    originGas: 2n, // Base fee of the ORIGIN opcode
    callerGas: 2n, // Base fee of the CALLER opcode
    callvalueGas: 2n, // Base fee of the CALLVALUE opcode
    calldataloadGas: 3n, // Base fee of the CALLDATALOAD opcode
    calldatasizeGas: 2n, // Base fee of the CALLDATASIZE opcode
    calldatacopyGas: 3n, // Base fee of the CALLDATACOPY opcode
    codesizeGas: 2n, // Base fee of the CODESIZE opcode
    codecopyGas: 3n, // Base fee of the CODECOPY opcode
    gaspriceGas: 2n, // Base fee of the GASPRICE opcode
    extcodesizeGas: 20n, // Base fee of the EXTCODESIZE opcode
    extcodecopyGas: 20n, // Base fee of the EXTCODECOPY opcode
    blockhashGas: 20n, // Base fee of the BLOCKHASH opcode
    coinbaseGas: 2n, // Base fee of the COINBASE opcode
    timestampGas: 2n, // Base fee of the TIMESTAMP opcode
    numberGas: 2n, // Base fee of the NUMBER opcode
    difficultyGas: 2n, // Base fee of the DIFFICULTY opcode
    gaslimitGas: 2n, // Base fee of the GASLIMIT opcode
    popGas: 2n, // Base fee of the POP opcode
    mloadGas: 3n, // Base fee of the MLOAD opcode
    mstoreGas: 3n, // Base fee of the MSTORE opcode
    mstore8Gas: 3n, // Base fee of the MSTORE8 opcode
    sstoreGas: 0n, // Base fee of the SSTORE opcode
    jumpGas: 8n, // Base fee of the JUMP opcode
    jumpiGas: 10n, // Base fee of the JUMPI opcode
    pcGas: 2n, // Base fee of the PC opcode
    msizeGas: 2n, // Base fee of the MSIZE opcode
    gasGas: 2n, // Base fee of the GAS opcode
    pushGas: 3n, // Base fee of the PUSH opcode
    dupGas: 3n, // Base fee of the DUP opcode
    swapGas: 3n, // Base fee of the SWAP opcode
    callcodeGas: 40n, // Base fee of the CALLCODE opcode
    returnGas: 0n, // Base fee of the RETURN opcode
    invalidGas: 0n, // Base fee of the INVALID opcode
    selfdestructGas: 0n, // Base fee of the SELFDESTRUCT opcode
    prevrandaoGas: 0n, // TODO: these below 0-gas additions might also point to non-clean implementations in the code base
    // evm
    stackLimit: 1024, // Maximum size of VM stack allowed (stays number - used with Number() cast)
  },
  /**
.  * Homestead HF Meta EIP
.  */
  [EIP.EIP_606]: {
    // gasPrices
    delegatecallGas: 40n, // Base fee of the DELEGATECALL opcode
  },
  /**
.  * TangerineWhistle HF Meta EIP
.  */
  [EIP.EIP_608]: {
    // gasPrices
    sloadGas: 200n, // Once per SLOAD operation
    callGas: 700n, // Once per CALL operation & message call transaction
    extcodesizeGas: 700n, // Base fee of the EXTCODESIZE opcode
    extcodecopyGas: 700n, // Base fee of the EXTCODECOPY opcode
    balanceGas: 400n, // Base fee of the BALANCE opcode
    delegatecallGas: 700n, // Base fee of the DELEGATECALL opcode
    callcodeGas: 700n, // Base fee of the CALLCODE opcode
    selfdestructGas: 5000n, // Base fee of the SELFDESTRUCT opcode
  },
  /**
.  * Spurious Dragon HF Meta EIP
.  */
  [EIP.EIP_607]: {
    // gasPrices
    expByteGas: 50n, // Times ceil(log256(exponent)) for the EXP instruction
    // evm
    maxCodeSize: 24576, // Maximum length of contract code (stays number - used with Number() cast)
  },
  /**
.  * Byzantium HF Meta EIP
.  */
  [EIP.EIP_609]: {
    // gasPrices
    modexpGquaddivisorGas: 20n, // Gquaddivisor from modexp precompile for gas calculation
    bn254AddGas: 500n, // Gas costs for curve addition precompile
    bn254MulGas: 40000n, // Gas costs for curve multiplication precompile
    bn254PairingGas: 100000n, // Base gas costs for curve pairing precompile
    bn254PairingWordGas: 80000n, // Gas costs regarding curve pairing precompile input length
    revertGas: 0n, // Base fee of the REVERT opcode
    staticcallGas: 700n, // Base fee of the STATICCALL opcode
    returndatasizeGas: 2n, // Base fee of the RETURNDATASIZE opcode
    returndatacopyGas: 3n, // Base fee of the RETURNDATACOPY opcode
  },
  /**
.  * Constantinople HF Meta EIP
.  */
  [EIP.EIP_1013]: {
    // gasPrices
    netSstoreNoopGas: 200n, // Once per SSTORE operation if the value doesn't change
    netSstoreInitGas: 20000n, // Once per SSTORE operation from clean zero
    netSstoreCleanGas: 5000n, // Once per SSTORE operation from clean non-zero
    netSstoreDirtyGas: 200n, // Once per SSTORE operation from dirty
    netSstoreClearRefundGas: 15000n, // Once per SSTORE operation for clearing an originally existing storage slot
    netSstoreResetRefundGas: 4800n, // Once per SSTORE operation for resetting to the original non-zero value
    netSstoreResetClearRefundGas: 19800n, // Once per SSTORE operation for resetting to the original zero value
    shlGas: 3n, // Base fee of the SHL opcode
    shrGas: 3n, // Base fee of the SHR opcode
    sarGas: 3n, // Base fee of the SAR opcode
    extcodehashGas: 400n, // Base fee of the EXTCODEHASH opcode
    create2Gas: 32000n, // Base fee of the CREATE2 opcode
  },
  /**
.  * Petersburg HF Meta EIP
.  */
  [EIP.EIP_1716]: {
    // gasPrices
    netSstoreNoopGas: null, // Removed along EIP-1283
    netSstoreInitGas: null, // Removed along EIP-1283
    netSstoreCleanGas: null, // Removed along EIP-1283
    netSstoreDirtyGas: null, // Removed along EIP-1283
    netSstoreClearRefundGas: null, // Removed along EIP-1283
    netSstoreResetRefundGas: null, // Removed along EIP-1283
    netSstoreResetClearRefundGas: null, // Removed along EIP-1283
  },
  /**
.  * Istanbul HF Meta EIP
.  */
  [EIP.EIP_1679]: {
    // gasPrices
    blake2RoundGas: 1n, // Gas cost per round for the Blake2 F precompile
    bn254AddGas: 150n, // Gas costs for curve addition precompile
    bn254MulGas: 6000n, // Gas costs for curve multiplication precompile
    bn254PairingGas: 45000n, // Base gas costs for curve pairing precompile
    bn254PairingWordGas: 34000n, // Gas costs regarding curve pairing precompile input length
    sstoreSentryEIP2200Gas: 2300n, // Minimum gas required to be present for an SSTORE call, not consumed
    sstoreNoopEIP2200Gas: 800n, // Once per SSTORE operation if the value doesn't change
    sstoreDirtyEIP2200Gas: 800n, // Once per SSTORE operation if a dirty value is changed
    sstoreInitEIP2200Gas: 20000n, // Once per SSTORE operation from clean zero to non-zero
    sstoreInitRefundEIP2200Gas: 19200n, // Once per SSTORE operation for resetting to the original zero value
    sstoreCleanEIP2200Gas: 5000n, // Once per SSTORE operation from clean non-zero to something else
    sstoreCleanRefundEIP2200Gas: 4200n, // Once per SSTORE operation for resetting to the original non-zero value
    sstoreClearRefundEIP2200Gas: 15000n, // Once per SSTORE operation for clearing an originally existing storage slot
    balanceGas: 700n, // Base fee of the BALANCE opcode
    extcodehashGas: 700n, // Base fee of the EXTCODEHASH opcode
    chainidGas: 2n, // Base fee of the CHAINID opcode
    selfbalanceGas: 5n, // Base fee of the SELFBALANCE opcode
    sloadGas: 800n, // Base fee of the SLOAD opcode
  },

  /**
.  * SWAPN, DUPN and EXCHANGE instructions
.  */
  [EIP.EIP_663]: {
    // gasPrices
    dupnGas: 3n, // Base fee of the DUPN opcode
    swapnGas: 3n, // Base fee of the SWAPN opcode
    exchangeGas: 3n, // Base fee of the EXCHANGE opcode
  },
  /**
.  * Transient storage opcodes
.  */
  [EIP.EIP_1153]: {
    // gasPrices
    tstoreGas: 100n, // Base fee of the TSTORE opcode
    tloadGas: 100n, // Base fee of the TLOAD opcode
  },
  [EIP.EIP_1559]: {
    elasticityMultiplier: 2n, // Maximum block gas target elasticity
  },
  /**
.  * ModExp gas cost
.  */
  [EIP.EIP_2565]: {
    // gasPrices
    modexpGquaddivisorGas: 3n, // Gquaddivisor from modexp precompile for gas calculation
  },
  /**
   * BLS12-381 precompiles
   */
  [EIP.EIP_2537]: {
    // gasPrices
    bls12381G1AddGas: 375n, // Gas cost of a single BLS12-381 G1 addition precompile-call
    bls12381G1MulGas: 12000n, // Gas cost of a single BLS12-381 G1 multiplication precompile-call
    bls12381G2AddGas: 600n, // Gas cost of a single BLS12-381 G2 addition precompile-call
    bls12381G2MulGas: 22500n, // Gas cost of a single BLS12-381 G2 multiplication precompile-call
    bls12381PairingBaseGas: 37700n, // Base gas cost of BLS12-381 pairing check
    bls12381PairingPerPairGas: 32600n, // Per-pair gas cost of BLS12-381 pairing check
    bls12381MapG1Gas: 5500n, // Gas cost of BLS12-381 map field element to G1
    bls12381MapG2Gas: 23800n, // Gas cost of BLS12-381 map field element to G2
  },
  /**
.  * Gas cost increases for state access opcodes
.  */
  [EIP.EIP_2929]: {
    // gasPrices
    coldsloadGas: 2100n, // Gas cost of the first read of storage from a given location (per transaction)
    coldaccountaccessGas: 2600n, // Gas cost of the first read of a given address (per transaction)
    warmstoragereadGas: 100n, // Gas cost of reading storage locations which have already loaded 'cold'
    sstoreCleanEIP2200Gas: 2900n, // Once per SSTORE operation from clean non-zero to something else
    sstoreNoopEIP2200Gas: 100n, // Once per SSTORE operation if the value doesn't change
    sstoreDirtyEIP2200Gas: 100n, // Once per SSTORE operation if a dirty value is changed
    sstoreInitRefundEIP2200Gas: 19900n, // Once per SSTORE operation for resetting to the original zero value
    sstoreCleanRefundEIP2200Gas: 4900n, // Once per SSTORE operation for resetting to the original non-zero value
    callGas: 0n, // Base fee of the CALL opcode
    callcodeGas: 0n, // Base fee of the CALLCODE opcode
    delegatecallGas: 0n, // Base fee of the DELEGATECALL opcode
    staticcallGas: 0n, // Base fee of the STATICCALL opcode
    balanceGas: 0n, // Base fee of the BALANCE opcode
    extcodesizeGas: 0n, // Base fee of the EXTCODESIZE opcode
    extcodecopyGas: 0n, // Base fee of the EXTCODECOPY opcode
    extcodehashGas: 0n, // Base fee of the EXTCODEHASH opcode
    sloadGas: 0n, // Base fee of the SLOAD opcode
    sstoreGas: 0n, // Base fee of the SSTORE opcode
  },
  /**
   * Save historical block hashes in state (Verkle related usage, UNSTABLE)
   */
  [EIP.EIP_2935]: {
    // evm
    historyStorageAddress: 0x0000F90827F1C53A10CB7A02335B175320002935n, // The address where the historical blockhashes are stored
    historyServeWindow: 8192n, // The amount of blocks to be served by the historical blockhash contract
    systemAddress: 0xfffffffffffffffffffffffffffffffffffffffen, // The system address
  },
  /**
.  * BASEFEE opcode
.  */
  [EIP.EIP_3198]: {
    // gasPrices
    basefeeGas: 2n, // Gas cost of the BASEFEE opcode
  },
  /**
.  * Reduction in refunds
.  */
  [EIP.EIP_3529]: {
    // gasConfig
    maxRefundQuotient: 5n, // Maximum refund quotient; max tx refund is min(tx.gasUsed/maxRefundQuotient, tx.gasRefund)
    // gasPrices
    selfdestructRefundGas: 0n, // Refunded following a selfdestruct operation
    sstoreClearRefundEIP2200Gas: 4800n, // Once per SSTORE operation for clearing an originally existing storage slot
  },
  /**
.  * PUSH0 instruction
.  */
  [EIP.EIP_3855]: {
    // gasPrices
    push0Gas: 2n, // Base fee of the PUSH0 opcode
  },
  /**
.  * Limit and meter initcode
.  */
  [EIP.EIP_3860]: {
    // gasPrices
    initCodeWordGas: 2n, // Gas to pay for each word (32 bytes) of initcode when creating a contract
    // vm
    maxInitCodeSize: 49152, // Maximum length of initialization code when creating a contract (stays number - used with Number() cast)
  },
  /**
   * EOF - Static relative jumps
   */
  [EIP.EIP_4200]: {
    // gasPrices
    rjumpGas: 2n, // Base fee of the RJUMP opcode
    rjumpiGas: 4n, // Base fee of the RJUMPI opcode
    rjumpvGas: 4n, // Base fee of the RJUMPV opcode
  },
  /**
.  * Supplant DIFFICULTY opcode with PREVRANDAO
.  */
  [EIP.EIP_4399]: {
    // gasPrices
    prevrandaoGas: 2n, // Base fee of the PREVRANDAO opcode (previously DIFFICULTY)
  },
  /**
   * EOF - Functions
   */
  [EIP.EIP_4750]: {
    // gasPrices
    callfGas: 5n, // Base fee of the CALLF opcode
    retfGas: 3n, // Base fee of the RETF opcode
  },
  /**
.  * Shard Blob Transactions
.  */
  [EIP.EIP_4844]: {
    kzgPointEvaluationPrecompileGas: 50000n, // The fee associated with the point evaluation precompile
    blobhashGas: 3n, // Base fee of the BLOBHASH opcode
    // sharding
    blobCommitmentVersionKzg: 1, // The number indicated a versioned hash is a KZG commitment (stays number)
    fieldElementsPerBlob: 4096, // The number of field elements allowed per blob (stays number)
  },
  /**
   * MCOPY - Memory copying instruction
   */
  [EIP.EIP_5656]: {
    // gasPrices
    mcopyGas: 3n, // Base fee of the MCOPY opcode
  },
  /**
   * EOF - JUMPF and non-returning functions
   */
  [EIP.EIP_6206]: {
    // gasPrices
    jumpfGas: 5n, // Base fee of the JUMPF opcode
  },
  /**
.  * Revamped CALL instructions
.  */
  [EIP.EIP_7069]: {
    /* Note: per EIP these are the additionally required EIPs:
    EIP 150 - This is the entire Tangerine Whistle hardfork
    EIP 211 - (RETURNDATASIZE / RETURNDATACOPY) - Included in Byzantium
    EIP 214 - (STATICCALL) - Included in Byzantium
  */
    // gasPrices
    extcallGas: 0n, // Base fee of the EXTCALL opcode
    extdelegatecallGas: 0n, // Base fee of the EXTDELEGATECALL opcode
    extstaticcallGas: 0n, // Base fee of the EXTSTATICCALL opcode
    returndataloadGas: 3n, // Base fee of the RETURNDATALOAD opcode
    minRetainedGas: 5000n, // Minimum gas retained prior to executing an EXT*CALL opcode (this is the minimum gas available after performing the EXT*CALL)
    minCalleeGas: 2300n, //Minimum gas available to the the address called by an EXT*CALL opcode
  },
  /**
   * EOF - Data section access instructions
   */
  [EIP.EIP_7480]: {
    // gasPrices
    dataloadGas: 4n, // Base fee of the DATALOAD opcode
    dataloadnGas: 3n, // Base fee of the DATALOADN opcode
    datasizeGas: 2n, // Base fee of the DATASIZE opcode
    datacopyGas: 3n, // Base fee of the DATACOPY opcode
  },
  /**
.  * BLOBBASEFEE opcode
.  */
  [EIP.EIP_7516]: {
    // gasPrices
    blobbasefeeGas: 2n, // Gas cost of the BLOBBASEFEE opcode
  },
  /**
.  * EOF Contract Creation
.  */
  [EIP.EIP_7620]: {
    /* Note: per EIP these are the additionally required EIPs:
    EIP 170 - (Max contract size) - Included in Spurious Dragon
  */
    // gasPrices
    eofcreateGas: 32000n, // Base fee of the EOFCREATE opcode (Same as CREATE/CREATE2)
    returncontractGas: 0n, // Base fee of the RETURNCONTRACT opcode
  },
  /**
.  * Count leading zeros (CLZ) opcode
.  */
  [EIP.EIP_7939]: {
    // gasPrices
    clzGas: 5n, // Base fee of the CLZ opcode (matching MUL as per EIP-7939)
  },
}
