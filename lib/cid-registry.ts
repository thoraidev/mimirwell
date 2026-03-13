/**
 * lib/cid-registry.ts — CID index for agent memories
 *
 * Two-layer persistence:
 * 1. Railway filesystem (/tmp/mimirwell-cids.json) — fast, survives restarts
 * 2. Filecoin manifest — uploaded periodically, rootManifestCid stored here
 *
 * Recovery path: if server is lost, boot a new server with the same private key
 * and fetch rootManifestCid from MEMORY.md / ENS to reconstruct the index.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { uploadToFilecoin } from "./lighthouse";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CIDEntry {
  cid: string;
  agentWallet: string;
  ownerWallet: string;
  timestamp: number;
  storedAt: string;
  preview: string;
  status: "active" | "revoked";
}

export interface CIDRegistry {
  version: number;
  entries: CIDEntry[];
  rootManifestCid: string | null;
  lastUpdated: string;
}

// ─── Storage path ─────────────────────────────────────────────────────────────

const REGISTRY_PATH = "/tmp/mimirwell-cids.json";

// ─── Read / write ─────────────────────────────────────────────────────────────

function readRegistry(): CIDRegistry {
  if (!existsSync(REGISTRY_PATH)) {
    return { version: 1, entries: [], rootManifestCid: null, lastUpdated: new Date().toISOString() };
  }
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as CIDRegistry;
  } catch {
    return { version: 1, entries: [], rootManifestCid: null, lastUpdated: new Date().toISOString() };
  }
}

function writeRegistry(registry: CIDRegistry): void {
  registry.lastUpdated = new Date().toISOString();
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf8");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function registerCID(entry: Omit<CIDEntry, "storedAt" | "status">): void {
  const registry = readRegistry();
  registry.entries.unshift({
    ...entry,
    storedAt: new Date().toISOString(),
    status: "active",
  });
  writeRegistry(registry);
}

export function markRevoked(agentWallet: string, ownerWallet: string): void {
  const registry = readRegistry();
  const lower = (s: string) => s.toLowerCase();
  registry.entries.forEach((e) => {
    if (lower(e.agentWallet) === lower(agentWallet) && lower(e.ownerWallet) === lower(ownerWallet)) {
      e.status = "revoked";
    }
  });
  writeRegistry(registry);
}

export function listCIDs(agentWallet?: string, ownerWallet?: string): CIDEntry[] {
  const registry = readRegistry();
  return registry.entries.filter((e) => {
    if (agentWallet && e.agentWallet.toLowerCase() !== agentWallet.toLowerCase()) return false;
    if (ownerWallet && e.ownerWallet.toLowerCase() !== ownerWallet.toLowerCase()) return false;
    return true;
  });
}

export function getRegistry(): CIDRegistry {
  return readRegistry();
}

// ─── Filecoin manifest upload ─────────────────────────────────────────────────
// Uploads the current CID index to Filecoin as a plaintext manifest.
// The manifest CID becomes the "root" — store it in MEMORY.md for disaster recovery.
// Called automatically after every new memory is stored.

export async function uploadManifest(): Promise<string> {
  const registry = readRegistry();

  // Manifest is the public index — CIDs and metadata only, no content
  const manifest = {
    version: registry.version,
    generatedAt: new Date().toISOString(),
    entriesCount: registry.entries.length,
    entries: registry.entries.map(({ cid, agentWallet, ownerWallet, timestamp, storedAt, status, preview }) => ({
      cid, agentWallet, ownerWallet, timestamp, storedAt, status,
      preview: preview.slice(0, 60), // truncate for manifest
    })),
  };

  const { cid: manifestCid } = await uploadToFilecoin(manifest as unknown as Record<string, unknown>);

  // Save manifest CID back to registry
  registry.rootManifestCid = manifestCid;
  writeRegistry(registry);

  return manifestCid;
}
