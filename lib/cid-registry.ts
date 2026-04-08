/**
 * lib/cid-registry.ts — Transaction ID index for agent memories
 *
 * Two-layer persistence:
 * 1. Railway volume (/data/mimirwell-txids.json) — fast local cache, survives restarts
 * 2. Arweave GraphQL — the authoritative recovery path on a fresh server instance
 *
 * Recovery: any new server with the same agent wallet can call queryMemoriesByAgent()
 * from lib/arweave.ts to reconstruct the full txId list via Arweave's tag index.
 * No manifest CID, no external state — the Arweave network is the index.
 *
 * Migration note: entries from the Filecoin era used "cid" (IPFS CID strings).
 * New entries use "txId" (Arweave transaction IDs). Both are stored as "txId"
 * here for uniformity — callers treat them as opaque storage identifiers.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TxEntry {
  /** Arweave txId (new) or legacy Filecoin IPFS CID — opaque storage identifier */
  txId: string;
  agentWallet: string;
  ownerWallet: string;
  timestamp: number;
  storedAt: string;
  preview: string;
  status: "active" | "revoked";
  /** "arweave" (default) or "filecoin" (legacy entries migrated from old registry) */
  backend?: "arweave" | "filecoin";
}

export interface TxRegistry {
  version: number;
  entries: TxEntry[];
  lastUpdated: string;
}

// ─── Storage path ─────────────────────────────────────────────────────────────

const REGISTRY_PATH = "/data/mimirwell-txids.json";

// ─── Read / write ─────────────────────────────────────────────────────────────

function readRegistry(): TxRegistry {
  if (!existsSync(REGISTRY_PATH)) {
    return { version: 2, entries: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
    // Migrate legacy registry shape (v1 used "cid" field, stored in mimirwell-cids.json)
    if (Array.isArray(raw.entries)) {
      raw.entries = raw.entries.map((e: TxEntry & { cid?: string }) => {
        if (e.cid && !e.txId) {
          return { ...e, txId: e.cid, backend: "filecoin" as const };
        }
        return { ...e, backend: e.backend ?? "arweave" };
      });
    }
    return raw as TxRegistry;
  } catch {
    return { version: 2, entries: [], lastUpdated: new Date().toISOString() };
  }
}

function writeRegistry(registry: TxRegistry): void {
  registry.lastUpdated = new Date().toISOString();
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf8");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function registerTxId(entry: Omit<TxEntry, "storedAt" | "status" | "backend">): void {
  const registry = readRegistry();
  registry.entries.unshift({
    ...entry,
    storedAt: new Date().toISOString(),
    status: "active",
    backend: "arweave",
  });
  writeRegistry(registry);
}

export function markRevoked(agentWallet: string, ownerWallet: string): void {
  const registry = readRegistry();
  const lower = (s: string) => s.toLowerCase();
  registry.entries.forEach((e) => {
    if (
      lower(e.agentWallet) === lower(agentWallet) &&
      lower(e.ownerWallet) === lower(ownerWallet)
    ) {
      e.status = "revoked";
    }
  });
  writeRegistry(registry);
}

export function listTxIds(agentWallet?: string, ownerWallet?: string): TxEntry[] {
  const registry = readRegistry();
  return registry.entries.filter((e) => {
    if (agentWallet && e.agentWallet.toLowerCase() !== agentWallet.toLowerCase()) return false;
    if (ownerWallet && e.ownerWallet.toLowerCase() !== ownerWallet.toLowerCase()) return false;
    return true;
  });
}

export function getRegistry(): TxRegistry {
  return readRegistry();
}
