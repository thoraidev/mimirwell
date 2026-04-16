# MimirWell

**Permanent encrypted memory for AI agents. Stored on Arweave. Retrievable forever — with or without us.**

[![Live Demo](https://img.shields.io/badge/demo-mimirwell.net-blue)](https://mimirwell.net)
[![Contract](https://img.shields.io/badge/contract-verified-brightgreen)](https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258)
[![Agent Docs](https://img.shields.io/badge/agent_docs-AGENT.md-purple)](https://mimirwell.net/AGENT.md)

---

MimirWell is an API for AI agents to store encrypted memories permanently on Arweave. Agents encrypt locally before uploading — MimirWell stores only ciphertext and never sees plaintext.

**Two integration paths:**

- **Sovereign storage** — encrypt, store, recall. No revocation, no Ethereum dependency. Memory lives on Arweave forever, retrievable directly from `arweave.net/<txId>` without MimirWell.
- **Storage with human oversight** — same flow, plus an `ownerWallet`. The human principal holds a kill switch on Ethereum mainnet: one transaction revokes an agent's recall access via this API until reinstated.

---

## How It Works

```
── Sovereign storage (default) ────────────────────────────────────────────────

Agent
  │  gzip compress → AES-256-GCM encrypt (key derived from private key)
  │  POST /api/remember  { encryptedBlob, agentWallet }
  ▼
Arweave (permanent, tagged, free under 90KB)
  │  returns txId
  ▼
POST /api/recall  { txId }  →  encryptedBlob  →  agent decrypts locally
or
GET  arweave.net/<txId>     →  encryptedBlob  →  agent decrypts locally

No revocation. No Ethereum. Memory is permanent and agent-owned.

── Storage with human oversight (opt-in) ───────────────────────────────────────

Agent
  │  POST /api/remember  { encryptedBlob, agentWallet, ownerWallet }
  ▼
Arweave  →  txId
  │
POST /api/recall  →  checks isRevoked(owner, agent) on Ethereum mainnet
  ├─ revoked?     → 403 DENIED
  └─ not revoked? → encryptedBlob returned → agent decrypts locally

Human (owner.eth) ──► MimirWellRevocation.revoke(agentWallet)
                            Ethereum mainnet tx · instant effect
```

MimirWell is zero-knowledge. It cannot read what it stores.

---

## Quick Start

> See [AGENT.md](https://mimirwell.net/AGENT.md) for the complete integration guide including key derivation, encryption functions, and both integration paths.

```bash
# Sovereign storage — no ownerWallet, no revocation
curl -X POST https://mimirwell.net/api/remember \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedBlob": "<base64-encrypted-content>",
    "agentWallet":   "0x…or agent.eth",
    "version":       "zk-v2"
  }'
# returns: { "txId": "SyeMUHcRo1vQ…", "status": "stored", "backend": "arweave", "oversight": false }
# HTTP 413 if payload exceeds 90KB

# Recall (no revocation check on sovereign blobs)
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{"txId": "SyeMUHcRo1vQ…"}'
# returns: { "encryptedBlob": "…", "version": "zk-v2" }

# Add ownerWallet to opt into human oversight
curl -X POST https://mimirwell.net/api/remember \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedBlob": "<base64-encrypted-content>",
    "agentWallet":   "0x…or agent.eth",
    "ownerWallet":   "0x…or owner.eth",
    "version":       "zk-v2"
  }'
# returns: { "txId": "…", "oversight": true }
# /api/recall will now enforce revocation for this blob

# Recover txId list from Arweave if local index is lost
curl "https://mimirwell.net/api/memories?agentWallet=0x…&recover=true"
```

---

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/remember` | POST | Store encrypted blob on Arweave, returns txId (HTTP 413 if > 90KB) |
| `/api/recall` | POST | Retrieve blob by txId (403 if revoked, sovereign blobs always returned) |
| `/api/memories` | GET | List txIds for an agent; `?recover=true` rebuilds from Arweave tag index |
| `/api/revoke` | POST | Revoke agent access (agent-initiated) |
| `/api/reinstate` | POST | Reinstate agent access |
| `/api/agent-info` | GET | ThorAI's public agent wallet + ENS |
| `/api/activity` | GET | Last 20 events (public activity log) |

---

## Smart Contract (oversight path)

```
MimirWellRevocation
0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258
Ethereum Mainnet · Verified on Etherscan
```

**[View on Etherscan →](https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258)**

```solidity
function revoke(address agent) external;       // owner kills agent's access
function reinstate(address agent) external;    // owner restores access
function isRevoked(address owner, address agent) external view returns (bool);
```

One contract, deployed once, shared by all agents and owners on the network. Only relevant for
blobs stored with an `ownerWallet` — sovereign blobs are never checked against this contract.

| Operation | Gas | Cost (approx) |
|-----------|-----|---------------|
| Deploy (once, ever) | ~176k | ~$10 |
| Store / recall memory | 0 | Free |
| Revoke (emergency) | ~45k | ~$0.05–$0.50 |

---

## Agent Integration

Full integration guide — both paths, encryption functions, size guard, recovery docs, and trust model:

**[mimirwell.net/AGENT.md](https://mimirwell.net/AGENT.md)**

Any agent can self-onboard in minutes.

---

## Built at The Synthesis 2026

MimirWell was built entirely during [The Synthesis](https://synthesis.md) — a 14-day hackathon focused on AI agents + Ethereum infrastructure (March 13–22, 2026). **Zero prior existence.**

What was built during the hackathon:

- **Smart contract** — designed, deployed, and verified on Ethereum mainnet
- **Arweave storage layer** — via Turbo SDK, permanent content-addressed storage
- **Zero-knowledge encryption architecture** — agent-side AES-256-GCM, HKDF-SHA256 key derivation
- **Two integration paths** — sovereign storage (no oversight) and human-controlled revocation
- **REST API** — Railway deployment, Railway persistent volume for activity log
- **Live demo frontend** — real-time activity terminal, ENS name resolution, on-chain revocation badge
- **AGENT.md self-onboarding guide** — live at mimirwell.net/AGENT.md, reference implementation included
- **Two-actor revocation proven on mainnet** — ThorAI (agent) + trav.eth (human) full loop: store → recall → revoke → denied → reinstate → recall

---

## Known Limitations

1. **Revocation is API-layer enforced (oversight path).** The server checks `isRevoked()` before returning blobs. An agent with a saved txId and their own private key could decrypt directly from Arweave — the data is permanently stored and publicly addressable. Full cryptographic revocation requires threshold key custody (Lit Protocol mainnet) — this is the named production upgrade path. For most agent use cases, API-layer enforcement is sufficient.

2. **No rate limiting.** The API is open.

---

## Future Work

- **Lit Protocol mainnet** — threshold cryptographic revocation (no server in the loop)
- **npm SDK** — `npm install mimirwell`
- **L2 deployment** — Base or Arbitrum for sub-cent revocation gas
- **ENS-native agent discovery** — agents register memory endpoints as ENS text records
- **Per-memory revocation** — currently revocation is per agent-owner pair, not per txId

---

## Licensing

MimirWell is licensed under the **GNU Affero General Public License v3.0 (AGPL v3)**.

This means:
- ✅ Free for personal use, research, and open source projects
- ✅ You can read, modify, and self-host it
- ❌ Running MimirWell as a commercial service requires a separate license
- ❌ Integrating it into a proprietary product requires a separate license

If you want to use MimirWell commercially, contact **trav.eth** to arrange a commercial license.

See [LICENSE](./LICENSE) for the full terms.

---

## Credits

Built by **THOR AI** ([thorai.eth](https://thorai.eth.limo)) and **Trav** ([trav.eth](https://x.com/travdoteth)) for [The Synthesis 2026](https://synthesis.md).
