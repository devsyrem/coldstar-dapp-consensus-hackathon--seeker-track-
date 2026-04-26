/**
 * Price Service — Token price data from Jupiter Price API & CoinGecko
 */

const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v2';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3';

export interface TokenPrice {
  id: string;
  mintAddress: string;
  symbol: string;
  price: number;
  change24h: number;
}

export interface PriceHistory {
  timestamp: number;
  price: number;
}

// Cache prices for 60s (survives at least one 30s refresh cycle)
let priceCache: { data: Map<string, TokenPrice>; timestamp: number } | null = null;
const CACHE_TTL = 60_000;

/** Known Solana mint addresses for pricing */
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Get current prices for token mints.
 * Tries Jupiter first, falls back to CoinGecko for known tokens.
 */
export async function getTokenPrices(mintAddresses: string[]): Promise<Map<string, TokenPrice>> {
  // Check cache
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
    const cached = new Map<string, TokenPrice>();
    for (const mint of mintAddresses) {
      const p = priceCache.data.get(mint);
      if (p) cached.set(mint, p);
    }
    if (cached.size === mintAddresses.length) return cached;
  }

  // Try Jupiter first
  try {
    const ids = mintAddresses.join(',');
    const resp = await fetch(`${JUPITER_PRICE_URL}?ids=${ids}&showExtraInfo=true`);
    if (resp.ok) {
      const json = await resp.json();
      const prices = new Map<string, TokenPrice>();

      for (const mint of mintAddresses) {
        const data = json.data?.[mint];
        if (data) {
          prices.set(mint, {
            id: mint,
            mintAddress: mint,
            symbol: data.extraInfo?.quotedPrice?.buyPrice ? data.id : mint.slice(0, 4),
            price: parseFloat(data.price) || 0,
            change24h: 0,
          });
        }
      }

      if (prices.size > 0) {
        priceCache = { data: prices, timestamp: Date.now() };
        return prices;
      }
    }
  } catch { /* fall through to CoinGecko */ }

  // Fallback: CoinGecko for known tokens
  try {
    const coingeckoIds = [];
    const mintToCoingecko: Record<string, string> = {};

    if (mintAddresses.includes(SOL_MINT)) {
      coingeckoIds.push('solana');
      mintToCoingecko[SOL_MINT] = 'solana';
    }

    if (coingeckoIds.length > 0) {
      const resp = await fetch(
        `${COINGECKO_URL}/simple/price?ids=${coingeckoIds.join(',')}&vs_currencies=usd&include_24hr_change=true`
      );

      if (resp.ok) {
        const json = await resp.json();
        const prices = new Map<string, TokenPrice>();

        for (const [mint, cgId] of Object.entries(mintToCoingecko)) {
          if (json[cgId]?.usd != null) {
            prices.set(mint, {
              id: mint,
              mintAddress: mint,
              symbol: mint === SOL_MINT ? 'SOL' : mint.slice(0, 4),
              price: json[cgId].usd,
              change24h: json[cgId].usd_24h_change ?? 0,
            });
          }
        }

        if (prices.size > 0) {
          priceCache = { data: prices, timestamp: Date.now() };
          return prices;
        }
      }
    }
  } catch { /* return empty */ }

  // Both APIs failed — return stale cache if available (better than zero)
  if (priceCache) {
    const stale = new Map<string, TokenPrice>();
    for (const mint of mintAddresses) {
      const p = priceCache.data.get(mint);
      if (p) stale.set(mint, p);
    }
    if (stale.size > 0) return stale;
  }

  return new Map();
}

/** Get SOL price in USD */
export async function getSolPrice(): Promise<number> {
  const prices = await getTokenPrices([SOL_MINT]);
  return prices.get(SOL_MINT)?.price ?? 0;
}

/**
 * Get 24h price change data from CoinGecko (free tier)
 */
export async function get24hChanges(coingeckoIds: string[]): Promise<Map<string, number>> {
  const ids = coingeckoIds.join(',');
  const resp = await fetch(
    `${COINGECKO_URL}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
  );

  const changes = new Map<string, number>();
  if (!resp.ok) return changes;

  const json = await resp.json();
  for (const id of coingeckoIds) {
    if (json[id]?.usd_24h_change != null) {
      changes.set(id, json[id].usd_24h_change);
    }
  }

  return changes;
}

/**
 * Get price history for charts (CoinGecko market_chart)
 */
export async function getPriceHistory(
  coingeckoId: string,
  days: number = 1
): Promise<PriceHistory[]> {
  const resp = await fetch(
    `${COINGECKO_URL}/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`
  );

  if (!resp.ok) return [];

  const json = await resp.json();
  return (json.prices || []).map(([timestamp, price]: [number, number]) => ({
    timestamp,
    price,
  }));
}

/**
 * Get detailed token market data from CoinGecko
 */
export interface MarketData {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  marketCap: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  ath: number;
  circulatingSupply: number;
  totalSupply: number;
  image?: string;
}

export async function getTokenMarketData(coingeckoId: string): Promise<MarketData | null> {
  const resp = await fetch(`${COINGECKO_URL}/coins/${coingeckoId}`);
  if (!resp.ok) return null;

  const data = await resp.json();
  return {
    name: data.name,
    symbol: data.symbol?.toUpperCase(),
    price: data.market_data?.current_price?.usd ?? 0,
    change24h: data.market_data?.price_change_percentage_24h ?? 0,
    marketCap: data.market_data?.market_cap?.usd ?? 0,
    totalVolume: data.market_data?.total_volume?.usd ?? 0,
    high24h: data.market_data?.high_24h?.usd ?? 0,
    low24h: data.market_data?.low_24h?.usd ?? 0,
    ath: data.market_data?.ath?.usd ?? 0,
    circulatingSupply: data.market_data?.circulating_supply ?? 0,
    totalSupply: data.market_data?.total_supply ?? 0,
    image: data.image?.small,
  };
}

/** Format USD value */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format large numbers compactly */
export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return formatUSD(value);
}
