import { BaseProtocolHandler } from '../base-protocol-handler';
import type { RlpxConnection } from '../RlpxConnection';
import * as RLP from '../../../../rlp/index';

// ETH protocol message codes (relative to protocol offset)
export const ETH_CODES = {
	STATUS: 0x00,
	NEW_BLOCK_HASHES: 0x01,
	TRANSACTIONS: 0x02,
	GET_BLOCK_HEADERS: 0x03,
	BLOCK_HEADERS: 0x04,
	GET_BLOCK_BODIES: 0x05,
	BLOCK_BODIES: 0x06,
	NEW_BLOCK: 0x07,
	NEW_POOLED_TRANSACTION_HASHES: 0x08,
	GET_POOLED_TRANSACTIONS: 0x09,
	POOLED_TRANSACTIONS: 0x0a,
};

export class EthProtocolHandler extends BaseProtocolHandler {
	constructor(version: number = 68) {
		super('eth', version, 16); // Reserve 16 codes

		// Register handlers for each message type
		this.setupHandlers();
	}

	private setupHandlers(): void {
		// STATUS handler
		this.on(ETH_CODES.STATUS, async (data, conn) => {
			const status = RLP.decode(data);
			conn.log('[ETH] Received STATUS: %o', status);
			// TODO: Handle STATUS message
		});

		// NEW_BLOCK_HASHES handler
		this.on(ETH_CODES.NEW_BLOCK_HASHES, async (data, conn) => {
			const hashes = RLP.decode(data) as any[];
			conn.log('[ETH] Received NEW_BLOCK_HASHES: %d hashes', hashes.length);
			// TODO: Handle new block hashes
		});

		// TRANSACTIONS handler
		this.on(ETH_CODES.TRANSACTIONS, async (data, conn) => {
			const txs = RLP.decode(data) as any[];
			conn.log('[ETH] Received TRANSACTIONS: %d transactions', txs.length);
			// TODO: Handle transactions
		});

		// GET_BLOCK_HEADERS handler
		this.on(ETH_CODES.GET_BLOCK_HEADERS, async (data, conn) => {
			const request = RLP.decode(data);
			conn.log('[ETH] Received GET_BLOCK_HEADERS request');
			// TODO: Handle get block headers request
		});

		// BLOCK_HEADERS handler
		this.on(ETH_CODES.BLOCK_HEADERS, async (data, conn) => {
			const headers = RLP.decode(data) as any[];
			conn.log('[ETH] Received BLOCK_HEADERS: %d headers', headers.length);
			// TODO: Handle block headers
		});

		// GET_BLOCK_BODIES handler
		this.on(ETH_CODES.GET_BLOCK_BODIES, async (data, conn) => {
			const request = RLP.decode(data);
			conn.log('[ETH] Received GET_BLOCK_BODIES request');
			// TODO: Handle get block bodies request
		});

		// BLOCK_BODIES handler
		this.on(ETH_CODES.BLOCK_BODIES, async (data, conn) => {
			const bodies = RLP.decode(data) as any[];
			conn.log('[ETH] Received BLOCK_BODIES: %d bodies', bodies.length);
			// TODO: Handle block bodies
		});

		// NEW_BLOCK handler
		this.on(ETH_CODES.NEW_BLOCK, async (data, conn) => {
			const block = RLP.decode(data);
			conn.log('[ETH] Received NEW_BLOCK');
			// TODO: Handle new block
		});

		// NEW_POOLED_TRANSACTION_HASHES handler
		this.on(ETH_CODES.NEW_POOLED_TRANSACTION_HASHES, async (data, conn) => {
			const hashes = RLP.decode(data) as any[];
			conn.log(
				'[ETH] Received NEW_POOLED_TRANSACTION_HASHES: %d hashes',
				hashes.length,
			);
			// TODO: Handle pooled transaction hashes
		});

		// GET_POOLED_TRANSACTIONS handler
		this.on(ETH_CODES.GET_POOLED_TRANSACTIONS, async (data, conn) => {
			const request = RLP.decode(data);
			conn.log('[ETH] Received GET_POOLED_TRANSACTIONS request');
			// TODO: Handle get pooled transactions request
		});

		// POOLED_TRANSACTIONS handler
		this.on(ETH_CODES.POOLED_TRANSACTIONS, async (data, conn) => {
			const txs = RLP.decode(data) as any[];
			conn.log('[ETH] Received POOLED_TRANSACTIONS: %d transactions', txs.length);
			// TODO: Handle pooled transactions
		});
	}

	/**
	 * Send STATUS message
	 */
	async sendStatus(status: {
		protocolVersion: number;
		networkId: number | bigint;
		td: bigint;
		bestHash: Uint8Array;
		genesisHash: Uint8Array;
		forkID?: {
			hash: Uint8Array;
			next: number | bigint;
		};
	}): Promise<void> {
		const payload = [
			status.protocolVersion,
			status.networkId,
			status.td,
			status.bestHash,
			status.genesisHash,
		];

		if (status.forkID) {
			payload.push([status.forkID.hash, status.forkID.next] as any);
		}

		const encoded = RLP.encode(payload as any);
		await this.send(ETH_CODES.STATUS, encoded);
	}

	/**
	 * Send NEW_BLOCK_HASHES message
	 */
	async sendNewBlockHashes(
		hashes: Array<{ hash: Uint8Array; number: number | bigint }>,
	): Promise<void> {
		const payload = hashes.map((h) => [h.hash, h.number]);
		const encoded = RLP.encode(payload as any);
		await this.send(ETH_CODES.NEW_BLOCK_HASHES, encoded);
	}

	/**
	 * Send TRANSACTIONS message
	 */
	async sendTransactions(transactions: Uint8Array[]): Promise<void> {
		const encoded = RLP.encode(transactions as any);
		await this.send(ETH_CODES.TRANSACTIONS, encoded);
	}

	/**
	 * Send GET_BLOCK_HEADERS message
	 */
	async sendGetBlockHeaders(request: {
		startBlock: number | bigint | Uint8Array;
		maxHeaders: number;
		skip: number;
		reverse: boolean;
	}): Promise<void> {
		const payload = [
			request.startBlock,
			request.maxHeaders,
			request.skip,
			request.reverse ? 1 : 0,
		];
		const encoded = RLP.encode(payload as any);
		await this.send(ETH_CODES.GET_BLOCK_HEADERS, encoded);
	}

	// Add more protocol methods as needed...
}

