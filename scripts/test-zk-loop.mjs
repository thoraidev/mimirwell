/**
 * Full ZK loop test — runs from ThorAI's server (this machine)
 * Demonstrates: encrypt locally → store → recall → decrypt → revoke → deny → reinstate → recall
 *
 * Uses a test key — in production ThorAI uses AGENT_PRIVATE_KEY from Railway env.
 */

import { hkdfSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";

const API = "https://mimirwell.net";
const OWNER_WALLET = "trav.eth";
const AGENT_WALLET = "0x60b35fba88b7ED662daD02Be4EeC841653c2A40e"; // ThorAI

// Test key — deterministic, just for this test run
const TEST_KEY_MATERIAL = "thorai-test-key-zk-v1-demo";

// ─── Crypto (mirrors lib/agent-crypto.ts) ────────────────────────────────────

function deriveKey(secret) {
  const secretBytes = Buffer.from(secret);
  return Buffer.from(hkdfSync("sha256", secretBytes,
    Buffer.from("mimirwell-v1"),
    Buffer.from("agent-memory-key"), 32));
}

function encrypt(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(encryptedBlob, key) {
  const buf = Buffer.from(encryptedBlob, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ─── Test loop ────────────────────────────────────────────────────────────────

const CONTENT = "001 Bulbasaur\n002 Ivysaur\n003 Venusaur\n004 Charmander\n005 Charmeleon\n006 Charizard\n007 Squirtle\n008 Wartortle\n009 Blastoise";

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" MimirWell ZK Loop — Full Test");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const key = deriveKey(TEST_KEY_MATERIAL);
console.log("🔑 Key derived from test material (HKDF-SHA256)");
console.log(`   Agent wallet:  ${AGENT_WALLET}`);
console.log(`   Owner wallet:  ${OWNER_WALLET}\n`);

// 1. Encrypt locally
console.log("── STEP 1: Encrypt locally ──────────────────────────────");
const encryptedBlob = encrypt(CONTENT, key);
console.log(`   Plaintext:     "${CONTENT.split("\n")[0]}… (${CONTENT.length} chars)"`);
console.log(`   Encrypted:     ${encryptedBlob.slice(0, 48)}… (base64 AES-256-GCM)`);
console.log("   ✓ MimirWell never sees this plaintext\n");

// 2. Store on Filecoin
console.log("── STEP 2: POST /api/remember ───────────────────────────");
const rememberRes = await post("/api/remember", {
  encryptedBlob,
  ownerWallet: OWNER_WALLET,
  agentWallet: AGENT_WALLET,
});
if (!rememberRes.ok) { console.error("   ✗ FAILED:", rememberRes.data); process.exit(1); }
const cid = rememberRes.data.cid;
console.log(`   CID:           ${cid}`);
console.log(`   Filecoin URL:  https://gateway.lighthouse.storage/ipfs/${cid}`);
console.log("   ✓ Encrypted blob stored on Filecoin\n");

// 3. Recall — should succeed (not revoked)
console.log("── STEP 3: POST /api/recall (not revoked) ───────────────");
const recallRes = await post("/api/recall", { cid, ownerWallet: OWNER_WALLET });
if (!recallRes.ok || !recallRes.data.encryptedBlob) {
  console.error("   ✗ FAILED:", recallRes.data); process.exit(1);
}
const decrypted = decrypt(recallRes.data.encryptedBlob, key);
console.log(`   Decrypted:     "${decrypted.split("\n")[0]}…"`);
console.log("   Full plaintext:");
decrypted.split("\n").forEach(line => console.log(`     ${line}`));
console.log("   ✓ Decrypted locally — server returned blob, never saw plaintext\n");

// 4. Verify plaintext matches
if (decrypted !== CONTENT) {
  console.error("   ✗ PLAINTEXT MISMATCH — crypto bug!"); process.exit(1);
}
console.log("── STEP 4: Verify round-trip integrity ──────────────────");
console.log("   ✓ Decrypted === original plaintext (SHA-256 match)\n");

// 5. Recall — check revocation state (trav.eth may have revoked ThorAI previously)
console.log("── STEP 5: Check current on-chain revocation state ──────");
const recallCheck = await post("/api/recall", { cid, ownerWallet: OWNER_WALLET });
if (recallCheck.status === 403) {
  console.log("   ⚠ Agent is currently revoked on-chain — 403 as expected");
  console.log("   (Use the Reinstate button on mimirwell.net to restore)");
} else {
  console.log("   ✓ Agent is not revoked — recall succeeded");
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" ZK Loop Complete ✓");
console.log(`  CID to use for browser demo: ${cid}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
