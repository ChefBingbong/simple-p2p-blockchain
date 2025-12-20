import type { ComponentLogger, Logger } from "@libp2p/interface";
import { multiaddr } from "@multiformats/multiaddr";

import { ETH as Devp2pETH } from "../../../devp2p";
import type { Capabilities as Devp2pCapabilities } from "../../../devp2p";
import {
	RLPxTransport,
	type RLPxConnection,
} from "../../../p2p/transport/rlpx/index.ts";
import { randomBytes, unprefixedHexToBytes, utf8ToBytes } from "../../../utils";

import { Event } from "../../types.ts";
import { getClientVersion } from "../../util";
import { RlpxSender } from "../protocol";

import { Peer } from "./peer.ts";

import type { Protocol } from "../protocol";
import type { RlpxServer } from "../server";
import type { PeerOptions } from "./peer.ts";

const devp2pCapabilities = {
	eth66: Devp2pETH.eth66,
	eth67: Devp2pETH.eth67,
	eth68: Devp2pETH.eth68,
};

export interface RlpxPeerOptions
	extends Omit<PeerOptions, "address" | "transport"> {
	/* Peer hostname or ip address */
	host: string;

	/* Peer port */
	port: number;
}

/**
 * Simple logger adapter for ComponentLogger interface
 */
function createSimpleLogger(name: string): Logger {
	const log = (_formatter: string, ..._args: any[]) => {};
	log.enabled = false;
	log.trace = (_formatter: string, ..._args: any[]) => {};
	log.error = (formatter: string, ...args: any[]) => {
		console.error(`[${name}] ERROR:`, formatter, ...args);
	};
	return log as Logger;
}

function createLoggerComponent(name: string): { logger: ComponentLogger } {
	return {
		logger: {
			forComponent: (component: string) => createSimpleLogger(`${name}:${component}`),
		},
	};
}

/**
 * Devp2p/RLPx peer using the new libp2p-style transport
 * @memberof module:net/peer
 * @example
 * ```ts
 * import { RlpxPeer } from './src/net/peer'
 * import { Chain } from './src/blockchain'
 * import { EthProtocol } from './src/net/protocol'
 *
 * const chain = await Chain.create()
 * const protocols = [ new EthProtocol({ chain })]
 * const id = '70180a7fcca96aa013a3609fe7c23cc5c349ba82652c077be6f05b8419040560a622a4fc197a450e5e2f5f28fe6227637ccdbb3f9ba19220d1fb607505ffb455'
 * const host = '192.0.2.1'
 * const port = 12345
 *
 * new RlpxPeer({ id, host, port, protocols })
 *   .on('error', (err) => console.log('Error:', err))
 *   .on('connected', () => console.log('Connected'))
 *   .on('disconnected', (reason) => console.log('Disconnected:', reason))
 *   .connect()
 * ```
 */
export class RlpxPeer extends Peer {
	private host: string;
	private port: number;
	public rlpxTransport: RLPxTransport | null;
	public connection: RLPxConnection | null;
	public connected: boolean;

	/**
	 * Create new devp2p/rlpx peer
	 */
	constructor(options: RlpxPeerOptions) {
		const address = `${options.host}:${options.port}`;
		super({
			...options,
			transport: "rlpx",
			address,
		});

		this.host = options.host;
		this.port = options.port;
		this.rlpxTransport = null;
		this.connection = null;
		this.connected = false;
	}

	/**
	 * Return devp2p/rlpx capabilities for the specified protocols
	 * @param protocols protocol instances
	 */
	static capabilities(protocols: Protocol[]): Devp2pCapabilities[] {
		const capabilities: Devp2pCapabilities[] = [];
		for (const protocol of protocols) {
			const { name, versions } = protocol;
			const keys = versions.map((v: number) => name + String(v));
			for (const key of keys) {
				const capability =
					devp2pCapabilities[key as keyof typeof devp2pCapabilities];
				if (capability !== undefined) {
					capabilities.push(capability);
				}
			}
		}
		return capabilities;
	}

	/**
	 * Initiate peer connection
	 */
	async connect(): Promise<void> {
		if (this.connected) {
			return;
		}
		const key = randomBytes(32);
		await Promise.all(this.protocols.map((p) => p.open()));

		// Create transport for outbound connection
		this.rlpxTransport = new RLPxTransport(createLoggerComponent("rlpx-peer"), {
			privateKey: key,
			clientId: utf8ToBytes(getClientVersion()),
			capabilities: RlpxPeer.capabilities(this.protocols),
			common: this.config.chainCommon,
			timeout: 10000,
		});

		// Dial the remote peer
		const dialAddr = multiaddr(`/ip4/${this.host}/tcp/${this.port}`);
		const remoteId = unprefixedHexToBytes(this.id);

		try {
			this.connection = await this.rlpxTransport.dial(dialAddr, {
				remoteId,
				signal: AbortSignal.timeout(10000),
			});

			// Bind protocols
			await this.bindProtocols(this.connection);
			this.config.events.emit(Event.PEER_CONNECTED, this);

			// Handle connection close
			this.connection.once("close", () => {
				this.connection = null;
				this.connected = false;
				this.config.events.emit(Event.PEER_DISCONNECTED, this);
			});

			// Handle errors
			this.connection.on("error", (err: Error) => {
				this.config.events.emit(Event.PEER_ERROR, err, this);
			});
		} catch (error: any) {
			this.config.events.emit(Event.PEER_ERROR, error, this);
			throw error;
		}
	}

	/**
	 * Accept new peer connection from an rlpx server
	 */
	async accept(connection: RLPxConnection, server: RlpxServer): Promise<void> {
		if (this.connected) {
			return;
		}
		await this.bindProtocols(connection);
		this.connection = connection;
		this.server = server;
	}

	/**
	 * Adds protocols to this peer given an RLPx connection.
	 * @param connection RLPx connection
	 */
	private async bindProtocols(connection: RLPxConnection): Promise<void> {
		await Promise.all(
			connection.getProtocols().map((rlpxProtocol) => {
				const name = rlpxProtocol.constructor.name.toLowerCase();
				const protocol = this.protocols.find((p) => p.name === name);
				if (protocol) {
					const sender = new RlpxSender(rlpxProtocol as Devp2pETH);
					return this.addProtocol(sender, protocol);
				}
				return undefined;
			}),
		);
		this.connected = true;
	}
}
