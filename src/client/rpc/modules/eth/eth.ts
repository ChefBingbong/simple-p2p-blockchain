import type { ExecutionNode } from '../../../node/index.ts'
import { EthRpcMethods, RpcMethods } from '../types.ts'
import { blockNumber } from './block-number.ts'
import { chainId } from './chain-id.ts'
import { coinbase } from './coinbase.ts'
import { estimateGas } from './estimate-gas.ts'
import { gasPrice } from './gas-price.ts'
import { getBalance } from './get-balance.ts'
import { getBlockByHash } from './get-block-by-hash.ts'
import { getBlockByNumber } from './get-block-by-number.ts'
import { getBlockReceipts } from './get-block-receipts.ts'
import { getBlockTransactionCountByHash } from './get-block-transaction-count-by-hash.ts'
import { getBlockTransactionCountByNumber } from './get-block-transaction-count-by-number.ts'
import { getProof } from './get-proof.ts'
import { getTransactionByBlockHashAndIndex } from './get-transaction-by-block-hash-and-index.ts'
import { getTransactionByBlockNumberAndIndex } from './get-transaction-by-block-number-and-index.ts'
import { getTransactionByHash } from './get-transaction-by-hash.ts'
import { getTransactionCount } from './get-transaction-count.ts'
import { getTransactionReceipt } from './get-transaction-receipt.ts'
import { getUncleCountByBlockNumber } from './get-uncle-count-by-block-number.ts'
import { protocolVersion } from './protocol-version.ts'
import { sendRawTransaction } from './send-raw-transaction.ts'
import { syncing } from './syncing.ts'

export const createEthRpcMethods = (
  node: ExecutionNode,
): RpcMethods<typeof EthRpcMethods> => {
  return {
    eth_blockNumber: blockNumber(node),
    eth_chainId: chainId(node),
    eth_coinbase: coinbase(node),
    eth_estimateGas: estimateGas(node),
    eth_gasPrice: gasPrice(node),
    eth_getBalance: getBalance(node),
    eth_getBlockByHash: getBlockByHash(node),
    eth_getBlockByNumber: getBlockByNumber(node),
    eth_getBlockReceipts: getBlockReceipts(node),
    eth_getBlockTransactionCountByHash: getBlockTransactionCountByHash(node),
    eth_getBlockTransactionCountByNumber:
      getBlockTransactionCountByNumber(node),
    eth_getProof: getProof(node),
    eth_getTransactionByBlockHashAndIndex:
      getTransactionByBlockHashAndIndex(node),
    eth_getTransactionByBlockNumberAndIndex:
      getTransactionByBlockNumberAndIndex(node),
    eth_getTransactionByHash: getTransactionByHash(node),
    eth_getTransactionCount: getTransactionCount(node),
    eth_getTransactionReceipt: getTransactionReceipt(node),
    eth_getUncleCountByBlockNumber: getUncleCountByBlockNumber(node),
    eth_protocolVersion: protocolVersion(node),
    eth_sendRawTransaction: sendRawTransaction(node),
    eth_syncing: syncing(node),
  }
}
