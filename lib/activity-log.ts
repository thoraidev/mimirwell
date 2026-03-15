/**
 * lib/activity-log.ts — Activity event log for the live terminal
 *
 * Stores the last 100 events in memory + persists to /data/mimirwell-activity.json
 * The /api/activity endpoint returns these for the frontend terminal.
 */

import fs from 'fs';
import { randomBytes } from 'crypto';

const ACTIVITY_FILE = '/data/mimirwell-activity.json';
const MAX_EVENTS = 100;

export type ActivityEventType =
  | 'REMEMBER'
  | 'RECALL'
  | 'RECALL_DENIED'
  | 'REVOKE'
  | 'REINSTATED';

export interface ActivityEvent {
  id: string;
  ts: string;             // "HH:MM:SS" UTC
  type: ActivityEventType;
  agentWallet: string;    // truncated: "0x60b3…5c2A" (display fallback)
  agentWalletFull?: string; // full hex address for ENS reverse lookup
  ownerWallet?: string;   // truncated: "0x8884…0412"
  ownerWalletFull?: string; // full hex address for ENS reverse lookup
  cid?: string;           // "bafkrei…pma"
  cipher?: string;        // first 48 chars of ciphertext
  txHash?: string;        // revoke/reinstate on-chain tx
  success: boolean;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

let _events: ActivityEvent[] = [];
let _loaded = false;

function load() {
  if (_loaded) return;
  _loaded = true;
  try {
    if (fs.existsSync(ACTIVITY_FILE)) {
      const raw = fs.readFileSync(ACTIVITY_FILE, 'utf8');
      _events = JSON.parse(raw);
    }
  } catch {
    _events = [];
  }
}

function save() {
  try {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(_events, null, 2));
  } catch {
    // Non-fatal — in-memory log still works
  }
}

function truncateWallet(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function truncateCid(cid: string): string {
  if (!cid || cid.length < 12) return cid;
  return cid.slice(0, 10) + '…' + cid.slice(-3);
}

function nowUtc(): string {
  // "YYYY-MM-DD HH:MM:SS" UTC
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function shortId(): string {
  return randomBytes(4).toString('hex');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function logRemember(opts: {
  agentWallet: string;
  ownerWallet: string;
  cid: string;
  ciphertext: string;
}) {
  load();
  const event: ActivityEvent = {
    id: shortId(),
    ts: nowUtc(),
    type: 'REMEMBER',
    agentWallet: truncateWallet(opts.agentWallet),
    agentWalletFull: opts.agentWallet,
    ownerWallet: truncateWallet(opts.ownerWallet),
    ownerWalletFull: opts.ownerWallet,
    cid: truncateCid(opts.cid),
    cipher: opts.ciphertext.slice(0, 48),
    success: true,
  };
  _events.push(event);
  if (_events.length > MAX_EVENTS) _events = _events.slice(-MAX_EVENTS);
  save();
}

export function logRecall(opts: {
  agentWallet: string;
  cid: string;
  success: boolean;
  denied?: boolean;
}) {
  load();
  const event: ActivityEvent = {
    id: shortId(),
    ts: nowUtc(),
    type: opts.denied ? 'RECALL_DENIED' : 'RECALL',
    agentWallet: truncateWallet(opts.agentWallet),
    agentWalletFull: opts.agentWallet,
    cid: truncateCid(opts.cid),
    success: opts.success,
  };
  _events.push(event);
  if (_events.length > MAX_EVENTS) _events = _events.slice(-MAX_EVENTS);
  save();
}

export function logRevoke(opts: {
  ownerWallet: string;
  agentWallet: string;
  txHash?: string;
}) {
  load();
  const event: ActivityEvent = {
    id: shortId(),
    ts: nowUtc(),
    type: 'REVOKE',
    agentWallet: truncateWallet(opts.agentWallet),
    agentWalletFull: opts.agentWallet,
    ownerWallet: truncateWallet(opts.ownerWallet),
    ownerWalletFull: opts.ownerWallet,
    txHash: opts.txHash
      ? opts.txHash.slice(0, 10) + '…' + opts.txHash.slice(-6)
      : undefined,
    success: true,
  };
  _events.push(event);
  if (_events.length > MAX_EVENTS) _events = _events.slice(-MAX_EVENTS);
  save();
}

export function logReinstate(opts: {
  ownerWallet: string;
  agentWallet: string;
  txHash?: string;
}) {
  load();
  const event: ActivityEvent = {
    id: shortId(),
    ts: nowUtc(),
    type: 'REINSTATED',
    agentWallet: truncateWallet(opts.agentWallet),
    agentWalletFull: opts.agentWallet,
    ownerWallet: truncateWallet(opts.ownerWallet),
    ownerWalletFull: opts.ownerWallet,
    txHash: opts.txHash
      ? opts.txHash.slice(0, 10) + '…' + opts.txHash.slice(-6)
      : undefined,
    success: true,
  };
  _events.push(event);
  if (_events.length > MAX_EVENTS) _events = _events.slice(-MAX_EVENTS);
  save();
}

export function getRecentActivity(limit = 20): ActivityEvent[] {
  load();
  return _events.slice(-limit);
}
