import type { BaseOpts, ChainConfig } from ".";
import { Common } from ".";

export function createCustomCommon(
	partialConfig: Partial<ChainConfig>,
	baseChain: ChainConfig,
	opts: BaseOpts = {},
): Common {
	return new Common({
		chain: {
			...baseChain,
			...partialConfig,
		},
		...opts,
	});
}
