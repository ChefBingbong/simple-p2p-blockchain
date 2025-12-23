import { Hardfork } from './enums.ts'

import type { EIPsDict } from './types.ts'

// Only Frontier/Chainstart - no other EIPs
export const eipsDict: EIPsDict = {
  /**
   * Frontier/Chainstart
   * (there is no Meta-EIP currently for Frontier, so 1 was chosen)
   */
  1: {
    minimumHardfork: Hardfork.Chainstart,
  },
}
