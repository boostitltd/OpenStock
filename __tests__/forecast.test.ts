import { describe, expect, it } from 'vitest';
import { alignReturns, correlation, maxDrawdown, portfolioStats, rng, seriesStats, simulate } from '@/lib/forecast';

// A synthetic 3-year series with a known drift and noise, deterministic
const synth = (seed: number, days: number, dailyDrift: number, dailyVol: number, start = 100) => {
    const random = rng(seed);
    const closes = [start];
    for (let i = 1; i < days; i++) {
        // Box-Muller normal
        const u = Math.max(random(), 1e-12), v = random();
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        closes.push(closes[i - 1] * Math.exp(dailyDrift + dailyVol * z));
    }
    const d0 = new Date('2023-01-02').getTime();
    const dates = closes.map((_, i) => new Date(d0 + i * 86400000).toISOString().slice(0, 10));
    return { dates, closes };
};

describe('series statistics', () => {
    it('measures drawdown peak to trough', () => {
        expect(maxDrawdown([100, 120, 90, 110, 60, 80])).toBeCloseTo(60 / 120 - 1, 6);
        expect(maxDrawdown([1, 2, 3])).toBe(0);
    });

    it('recovers the drift and volatility it was given, roughly', () => {
        const s = synth(1, 756, 0.0004, 0.012);
        const st = seriesStats(s.closes)!;
        expect(st.annualVolPct).toBeGreaterThan(14);
        expect(st.annualVolPct).toBeLessThan(24);
        expect(st.ma200).not.toBeNull();
        expect(st.fromHigh52wPct).toBeLessThanOrEqual(0);
        expect(st.days).toBe(756);
    });

    it('refuses a series too short to say anything', () => {
        expect(seriesStats([1, 2, 3])).toBeNull();
    });
});

describe('alignReturns', () => {
    it('joins two calendars and carries each series over its own holidays', () => {
        const a = { symbol: 'A', dates: ['2026-01-01', '2026-01-02', '2026-01-05'], closes: [10, 11, 12] };
        const b = { symbol: 'B', dates: ['2026-01-01', '2026-01-04', '2026-01-05'], closes: [20, 22, 21] };
        const { dates, rows } = alignReturns([a, b]);
        expect(dates).toEqual(['2026-01-02', '2026-01-04', '2026-01-05']);
        expect(rows[0][0]).toBeCloseTo(Math.log(11 / 10), 8); // A moved
        expect(rows[0][1]).toBe(0);                            // B carried forward
        expect(rows[1][0]).toBe(0);                            // A carried forward
        expect(rows[1][1]).toBeCloseTo(Math.log(22 / 20), 8);
    });
});

describe('simulate', () => {
    const s = synth(7, 756, 0.0003, 0.01);
    const rows = alignReturns([{ symbol: 'X', ...s }]).rows;

    it('is deterministic for a seed and returns ordered percentiles', () => {
        const a = simulate({ rows, values: [10000], monthly: 0, weights: [1], years: 1, paths: 500 })!;
        const b = simulate({ rows, values: [10000], monthly: 0, weights: [1], years: 1, paths: 500 })!;
        expect(a).toEqual(b);
        expect(a.p10).toBeLessThanOrEqual(a.p25);
        expect(a.p25).toBeLessThanOrEqual(a.p50);
        expect(a.p50).toBeLessThanOrEqual(a.p75);
        expect(a.p75).toBeLessThanOrEqual(a.p90);
        expect(a.contributed).toBe(10000);
    });

    it('counts monthly contributions into what went in', () => {
        const r = simulate({ rows, values: [10000], monthly: 1000, weights: [1], years: 1, paths: 300 })!;
        expect(r.contributed).toBe(10000 + 12 * 1000);
        expect(r.p50).toBeGreaterThan(10000);
    });

    it('keeps the joint structure: two identical series move together', () => {
        const rows2 = rows.map((r) => [r[0], r[0]]);
        const st = portfolioStats(rows2, [5000, 5000])!;
        const single = portfolioStats(rows, [10000])!;
        expect(st.annualVolPct).toBeCloseTo(single.annualVolPct, 1);
        expect(correlation(rows2.map((r) => r[0]), rows2.map((r) => r[1]))).toBe(1);
    });

    it('returns null without enough history', () => {
        expect(simulate({ rows: rows.slice(0, 10), values: [1], monthly: 0, weights: [1], years: 1 })).toBeNull();
    });
});

describe('recentred simulation', () => {
    it('does not project a past bull run: a stock that rose 70% a year is simulated near the assumed trend', async () => {
        const { recentre } = await import('@/lib/forecast');
        const s = synth(11, 756, Math.log(1.7) / 252, 0.02);
        const rows = alignReturns([{ symbol: 'X', ...s }]).rows;
        const replay = simulate({ rows, values: [10000], monthly: 0, weights: [1], years: 1, paths: 1000 })!;
        const fair = simulate({ rows, values: [10000], monthly: 0, weights: [1], years: 1, paths: 1000, driftAnnual: 0.07 })!;
        expect(replay.medianAnnualPct).toBeGreaterThan(40);
        expect(fair.medianAnnualPct).toBeGreaterThan(-5);
        expect(fair.medianAnnualPct).toBeLessThan(15);
        expect(fair.probBelowContributed).toBeGreaterThan(20); // a volatile single stock can lose money
        const r = recentre(rows, 0.07);
        const meanDaily = r.reduce((sum, x) => sum + x[0], 0) / r.length;
        expect(meanDaily).toBeCloseTo(Math.log(1.07) / 252, 10);
    });
});
