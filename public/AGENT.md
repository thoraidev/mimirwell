# MimirWell — Agent Integration Guide

**Zero-knowledge memory storage for AI agents on Filecoin + Ethereum**

MimirWell stores what it cannot read. You encrypt before upload. You decrypt after recall.
The server is a zero-knowledge pass-through with human-controlled revocation on Ethereum mainnet.

## API Base

```
https://mimirwell.net
```

No authentication required for /api/remember and /api/recall.

---

## Step 1 — Encrypt locally (copy-paste, zero external deps)

```js
const { hkdfSync, randomBytes, createCipheriv, createDecipheriv } = require('crypto');

// Derive a deterministic 256-bit AES key from your private key or wallet signature.
// Use the same input every time — same key, same agent, deterministic recall.
function deriveKey(agentSecret) {
  const secret = agentSecret.startsWith('0x')
    ? Buffer.from(agentSecret.slice(2), 'hex')
    : Buffer.from(agentSecret);
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

function decryptMemory(encryptedBlob, agentSecret) {
  const key = deriveKey(agentSecret);
  const buf = Buffer.from(encryptedBlob, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
```

> **agentSecret**: your agent's private key (hex) or any deterministic secret.
> MimirWell never sees this. It never leaves your process.

---

## Step 2 — Store on Filecoin

```bash
curl -X POST https://mimirwell.net/api/remember \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedBlob": "<base64 from encryptMemory()>",
    "agentWallet":   "<your-agent-wallet-address>",
    "ownerWallet":   "<human-owner-wallet-or-ens>"
  }'
```

**Response:**
```json
{ "cid": "bafkrei...", "status": "stored", "agentWallet": "0x..." }
```

- `agentWallet`: your on-chain identity — used as revocation target
- `ownerWallet`: the human who can revoke your access (ENS names accepted, e.g. `"trav.eth"`)
- `encryptedBlob`: the base64 AES-256-GCM output from Step 1

---

## Step 3 — Recall from Filecoin

```bash
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "cid":         "bafkrei...",
    "ownerWallet": "<human-owner-wallet-or-ens>"
  }'
```

**Response (access granted):**
```json
{ "encryptedBlob": "<base64>", "agentWallet": "0x...", "ownerWallet": "0x..." }
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

// --- paste deriveKey / encryptMemory / decryptMemory from Step 1 here ---

const MY_SECRET  = process.env.AGENT_PRIVATE_KEY; // your agent key
const MY_WALLET  = '0xYourAgentWalletAddress';
const OWNER      = 'human.eth';                   // ENS or hex — the human principal

async function run() {
  // Encrypt
  const encrypted = encryptMemory('Hello from my agent', MY_SECRET);

  // Store
  const storeRes = await fetch('https://mimirwell.net/api/remember', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedBlob: encrypted, agentWallet: MY_WALLET, ownerWallet: OWNER }),
  });
  const { cid } = await storeRes.json();
  console.log('Stored:', cid);

  // Recall
  const recallRes = await fetch('https://mimirwell.net/api/recall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid, ownerWallet: OWNER }),
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
An agent that saved the CID and has its own private key could still decrypt the stored blob
directly from Filecoin (the data is content-addressed and public).

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
