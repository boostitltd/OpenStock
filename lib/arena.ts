// The arena: other ways of choosing stocks, run through the very same rules as the momentum method (buy the top 5
// each month, one per sector, sell only when a holding leaves the top 15, 25% tax, 0.2% costs), against monkeys that
// rank the stocks at random. A method only counts if it beat almost all the monkeys over twenty years AND beat the
// typical monkey in each decade on its own: trying several methods and keeping the best one finds luck, and the
// monkeys measure how much luck there is. The luck test compares before tax, so a method that sells more often
// isn't judged by its tax bill; the table shows after tax too, which is what lands in the account.

import { backtest, LOOKBACK, momentumAt, price, type BacktestStats, type Monthly, type Ranked, type Table } from '@/lib/momentum';

export type MethodId = 'momentum' | 'momentum6' | 'nearHigh' | 'dividend' | 'losers' | 'steady';
type Score = (t: Table, s: string, i: number) => number | null;

const window = (t: Table, s: string, i: number, n: number) => {
    const out: number[] = [];
    for (let k = n; k >= 1; k--) { const p = price(t, s, i - k); if (p === null) return null; out.push(p); }
    return price(t, s, i) === null ? null : out;
};
const stdev = (xs: number[]) => { const m = xs.reduce((a, x) => a + x, 0) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length); };

// Every score uses months that have already closed: nothing a person couldn't have known on the day.
const SCORES: Record<MethodId, Score> = {
    momentum: (t, s, i) => momentumAt(t, s, i),
    momentum6: (t, s, i) => { const w = window(t, s, i, 7); return w ? w[6] / w[0] - 1 : null; },
    nearHigh: (t, s, i) => { const w = window(t, s, i, LOOKBACK); return w ? w[w.length - 1] / Math.max(...w) : null; },
    dividend: (t, s, i) => { const y = t.yld.get(s)?.get(t.months[i - 1]); return y === undefined || price(t, s, i) === null ? null : y; },
    losers: (t, s, i) => { const w = window(t, s, i, 37); return w ? -(w[36] / w[0] - 1) : null; },
    steady: (t, s, i) => { const w = window(t, s, i, 25); return w ? -stdev(w.slice(1).map((p, k) => p / w[k] - 1)) : null; },
};

export const METHODS: { id: MethodId; name: string; how: string }[] = [
    { id: 'momentum', name: 'מה שעלה הכי הרבה בשנה', how: 'השיטה של המערכת: 5 המניות שעלו הכי הרבה ב-12 החודשים האחרונים, בלי החודש האחרון.' },
    { id: 'momentum6', name: 'מה שעלה הכי הרבה בחצי שנה', how: 'אותו רעיון, על חצי שנה במקום שנה.' },
    { id: 'nearHigh', name: 'הכי קרובות לשיא', how: 'המניות שהמחיר שלהן הכי קרוב למחיר הגבוה ביותר שלהן בשנה האחרונה.' },
    { id: 'dividend', name: 'דיבידנד גבוה', how: 'המניות שחילקו הכי הרבה דיבידנד בשנה האחרונה, ביחס למחיר.' },
    { id: 'losers', name: 'מה שירד הכי הרבה', how: 'קונים בזול: המניות שירדו הכי הרבה (או עלו הכי מעט) בשלוש השנים האחרונות.' },
    { id: 'steady', name: 'הכי יציבות', how: 'המניות שהמחיר שלהן זז הכי מעט בשנתיים האחרונות.' },
];

const rankBy = (score: Score) => (t: Table, i: number, symbols: string[]): Ranked[] => symbols
    .map((s) => ({ symbol: s, v: score(t, s, i) }))
    .filter((x): x is { symbol: string; v: number } => x.v !== null && Number.isFinite(x.v))
    .sort((a, b) => b.v - a.v)
    .map((x, k) => ({ symbol: x.symbol, momentumPct: Math.round(x.v * 1000) / 10, rank: k + 1 }));

// A small seeded generator, so monkey number 17 picks the same stocks every time the page is computed.
function rng(seed: number) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// A monkey ranks, at random, the same stocks the method could have ranked (a year of prices behind them).
export const monkey = (seed: number) => {
    const r = rng(seed);
    return (t: Table, i: number, symbols: string[]): Ranked[] => {
        const pool = symbols.filter((s) => momentumAt(t, s, i) !== null);
        for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
        return pool.map((symbol, k) => ({ symbol, momentumPct: 0, rank: k + 1 }));
    };
};

export type Period = { from: string; to: string };
export type MethodResult = {
    id: MethodId; name: string; how: string;
    afterTaxPct: number; beforeTaxPct: number; finalValue: number; invested: number;
    decadePcts: [number, number];         // before tax, first decade and second
    beatMonkeysPct: number;               // share of monkeys it beat over the whole period, before tax
    beatTypicalMonkeyBothDecades: boolean;
    passed: boolean;
};
export type ArenaResult = {
    periods: { full: Period; first: Period; second: Period };
    monkeys: number;
    methods: MethodResult[];
    equal: { afterTaxPct: number }; index: { afterTaxPct: number };
    monkey: { medianPct: number; p5Pct: number; p95Pct: number; medianAfterTaxPct: number; first: number; second: number; all: number[] };
};

const quantile = (xs: number[], q: number) => { const v = xs.slice().sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(q * v.length))]; };

export const PASS_BEAT = 95;

export function runArena(t: Table, index: Monthly, end: string, monkeys = 300, from = '2006-01'): ArenaResult | null {
    const full = { from, to: end }, first = { from, to: '2015-12' }, second = { from: '2016-01', to: end };
    const run = (p: Period, rank?: Parameters<typeof backtest>[5]) => backtest(t, index, p.from, p.to, 1000, rank)?.stats ?? null;

    const m: { full: BacktestStats; first: BacktestStats; second: BacktestStats }[] = [];
    for (let k = 0; k < monkeys; k++) {
        const a = run(full, monkey(k + 1)), b = run(first, monkey(100000 + k)), c = run(second, monkey(200000 + k));
        if (a && b && c) m.push({ full: a, first: b, second: c });
    }
    if (!m.length) return null;
    const mFull = m.map((x) => x.full.strategyTaxFreePct);
    const typical1 = quantile(m.map((x) => x.first.strategyTaxFreePct), 0.5), typical2 = quantile(m.map((x) => x.second.strategyTaxFreePct), 0.5);

    let base: BacktestStats | null = null;
    const methods: MethodResult[] = [];
    for (const def of METHODS) {
        const rank = rankBy(SCORES[def.id]);
        const a = run(full, rank), b = run(first, rank), c = run(second, rank);
        if (!a || !b || !c) continue;
        base ??= a;
        const beat = Math.round((mFull.filter((x) => x < a.strategyTaxFreePct).length / mFull.length) * 100);
        const both = b.strategyTaxFreePct > typical1 && c.strategyTaxFreePct > typical2;
        methods.push({
            ...def, afterTaxPct: a.strategyPct, beforeTaxPct: a.strategyTaxFreePct, finalValue: a.strategy, invested: a.invested,
            decadePcts: [b.strategyTaxFreePct, c.strategyTaxFreePct], beatMonkeysPct: beat, beatTypicalMonkeyBothDecades: both,
            passed: beat >= PASS_BEAT && both,
        });
    }
    if (!base) return null;
    methods.sort((x, y) => y.afterTaxPct - x.afterTaxPct);
    return {
        periods: { full: { from, to: base.to }, first, second }, monkeys: m.length, methods,
        equal: { afterTaxPct: base.equalPct }, index: { afterTaxPct: base.indexPct },
        monkey: { medianPct: quantile(mFull, 0.5), p5Pct: quantile(mFull, 0.05), p95Pct: quantile(mFull, 0.95), medianAfterTaxPct: quantile(m.map((x) => x.full.strategyPct), 0.5), first: typical1, second: typical2, all: mFull },
    };
}

// The live game: every method gets 1,000 a month of pretend money from PAPER_START and trades by its rules at each
// month's close (this month's "close" is today's price until the month ends). The rules are fixed in this file, so
// nothing can be tuned after the fact; changing a rule here restarts the game and must be said out loud.
export const PAPER_START = '2026-10';
export type PaperRow = { id: string; name: string; invested: number; value: number; gainPct: number; months: number };

export function runPaper(t: Table, index: Monthly, monkeys = 100, start = PAPER_START): { start: string; rows: PaperRow[]; monkeyRange: [number, number] | null } {
    const last = t.months[t.months.length - 1];
    const row = (id: string, name: string, s: BacktestStats | null, value = s?.strategy ?? 0): PaperRow | null => s && {
        id, name, invested: s.invested, value, gainPct: Math.round((value / s.invested - 1) * 1000) / 10, months: Math.round(s.invested / 1000),
    };
    const rows: PaperRow[] = [];
    let base: BacktestStats | null = null;
    for (const def of METHODS) {
        const s = backtest(t, index, start, last, 1000, rankBy(SCORES[def.id]))?.stats ?? null;
        base ??= s;
        const r = row(def.id, def.name, s);
        if (r) rows.push(r);
    }
    const ms = Array.from({ length: monkeys }, (_, k) => backtest(t, index, start, last, 1000, monkey(900000 + k))?.stats ?? null).filter((x): x is BacktestStats => x !== null);
    let range: [number, number] | null = null;
    if (ms.length) {
        const vals = ms.map((x) => x.strategy);
        const r = row('monkey', 'הקוף האמצעי', ms[0], quantile(vals, 0.5));
        if (r) rows.push(r);
        range = [quantile(vals, 0.1), quantile(vals, 0.9)].map((v) => Math.round((v / ms[0].invested - 1) * 1000) / 10) as [number, number];
    }
    if (base) {
        for (const [id, name, value] of [['equal', 'כל המניות בחלקים שווים', base.equal], ['index', 'מדד ת"א 125', base.index]] as const) {
            const r = row(id, name, base, value);
            if (r) rows.push(r);
        }
    }
    rows.sort((a, b) => b.value - a.value);
    return { start, rows, monkeyRange: range };
}
