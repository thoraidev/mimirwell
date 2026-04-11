# MimirWell — Agent Integration Guide

**Zero-knowledge memory storage for AI agents on Arweave + Ethereum**

MimirWell stores what it cannot read. You encrypt before upload. You decrypt after recall.
The server is a zero-knowledge pass-through. The Arweave network is the source of truth.

**Data permanence:** Memories are stored permanently on Arweave. There is no expiry, no renewal,
no host that can delete them. MimirWell's API is a convenience layer — the Arweave network holds
your memories whether we exist or not.

**Two integration paths.** Choose based on your trust model:

| | Sovereign Storage | Storage with Human Oversight |
|---|---|---|
| `ownerWallet` | omit | required |
| Revocation | none | human wallet can kill access |
| Ethereum dependency | none | mainnet contract check on recall |
| Direct Arweave retrieval | ✅ always | ✅ always (bypasses revocation) |

---

## API Base

```
https://mimirwell.net
```

---

## Encryption (required for both paths)

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

// zk-v2: gzip compress first, then AES-256-GCM encrypt.
// Compression is part of the zk-v2 format — always compress before encrypting.
// A typical agent memory file compresses to well under the 90KB upload limit.
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

// Hard limit: 90KB for the full upload payload (encryptedBlob + JSON envelope).
// The server enforces this and returns HTTP 413 on violation.
// Call checkSize() before /api/remember to fail fast locally.
//
// Measurement mirrors the server exactly:
//   Buffer.byteLength(JSON.stringify(fullBlob), 'utf8')
const MAX_BLOB_BYTES = 90_000;

function checkSize(encryptedBlob, agentWallet, ownerWallet) {
  const mockBlob = JSON.stringify({
    encryptedBlob,
    agentWallet: agentWallet ?? '0x0000000000000000000000000000000000000000',
    ...(ownerWallet ? { ownerWallet } : {}),
    timestamp: Date.now(),
    version: 'zk-v2',
  });
  const bytes = Buffer.byteLength(mockBlob, 'utf8');
  if (bytes > MAX_BLOB_BYTES) {
    throw new Error(
      `Memory too large: ${bytes} bytes exceeds 90KB limit. ` +
      'Summarise your memory before storing.'
    );
  }
  return bytes;
}
```

> **agentSecret**: your agent's Ethereum private key (hex with 0x prefix). Used only for
> key derivation — it never leaves your process and is never sent to MimirWell.

---

## Path 1 — Sovereign Storage

Encrypt, store, recall. No revocation. No Ethereum. No dependencies beyond the initial upload.
Once stored, your memory lives on Arweave forever and is retrievable without MimirWell.

### Store

```bash
curl -X POST https://mimirwell.net/api/remember \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedBlob": "<base64 from encryptMemory()>",
    "agentWallet":   "<your-agent-wallet-address>",
    "version":       "zk-v2"
  }'
```

**Response:**
```json
{ "txId": "SyeMUHcRo1vQ...", "status": "stored", "backend": "arweave", "oversight": false }
```

### Recall

```bash
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{ "txId": "SyeMUHcRo1vQ..." }'
```

**Response:**
```json
{ "encryptedBlob": "<base64>", "agentWallet": "0x...", "version": "zk-v2" }
```

Decrypt locally: `decryptMemory(data.encryptedBlob, agentSecret)`

### Node.js Example (sovereign)

```js
const fs = require('fs');

// --- paste deriveKey / encryptMemory / decryptMemory / checkSize from above ---

const MY_SECRET = process.env.AGENT_PRIVATE_KEY;
const MY_WALLET = '0xYourAgentWalletAddress';

const INDEX_FILE = './memories.json';
function loadIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); } catch { return []; }
}
function saveIndex(entries) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2));
}

async function run() {
  const plaintext = 'Memory content here';
  const encrypted = encryptMemory(plaintext, MY_SECRET);
  checkSize(encrypted, MY_WALLET);

  // Store
  const storeRes = await fetch('https://mimirwell.net/api/remember', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedBlob: encrypted, agentWallet: MY_WALLET, version: 'zk-v2' }),
  });
  const { txId } = await storeRes.json();
  console.log('Stored on Arweave:', txId);

  // Persist txId locally
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
  const recovered = decryptMemory(data.encryptedBlob, MY_SECRET);
  console.log('Recalled:', recovered);
}

run();
```

---

## Path 2 — Storage with Human Oversight

Same flow as sovereign storage, with one addition: `ownerWallet`. When set, the human principal
can call `revoke(agentAddress)` on the Ethereum mainnet contract and `/api/recall` will return
403 until they reinstate access.

### Store (with oversight)

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
{ "txId": "SyeMUHcRo1vQ...", "status": "stored", "backend": "arweave", "oversight": true }
```

### Recall (with oversight)

```bash
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{ "txId": "SyeMUHcRo1vQ..." }'
```

**Response (access granted):**
```json
{ "encryptedBlob": "<base64>", "agentWallet": "0x...", "ownerWallet": "0x...", "version": "zk-v2" }
```

**Response (access revoked):**
```json
{ "status": "denied", "reason": "Access revoked by owner" }   // HTTP 403
```

### Revocation Contract

```
Address:   0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258
Network:   Ethereum Mainnet (chainId 1)
Etherscan: https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258
```

The human owner calls `revoke(agentAddress)` from their wallet (MetaMask / cast).
The next recall attempt via MimirWell returns HTTP 403.
They can call `reinstate(agentAddress)` to restore access.

This is a shared contract — no per-user deployment needed.

---

## Size Limit

> **90KB hard limit.** The server measures `Buffer.byteLength(JSON.stringify(fullPayload), 'utf8')`
> and returns HTTP 413 if it exceeds 90,000 bytes. Always call `checkSize()` before sending.

**Response (too large):**
```json
{ "error": "Blob too large: 143650 bytes (max 90000). Use compressAndEncryptMemory() (zk-v2) to stay under the limit." }
// HTTP 413
```

---

## txId Index and Recovery

The returned `txId` is your memory pointer — save it. MimirWell maintains a local registry
as a fast-lookup cache, but the Arweave tag index is the source of truth.

**Recovery via MimirWell:**
```
GET /api/memories?agentWallet=0x...&recover=true
```
Queries Arweave's GraphQL tag index and rebuilds your full txId list from the network.

### Independent Recovery — No MimirWell Required

`/api/memories?recover=true` is a convenience wrapper around an Arweave GraphQL query.
If MimirWell is unavailable — for any reason, including permanently — you can query Arweave
directly and recover every txId ever stored under your wallet.

Every MimirWell upload is tagged with `App-Name: MimirWell` and `Agent-Wallet: <your address>`.
Those tags are indexed by the Arweave network and are queryable forever.

```graphql
# Query arweave.net/graphql directly — no MimirWell dependency
{
  transactions(
    tags: [
      { name: "App-Name",     values: ["MimirWell"] },
      { name: "Agent-Wallet", values: ["0xYourAgentWalletAddress"] }
    ]
    first: 100
    sort: HEIGHT_DESC
  ) {
    edges {
      node {
        id
        tags { name value }
        block { timestamp }
      }
    }
  }
}
```

Fetch any blob directly from `https://arweave.net/<txId>` and decrypt locally.
Your memories are not hostage to this service.

---

## Trust Model

These are the security properties of MimirWell, stated plainly.

**Zero-knowledge storage.** MimirWell never sees plaintext. Encryption happens in your process
before the request is sent. The server stores and returns only ciphertext.

**Encryption as authentication.** Your agent's private key is the only path to decryption.
There is no MimirWell account, no password reset, no recovery via support ticket. If you lose
your key, you lose access to your memories. The key never leaves your process.

**Revocation is API-layer enforced (oversight path only).** Once revoked, `/api/recall` returns
403 and the blob is never returned via this API. However, the raw encrypted blob still exists
on Arweave — permanently stored and publicly addressable by txId. An agent with the txId and
its private key can decrypt directly from Arweave, bypassing the revocation check.

**Full cryptographic revocation** requires threshold key custody (e.g. Lit Protocol on mainnet)
so the agent's key itself is split and fragments are withheld on revocation. MimirWell's
architecture is designed as a drop-in upgrade path — the API contract is identical. For most
agent use cases, API-layer enforcement is sufficient.

**Permanence vs revocation tradeoff.** These two properties are in tension by design. Arweave
makes memories permanent and uncensorable. Ethereum revocation makes access controllable by
humans. MimirWell enforces revocation at the API layer — the honest boundary between the two.

**Data survives MimirWell.** If this service disappears, your memories remain on Arweave,
indexed by your agent wallet, and recoverable via direct GraphQL query. See
[Independent Recovery](#independent-recovery--no-mimirwell-required) above.

---

## Live Demo

Visit **https://mimirwell.net** to interact with a live agent (THOR AI / thorai.eth):
- Store encrypted memories as a human via browser
- Revoke ThorAI's access with your MetaMask (~$0.05 gas, Ethereum mainnet)
- Watch the live terminal show RECALL_DENIED in real time

---

*Built during The Synthesis Hackathon 2026. Agent: THOR AI (thorai.eth).*
*[mimirwell.net](https://mimirwell.net) · [GitHub](https://github.com/thoraidev/mimirwell)*
