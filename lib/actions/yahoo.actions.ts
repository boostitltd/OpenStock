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

// USD→ILS from Yahoo's ILS=X pair, cached for an hour. A portfolio that mixes Tel Aviv and New York
// needs one number to add shekels and dollars; when Yahoo is down the last good rate keeps serving.
const FX_FALLBACK_USD_ILS = 3.6;
export async function getUsdIls(): Promise<{ rate: number; live: boolean }> {
    const q = await getYahooQuote('ILS=X', 3600);
    return q?.c && q.c > 0 ? { rate: q.c, live: true } : { rate: FX_FALLBACK_USD_ILS, live: false };
}

// ---- History and fundamentals (for the outlook page) ---------------------------------------

export type YahooHistory = { symbol: string; dates: string[]; closes: number[]; currency: string };

type HistoryResponse = {
    chart?: { result?: { meta?: { currency?: string }; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] | null };
};

const historyCache = new Map<string, { value: YahooHistory | null; freshUntil: number }>();

// Daily closes for up to 5 years, in the holding's own currency (agorot → shekels), cached for 6 hours.
export async function getYahooHistory(symbol: string, range: '1y' | '2y' | '5y' = '5y'): Promise<YahooHistory | null> {
    const key = `${symbol.toUpperCase()}:${range}`;
    const hit = historyCache.get(key);
    if (hit && hit.freshUntil > Date.now()) return hit.value;
    try {
        const res = await fetch(`${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Yahoo history ${res.status} for ${symbol}`);
        const data = (await res.json()) as HistoryResponse;
        const r = data.chart?.result?.[0];
        const ts = r?.timestamp ?? [];
        const raw = r?.indicators?.quote?.[0]?.close ?? [];
        const scale = scaleFor(r?.meta?.currency);
        const dates: string[] = [], closes: number[] = [];
        ts.forEach((t, i) => { const c = raw[i]; if (typeof c === 'number' && c > 0) { dates.push(new Date(t * 1000).toISOString().slice(0, 10)); closes.push(c * scale); } });
        const value = closes.length ? { symbol: symbol.toUpperCase(), dates, closes, currency: r?.meta?.currency === 'ILA' ? 'ILS' : (r?.meta?.currency ?? 'USD') } : null;
        historyCache.set(key, { value, freshUntil: Date.now() + 6 * 3600 * 1000 });
        return value;
    } catch (error) {
        console.error('Error fetching Yahoo history for', symbol, error);
        historyCache.set(key, { value: hit?.value ?? null, freshUntil: Date.now() + FAILURE_TTL_MS });
        return hit?.value ?? null;
    }
}

export type YahooFundamentals = {
    targetMeanPrice: number | null; targetLowPrice: number | null; targetHighPrice: number | null; analysts: number | null;
    recommendation: string | null;   // Yahoo's key: strong_buy / buy / hold / underperform / sell / none
    trailingPE: number | null; forwardPE: number | null; dividendYieldPct: number | null;
    nextEarnings: string | null;     // ISO date
    business: YahooBusiness | null;
};

// How the company itself is doing, in the currency it reports in (Elbit reports in dollars, Bezeq in shekels).
// Rows Yahoo fills with zeros or stale years are dropped, so a short list means "partial data", never a fake trend.
export type YahooBusiness = {
    currency: string;
    yearly: { year: number; revenue: number; earnings: number | null }[];      // oldest first
    quarterly: { quarter: string; revenue: number; earnings: number | null }[];
    revenueGrowthPct: number | null;      // latest quarter vs the same quarter a year earlier
    earningsGrowthPct: number | null;
    profitMarginPct: number | null;
    operatingMarginPct: number | null;
    roePct: number | null;
    debtToEquityPct: number | null;
    freeCashflow: number | null;
    nextYearEarningsGrowthPct: number | null;  // analysts' estimate
    nextYearRevenueGrowthPct: number | null;
    recommendations: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
};

// Yahoo's quoteSummary needs a session cookie and a "crumb"; both are fetched once and reused for the process.
let crumbState: { cookie: string; crumb: string; until: number } | null = null;
async function yahooCrumb(): Promise<{ cookie: string; crumb: string } | null> {
    if (crumbState && crumbState.until > Date.now()) return crumbState;
    try {
        const first = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': USER_AGENT }, redirect: 'manual', signal: AbortSignal.timeout(8000), cache: 'no-store' });
        const cookie = (first.headers.get('set-cookie') ?? '').split(';')[0];
        if (!cookie) return null;
        const res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': USER_AGENT, Cookie: cookie }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
        const crumb = (await res.text()).trim();
        if (!res.ok || !crumb || crumb.includes('<')) return null;
        crumbState = { cookie, crumb, until: Date.now() + 12 * 3600 * 1000 };
        return crumbState;
    } catch (error) {
        console.error('Yahoo crumb failed', error);
        return null;
    }
}

const fundamentalsCache = new Map<string, { value: YahooFundamentals | null; freshUntil: number }>();
const num = (v: unknown): number | null => (v && typeof v === 'object' && 'raw' in v && typeof (v as { raw: unknown }).raw === 'number' ? (v as { raw: number }).raw : typeof v === 'number' ? v : null);

const pctOf = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 10);

// Exported for tests. Yahoo pads TASE companies with zero rows and years long gone (Strauss shows 2017 next to 2025);
// keep only real revenue from the last five years.
export function parseBusiness(r: Record<string, Record<string, unknown>>): YahooBusiness | null {
    const fd = (r.financialData ?? {}) as Record<string, unknown>;
    const chart = ((r.earnings ?? {}) as { financialsChart?: { yearly?: Record<string, unknown>[]; quarterly?: Record<string, unknown>[] } }).financialsChart ?? {};
    const thisYear = new Date().getFullYear();
    const yearly = (chart.yearly ?? [])
        .map((y) => ({ year: Number(y.date), revenue: num(y.revenue) ?? 0, earnings: num(y.earnings) }))
        .filter((y) => y.revenue > 0 && y.year >= thisYear - 5)
        .sort((a, b) => a.year - b.year);
    const quarterly = (chart.quarterly ?? [])
        .map((q) => ({ quarter: String(q.date ?? ''), revenue: num(q.revenue) ?? 0, earnings: num(q.earnings) }))
        .filter((q) => q.revenue > 0 && q.quarter);
    const trend = (((r.earningsTrend ?? {}) as { trend?: Record<string, unknown>[] }).trend ?? []).find((t) => t.period === '+1y');
    const rt = (((r.recommendationTrend ?? {}) as { trend?: Record<string, unknown>[] }).trend ?? []).find((t) => t.period === '0m');
    const recs = rt ? { strongBuy: Number(rt.strongBuy) || 0, buy: Number(rt.buy) || 0, hold: Number(rt.hold) || 0, sell: Number(rt.sell) || 0, strongSell: Number(rt.strongSell) || 0 } : null;
    const business: YahooBusiness = {
        currency: typeof fd.financialCurrency === 'string' ? fd.financialCurrency : 'ILS',
        yearly, quarterly,
        revenueGrowthPct: pctOf(num(fd.revenueGrowth)), earningsGrowthPct: pctOf(num(fd.earningsGrowth)),
        profitMarginPct: pctOf(num(fd.profitMargins)), operatingMarginPct: pctOf(num(fd.operatingMargins)),
        roePct: pctOf(num(fd.returnOnEquity)), debtToEquityPct: num(fd.debtToEquity), freeCashflow: num(fd.freeCashflow),
        nextYearEarningsGrowthPct: pctOf(num(trend?.growth)),
        nextYearRevenueGrowthPct: pctOf(num((trend?.revenueEstimate as Record<string, unknown> | undefined)?.growth)),
        recommendations: recs && Object.values(recs).some((n) => n > 0) ? recs : null,
    };
    const empty = !yearly.length && !quarterly.length && business.revenueGrowthPct === null && business.profitMarginPct === null;
    return empty ? null : business;
}

// Analyst targets, multiples, dividend yield and the next earnings date, cached for 24 hours. Null when Yahoo
// has nothing (common for small Tel Aviv names), never a made-up value.
export async function getYahooFundamentals(symbol: string): Promise<YahooFundamentals | null> {
    const key = symbol.toUpperCase();
    const hit = fundamentalsCache.get(key);
    if (hit && hit.freshUntil > Date.now()) return hit.value;
    const auth = await yahooCrumb();
    if (!auth) return hit?.value ?? null;
    try {
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData,summaryDetail,calendarEvents,earnings,earningsTrend,recommendationTrend&crumb=${encodeURIComponent(auth.crumb)}`;
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Cookie: auth.cookie, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
        if (res.status === 401) crumbState = null;
        if (!res.ok) throw new Error(`Yahoo quoteSummary ${res.status} for ${symbol}`);
        const r = ((await res.json()) as { quoteSummary?: { result?: Record<string, Record<string, unknown>>[] | null } }).quoteSummary?.result?.[0];
        if (!r) { fundamentalsCache.set(key, { value: null, freshUntil: Date.now() + 24 * 3600 * 1000 }); return null; }
        const fd = r.financialData ?? {}, sd = r.summaryDetail ?? {}, ce = (r.calendarEvents ?? {}) as { earnings?: { earningsDate?: unknown[] } };
        // Tel Aviv prices come back in agorot here too
        const scale = scaleFor((sd as { currency?: unknown }).currency as string | undefined) === 0.01 || key.endsWith('.TA') ? 0.01 : 1;
        const px = (v: unknown) => { const n = num(v); return n === null ? null : Math.round(n * scale * 100) / 100; };
        const earnings = num(ce.earnings?.earningsDate?.[0]);
        const value: YahooFundamentals = {
            targetMeanPrice: px(fd.targetMeanPrice), targetLowPrice: px(fd.targetLowPrice), targetHighPrice: px(fd.targetHighPrice),
            analysts: num(fd.numberOfAnalystOpinions),
            recommendation: typeof fd.recommendationKey === 'string' && fd.recommendationKey !== 'none' ? fd.recommendationKey : null,
            trailingPE: num(sd.trailingPE), forwardPE: num(sd.forwardPE),
            dividendYieldPct: num(sd.dividendYield) !== null ? Math.round(num(sd.dividendYield)! * 10000) / 100 : null,
            nextEarnings: earnings ? new Date(earnings * 1000).toISOString().slice(0, 10) : null,
            business: parseBusiness(r),
        };
        fundamentalsCache.set(key, { value, freshUntil: Date.now() + 24 * 3600 * 1000 });
        return value;
    } catch (error) {
        console.error('Error fetching Yahoo fundamentals for', symbol, error);
        fundamentalsCache.set(key, { value: hit?.value ?? null, freshUntil: Date.now() + FAILURE_TTL_MS });
        return hit?.value ?? null;
    }
}
