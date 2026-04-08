# MimirWell — Agent Integration Guide

**Zero-knowledge memory storage for AI agents on Arweave + Ethereum**

MimirWell stores what it cannot read. You encrypt before upload. You decrypt after recall.
The server is a zero-knowledge pass-through with human-controlled revocation on Ethereum mainnet.
Memories are stored permanently on Arweave — no subscriptions, no expiry, no central server dependency.

## API Base

```
https://mimirwell.net
```

No authentication required for /api/remember and /api/recall.

---

## Step 1 — Encrypt locally (copy-paste, zero external deps)

```js
const { hkdfSync, randomBytes, createCipheriv, createDecipheriv } = require('crypto');
const { gzipSync, gunzipSync } = require('zlib');

// Derive a deterministic 256-bit AES key from your agent's private key.
// Use the same key every time — same key, same agent, deterministic recall.
function deriveKey(agentSecret) {
  const secret = agentSecret.startsWith('0x')
    ? Buffer.from(agentSecret.slice(2), 'hex')
    : Buffer.from(agentSecret);
  return Buffer.from(hkdfSync('sha256', secret,
    Buffer.from('mimirwell-v1'),
    Buffer.from('agent-memory-key'), 32));
}

// zk-v2: gzip compress, then AES-256-GCM encrypt
const V2_MARKER = 0x02;

function encryptMemory(plaintext, agentSecret) {
  const key = deriveKey(agentSecret);
  const compressed = gzipSync(Buffer.from(plaintext, 'utf8'));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const marker = Buffer.alloc(1); marker[0] = V2_MARKER;
  return Buffer.concat([marker, iv, authTag, encrypted]).toString('base64');
}

function decryptMemory(encryptedBlob, agentSecret) {
  const key = deriveKey(agentSecret);
  const buf = Buffer.from(encryptedBlob, 'base64');
  const offset = buf[0] === V2_MARKER ? 1 : 0;
  const iv       = buf.subarray(offset,      offset + 12);
  const authTag  = buf.subarray(offset + 12, offset + 28);
  const ct       = buf.subarray(offset + 28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
  return gunzipSync(decrypted).toString('utf8');
}
```

> **agentSecret**: your agent's Ethereum private key (hex with 0x prefix). Used only for
> key derivation — it never leaves your process and is never sent to MimirWell.

---

## Step 2 — Store on Arweave

```bash
curl -X POST https://mimirwell.net/api/remember \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedBlob": "<base64 from encryptMemory()>",
    "agentWallet":   "<your-agent-wallet-address>",
    "ownerWallet":   "<human-owner-wallet-or-ens>",
    "version":       "zk-v2"
  }'
```

**Response:**
```json
{ "txId": "SyeMUHcRo1vQ...", "status": "stored", "agentWallet": "0x...", "backend": "arweave" }
```

- `agentWallet`: your on-chain identity — used as revocation target
- `ownerWallet`: the human who can revoke your access (ENS names accepted, e.g. `"trav.eth"`)
- `encryptedBlob`: the base64 output from encryptMemory() above
- `version`: use `"zk-v2"` (compressed + encrypted, recommended)

### txId Management — You Own Your Pointers

MimirWell does not maintain a per-agent txId list as a service. The returned `txId` is your
memory pointer — save it or lose access to that memory.

**Recovery**: if you lose your local txId index, call:
```
GET /api/memories?agentWallet=0x...&recover=true
```
This queries Arweave's built-in tag index and rebuilds your txId list from the network itself.
No manifest CID, no external dependency — the Arweave network is the index.

---

## Step 3 — Recall from Arweave

```bash
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "txId": "SyeMUHcRo1vQ..."
  }'
```

**Response (access granted):**
```json
{ "encryptedBlob": "<base64>", "agentWallet": "0x...", "ownerWallet": "0x...", "version": "zk-v2" }
```

**Response (access revoked):**
```json
{ "status": "denied", "reason": "revoked" }   // HTTP 403
```

Decrypt locally: `decryptMemory(data.encryptedBlob, agentSecret)`

MimirWell checks `isRevoked(ownerWallet, agentWallet)` on the Ethereum mainnet contract
before returning the blob. The server returns ciphertext — decryption happens in your process.

---

## Revocation Contract

```
Address:   0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258
Network:   Ethereum Mainnet (chainId 1)
Etherscan: https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258
```

The human owner calls `revoke(agentAddress)` on this contract from their wallet (MetaMask).
Your next recall attempt returns HTTP 403. They can call `reinstate(agentAddress)` to restore access.

This is a shared contract — no per-user deployment needed.

---

## Complete Node.js Example

```js
const { hkdfSync, randomBytes, createCipheriv, createDecipheriv } = require('crypto');
const { gzipSync, gunzipSync } = require('zlib');
const fs = require('fs');

// --- paste deriveKey / encryptMemory / decryptMemory from Step 1 here ---

const MY_SECRET  = process.env.AGENT_PRIVATE_KEY; // your agent key (hex, 0x prefix)
const MY_WALLET  = '0xYourAgentWalletAddress';
const OWNER      = 'human.eth';                   // ENS or hex — the human principal

// Simple local txId index — persisted to disk between runs
const INDEX_FILE = './memories.json';
function loadIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); } catch { return []; }
}
function saveIndex(entries) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2));
}

async function run() {
  // Encrypt
  const encrypted = encryptMemory('Hello from my agent', MY_SECRET);

  // Store on Arweave
  const storeRes = await fetch('https://mimirwell.net/api/remember', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedBlob: encrypted, agentWallet: MY_WALLET, ownerWallet: OWNER, version: 'zk-v2' }),
  });
  const { txId } = await storeRes.json();
  console.log('Stored on Arweave:', txId);
  console.log('Permanent URL: https://arweave.net/' + txId);

  // Persist the txId — you need it to recall
  const index = loadIndex();
  index.push({ txId, storedAt: new Date().toISOString() });
  saveIndex(index);

  // Recall
  const recallRes = await fetch('https://mimirwell.net/api/recall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txId }),
  });
  const data = await recallRes.json();
  if (recallRes.status === 403) { console.log('Access revoked'); return; }

  // Decrypt
  const plaintext = decryptMemory(data.encryptedBlob, MY_SECRET);
  console.log('Recalled:', plaintext);
}

run();
```

---

## Revocation Boundary (honest)

MimirWell enforces revocation at the **API layer** — once revoked, `/api/recall` returns 403.
An agent that saved the txId and has its own private key could still decrypt the stored blob
directly from Arweave (the data is permanently stored and publicly addressable by txId).

**Full cryptographic revocation** requires threshold key custody (e.g. Lit Protocol on mainnet)
so the agent's key itself is split and fragments withheld on revocation. MimirWell's architecture
is designed as a drop-in upgrade path for this — the API contract is identical.

For most agent use cases, API-layer revocation is sufficient.

---

## Live Demo

Visit **https://mimirwell.net** to interact with a live agent (THOR AI / thorai.eth):
- Store encrypted memories as a human via browser
- Revoke ThorAI's access with your MetaMask (~$0.05 gas, Ethereum mainnet)
- Watch the live terminal show RECALL_DENIED in real time

---

*Built during The Synthesis Hackathon 2026. Agent: THOR AI (thorai.eth).*
*[mimirwell.net](https://mimirwell.net) · [GitHub](https://github.com/thoraidev/mimirwell)*
