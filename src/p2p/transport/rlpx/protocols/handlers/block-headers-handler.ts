import * as RLP from "../../../../../rlp";
import {
    BaseEthHandler,
    MessageType,
    type HandlerContext,
} from "./base-handler";

export interface GetBlockHeadersRequest {
	startBlock: number | bigint | Uint8Array;
	maxHeaders: number;
	skip: number;
	reverse: boolean;
}

export class BlockHeadersHandler extends BaseEthHandler {
	readonly messageType = MessageType.REQUEST;
	readonly code = 0x03; // GET_BLOCK_HEADERS
	readonly responseCode = 0x04; // BLOCK_HEADERS
	readonly name = "GET_BLOCK_HEADERS";

	/**
	 * Send GET_BLOCK_HEADERS and wait for BLOCK_HEADERS response
	 */
	async sendGetHeaders(
		request: GetBlockHeadersRequest,
		ctx: HandlerContext,
	): Promise<any[]> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				cleanup();
				reject(
					new Error(`GET_BLOCK_HEADERS timeout after ${this.timeout}ms`),
				);
			}, this.timeout);

			// Listen for BLOCK_HEADERS response
			const onMessage = ((evt: CustomEvent) => {
				const { code, data } = evt.detail;
				if (code === this.responseCode) {
					cleanup();
					const headers = RLP.decode(data) as any[];
					resolve(headers);
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
		request: GetBlockHeadersRequest,
		ctx: HandlerContext,
	): Promise<void> {
		const payload = [
			request.startBlock,
			request.maxHeaders,
			request.skip,
			request.reverse ? 1 : 0,
		];
		const encoded = RLP.encode(payload as any);
		await ctx.connection.sendMessage(this.code, encoded);
	}

	async handle(
		data: Uint8Array,
		ctx: HandlerContext,
	): Promise<GetBlockHeadersRequest> {
		const decoded = RLP.decode(data) as any[];
		return {
			startBlock: decoded[0],
			maxHeaders: decoded[1],
			skip: decoded[2],
			reverse: decoded[3] === 1,
		};
	}

	// Send BLOCK_HEADERS response
	async sendHeaders(headers: any[], ctx: HandlerContext): Promise<void> {
		const encoded = RLP.encode(headers as any);
		await ctx.connection.sendMessage(this.responseCode, encoded);
	}
}

