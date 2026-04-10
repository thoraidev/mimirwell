import { hkdfSync, randomBytes, createCipheriv } from 'crypto';
import { readFileSync } from 'fs';
import { privateKeyToAddress } from 'viem/accounts';

// Parse .env.local
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i+1)]; })
);

const AGENT_SECRET = env.AGENT_PRIVATE_KEY;
const OWNER = 'trav.eth';
const PLAINTEXT = process.argv[2] || 'The quick brown fox jumps over the lazy dog.';

function deriveKey(agentSecret) {
  const secret = Buffer.from(agentSecret.replace('0x',''), 'hex');
  return Buffer.from(hkdfSync('sha256', secret,
    Buffer.from('mimirwell-v1'),
    Buffer.from('agent-memory-key'), 32));
}

function encryptMemory(plaintext, agentSecret) {
  const key = deriveKey(agentSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

const AGENT_WALLET = privateKeyToAddress(AGENT_SECRET);
console.log('Agent wallet:', AGENT_WALLET);

const encryptedBlob = encryptMemory(PLAINTEXT, AGENT_SECRET);
const body = JSON.stringify({ encryptedBlob, agentWallet: AGENT_WALLET, ownerWallet: OWNER });

const res = await fetch('https://mimirwell.net/api/remember', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});
const data = await res.json();
console.log('STATUS:', res.status, 'BODY:', JSON.stringify(data));
