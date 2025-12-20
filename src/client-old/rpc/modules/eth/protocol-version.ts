import { intToHex } from "../../../../utils/index.ts";
import { safeResult } from "../../../../utils/safe.ts";
import type { EthereumClient } from "../../../client.ts";
import type { EthProtocol } from "../../../net/protocol/index.ts";
import type { FullEthereumService } from "../../../service/index.ts";
import { createRpcMethod } from "../../validation.ts";
import { protocolVersionSchema } from "./schema.ts";

export const protocolVersion = (client: EthereumClient) => {
	const service = client.service as FullEthereumService;
	const ethProtocol = service.protocols.find(
		(p) => p.name === "eth",
	) as EthProtocol;
	const ethVersion = Math.max(...ethProtocol.versions);
	return createRpcMethod(protocolVersionSchema, async (_params, _c) => {
		return safeResult(intToHex(ethVersion));
	});
};
