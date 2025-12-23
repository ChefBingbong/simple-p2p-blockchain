import { bytesToHex } from '../../../../utils/index'
import { safeError, safeResult } from '../../../../utils/safe'
import type { ExecutionNode } from '../../../node/index'
// RPC admin peers - Updated for P2P architecture
import { createRpcMethod } from '../../validation'
import { peersSchema } from './schema'

export const peers = (node: ExecutionNode) =>
  createRpcMethod(peersSchema, async (_params, _c) => {
    try {
      const peers = node.network.getConnectedPeers()

      return safeResult(
        peers?.map((peer) => {
          // P2PPeer doesn't expose connection.getHelloMessage() - use peer info instead
          const name = null // TODO: Get client ID from P2PPeer if available
          return {
            id: peer.id,
            name,
            protocols: {
              eth: {
                head:
                  peer.eth?.updatedBestHeader !== undefined
                    ? bytesToHex(peer.eth.updatedBestHeader.hash())
                    : bytesToHex(peer.eth?.status.bestHash ?? new Uint8Array()),
                difficulty: peer.eth?.status.td.toString(10),
                version: peer.eth?.['versions'].slice(-1)[0] ?? null,
              },
            },
            caps: peer.eth?.['versions'].map((ver) => 'eth/' + ver),
            network: {
              remoteAddress: peer.address,
            },
          }
        }),
      )
    } catch (error) {
      return safeError(error)
    }
  })
