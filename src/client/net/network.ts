import debug from "debug";
import type { P2PNode } from "../../p2p/libp2p/types.ts";
import type { Chain } from "../blockchain/chain.ts";
import type { Config } from "../config/index.ts";
import type { VMExecution } from "../execution";
import { NetworkCore } from "./core/index.ts";
import type { Peer } from "./peer/peer.ts";

const log = debug("p2p:network");

/**
 * Network service initialization options
 */
export interface NetworkInitOptions {
	config: Config;
	node: P2PNode;
	chain?: Chain;
	execution?: VMExecution;
}

/**
 * Network - Main network service that wraps NetworkCore
 * Provides a clean public API for network operations
 *
 * Similar to lodestar's Network class, but adapted for execution layer.
 */
export class Network {
	private readonly core: NetworkCore;

	constructor(options: NetworkInitOptions) {
		log("Creating Network service");
		this.core = new NetworkCore(options);
		log("Network service created");
	}

	/**
	 * Set execution instance
	 */
	setExecution(execution: VMExecution): void {
		this.core.setExecution(execution);
	}

	/**
	 * Open network service
	 */
	async open(): Promise<boolean> {
		const result = await this.core.open();
		return result === false ? false : true;
	}

	/**
	 * Start network service
	 */
	async start(): Promise<boolean> {
		return this.core.start();
	}

	/**
	 * Stop network service
	 */
	async stop(): Promise<boolean> {
		return this.core.stop();
	}

	/**
	 * Close network service
	 */
	async close(): Promise<void> {
		return this.core.close();
	}

	// ============================================================================
	// Public API - Peer Management
	// ============================================================================

	/**
	 * Get connected peers
	 */
	getConnectedPeers(): Peer[] {
		return this.core.getConnectedPeers();
	}

	/**
	 * Get peer count
	 */
	getPeerCount(): number {
		return this.core.getPeerCount();
	}

	/**
	 * Check if network contains the specified peer
	 */
	containsPeer(peer: Peer | string): boolean {
		return this.core.containsPeer(peer);
	}

	/**
	 * Returns a random idle peer
	 */
	getIdlePeer(filterFn?: (peer: Peer) => boolean): Peer | undefined {
		return this.core.getIdlePeer(filterFn);
	}

	/**
	 * Add peer to network
	 */
	addPeer(peer: Peer): void {
		this.core.addPeer(peer);
	}

	/**
	 * Remove peer from network
	 */
	removePeer(peer: Peer): void {
		this.core.removePeer(peer);
	}

	/**
	 * Ban peer from network
	 */
	banPeer(peer: Peer, maxAge?: number): void {
		this.core.banPeer(peer, maxAge);
	}

	// ============================================================================
	// Backward Compatibility - Peer Pool Interface
	// ============================================================================

	/**
	 * Get peers (backward compatibility)
	 */
	get peers(): Peer[] {
		return this.getConnectedPeers();
	}

	/**
	 * Get size (backward compatibility)
	 */
	get size(): number {
		return this.getPeerCount();
	}

	/**
	 * Contains (backward compatibility)
	 */
	contains(peer: Peer | string): boolean {
		return this.containsPeer(peer);
	}

	/**
	 * Idle (backward compatibility)
	 */
	idle(filterFn?: (peer: Peer) => boolean): Peer | undefined {
		return this.getIdlePeer(filterFn);
	}

	/**
	 * Add (backward compatibility)
	 */
	add(peer?: Peer): void {
		if (peer) {
			this.addPeer(peer);
		}
	}

	/**
	 * Remove (backward compatibility)
	 */
	remove(peer?: Peer): void {
		if (peer) {
			this.removePeer(peer);
		}
	}

	/**
	 * Ban (backward compatibility)
	 */
	ban(peer: Peer, maxAge?: number): void {
		this.banPeer(peer, maxAge);
	}

	/**
	 * Running state (backward compatibility)
	 */
	get running(): boolean {
		return this.core.running;
	}

	/**
	 * Config (backward compatibility)
	 */
	get config(): Config {
		return this.core.config;
	}
}
