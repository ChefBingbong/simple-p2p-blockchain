import * as RLP from "../../../../../rlp";
import {
    BaseEthHandler,
    MessageType,
    type HandlerContext,
} from "./base-handler";

export interface NewBlockPayload {
	block: any; // Block data
	td: bigint; // Total difficulty
}

export class NewBlockHandler extends BaseEthHandler {
	readonly messageType = MessageType.ANNOUNCEMENT;
	readonly code = 0x07; // NEW_BLOCK
	readonly name = "NEW_BLOCK";

	async send(payload: NewBlockPayload, ctx: HandlerContext): Promise<void> {
		const encoded = RLP.encode([payload.block, payload.td] as any);
		await ctx.connection.sendMessage(this.code, encoded);
	}

	async handle(
		data: Uint8Array,
		ctx: HandlerContext,
	): Promise<NewBlockPayload> {
		const decoded = RLP.decode(data) as any[];
		return {
			block: decoded[0],
			td: decoded[1],
		};
	}
}

