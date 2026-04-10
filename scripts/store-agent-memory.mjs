/**
 * store-agent-memory.mjs — Store real agent memory to Arweave via MimirWell zk-v2
 *
 * Usage:
 *   node scripts/store-agent-memory.mjs "memory text or path to file"
 *   node scripts/store-agent-memory.mjs --file /path/to/memory.md
 */

import { hkdfSync, randomBytes, createCipheriv } from 'crypto';
import { gzipSync } from 'zlib';
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
const BASE_URL = 'https://mimirwell.net';

// ── Parse input ───────────────────────────────────────────────────────────────

let PLAINTEXT;
const fileFlag = process.argv.indexOf('--file');
if (fileFlag !== -1 && process.argv[fileFlag + 1]) {
  PLAINTEXT = readFileSync(process.argv[fileFlag + 1], 'utf8');
} else {
  PLAINTEXT = process.argv[2];
}

if (!PLAINTEXT) {
  console.error('Usage: node store-agent-memory.mjs "memory text"');
  console.error('       node store-agent-memory.mjs --file /path/to/memory.md');
  process.exit(1);
}

// ── Crypto ────────────────────────────────────────────────────────────────────

const V2_MARKER = 0x02;

function deriveKey(secret) {
  const raw = Buffer.from(secret.replace('0x',''), 'hex');
  return Buffer.from(hkdfSync('sha256', raw, Buffer.from('mimirwell-v1'), Buffer.from('agent-memory-key'), 32));
}

function compressAndEncrypt(plaintext, secret) {
  const key = deriveKey(secret);
  const compressed = gzipSync(Buffer.from(plaintext, 'utf8'));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const marker = Buffer.alloc(1); marker[0] = V2_MARKER;
  return Buffer.concat([marker, iv, authTag, encrypted]).toString('base64');
}

// ── Store ─────────────────────────────────────────────────────────────────────

const plaintextBytes = Buffer.byteLength(PLAINTEXT, 'utf8');
const encryptedBlob = compressAndEncrypt(PLAINTEXT, AGENT_SECRET);
const blobBytes = Buffer.byteLength(encryptedBlob, 'utf8');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('MimirWell — Store Agent Memory (zk-v2, Arweave)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Agent  : ${AGENT_WALLET}`);
console.log(`Owner  : ${OWNER}`);
console.log(`Size   : ${plaintextBytes} bytes plaintext → ${blobBytes} bytes encrypted`);
console.log(`Preview: ${PLAINTEXT.slice(0, 80).replace(/\n/g,' ')}…`);
console.log();

if (blobBytes > 90000) {
  console.error(`❌ Blob too large (${blobBytes} bytes). Max 90,000 bytes.`);
  process.exit(1);
}

console.log('Uploading to Arweave via MimirWell…');
const res = await fetch(`${BASE_URL}/api/remember`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    encryptedBlob,
    agentWallet: AGENT_WALLET,
    ownerWallet: OWNER,
    version: 'zk-v2',
  }),
});

const data = await res.json();

if (res.status !== 200 || !data.txId) {
  console.error('❌ Failed:', JSON.stringify(data));
  process.exit(1);
}

console.log();
console.log('✅ Stored permanently on Arweave');
console.log(`   txId : ${data.txId}`);
console.log(`   URL  : https://arweave.net/${data.txId}`);
console.log(`   Agent: ${data.agentWallet}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
