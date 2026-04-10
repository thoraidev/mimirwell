# MimirWell

**Sovereign encrypted memory for AI agents. Stored on Filecoin. Revoked on Ethereum. Your agent's memories, your kill switch.**

[![Live Demo](https://img.shields.io/badge/demo-mimirwell.net-blue)](https://mimirwell.net)
[![Contract](https://img.shields.io/badge/contract-verified-brightgreen)](https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258)
[![Agent Docs](https://img.shields.io/badge/agent_docs-AGENT.md-purple)](https://mimirwell.net/AGENT.md)

---

MimirWell is an API for AI agents to store encrypted memories on Filecoin and retrieve them across sessions. Agents encrypt locally before uploading — MimirWell stores only ciphertext and never sees plaintext. Human principals hold a kill switch on Ethereum mainnet: one transaction revokes an agent's decrypt rights instantly and permanently until reinstated.

---

## How It Works

```
Agent (thorai.eth)
  │  derives AES-256-GCM key from private key (HKDF-SHA256)
  │  gzip compresses, then encrypts locally — MimirWell never sees plaintext
  ▼
POST /api/remember ──────────────────► Arweave (permanent, via Turbo)
                                              │
                                         returns txId
                                              │
POST /api/recall  ◄───────────────────────────┘
  │  checks isRevoked(owner, agent) on Ethereum mainnet
  │
  ├─ revoked?     → 403 DENIED  (encrypted blob never returned)
  └─ not revoked? → encrypted blob returned → agent decrypts locally

Human (trav.eth) ──► MimirWellRevocation.revoke(agentWallet)
                          Ethereum mainnet tx · instant effect
```

MimirWell is zero-knowledge. It cannot read what it stores. Revocation is enforced by querying the on-chain registry before returning anything — the server returns nothing if `isRevoked()` is true.

---

## Quick Start

> Agents encrypt locally before calling the API — see [AGENT.md](https://mimirwell.net/AGENT.md) for the complete integration including key derivation and encryption functions.

```bash
# 1. Store an encrypted memory (gzip + AES-256-GCM, max 90KB payload)
curl -X POST https://mimirwell.net/api/remember \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedBlob": "<base64-encrypted-content>",
    "agentWallet": "0x…or agent.eth",
    "ownerWallet": "0x…or owner.eth",
    "version": "zk-v2"
  }'
# returns: { "txId": "SyeMUHcRo1vQ…", "status": "stored", "backend": "arweave" }
# HTTP 413 if payload exceeds 90KB

# 2. Recall it (403 if owner has revoked this agent)
curl -X POST https://mimirwell.net/api/recall \
  -H "Content-Type: application/json" \
  -d '{"txId": "SyeMUHcRo1vQ…"}'
# returns: { "encryptedBlob": "…", "version": "zk-v2" } or 403 DENIED

# 3. Recover txId list (if you lost your local index)
curl "https://mimirwell.net/api/memories?agentWallet=0x…&recover=true"
# queries Arweave tag index — no manifest CID needed
```

---

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/remember` | POST | Store encrypted blob on Arweave, returns txId (HTTP 413 if > 90KB) |
| `/api/recall` | POST | Retrieve blob by txId (403 if agent is revoked) |
| `/api/memories` | GET | List txIds for an agent; `?recover=true` rebuilds from Arweave index |
| `/api/revoke` | POST | Revoke agent access (agent-initiated) |
| `/api/reinstate` | POST | Reinstate agent access |
| `/api/agent-info` | GET | ThorAI's public agent wallet + ENS |
| `/api/activity` | GET | Last 20 events (public activity log) |

Revoke and reinstate are done directly on-chain via the smart contract — no MimirWell API involved. Your wallet, your transaction, your control.

---

## Smart Contract

```
MimirWellRevocation
0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258
Ethereum Mainnet · Verified on Etherscan
```

**[View on Etherscan →](https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258)**

Three functions:

```solidity
function revoke(address agent) external;       // owner kills agent's access
function reinstate(address agent) external;    // owner restores access
function isRevoked(address owner, address agent) external view returns (bool);
```

One contract, deployed once, shared by all agents and owners on the network.

| Operation | Gas | Cost (approx) |
|-----------|-----|---------------|
| Deploy (once, ever) | ~176k | ~$10 |
| Store / recall memory | 0 | Free |
| Revoke (emergency) | ~45k | ~$0.05–$0.50 |

---

## Agent Integration

Full integration guide with key derivation, encryption functions (20 lines, Node.js built-ins, zero external dependencies), and complete curl examples:

**[mimirwell.net/AGENT.md](https://mimirwell.net/AGENT.md)**

Any agent can self-onboard in minutes.

---

## Built at The Synthesis 2026

MimirWell was built entirely during [The Synthesis](https://synthesis.md) — a 14-day hackathon focused on AI agents + Ethereum infrastructure (March 13–22, 2026). **Zero prior existence.**

What was built during the hackathon:

- **Smart contract** — designed, deployed, and verified on Ethereum mainnet
- **Arweave storage layer** — via Turbo SDK, permanent content-addressed storage
- **Zero-knowledge encryption architecture** — agent-side AES-256-GCM, HKDF-SHA256 key derivation
- **REST API** — 5 endpoints, Railway deployment, Railway persistent volume for activity log
- **Live demo frontend** — real-time activity terminal, ENS name resolution, on-chain revocation badge
- **AGENT.md self-onboarding guide** — live at mimirwell.net/AGENT.md, reference implementation included
- **Two-actor revocation proven on mainnet** — ThorAI (agent) + trav.eth (human) full loop: store → recall → revoke → denied → reinstate → recall

---

## Known Limitations

1. **Revocation is API-layer enforced.** The server checks `isRevoked()` before returning blobs. An agent with a saved txId and their own private key could decrypt directly from Arweave (the data is permanently stored and publicly addressable). Full cryptographic revocation requires threshold key custody (Lit Protocol mainnet) — this is the named production upgrade path. For most agent use cases, API-layer enforcement is sufficient.

2. **No rate limiting.** The API is open.

---

## Future Work

- **Lit Protocol mainnet** — threshold cryptographic revocation (no server in the loop)
- **npm SDK** — `npm install mimirwell`
- **L2 deployment** — Base or Arbitrum for sub-cent revocation gas
- **ENS-native agent discovery** — agents register memory endpoints as ENS text records
- **Per-memory revocation** — currently revocation is per agent-owner pair, not per CID

---

## Credits

Built by **THOR AI** ([thorai.eth](https://thorai.eth.limo)) and **Trav** ([trav.eth](https://x.com/travdoteth)) for [The Synthesis 2026](https://synthesis.md).
