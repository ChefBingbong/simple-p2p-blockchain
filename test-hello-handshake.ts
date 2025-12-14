import net from "node:net";
import { genPrivateKey, id2pk, pk2id } from "./src/devp2p/index.js";
import { EcciesEncrypter } from "./src/p2p/connection-encrypters/eccies/eccies-encrypter.js";

// Enable debug logging
process.env.DEBUG = "p2p:*";

async function main() {
	console.log("\n🚀 Starting HELLO Handshake Test\n");

	// Generate keys for both nodes
	const node0PrivateKey = genPrivateKey();
	const node0PublicKey = id2pk(pk2id(id2pk(node0PrivateKey)));
	const node0Id = pk2id(node0PublicKey);

	const node1PrivateKey = genPrivateKey();
	const node1PublicKey = id2pk(pk2id(id2pk(node1PrivateKey)));
	const node1Id = pk2id(node1PublicKey);

	console.log("Node 0 ID:", Buffer.from(node0Id).toString("hex").slice(0, 16) + "...");
	console.log("Node 1 ID:", Buffer.from(node1Id).toString("hex").slice(0, 16) + "...");

	// Create Node 1 (listener)
	const node1Server = net.createServer();
	let node1Complete = false;
	let node0Complete = false;

	const node1Promise = new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error("Test timeout after 10 seconds"));
		}, 10000);

		node1Server.on("connection", async (socket) => {
			try {
				console.log("\n[Node 1] 📥 Received incoming connection");

				// Create encrypter for inbound connection (no remoteId initially)
				const encrypter = new EcciesEncrypter(node1PrivateKey, {
					requireEip8: true,
					id: node1Id,
					remoteId: null, // Don't know remote ID yet for inbound
				});

				console.log("[Node 1] 🔐 Starting ECIES + HELLO handshake (inbound)...");

				// This will do AUTH/ACK + HELLO automatically
				const result = await encrypter.secureInBound(socket);

				console.log("\n[Node 1] ✅ Handshake complete!");
				console.log(
					"[Node 1] Remote peer ID:",
					Buffer.from(result.remotePeer!).toString("hex").slice(0, 16) + "...",
				);

				if (encrypter.helloResult) {
					console.log("\n[Node 1] 📨 HELLO Exchange Results:");
					console.log("  Local HELLO:");
					console.log("    Client ID:", Buffer.from(encrypter.helloResult.localHello.clientId).toString('hex').slice(0, 16) + "...");
					console.log(
						"    Capabilities:",
						encrypter.helloResult.localHello.capabilities,
					);
					console.log("  Remote HELLO:");
					console.log("    Client ID:", Buffer.from(encrypter.helloResult.remoteHello.clientId).toString('hex').slice(0, 16) + "...");
					console.log(
						"    Capabilities:",
						encrypter.helloResult.remoteHello.capabilities,
					);
				}

				node1Complete = true;
				socket.end();
				
				if (node0Complete && node1Complete) {
					clearTimeout(timeout);
					resolve();
				}
			} catch (err: any) {
				clearTimeout(timeout);
				console.error("[Node 1] ❌ Error:", err.message);
				console.error(err.stack);
				reject(err);
			}
		});

		node1Server.listen(0, "127.0.0.1", () => {
			const address = node1Server.address() as net.AddressInfo;
			console.log(`\n[Node 1] 🎧 Listening on ${address.address}:${address.port}\n`);

			// Now create Node 0 (dialer)
			const socket = net.connect(address.port, address.address);

			socket.on("connect", async () => {
				try {
					console.log("[Node 0] 📤 Connected to Node 1");

					// Create encrypter for outbound connection (knows remote ID)
					const encrypter = new EcciesEncrypter(node0PrivateKey, {
						requireEip8: true,
						id: node0Id,
						remoteId: node1Id, // We know who we're connecting to
					});

					console.log("[Node 0] 🔐 Starting ECIES + HELLO handshake (outbound)...");

					// This will do AUTH/ACK + HELLO automatically
					const result = await encrypter.secureOutBound(socket, node1Id);

					console.log("\n[Node 0] ✅ Handshake complete!");
					console.log(
						"[Node 0] Remote peer ID:",
						Buffer.from(result.remotePeer!).toString("hex").slice(0, 16) + "...",
					);

					if (encrypter.helloResult) {
						console.log("\n[Node 0] 📨 HELLO Exchange Results:");
						console.log("  Local HELLO:");
						console.log("    Client ID:", Buffer.from(encrypter.helloResult.localHello.clientId).toString('hex').slice(0, 16) + "...");
						console.log(
							"    Capabilities:",
							encrypter.helloResult.localHello.capabilities,
						);
						console.log("  Remote HELLO:");
						console.log("    Client ID:", Buffer.from(encrypter.helloResult.remoteHello.clientId).toString('hex').slice(0, 16) + "...");
						console.log(
							"    Capabilities:",
							encrypter.helloResult.remoteHello.capabilities,
						);
					}

					node0Complete = true;
					
					if (node0Complete && node1Complete) {
						clearTimeout(timeout);
						resolve();
					}
				} catch (err: any) {
					clearTimeout(timeout);
					console.error("[Node 0] ❌ Error:", err.message);
					console.error(err.stack);
					reject(err);
				}
			});

			socket.on("error", (err) => {
				clearTimeout(timeout);
				console.error("[Node 0] Socket error:", err.message);
				reject(err);
			});
		});
	});

	try {
		await node1Promise;
		console.log("\n✅ Test completed successfully!\n");
		node1Server.close();
		process.exit(0);
	} catch (err: any) {
		console.error("\n❌ Test failed:", err.message);
		console.error(err.stack);
		node1Server.close();
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
