import { EIP, Hardfork } from '../fork-params/enums'
import type { ChainParams, ParamsConfig } from '../types'
import {
  getCumulativeEIPs,
  getEIPParam,
  getRawParam,
  isEIPActiveAtHardfork,
} from './getters'
import type {
  EIPParamKeys,
  EIPParamType,
  EIPWithHardfork,
  EIPWithParams,
  MinHardforkFor,
} from './types'

export class EIPAccessor<E extends EIPWithParams> {
  constructor(private readonly eip: E) {}

  get<K extends EIPParamKeys<E>>(param: K): EIPParamType<E, K> {
    return getEIPParam(this.eip, param)
  }
}

export class HardforkParamManager<H extends Hardfork = Hardfork> {
  private _currentHardfork: H
  private _overrides: ParamsConfig

  constructor(hardfork: H, overrides?: ParamsConfig) {
    this._currentHardfork = hardfork
    this._overrides = overrides ?? {}
  }

  get currentHardfork(): H {
    return this._currentHardfork
  }

  get activeEips(): Set<EIP> {
    return getCumulativeEIPs(this._currentHardfork)
  }

  getParamByEIP<
    E extends EIPWithHardfork & EIPWithParams,
    K extends EIPParamKeys<E>,
  >(
    eip: H extends MinHardforkFor[E] ? E : never,
    param: K,
  ): EIPParamType<E, K> {
    if (!isEIPActiveAtHardfork(eip as EIP, this._currentHardfork)) {
      throw new Error(
        `EIP ${eip} is not active at hardfork ${this._currentHardfork}`,
      )
    }

    return getEIPParam(eip, param)
  }

  forEIP<E extends EIPWithParams>(eip: E): EIPAccessor<E> | null {
    if (!isEIPActiveAtHardfork(eip as EIP, this._currentHardfork)) {
      return null
    }
    return new EIPAccessor(eip)
  }

  getParam(
    name: keyof ChainParams,
  ): ChainParams[keyof ChainParams] | undefined {
    // Check overrides first
    const override = this._overrides[name as string]
    if (override !== undefined) {
      return override as ChainParams[keyof ChainParams]
    }

    // Fall back to EIP params
    const activeEips = this.activeEips
    let result: ChainParams[keyof ChainParams] | undefined

    for (const eip of activeEips) {
      const value = getRawParam(eip, name as string)
      if (value !== undefined) {
        result = value as ChainParams[keyof ChainParams]
      }
    }

    return result
  }

  updateParams(overrides: ParamsConfig): this {
    this._overrides = { ...this._overrides, ...overrides }
    return this
  }

  clearOverrides(): this {
    this._overrides = {}
    return this
  }

  getOverrides(): ParamsConfig {
    return { ...this._overrides }
  }

  isEIPActive(eip: EIP): boolean {
    return isEIPActiveAtHardfork(eip, this._currentHardfork)
  }

  withHardfork<NewH extends Hardfork>(
    hardfork: NewH,
  ): HardforkParamManager<NewH> {
    return new HardforkParamManager(hardfork)
  }

  copy(): HardforkParamManager<H> {
    return new HardforkParamManager(this._currentHardfork, {
      ...this._overrides,
    })
  }
}
