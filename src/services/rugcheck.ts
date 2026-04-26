/**
 * RugCheck Service — Token safety scoring via RugCheck API
 * Mirrors coldstar-rpc rugcheck.rs logic
 */

const RUGCHECK_BASE_URL = 'https://premium.rugcheck.xyz/v1';
const RUGCHECK_API_KEY = 'f1de9137-eb1d-4341-9da7-b6920b4839c4';

/** Auth headers — X-API-KEY (primary) + Bearer fallback */
const AUTH_HEADERS: HeadersInit = {
  'X-API-KEY': RUGCHECK_API_KEY,
  'Authorization': `Bearer ${RUGCHECK_API_KEY}`,
  'Content-Type': 'application/json',
};

export type SafetyLevel = 'safe' | 'caution' | 'ruggable';

export interface TokenSafetyReport {
  mint: string;
  score: number;           // normalised 0-100 score from API
  level: SafetyLevel;
  risks: RiskItem[];
  rugged?: boolean;
  lpLockedPct?: number;
  tokenName?: string;
  tokenSymbol?: string;
  tokenProgram?: string;
  tokenType?: string;
}

export interface RiskItem {
  name: string;
  description: string;
  level: 'info' | 'warn' | 'danger';
  score: number;
  value?: string;
}

// Cache reports for 5 minutes
const reportCache = new Map<string, { report: TokenSafetyReport; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get token safety report from RugCheck
 */
export async function getTokenSafetyReport(mintAddress: string): Promise<TokenSafetyReport> {
  // Check cache
  const cached = reportCache.get(mintAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.report;
  }

  try {
    const resp = await fetch(`${RUGCHECK_BASE_URL}/tokens/${encodeURIComponent(mintAddress)}/report/summary`, {
      headers: AUTH_HEADERS,
    });
    if (!resp.ok) {
      return createFallbackReport(mintAddress);
    }

    const data = await resp.json();
    const report = parseSummaryResponse(mintAddress, data);

    // Cache it
    reportCache.set(mintAddress, { report, timestamp: Date.now() });
    return report;
  } catch {
    return createFallbackReport(mintAddress);
  }
}

/**
 * Normalise API risk level strings to our union type.
 * API returns: "info", "warn", "danger" (and sometimes others).
 */
function normaliseRiskLevel(raw: string | undefined): RiskItem['level'] {
  const l = (raw ?? '').toLowerCase();
  if (l === 'danger' || l === 'critical' || l === 'high') return 'danger';
  if (l === 'warn' || l === 'warning' || l === 'medium' || l === 'low') return 'warn';
  return 'info';
}

/**
 * Classify normalised score into safety level.
 * score_normalised: 0-100 where lower = safer.
 *   0-10  → Safe
 *   11-30 → Caution
 *   >30   → Ruggable
 */
function classifyScore(score: number): SafetyLevel {
  if (score <= 10) return 'safe';
  if (score <= 30) return 'caution';
  return 'ruggable';
}

/** Create fallback report for well-known tokens */
function createFallbackReport(mint: string): TokenSafetyReport {
  // Well-known safe tokens
  const SAFE_MINTS = new Set([
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'So11111111111111111111111111111111111111112',     // wSOL
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
    'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
    'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
  ]);

  return {
    mint,
    score: SAFE_MINTS.has(mint) ? 0 : 50,
    level: SAFE_MINTS.has(mint) ? 'safe' : 'caution',
    risks: [],
  };
}

/** Batch classify multiple tokens via bulk API — returns full reports */
export async function classifyTokensFull(mints: string[]): Promise<Map<string, TokenSafetyReport>> {
  const results = new Map<string, TokenSafetyReport>();
  if (mints.length === 0) return results;

  // Separate cached vs uncached mints
  const uncached: string[] = [];
  for (const mint of mints) {
    const cached = reportCache.get(mint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.set(mint, cached.report);
    } else {
      uncached.push(mint);
    }
  }

  if (uncached.length === 0) return results;

  // Use bulk summary endpoint (POST /v1/bulk/tokens/summary)
  try {
    const resp = await fetch(`${RUGCHECK_BASE_URL}/bulk/tokens/summary`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ tokens: uncached }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const reports: any[] = data.reports ?? data ?? [];
      for (const item of reports) {
        const mint = item.mint;
        if (!mint) continue;
        const report = parseSummaryResponse(mint, item);
        reportCache.set(mint, { report, timestamp: Date.now() });
        results.set(mint, report);
      }
    }
  } catch {
    // Bulk failed — fall back to individual lookups
  }

  // Fill any mints that still don't have a result (bulk miss or error)
  for (const mint of uncached) {
    if (!results.has(mint)) {
      const report = await getTokenSafetyReport(mint);
      results.set(mint, report);
    }
  }

  return results;
}

/** Batch classify multiple tokens — returns just the level (backward compat) */
export async function classifyTokens(mints: string[]): Promise<Map<string, SafetyLevel>> {
  const full = await classifyTokensFull(mints);
  const levels = new Map<string, SafetyLevel>();
  for (const [mint, report] of full) {
    levels.set(mint, report.level);
  }
  return levels;
}

/**
 * Parse a single summary response object into a TokenSafetyReport.
 * Works for both individual GET and bulk POST responses.
 */
function parseSummaryResponse(mint: string, data: any): TokenSafetyReport {
  const score = data.score_normalised ?? data.score ?? 50;
  const report: TokenSafetyReport = {
    mint,
    score,
    level: classifyScore(score),
    risks: Array.isArray(data.risks)
      ? data.risks.map((r: any) => ({
          name: r.name || 'Unknown Risk',
          description: r.description || '',
          level: normaliseRiskLevel(r.level),
          score: r.score || 0,
          value: r.value,
        }))
      : [],
    rugged: data.rugged ?? false,
    lpLockedPct: data.lpLockedPct,
    tokenName: data.tokenMeta?.name,
    tokenSymbol: data.tokenMeta?.symbol,
    tokenProgram: data.tokenProgram,
    tokenType: data.tokenType,
  };

  // Override to ruggable if the API flags it as rugged
  if (data.rugged) {
    report.level = 'ruggable';
  }

  return report;
}
