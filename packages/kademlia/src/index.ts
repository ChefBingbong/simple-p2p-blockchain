// src/kademlia/index.ts
// Ethereum-compatible Kademlia DHT for peer discovery

// Main exports
export { BanList } from './ban-list'
export { KBucket } from './bucket'
export {
  createKademlia,
  Kademlia,
  KademliaNode,
  type KademliaNodeConfig,
} from './kademlia'
// Message encoding
export {
  type DecodedMessage,
  decode,
  encode,
  type FindNeighboursData,
  type MessageTypeName,
  MessageTypes,
  type NeighboursData,
  type PingData,
  type PongData,
} from './message'
export { RoutingTable, type RoutingTableEvent } from './routing-table'
// Types
export {
  type Contact,
  createDeferred,
  // Utilities
  type Deferred,
  // Constants
  DISCOVERY_VERSION,
  getPeerKeys,
  // Config types
  type KademliaConfig,
  // Event types
  type KademliaEvent,
  // Transport interface
  type KademliaTransport,
  type KademliaTransportEvent,
  type KademliaTransportOptions,
  type KBucketEvent,
  type KBucketOptions,
  // Peer types
  type PeerInfo,
  type RoutingTableConfig,
  type RoutingTableDump,
} from './types'
export { UdpKademliaTransport, UdpTransport } from './udp'
// XOR utilities
export {
  bucketIndex,
  bucketIndexFromDistance,
  distance,
  hashToId,
  id2pk,
  pk2id,
  xor,
  xorDistance,
  xorDistanceBigInt,
  zfill,
} from './xor'
