import type { ParamsDict } from '../types'
import { EIP } from './enums'

export const paramsNetwork: ParamsDict = {
  /**
   * Frontier/Chainstart
   */
  [EIP.EIP_1]: {
    // gasConfig
    maxRefundQuotient: 2n, // Maximum refund quotient; max tx refund is min(tx.gasUsed/maxRefundQuotient, tx.gasRefund)
    blobGasPerBlob: 0n,
    maxBlobGasPerBlock: 0n,
    targetBlobGasPerBlock: 0n,
    // pow
    minerReward: 5000000000000000000n, // the amount a miner get rewarded for mining a block
  },
  /**
.  * Byzantium HF Meta EIP
.  */
  [EIP.EIP_609]: {
    // pow
    minerReward: 3000000000000000000n, // the amount a miner get rewarded for mining a block
  },
  /**
.  * Constantinople HF Meta EIP
.  */
  [EIP.EIP_1013]: {
    // pow
    minerReward: 2000000000000000000n, // The amount a miner gets rewarded for mining a block
  },
  /**
.  * Fee market change for ETH 1.0 chain
.  */
  [EIP.EIP_1559]: {
    // gasConfig
    elasticityMultiplier: 2n, // Maximum block gas target elasticity
    initialBaseFee: 1000000000n, // Initial base fee on first EIP1559 block
  },
  /**
   * Save historical block hashes in state (Verkle related usage, UNSTABLE)
   */
  [EIP.EIP_2935]: {
    // config
    historyStorageAddress: 0x0000f90827f1c53a10cb7a02335b175320002935n, // The address where the historical blockhashes are stored
    historyServeWindow: 8191n, // The amount of blocks to be served by the historical blockhash contract
    systemAddress: 0xfffffffffffffffffffffffffffffffffffffffen, // The system address
  },
  /**
.  * Reduction in refunds
.  */
  [EIP.EIP_3529]: {
    // gasConfig
    maxRefundQuotient: 5n, // Maximum refund quotient; max tx refund is min(tx.gasUsed/maxRefundQuotient, tx.gasRefund)
  },
  /**
.  * Shard Blob Transactions
.  */
  [EIP.EIP_4844]: {
    // gasConfig
    targetBlobGasPerBlock: 393216n, // The target blob gas consumed per block
    blobGasPerBlob: 131072n, // The base fee for blob gas per blob
    maxBlobGasPerBlock: 786432n, // The max blob gas allowable per block
    blobGasPriceUpdateFraction: 3338477n, // The denominator used in the exponential when calculating a blob gas price
    // gasPrices
    minBlobGas: 1n, // The minimum fee per blob gas
  },
  /**
.  * Beacon block root in the EVM
.  */
  [EIP.EIP_4788]: {
    // config
    historicalRootsLength: 8191n, // The modulo parameter of the beaconroot ring buffer in the beaconroot stateful precompile
  },
  /**
   * Execution layer triggerable withdrawals (experimental)
   */
  [EIP.EIP_7002]: {
    // config
    systemAddress: 0xfffffffffffffffffffffffffffffffffffffffen, // The system address to perform operations on the withdrawal requests predeploy address
    // See: https://github.com/ethereum/EIPs/pull/8934/files
    withdrawalRequestPredeployAddress:
      0x00000961ef480eb55e80d19ad83579a64c007002n, // Address of the validator excess address
  },

  /**
   * Increase the MAX_EFFECTIVE_BALANCE -> Execution layer triggered consolidations (experimental)
   */
  [EIP.EIP_7251]: {
    // config
    systemAddress: 0xfffffffffffffffffffffffffffffffffffffffen, // The system address to perform operations on the consolidation requests predeploy address
    // See: https://github.com/ethereum/EIPs/pull/8934/files
    consolidationRequestPredeployAddress:
      0x0000bbddc7ce488642fb579f8b00f3a590007251n, // Address of the consolidations contract
  },
  /**
.  * Shard Blob Transactions
.  */
  [EIP.EIP_7691]: {
    // gasConfig
    targetBlobGasPerBlock: 786432n, // The target blob gas consumed per block
    maxBlobGasPerBlock: 1179648n, // The max blob gas allowable per block
    blobGasPriceUpdateFraction: 5007716n, // The denominator used in the exponential when calculating a blob gas price
  },
}
