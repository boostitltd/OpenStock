import { describe, expect, it } from 'vitest';
import { monkey, runArena, runPaper } from '@/lib/arena';
import { toTable, type Monthly } from '@/lib/momentum';

const months = (n: number, start = 2003) => Array.from({ length: n }, (_, i) => `${start + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
const N = (2026 - 2003) * 12 + 10;   // to 2026-10
// A little wobble so ranks aren't ties, steady growth that differs by stock, and a dividend in June.
const series = (growth: number, divPct = 0, k = 0): Monthly => {
    let p = 100, tr = 100;
    return months(N).map((month, i) => {
        const prev = p;
        p = prev * (1 + growth + 0.01 * Math.sin(i * 0.7 + k));
        const div = month.endsWith('-06') ? (p * divPct) / 100 : 0;
        tr = i ? tr * (p + div) / prev : p;
        return { month, close: tr, price: p, div };
    });
};
const SYMS = Array.from({ length: 20 }, (_, k) => `S${k}.TA`);
const t = toTable(Object.fromEntries(SYMS.map((s, k) => [s, series(0.001 * k, k % 3 === 0 ? 4 : 0, k)])));
const index = series(0.005);

describe('monkeys', () => {
    it('pick the same stocks for the same seed, and different ones otherwise', () => {
        const i = 100, syms = [...t.px.keys()];
        expect(monkey(7)(t, i, syms)).toEqual(monkey(7)(t, i, syms));
        expect(monkey(7)(t, i, syms).map((r) => r.symbol)).not.toEqual(monkey(8)(t, i, syms).map((r) => r.symbol));
    });
});

describe('dividend yield', () => {
    it('is the last 12 months of dividends over the price', () => {
        const y = t.yld.get('S0.TA')!.get('2020-12')!;
        expect(y).toBeGreaterThan(0.03);
        expect(y).toBeLessThan(0.05);
        expect(t.yld.get('S1.TA')!.get('2020-12')).toBe(0);
    });
});

describe('arena', () => {
    const a = runArena(t, index, '2026-09', 60)!;
    it('lets a method that buys the steady winners pass, and the one buying losers fail', () => {
        const byId = Object.fromEntries(a.methods.map((m) => [m.id, m]));
        expect(byId.momentum.passed).toBe(true);
        expect(byId.momentum.beatMonkeysPct).toBe(100);
        expect(byId.losers.passed).toBe(false);
        expect(a.monkeys).toBe(60);
        expect(a.methods[0].afterTaxPct).toBeGreaterThanOrEqual(a.methods.at(-1)!.afterTaxPct);
    });
    it('plays the live game from its start month only', () => {
        const p = runPaper(t, index, 20, '2026-01');
        const m = p.rows.find((r) => r.id === 'momentum')!;
        expect(m.invested).toBe(10 * 1000);
        expect(p.rows.map((r) => r.id)).toEqual(expect.arrayContaining(['monkey', 'equal', 'index']));
    });
});
