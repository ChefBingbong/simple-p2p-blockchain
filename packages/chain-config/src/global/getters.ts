import { paramsBlock, paramsEVM, paramsNetwork, paramsTx } from '../fork-params'
import { type EIP, HARDFORK_ORDER, type Hardfork } from '../fork-params/enums'
import { hardforksDict } from '../fork-params/hardforks'
import type {
  EIPParamKeys,
  EIPParamType,
  EIPWithHardfork,
  EIPWithParams,
  MinHardforkFor,
} from './types'

const cumulativeEIPsCache = new Map<Hardfork, Set<EIP>>()

export function getCumulativeEIPs(hardfork: Hardfork): Set<EIP> {
  const cached = cumulativeEIPsCache.get(hardfork)
  if (cached) return cached

  const activeEIPs = new Set<EIP>()
  const hardforkIndex = HARDFORK_ORDER.indexOf(hardfork)

  for (let i = 0; i <= hardforkIndex; i++) {
    const hf = HARDFORK_ORDER[i]
    const hfConfig = hardforksDict[hf]
    if (hfConfig?.eips) {
      for (const eip of hfConfig.eips) {
        activeEIPs.add(eip as EIP)
      }
    }
  }

  cumulativeEIPsCache.set(hardfork, activeEIPs)
  return activeEIPs
}

export function isEIPActiveAtHardfork(eip: EIP, hardfork: Hardfork): boolean {
  return getCumulativeEIPs(hardfork).has(eip)
}

export function getTypedParam<
  E extends EIPWithHardfork & EIPWithParams,
  H extends MinHardforkFor[E],
  K extends EIPParamKeys<E>,
>(hardfork: H, eip: E, param: K): EIPParamType<E, K> {
  // Runtime validation (backup for non-literal types)
  if (!isEIPActiveAtHardfork(eip as EIP, hardfork)) {
    throw new Error(`EIP ${eip} is not active at hardfork ${hardfork}`)
  }

  return getEIPParam(eip, param)
}

export function getEIPParam<E extends EIPWithParams, K extends EIPParamKeys<E>>(
  eip: E,
  param: K,
): EIPParamType<E, K> {
  const eipKey = eip as number
  const paramKey = param as string

  const value =
    paramsEVM[eipKey]?.[paramKey] ??
    paramsTx[eipKey]?.[paramKey] ??
    paramsBlock[eipKey]?.[paramKey] ??
    paramsNetwork[eipKey]?.[paramKey]

  if (value === undefined) {
    throw new Error(`Param "${paramKey}" does not exist in EIP ${eip}`)
  }

  return value as EIPParamType<E, K>
}

export function getRawParam(eip: EIP, param: string) {
  const eipKey = eip as number
  return (
    paramsEVM[eipKey]?.[param] ??
    paramsTx[eipKey]?.[param] ??
    paramsBlock[eipKey]?.[param] ??
    paramsNetwork[eipKey]?.[param]
  )
}
