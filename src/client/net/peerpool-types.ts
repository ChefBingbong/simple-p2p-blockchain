import type { Config } from "../config.ts";
import type { Peer } from "./peer/peer.ts";
import type { PeerPool } from "./peerpool.ts";
import type { P2PPeerPool } from "./p2p-peerpool.ts";

/**
 * Common interface for peer pools (PeerPool and P2PPeerPool)
 * This allows services to work with either implementation
 */
export interface IPeerPool {
	config: Config;
	running: boolean;
	peers: Peer[];
	size: number;
	contains(peer: Peer | string): boolean;
	idle(filterFn?: (peer: Peer) => boolean): Peer | undefined;
	add(peer?: Peer): void;
	remove(peer?: Peer): void;
	ban(peer: Peer, maxAge?: number): void;
	open(): Promise<boolean | void>;
	start(): Promise<boolean>;
	stop(): Promise<boolean>;
	close(): Promise<void>;
}

/**
 * Type alias for peer pool implementations
 * Both PeerPool and P2PPeerPool satisfy this type
 */
export type PeerPoolLike = PeerPool | P2PPeerPool;

