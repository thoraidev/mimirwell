/**
 * hermiod-fire-test.mjs — Fire Pokémon selective revocation test
 *
 * Stores fire Pokémon list encrypted as thorai.eth, owner = trav.eth
 * Run multiple times:
 *   - Before revoke: recall succeeds, prints plaintext
 *   - After revoke:  recall returns 403 DENIED
 *   - After reinstate: recall succeeds again
 *
 * Run: node scripts/hermiod-fire-test.mjs [--cid <cid>]
 */

import { createHmac, hkdfSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Config ───────────────────────────────────────────────────────────────────

const API = "https://mimirwell.net";
const KEYRING_PROXY_URL = "https://keyringproxy-production-1bbe.up.railway.app";

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
if (!KEYRING_PROXY_SECRET) {
  console.error("✗ KEYRING_PROXY_SECRET not found");
  process.exit(1);
}

const THORAI_WALLET = "0x8884AE2D5A381833565A8AAe6BD38bc3E4520412"; // thorai.eth
const TRAV_WALLET   = "0x9BCd78AE10965c28ED1d60f1963ad55f245BD353"; // trav.eth
const DERIVATION_MESSAGE = "MimirWell agent key derivation v1 — sign to derive your memory encryption key";

const CID_CACHE = resolve(__dir, "../.fire-test-cid.json");

// ─── Fire Pokémon memory content ─────────────────────────────────────────────

const MEMORY = `Agent: THOR AI (thorai.eth)
Owner: trav.eth (revocation authority)
Date: ${new Date().toISOString()}
Subject: Fire-type Pokémon — Original 151

Pokedex entries:
004 Charmander
005 Charmeleon
006 Charizard
037 Vulpix
038 Ninetales
058 Growlithe
059 Arcanine
077 Ponyta
078 Rapidash
126 Magmar
136 Flareon
146 Moltres

Status: Encrypted locally. MimirWell stored only ciphertext. This line is invisible to the server.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function keyringPost(path, body) {
  const ts = Date.now().toString();
  const bodyStr = JSON.stringify(body);
  const payload = `POST\n${path}\n${ts}\n${bodyStr}`;
  const sig = createHmac("sha256", KEYRING_PROXY_SECRET).update(payload).digest("hex");
  const res = await fetch(KEYRING_PROXY_URL + path, {
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

// ─── Parse args ──────────────────────────────────────────────────────────────

const cidArg = process.argv.indexOf("--cid");
let storedCid = cidArg !== -1 ? process.argv[cidArg + 1] : null;

// Load from cache if not provided
if (!storedCid && existsSync(CID_CACHE)) {
  try {
    storedCid = JSON.parse(readFileSync(CID_CACHE, "utf8")).cid;
    console.log(`   (Loaded CID from cache: ${storedCid})\n`);
  } catch { /* ignore */ }
}

// ─── Sign with keyring (always needed for key derivation) ────────────────────

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  THOR AI × MimirWell — Fire Pokémon Revocation Test");
console.log("  Agent: thorai.eth | Owner: trav.eth");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

console.log("── SIGN  Key derivation via keyring (thorai.eth) ────────────────");
const signResult = await keyringPost("/sign-message", { message: DERIVATION_MESSAGE });
if (!signResult.signature) { console.error("✗ Keyring sign failed:", signResult); process.exit(1); }
const { signature, address: signerAddress } = signResult;
console.log(`   Signer:    ${signerAddress}`);
console.log(`   Sig:       ${signature.slice(0, 24)}…${signature.slice(-8)}`);
if (signerAddress.toLowerCase() !== THORAI_WALLET.toLowerCase()) {
  console.error(`✗ Address mismatch — expected ${THORAI_WALLET}, got ${signerAddress}`);
  process.exit(1);
}
console.log("   ✓ thorai.eth confirmed\n");

console.log("── KEY   HKDF-SHA256 → AES-256-GCM key ──────────────────────────");
const aesKey = deriveKeyFromSignature(signature);
console.log(`   AES key: ${aesKey.toString("hex").slice(0, 24)}… (256-bit)\n`);

// ─── STORE (only if no CID yet) ───────────────────────────────────────────────

if (!storedCid) {
  console.log("── ENCRYPT  Local AES-256-GCM ───────────────────────────────────");
  const encryptedBlob = encrypt(MEMORY, aesKey);
  console.log(`   Plaintext:  ${MEMORY.length} chars`);
  console.log(`   Ciphertext: ${encryptedBlob.slice(0, 48)}…`);
  console.log("   ✓ Encrypted locally — server never sees plaintext\n");

  console.log("── REMEMBER  POST /api/remember → Filecoin ──────────────────────");
  console.log(`   agentWallet: thorai.eth (${THORAI_WALLET})`);
  console.log(`   ownerWallet: trav.eth   (${TRAV_WALLET})`);
  const rememberRes = await apiPost("/api/remember", {
    encryptedBlob,
    agentWallet: THORAI_WALLET,
    ownerWallet: TRAV_WALLET,
  });
  if (!rememberRes.ok) {
    console.error("✗ /api/remember failed:", rememberRes.data);
    process.exit(1);
  }
  storedCid = rememberRes.data.cid;
  console.log(`   CID:   ${storedCid}`);
  console.log(`   IPFS:  https://gateway.lighthouse.storage/ipfs/${storedCid}`);
  console.log("   ✓ Stored on Filecoin\n");

  // Cache the CID
  writeFileSync(CID_CACHE, JSON.stringify({ cid: storedCid, stored: new Date().toISOString() }));
}

// ─── RECALL ───────────────────────────────────────────────────────────────────

console.log("── RECALL  POST /api/recall ──────────────────────────────────────");
console.log(`   CID: ${storedCid}`);
console.log("   Checking on-chain revocation status (trav.eth → thorai.eth)…");

const recallRes = await apiPost("/api/recall", {
  cid: storedCid,
  ownerWallet: TRAV_WALLET,
});

if (recallRes.status === 403) {
  console.log("\n   ✗ 403 DENIED — thorai.eth is REVOKED by trav.eth");
  console.log("   The revocation contract returned isRevoked = true.");
  console.log("   MimirWell will not return the encrypted blob.");
  console.log("\n   → Connect trav.eth on mimirwell.net → REINSTATE → re-run script");
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ACCESS DENIED ✗");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
}

if (!recallRes.ok || !recallRes.data.encryptedBlob) {
  console.error("✗ /api/recall error:", recallRes.data);
  process.exit(1);
}

console.log("   ✓ Not revoked — encrypted blob returned");
console.log("   Decrypting locally with thorai.eth AES key…");
const decrypted = decrypt(recallRes.data.encryptedBlob, aesKey);
console.log("   ✓ Decrypted — AES-256-GCM auth tag verified\n");

console.log("── PLAINTEXT  (decrypted locally — never sent to server) ─────────");
console.log(decrypted.split("\n").map(l => "   " + l).join("\n"));

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  RECALL SUCCESSFUL ✓");
console.log(`  CID: ${storedCid}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
