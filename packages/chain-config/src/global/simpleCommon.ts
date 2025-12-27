import { EthereumJSErrorWithoutCode } from '@ts-ethereum/utils'
import { EventEmitter } from 'eventemitter3'
import { type EIP, HARDFORK_ORDER, Hardfork } from '../fork-params/enums'
import type {
  ChainConfig,
  ChainParams,
  CommonEvent,
  CommonOpts,
  CustomCrypto,
  HardforkTransitionConfig,
  ParamsConfig,
} from '../types'
import { getRawParam } from './getters'
import { HardforkParamManager } from './param-manager'

export class GlobalConfig {
  public readonly customCrypto: CustomCrypto
  public readonly events: EventEmitter<CommonEvent>

  protected currentHardfork: Hardfork
  protected chainParams: ChainConfig
  protected hardforkParams: HardforkParamManager<Hardfork>

  private eipsCache?: number[]
  private currentHardforkMap?: Map<string | Hardfork, HardforkTransitionConfig>

  constructor(commonOptions: CommonOpts) {
    this.events = new EventEmitter<CommonEvent>()

    this.chainParams = Object.freeze(commonOptions.chain)
    this.customCrypto = commonOptions.customCrypto ?? {}

    const initialHardfork =
      (commonOptions.hardfork as Hardfork) ?? Hardfork.Chainstart
    this.currentHardfork = initialHardfork

    this.hardforkParams = new HardforkParamManager(initialHardfork)
  }

  setHardfork(hardfork: Hardfork) {
    if (!this.isValidHardfork(hardfork)) {
      throw EthereumJSErrorWithoutCode(
        `Hardfork with name ${hardfork} not supported`,
      )
    }
    this.currentHardfork = hardfork
    this.hardforkParams = this.hardforkParams.withHardfork(hardfork)

    this.eipsCache = undefined
    this.currentHardforkMap = undefined

    this.events.emit('hardforkChanged', hardfork)
    return this.hardforkParams.currentHardfork
  }

  public isActivatedEIP(eip: number | EIP) {
    return this.hardforkParams.isEIPActive(eip as EIP)
  }

  public isHardforkAfter(hardfork: Hardfork) {
    const hardforks = this.hardforks
    const currentIdx = hardforks.findIndex(
      (hf) => hf.name === this.currentHardfork,
    )
    const targetIdx = hardforks.findIndex((hf) => hf.name === hardfork)
    return currentIdx >= targetIdx && targetIdx !== -1
  }

  public getParamByEIP(
    param: string,
    eip: number,
  ): string | number | bigint | null | undefined {
    if (!this.hardforkParams.isEIPActive(eip as EIP)) {
      return undefined
    }
    return getRawParam(eip as EIP, param)
  }

  public getParam(
    name: keyof ChainParams,
  ): ChainParams[keyof ChainParams] | undefined {
    return this.hardforkParams.getParam(name)
  }

  public updateParams(overrides: ParamsConfig): this {
    this.hardforkParams.updateParams(overrides)
    return this
  }

  public getHardforkBlock(hardfork?: Hardfork) {
    hardfork = hardfork ?? this.currentHardfork
    return this.lookupHardfork(hardfork)?.block
  }

  public getHardforkTimestamp(hardfork = this.currentHardfork) {
    return this.lookupHardfork(hardfork)?.timestamp
  }

  public getHardforkByBlockNumber(blockNumber: bigint) {
    return this.hardforks.find(
      (hf) => hf.block !== null && BigInt(hf.block) === blockNumber,
    )?.name
  }

  public getHardforkByTimestamp(timestamp: bigint) {
    return this.hardforks.find(
      (hf) => hf.timestamp !== undefined && BigInt(hf.timestamp) === timestamp,
    )?.name
  }

  public copy(): GlobalConfig {
    const copy = new GlobalConfig({
      chain: this.chainParams,
      hardfork: this.currentHardfork,
      customCrypto: this.customCrypto,
    })

    const overrides = this.hardforkParams.getOverrides()
    if (Object.keys(overrides).length > 0) {
      copy.hardforkParams.updateParams(overrides)
    }
    return copy
  }

  private lookupHardfork(hardfork: Hardfork) {
    if (this.currentHardforkMap) return this.currentHardforkMap.get(hardfork)
    this.currentHardforkMap = new Map(this.hardforks.map((hf) => [hf.name, hf]))
    return this.currentHardforkMap.get(hardfork)
  }

  private isValidHardfork(hardfork: Hardfork) {
    if (hardfork === this.currentHardfork) return false
    const index = HARDFORK_ORDER.findIndex((hf) => hf === hardfork)
    return (
      index !== -1 &&
      index > HARDFORK_ORDER.findIndex((hf) => hf === this.currentHardfork)
    )
  }

  get eips() {
    return (
      this.eipsCache ?? (this.eipsCache = [...this.hardforkParams.activeEips])
    )
  }

  get hardforks() {
    return this.chainParams.hardforks
  }

  get params() {
    return this.chainParams
  }

  get activeHardfork() {
    return this.currentHardfork
  }
}
