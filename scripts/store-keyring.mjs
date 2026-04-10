/**
 * store-keyring.mjs
 * Store a memory on MimirWell using the thorai.eth keyring proxy wallet.
 *
 * Key derivation: sign fixed deterministic message via keyring proxy →
 * use signature as HKDF secret. RFC6979 = deterministic: same key + same
 * message = same signature = same derived key every time.
 *
 * Usage: node scripts/store-keyring.mjs "plaintext to store"
 */
import { hkdfSync, randomBytes, createCipheriv, createHmac, createDecipheriv } from 'crypto';

const KEYRING_PROXY_URL    = 'https://keyringproxy-production-1bbe.up.railway.app';
const KEYRING_PROXY_SECRET = '973a8c9070048c28c4f2fb5dcd52d1fbad6e764e67508aab13db77d3e9eae225';
const OWNER                = 'trav.eth';
const PLAINTEXT            = process.argv[2] || 'The quick brown fox jumps over the lazy dog.';

// ─── Keyring proxy HMAC auth (mirrors proxy-auth.js) ─────────────────────────
function computeHmac(secret, method, path, body) {
  const timestamp = Date.now().toString();
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return { 'X-Keyring-Timestamp': timestamp, 'X-Keyring-Signature': sig };
}

async function proxyPost(endpoint, body = {}) {
  const bodyStr = JSON.stringify(body);
  const headers = computeHmac(KEYRING_PROXY_SECRET, 'POST', endpoint, bodyStr);
  const res = await fetch(`${KEYRING_PROXY_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: bodyStr,
  });
  if (!res.ok) throw new Error(`Proxy ${endpoint} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// ─── Encryption ──────────────────────────────────────────────────────────────
function deriveKeyFromSig(signatureHex) {
  const sigBytes = Buffer.from(signatureHex.replace('0x', ''), 'hex');
  return Buffer.from(hkdfSync('sha256', sigBytes,
    Buffer.from('mimirwell-v1'),
    Buffer.from('agent-memory-key'), 32));
}

function encryptMemory(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('Fetching thorai.eth wallet address...');
const { address: AGENT_WALLET } = await proxyPost('/get-address');
console.log('Agent wallet:', AGENT_WALLET);

console.log('Signing deterministic key derivation message...');
const { signature } = await proxyPost('/sign-message', { message: 'mimirwell-v1-key-material' });
console.log('Signature obtained.');

const key = deriveKeyFromSig(signature);

const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(PLAINTEXT, 'utf8'), cipher.final()]);
const authTag = cipher.getAuthTag();
const encryptedBlob = Buffer.concat([iv, authTag, encrypted]).toString('base64');

console.log('Memory encrypted locally. Storing on MimirWell...');
const body = JSON.stringify({ encryptedBlob, agentWallet: AGENT_WALLET, ownerWallet: OWNER });
const res = await fetch('https://mimirwell.net/api/remember', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});
const data = await res.json();
console.log('\n✅ STATUS:', res.status);
console.log('CID:', data.cid);
console.log('Agent wallet:', data.agentWallet);
