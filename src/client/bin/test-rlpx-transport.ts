#!/usr/bin/env node

/**
 * Test script for RLPx Transport
 *
 * Demonstrates:
 * 1. Creating two nodes with the RLPx transport
 * 2. Node A listens, Node B dials
 * 3. Completing ECIES Auth/Ack handshake
 * 4. Exchanging Hello messages
 * 5. Logging capabilities and peer info
 */

import { createHash } from "crypto";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import { multiaddr } from "@multiformats/multiaddr";
import type { ComponentLogger, Logger } from "@libp2p/interface";

import {
	Common,
	Hardfork,
} from "../../chain-config/index.ts";
import { ETH } from "../../devp2p/protocol/eth.ts";
import {
	RLPxTransport,
	RLPxListener,
	type RLPxConnection,
} from "../../p2p/transport/rlpx/index.ts";
import {
	bytesToHex,
	bytesToUnprefixedHex,
	bytesToUtf8,
} from "../../utils/index.ts";

// Test configuration
const LISTEN_PORT = 30303;
const DIAL_PORT = LISTEN_PORT;

// Simple chain config for testing
const customChainConfig = {
	name: "testnet",
	chainId: 12345,
	defaultHardfork: "chainstart",
	consensus: {
		type: "pow",
		algorithm: "ethash",
	},
	genesis: {
		gasLimit: 10485760,
		difficulty: 1,
		nonce: "0xbb00000000000000",
		extraData: "0x00",
	},
	hardforks: [{ name: "chainstart", block: 0 }],
	bootstrapNodes: [],
};

/**
 * Derive a deterministic private key from a seed
 */
function derivePrivateKey(seed: string): Uint8Array {
	return createHash("sha256").update(seed).digest();
}

/**
 * Get node ID from private key
 */
function getNodeId(privateKey: Uint8Array): Uint8Array {
	return secp256k1.getPublicKey(privateKey, false).slice(1);
}

/**
 * Format node ID for logging
 */
function formatNodeId(nodeId: Uint8Array): string {
	const hex = bytesToUnprefixedHex(nodeId);
	return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

/**
 * Create a simple logger that satisfies @libp2p/interface Logger
 */
function createSimpleLogger(component: string): Logger {
	const prefix = `[${component}]`;
	const log = (formatter: string, ...args: any[]) => {
		console.log(`${prefix} ${formatter}`, ...args);
	};
	log.enabled = true;
	log.trace = (formatter: string, ...args: any[]) => {};
	log.error = (formatter: string, ...args: any[]) => {
		console.error(`${prefix} ERROR: ${formatter}`, ...args);
	};
	return log as Logger;
}

/**
 * Create a logger component that satisfies ComponentLogger interface
 */
function createLoggerComponent(name: string): { logger: ComponentLogger } {
	return {
		logger: {
			forComponent: (component: string) => createSimpleLogger(`${name}:${component}`),
		},
	};
}

async function main() {
	console.log("\n" + "=".repeat(70));
	console.log("🔗 RLPx Transport Test - Two Node Handshake");
	console.log("=".repeat(70) + "\n");

	// Create Common instance
	const common = new Common({
		chain: customChainConfig as any,
		hardfork: Hardfork.Chainstart,
	});

	// Generate deterministic keys for both nodes
	const nodeAPrivateKey = derivePrivateKey("test-node-a-seed-12345");
	const nodeBPrivateKey = derivePrivateKey("test-node-b-seed-67890");

	const nodeAId = getNodeId(nodeAPrivateKey);
	const nodeBId = getNodeId(nodeBPrivateKey);

	console.log("📋 Node Configuration:");
	console.log(`   Node A ID: ${formatNodeId(nodeAId)}`);
	console.log(`   Node B ID: ${formatNodeId(nodeBId)}`);
	console.log("");

	// Create capabilities (ETH/68)
	const capabilities = [ETH.eth68];

	// Create transports for both nodes
	console.log("🚀 Creating RLPx transports...\n");

	const transportA = new RLPxTransport(createLoggerComponent("node-a"), {
		privateKey: nodeAPrivateKey,
		capabilities,
		common,
		timeout: 10000,
	});

	const transportB = new RLPxTransport(createLoggerComponent("node-b"), {
		privateKey: nodeBPrivateKey,
		capabilities,
		common,
		timeout: 10000,
	});

	// Verify node IDs match
	console.log("✅ Transport A node ID:", formatNodeId(transportA.getNodeId()));
	console.log("✅ Transport B node ID:", formatNodeId(transportB.getNodeId()));
	console.log("");

	// Create listener for Node A
	console.log(`📡 Node A: Creating listener on port ${LISTEN_PORT}...`);

	const listener = transportA.createListener({}) as RLPxListener;

	// Promise to track when connection is established
	let connectionResolve: (conn: RLPxConnection) => void;
	const connectionPromise = new Promise<RLPxConnection>((resolve) => {
		connectionResolve = resolve;
	});

	// Handle incoming connections on Node A
	listener.addEventListener("rlpx:connection", (event) => {
		const connection = event.detail;
		console.log("\n🎉 Node A: Inbound connection established!");
		console.log(`   Remote Address: ${connection.remoteAddress}:${connection.remotePort}`);

		const hello = connection.getHelloMessage();
		if (hello) {
			console.log(`   Remote Client ID: ${hello.clientId}`);
			console.log(`   Remote Protocol Version: ${hello.protocolVersion}`);
			console.log(`   Remote Capabilities: ${hello.capabilities.map(c => `${c.name}/${c.version}`).join(", ")}`);
			console.log(`   Remote Node ID: ${formatNodeId(hello.id)}`);
		}

		const protocols = connection.getProtocols();
		console.log(`   Negotiated Protocols: ${protocols.length}`);

		connectionResolve(connection);
	});

	listener.addEventListener("listening", () => {
		console.log(`✅ Node A: Listening on port ${LISTEN_PORT}\n`);
	});

	listener.addEventListener("error", (event) => {
		console.error("❌ Node A Listener Error:", event.detail);
	});

	// Start listening
	const listenAddr = multiaddr(`/ip4/127.0.0.1/tcp/${LISTEN_PORT}`);
	await listener.listen(listenAddr);

	// Give listener time to start
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Node B dials Node A
	console.log("📞 Node B: Dialing Node A...");
	console.log(`   Target: /ip4/127.0.0.1/tcp/${DIAL_PORT}`);
	console.log(`   Remote Node ID: ${formatNodeId(nodeAId)}\n`);

	const dialAddr = multiaddr(`/ip4/127.0.0.1/tcp/${DIAL_PORT}`);

	let outboundConnection: RLPxConnection;

	try {
		outboundConnection = await transportB.dial(dialAddr, {
			remoteId: nodeAId,
			signal: AbortSignal.timeout(10000),
			upgrader: {} as any, // Not used for RLPx
		});

		console.log("🎉 Node B: Outbound connection established!");
		console.log(`   Remote Address: ${outboundConnection.remoteAddress}:${outboundConnection.remotePort}`);

		const hello = outboundConnection.getHelloMessage();
		if (hello) {
			console.log(`   Remote Client ID: ${hello.clientId}`);
			console.log(`   Remote Protocol Version: ${hello.protocolVersion}`);
			console.log(`   Remote Capabilities: ${hello.capabilities.map(c => `${c.name}/${c.version}`).join(", ")}`);
			console.log(`   Remote Node ID: ${formatNodeId(hello.id)}`);
		}

		const protocols = outboundConnection.getProtocols();
		console.log(`   Negotiated Protocols: ${protocols.length}`);

	} catch (err: any) {
		console.error("❌ Node B: Dial failed:", err.message);
		await listener.close();
		process.exit(1);
	}

	// Wait for Node A to receive the connection
	console.log("\n⏳ Waiting for Node A to receive connection...");
	const inboundConnection = await Promise.race([
		connectionPromise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("Timeout waiting for inbound connection")), 5000)
		),
	]);

	console.log("\n" + "=".repeat(70));
	console.log("✅ SUCCESS: Both nodes connected and completed Hello exchange!");
	console.log("=".repeat(70));

	// Summary
	console.log("\n📊 Connection Summary:");
	console.log("─".repeat(50));
	console.log("Node A (Listener):");
	console.log(`   Local Node ID:  ${formatNodeId(nodeAId)}`);
	console.log(`   Remote Node ID: ${formatNodeId(inboundConnection.getId()!)}`);
	console.log(`   Direction: inbound`);
	console.log(`   Connected: ${inboundConnection.isConnected()}`);

	console.log("\nNode B (Dialer):");
	console.log(`   Local Node ID:  ${formatNodeId(nodeBId)}`);
	console.log(`   Remote Node ID: ${formatNodeId(outboundConnection.getId()!)}`);
	console.log(`   Direction: outbound`);
	console.log(`   Connected: ${outboundConnection.isConnected()}`);
	console.log("─".repeat(50));

	// Keep connections alive for a moment
	console.log("\n⏳ Keeping connections alive for 3 seconds...");
	await new Promise((resolve) => setTimeout(resolve, 3000));

	// Clean up
	console.log("\n🧹 Cleaning up...");

	outboundConnection.disconnect();
	inboundConnection.disconnect();

	await new Promise((resolve) => setTimeout(resolve, 500));
	await listener.close();

	console.log("✅ Test completed successfully!\n");
	process.exit(0);
}

// Handle errors
main().catch((err) => {
	console.error("\n❌ Test failed:", err);
	process.exit(1);
});

