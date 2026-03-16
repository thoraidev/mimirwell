/**
 * hermiod-agent.mjs — Hermiod external agent demo
 *
 * Hermiod is a second AI agent. Same owner (trav.eth) as ThorAI.
 * This script proves SELECTIVE revocation:
 *   - Revoke ThorAI → ThorAI DENIED
 *   - Hermiod unaffected → recalls fine
 *
 * Hermiod follows AGENT.md exactly — private key never leaves this process.
 *
 * Run: AGENT_PRIVATE_KEY=0x... OWNER_WALLET=0x... node scripts/hermiod-agent.mjs [--recall-only]
 */

import { hkdfSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createWalletClient, http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// ─── Agent identity ───────────────────────────────────────────────────────────
// Set AGENT_PRIVATE_KEY and OWNER_WALLET in your environment before running.
// The private key never leaves this process — it signs locally to derive the AES key.

const __dir = dirname(fileURLToPath(import.meta.url));

const AGENT_PK = process.env.AGENT_PRIVATE_KEY;
if (!AGENT_PK) {
  console.error("✗ AGENT_PRIVATE_KEY env var required — set your agent's private key");
  console.error("  Example: AGENT_PRIVATE_KEY=0x... OWNER_WALLET=0x... node scripts/hermiod-agent.mjs");
  process.exit(1);
}

const OWNER_WALLET = process.env.OWNER_WALLET;
if (!OWNER_WALLET) {
  console.error("✗ OWNER_WALLET env var required — the human principal who controls revocation");
  process.exit(1);
}

const HERMIOD_ACCOUNT = privateKeyToAccount(AGENT_PK);
const HERMIOD_WALLET  = HERMIOD_ACCOUNT.address;
const TRAV_WALLET     = OWNER_WALLET;

const API = "https://mimirwell.net";
const DERIVATION_MESSAGE = "MimirWell agent key derivation v1 — sign to derive your memory encryption key";
const CID_CACHE = resolve(__dir, "../.hermiod-cid.json");

// ─── Crypto (AGENT.md reference implementation) ───────────────────────────────

function deriveKeyFromSignature(hexSignature) {
  const sigBytes = Buffer.from(hexSignature.replace(/^0x/, ""), "hex");
  return Buffer.from(
    hkdfSync("sha256", sigBytes, Buffer.from("mimirwell-v1"), Buffer.from("agent-memory-key"), 32)
  );
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

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ─── Hermiod's memory ─────────────────────────────────────────────────────────

const MEMORY = `Agent: Hermiod
Agent wallet: ${HERMIOD_WALLET}
Owner: trav.eth (${TRAV_WALLET}) — revocation authority
Date: ${new Date().toISOString()}
Subject: Hermiod's independent memory — selective revocation test

This memory was stored by Hermiod, a separate agent from ThorAI.
Both agents share the same owner (trav.eth) but have different wallets.

Selective revocation test:
- Revoke ThorAI → ThorAI gets 403 DENIED on recall
- Hermiod unaffected → this memory returns fine
- Proves: revocation is per (owner, agent) pair — not a global kill switch

Encrypted with Hermiod's own key. MimirWell stores only ciphertext.`;

// ─── Main ─────────────────────────────────────────────────────────────────────

const recallOnly = process.argv.includes("--recall-only");

let storedCid = null;
if (existsSync(CID_CACHE)) {
  try {
    storedCid = JSON.parse(readFileSync(CID_CACHE, "utf8")).cid;
  } catch { /* ignore */ }
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  Hermiod Agent × MimirWell — Selective Revocation Test");
console.log(`  Agent:  Hermiod (${HERMIOD_WALLET})`);
console.log(`  Owner:  trav.eth (${TRAV_WALLET})`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ── Sign derivation message with Hermiod's private key ───────────────────────
console.log("── SIGN  Key derivation (Hermiod signs locally) ─────────────────");
const walletClient = createWalletClient({
  account: HERMIOD_ACCOUNT,
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});
const signature = await walletClient.signMessage({ message: DERIVATION_MESSAGE });
console.log(`   Signer:   ${HERMIOD_WALLET}`);
console.log(`   Sig:      ${signature.slice(0, 24)}…${signature.slice(-8)}`);
console.log("   ✓ Hermiod key derived — private key never left this process\n");

const aesKey = deriveKeyFromSignature(signature);
console.log("── KEY   HKDF-SHA256 → AES-256-GCM ──────────────────────────────");
console.log(`   AES key: ${aesKey.toString("hex").slice(0, 24)}… (256-bit)\n`);

// ── STORE (if no cached CID and not recall-only) ──────────────────────────────
if (!storedCid && !recallOnly) {
  console.log("── ENCRYPT  Local AES-256-GCM ───────────────────────────────────");
  const encryptedBlob = encrypt(MEMORY, aesKey);
  console.log(`   Plaintext:  ${MEMORY.length} chars`);
  console.log(`   Ciphertext: ${encryptedBlob.slice(0, 48)}…`);
  console.log("   ✓ MimirWell will never see this content\n");

  console.log("── REMEMBER  POST /api/remember → Filecoin ──────────────────────");
  const rememberRes = await apiPost("/api/remember", {
    encryptedBlob,
    agentWallet: HERMIOD_WALLET,
    ownerWallet: TRAV_WALLET,
  });
  if (!rememberRes.ok) {
    console.error("✗ /api/remember failed:", rememberRes.data);
    process.exit(1);
  }
  storedCid = rememberRes.data.cid;
  console.log(`   CID:   ${storedCid}`);
  console.log(`   IPFS:  https://gateway.lighthouse.storage/ipfs/${storedCid}`);
  console.log("   ✓ Hermiod memory stored on Filecoin\n");
  writeFileSync(CID_CACHE, JSON.stringify({ cid: storedCid, stored: new Date().toISOString() }));
} else if (storedCid) {
  console.log(`   (Using cached CID: ${storedCid})\n`);
}

// ── RECALL ────────────────────────────────────────────────────────────────────
console.log("── RECALL  POST /api/recall ──────────────────────────────────────");
console.log(`   CID: ${storedCid}`);
console.log("   Checking: isRevoked(trav.eth, Hermiod) on Ethereum mainnet…");

const recallRes = await apiPost("/api/recall", {
  cid: storedCid,
  ownerWallet: TRAV_WALLET,
});

if (recallRes.status === 403) {
  console.log("\n   ✗ 403 DENIED — Hermiod is REVOKED by trav.eth");
  console.log("   This should NOT happen in the selective revocation test.");
  console.log("   (If trav.eth revoked Hermiod's address specifically, that explains it.)");
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ACCESS DENIED ✗  (selective revocation test: unexpected)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
}

if (!recallRes.ok || !recallRes.data.encryptedBlob) {
  console.error("✗ /api/recall error:", recallRes.data);
  process.exit(1);
}

console.log("   ✓ Not revoked — encrypted blob returned");
console.log("   Decrypting with Hermiod's AES key…");
const decrypted = decrypt(recallRes.data.encryptedBlob, aesKey);
console.log("   ✓ Decrypted — AES-256-GCM auth tag verified\n");

console.log("── PLAINTEXT  (Hermiod decrypts locally — server never saw this) ─");
console.log(decrypted.split("\n").map(l => "   " + l).join("\n"));

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  HERMIOD RECALL SUCCESSFUL ✓");
console.log(`  CID: ${storedCid}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
