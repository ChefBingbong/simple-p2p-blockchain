import * as RLP from "../../../../../rlp";
import {
    BaseEthHandler,
    MessageType,
    type HandlerContext,
} from "./base-handler";

export interface GetPooledTransactionsRequest {
	hashes: Uint8Array[];
}

export class PooledTransactionsHandler extends BaseEthHandler {
	readonly messageType = MessageType.REQUEST;
	readonly code = 0x09; // GET_POOLED_TRANSACTIONS
	readonly responseCode = 0x0a; // POOLED_TRANSACTIONS
	readonly name = "GET_POOLED_TRANSACTIONS";

	/**
	 * Send GET_POOLED_TRANSACTIONS and wait for POOLED_TRANSACTIONS response
	 */
	async sendGetPooledTransactions(
		request: GetPooledTransactionsRequest,
		ctx: HandlerContext,
	): Promise<Uint8Array[]> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				cleanup();
				reject(
					new Error(
						`GET_POOLED_TRANSACTIONS timeout after ${this.timeout}ms`,
					),
				);
			}, this.timeout);

			// Listen for POOLED_TRANSACTIONS response
			const onMessage = ((evt: CustomEvent) => {
				const { code, data } = evt.detail;
				if (code === this.responseCode) {
					cleanup();
					const txs = RLP.decode(data) as Uint8Array[];
					resolve(txs);
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
		request: GetPooledTransactionsRequest,
		ctx: HandlerContext,
	): Promise<void> {
		const encoded = RLP.encode(request.hashes as any);
		await ctx.connection.sendMessage(this.code, encoded);
	}

	async handle(
		data: Uint8Array,
		ctx: HandlerContext,
	): Promise<GetPooledTransactionsRequest> {
		const hashes = RLP.decode(data) as Uint8Array[];
		return { hashes };
	}

	// Send POOLED_TRANSACTIONS response
	async sendTransactions(
		transactions: Uint8Array[],
		ctx: HandlerContext,
	): Promise<void> {
		const encoded = RLP.encode(transactions as any);
		await ctx.connection.sendMessage(this.responseCode, encoded);
	}
}

