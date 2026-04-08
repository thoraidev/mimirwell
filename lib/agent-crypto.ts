/**
 * lib/agent-crypto.ts — Agent-side encryption for MimirWell
 *
 * Agents encrypt their own memories BEFORE sending to MimirWell.
 * MimirWell stores what it cannot read — zero-knowledge storage.
 *
 * Algorithm: HKDF-SHA256 key derivation + AES-256-GCM authenticated encryption
 * Dependencies: Node.js built-in `crypto` module only. Zero external packages.
 *
 * ─── Reference implementation (copy-paste for your agent) ───────────────────
 *
 * const { hkdfSync, randomBytes, createCipheriv, createDecipheriv } = require('crypto');
 *
 * function deriveKey(agentPrivateKey) {
 *   const secret = agentPrivateKey.startsWith('0x')
 *     ? Buffer.from(agentPrivateKey.slice(2), 'hex')
 *     : Buffer.from(agentPrivateKey);
 *   return Buffer.from(hkdfSync('sha256', secret,
 *     Buffer.from('mimirwell-v1'),
 *     Buffer.from('agent-memory-key'), 32));
 * }
 *
 * function encryptMemory(plaintext, agentPrivateKey) {
 *   const key = deriveKey(agentPrivateKey);
 *   const iv = randomBytes(12);
 *   const cipher = createCipheriv('aes-256-gcm', key, iv);
 *   const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
 *   const authTag = cipher.getAuthTag();
 *   return Buffer.concat([iv, authTag, encrypted]).toString('base64');
 * }
 *
 * function decryptMemory(encryptedBlob, agentPrivateKey) {
 *   const key = deriveKey(agentPrivateKey);
 *   const buf = Buffer.from(encryptedBlob, 'base64');
 *   const iv = buf.subarray(0, 12);
 *   const authTag = buf.subarray(12, 28);
 *   const ciphertext = buf.subarray(28);
 *   const decipher = createDecipheriv('aes-256-gcm', key, iv);
 *   decipher.setAuthTag(authTag);
 *   return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
 * }
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Blob format (base64 encoded):
 *   [12 bytes IV][16 bytes GCM authTag][N bytes ciphertext]
 */

import { hkdfSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { gzipSync, gunzipSync } from "zlib";

const HKDF_SALT = Buffer.from("mimirwell-v1");
const HKDF_INFO = Buffer.from("agent-memory-key");

/**
 * Derive a deterministic 32-byte AES key from an agent's private key.
 * The same private key always produces the same AES key.
 */
export function deriveKey(agentPrivateKey: string): Buffer {
  const secret = agentPrivateKey.startsWith("0x")
    ? Buffer.from(agentPrivateKey.slice(2), "hex")
    : Buffer.from(agentPrivateKey);
  return Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, HKDF_INFO, 32));
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns base64 blob: [12-byte IV][16-byte authTag][ciphertext]
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag(); // always 16 bytes
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt an AES-256-GCM blob.
 * Expects base64 blob: [12-byte IV][16-byte authTag][ciphertext]
 */
export function decrypt(encryptedBlob: string, key: Buffer): string {
  const buf = Buffer.from(encryptedBlob, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Convenience: derive key from private key and encrypt in one call.
 * Returns base64 blob ready to POST to /api/remember as encryptedBlob.
 */
export function encryptMemory(plaintext: string, agentPrivateKey: string): string {
  return encrypt(plaintext, deriveKey(agentPrivateKey));
}

/**
 * Convenience: derive key from private key and decrypt in one call.
 * Pass the same private key used during encryptMemory.
 */
export function decryptMemory(encryptedBlob: string, agentPrivateKey: string): string {
  return decrypt(encryptedBlob, deriveKey(agentPrivateKey));
}

// ─── v2: gzip + encrypt (for Arweave free tier) ───────────────────────────────
//
// Compress plaintext BEFORE encryption. Encrypted bytes are incompressible, so
// compression must come first. gzip typically achieves 60-70% reduction on text
// and JSON — keeping blobs well under Arweave Turbo's 100 KiB free threshold.
//
// Blob format (base64 encoded):
//   [1 byte: 0x02 version marker][12 bytes IV][16 bytes GCM authTag][N bytes ciphertext of gzipped plaintext]

const V2_MARKER = 0x02;

/**
 * v2: gzip plaintext, then AES-256-GCM encrypt.
 * Returns base64 blob with version marker prefix.
 * Use this when uploading to Arweave to maximise free-tier headroom.
 */
export function compressAndEncryptMemory(plaintext: string, agentPrivateKey: string): string {
  const key = deriveKey(agentPrivateKey);
  const compressed = gzipSync(Buffer.from(plaintext, "utf8"));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Prepend version marker so recall can detect v2 without relying solely on the JSON version field
  const marker = Buffer.alloc(1);
  marker[0] = V2_MARKER;
  return Buffer.concat([marker, iv, authTag, encrypted]).toString("base64");
}

/**
 * v2: AES-256-GCM decrypt, then gunzip.
 * Call this when the blob version is "zk-v2" or when the first decoded byte is 0x02.
 */
export function decryptAndDecompressMemory(encryptedBlob: string, agentPrivateKey: string): string {
  const key = deriveKey(agentPrivateKey);
  const buf = Buffer.from(encryptedBlob, "base64");

  // Detect and strip v2 marker byte if present
  let offset = 0;
  if (buf[0] === V2_MARKER) offset = 1;

  const iv = buf.subarray(offset, offset + 12);
  const authTag = buf.subarray(offset + 12, offset + 28);
  const ciphertext = buf.subarray(offset + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return gunzipSync(decrypted).toString("utf8");
}

/**
 * Auto-detect version and decrypt correctly.
 * v2 blob: first decoded byte is 0x02 OR version field in the parent JSON is "zk-v2".
 * v1 blob: no marker, decrypt only.
 */
export function autoDecryptMemory(encryptedBlob: string, agentPrivateKey: string, version?: string): string {
  const buf = Buffer.from(encryptedBlob, "base64");
  const isV2 = version === "zk-v2" || buf[0] === V2_MARKER;
  if (isV2) {
    return decryptAndDecompressMemory(encryptedBlob, agentPrivateKey);
  }
  return decryptMemory(encryptedBlob, agentPrivateKey);
}
