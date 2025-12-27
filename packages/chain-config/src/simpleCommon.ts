import { EthereumJSErrorWithoutCode } from '@ts-ethereum/utils'
import { EventEmitter } from 'eventemitter3'
import { type EIP, HARDFORK_ORDER, Hardfork } from './enums'
import { EIPParams, HardforkParams } from './mappings'
import { HardforkParamsBuilder } from './paramsBuilder'
import type {
  ChainConfig,
  ChainParams,
  CommonEvent,
  CommonOpts,
  CustomCrypto,
  HardforkTransitionConfig,
  MergedParamsAtHardfork,
} from './types'

export class SimpleCommon {
  public readonly customCrypto: CustomCrypto
  public readonly events: EventEmitter<CommonEvent>

  protected currentHardfork: Hardfork
  protected chainParams: ChainConfig
  protected paramsBuilder: HardforkParamsBuilder<Hardfork>

  private eipsCache?: number[]
  private currentHardforkMap?: Map<string | Hardfork, HardforkTransitionConfig>

  constructor(commonOptions: CommonOpts) {
    this.events = new EventEmitter<CommonEvent>()

    this.chainParams = Object.freeze(commonOptions.chain)
    this.customCrypto = commonOptions.customCrypto ?? {}

    const initialHardfork = commonOptions.hardfork as Hardfork
    this.currentHardfork = initialHardfork ?? Hardfork.Chainstart

    this.paramsBuilder = HardforkParamsBuilder.create(
      initialHardfork,
      EIPParams,
      HardforkParams,
    )
  }

  setHardfork(hardfork: Hardfork) {
    if (!this.isValidHardfork(hardfork)) {
      throw EthereumJSErrorWithoutCode(
        `Hardfork with name ${hardfork} not supported`,
      )
    }
    this.currentHardfork = hardfork
    this.paramsBuilder = this.paramsBuilder.withHardfork(hardfork)

    this.eipsCache = undefined
    this.currentHardforkMap = undefined

    this.events.emit('hardforkChanged', hardfork)
    return this.paramsBuilder.currentHardfork
  }

  public isActivatedEIP(eip: EIP) {
    return this.paramsBuilder.activeEips.has(eip)
  }

  public isHardforkAfter(hardfork: Hardfork) {
    const hardforks = this.hardforks
    const currentIdx = hardforks.findIndex(
      (hf) => hf.name === this.currentHardfork,
    )
    const targetIdx = hardforks.findIndex((hf) => hf.name === hardfork)
    return currentIdx >= targetIdx && targetIdx !== -1
  }

  public overrideParams(overrides: Partial<ChainParams>) {
    this.paramsBuilder.overrideParams(overrides)
    this.eipsCache = undefined
    return this
  }

  public getParamByHardfork<K extends keyof MergedParamsAtHardfork<Hardfork>>(
    name: K,
    hardfork: Hardfork,
  ) {
    const builder = this.paramsBuilder.withHardfork<Hardfork>(hardfork)
    return builder.getParam(name)
  }

  public getParamByEIP<K extends keyof MergedParamsAtHardfork<Hardfork>>(
    name: K,
    eip: EIP,
  ) {
    return this.paramsBuilder.getEipParams<EIP>(eip)?.[name]
  }

  public getParam<K extends keyof MergedParamsAtHardfork<Hardfork>>(name: K) {
    return this.paramsBuilder.getParam(name)
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
      this.eipsCache ??
      (this.eipsCache = this.paramsBuilder.activeEips.values().toArray())
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
