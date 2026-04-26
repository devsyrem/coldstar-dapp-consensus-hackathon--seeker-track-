/**
 * Jupiter Swap Service — Real token swaps via Jupiter Aggregator
 *
 * Supports swapping ANY SPL token by querying Jupiter's Tokens API V2
 * for metadata and using the Swap API V2 /order + /execute endpoints.
 *
 * Docs: https://dev.jup.ag/docs
 */

const JUPITER_SWAP_URL = 'https://api.jup.ag/swap/v2';
const JUPITER_TOKEN_URL = 'https://api.jup.ag/tokens/v2';
const JUPITER_API_KEY = 'jup_a48b611f45a6f06a0d09cc981ec90c3e6d764952720ca05975498bd839f5dd22';

const jupiterHeaders = (): Record<string, string> => ({
  'x-api-key': JUPITER_API_KEY,
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: number;
  routePlan: RoutePlan[];
  swapTransaction: string; // base64 serialized transaction
  requestId: string;       // required for /execute
  router: string;          // "iris" | "jupiterz" | "dflow" | "okx"
}

interface RoutePlan {
  swapInfo: {
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;      // In smallest units (lamports, etc.)
  slippageBps: number; // Slippage in basis points (50 = 0.5%)
  userPublicKey: string;
}

/** A token entry returned by Jupiter token list / search */
export interface JupiterToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
  tags?: string[];
}

/* ------------------------------------------------------------------ */
/*  Token search / discovery                                           */
/* ------------------------------------------------------------------ */

let _tokenCache: JupiterToken[] | null = null;
let _tokenCacheStamp = 0;
const TOKEN_CACHE_TTL = 10 * 60 * 1000; // 10 min

/**
 * Fetch the full Jupiter verified token list (cached for 10 min).
 * Returns the "strict" list which filters out scam tokens.
 */
export async function getJupiterTokenList(): Promise<JupiterToken[]> {
  if (_tokenCache && Date.now() - _tokenCacheStamp < TOKEN_CACHE_TTL) {
    return _tokenCache;
  }

  const resp = await fetch(`${JUPITER_TOKEN_URL}/tag?query=verified`, {
    headers: jupiterHeaders(),
  });
  if (!resp.ok) {
    // Fallback: return the hardcoded list with known logos
    return SWAP_TOKENS.map(t => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logoURI: t.logoURI ?? null,
      tags: ['verified'],
    }));
  }

  const raw: any[] = await resp.json();
  // V2 uses `id` for mint and `icon` for logo
  const data: JupiterToken[] = raw.map(t => ({
    mint: t.id ?? t.mint,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    logoURI: t.icon ?? t.logoURI ?? null,
    tags: t.tags ?? [],
  }));
  _tokenCache = data;
  _tokenCacheStamp = Date.now();
  return data;
}

/**
 * Search Jupiter tokens by symbol, name, or mint address.
 * Searches the cached verified list first, then falls back to the
 * Jupiter search API for unverified / long-tail tokens.
 */
export async function searchJupiterTokens(
  query: string,
  limit = 20,
): Promise<JupiterToken[]> {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase();

  // 1. If query looks like a full Solana address (32–44 base58 chars)
  //    search by mint address
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query)) {
    try {
      const resp = await fetch(`${JUPITER_TOKEN_URL}/search?query=${encodeURIComponent(query)}`, {
        headers: jupiterHeaders(),
      });
      if (resp.ok) {
        const raw: any[] = await resp.json();
        if (raw.length > 0) {
          return raw.slice(0, 1).map(t => ({
            mint: t.id ?? t.mint,
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals,
            logoURI: t.icon ?? t.logoURI ?? null,
            tags: t.tags ?? [],
          }));
        }
      }
    } catch { /* fall through */ }
  }

  // 2. Search the local verified cache
  const list = await getJupiterTokenList();
  const results = list.filter(
    t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.mint.toLowerCase() === q,
  );

  // Sort: exact symbol match first, then by name length
  results.sort((a, b) => {
    const aExact = a.symbol.toLowerCase() === q ? 0 : 1;
    const bExact = b.symbol.toLowerCase() === q ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.name.length - b.name.length;
  });

  if (results.length > 0) return results.slice(0, limit);

  // 3. Fall back to Jupiter search API for unverified tokens
  try {
    const resp = await fetch(
      `${JUPITER_TOKEN_URL}/search?query=${encodeURIComponent(query)}`,
      { headers: jupiterHeaders() },
    );
    if (resp.ok) {
      const raw: any[] = await resp.json();
      return raw.slice(0, limit).map(t => ({
        mint: t.id ?? t.mint,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.icon ?? t.logoURI ?? null,
        tags: t.tags ?? [],
      }));
    }
  } catch { /* ignore */ }

  return [];
}

/**
 * Resolve a single mint address to token metadata.
 * Checks the local cache first, then hits the Jupiter single-token API.
 */
export async function resolveTokenMint(
  mint: string,
): Promise<JupiterToken | null> {
  // Check hardcoded list
  const known = SWAP_TOKENS.find(t => t.mint === mint);
  if (known) {
    return {
      mint: known.mint,
      symbol: known.symbol,
      name: known.name,
      decimals: known.decimals,
      logoURI: known.logoURI ?? null,
    };
  }

  // Check cached list
  if (_tokenCache) {
    const cached = _tokenCache.find(t => t.mint === mint);
    if (cached) return cached;
  }

  // Hit Jupiter API (V2 uses search endpoint)
  try {
    const resp = await fetch(`${JUPITER_TOKEN_URL}/search?query=${encodeURIComponent(mint)}`, {
      headers: jupiterHeaders(),
    });
    if (resp.ok) {
      const raw: any[] = await resp.json();
      const match = raw.find((t: any) => (t.id ?? t.mint) === mint);
      if (match) {
        return {
          mint: match.id ?? match.mint,
          symbol: match.symbol,
          name: match.name,
          decimals: match.decimals,
          logoURI: match.icon ?? match.logoURI ?? null,
          tags: match.tags ?? [],
        };
      }
    }
  } catch { /* ignore */ }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Quoting & swapping                                                 */
/* ------------------------------------------------------------------ */

/**
 * Get a swap order from Jupiter Swap API V2.
 * Uses the /order endpoint which returns both quote and transaction in one call.
 */
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote> {
  const queryParams = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount.toString(),
    taker: params.userPublicKey,
  });

  const resp = await fetch(`${JUPITER_SWAP_URL}/order?${queryParams}`, {
    headers: jupiterHeaders(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Jupiter order error: ${err}`);
  }

  const order = await resp.json();

  return {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inAmount: params.amount.toString(),
    outAmount: order.outAmount,
    otherAmountThreshold: order.outAmount, // V2 handles slippage via RTSE at execute time
    priceImpactPct: 0,
    routePlan: order.routePlan || [],
    swapTransaction: order.transaction,
    requestId: order.requestId,
    router: order.router || 'iris',
  };
}

/**
 * Execute a swap via Jupiter's /execute endpoint.
 * Handles transaction landing, confirmation, and retry via Jupiter Beam.
 */
export async function executeSwap(
  signedTransactionBase64: string,
  requestId: string,
): Promise<{ status: string; signature: string; error?: string }> {
  const resp = await fetch(`${JUPITER_SWAP_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...jupiterHeaders() },
    body: JSON.stringify({
      signedTransaction: signedTransactionBase64,
      requestId,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Jupiter execute error: ${err}`);
  }

  return await resp.json();
}

/* ------------------------------------------------------------------ */
/*  Static / hardcoded token list (always available offline)           */
/* ------------------------------------------------------------------ */

/**
 * Fetch logo URIs for a batch of token mints from the Jupiter token list.
 * Returns a Map of mint → logoURI. Uses the cached verified list for speed.
 */
export async function getTokenLogos(mints: string[]): Promise<Map<string, string>> {
  const logos = new Map<string, string>();
  if (mints.length === 0) return logos;

  // Pre-populate with known logo URLs so they're always available
  const knownLogos = new Map(SWAP_TOKENS.filter(t => t.logoURI).map(t => [t.mint, t.logoURI]));
  for (const mint of mints) {
    const known = knownLogos.get(mint);
    if (known) logos.set(mint, known);
  }

  // Fetch verified list (cached 10 min)
  const list = await getJupiterTokenList();
  const byMint = new Map(list.map(t => [t.mint, t.logoURI]));

  const missing: string[] = [];
  for (const mint of mints) {
    const uri = byMint.get(mint);
    if (uri) {
      logos.set(mint, uri);
    } else {
      missing.push(mint);
    }
  }

  // Resolve missing mints individually via V2 search (capped to avoid excessive requests)
  const toResolve = missing.slice(0, 5);
  if (toResolve.length > 0) {
    try {
      // Search for all missing mints in one request (comma-separated)
      const resp = await fetch(
        `${JUPITER_TOKEN_URL}/search?query=${encodeURIComponent(toResolve.join(','))}`,
        { headers: jupiterHeaders() },
      );
      if (resp.ok) {
        const raw: any[] = await resp.json();
        for (const t of raw) {
          const uri = t.icon ?? t.logoURI;
          const id = t.id ?? t.mint;
          if (uri && toResolve.includes(id)) logos.set(id, uri);
        }
      }
    } catch { /* ignore */ }
  }

  return logos;
}

/** SOL mint address */
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

/** Popular swap token list with mint addresses and logos from Jupiter API */
export const SWAP_TOKENS = [
  { mint: SOL_MINT, symbol: 'SOL', name: 'Solana', decimals: 9, logo: '◎', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: '💵', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether', decimals: 6, logo: '💲', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' },
  { mint: '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH', symbol: 'USDG', name: 'Global Dollar', decimals: 6, logo: '💰', logoURI: 'https://424565.fs1.hubspotusercontent-na1.net/hubfs/424565/GDN-USDG-Token-512x512.png' },
  { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', decimals: 6, logo: '🪐', logoURI: 'https://static.jup.ag/jup/icon.png' },
  { mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', symbol: 'JTO', name: 'Jito', decimals: 9, logo: '🔥', logoURI: 'https://metadata.jito.network/token/jto/image' },
  { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', decimals: 5, logo: '🐕', logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', symbol: 'mSOL', name: 'Marinade SOL', decimals: 9, logo: '🧪', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png' },
  { mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', symbol: 'JitoSOL', name: 'Jito Staked SOL', decimals: 9, logo: '🔥', logoURI: 'https://storage.googleapis.com/token-metadata/JitoSOL-256.png' },
  { mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', symbol: 'PYTH', name: 'Pyth Network', decimals: 6, logo: '🔮', logoURI: 'https://pyth.network/token.svg' },
  { mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', symbol: 'RENDER', name: 'Render', decimals: 8, logo: '🎨', logoURI: 'https://shdw-drive.genesysgo.net/5zseP54TGrcz9C8HdjZwJJsZ6f3VbP11p1abwKWGykZH/rndr.png' },
];
