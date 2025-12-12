import type { Multiaddr } from "@multiformats/multiaddr";
import debug from "debug";
import net, { type Server, type Socket } from "node:net";
import type { NetConfig } from "../../utils/getNetConfig";
import { multiaddrToNetConfig } from "../../utils/utils";
import { toMultiaddrConnection } from "../connection/multiaddr-connection";
import { Connection } from "../connection/connection";
import type { ListenerContext, Status } from "./types";

const log = debug("p2p:transport:listener");

export class TransportListener {
	public server: Server;
	private addr: string = "unknown";
	public context: ListenerContext;
	private status: Status = { code: "INACTIVE" };
	private connections: Map<string, Connection> = new Map();

	constructor(context: ListenerContext) {
		this.context = context;
		this.server = net.createServer(this.onSocket.bind(this));
		this.server
			.on("listening", this.onListen.bind(this))
			.on("error", (err) => {
				log(`server error: ${err?.message || err}`);
			})
			.on("close", () => {
				log(`server on ${this.addr} closed`);
			});
	}

	private onSocket = async (sock: Socket) => {
		if (this.status.code !== "ACTIVE") {
			sock.destroy();
			log("Server is not listening yet, destroying socket");
			return;
		}

		try {
			// Create multiaddr connection from raw socket
			const maConn = toMultiaddrConnection({
				socket: sock,
				remoteAddr: this.status.listeningAddr,
				direction: 'inbound'
			});

			// Upgrade the connection (encrypt + mux)
			const connection = await this.context.upgrader.upgradeInbound(maConn);
			
			const connKey = connection.id;
			this.connections.set(connKey, connection);

			connection.addEventListener('close', () => {
				this.connections.delete(connKey);
				log('connection closed: %s', connKey);
			});

			log('new inbound connection: %s', connKey);
		} catch (err: any) {
			log(`Error handling socket: ${err.message}`);
			sock.destroy();
		}
	};

	async listen(addr: Multiaddr): Promise<void> {
		if (this.status.code === "ACTIVE") {
			throw new Error("server is already listening");
		}

		try {
			this.status = {
				code: "ACTIVE",
				listeningAddr: addr,
				netConfig: multiaddrToNetConfig(addr) as NetConfig,
			};

			await this.resume();
			log("listening on %s", this.addr);
		} catch (error) {
			this.status = { code: "INACTIVE" };
			throw error;
		}
	}

	async resume(): Promise<void> {
		if (this.status.code === "INACTIVE") return;
		if (this.server.listening) return;

		const netConfig = this.status.netConfig;
		await new Promise<void>((resolve, reject) => {
			this.server.once("error", reject);
			this.server.listen(netConfig, resolve);
		});
	}

	async pause(): Promise<void> {
		await new Promise<void>((resolve) => {
			this.server.close(() => resolve());
		});
	}

	async close(): Promise<void> {
		// Close all connections
		for (const connection of this.connections.values()) {
			try {
				await connection.close();
			} catch {
				// Ignore errors during close
			}
		}
		this.connections.clear();

		await this.pause();
		this.status = { code: "INACTIVE" };
	}

	getConnections(): Connection[] {
		return Array.from(this.connections.values());
	}

	private onListen(): void {
		const address = this.server.address();

		if (address == null) {
			this.addr = "unknown";
		} else if (typeof address === "string") {
			this.addr = address;
		} else {
			this.addr = `${address.address}:${address.port}`;
		}
	}
}

export function createListener(context: ListenerContext): TransportListener {
	return new TransportListener(context);
}
