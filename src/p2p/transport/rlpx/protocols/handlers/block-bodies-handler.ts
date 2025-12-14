import * as RLP from "../../../../../rlp";
import {
    BaseEthHandler,
    MessageType,
    type HandlerContext,
} from "./base-handler";

export interface GetBlockBodiesRequest {
	hashes: Uint8Array[];
}

export class BlockBodiesHandler extends BaseEthHandler {
	readonly messageType = MessageType.REQUEST;
	readonly code = 0x05; // GET_BLOCK_BODIES
	readonly responseCode = 0x06; // BLOCK_BODIES
	readonly name = "GET_BLOCK_BODIES";

	/**
	 * Send GET_BLOCK_BODIES and wait for BLOCK_BODIES response
	 */
	async sendGetBodies(
		request: GetBlockBodiesRequest,
		ctx: HandlerContext,
	): Promise<any[]> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				cleanup();
				reject(new Error(`GET_BLOCK_BODIES timeout after ${this.timeout}ms`));
			}, this.timeout);

			// Listen for BLOCK_BODIES response
			const onMessage = ((evt: CustomEvent) => {
				const { code, data } = evt.detail;
				if (code === this.responseCode) {
					cleanup();
					const bodies = RLP.decode(data) as any[];
					resolve(bodies);
				}
			}) as EventListener;

			const cleanup = () => {
				clearTimeout(timeoutId);
				ctx.connection.removeEventListener("message", onMessage);
			};

			ctx.connection.addEventListener("message", onMessage);

			// Send request
			this.send(request, ctx);
		});
	}

	async send(
		request: GetBlockBodiesRequest,
		ctx: HandlerContext,
	): Promise<void> {
		const encoded = RLP.encode(request.hashes as any);
		await ctx.connection.sendMessage(this.code, encoded);
	}

	async handle(
		data: Uint8Array,
		ctx: HandlerContext,
	): Promise<GetBlockBodiesRequest> {
		const hashes = RLP.decode(data) as Uint8Array[];
		return { hashes };
	}

	// Send BLOCK_BODIES response
	async sendBodies(bodies: any[], ctx: HandlerContext): Promise<void> {
		const encoded = RLP.encode(bodies as any);
		await ctx.connection.sendMessage(this.responseCode, encoded);
	}
}

