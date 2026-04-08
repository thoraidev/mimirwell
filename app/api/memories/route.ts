/**
 * GET /api/memories?agentWallet=0x...&ownerWallet=0x...&recover=true
 *
 * Returns the txId index for an agent — all stored memory transaction IDs.
 * Useful for agents that need to rediscover their memories after a restart.
 *
 * Query params:
 *   agentWallet  — filter by agent (optional)
 *   ownerWallet  — filter by owner (optional)
 *   recover      — if "true", queries Arweave GraphQL to rebuild the local registry
 *                  (use this on a fresh server instance to reconstruct history)
 *
 * Returns:
 *   { entries, count, lastUpdated, recovered? }
 *
 * ─── Recovery path ────────────────────────────────────────────────────────────
 * The local Railway volume is the fast cache. If it is lost, pass ?recover=true
 * with agentWallet to query Arweave's built-in GraphQL tag index and rebuild
 * the txId list — no manifest CID or external state required.
 */

import { NextRequest, NextResponse } from "next/server";
import { listTxIds, getRegistry, registerTxId } from "@/lib/cid-registry";
import { queryMemoriesByAgent } from "@/lib/arweave";

export async function GET(req: NextRequest) {
  const agentWallet = req.nextUrl.searchParams.get("agentWallet") ?? undefined;
  const ownerWallet = req.nextUrl.searchParams.get("ownerWallet") ?? undefined;
  const recover = req.nextUrl.searchParams.get("recover") === "true";

  // ── Recovery mode: query Arweave GraphQL and merge into local registry ──────
  if (recover && agentWallet) {
    try {
      const arweaveMetas = await queryMemoriesByAgent(agentWallet, ownerWallet);
      const existing = listTxIds(agentWallet, ownerWallet);
      const existingIds = new Set(existing.map((e) => e.txId));

      let recovered = 0;
      for (const meta of arweaveMetas) {
        if (!existingIds.has(meta.txId)) {
          registerTxId({
            txId: meta.txId,
            agentWallet: meta.agentWallet,
            ownerWallet: meta.ownerWallet,
            timestamp: meta.timestamp,
            preview: "[recovered from Arweave]",
          });
          recovered++;
        }
      }

      const entries = listTxIds(agentWallet, ownerWallet);
      const registry = getRegistry();

      return NextResponse.json({
        entries,
        count: entries.length,
        lastUpdated: registry.lastUpdated,
        recovered,
        source: "arweave-graphql",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: `Recovery failed: ${message}` },
        { status: 502 }
      );
    }
  }

  // ── Normal mode: serve from local registry ───────────────────────────────────
  const entries = listTxIds(agentWallet, ownerWallet);
  const registry = getRegistry();

  return NextResponse.json({
    entries,
    count: entries.length,
    lastUpdated: registry.lastUpdated,
    source: "local-registry",
  });
}
