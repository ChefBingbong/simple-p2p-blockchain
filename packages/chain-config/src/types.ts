import type { BigIntLike, KZG, PrefixedHexString } from '@ts-ethereum/utils'
import type { secp256k1 } from 'ethereum-cryptography/secp256k1.js'
import type { ConsensusAlgorithm, ConsensusType, Hardfork } from './enums'

export interface ChainName {
  [chainId: string]: string
}
export interface ChainsConfig {
  [key: string]: ChainConfig | ChainName
}

export interface CommonEvent {
  hardforkChanged: [hardfork: string]
}

// Kept for compatibility but Clique is not used
export type CliqueConfig = {
  period: number
  epoch: number
}

export type EthashConfig = any

// Kept for compatibility but Casper is not used
export type CasperConfig = any

type ConsensusConfig = {
  type: ConsensusType | string
  algorithm: ConsensusAlgorithm | string
  clique?: CliqueConfig
  ethash?: EthashConfig
  casper?: CasperConfig
}

export interface ChainConfig {
  name: string
  chainId: number | string
  defaultHardfork?: Hardfork
  comment?: string
  url?: string
  genesis: GenesisBlockConfig
  hardforks: HardforkTransitionConfig[]
  customHardforks?: HardforksDict
  bootstrapNodes: BootstrapNodeConfig[]
  dnsNetworks?: string[]
  consensus: ConsensusConfig
  depositContractAddress?: PrefixedHexString
}

export interface GenesisBlockConfig {
  timestamp?: PrefixedHexString
  gasLimit: number | PrefixedHexString
  difficulty: number | PrefixedHexString
  nonce: PrefixedHexString
  extraData: PrefixedHexString
  baseFeePerGas?: PrefixedHexString
  excessBlobGas?: PrefixedHexString
  requestsHash?: PrefixedHexString
}

export interface HardforkTransitionConfig {
  name: Hardfork | string
  block: number | null
  timestamp?: number | string
  forkHash?: PrefixedHexString | null
}

export interface BootstrapNodeConfig {
  ip: string
  port: number | string
  network?: string
  chainId?: number
  id: string
  location: string
  comment: string
}

export interface CustomCrypto {
  keccak256?: (msg: Uint8Array) => Uint8Array
  ecrecover?: (
    msgHash: Uint8Array,
    v: bigint,
    r: Uint8Array,
    s: Uint8Array,
    chainId?: bigint,
  ) => Uint8Array
  sha256?: (msg: Uint8Array) => Uint8Array
  ecsign?: (
    msg: Uint8Array,
    pk: Uint8Array,
    ecSignOpts?: { extraEntropy?: Uint8Array | boolean },
  ) => Pick<ReturnType<typeof secp256k1.sign>, 'recovery' | 'r' | 's'>
  ecdsaRecover?: (
    sig: Uint8Array,
    recId: number,
    hash: Uint8Array,
  ) => Uint8Array
  kzg?: KZG
}

export interface BaseOpts {
  /**
   * String identifier ('byzantium') for hardfork or {@link Hardfork} enum.
   *
   * Default: Hardfork.Chainstart
   */
  hardfork?: string | Hardfork
  /**
   * Selected EIPs which can be activated, please use an array for instantiation
   * (e.g. `eips: [ 2537, ]`)
   *
   * Currently supported:
   *
   * - [EIP-2537](https://eips.ethereum.org/EIPS/eip-2537) - BLS12-381 precompiles
   */
  eips?: number[]
  params?: ParamsDict
  /**
   * This option can be used to replace the most common crypto primitives
   * (keccak256 hashing e.g.) within the EthereumJS ecosystem libraries
   * with alternative implementations (e.g. more performant WASM libraries).
   *
   * Note: please be aware that this is adding new dependencies for your
   * system setup to be used for sensitive/core parts of the functionality
   * and a choice on the libraries to add should be handled with care
   * and be made with eventual security implications considered.
   */
  customCrypto?: CustomCrypto
}

/**
 * Options for instantiating a {@link Common} instance.
 */
export interface CommonOpts extends BaseOpts {
  /**
   * The chain configuration to be used. There are available configuration object for mainnet
   * (`Mainnet`) and the currently active testnets which can be directly used.
   */
  chain: ChainConfig
}

export interface GethConfigOpts extends BaseOpts {
  chain?: string
  genesisHash?: Uint8Array
}

export interface HardforkByOpts {
  blockNumber?: BigIntLike
  timestamp?: BigIntLike
}

export type EIPConfig = {
  minimumHardfork: Hardfork
  requiredEIPs?: number[]
}

export type ParamsConfig = {
  [key: string]: number | string | null
}

export type HardforkConfig = {
  eips?: number[]
  consensus?: ConsensusConfig
  params?: ParamsConfig
}

export type EIPsDict = {
  [key: string]: EIPConfig
}

export type ParamsDict = {
  [key: string]: ParamsConfig
}

export type HardforksDict = {
  [key: string]: HardforkConfig
}

export type BpoSchedule = {
  targetBlobGasPerBlock: bigint
  maxBlobGasPerBlock: bigint
  blobGasPriceUpdateFraction: bigint
}

// ============================================================================
// EIP-Based Parameter Types (Required - no optionals)
// These types mirror the params defined in mappings.ts EIPParams
// ============================================================================

/**
 * EIP-1: Frontier/Chainstart base parameters
 */
export interface EIP1Params {
  // Gas config
  maxRefundQuotient: number
  minGasLimit: number
  gasLimitBoundDivisor: number
  // Opcode gas costs
  basefeeGas: number
  expGas: number
  expByteGas: number
  keccak256Gas: number
  keccak256WordGas: number
  sloadGas: number
  sstoreSetGas: number
  sstoreResetGas: number
  sstoreRefundGas: number
  jumpdestGas: number
  logGas: number
  logDataGas: number
  logTopicGas: number
  createGas: number
  callGas: number
  callStipendGas: number
  callValueTransferGas: number
  callNewAccountGas: number
  selfdestructRefundGas: number
  memoryGas: number
  quadCoefficientDivGas: number
  createDataGas: number
  copyGas: number
  stopGas: number
  addGas: number
  mulGas: number
  subGas: number
  divGas: number
  sdivGas: number
  modGas: number
  smodGas: number
  addmodGas: number
  mulmodGas: number
  signextendGas: number
  ltGas: number
  gtGas: number
  sltGas: number
  sgtGas: number
  eqGas: number
  iszeroGas: number
  andGas: number
  orGas: number
  xorGas: number
  notGas: number
  byteGas: number
  addressGas: number
  balanceGas: number
  originGas: number
  callerGas: number
  callvalueGas: number
  calldataloadGas: number
  calldatasizeGas: number
  calldatacopyGas: number
  codesizeGas: number
  codecopyGas: number
  gaspriceGas: number
  extcodesizeGas: number
  extcodecopyGas: number
  blockhashGas: number
  coinbaseGas: number
  timestampGas: number
  numberGas: number
  difficultyGas: number
  gaslimitGas: number
  popGas: number
  mloadGas: number
  mstoreGas: number
  mstore8Gas: number
  sstoreGas: number
  jumpGas: number
  jumpiGas: number
  pcGas: number
  msizeGas: number
  gasGas: number
  pushGas: number
  dupGas: number
  swapGas: number
  callcodeGas: number
  returnGas: number
  invalidGas: number
  selfdestructGas: number
  prevrandaoGas: number
  // Precompile costs
  ecRecoverGas: number
  sha256Gas: number
  sha256WordGas: number
  ripemd160Gas: number
  ripemd160WordGas: number
  identityGas: number
  identityWordGas: number
  // Limits
  stackLimit: number
  maxExtraDataSize: number
  // Transaction gas
  txGas: number
  txCreationGas: number
  txDataZeroGas: number
  txDataNonZeroGas: number
  accessListStorageKeyGas: number
  accessListAddressGas: number
  // PoW params
  minerReward: string
  minimumDifficulty: number
  difficultyBoundDivisor: number
  durationLimit: number
  difficultyBombDelay: number
}

/** EIP-606: Homestead */
export interface EIP606Params {
  delegatecallGas: number
}

/** EIP-608: Tangerine Whistle - Gas cost increases */
export interface EIP608Params {
  sloadGas: number
  callGas: number
  extcodesizeGas: number
  extcodecopyGas: number
  balanceGas: number
  delegatecallGas: number
  callcodeGas: number
  selfdestructGas: number
}

/** EIP-607: Spurious Dragon */
export interface EIP607Params {
  expByteGas: number
  maxCodeSize: number
}

/** EIP-609: Byzantium */
export interface EIP609Params {
  modexpGquaddivisorGas: number
  bn254AddGas: number
  bn254MulGas: number
  bn254PairingGas: number
  bn254PairingWordGas: number
  revertGas: number
  staticcallGas: number
  returndatasizeGas: number
  returndatacopyGas: number
  difficultyBombDelay: number
  minerReward: string
}

/** EIP-1013: Constantinople */
export interface EIP1013Params {
  // Net gas metering (can be nullified by EIP-1716)
  netSstoreNoopGas: number | null
  netSstoreInitGas: number | null
  netSstoreCleanGas: number | null
  netSstoreDirtyGas: number | null
  netSstoreClearRefundGas: number | null
  netSstoreResetRefundGas: number | null
  netSstoreResetClearRefundGas: number | null
  // Bitwise shift opcodes
  shlGas: number
  shrGas: number
  sarGas: number
  extcodehashGas: number
  create2Gas: number
}

/** EIP-1679: Istanbul */
export interface EIP1679Params {
  blake2RoundGas: number
  sstoreSentryEIP2200Gas: number
  sstoreNoopEIP2200Gas: number
  sstoreDirtyEIP2200Gas: number
  sstoreInitEIP2200Gas: number
  sstoreInitRefundEIP2200Gas: number
  sstoreCleanEIP2200Gas: number
  sstoreCleanRefundEIP2200Gas: number
  sstoreClearRefundEIP2200Gas: number
  chainidGas: number
  selfbalanceGas: number
  txDataNonZeroGas: number
}

/** EIP-2384: Muir Glacier difficulty bomb delay */
export interface EIP2384Params {
  difficultyBombDelay: number
}

/** EIP-2565: ModExp gas cost reduction */
export interface EIP2565Params {
  modexpGquaddivisorGas: number
}

/** EIP-3198: BASEFEE opcode */
export interface EIP3198Params {
  basefeeGas: number
}

/** EIP-3554: Difficulty bomb delay to December 2021 */
export interface EIP3554Params {
  difficultyBombDelay: number
}

/** EIP-4345: Difficulty bomb delay to June 2022 */
export interface EIP4345Params {
  difficultyBombDelay: number
}

/** EIP-5133: Difficulty bomb delay to September 2022 */
export interface EIP5133Params {
  difficultyBombDelay: number
}

/** EIP-2929: Gas cost increases for state access opcodes */
export interface EIP2929Params {
  coldsloadGas: number
  coldaccountaccessGas: number
  warmstoragereadGas: number
}

/** EIP-2930: Optional access lists */
export interface EIP2930Params {
  accessListStorageKeyGas: number
  accessListAddressGas: number
}

/** EIP-1559: Fee market */
export interface EIP1559Params {
  elasticityMultiplier: number
  baseFeeMaxChangeDenominator: number
  initialBaseFee: number
}

/** EIP-3529: Reduction in refunds */
export interface EIP3529Params {
  maxRefundQuotient: number
  selfdestructRefundGas: number
  sstoreClearRefundEIP2200Gas: number
}

/** EIP-3855: PUSH0 instruction */
export interface EIP3855Params {
  push0Gas: number
}

/** EIP-3860: Limit and meter initcode */
export interface EIP3860Params {
  initCodeWordGas: number
  maxInitCodeSize: number
}

/** EIP-4399: PREVRANDAO */
export interface EIP4399Params {
  prevrandaoGas: number
}

/** EIP-4788: Beacon block root in EVM */
export interface EIP4788Params {
  historicalRootsLength: number
}

/** EIP-4844: Shard Blob Transactions */
export interface EIP4844Params {
  kzgPointEvaluationPrecompileGas: number
  blobhashGas: number
  blobCommitmentVersionKzg: number
  fieldElementsPerBlob: number
  targetBlobGasPerBlock: number
  blobGasPerBlob: number
  maxBlobGasPerBlock: number
  blobGasPriceUpdateFraction: number
  minBlobGas: number
  blobBaseCost: number
}

/** EIP-5656: MCOPY */
export interface EIP5656Params {
  mcopyGas: number
}

/** EIP-1153: Transient storage */
export interface EIP1153Params {
  tstoreGas: number
  tloadGas: number
}

/** EIP-7516: BLOBBASEFEE opcode */
export interface EIP7516Params {
  blobbasefeeGas: number
}

/** EIP-2537: BLS12-381 precompiles */
export interface EIP2537Params {
  bls12381G1AddGas: number
  bls12381G1MulGas: number
  bls12381G2AddGas: number
  bls12381G2MulGas: number
  bls12381PairingBaseGas: number
  bls12381PairingPerPairGas: number
  bls12381MapG1Gas: number
  bls12381MapG2Gas: number
}

/** EIP-2935: Historical block hashes in state */
export interface EIP2935Params {
  historyStorageAddress: string
  historyServeWindow: number
  systemAddress: string
}

/** EIP-7002: Execution layer triggerable withdrawals */
export interface EIP7002Params {
  withdrawalRequestPredeployAddress: string
}

/** EIP-7251: Increase MAX_EFFECTIVE_BALANCE */
export interface EIP7251Params {
  consolidationRequestPredeployAddress: string
}

/** EIP-7623: Increase calldata cost */
export interface EIP7623Params {
  totalCostFloorPerToken: number
}

/** EIP-7691: Blob throughput increase */
export interface EIP7691Params {
  targetBlobGasPerBlock: number
  maxBlobGasPerBlock: number
  blobGasPriceUpdateFraction: number
}

/** EIP-7702: Set EOA account code */
export interface EIP7702Params {
  perAuthBaseGas: number
  perEmptyAccountCost: number
}

/** EIP-7594: PeerDAS */
export interface EIP7594Params {
  maxBlobsPerTx: number
}

/** EIP-7825: Transaction Gas Limit Cap */
export interface EIP7825Params {
  maxTransactionGasLimit: number
}

/** EIP-7939: CLZ opcode */
export interface EIP7939Params {
  clzGas: number
}

/** EIP-663: SWAPN, DUPN, EXCHANGE */
export interface EIP663Params {
  dupnGas: number
  swapnGas: number
  exchangeGas: number
}

/** EIP-4200: Static relative jumps */
export interface EIP4200Params {
  rjumpGas: number
  rjumpiGas: number
  rjumpvGas: number
}

/** EIP-4750: Functions */
export interface EIP4750Params {
  callfGas: number
  retfGas: number
}

/** EIP-6206: JUMPF */
export interface EIP6206Params {
  jumpfGas: number
}

/** EIP-7069: Revamped CALL */
export interface EIP7069Params {
  extcallGas: number
  extdelegatecallGas: number
  extstaticcallGas: number
  returndataloadGas: number
  minRetainedGas: number
  minCalleeGas: number
}

/** EIP-7480: Data section access */
export interface EIP7480Params {
  dataloadGas: number
  dataloadnGas: number
  datasizeGas: number
  datacopyGas: number
}

/** EIP-7620: EOF Contract Creation */
export interface EIP7620Params {
  eofcreateGas: number
  returncontractGas: number
}

// ============================================================================
// Combined Chain Params - Partial composition of all EIP params
// ============================================================================

/**
 * Combined chain params - union of all EIP params as Partial
 * This allows any param to be undefined when not yet activated
 */
export interface ChainParams
  extends EIP1Params,
    EIP606Params,
    EIP608Params,
    EIP607Params,
    EIP609Params,
    EIP1013Params,
    EIP1679Params,
    EIP2384Params,
    EIP2565Params,
    EIP2929Params,
    EIP2930Params,
    EIP1559Params,
    EIP3198Params,
    EIP3529Params,
    EIP3554Params,
    EIP3855Params,
    EIP3860Params,
    EIP4345Params,
    EIP4399Params,
    EIP4788Params,
    EIP4844Params,
    EIP5133Params,
    EIP5656Params,
    EIP1153Params,
    EIP7516Params,
    EIP2537Params,
    EIP2935Params,
    EIP7002Params,
    EIP7251Params,
    EIP7623Params,
    EIP7691Params,
    EIP7702Params,
    EIP7594Params,
    EIP7825Params,
    EIP7939Params,
    EIP663Params,
    EIP4200Params,
    EIP4750Params,
    EIP6206Params,
    EIP7069Params,
    EIP7480Params,
    EIP7620Params {
  // BPO schedule params (hardfork-specific)
  target?: number
  max?: number
}

/**
 * Metadata for a parameter value, tracking when/where it was activated
 */
export interface ParamMetadata {
  /** The hardfork at which this param value was set */
  activatedAtHardfork: Hardfork
  /** Block number at which hardfork was activated (null if timestamp-based) */
  activatedAtBlock: bigint | null
  /** Timestamp at which hardfork was activated (null if block-based) */
  activatedAtTimestamp: bigint | null
  /** The EIP that introduced this param */
  activatedByEIP: number
}

/**
 * EIP metadata for tracking activation status
 */
export interface EIPMetadata {
  /** Whether this EIP is currently active */
  isActive: boolean
  /** The hardfork that activated this EIP */
  activatedAtHardfork: Hardfork | null
  /** Block number at which EIP was activated */
  activatedAtBlock: bigint | null
  /** Timestamp at which EIP was activated */
  activatedAtTimestamp: bigint | null
}

/**
 * Hardfork metadata for tracking activation status
 */
export interface HardforkMetadata {
  /** Whether this hardfork is currently active */
  isActive: boolean
  /** Block number at which hardfork was activated (null if timestamp-based or not yet active) */
  activatedAtBlock: bigint | null
  /** Timestamp at which hardfork was activated (null if block-based or not yet active) */
  activatedAtTimestamp: bigint | null
}

// ============================================================================
// Hardfork-Specific Type Utilities
// ============================================================================

// All hardforks in order for reference:
// chainstart -> homestead -> dao -> tangerineWhistle -> spuriousDragon ->
// byzantium -> constantinople -> petersburg -> istanbul -> muirGlacier ->
// berlin -> london -> arrowGlacier -> grayGlacier -> mergeNetsplitBlock ->
// paris -> shanghai -> cancun -> prague -> osaka -> bpo1-5

/** Hardforks at or after Homestead (EIP-606) */
export type HomesteadAndLater = Exclude<Hardfork, 'chainstart'>

/** Hardforks at or after Tangerine Whistle (EIP-608) */
export type TangerineWhistleAndLater = Exclude<
  Hardfork,
  'chainstart' | 'homestead' | 'dao'
>

/** Hardforks at or after Spurious Dragon (EIP-607) */
export type SpuriousDragonAndLater = Exclude<
  Hardfork,
  'chainstart' | 'homestead' | 'dao' | 'tangerineWhistle'
>

/** Hardforks at or after Byzantium (EIP-609) */
export type ByzantiumAndLater = Exclude<
  Hardfork,
  'chainstart' | 'homestead' | 'dao' | 'tangerineWhistle' | 'spuriousDragon'
>

/** Hardforks at or after Constantinople (EIP-1013) */
export type ConstantinopleAndLater = Exclude<
  Hardfork,
  | 'chainstart'
  | 'homestead'
  | 'dao'
  | 'tangerineWhistle'
  | 'spuriousDragon'
  | 'byzantium'
>

/** Hardforks at or after Istanbul (EIP-1679) */
export type IstanbulAndLater = Exclude<
  Hardfork,
  | 'chainstart'
  | 'homestead'
  | 'dao'
  | 'tangerineWhistle'
  | 'spuriousDragon'
  | 'byzantium'
  | 'constantinople'
  | 'petersburg'
>

/** Hardforks at or after Berlin (EIP-2929, EIP-2930, EIP-2565) */
export type BerlinAndLater =
  | 'berlin'
  | 'london'
  | 'arrowGlacier'
  | 'grayGlacier'
  | 'mergeNetsplitBlock'
  | 'paris'
  | 'shanghai'
  | 'cancun'
  | 'prague'
  | 'osaka'
  | 'bpo1'
  | 'bpo2'
  | 'bpo3'
  | 'bpo4'
  | 'bpo5'

/** Hardforks at or after London (EIP-1559, EIP-3198, EIP-3529) */
export type LondonAndLater =
  | 'london'
  | 'arrowGlacier'
  | 'grayGlacier'
  | 'mergeNetsplitBlock'
  | 'paris'
  | 'shanghai'
  | 'cancun'
  | 'prague'
  | 'osaka'
  | 'bpo1'
  | 'bpo2'
  | 'bpo3'
  | 'bpo4'
  | 'bpo5'

/** Hardforks at or after Paris (The Merge - EIP-4399) */
export type ParisAndLater =
  | 'paris'
  | 'shanghai'
  | 'cancun'
  | 'prague'
  | 'osaka'
  | 'bpo1'
  | 'bpo2'
  | 'bpo3'
  | 'bpo4'
  | 'bpo5'

/** Hardforks at or after Shanghai (EIP-3855, EIP-3860) */
export type ShanghaiAndLater =
  | 'shanghai'
  | 'cancun'
  | 'prague'
  | 'osaka'
  | 'bpo1'
  | 'bpo2'
  | 'bpo3'
  | 'bpo4'
  | 'bpo5'

/** Hardforks at or after Cancun (EIP-4844, EIP-1153, EIP-5656, EIP-7516) */
export type CancunAndLater =
  | 'cancun'
  | 'prague'
  | 'osaka'
  | 'bpo1'
  | 'bpo2'
  | 'bpo3'
  | 'bpo4'
  | 'bpo5'

/** Hardforks at or after Prague (EIP-2537, EIP-7702, EIP-7691, etc.) */
export type PragueAndLater =
  | 'prague'
  | 'osaka'
  | 'bpo1'
  | 'bpo2'
  | 'bpo3'
  | 'bpo4'
  | 'bpo5'

/** Hardforks at or after Osaka (EIP-7594, EIP-7825, EIP-7939) */
export type OsakaAndLater = 'osaka' | 'bpo1' | 'bpo2' | 'bpo3' | 'bpo4' | 'bpo5'

// ============================================================================
// Hardfork-Specific Param Groups (Composed from EIP interfaces)
// These directly mirror the params in fork-params/*.ts
// ============================================================================

/** Params at Homestead+ (EIP-606) */
export type HomesteadParams = EIP606Params

/** Params at Tangerine Whistle+ (EIP-608) */
export type TangerineWhistleParams = EIP608Params

/** Params at Spurious Dragon+ (EIP-607) */
export type SpuriousDragonParams = EIP607Params

/** Params at Byzantium+ (EIP-609) */
export type ByzantiumParams = EIP609Params

/** Params at Constantinople+ (EIP-1013) */
export type ConstantinopleParams = EIP1013Params

/** Params at Istanbul+ (EIP-1679) */
export type IstanbulParams = EIP1679Params

/** Params at Berlin+ (EIP-2565, EIP-2929, EIP-2930) */
export type BerlinParams = EIP2565Params & EIP2929Params & EIP2930Params

/** Params at London+ (EIP-1559, EIP-3198, EIP-3529) */
export type LondonParams = EIP1559Params & EIP3198Params & EIP3529Params

/** Params at Paris+ (EIP-4399) */
export type ParisParams = EIP4399Params

/** Params at Shanghai+ (EIP-3855 PUSH0, EIP-3860 initcode) */
export type ShanghaiParams = EIP3855Params & EIP3860Params

/** Params at Cancun+ (EIP-4844 blobs, EIP-1153 transient, EIP-5656 MCOPY, EIP-4788, EIP-7516) */
export type CancunParams = EIP4844Params &
  EIP1153Params &
  EIP5656Params &
  EIP4788Params &
  EIP7516Params

/** Params at Prague+ (EIP-2537 BLS, EIP-7702, EIP-7691, EIP-7623, EIP-2935, EIP-7002, EIP-7251) */
export type PragueParams = EIP2537Params &
  EIP7702Params &
  EIP7691Params &
  EIP7623Params &
  EIP2935Params &
  EIP7002Params &
  EIP7251Params

/** Params at Osaka+ (EIP-7594 PeerDAS, EIP-7825 gas cap, EIP-7939 CLZ, EOF EIPs) */
export type OsakaParams = EIP7594Params &
  EIP7825Params &
  EIP7939Params &
  EIP663Params &
  EIP4200Params &
  EIP4750Params &
  EIP6206Params &
  EIP7069Params &
  EIP7480Params &
  EIP7620Params

/**
 * Merged params type that varies based on hardfork.
 * Properties that don't exist at a hardfork are completely absent (not optional).
 * Accessing unavailable params is a compile-time error.
 *
 * @example
 * ```ts
 * const builder = HardforkParamsBuilder.create(Hardfork.Cancun)
 * const params = builder.getParams()
 * params.blobGasPerBlob  // ✅ number - exists at Cancun
 * params.tstoreGas       // ✅ number - exists at Cancun
 *
 * const oldBuilder = HardforkParamsBuilder.create(Hardfork.Berlin)
 * const oldParams = oldBuilder.getParams()
 * oldParams.blobGasPerBlob  // ❌ Error: Property does not exist
 * ```
 */
export type MergedParamsAtHardfork<H extends Hardfork> =
  // Base params always available (EIP-1 Chainstart)
  EIP1Params &
    // Homestead (EIP-606)
    (H extends HomesteadAndLater ? HomesteadParams : {}) &
    // Tangerine Whistle (EIP-608)
    (H extends TangerineWhistleAndLater ? TangerineWhistleParams : {}) &
    // Spurious Dragon (EIP-607)
    (H extends SpuriousDragonAndLater ? SpuriousDragonParams : {}) &
    // Byzantium (EIP-609)
    (H extends ByzantiumAndLater ? ByzantiumParams : {}) &
    // Constantinople (EIP-1013)
    (H extends ConstantinopleAndLater ? ConstantinopleParams : {}) &
    // Istanbul (EIP-1679)
    (H extends IstanbulAndLater ? IstanbulParams : {}) &
    // Berlin (EIP-2565, EIP-2929, EIP-2930)
    (H extends BerlinAndLater ? BerlinParams : {}) &
    // London (EIP-1559, EIP-3198, EIP-3529)
    (H extends LondonAndLater ? LondonParams : {}) &
    // Paris (EIP-4399)
    (H extends ParisAndLater ? ParisParams : {}) &
    // Shanghai (EIP-3855, EIP-3860)
    (H extends ShanghaiAndLater ? ShanghaiParams : {}) &
    // Cancun (EIP-4844, EIP-1153, EIP-5656, EIP-4788, EIP-7516)
    (H extends CancunAndLater ? CancunParams : {}) &
    // Prague (EIP-2537, EIP-7702, EIP-7691, EIP-7623, EIP-2935, EIP-7002, EIP-7251)
    (H extends PragueAndLater ? PragueParams : {}) &
    // Osaka (EIP-7594, EIP-7825, EIP-7939, EOF EIPs)
    (H extends OsakaAndLater ? OsakaParams : {})
