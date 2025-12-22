import { defaultLogger } from "@libp2p/logger";
import { EventEmitter } from "eventemitter3";
import { Level } from "level";
import { Logger } from "winston";
import type { BlockHeader } from "../../block";
import type { Common } from "../../chain-config";
import { P2PNode, type P2PNode as P2PNodeType } from "../../p2p/libp2p/node.ts";
import { rlpx } from "../../p2p/transport/rlpx/index.ts";
import { BIGINT_0 } from "../../utils";
import { safeTry } from "../../utils/safe.ts";
import { genPrivateKey } from "../../utils/utils.ts";
import { dptDiscovery } from "../net/peer/discover.ts";
import { ETH } from "../net/protocol/eth/eth.ts";
import { Event, type EventParams } from "../types.ts";
import { short } from "../util";
import type { ConfigOptions } from "./types.ts";
import { DataDirectory, SyncMode } from "./types.ts";
import type { ResolvedConfigOptions } from "./utils.ts";
import { createConfigOptions, timestampToMilliseconds } from "./utils.ts";

export class Config {
	public readonly events: EventEmitter<EventParams>;
	public readonly options: ResolvedConfigOptions;
	public readonly chainCommon: Common;
	public readonly execCommon: Common;
	public readonly node?: P2PNodeType;

	public synchronized: boolean;
	public lastSynchronized: boolean;
	public lastSyncDate: number;
	public syncTargetHeight: bigint;
	public shutdown: boolean;
	public isAbleToSync: boolean;

	private readonly logger: Logger;

	constructor(options: ConfigOptions) {
		this.events = new EventEmitter<EventParams>();
		this.options = createConfigOptions(options);
		this.chainCommon = this.options.common.copy();
		this.execCommon = this.options.common.copy();
		this.logger = this.options.logger ?? new Logger();

		this.shutdown = false;
		this.lastSyncDate = 0;
		this.syncTargetHeight = BIGINT_0;
		this.isAbleToSync = this.options.isSingleNode && this.options.mine;
		this.synchronized = this.options.isSingleNode ?? this.options.mine;

		const bootnodes = options.bootnodes ?? this.chainCommon.bootstrapNodes();
		this.node = this.createP2PNode({ ...options, bootnodes });

		this.events.on(Event.CLIENT_SHUTDOWN, () => {
			this.logger.warn(`CLIENT_SHUTDOWN event received `);
			this.shutdown = true;
		});
	}

	private createP2PNode(options: ConfigOptions): P2PNodeType {
		if (options.node || options.syncmode !== SyncMode.Full) {
			this.registerEthProtocol(options.node);
			return options.node;
		}

		const kadDiscovery = [];
		const componentLogger = defaultLogger();

		if (options.discV4) {
			kadDiscovery.push(
				dptDiscovery({
					privateKey: options.key,
					bindAddr: options.extIP ?? "127.0.0.1",
					bindPort: options.port,
					bootstrapNodes: options.bootnodes,
					autoDial: true,
					autoDialBootstrap: true,
				}),
			);
		}

		const node = new P2PNode({
			privateKey: options.key,
			peerDiscovery: kadDiscovery,
			maxConnections: this.options.maxPeers,
			logger: componentLogger,
			addresses: {
				listen: [
					options.extIP
						? `/ip4/${options.extIP}/tcp/${options.port}`
						: `/ip4/0.0.0.0/tcp/${this.options.port}`,
				],
			},
			transports: [
				rlpx({
					privateKey: options.key,
					capabilities: [ETH.eth68],
					common: this.chainCommon,
					timeout: 10000,
					maxConnections: options.maxPeers,
				}),
			],
		});

		this.registerEthProtocol(node);
		return node;
	}

	updateSynchronizedState(latest?: BlockHeader, emitSync?: boolean) {
		if (this.syncTargetHeight === 0n && !this.isAbleToSync) return;

		if (latest && latest?.number >= this.syncTargetHeight) {
			const newSyncTargetHeight = latest.number;
			this.syncTargetHeight = newSyncTargetHeight;

			this.lastSyncDate = timestampToMilliseconds(latest.timestamp);
			const timeSinceLastSyncDate = Date.now() - this.lastSyncDate;

			if (timeSinceLastSyncDate < this.options.syncedStateRemovalPeriod) {
				if (!this.synchronized) this.synchronized = true;
				if (emitSync)
					this.events.emit(Event.SYNC_SYNCHRONIZED, newSyncTargetHeight);

				this.superMsg(
					`Synchronized blockchain at height=${newSyncTargetHeight} hash=${short(latest.hash())} 🎉`,
				);
			}
			if (this.synchronized !== this.lastSynchronized) {
				this.lastSynchronized = this.synchronized;
			}
			return;
		}

		if (this.synchronized && !this.isAbleToSync) {
			const timeSinceLastSyncDate = Date.now() - this.lastSyncDate;

			if (timeSinceLastSyncDate >= this.options.syncedStateRemovalPeriod) {
				this.synchronized = false;
			}
		}

		if (this.synchronized !== this.lastSynchronized) {
			this.lastSynchronized = this.synchronized;
		}
	}

	getNetworkDirectory(): string {
		const networkDirName = this.chainCommon.chainName();
		return `${this.options.datadir}/${networkDirName}`;
	}

	getInvalidPayloadsDir(): string {
		return `${this.getNetworkDirectory()}/invalidPayloads`;
	}

	getDataDirectory(dir: DataDirectory): string {
		const networkDir = this.getNetworkDirectory();
		switch (dir) {
			case DataDirectory.Chain: {
				const chainDataDirName = "chain";
				return `${networkDir}/${chainDataDirName}`;
			}
			case DataDirectory.State:
				return `${networkDir}/state`;
			case DataDirectory.Meta:
				return `${networkDir}/meta`;
		}
	}

	static getConfigDB(networkDir: string) {
		return new Level<string | Uint8Array, Uint8Array>(`${networkDir}/config`);
	}

	static async getClientKey(datadir: string, common: Common) {
		const db = Config.getConfigDB(`${datadir}/${common.chainName()}`);
		const dbKey = "config:client_key";

		const encodingOpts = { keyEncoding: "utf8", valueEncoding: "view" };
		const [error, key] = await safeTry(() => db.get(dbKey, encodingOpts));

		if (!error) return key;

		const backupKey = genPrivateKey();
		await db.put(dbKey, backupKey, encodingOpts);
		return backupKey;
	}

	superMsg(msgs: string | string[], meta?: any) {
		if (typeof msgs === "string") {
			msgs = [msgs];
		}
		let len = 0;
		for (const msg of msgs) {
			len = msg.length > len ? msg.length : len;
		}
		this.options.logger?.info("-".repeat(len), meta);
		for (const msg of msgs) {
			this.options.logger?.info(msg, meta);
		}
		this.options.logger?.info("-".repeat(len), meta);
	}

	private registerEthProtocol(node: P2PNodeType): void {
		// Note: This is for protocol discovery only - messages go through RLPxConnection socket
		node.handle("/eth/68/1.0.0", () => {
			// Dummy handler - actual message handling is done through RLPxConnection
			// This registration allows P2PNode to advertise ETH protocol support
		});
	}
}
