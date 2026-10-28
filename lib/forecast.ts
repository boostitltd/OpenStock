// Forecasts as ranges, never as a number: everything here is resampled from each holding's own history.
// Pure and deterministic (seeded), so the same portfolio gives the same ranges until the data changes.

export type Series = { symbol: string; dates: string[]; closes: number[] }; // closes in the holding's own currency

export type SeriesStats = {
    days: number;
    annualReturnPct: number;     // mean log return × 252, as a percentage
    annualVolPct: number;        // stdev of log returns × √252
    maxDrawdownPct: number;      // worst peak-to-trough over the window
    ma200: number | null;        // 200-day simple moving average of close
    vsMa200Pct: number | null;   // last close vs MA200, +above / -below
    high52w: number;
    fromHigh52wPct: number;      // last close vs 52-week high (<= 0)
    last: number;
};

const TRADING_DAYS = 252;

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const stdev = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1)); };
const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

export function logReturns(closes: number[]): number[] {
    const out: number[] = [];
    for (let i = 1; i < closes.length; i++) if (closes[i] > 0 && closes[i - 1] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
    return out;
}

export function maxDrawdown(closes: number[]): number {
    let peak = -Infinity, worst = 0;
    for (const c of closes) { if (c > peak) peak = c; const dd = c / peak - 1; if (dd < worst) worst = dd; }
    return worst;
}

export function seriesStats(closes: number[]): SeriesStats | null {
    if (closes.length < 30) return null;
    const r = logReturns(closes);
    const last = closes[closes.length - 1];
    const ma200 = closes.length >= 200 ? mean(closes.slice(-200)) : null;
    const yearWindow = closes.slice(-TRADING_DAYS);
    const high52w = Math.max(...yearWindow);
    return {
        days: closes.length,
        annualReturnPct: round((Math.exp(mean(r) * TRADING_DAYS) - 1) * 100),
        annualVolPct: round(stdev(r) * Math.sqrt(TRADING_DAYS) * 100),
        maxDrawdownPct: round(maxDrawdown(closes) * 100),
        ma200: ma200 !== null ? round(ma200, 2) : null,
        vsMa200Pct: ma200 !== null ? round((last / ma200 - 1) * 100) : null,
        high52w: round(high52w, 2),
        fromHigh52wPct: round((last / high52w - 1) * 100),
        last,
    };
}

// Several holdings on one calendar: the union of dates, each series carried forward over its own holidays.
// Returns aligned log-return rows (one row per day, one column per series), oldest first.
export function alignReturns(series: Series[]): { dates: string[]; rows: number[][] } {
    if (series.length === 0) return { dates: [], rows: [] };
    const dates = [...new Set(series.flatMap((s) => s.dates))].sort();
    const closesBy = series.map((s) => new Map(s.dates.map((d, i) => [d, s.closes[i]])));
    const filled: number[][] = [];
    const lastSeen: (number | null)[] = series.map(() => null);
    for (const d of dates) {
        const row = series.map((_, k) => { const v = closesBy[k].get(d); if (v != null && v > 0) lastSeen[k] = v; return lastSeen[k]; });
        if (row.every((v) => v !== null)) filled.push(row as number[]);
    }
    const rows: number[][] = [];
    for (let i = 1; i < filled.length; i++) rows.push(filled[i].map((v, k) => Math.log(v / filled[i - 1][k])));
    return { dates: dates.slice(dates.length - rows.length), rows };
}

// Deterministic RNG (mulberry32): anyone can reproduce a run from its seed.
export function rng(seed: number) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type SimInput = {
    rows: number[][];          // aligned daily log returns, one column per holding
    values: number[];          // today's value of each holding, base currency
    monthly: number;           // contribution every ~21 trading days, base currency
    weights: number[];         // where contributions go (sum 1); same length as values
    years: number;
    paths?: number;
    block?: number;            // bootstrap block length in days (keeps short-run clustering)
    seed?: number;
    // The trend to assume, as a yearly return (0.07 = 7%). Each column's historical average is taken out and this
    // put in its place, so the simulation keeps the shape of the risk (swings, crashes, how holdings move together)
    // without projecting a past bull or bear run forward. Leave undefined to replay history as it was.
    driftAnnual?: number;
};

// Replace each column's average daily log return with the assumed one, keeping every deviation from it.
export function recentre(rows: number[][], driftAnnual: number): number[][] {
    if (rows.length === 0) return rows;
    const n = rows[0].length;
    const means = Array.from({ length: n }, (_, k) => rows.reduce((s, r) => s + r[k], 0) / rows.length);
    const target = Math.log(1 + driftAnnual) / TRADING_DAYS;
    return rows.map((r) => r.map((x, k) => x - means[k] + target));
}

export type SimResult = {
    years: number;
    paths: number;
    contributed: number;       // start value + all contributions
    p10: number; p25: number; p50: number; p75: number; p90: number;
    probBelowContributed: number;  // share of paths that end under what went in
    medianAnnualPct: number;       // annualised median path return on the start value only (0 contributions)
};

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];

// Block-bootstrap Monte Carlo on the joint history: each simulated day replays one real day for every holding
// at once, so the correlations between them are kept. Contributions land every 21 trading days at the target weights.
// The raw end values of every simulated path, sorted: for questions the percentiles don't answer, like
// "what is the chance of reaching 500,000 by 2036".
export function simulateEndings(input: SimInput): { endings: number[]; contributed: number } | null {
    const r = run(input);
    return r ? { endings: r.endings, contributed: r.contributed } : null;
}

export function simulate(input: SimInput): SimResult | null {
    const r = run(input);
    if (!r) return null;
    const { endings, growthOnly, contributed, start } = r;
    const { years } = input;
    const paths = endings.length;
    const medianGrowth = quantile(growthOnly, 0.5);
    return {
        years, paths, contributed: Math.round(contributed),
        p10: Math.round(quantile(endings, 0.1)), p25: Math.round(quantile(endings, 0.25)), p50: Math.round(quantile(endings, 0.5)),
        p75: Math.round(quantile(endings, 0.75)), p90: Math.round(quantile(endings, 0.9)),
        probBelowContributed: round(endings.filter((e) => e < contributed).length / paths * 100),
        medianAnnualPct: start > 0 ? round(((medianGrowth / start) ** (1 / years) - 1) * 100) : 0,
    };
}

function run(input: SimInput): { endings: number[]; growthOnly: number[]; contributed: number; start: number } | null {
    const { values, monthly, weights, years } = input;
    const rows = input.driftAnnual === undefined ? input.rows : recentre(input.rows, input.driftAnnual);
    const paths = input.paths ?? 2000, block = input.block ?? 20, random = rng(input.seed ?? 42);
    const n = values.length;
    if (rows.length < 60 || n === 0 || rows.some((r) => r.length !== n)) return null;
    const days = Math.round(years * TRADING_DAYS);
    const start = values.reduce((s, v) => s + v, 0);
    const contributions = Math.floor(days / 21);
    const contributed = start + contributions * monthly;
    const endings: number[] = new Array(paths);
    const growthOnly: number[] = new Array(paths);

    for (let p = 0; p < paths; p++) {
        const v = values.slice();
        const g = values.slice(); // same path, no contributions: isolates the market's own return
        let d = 0;
        while (d < days) {
            const startIdx = Math.floor(random() * rows.length);
            for (let b = 0; b < block && d < days; b++, d++) {
                const r = rows[(startIdx + b) % rows.length];
                for (let k = 0; k < n; k++) { const m = Math.exp(r[k]); v[k] *= m; g[k] *= m; }
                if ((d + 1) % 21 === 0 && monthly > 0) for (let k = 0; k < n; k++) v[k] += monthly * weights[k];
            }
        }
        endings[p] = v.reduce((s, x) => s + x, 0);
        growthOnly[p] = g.reduce((s, x) => s + x, 0);
    }
    endings.sort((a, b) => a - b);
    growthOnly.sort((a, b) => a - b);
    return { endings, growthOnly, contributed, start };
}

export type GoalResult = {
    amount: number; date: string; years: number;
    chancePct: number;                 // with today's portfolio and monthly amount
    requiredMonthly: number | null;    // for an 80% chance; null if even a large amount isn't enough
    medianAtDate: number;
};

// Chance of having `amount` by `years` from now, and the monthly amount that makes it 80%.
export function planGoal(input: Omit<SimInput, 'years' | 'monthly'> & { monthly: number; amount: number; years: number; date: string; target?: number }): GoalResult | null {
    const target = input.target ?? 0.8;
    const at = (monthly: number) => simulateEndings({ ...input, monthly, years: input.years, paths: input.paths ?? 800 });
    const now = at(input.monthly);
    if (!now) return null;
    const chance = now.endings.filter((e) => e >= input.amount).length / now.endings.length;
    const reach = (monthly: number) => { const r = at(monthly)!; return r.endings.filter((e) => e >= input.amount).length / r.endings.length; };
    let required: number | null = null;
    if (chance >= target) required = input.monthly;
    else {
        let lo = input.monthly, hi = Math.max(1000, input.monthly * 2);
        let guard = 0;
        while (reach(hi) < target && guard++ < 12) hi *= 2;
        if (reach(hi) >= target) {
            for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (reach(mid) >= target) hi = mid; else lo = mid; }
            required = Math.ceil(hi / 50) * 50;
        }
    }
    return { amount: input.amount, date: input.date, years: input.years, chancePct: Math.round(chance * 100), requiredMonthly: required, medianAtDate: Math.round(quantile(now.endings, 0.5)) };
}

// Portfolio-level return, volatility and worst drawdown of the weighted mix over the aligned history.
export function portfolioStats(rows: number[][], values: number[]): { annualReturnPct: number; annualVolPct: number; maxDrawdownPct: number } | null {
    const total = values.reduce((s, v) => s + v, 0);
    if (rows.length < 30 || total <= 0) return null;
    const w = values.map((v) => v / total);
    const daily = rows.map((r) => Math.log(r.reduce((s, x, k) => s + w[k] * Math.exp(x), 0)));
    const equity: number[] = [1];
    for (const d of daily) equity.push(equity[equity.length - 1] * Math.exp(d));
    return {
        annualReturnPct: round((Math.exp(mean(daily) * TRADING_DAYS) - 1) * 100),
        annualVolPct: round(stdev(daily) * Math.sqrt(TRADING_DAYS) * 100),
        maxDrawdownPct: round(maxDrawdown(equity) * 100),
    };
}

// Correlation of a candidate's daily returns with the existing portfolio's: the number that says whether
// adding it diversifies anything.
export function correlation(a: number[], b: number[]): number | null {
    const n = Math.min(a.length, b.length);
    if (n < 30) return null;
    const x = a.slice(-n), y = b.slice(-n), mx = mean(x), my = mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    return sxx && syy ? round(sxy / Math.sqrt(sxx * syy), 2) : null;
}
