import type { Chain } from "../blockchain";
import type { VMExecution } from "../execution";
import type { PeerPoolLike } from "../net/peerpool-types.ts";
import type { FullSynchronizer } from "../sync";
import type { TxPool } from "./txpool.ts";

/**
 * Common interface for FullEthereumService implementations
 * Both FullEthereumService and P2PFullEthereumService satisfy this interface
 */
export interface IFullEthereumService {
	pool: PeerPoolLike;
	chain: Chain;
	execution: VMExecution;
	txPool: TxPool;
	synchronizer?: FullSynchronizer;
}

/**
 * Type alias for FullEthereumService implementations
 * Both FullEthereumService and P2PFullEthereumService satisfy this type
 */
export type FullEthereumServiceLike = IFullEthereumService;

