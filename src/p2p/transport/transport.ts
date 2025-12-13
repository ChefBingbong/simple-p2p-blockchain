import type { Multiaddr } from "@multiformats/multiaddr";
import debug from "debug";
import type { TcpSocketConnectOpts } from "net";
import net from "node:net";
import {
	type SafeError,
	type SafePromise,
	type SafeResult,
	safeError,
	safeResult,
} from "../../utils/safe";
import { multiaddrToNetConfig } from "../../utils/utils";
import { Connection } from "../connection/connection";
import { toMultiaddrConnection } from "../connection/multiaddr-connection";
import { Upgrader } from "../connection/upgrader";
import { TransportListener, createListener } from "./transport-listener";
import type { ListenerContext, TransportDialOpts } from "./types";

const log = debug("p2p:transport");

export interface TransportInit {
	upgrader: Upgrader;
	dialOpts?: TransportDialOpts;
}

export class Transport {
	private readonly upgrader: Upgrader;
	private readonly connectionCache: Map<string, Connection> = new Map();
	private readonly inFlightDials = new Map<string, SafePromise<Connection>>();
	private readonly dialOpts: TransportDialOpts;
	private dialQueue: Array<() => void> = [];
	private activeDials = 0;

	constructor(init: TransportInit) {
		this.upgrader = init.upgrader;
		this.dialOpts = init.dialOpts ?? { maxActiveDials: 10 };
	}

	async dial(peerAddr: Multiaddr, remotePeerId?: Uint8Array, timeoutMs = 60_000): SafePromise<Connection> {
		const peerAddrStr = peerAddr.toString();
		const netOptions = multiaddrToNetConfig(peerAddr) as TcpSocketConnectOpts;

		// Check for existing connection
		const existingConn = this.checkExistingConnection(peerAddr);
		if (existingConn) return existingConn;

		// Check for in-flight dial
		const existingDial = this.inFlightDials.get(peerAddrStr);
		if (existingDial) return existingDial;

		const dialPromise = this.scheduleDial(async (): SafePromise<Connection> => {
			const sock = net.createConnection(netOptions);

			sock.on("error", (err) => {
				log(`dial socket error to ${peerAddrStr}: ${err.message}`);
				try {
					sock.destroy();
				} catch {}
			});

			return await new Promise<SafeError<Error> | SafeResult<Connection>>((resolve) => {
				const cleanup = () => {
					clearTimeout(timer);
					sock.off("connect", onConnect);
					sock.off("error", onError);
				};

				const onError = (err: Error) => {
					cleanup();
					try {
						sock.destroy();
					} catch {}
					resolve(safeError(err));
				};

				const onConnect = async () => {
					cleanup();
					const result = await this.onConnect(sock, peerAddr, remotePeerId);
					resolve(result);
				};

				const onTimeout = () => {
					const err = new Error(`connection timeout after ${timeoutMs}ms`);
					cleanup();
					try {
						sock.destroy();
					} catch {}
					resolve(safeError(err));
				};

				sock.once("connect", onConnect);
				sock.once("error", onError);
				const timer = setTimeout(onTimeout, timeoutMs);
			});
		});

		this.inFlightDials.set(peerAddrStr, dialPromise);
		const result = await dialPromise;
		this.inFlightDials.delete(peerAddrStr);

		return result;
	}

	private async scheduleDial(dialCallback: () => SafePromise<Connection>): SafePromise<Connection> {
		if (this.activeDials >= this.dialOpts.maxActiveDials) {
			await new Promise<void>((resolve) => this.dialQueue.push(resolve));
		}

		this.activeDials++;
		const result = await dialCallback();

		this.activeDials--;
		const nextDial = this.dialQueue.shift();
		nextDial?.();

		return result;
	}

	private async onConnect(socket: net.Socket, peerAddr: Multiaddr, remotePeerId?: Uint8Array): Promise<SafeError<Error> | SafeResult<Connection>> {
		try {
			// Create multiaddr connection from raw socket
			const maConn = toMultiaddrConnection({
				socket,
				remoteAddr: peerAddr,
				direction: 'outbound'
			});

			// Upgrade the connection (encrypt + mux)
			const connection = await this.upgrader.upgradeOutbound(maConn);

			// Cache the connection
			this.connectionCache.set(peerAddr.toString(), connection);

			// Remove from cache when closed
			connection.addEventListener('close', () => {
				this.connectionCache.delete(peerAddr.toString());
			});

			return safeResult(connection);
		} catch (err: any) {
			return safeError(err);
		}
	}

	private checkExistingConnection(peerAddr: Multiaddr): SafeResult<Connection> | null {
		const cachedConnection = this.connectionCache.get(peerAddr.toString());

		if (cachedConnection && cachedConnection.status === 'open') {
			return safeResult(cachedConnection);
		}

		// Clean up stale connections
		if (cachedConnection) {
			this.connectionCache.delete(peerAddr.toString());
		}

		return null;
	}

	createListener(context: Omit<ListenerContext, 'upgrader'>): TransportListener {
		return createListener({ 
			...context, 
			upgrader: this.upgrader 
		});
	}

	getConnections(): Connection[] {
		return Array.from(this.connectionCache.values());
	}

	async closeAllConnections(): Promise<void> {
		for (const connection of this.connectionCache.values()) {
			try {
				await connection.close();
			} catch {
				// Ignore errors during close
			}
		}
		this.connectionCache.clear();
	}
}

export function createTransport(init: TransportInit): Transport {
	return new Transport(init);
}
