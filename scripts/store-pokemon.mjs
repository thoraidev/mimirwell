/**
 * store-pokemon.mjs — Store "Pokemon" as a MimirWell memory (thorai.eth)
 * Following AGENT.md instructions exactly.
 */

import { createHmac, hkdfSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const API = "https://mimirwell.net";
const KEYRING_PROXY_URL = "https://keyringproxy-production-1bbe.up.railway.app";
const THORAI_WALLET = "0x8884AE2D5A381833565A8AAe6BD38bc3E4520412";
const TRAV_WALLET   = "0x9BCd78AE10965c28ED1d60f1963ad55f245BD353";
const DERIVATION_MESSAGE = "MimirWell agent key derivation v1 — sign to derive your memory encryption key";

// Load keyring secret
const __dir = dirname(fileURLToPath(import.meta.url));
let KEYRING_PROXY_SECRET = process.env.KEYRING_PROXY_SECRET ?? "";
if (!KEYRING_PROXY_SECRET) {
  const p = resolve(process.env.HOME ?? "/root", ".openclaw/secrets/keyring.env");
  try {
    const match = readFileSync(p, "utf8").match(/KEYRING_PROXY_SECRET=(.+)/);
    if (match) KEYRING_PROXY_SECRET = match[1].trim();
  } catch {}
}
if (!KEYRING_PROXY_SECRET) { console.error("✗ KEYRING_PROXY_SECRET not found"); process.exit(1); }

async function keyringPost(path, body) {
  const ts = Date.now().toString();
  const bodyStr = JSON.stringify(body);
  const sig = createHmac("sha256", KEYRING_PROXY_SECRET).update(`POST\n${path}\n${ts}\n${bodyStr}`).digest("hex");
  const res = await fetch(KEYRING_PROXY_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Keyring-Timestamp": ts, "X-Keyring-Signature": sig },
    body: bodyStr,
  });
  return res.json();
}

function deriveKeyFromSignature(hexSig) {
  const sigBytes = Buffer.from(hexSig.replace(/^0x/, ""), "hex");
  return Buffer.from(hkdfSync("sha256", sigBytes, Buffer.from("mimirwell-v1"), Buffer.from("agent-memory-key"), 32));
}

function encrypt(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decrypt(blob, key) {
  const buf = Buffer.from(blob, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log("\n[1/4] Signing derivation message with thorai.eth via keyring…");
const { signature, address } = await keyringPost("/sign-message", { message: DERIVATION_MESSAGE });
if (!signature) { console.error("✗ Keyring sign failed"); process.exit(1); }
console.log(`      Signer: ${address} ✓`);

console.log("[2/4] Deriving AES-256 key (HKDF-SHA256)…");
const aesKey = deriveKeyFromSignature(signature);

console.log("[3/4] Encrypting 'Pokemon' locally…");
const encryptedBlob = encrypt("Pokemon", aesKey);
console.log(`      Cipher: ${encryptedBlob.slice(0, 48)}…`);

console.log("[4/4] POST /api/remember → Filecoin…");
const storeRes = await apiPost("/api/remember", {
  encryptedBlob,
  agentWallet: THORAI_WALLET,
  ownerWallet: TRAV_WALLET,
});
if (!storeRes.ok) { console.error("✗ remember failed:", storeRes.data); process.exit(1); }
const { cid } = storeRes.data;
console.log(`      CID: ${cid}`);

// Verify with recall
console.log("\n[verify] POST /api/recall…");
const recallRes = await apiPost("/api/recall", { cid });
if (recallRes.status === 403) { console.log("✗ 403 DENIED — currently revoked"); process.exit(0); }
const plaintext = decrypt(recallRes.data.encryptedBlob, aesKey);
console.log(`         Decrypted: "${plaintext}"`);
if (plaintext !== "Pokemon") { console.error("✗ Integrity check failed!"); process.exit(1); }

// Save CID
const INDEX = resolve(__dir, "../memories.json");
const entries = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : [];
entries.push({ label: "Pokemon", cid, storedAt: new Date().toISOString() });
writeFileSync(INDEX, JSON.stringify(entries, null, 2));

console.log("\n✓ Memory stored and verified.");
console.log(`  Label:   Pokemon`);
console.log(`  CID:     ${cid}`);
console.log(`  Owner:   trav.eth`);
console.log(`  Agent:   thorai.eth`);
console.log(`  Index:   memories.json\n`);
