/**
 * Solscan API v2 Service — Transaction history via Solscan Pro API
 * Falls back to RPC-based parsing if Solscan auth fails.
 */
import { getRecentTransactions } from './solana';
import { LAMPORTS_PER_SOL, type ParsedTransactionWithMeta } from '@solana/web3.js';

const SOLSCAN_API_BASE = 'https://pro-api.solscan.io/v2.0';
const SOLSCAN_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NTIyNzcyMjQ4NDAsImVtYWlsIjoicnVnZ3VhcmQueHl6QGdtYWlsLmNvbSIsImFjdGlvbiI6InRva2VuLWFwaSIsImFwaVZlcnNpb24iOiJ2MiIsImlhdCI6MTc1MjI3NzIyNH0.ZtdCQjBEPjzN2kUT_qMQ-sHzdenz2Cgppa0sCrMc1XQ';

/** Native SOL token address used by Solscan */
const SOL_NATIVE_ADDRESS = 'So11111111111111111111111111111111111111111';
const SOL_WRAPPED_ADDRESS = 'So11111111111111111111111111111111111111112';

/** Raw transfer item from Solscan /account/transfer */
export interface SolscanTransfer {
  block_id: number;
  trans_id: string;
  block_time: number;
  time: string;
  activity_type: string;
  from_address: string;
  to_address: string;
  token_address: string;
  token_decimals: number;
  amount: number;
  flow: string;
  value?: number;
}

/** Parsed transaction ready for UI display */
export interface ParsedTransaction {
  id: string;
  type: 'send' | 'receive' | 'swap';
  asset: string;
  amount: string;
  fiatValue: string;
  network: string;
  timestamp: string;
  /** Unix seconds — used for caching & sorting */
  blockTime: number;
  status: 'completed' | 'pending' | 'failed';
  from?: string;
  to?: string;
  signature: string;
}

// Token symbol cache for Solscan token/meta lookups
const tokenSymbolCache = new Map<string, string>();

/** Token metadata returned by Solscan /token/meta */
export interface SolscanTokenMeta {
  symbol: string;
  name: string;
  icon: string;
  decimals: number;
  holder: number;
  supply: string;
  price: number;
  volume_24h: number;
  market_cap: number;
}

// Full metadata cache keyed by mint address
const tokenMetaCache = new Map<string, SolscanTokenMeta>();

async function solscanFetch<T = any>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${SOLSCAN_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { token: SOLSCAN_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Solscan API ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch full token metadata from Solscan for a single mint address.
 * Returns cached data if available.
 */
export async function getTokenMeta(mintAddress: string): Promise<SolscanTokenMeta | null> {
  if (mintAddress === SOL_NATIVE_ADDRESS || mintAddress === SOL_WRAPPED_ADDRESS) return null;

  const cached = tokenMetaCache.get(mintAddress);
  if (cached) return cached;

  try {
    const data = await solscanFetch<{ success: boolean; data?: Record<string, any> }>('/token/meta', {
      address: mintAddress,
    });
    if (!data.success || !data.data) return null;

    const d = data.data;
    const meta: SolscanTokenMeta = {
      symbol: d.symbol ?? '',
      name: d.name ?? '',
      icon: d.icon ?? '',
      decimals: d.decimals ?? 0,
      holder: d.holder ?? 0,
      supply: d.supply ?? '0',
      price: d.price ?? 0,
      volume_24h: d.volume_24h ?? 0,
      market_cap: d.market_cap ?? 0,
    };
    tokenMetaCache.set(mintAddress, meta);
    // Also populate the symbol cache
    if (meta.symbol) tokenSymbolCache.set(mintAddress, meta.symbol);
    return meta;
  } catch {
    return null;
  }
}

/**
 * Batch-fetch token metadata for multiple mint addresses.
 * Returns a map of mint address → metadata (only for addresses that resolved).
 */
export async function getTokenMetaBatch(mintAddresses: string[]): Promise<Map<string, SolscanTokenMeta>> {
  const results = new Map<string, SolscanTokenMeta>();
  const toFetch: string[] = [];

  for (const addr of mintAddresses) {
    const cached = tokenMetaCache.get(addr);
    if (cached) {
      results.set(addr, cached);
    } else if (addr !== SOL_NATIVE_ADDRESS && addr !== SOL_WRAPPED_ADDRESS) {
      toFetch.push(addr);
    }
  }

  // Fetch in parallel with a concurrency limit of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const fetched = await Promise.all(batch.map(addr => getTokenMeta(addr).then(meta => [addr, meta] as const)));
    for (const [addr, meta] of fetched) {
      if (meta) results.set(addr, meta);
    }
  }

  return results;
}

/** Resolve a token address to its symbol */
async function resolveSymbol(tokenAddress: string): Promise<string> {
  if (tokenAddress === SOL_NATIVE_ADDRESS || tokenAddress === SOL_WRAPPED_ADDRESS) return 'SOL';

  const cached = tokenSymbolCache.get(tokenAddress);
  if (cached) return cached;

  const meta = await getTokenMeta(tokenAddress);
  return meta?.symbol || tokenAddress.slice(0, 6) + '…';
}

function shortenAddress(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

export function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

/**
 * Fetch and parse transfer history for a wallet.
 * Tries Solscan API v2 first, falls back to RPC-based parsing.
 */
export async function getTransactionHistory(
  walletAddress: string,
  page: number = 1,
  pageSize: 10 | 20 | 30 | 40 | 60 | 100 = 40,
): Promise<ParsedTransaction[]> {
  try {
    return await getTransactionHistorySolscan(walletAddress, page, pageSize);
  } catch (err: any) {
    console.warn('Solscan API failed, falling back to RPC:', err.message);
    return getTransactionHistoryRPC(walletAddress);
  }
}

/** Solscan-based implementation */
async function getTransactionHistorySolscan(
  walletAddress: string,
  page: number,
  pageSize: number,
): Promise<ParsedTransaction[]> {
  const resp = await solscanFetch<{ success: boolean; data: SolscanTransfer[] }>(
    '/account/transfer',
    {
      address: walletAddress,
      page: String(page),
      page_size: String(pageSize),
      sort_by: 'block_time',
      sort_order: 'desc',
      exclude_amount_zero: 'true',
    },
  );

  if (!resp.success || !Array.isArray(resp.data)) {
    throw new Error('Failed to fetch transaction history from Solscan');
  }

  const transfers = resp.data;

  // Resolve all unique token symbols in parallel
  const uniqueTokens = [...new Set(transfers.map(t => t.token_address))];
  const symbolEntries = await Promise.all(
    uniqueTokens.map(async addr => [addr, await resolveSymbol(addr)] as const),
  );
  const symbolMap = new Map(symbolEntries);

  // Group transfers by transaction ID to detect swaps
  const txGroups = new Map<string, SolscanTransfer[]>();
  for (const t of transfers) {
    const group = txGroups.get(t.trans_id) || [];
    group.push(t);
    txGroups.set(t.trans_id, group);
  }

  const results: ParsedTransaction[] = [];

  for (const [txId, group] of txGroups) {
    const blockTime = group[0].block_time;
    const hasSend = group.some(t => t.from_address === walletAddress);
    const hasReceive = group.some(t => t.to_address === walletAddress);
    const isSwap = hasSend && hasReceive;

    if (isSwap) {
      // Swap: show "out token → in token"
      const outTransfer = group.find(t => t.from_address === walletAddress)!;
      const inTransfer = group.find(t => t.to_address === walletAddress)!;
      const outSymbol = symbolMap.get(outTransfer.token_address) || '?';
      const inSymbol = symbolMap.get(inTransfer.token_address) || '?';
      const inAmount = inTransfer.amount / Math.pow(10, inTransfer.token_decimals);

      results.push({
        id: txId,
        type: 'swap',
        asset: `${outSymbol} → ${inSymbol}`,
        amount: `${formatAmount(inAmount)} ${inSymbol}`,
        fiatValue: '',
        network: 'Solana',
        timestamp: timeAgo(blockTime),
        blockTime,
        status: 'completed',
        signature: txId,
      });
    } else {
      // Individual send/receive transfers
      for (const t of group) {
        const symbol = symbolMap.get(t.token_address) || '?';
        const amount = t.amount / Math.pow(10, t.token_decimals);
        const isSend = t.from_address === walletAddress;

        results.push({
          id: `${txId}-${t.token_address}`,
          type: isSend ? 'send' : 'receive',
          asset: symbol,
          amount: `${isSend ? '-' : '+'}${formatAmount(amount)}`,
          fiatValue: '',
          network: 'Solana',
          timestamp: timeAgo(blockTime),
          blockTime,
          status: 'completed',
          from: isSend ? undefined : shortenAddress(t.from_address),
          to: isSend ? shortenAddress(t.to_address) : undefined,
          signature: txId,
        });
      }
    }
  }

  return results;
}

function formatAmount(n: number): string {
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}

/** RPC-based fallback for transaction history */
async function getTransactionHistoryRPC(walletAddress: string): Promise<ParsedTransaction[]> {
  const rawTxs = await getRecentTransactions(walletAddress, 20);
  return rawTxs
    .map(tx => parseRpcTransaction(tx, walletAddress))
    .filter((tx): tx is ParsedTransaction => tx !== null);
}

function parseRpcTransaction(tx: ParsedTransactionWithMeta, walletAddress: string): ParsedTransaction | null {
  const sig = tx.transaction.signatures[0];
  const meta = tx.meta;
  if (!meta) return null;

  const blockTime = tx.blockTime ?? Math.floor(Date.now() / 1000);
  const status: ParsedTransaction['status'] = meta.err ? 'failed' : 'completed';

  const instructions = tx.transaction.message.instructions;
  for (const ix of instructions) {
    if ('parsed' in ix && ix.program === 'system' && ix.parsed?.type === 'transfer') {
      const info = ix.parsed.info;
      const amountSol = (info.lamports / LAMPORTS_PER_SOL).toFixed(4);
      const isSend = info.source === walletAddress;
      return {
        id: sig,
        type: isSend ? 'send' : 'receive',
        asset: 'SOL',
        amount: `${isSend ? '-' : '+'}${amountSol}`,
        fiatValue: '',
        network: 'Solana',
        timestamp: timeAgo(blockTime),
        blockTime,
        status,
        from: isSend ? undefined : shortenAddress(info.source),
        to: isSend ? shortenAddress(info.destination) : undefined,
        signature: sig,
      };
    }

    if ('parsed' in ix && ix.program === 'spl-token' && (ix.parsed?.type === 'transfer' || ix.parsed?.type === 'transferChecked')) {
      const info = ix.parsed.info;
      const tokenAmount = info.tokenAmount?.uiAmountString ?? info.amount ?? '0';
      const preBalances = meta.preTokenBalances ?? [];
      const postBalances = meta.postTokenBalances ?? [];
      const walletPreBal = preBalances.find(b => b.owner === walletAddress);
      const walletPostBal = postBalances.find(b => b.owner === walletAddress);
      const pre = walletPreBal?.uiTokenAmount?.uiAmount ?? 0;
      const post = walletPostBal?.uiTokenAmount?.uiAmount ?? 0;
      const isSend = post < pre;
      const mint = walletPostBal?.mint || walletPreBal?.mint || '';
      const symbol = tokenSymbolCache.get(mint) || 'Token';

      return {
        id: sig,
        type: isSend ? 'send' : 'receive',
        asset: symbol,
        amount: `${isSend ? '-' : '+'}${tokenAmount}`,
        fiatValue: '',
        network: 'Solana',
        timestamp: timeAgo(blockTime),
        blockTime,
        status,
        signature: sig,
      };
    }
  }

  // Balance change fallback
  const accountKeys = tx.transaction.message.accountKeys.map(k =>
    typeof k === 'string' ? k : ('pubkey' in k ? k.pubkey.toBase58() : String(k))
  );
  const walletIndex = accountKeys.findIndex(k => k === walletAddress);
  if (walletIndex >= 0 && meta.preBalances && meta.postBalances) {
    const diff = meta.postBalances[walletIndex] - meta.preBalances[walletIndex];
    if (Math.abs(diff) > 5000) {
      const amountSol = Math.abs(diff / LAMPORTS_PER_SOL).toFixed(4);
      return {
        id: sig,
        type: diff > 0 ? 'receive' : 'send',
        asset: 'SOL',
        amount: `${diff > 0 ? '+' : '-'}${amountSol}`,
        fiatValue: '',
        network: 'Solana',
        timestamp: timeAgo(blockTime),
        blockTime,
        status,
        signature: sig,
      };
    }
  }

  return {
    id: sig,
    type: 'swap',
    asset: 'Interaction',
    amount: '',
    fiatValue: '',
    network: 'Solana',
    timestamp: timeAgo(blockTime),
    blockTime,
    status,
    signature: sig,
  };
}
