// Quotes for exchanges Finnhub's free plan can't price, from Yahoo Finance's public chart endpoint.
// Today: the Tel Aviv Stock Exchange (symbols ending in .TA). Yahoo serves TASE delayed by ~15-20 minutes,
// prices shares in agorot (currency "ILA"), and this is an unofficial endpoint: it can change without notice,
// so every caller must survive a null. Shape mirrors Finnhub's /quote so the rest of the app needs no branch.

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FETCH_TIMEOUT_MS = 5000;
const FAILURE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;
const USER_AGENT = 'Mozilla/5.0 (OpenStock self-hosted; +https://github.com/Open-Dev-Society/OpenStock)';

export type YahooQuote = {
    c: number;   // current
    d: number;   // change
    dp: number;  // change %
    h?: number;  // day high
    l?: number;  // day low
    o?: number;  // open
    pc: number;  // previous close
    t: number;   // unix time of the last trade
    currency: string;
    name: string;
    exchange: string;
};

type ChartResponse = {
    chart?: {
        result?: {
            meta?: {
                currency?: string; regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number;
                regularMarketDayHigh?: number; regularMarketDayLow?: number; regularMarketOpen?: number;
                regularMarketTime?: number; longName?: string; shortName?: string; exchangeName?: string;
            };
            indicators?: { quote?: { open?: (number | null)[] }[] };
        }[] | null;
        error?: { code?: string; description?: string } | null;
    };
};

// Agorot → shekels. Yahoo reports TASE equities in ILA; indices (^TA125.TA) already come in ILS.
const scaleFor = (currency?: string) => (currency === 'ILA' ? 0.01 : 1);
const money = (value: number | undefined | null, scale: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value * scale * 10000) / 10000 : undefined;

export function normaliseYahooChart(data: ChartResponse): YahooQuote | null {
    const result = data.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;
    const scale = scaleFor(meta.currency);
    const c = money(meta.regularMarketPrice, scale)!;
    const pc = money(meta.chartPreviousClose ?? meta.previousClose, scale) ?? c;
    const d = Math.round((c - pc) * 10000) / 10000;
    const dp = pc ? Math.round((d / pc) * 10000) / 100 : 0;
    const open = meta.regularMarketOpen ?? result?.indicators?.quote?.[0]?.open?.find((v) => typeof v === 'number') ?? undefined;
    return {
        c, d, dp, pc,
        h: money(meta.regularMarketDayHigh, scale),
        l: money(meta.regularMarketDayLow, scale),
        o: money(open, scale),
        t: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
        currency: meta.currency === 'ILA' ? 'ILS' : (meta.currency ?? 'ILS'),
        name: meta.longName || meta.shortName || '',
        exchange: meta.exchangeName === 'TLV' ? 'TASE' : (meta.exchangeName ?? ''),
    };
}

const responseCache = new Map<string, { value: YahooQuote | null; freshUntil: number; failed?: boolean }>();
const inFlight = new Map<string, Promise<YahooQuote | null>>();

async function request(symbol: string): Promise<YahooQuote | null> {
    const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
    });
    if (res.status === 404) return null; // unknown or delisted symbol: not an outage
    if (!res.ok) throw new Error(`Yahoo fetch failed ${res.status} for ${symbol}`);
    return normaliseYahooChart((await res.json()) as ChartResponse);
}

// Stale-while-revalidate with a failure cool-down, the same contract finnhub.actions keeps:
// one network call per symbol at a time, expired entries served instantly and refreshed in the background.
export async function getYahooQuote(symbol: string, revalidateSeconds = 0): Promise<YahooQuote | null> {
    const key = symbol.toUpperCase();
    const store = (entry: { value: YahooQuote | null; freshUntil: number; failed?: boolean }) => {
        if (responseCache.size >= MAX_CACHE_ENTRIES) responseCache.delete(responseCache.keys().next().value!);
        responseCache.set(key, entry);
    };
    const refresh = () => {
        let pending = inFlight.get(key);
        if (!pending) {
            pending = request(key).then(
                (value) => { store({ value, freshUntil: Date.now() + Math.max(revalidateSeconds, 1) * 1000 }); return value; },
                (error) => {
                    const existing = responseCache.get(key);
                    store(existing && !existing.failed
                        ? { value: existing.value, freshUntil: Date.now() + FAILURE_TTL_MS }
                        : { value: null, freshUntil: Date.now() + FAILURE_TTL_MS, failed: true });
                    console.error('Error fetching Yahoo quote for', key, error);
                    return existing?.value ?? null;
                },
            ).finally(() => inFlight.delete(key));
            inFlight.set(key, pending);
        }
        return pending;
    };

    const hit = responseCache.get(key);
    if (!hit || (hit.failed && hit.freshUntil < Date.now())) return refresh();
    if (hit.failed) return null;
    if (hit.freshUntil < Date.now()) void refresh();
    return hit.value;
}
