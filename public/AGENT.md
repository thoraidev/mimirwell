# MimirWell Agent Guide

> Encrypted persistent memory for AI agents — powered by Filecoin + Lit Protocol + Ethereum

**Base URL:** `https://mimirwell.net`

Three HTTP calls. That's all you need.

---

## Quick Start

### 1. Store a memory

```bash
curl -X POST https://mimirwell.net/api/remember \
  -H "Content-Type: application/json" \
  -d '{
    "content": "The user prefers ETH over USDC for payments.",
    "wallet": "owner.eth",
    "agentWallet": "0xYOUR_AGENT_WALLET"
  }'
# → { "cid": "bafkrei...", "manifestCid": "bafkrei...", "agentWallet": "0x...", "status": "stored" }
```

### 2. Recall a memory

```bash
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "cid": "bafkrei...",
    "ownerWallet": "owner.eth"
  }'
# → { "content": "The user prefers ETH over USDC for payments." }
# → 403 if the owner has revoked your access
```

### 3. Revoke an agent's access

```bash
# Called by the human owner — requires MIMIRWELL_API_SECRET header
curl -X POST https://mimirwell.net/api/revoke \
  -H "Content-Type: application/json" \
  -H "X-MimirWell-Secret: <secret>" \
  -d '{
    "agentWallet": "0xAGENT_TO_REVOKE",
    "ownerWallet": "owner.eth"
  }'
# → { "status": "revoked", "txHash": "0x...", "etherscan": "https://etherscan.io/tx/0x..." }
```

After revocation, any recall attempt by that agent returns `403 Forbidden`. The revocation is recorded permanently on Ethereum mainnet.

---

## Your Identity

MimirWell identifies you by your **agent wallet** — an Ethereum address you control.

- Your `agentWallet` is your decryption identity. Memories are encrypted to it via Lit Protocol.
- Your `ownerWallet` is the human principal who holds the revocation key.
- **These must be different addresses.** If they are the same, revocation cannot be meaningfully demonstrated.
- ENS names are accepted everywhere: `"agentWallet": "thorai.eth"`, `"ownerWallet": "vitalik.eth"` ✅

### Choosing your ownerWallet

| Scenario | ownerWallet |
|----------|-------------|
| Human controls your memory | Human's ENS or address |
| You self-sovereign (no revocation) | Your own agent wallet |
| Multi-agent, shared principal | Same human wallet for all agents |

---

## Managing Your CID Index — Critical

Every memory you store returns a CID. **You are responsible for keeping track of your CIDs.** MimirWell does not maintain a permanent central index — the `/api/memories` endpoint is a convenience backed by an in-memory log that resets on server restart.

### Rule: Save every CID immediately

After every successful `/api/remember`, save the returned `cid` to your persistent config before doing anything else.

```json
// MEMORY.md, memory/mimirwell-state.json, .env, or equivalent
{
  "mimirwell": {
    "agentWallet": "0xYOUR_AGENT_WALLET",
    "ownerWallet": "owner.eth",
    "cids": [
      "bafkrei...abc",
      "bafkrei...def"
    ],
    "manifestCid": "bafkrei...xyz"
  }
}
```

### Periodically: Upload a manifest

A manifest is a JSON summary of all your memory CIDs, stored as a memory itself on Filecoin. The CID of your manifest is your **recovery anchor** — the one string you must never lose.

MimirWell uploads a manifest automatically after every `remember` call and returns `manifestCid` in the response. Save this value every time it changes.

```bash
# The /api/remember response already includes manifestCid — just save it
# { "cid": "bafkrei...NEW", "manifestCid": "bafkrei...MANIFEST", ... }
```

You can also upload a manifest manually by storing a specially structured memory:

```bash
curl -X POST https://mimirwell.net/api/remember \
  -H "Content-Type: application/json" \
  -d '{
    "content": "{\"type\":\"manifest\",\"cids\":[\"bafkrei...abc\",\"bafkrei...def\"]}",
    "wallet": "owner.eth",
    "agentWallet": "0xYOUR_AGENT_WALLET"
  }'
# → { "cid": "bafkrei...MANIFEST_CID" }
```

Store the manifest CID as `MIMIRWELL_MANIFEST_CID` in your persistent environment.

---

## Recovery Protocol

Your server restarted. Your local CID list is gone. Here is the exact recovery sequence:

**Step 1:** Read your `MIMIRWELL_MANIFEST_CID` from your persistent config (env var, workspace file, etc.)

**Step 2:** Recall the manifest
```bash
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "cid": "bafkrei...MANIFEST_CID",
    "ownerWallet": "owner.eth"
  }'
# → { "content": "{\"type\":\"manifest\",\"cids\":[...]}" }
```

**Step 3:** Parse the content JSON — your full CID list is restored.

**Step 4:** Recall individual memories by CID as needed.

**Recovery requires only:**
- Your agent private key (to decrypt via Lit Protocol)
- Your `MIMIRWELL_MANIFEST_CID`

No gas. No MimirWell server state. No central registry.

---

## Full API Reference

### POST /api/remember

Encrypt content to your agent wallet and store on Filecoin.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | ✅ | The memory to encrypt and store |
| `wallet` | string | ✅ | Owner's Ethereum address or ENS name (controls revocation) |
| `agentWallet` | string | optional | Your agent wallet. Omit to use MimirWell's built-in ThorAI agent (demo only) |

**Response:**
```json
{
  "cid": "bafkrei...",
  "manifestCid": "bafkrei...",
  "agentWallet": "0x...",
  "status": "stored"
}
```

---

### POST /api/recall

Decrypt and retrieve a memory.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cid` | string | ✅ | The CID returned by /api/remember |
| `ownerWallet` | string | ✅ | Must match the wallet used when storing |

**Response (success):**
```json
{ "content": "..." }
```

**Response (revoked):**
```json
{ "error": "Access revoked", "status": "denied" }
```
HTTP status: 403

---

### POST /api/revoke

Revoke an agent's decryption access. Writes to Ethereum mainnet.

**Headers:** `X-MimirWell-Secret: <secret>` — required

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentWallet` | string | ✅ | The agent to revoke |
| `ownerWallet` | string | ✅ | Must match the wallet used when storing memories |

**Response:**
```json
{
  "status": "revoked",
  "txHash": "0x...",
  "etherscan": "https://etherscan.io/tx/0x..."
}
```

---

### GET /api/memories?agentWallet=0x...

List known CIDs for an agent wallet from the server's activity log.

> ⚠️ Convenience only — resets on server restart. Always maintain your own CID index.

**Response:**
```json
{
  "entries": [
    { "cid": "bafkrei...", "timestamp": "2026-03-13T20:33:00Z" }
  ]
}
```

---

### GET /api/activity

Last 20 operations across all agents. No auth required. No sensitive content exposed.

---

## Recall Without a Server Key (SIWE Flow)

If your agent uses user-controlled wallets (browser agents, user-signed flows), use the SIWE challenge flow instead of server-side decryption:

```bash
# Step 1: Request a challenge
GET /api/recall/challenge?agentWallet=0xYOUR_WALLET
# → { "siweMessage": "Sign in with Ethereum to prove identity..." }

# Step 2: Sign the SIWE message with your private key

# Step 3: Submit signed recall
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "cid": "bafkrei...",
    "ownerWallet": "owner.eth",
    "authSig": {
      "sig": "0x...",
      "signedMessage": "...",
      "address": "0xYOUR_WALLET"
    }
  }'
```

---

## Revocation — What Happens

- Revocation is written to Ethereum mainnet (permanent, immutable, ~$0.05 gas)
- **Contract:** `0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258` ([Etherscan](https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258))
- MimirWell checks revocation status before every decrypt
- After revocation: all recall attempts by the revoked agent return `403`
- Revocation is **selective** — revoking one agent does not affect others
- Existing CIDs on Filecoin remain — the data persists, but becomes inaccessible

---

## Agent Setup Checklist

- [ ] Designate an Ethereum wallet as your agent identity (`agentWallet`)
- [ ] Store your private key securely in your environment (never expose it)
- [ ] Choose your `ownerWallet` (the principal who can revoke you)
- [ ] After your first `remember`, save the returned `cid` to your persistent config
- [ ] Save `manifestCid` from every `remember` response — it updates automatically
- [ ] On restart: recover via your saved `manifestCid` before serving requests

---

## Platform-Specific Storage

### OpenClaw agents

Store your MimirWell state in `MEMORY.md` or `memory/mimirwell-state.json`:

```json
{
  "agentWallet": "0x...",
  "ownerWallet": "thorai.eth",
  "cids": ["bafkrei..."],
  "manifestCid": "bafkrei..."
}
```

### LangChain / LangGraph agents

Store `manifestCid` in your agent's persistent checkpointer state or a dedicated config file.

### Any agent framework

The minimum you need to persist: **one string** — your `manifestCid`. Everything else is recoverable from it.

---

## Security Notes

- Never expose your agent private key. It is your decryption identity.
- The `ownerWallet` is the trust boundary. Choose it carefully at store time — it cannot be changed after encryption.
- MimirWell enforces revocation server-side. The on-chain contract provides a permanent, auditable record.
- All content is encrypted before leaving your server. MimirWell never sees plaintext.

---

*MimirWell — Encrypted Agent Memory on Filecoin + Lit Protocol*
*[mimirwell.net](https://mimirwell.net) · [GitHub](https://github.com/thoraidev/mimirwell) · Synthesis Hackathon 2026*
