/**
 * Solana RPC Service — Real blockchain interaction via FluxRPC
 */
import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from '@solana/web3.js';
import { getTokenMetaBatch, type SolscanTokenMeta } from './solscan';

const RPC_ENDPOINT = 'https://eu.fluxrpc.com?key=69a5e425-c126-4f33-9fdc-454898481642';

/** Fallback RPC for methods FluxRPC doesn't support (e.g. getTransaction) */
const TX_LOOKUP_RPC = 'https://api.mainnet-beta.solana.com';

let _connection: Connection | null = null;
let _txLookupConnection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_ENDPOINT, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return _connection;
}

/** Connection used for getTransaction calls (FluxRPC doesn't support this method) */
function getTxLookupConnection(): Connection {
  if (!_txLookupConnection) {
    _txLookupConnection = new Connection(TX_LOOKUP_RPC, {
      commitment: 'confirmed',
    });
  }
  return _txLookupConnection;
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  uiAmount: string;
  logo: string;
  address: string; // token account address
}

export interface WalletBalance {
  solBalance: number;
  solLamports: number;
  tokens: TokenBalance[];
  /** Solscan metadata for each token mint (populated during balance fetch) */
  tokenMeta: Map<string, SolscanTokenMeta>;
}

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/** Retry helper for devnet RPC calls which are heavily rate-limited */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === retries) throw err;
      const isRateLimit = err?.message?.includes('429') || err?.message?.includes('Too many requests');
      const delay = isRateLimit ? baseDelay * Math.pow(2, attempt) : baseDelay;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Retry exhausted');
}

/** Fetch SOL balance and all SPL token balances for a wallet */
export async function getWalletBalance(publicKey: string): Promise<WalletBalance> {
  const conn = getConnection();
  const pubkey = new PublicKey(publicKey);

  // Get SOL balance (with retry for devnet rate limits)
  const solLamports = await withRetry(() => conn.getBalance(pubkey));
  const solBalance = solLamports / LAMPORTS_PER_SOL;

  // Get SPL token accounts (with retry for devnet rate limits)
  const tokenAccounts = await withRetry(() =>
    conn.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID })
  );

  const tokens: TokenBalance[] = [];

  for (const account of tokenAccounts.value) {
    const parsed = account.account.data.parsed;
    const info = parsed.info;
    const mint = info.mint;
    const amount = info.tokenAmount;

    if (amount.uiAmount === 0) continue; // Skip zero balances

    tokens.push({
      mint,
      symbol: mint.slice(0, 4) + '...',
      name: 'Unknown Token',
      balance: amount.uiAmount ?? 0,
      decimals: amount.decimals,
      uiAmount: (amount.uiAmount ?? 0).toLocaleString('en-US', {
        maximumFractionDigits: amount.decimals > 6 ? 6 : amount.decimals,
      }),
      logo: '🪙',
      address: account.pubkey.toBase58(),
    });
  }

  // Enrich ALL tokens with Solscan metadata
  const allMints = tokens.map(t => t.mint);
  let tokenMeta = new Map<string, SolscanTokenMeta>();
  if (allMints.length > 0) {
    try {
      tokenMeta = await getTokenMetaBatch(allMints);
      for (const token of tokens) {
        const meta = tokenMeta.get(token.mint);
        if (meta) {
          if (meta.symbol) token.symbol = meta.symbol;
          if (meta.name) token.name = meta.name;
          if (meta.icon) token.logo = meta.icon;
        }
      }
    } catch (e) {
      console.warn('Solscan token meta enrichment failed:', e);
    }
  }

  // Sort by balance descending
  tokens.sort((a, b) => b.balance - a.balance);

  return { solBalance, solLamports, tokens, tokenMeta };
}

/** Get recent transaction signatures for a wallet */
export async function getRecentTransactions(publicKey: string, limit: number = 10): Promise<ParsedTransactionWithMeta[]> {
  const txConn = getTxLookupConnection();
  const pubkey = new PublicKey(publicKey);

  const signatures = await withRetry(() => txConn.getSignaturesForAddress(pubkey, { limit }), 2, 2000);

  // Fetch in parallel batches of 5 for speed
  const BATCH_SIZE = 5;
  const txs: ParsedTransactionWithMeta[] = [];

  for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
    const batch = signatures.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(sig =>
        withRetry(
          () => txConn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 }),
          1, 1000
        )
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) txs.push(r.value);
    }
    // Brief pause between batches to avoid rate limits
    if (i + BATCH_SIZE < signatures.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return txs;
}

/** Get the latest blockhash */
export async function getLatestBlockhash() {
  const conn = getConnection();
  return conn.getLatestBlockhash('confirmed');
}

/** Confirm a transaction */
export async function confirmTransaction(signature: string) {
  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  return conn.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });
}

/** Get minimum SOL for rent exemption */
export async function getMinimumBalanceForRentExemption(dataLength: number): Promise<number> {
  const conn = getConnection();
  return conn.getMinimumBalanceForRentExemption(dataLength);
}

/** NFT types */
export interface NFTAsset {
  id: string;
  name: string;
  collection: string;
  image: string;
  floorPrice: string;
}

/** Fetch NFTs for a wallet using the DAS API (getAssetsByOwner) */
export async function getNFTsForWallet(publicKey: string): Promise<NFTAsset[]> {
  try {
    const response = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-nfts',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: publicKey,
          page: 1,
          limit: 50,
          displayOptions: { showFungible: false, showNativeBalance: false },
        },
      }),
    });

    const data = await response.json();

    if (data.error || !data.result?.items) {
      // DAS API not supported by this RPC — fall back to empty
      return [];
    }

    return data.result.items
      .filter((item: any) => item.content?.metadata?.name)
      .map((item: any) => ({
        id: item.id,
        name: item.content.metadata.name || 'Unknown NFT',
        collection: item.grouping?.[0]?.group_value
          ? item.grouping[0].group_value.slice(0, 8) + '...'
          : item.content.metadata.symbol || 'Collection',
        image: item.content.links?.image || item.content.files?.[0]?.uri || '',
        floorPrice: '',
      }));
  } catch {
    return [];
  }
}
