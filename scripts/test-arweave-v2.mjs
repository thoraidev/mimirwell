/**
 * test-arweave-v2.mjs — End-to-end zk-v2 test (gzip + AES-256-GCM → Arweave)
 *
 * Usage:
 *   node scripts/test-arweave-v2.mjs "Your memory text here"
 *
 * Stores → verifies txId → recalls → decrypts & decompresses → prints plaintext
 */

import { hkdfSync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { privateKeyToAddress } from 'viem/accounts';

// ── Load env ──────────────────────────────────────────────────────────────────

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i+1).trim()]; })
);

const AGENT_SECRET = env.AGENT_PRIVATE_KEY;
if (!AGENT_SECRET) { console.error('AGENT_PRIVATE_KEY not in .env.local'); process.exit(1); }

const AGENT_WALLET = privateKeyToAddress(AGENT_SECRET);
const OWNER = 'trav.eth';
const PLAINTEXT = process.argv[2] || 'The quick brown fox jumped over the lazy dog.';
const BASE_URL = process.argv[3] || 'https://mimirwell.net';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('MimirWell zk-v2 Arweave test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Agent wallet :', AGENT_WALLET);
console.log('Owner        :', OWNER);
console.log('Plaintext    :', PLAINTEXT);
console.log('Endpoint     :', BASE_URL);
console.log();

// ── Crypto helpers ────────────────────────────────────────────────────────────

const V2_MARKER = 0x02;

function deriveKey(agentSecret) {
  const secret = Buffer.from(agentSecret.replace('0x',''), 'hex');
  return Buffer.from(hkdfSync('sha256', secret, Buffer.from('mimirwell-v1'), Buffer.from('agent-memory-key'), 32));
}

function compressAndEncrypt(plaintext, agentSecret) {
  const key = deriveKey(agentSecret);
  const compressed = gzipSync(Buffer.from(plaintext, 'utf8'));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const marker = Buffer.alloc(1); marker[0] = V2_MARKER;
  return Buffer.concat([marker, iv, authTag, encrypted]).toString('base64');
}

function decryptAndDecompress(encryptedBlob, agentSecret) {
  const key = deriveKey(agentSecret);
  const buf = Buffer.from(encryptedBlob, 'base64');
  let offset = buf[0] === V2_MARKER ? 1 : 0;
  const iv       = buf.subarray(offset,      offset + 12);
  const authTag  = buf.subarray(offset + 12, offset + 28);
  const ciphertext = buf.subarray(offset + 28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return gunzipSync(decrypted).toString('utf8');
}

// ── STEP 1: Encrypt + compress ────────────────────────────────────────────────

const encryptedBlob = compressAndEncrypt(PLAINTEXT, AGENT_SECRET);
const blobBytes = Buffer.byteLength(encryptedBlob, 'utf8');
const plaintextBytes = Buffer.byteLength(PLAINTEXT, 'utf8');
console.log(`[1/3] Encrypted (zk-v2)`);
console.log(`      Plaintext: ${plaintextBytes} bytes  →  blob: ${blobBytes} bytes`);
console.log(`      Blob preview: ${encryptedBlob.slice(0, 32)}…`);
console.log();

// ── STEP 2: POST /api/remember ────────────────────────────────────────────────

console.log('[2/3] POSTing to /api/remember …');
const rememberRes = await fetch(`${BASE_URL}/api/remember`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    encryptedBlob,
    agentWallet: AGENT_WALLET,
    ownerWallet: OWNER,
    version: 'zk-v2',
  }),
});

const rememberData = await rememberRes.json();
console.log(`      HTTP ${rememberRes.status}:`, JSON.stringify(rememberData, null, 2));

if (rememberRes.status !== 200 || !rememberData.txId) {
  console.error('\n❌ Store failed — aborting recall test');
  process.exit(1);
}

const txId = rememberData.txId;
console.log(`\n      ✅ Stored! txId: ${txId}`);
console.log(`      URL: https://arweave.net/${txId}`);
console.log();

// ── STEP 3: POST /api/recall ──────────────────────────────────────────────────

console.log('[3/3] POSTing to /api/recall …');
const recallRes = await fetch(`${BASE_URL}/api/recall`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ txId, agentWallet: AGENT_WALLET, ownerWallet: OWNER }),
});

const recallData = await recallRes.json();
console.log(`      HTTP ${recallRes.status}:`, JSON.stringify({ ...recallData, encryptedBlob: recallData.encryptedBlob ? '[base64 blob]' : undefined }, null, 2));

if (recallRes.status !== 200 || !recallData.encryptedBlob) {
  console.warn('\n⚠️  Recall may fail if Arweave has not indexed the txId yet (< 2 min propagation).');
  console.log(`      Try again in 2 minutes: node scripts/test-arweave-v2.mjs "${PLAINTEXT}"`);
  process.exit(0);
}

// Decrypt + decompress
const version = recallData.version ?? 'zk-v2';
let recovered;
try {
  recovered = decryptAndDecompress(recallData.encryptedBlob, AGENT_SECRET);
} catch (e) {
  console.error('\n❌ Decryption failed:', e.message);
  process.exit(1);
}

console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('RESULT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Recovered plaintext:', recovered);
console.log('Match:', recovered === PLAINTEXT ? '✅ PASS' : `❌ FAIL (got: ${recovered})`);
console.log('Version:', version, '| Backend:', recallData.backend ?? 'arweave');
console.log('Arweave URL: https://arweave.net/' + txId);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
