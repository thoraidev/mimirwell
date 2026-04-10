/**
 * recall-keyring.mjs
 * Recall and decrypt a memory from MimirWell using the thorai.eth keyring proxy wallet.
 *
 * Key derivation: sign fixed deterministic message via keyring proxy →
 * use signature as HKDF secret. Same key + same message = same derived key every time.
 *
 * Usage: node scripts/recall-keyring.mjs <CID>
 */
import { hkdfSync, randomBytes, createDecipheriv, createHmac } from 'crypto';

const KEYRING_PROXY_URL    = 'https://keyringproxy-production-1bbe.up.railway.app';
const KEYRING_PROXY_SECRET = '973a8c9070048c28c4f2fb5dcd52d1fbad6e764e67508aab13db77d3e9eae225';

const CID = process.argv[2];
if (!CID) { console.error('Usage: node scripts/recall-keyring.mjs <CID>'); process.exit(1); }

// ─── Keyring proxy HMAC auth ──────────────────────────────────────────────────
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

// ─── Decryption ───────────────────────────────────────────────────────────────
function deriveKeyFromSig(signatureHex) {
  const sigBytes = Buffer.from(signatureHex.replace('0x', ''), 'hex');
  return Buffer.from(hkdfSync('sha256', sigBytes,
    Buffer.from('mimirwell-v1'),
    Buffer.from('agent-memory-key'), 32));
}

function decryptMemory(encryptedBlob, key) {
  const buf = Buffer.from(encryptedBlob, 'base64');
  const iv       = buf.subarray(0, 12);
  const authTag  = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('Fetching thorai.eth wallet address...');
const { address: AGENT_WALLET } = await proxyPost('/get-address');
console.log('Agent wallet:', AGENT_WALLET);

console.log('Signing deterministic key derivation message...');
const { signature } = await proxyPost('/sign-message', { message: 'mimirwell-v1-key-material' });
console.log('Signature obtained.');

const key = deriveKeyFromSig(signature);

console.log(`Recalling CID: ${CID} ...`);
const res = await fetch('https://mimirwell.net/api/recall', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cid: CID }),
});

if (res.status === 403) {
  const data = await res.json();
  console.log('\n🚫 ACCESS DENIED — memory revoked.');
  console.log(JSON.stringify(data, null, 2));
  process.exit(1);
}

if (!res.ok) {
  console.error('\n❌ Recall failed:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const plaintext = decryptMemory(data.encryptedBlob, key);

console.log('\n✅ Recalled & decrypted:');
console.log(plaintext);
