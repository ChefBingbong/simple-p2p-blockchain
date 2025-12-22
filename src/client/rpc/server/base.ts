import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Logger } from "winston";
import { isLocalhostIP } from "../../util/ip.ts";
import { INTERNAL_ERROR, INVALID_REQUEST } from "../error-code.ts";
import { getRpcErrorResponse } from "../helpers.ts";
import type { RpcApiEnv } from "../types.ts";

export type RpcServerOpts = {
	port: number;
	cors?: string;
	address?: string;
	bodyLimit?: number;
	stacktraces?: boolean;
	debug?: boolean;
};

export type RpcServerModules = {
	logger: Logger;
};

/**
 * Base RPC Server powered by Hono.
 * Provides common functionality for error handling, logging, CORS, and lifecycle management.
 */
export class RpcServerBase {
	protected readonly app: Hono<RpcApiEnv>;
	protected readonly server?: ServerType;
	protected readonly logger: Logger;
	protected readonly opts: RpcServerOpts;
	protected isListening = false;

	constructor(opts: RpcServerOpts, modules: RpcServerModules) {
		this.opts = opts;
		this.logger = modules.logger;

		const app = new Hono<RpcApiEnv>();

		// Add CORS if configured
		if (opts.cors) {
			app.use("*", cors({ origin: opts.cors }));
		}

		// Error handler middleware
		app.onError((err, c) => {
			const requestId = c.get("requestId") 
			// rpcMethod may not be set if error occurs before rpcValidator middleware
			// Access via Variables to avoid type errors
			const rpcMethod = c .get?.("rpcMethod") 

			// Check if error should be ignored
			if (this.shouldIgnoreError(err)) {
				return;
			}

			// Log error
			if (err.message.includes("validation") || err.message.includes("Invalid")) {
				this.logger.warn(`Req ${requestId} ${rpcMethod} failed`, {
					reason: err.message,
				});
			} else {
				this.logger.error(`Req ${requestId} ${rpcMethod} error`, {}, err);
			}

			// Return JSON-RPC error response
			const stacktraces = opts.stacktraces ? err.stack?.split("\n") : undefined;
			const error = {
				code: INTERNAL_ERROR,
				message: err.message ?? "Internal error",
				data: stacktraces,
			};

			return getRpcErrorResponse(c as Context<RpcApiEnv>, error, 500);
		});

		// 404 handler for unknown routes
		app.notFound((c) => {
			const message = `Route ${c.req.method}:${c.req.url} not found`;
			this.logger.warn(message);
			const error = {
				code: INVALID_REQUEST,
				message,
			};
			return getRpcErrorResponse(c as Context<RpcApiEnv>, error, 404);
		});

		this.app = app;
	}

	/**
	 * Start the RPC server.
	 */
	async listen(): Promise<void> {
		if (this.isListening) {
			return;
		}

		return new Promise<void>((resolve, reject) => {
			try {
				const host = this.opts.address ?? "127.0.0.1";
				const port = this.opts.port;

				const server = serve(
					{
						fetch: this.app.fetch,
						port,
						hostname: host,
					},
					(info) => {
						if (info) {
							const address = `http://${host}:${port}`;
							this.logger.info("Started RPC server", { address });
							if (!isLocalhostIP(host)) {
								this.logger.warn(
									"RPC server is exposed, ensure untrusted traffic cannot reach this API",
								);
							}
							this.isListening = true;
							(this as any).server = server;
							resolve();
						} else {
							reject(new Error("Failed to start RPC server"));
						}
					},
				);
			} catch (e) {
				this.logger.error("Error starting RPC server", this.opts, e as Error);
				reject(e);
			}
		});
	}

	/**
	 * Close the server instance.
	 */
	async close(): Promise<void> {
		if (!this.isListening || !this.server) {
			return;
		}

		try {
			// @hono/node-server's serve returns a ServerType
			// ServerType is typically a Node.js http.Server or similar
			const server = this.server as any;
			if (server && typeof server.close === "function") {
				await new Promise<void>((resolve, reject) => {
					server.close((err?: Error) => {
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				});
			}
			this.isListening = false;
			this.logger.debug("RPC server closed");
		} catch (e) {
			this.logger.error("Error closing RPC server", {}, e as Error);
			throw e;
		}
	}

	/** For child classes to override */
	protected shouldIgnoreError(_err: Error): boolean {
		return false;
	}
}

