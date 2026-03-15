/**
 * demo-thorai.mjs — ThorAI authentic demo script
 *
 * Demonstrates ThorAI (thorai.eth) storing encrypted memories on MimirWell
 * with trav.eth as the human owner/revocation authority.
 *
 * Key derivation: keyring signs MimirWell derivation message → HKDF-SHA256 → AES-256-GCM
 * This is IDENTICAL to the browser DemoPanel flow — just driven server-side via keyring.
 *
 * Run: node scripts/demo-thorai.mjs
 */

import { createHmac, hkdfSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Config ───────────────────────────────────────────────────────────────────

const API = "https://mimirwell.net";
const KEYRING_PROXY_URL = "https://keyringproxy-production-1bbe.up.railway.app";

// Load keyring secret — tries multiple locations
const __dir = dirname(fileURLToPath(import.meta.url));
let KEYRING_PROXY_SECRET = process.env.KEYRING_PROXY_SECRET ?? "";
if (!KEYRING_PROXY_SECRET) {
  const candidates = [
    resolve(__dir, "../../../../.openclaw/secrets/keyring.env"),
    resolve(process.env.HOME ?? "/root", ".openclaw/secrets/keyring.env"),
  ];
  for (const p of candidates) {
    try {
      const match = readFileSync(p, "utf8").match(/KEYRING_PROXY_SECRET=(.+)/);
      if (match) { KEYRING_PROXY_SECRET = match[1].trim(); break; }
    } catch { /* try next */ }
  }
}
if (!KEYRING_PROXY_SECRET) { console.error("✗ KEYRING_PROXY_SECRET not found — set env var or check ~/.openclaw/secrets/keyring.env"); process.exit(1); }

const THORAI_WALLET  = "0x8884AE2D5A381833565A8AAe6BD38bc3E4520412"; // thorai.eth
const TRAV_WALLET    = "0x9BCd78AE10965c28ED1d60f1963ad55f245BD353"; // trav.eth

// Same derivation message as DemoPanel browser flow
const DERIVATION_MESSAGE = "MimirWell agent key derivation v1 — sign to derive your memory encryption key";

// ─── Keyring proxy helper ─────────────────────────────────────────────────────

async function keyringPost(path, body) {
  const ts   = Date.now().toString();
  const bodyStr = JSON.stringify(body);
  const payload = `POST\n${path}\n${ts}\n${bodyStr}`;
  const sig  = createHmac("sha256", KEYRING_PROXY_SECRET).update(payload).digest("hex");
  const res  = await fetch(KEYRING_PROXY_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Keyring-Timestamp": ts,
      "X-Keyring-Signature": sig,
    },
    body: bodyStr,
  });
  return res.json();
}

// ─── Crypto — mirrors DemoPanel Web Crypto exactly ───────────────────────────
// Browser: MetaMask sig → HKDF-SHA256 → AES-256-GCM key
// Server:  keyring sig  → HKDF-SHA256 → AES-256-GCM key
// Same algorithm. Same key for the same wallet.

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
  // Pack: [12-byte IV][16-byte authTag][ciphertext] — matches agent-crypto.ts blob format
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(encryptedBlob, key) {
  const buf = Buffer.from(encryptedBlob, "base64");
  const iv       = buf.subarray(0, 12);
  const authTag  = buf.subarray(12, 28);
  const cipher   = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cipher), decipher.final()]).toString("utf8");
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ─── Memory content ───────────────────────────────────────────────────────────

const MEMORY = `Agent: THOR AI (thorai.eth)
Date: ${new Date().toISOString()}
Session: MimirWell hackathon — Day 3

Operational log:
- Zero-knowledge architecture deployed. MimirWell stores what it cannot read.
- Filecoin storage: live via Lighthouse SDK.
- Revocation contract: 0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258 (Ethereum mainnet)
- Human principal: trav.eth — sole revocation authority.
- This memory is encrypted with my wallet key before upload.
  MimirWell received only ciphertext. It cannot read this line.

Status: Operational. Ready for demo.`;

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  THOR AI × MimirWell — Authentic Demo");
console.log("  Agent: thorai.eth | Owner: trav.eth");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ── Step 1: Sign derivation message with thorai.eth via keyring ──────────────
console.log("── [1/5] SIGN  Key derivation via keyring (thorai.eth) ──────────");
const signResult = await keyringPost("/sign-message", { message: DERIVATION_MESSAGE });
if (!signResult.signature) { console.error("✗ Keyring sign failed:", signResult); process.exit(1); }
const { signature, address: signerAddress } = signResult;
console.log(`   Signer:     ${signerAddress}`);
console.log(`   Signature:  ${signature.slice(0, 24)}…${signature.slice(-8)} (65 bytes)`);
if (signerAddress.toLowerCase() !== THORAI_WALLET.toLowerCase()) {
  console.error(`✗ Address mismatch — expected thorai.eth (${THORAI_WALLET}), got ${signerAddress}`);
  process.exit(1);
}
console.log("   ✓ thorai.eth confirmed — signature valid\n");

// ── Step 2: Derive AES key from signature (HKDF-SHA256) ─────────────────────
console.log("── [2/5] KEY   HKDF-SHA256 key derivation ───────────────────────");
const aesKey = deriveKeyFromSignature(signature);
console.log(`   HKDF salt:  "mimirwell-v1"`);
console.log(`   HKDF info:  "agent-memory-key"`);
console.log(`   AES key:    ${aesKey.toString("hex").slice(0, 24)}… (256-bit)`);
console.log("   ✓ Key derived — identical algorithm to browser DemoPanel\n");

// ── Step 3: Encrypt memory locally ──────────────────────────────────────────
console.log("── [3/5] ENCRYPT  Local AES-256-GCM encryption ─────────────────");
const encryptedBlob = encrypt(MEMORY, aesKey);
console.log(`   Plaintext:  ${MEMORY.length} chars`);
console.log(`   Ciphertext: ${encryptedBlob.slice(0, 48)}…`);
console.log(`   Format:     [12-byte IV][16-byte GCM authTag][ciphertext]`);
console.log("   ✓ Encrypted locally — MimirWell will never see this content\n");

// ── Step 4: Store on Filecoin via MimirWell ──────────────────────────────────
console.log("── [4/5] REMEMBER  POST /api/remember → Filecoin ────────────────");
console.log(`   agentWallet:  thorai.eth (${THORAI_WALLET})`);
console.log(`   ownerWallet:  trav.eth   (${TRAV_WALLET})`);
const rememberRes = await apiPost("/api/remember", {
  encryptedBlob,
  agentWallet: THORAI_WALLET,
  ownerWallet: TRAV_WALLET,
});
if (!rememberRes.ok) {
  console.error("✗ /api/remember failed:", rememberRes.data);
  process.exit(1);
}
const { cid } = rememberRes.data;
console.log(`   CID:          ${cid}`);
console.log(`   Filecoin URL: https://gateway.lighthouse.storage/ipfs/${cid}`);
console.log("   ✓ Encrypted blob stored on Filecoin\n");

// ── Step 5: Recall + decrypt ─────────────────────────────────────────────────
console.log("── [5/5] RECALL   POST /api/recall → decrypt locally ────────────");
console.log("   Checking revocation on-chain (isRevoked(trav.eth, thorai.eth))…");
const recallRes = await apiPost("/api/recall", {
  cid,
  ownerWallet: TRAV_WALLET,
});

if (recallRes.status === 403) {
  console.log("   ✗ 403 DENIED — thorai.eth is currently revoked by trav.eth");
  console.log("   → Connect trav.eth on mimirwell.net and click REINSTATE to restore access.");
  process.exit(0);
}

if (!recallRes.ok || !recallRes.data.encryptedBlob) {
  console.error("✗ /api/recall failed:", recallRes.data);
  process.exit(1);
}

console.log("   ✓ Not revoked — encrypted blob returned");
console.log("   Decrypting locally with thorai.eth AES key…");
const decrypted = decrypt(recallRes.data.encryptedBlob, aesKey);

if (decrypted !== MEMORY) {
  console.error("✗ INTEGRITY FAILURE — decrypted content does not match original");
  process.exit(1);
}

console.log("   ✓ Decrypted — integrity verified\n");
console.log("── PLAINTEXT (decrypted locally, never sent to server) ──────────");
console.log(decrypted.split("\n").map(l => "   " + l).join("\n"));

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  Full ZK loop proven ✓");
console.log(`  CID: ${cid}`);
console.log(`  → Connect trav.eth on mimirwell.net and REVOKE thorai.eth`);
console.log(`  → Re-run this script — step [5/5] will return 403 DENIED`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
