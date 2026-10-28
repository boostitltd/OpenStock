import { describe, expect, it } from 'vitest';
import { backtest, cleanSpikes, irrMonthly, momentumAt, pickBuys, rankAt, toTable, type Monthly } from '@/lib/momentum';

const months = (n: number, start = 2010) => Array.from({ length: n }, (_, i) => `${start + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
const series = (growth: number, n = 60, start = 100): Monthly => months(n).map((month, i) => ({ month, close: start * Math.pow(1 + growth, i) }));

describe('cleanSpikes', () => {
    it("drops Yahoo's x10-then-back spikes and keeps real moves", () => {
        const rows: Monthly = [100, 101, 1010, 102, 103, 40, 41].map((close, i) => ({ month: months(7)[i], close }));
        expect(cleanSpikes(rows).map((r) => r.close)).toEqual([100, 101, 102, 103, 40, 41]);
    });
});

describe('ranking', () => {
    const t = toTable({ 'FAST.TA': series(0.03), 'SLOW.TA': series(0.005), 'DOWN.TA': series(-0.01) });
    it('measures 12-1 momentum from completed months', () => {
        expect(momentumAt(t, 'FAST.TA', 30)).toBeCloseTo(Math.pow(1.03, 11) - 1, 6);
        expect(momentumAt(t, 'FAST.TA', 5)).toBeNull();
    });
    it('ranks the strongest first', () => {
        expect(rankAt(t, 30).map((r) => r.symbol)).toEqual(['FAST.TA', 'SLOW.TA', 'DOWN.TA']);
    });
    it('buys at most one per sector', () => {
        const ranked = ['HARL.TA', 'CLIS.TA', 'ENLT.TA', 'ORA.TA', 'ESLT.TA', 'TSEM.TA', 'NVMI.TA', 'BEZQ.TA'].map((symbol, i) => ({ symbol, momentumPct: 50 - i, rank: i + 1 }));
        expect(pickBuys(ranked).map((r) => r.symbol)).toEqual(['HARL.TA', 'ENLT.TA', 'ESLT.TA', 'TSEM.TA', 'BEZQ.TA']);
    });
});

describe('backtest', () => {
    it('puts the money in, sells nothing in a calm market, and compares after tax', () => {
        const syms = ['LUMI', 'POLI', 'HARL', 'TEVA', 'NICE', 'ESLT', 'TSEM', 'ICL', 'BEZQ', 'AZRG', 'DLEKG', 'ORA', 'SAE', 'FTAL', 'SPEN', 'DANE'];
        const t = toTable(Object.fromEntries(syms.map((s, k) => [`${s}.TA`, series(0.002 + k * 0.001, 72)])));
        const r = backtest(t, series(0.005, 72), '2011-01', '2015-12', 1000)!;
        expect(r.stats.invested).toBe(60 * 1000);
        expect(r.stats.strategy).toBeGreaterThan(r.stats.equal);     // the steadily stronger stocks win
        expect(r.stats.strategyTaxFree).toBeGreaterThanOrEqual(r.stats.strategy);
        expect(r.points.at(-1)!.month).toBe('2015-12');
    });
    it('turns a final value into a yearly return', () => {
        expect(irrMonthly(12000, 12, 1000)).toBeCloseTo(0, 1);
        expect(irrMonthly(12 * 1000 * 1.1, 12, 1000)).toBeGreaterThan(15);
    });
});
