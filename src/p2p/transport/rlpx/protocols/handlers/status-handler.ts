import * as RLP from "../../../../../rlp";
import {
    BaseEthHandler,
    MessageType,
    type HandlerContext,
} from "./base-handler";

export interface StatusPayload {
	protocolVersion: number;
	networkId: number | bigint;
	td: bigint;
	bestHash: Uint8Array;
	genesisHash: Uint8Array;
	forkID?: { hash: Uint8Array; next: number | bigint };
}

export class StatusHandler extends BaseEthHandler {
	readonly messageType = MessageType.HANDSHAKE;
	readonly code = 0x00; // Relative to ETH protocol offset
	readonly name = "STATUS";

	/**
	 * Send STATUS and wait for peer's STATUS response
	 */
	async sendGetStatus(
		payload: StatusPayload,
		ctx: HandlerContext,
	): Promise<StatusPayload> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				cleanup();
				reject(new Error(`STATUS handshake timeout after ${this.timeout}ms`));
			}, this.timeout);

			// Listen for STATUS response
			const onMessage = ((evt: CustomEvent) => {
				const { code, data } = evt.detail;
				if (code === this.code) {
					cleanup();
					const status = this.decode(data);
					resolve(status);
				}
			}) as EventListener;

			const cleanup = () => {
				clearTimeout(timeoutId);
				ctx.connection.removeEventListener("message", onMessage);
			};

			ctx.connection.addEventListener("message", onMessage);

			// Send our STATUS
			this.send(payload, ctx);
		});
	}

	async send(payload: StatusPayload, ctx: HandlerContext): Promise<void> {
		const encoded = this.encode(payload);
		await ctx.connection.sendMessage(this.code, encoded);
	}

	async handle(data: Uint8Array, ctx: HandlerContext): Promise<StatusPayload> {
		return this.decode(data);
	}

	private encode(payload: StatusPayload): Uint8Array {
		const arr = [
			payload.protocolVersion,
			payload.networkId,
			payload.td,
			payload.bestHash,
			payload.genesisHash,
		];

		if (payload.forkID) {
			arr.push([payload.forkID.hash, payload.forkID.next] as any);
		}

		return RLP.encode(arr as any);
	}

	private decode(data: Uint8Array): StatusPayload {
		const decoded = RLP.decode(data) as any[];

		return {
			protocolVersion: decoded[0],
			networkId: decoded[1],
			td: decoded[2],
			bestHash: decoded[3],
			genesisHash: decoded[4],
			forkID: decoded[5]
				? { hash: decoded[5][0], next: decoded[5][1] }
				: undefined,
		};
	}
}

