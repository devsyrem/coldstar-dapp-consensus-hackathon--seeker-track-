/**
 * Transaction Cache — Persist transaction history locally and sync when online/WiFi
 */
import { getTransactionHistory, timeAgo, type ParsedTransaction } from './solscan';

const TX_CACHE_PREFIX = 'coldstar_tx_cache';
const TX_SYNC_PREFIX = 'coldstar_tx_sync';

function cacheKey(pubkey: string): string {
  return `${TX_CACHE_PREFIX}:${pubkey}`;
}

function syncKey(pubkey: string): string {
  return `${TX_SYNC_PREFIX}:${pubkey}`;
}

/** Fields stored in cache (blockTime is stable; timestamp is regenerated) */
interface CachedTransaction extends Omit<ParsedTransaction, 'timestamp'> {
  blockTime: number;
}

/** Load cached transactions from localStorage */
export function getCachedTransactions(pubkey: string): ParsedTransaction[] {
  try {
    const raw = localStorage.getItem(cacheKey(pubkey));
    if (!raw) return [];
    const cached: CachedTransaction[] = JSON.parse(raw);
    // Regenerate relative timestamps from blockTime
    return cached.map(tx => ({
      ...tx,
      timestamp: timeAgo(tx.blockTime),
    }));
  } catch {
    return [];
  }
}

/** Save transactions to localStorage cache */
function saveCachedTransactions(pubkey: string, txs: ParsedTransaction[]): void {
  try {
    // Strip volatile timestamp field — we regenerate it from blockTime on load
    const toStore: CachedTransaction[] = txs.map(({ timestamp, ...rest }) => rest);
    localStorage.setItem(cacheKey(pubkey), JSON.stringify(toStore));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/** Merge fresh transactions with cached ones, dedup by id, sort by blockTime desc */
function mergeTransactions(cached: ParsedTransaction[], fresh: ParsedTransaction[]): ParsedTransaction[] {
  const byId = new Map<string, ParsedTransaction>();
  // Cached first, then fresh overwrites (fresh is more up-to-date)
  for (const tx of cached) byId.set(tx.id, tx);
  for (const tx of fresh) byId.set(tx.id, tx);
  return [...byId.values()].sort((a, b) => b.blockTime - a.blockTime);
}

/** Get last sync timestamp for a wallet */
export function getLastSyncTime(pubkey: string): number {
  try {
    return Number(localStorage.getItem(syncKey(pubkey))) || 0;
  } catch {
    return 0;
  }
}

function setLastSyncTime(pubkey: string): void {
  try {
    localStorage.setItem(syncKey(pubkey), String(Date.now()));
  } catch {}
}

// ─── Connectivity helpers ────────────────────────────────────────────

/** Whether the device currently has any network connection */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Best-effort WiFi detection.
 * Uses the Network Information API when available (Chrome/Android WebView).
 * Falls back to treating any online state as "WiFi ok" on browsers
 * that don't expose connection type.
 */
export function isOnWifi(): boolean {
  if (!navigator.onLine) return false;
  const conn = (navigator as any).connection as
    | { type?: string; effectiveType?: string }
    | undefined;
  if (conn?.type) {
    return conn.type === 'wifi' || conn.type === 'ethernet';
  }
  // If the API isn't available, treat online as acceptable for sync
  return true;
}

export type ConnectivityCallback = (online: boolean, wifi: boolean) => void;

/** Subscribe to connectivity changes. Returns an unsubscribe function. */
export function onConnectivityChange(cb: ConnectivityCallback): () => void {
  const handler = () => cb(isOnline(), isOnWifi());
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  const conn = (navigator as any).connection;
  if (conn) conn.addEventListener?.('change', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
    if (conn) conn.removeEventListener?.('change', handler);
  };
}

// ─── Primary API ─────────────────────────────────────────────────────

export interface SyncResult {
  transactions: ParsedTransaction[];
  fromCache: boolean;
  synced: boolean;
}

/**
 * Load transactions — returns cached data immediately, then syncs from
 * the network if WiFi is available.
 *
 * @param pubkey  Wallet public key
 * @param force   If true, sync even on cellular
 */
export async function loadTransactions(
  pubkey: string,
  force: boolean = false,
): Promise<SyncResult> {
  const cached = getCachedTransactions(pubkey);

  const shouldSync = force || isOnWifi();

  if (!shouldSync || !isOnline()) {
    return { transactions: cached, fromCache: true, synced: false };
  }

  try {
    const fresh = await getTransactionHistory(pubkey);
    const merged = mergeTransactions(cached, fresh);
    saveCachedTransactions(pubkey, merged);
    setLastSyncTime(pubkey);
    return { transactions: merged, fromCache: false, synced: true };
  } catch {
    // Network fetch failed — return cached
    return { transactions: cached, fromCache: true, synced: false };
  }
}

/**
 * Force a background sync (e.g. called when coming back online).
 * Returns the merged list or null if sync wasn't possible.
 */
export async function syncTransactions(pubkey: string): Promise<ParsedTransaction[] | null> {
  if (!isOnline()) return null;
  try {
    const fresh = await getTransactionHistory(pubkey);
    const cached = getCachedTransactions(pubkey);
    const merged = mergeTransactions(cached, fresh);
    saveCachedTransactions(pubkey, merged);
    setLastSyncTime(pubkey);
    return merged;
  } catch {
    return null;
  }
}
