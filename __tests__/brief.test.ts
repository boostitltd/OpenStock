import { describe, expect, it } from 'vitest';
import { composeBrief, forecastDrivers, holdingEvents, type BriefHolding, type BriefNow, type BriefPrev } from '@/lib/brief';

const holding = (over: Partial<BriefHolding> = {}): BriefHolding => ({
    symbol: 'PHOE.TA', name: 'Phoenix Financial', currency: 'ILS', quantity: 30, price: 180, value: 5400, weightPct: 100,
    vsMa200Pct: 5, fromHigh52wPct: -3, analystTarget: 215, analysts: 1, targetPrice: 245, targetDistancePct: 36, targetReached: false, nextEarnings: null,
    ...over,
});

const now = (over: Partial<BriefNow> = {}): BriefNow => ({
    at: new Date('2026-11-01T06:00:00Z'), base: 'ILS', totalValue: 5400, monthlyBudget: 0, assumedReturnPct: 7,
    sims: [{ years: 1, contributed: 5400, p10: 3900, p50: 5650, p90: 8350, probBelowContributed: 44 }],
    holdings: [holding()],
    ideas: [
        { symbol: 'VXUS', he: 'מדד עולמי ללא ארה"ב', kind: 'index', verdict: 'buy', reasons: ['מורידה את התנודתיות של התיק מ-35% ל-26%'], volBefore: 35, volAfter: 26 },
        { symbol: 'SPY', he: 'מדד S&P 500', kind: 'index', verdict: 'buy', reasons: [], similarTo: 'VXUS', volBefore: 35, volAfter: 26 },
        { symbol: 'ESLT.TA', he: 'אלביט מערכות', kind: 'stock', verdict: 'buy', reasons: ['כמעט לא קשורה'], volBefore: 35, volAfter: 30 },
        { symbol: 'HARL.TA', he: 'הראל', kind: 'stock', verdict: 'same', reasons: ['אותו הימור'], volBefore: 35, volAfter: 35 },
    ],
    plan: { hasTargets: false, buys: [], sells: [], leftover: 0 },
    ...over,
});

const prev = (over: Partial<NonNullable<BriefPrev>> = {}): BriefPrev => ({
    createdAt: new Date('2026-10-25T06:00:00Z'), totalValue: 5655, monthlyBudget: 0,
    sims: [{ years: 1, contributed: 5655, p10: 4135, p50: 5960, p90: 8841, probBelowContributed: 42 }],
    holdings: [{ symbol: 'PHOE.TA', quantity: 30, price: 188.5, vsMa200Pct: 8, analystTarget: 215, targetReached: false }],
    ideas: [{ symbol: 'VXUS', verdict: 'buy' }],
    ...over,
});

describe('holding events', () => {
    it('flags a target reached as urgent, and says it is still there the next week', () => {
        const reached = now({ holdings: [holding({ price: 250, targetReached: true, targetDistancePct: -2 })] });
        const first = holdingEvents(reached, prev());
        expect(first[0]).toMatchObject({ kind: 'target', urgent: true });
        expect(first[0].text).toContain('הגיעה ל');
        const again = holdingEvents(reached, prev({ holdings: [{ symbol: 'PHOE.TA', quantity: 30, price: 250, vsMa200Pct: 8, analystTarget: 215, targetReached: true }] }));
        expect(again[0].text).toContain('עדיין מעל');
    });

    it('treats crossing under the 200-day average as urgent, staying under as a note', () => {
        const under = now({ holdings: [holding({ vsMa200Pct: -4 })] });
        expect(holdingEvents(under, prev())[0]).toMatchObject({ kind: 'below-ma', urgent: true });
        const still = holdingEvents(under, prev({ holdings: [{ symbol: 'PHOE.TA', quantity: 30, price: 180, vsMa200Pct: -2, analystTarget: 215, targetReached: false }] }));
        expect(still[0]).toMatchObject({ kind: 'below-ma', urgent: false });
    });

    it('mentions earnings within two weeks and a moved analyst target', () => {
        const ev = holdingEvents(now({ holdings: [holding({ nextEarnings: '2026-11-10', analystTarget: 230 })] }), prev());
        expect(ev.map((x) => x.kind).sort()).toEqual(['analyst', 'earnings']);
        expect(ev.find((x) => x.kind === 'analyst')!.text).toContain('העלו');
    });

    it('stays quiet when nothing happened', () => {
        expect(holdingEvents(now(), prev())).toEqual([]);
    });
});

describe('forecast drivers', () => {
    it('names prices when nothing else changed', () => {
        expect(forecastDrivers(now(), prev())[0]).toContain('ירד');
    });
    it('names a new holding and a new monthly amount', () => {
        const d = forecastDrivers(now({ monthlyBudget: 1000, holdings: [holding(), holding({ symbol: 'ESLT.TA', name: 'Elbit', weightPct: 20 })] }), prev());
        expect(d.join(' ')).toContain('אלביט מערכות');
        expect(d.join(' ')).toContain('הסכום החודשי');
    });
    it('has nothing to compare on the first brief', () => {
        expect(forecastDrivers(now(), null)).toEqual([]);
    });
});

describe('composeBrief', () => {
    it('is right to left, names the best distinct ideas and skips the near-duplicate and the same bet', () => {
        const b = composeBrief(now(), prev(), 'https://example.test');
        expect(b.html).toContain('dir="rtl"');
        expect(b.html).toContain('מדד עולמי ללא ארה"ב'.replace(/"/g, '&quot;'));
        expect(b.html).toContain('אלביט מערכות');
        expect(b.html).not.toContain('מדד S&amp;P 500');
        expect(b.html).not.toContain('הראל');
        expect(b.html).toContain('https://example.test/portfolio/ideas');
        expect(b.subject).toContain('אין מה לטפל');
    });

    it('puts urgent items in the subject and warns about a single-stock portfolio', () => {
        const b = composeBrief(now({ holdings: [holding({ price: 250, targetReached: true })] }), prev(), 'https://x');
        expect(b.subject).toContain('דבר אחד לטפל בו');
        expect(b.html).toContain('100% מהתיק');
    });

    it('shows the change in the chance of loss against the last brief', () => {
        expect(composeBrief(now(), prev(), 'https://x').html).toContain('עלה מ-42%');
    });

    it('escapes anything that came from the user', () => {
        const b = composeBrief(now({ holdings: [holding({ symbol: 'X<script>', name: '<b>x</b>' })] }), null, 'https://x');
        expect(b.html).not.toContain('<script>');
    });
});

describe('arena line', () => {
    it("names the leader and the system's place in the live game", () => {
        const { html } = composeBrief(now({ strategy: { buys: [{ name: 'אנלייט', rank: 1, momentumPct: 67, shares: 0, amount: 0 }], sells: [], keeps: [], backtest: null }, arena: { months: 2, leader: 'הכי קרובות לשיא', leaderPct: 3.1, systemPlace: 2, systemPct: 1.4, total: 9 } }), null, 'https://x.test');
        expect(html).toContain('זירת הקופים');
        expect(html).toContain('במקום 2 מתוך 9');
    });
});
