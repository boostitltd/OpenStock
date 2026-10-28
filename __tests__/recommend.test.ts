import { describe, expect, it } from 'vitest';
import { rng } from '@/lib/forecast';
import { baseline, pickDistinct, rankIdeas, scoreIdea } from '@/lib/recommend';

// Deterministic synthetic prices; `shared` mixes in a common factor so correlations are controlled
const make = (symbol: string, seed: number, common: number[], load: number, vol = 0.015, drift = 0.0003, days = 756) => {
    const r = rng(seed);
    const closes = [100];
    for (let i = 1; i < days; i++) {
        const u = Math.max(r(), 1e-12), v = r();
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        const ret = drift + vol * (load * common[i] + Math.sqrt(1 - load * load) * z);
        closes.push(closes[i - 1] * Math.exp(ret));
    }
    const d0 = new Date('2023-01-02').getTime();
    return { symbol, dates: closes.map((_, i) => new Date(d0 + i * 86400000).toISOString().slice(0, 10)), closes };
};
const factor = (() => { const r = rng(99); return Array.from({ length: 756 }, () => { const u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }); })();

describe('buy ideas', () => {
    const held = make('HELD', 1, factor, 0.9, 0.022);
    const ctx = { holdings: [held], values: [10000], weights: [1], monthly: 0, driftAnnual: 0.07, weightPct: 20, paths: 600 };
    const base = baseline(ctx);

    it('calls a near-copy of the portfolio the same bet', () => {
        const twin = make('TWIN', 2, factor, 0.95, 0.022);
        const idea = scoreIdea(ctx, base, twin, 100, null);
        expect(idea.correlation!).toBeGreaterThan(0.6);
        expect(idea.verdict).toBe('same');
    });

    it('recommends an unrelated, calmer holding and says why', () => {
        const calm = make('CALM', 3, factor, 0, 0.009);
        const idea = scoreIdea(ctx, base, calm, 100, null);
        expect(Math.abs(idea.correlation!)).toBeLessThan(0.2);
        expect(idea.probLossAfter!).toBeLessThan(base.sim3y!.probBelowContributed);
        expect(idea.verdict).toBe('buy');
        expect(idea.reasons.join(' ')).toContain('מורידה את התנודתיות');
    });

    it('holds off on a wild stock even when it diversifies', () => {
        const wild = make('WILD', 5, factor, 0, 0.04);
        const idea = scoreIdea(ctx, base, wild, 100, null);
        expect(idea.stats!.annualVolPct).toBeGreaterThan(45);
        expect(idea.verdict).toBe('wait');
    });

    it('marks a near-duplicate of a better idea instead of recommending both', () => {
        const other = (() => { const r = rng(7); return Array.from({ length: 756 }, () => { const u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }); })();
        const a = make('IDX1', 11, other, 0.97, 0.009), b = make('IDX2', 12, other, 0.97, 0.010);
        const ranked = rankIdeas([scoreIdea(ctx, base, a, 100, null), scoreIdea(ctx, base, b, 100, null)]);
        const series = new Map([[a.symbol, a], [b.symbol, b]]);
        const picked = pickDistinct(ranked, (s) => series.get(s));
        expect(picked.map((i) => i.verdict)).toEqual(['buy', 'buy']);
        expect(picked[0].similarTo).toBeUndefined();
        expect(picked[1].similarTo).toBe(picked[0].symbol);
    });

    it('says wait when a good fit is falling hard', () => {
        const calm = make('FALL', 3, factor, 0, 0.009);
        const n = calm.closes.length;
        calm.closes = calm.closes.map((c, i) => (i > n - 60 ? c * (1 - 0.006 * (i - (n - 60))) : c)); // ~30% slide over the last 60 days
        const idea = scoreIdea(ctx, base, calm, calm.closes[n - 1], null);
        expect(idea.stats!.vsMa200Pct!).toBeLessThan(-10);
        expect(idea.verdict).toBe('wait');
    });

    it('says wait on a stretched valuation', () => {
        const calm = make('PRICY', 3, factor, 0, 0.009);
        const idea = scoreIdea(ctx, base, calm, 100, { targetMeanPrice: null, analysts: null, trailingPE: 90, forwardPE: null, dividendYieldPct: null });
        expect(idea.verdict).toBe('wait');
    });

    it('ranks buy before wait before same', () => {
        const ideas = [
            scoreIdea(ctx, base, make('TWIN', 2, factor, 0.95, 0.022), 100, null),
            scoreIdea(ctx, base, make('PRICY', 3, factor, 0, 0.009), 100, { targetMeanPrice: null, analysts: null, trailingPE: 90, forwardPE: null, dividendYieldPct: null }),
            scoreIdea(ctx, base, make('CALM', 4, factor, 0, 0.009), 100, null),
        ];
        expect(rankIdeas(ideas).map((i) => i.verdict)).toEqual(['buy', 'wait', 'same']);
    });
});
