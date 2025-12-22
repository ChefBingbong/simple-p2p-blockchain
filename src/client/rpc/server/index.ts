import type { Context } from "hono";
import { requestId } from "hono/request-id";
import type { ExecutionNode } from "../../node/index.ts";
import { Event } from "../../types.ts";
import { INTERNAL_ERROR } from "../error-code.ts";
import { getRpcErrorResponse } from "../helpers.ts";
import { createRpcHandlers } from "../modules/index.ts";
import type { RpcApiEnv } from "../types.ts";
import { rpcRequestSchema } from "../types.ts";
import { rpcValidator } from "../validation.ts";
import { RpcServerBase, type RpcServerModules, type RpcServerOpts } from "./base.ts";

export type RpcServerOptsExtended = RpcServerOpts & {
	enabled: boolean;
	debug?: boolean;
};

export const rpcServerOpts: RpcServerOptsExtended = {
	enabled: true,
	address: "127.0.0.1",
	port: 8545,
	cors: undefined,
	bodyLimit: 10 * 1024 * 1024, // 10MB
	stacktraces: false,
	debug: false,
};

export type RpcServerModulesExtended = RpcServerModules & {
	node: ExecutionNode;
};

/**
 * RPC Server powered by Hono.
 * Handles JSON-RPC 2.0 requests for Ethereum execution node.
 */
export class RpcServer extends RpcServerBase {
	declare readonly opts: RpcServerOptsExtended;
	readonly modules: RpcServerModulesExtended;
	private isRpcReady = false;

	constructor(optsArg: Partial<RpcServerOptsExtended>, modules: RpcServerModulesExtended) {
		const opts = { ...rpcServerOpts, ...optsArg };
		super(opts, modules);

		this.opts = opts;
		this.modules = modules;

		// Register routes
		this.registerRoutes();
	}

	/**
	 * Register RPC routes with middleware
	 */
	private registerRoutes(): void {
		const { rpcHandlers, methods } = createRpcHandlers(
			this.modules.node,
			this.opts.debug ?? false,
		);

		// Add request ID middleware
		this.app.use("*", requestId({ generator: () => Date.now().toString() }));

		// Add ready check middleware
		this.app.use("*", async (c, next) => {
			if (!this.isRpcReady) {
				const error = {
					code: INTERNAL_ERROR,
					message: "RPC server is not ready yet",
				};
				return getRpcErrorResponse(c as Context<RpcApiEnv>, error, 503);
			}
			return next();
		});

		// Register RPC endpoint
		// rpcHandlers is a Hono handler function, even though the type says RpcHandler
		this.app.post("/", rpcValidator(rpcRequestSchema), rpcHandlers as any);
	}

	/**
	 * Start the RPC server and emit ready event when listening
	 */
	async listen(): Promise<void> {
		await super.listen();

		// Emit RPC_READY event
		const address = this.opts.address ?? "127.0.0.1";
		const port = this.opts.port;
		this.modules.node.config.events.emit(Event.RPC_READY, { address, port });
		this.isRpcReady = true;
	}

	/**
	 * Close the RPC server
	 */
	async close(): Promise<void> {
		this.isRpcReady = false;
		await super.close();
	}

	protected shouldIgnoreError(err: Error): boolean {
		// Don't log certain errors that are expected during normal operation
		// Add specific error types here if needed
		return false;
	}
}

