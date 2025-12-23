import { Chain } from '../chain-config'

import { holeskyGenesis } from './genesisStates/holesky'
import { hoodiGenesis } from './genesisStates/hoodi'
import { mainnetGenesis } from './genesisStates/mainnet'
import { sepoliaGenesis } from './genesisStates/sepolia'

import type { GenesisState } from '../chain-config'

/**
 * Utility to get the genesisState of a well known network
 * @param: chainId of the network
 * @returns genesisState of the chain
 */
export function getGenesis(chainId: number): GenesisState | undefined {
  switch (chainId) {
    case Chain.Mainnet:
      return mainnetGenesis
    case Chain.Sepolia:
      return sepoliaGenesis
    case Chain.Holesky:
      return holeskyGenesis
    case Chain.Hoodi:
      return hoodiGenesis

    default:
      return undefined
  }
}
