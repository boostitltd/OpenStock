// The momentum strategy, pure and testable, with the exact rules that were backtested on Tel Aviv since 2006:
// each month, rank the large Tel Aviv stocks by their return over the last 12 months excluding the most recent one
// (the "12-1" momentum that the research literature uses). New money buys the top 5 equally, at most one per sector
// (chosen after the first backtest: it cost nothing and spreads the buys); a holding is sold
// only when it falls out of the top 15, which keeps selling, and so tax, rare. Taxes are 25% on realised gains
// with losses carried forward, trading costs 0.2% a side.

export type Monthly = { month: string; close: number }[];   // YYYY-MM, oldest first, dividend-adjusted

export const TOP_BUY = 5;
export const KEEP_TOP = 15;
export const LOOKBACK = 12;
export const TAX_RATE = 0.25;
export const COST = 0.002;
export const SECTOR_CAP = 1;   // at most one new buy per sector each month

// Sector groups for the cap, coarser than the display sectors (all real estate is one group, all IT services one).
export const GROUP: Record<string, string> = {
    LUMI: 'bank', POLI: 'bank', DSCT: 'bank', MZTF: 'bank', FIBI: 'bank', PHOE: 'ins', HARL: 'ins', CLIS: 'ins', MGDL: 'ins',
    TEVA: 'pharma', NICE: 'tech', ESLT: 'def', NVMI: 'chip', TSEM: 'chip', ICL: 'chem', BEZQ: 'tel', PTNR: 'tel', CEL: 'tel',
    AZRG: 're', MLSR: 're', BIG: 're', AMOT: 're', ALHE: 're', MVNE: 're', AURA: 're', ISCN: 're', DLEKG: 'energy', NWMD: 'energy',
    ORA: 'green', ENLT: 'green', ENRG: 'green', OPCE: 'green', SAE: 'food', STRS: 'food', FTAL: 'travel', ELAL: 'travel',
    SPEN: 'infra', DANE: 'care', MTRX: 'it', ONE: 'it', FORTY: 'it',
};
export const groupOf = (symbol: string) => GROUP[symbol.toUpperCase().replace(/\.TA$/, '')] ?? symbol;

// This month's buys: walk down the ranking, at most SECTOR_CAP per group, until TOP_BUY are chosen.
export function pickBuys(ranked: Ranked[], n = TOP_BUY, cap = SECTOR_CAP): Ranked[] {
    const out: Ranked[] = [], count = new Map<string, number>();
    for (const r of ranked) {
        const g = groupOf(r.symbol);
        if ((count.get(g) ?? 0) >= cap) continue;
        out.push(r); count.set(g, (count.get(g) ?? 0) + 1);
        if (out.length === n) break;
    }
    return out;
}

// Yahoo's old Tel Aviv data has single-month spikes (x10 one month, /10 the next: an agorot/shekel slip). A point
// that jumps by more than 2.5x and is undone the next month is dropped; a real move doesn't reverse like that.
export function cleanSpikes(rows: Monthly): Monthly {
    const out = rows.filter((r) => r.close > 0).slice();
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 1; i < out.length - 1; i++) {
            const r1 = out[i].close / out[i - 1].close, r2 = out[i + 1].close / out[i].close;
            if ((r1 > 2.5 || r1 < 0.4) && r1 * r2 > 0.5 && r1 * r2 < 2) { out.splice(i, 1); changed = true; break; }
        }
        if (out.length > 2) {
            const r = out[1].close / out[0].close;
            if (r > 2.5 || r < 0.4) { out.splice(0, 1); changed = true; }
        }
    }
    return out;
}

type Table = { months: string[]; px: Map<string, Map<string, number>> };

export function toTable(series: Record<string, Monthly>): Table {
    const px = new Map<string, Map<string, number>>();
    const all = new Set<string>();
    for (const [s, rows] of Object.entries(series)) {
        const m = new Map<string, number>();
        for (const r of cleanSpikes(rows)) { m.set(r.month, r.close); all.add(r.month); }
        px.set(s, m);
    }
    return { months: [...all].sort(), px };
}

const price = (t: Table, s: string, i: number) => (i >= 0 && i < t.months.length ? t.px.get(s)?.get(t.months[i]) ?? null : null);

// 12-1 momentum at month i: from the close 12 months back to the close one month back.
export function momentumAt(t: Table, s: string, i: number): number | null {
    for (let k = 0; k <= LOOKBACK; k++) if (price(t, s, i - k) === null) return null;
    return price(t, s, i - 1)! / price(t, s, i - LOOKBACK)! - 1;
}

export type Ranked = { symbol: string; momentumPct: number; rank: number };

export function rankAt(t: Table, i: number, symbols?: string[]): Ranked[] {
    const pool = symbols ?? [...t.px.keys()];
    return pool
        .map((s) => ({ symbol: s, m: momentumAt(t, s, i) }))
        .filter((x): x is { symbol: string; m: number } => x.m !== null)
        .sort((a, b) => b.m - a.m)
        .map((x, k) => ({ symbol: x.symbol, momentumPct: Math.round(x.m * 1000) / 10, rank: k + 1 }));
}

export type BacktestPoint = { month: string; strategy: number; strategyTaxFree: number; equal: number; index: number; invested: number };
export type BacktestStats = { from: string; to: string; invested: number; strategy: number; strategyTaxFree: number; equal: number; index: number;
    strategyPct: number; strategyTaxFreePct: number; equalPct: number; indexPct: number };

// Yearly return that turns `monthly` a month into `final` (money-weighted), by bisection.
export function irrMonthly(final: number, months: number, monthly: number): number {
    let lo = -0.9, hi = 2;
    for (let k = 0; k < 100; k++) {
        const r = (lo + hi) / 2, m = Math.pow(1 + r, 1 / 12) - 1;
        let fv = 0;
        for (let j = 0; j < months; j++) fv += monthly * Math.pow(1 + m, months - j);
        if (fv < final) lo = r; else hi = r;
    }
    return Math.round(((lo + hi) / 2) * 1000) / 10;
}

// Put `monthly` in every month from `from` to `to`, three ways, and value each after the tax due on selling it all
// at the end: the strategy (taxable account and a tax-free one), every stock equally without selling, and the index.
export function backtest(t: Table, indexSeries: Monthly, from: string, to: string, monthly = 1000): { points: BacktestPoint[]; stats: BacktestStats } | null {
    const idx = new Map(cleanSpikes(indexSeries).map((r) => [r.month, r.close]));
    const symbols = [...t.px.keys()];
    type Lot = { units: number; cost: number };
    const run = (taxed: boolean) => ({ lots: new Map<string, Lot>(), loss: 0, taxed });
    const accounts = [run(true), run(false)];
    const equal = new Map<string, Lot>();
    let indexUnits = 0, invested = 0;
    const points: BacktestPoint[] = [];
    let lastI = -1;

    const sell = (acc: ReturnType<typeof run>, s: string, p: number) => {
        const lot = acc.lots.get(s)!; acc.lots.delete(s);
        const value = lot.units * p * (1 - COST), gain = value - lot.cost;
        if (!acc.taxed) return value;
        if (gain <= 0) { acc.loss += -gain; return value; }
        const offset = Math.min(gain, acc.loss); acc.loss -= offset;
        return value - (gain - offset) * TAX_RATE;
    };
    const valueAfterTax = (lots: Map<string, Lot>, i: number, loss: number, taxed: boolean) => {
        let v = 0, g = 0;
        for (const [s, l] of lots) { const p = price(t, s, i) ?? 0; v += l.units * p; g += l.units * p - l.cost; }
        return taxed ? v - Math.max(0, g - loss) * TAX_RATE : v;
    };

    for (let i = 0; i < t.months.length; i++) {
        const month = t.months[i];
        if (month < from || month > to || !idx.has(month)) continue;
        const ranked = rankAt(t, i, symbols);
        if (ranked.length < KEEP_TOP) continue;
        lastI = i;
        const buy = pickBuys(ranked).map((r) => r.symbol);
        const keep = new Set(ranked.slice(0, KEEP_TOP).map((r) => r.symbol));
        for (const acc of accounts) {
            let cash = monthly;
            for (const s of [...acc.lots.keys()]) {
                const p = price(t, s, i);
                if (p !== null && !keep.has(s)) cash += sell(acc, s, p);
            }
            for (const s of buy) {
                const amt = cash / buy.length, p = price(t, s, i)!;
                const l = acc.lots.get(s) ?? { units: 0, cost: 0 };
                acc.lots.set(s, { units: l.units + (amt * (1 - COST)) / p, cost: l.cost + amt });
            }
        }
        const live = symbols.filter((s) => price(t, s, i) !== null);
        for (const s of live) {
            const l = equal.get(s) ?? { units: 0, cost: 0 };
            equal.set(s, { units: l.units + monthly / live.length / price(t, s, i)!, cost: l.cost + monthly / live.length });
        }
        indexUnits += monthly / idx.get(month)!;
        invested += monthly;
        if (month.endsWith('-12') || month === to) {
            const iv = indexUnits * idx.get(month)!;
            points.push({
                month, invested,
                strategy: Math.round(valueAfterTax(accounts[0].lots, i, accounts[0].loss, true)),
                strategyTaxFree: Math.round(valueAfterTax(accounts[1].lots, i, 0, false)),
                equal: Math.round(valueAfterTax(equal, i, 0, true)),
                index: Math.round(iv - Math.max(0, iv - invested) * TAX_RATE),
            });
        }
    }
    if (lastI < 0 || !points.length) return null;
    const end = points[points.length - 1];
    const n = invested / monthly;
    return {
        points,
        stats: {
            from, to: end.month, invested, strategy: end.strategy, strategyTaxFree: end.strategyTaxFree, equal: end.equal, index: end.index,
            strategyPct: irrMonthly(end.strategy, n, monthly), strategyTaxFreePct: irrMonthly(end.strategyTaxFree, n, monthly),
            equalPct: irrMonthly(end.equal, n, monthly), indexPct: irrMonthly(end.index, n, monthly),
        },
    };
}
