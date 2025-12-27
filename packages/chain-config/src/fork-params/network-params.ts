import { EIP } from '../enums'
import type { ParamsDict } from '../types'

export const paramsNetwork: ParamsDict = {
  /**
   * Frontier/Chainstart
   */
  [EIP.EIP_1]: {
    // gasConfig
    maxRefundQuotient: 2, // Maximum refund quotient; max tx refund is min(tx.gasUsed/maxRefundQuotient, tx.gasRefund)
    blobGasPerBlob: 0,
    maxBlobGasPerBlock: 0,
    targetBlobGasPerBlock: 0,
    // pow
    minerReward: '5000000000000000000', // the amount a miner get rewarded for mining a block
  },
  /**
.  * Byzantium HF Meta EIP
.  */
  [EIP.EIP_609]: {
    // pow
    minerReward: '3000000000000000000', // the amount a miner get rewarded for mining a block
  },
  /**
.  * Constantinople HF Meta EIP
.  */
  [EIP.EIP_1013]: {
    // pow
    minerReward: '2000000000000000000', // The amount a miner gets rewarded for mining a block
  },
  /**
.  * Fee market change for ETH 1.0 chain
.  */
  [EIP.EIP_1559]: {
    // gasConfig
    elasticityMultiplier: 2, // Maximum block gas target elasticity
    initialBaseFee: 1000000000, // Initial base fee on first EIP1559 block
  },
  /**
   * Save historical block hashes in state (Verkle related usage, UNSTABLE)
   */
  [EIP.EIP_2935]: {
    // config
    historyStorageAddress: '0x0000F90827F1C53A10CB7A02335B175320002935', // The address where the historical blockhashes are stored
    historyServeWindow: 8191, // The amount of blocks to be served by the historical blockhash contract
    systemAddress: '0xfffffffffffffffffffffffffffffffffffffffe', // The system address
  },
  /**
.  * Reduction in refunds
.  */
  [EIP.EIP_3529]: {
    // gasConfig
    maxRefundQuotient: 5, // Maximum refund quotient; max tx refund is min(tx.gasUsed/maxRefundQuotient, tx.gasRefund)
  },
  /**
.  * Shard Blob Transactions
.  */
  [EIP.EIP_4844]: {
    // gasConfig
    targetBlobGasPerBlock: 393216, // The target blob gas consumed per block
    blobGasPerBlob: 131072, // The base fee for blob gas per blob
    maxBlobGasPerBlock: 786432, // The max blob gas allowable per block
    blobGasPriceUpdateFraction: 3338477, // The denominator used in the exponential when calculating a blob gas price
    // gasPrices
    minBlobGas: 1, // The minimum fee per blob gas
  },
  /**
.  * Beacon block root in the EVM
.  */
  [EIP.EIP_4788]: {
    // config
    historicalRootsLength: 8191, // The modulo parameter of the beaconroot ring buffer in the beaconroot stateful precompile
  },
  /**
   * Execution layer triggerable withdrawals (experimental)
   */
  [EIP.EIP_7002]: {
    // config
    systemAddress: '0xfffffffffffffffffffffffffffffffffffffffe', // The system address to perform operations on the withdrawal requests predeploy address
    // See: https://github.com/ethereum/EIPs/pull/8934/files
    withdrawalRequestPredeployAddress:
      '0x00000961EF480EB55E80D19AD83579A64C007002', // Address of the validator excess address
  },

  /**
   * Increase the MAX_EFFECTIVE_BALANCE -> Execution layer triggered consolidations (experimental)
   */
  [EIP.EIP_7251]: {
    // config
    systemAddress: '0xfffffffffffffffffffffffffffffffffffffffe', // The system address to perform operations on the consolidation requests predeploy address
    // See: https://github.com/ethereum/EIPs/pull/8934/files
    consolidationRequestPredeployAddress:
      '0x0000BBDDC7CE488642FB579F8B00F3A590007251', // Address of the consolidations contract
  },
  /**
.  * Shard Blob Transactions
.  */
  [EIP.EIP_7691]: {
    // gasConfig
    targetBlobGasPerBlock: 786432, // The target blob gas consumed per block
    maxBlobGasPerBlock: 1179648, // The max blob gas allowable per block
    blobGasPriceUpdateFraction: 5007716, // The denominator used in the exponential when calculating a blob gas price
  },
}
