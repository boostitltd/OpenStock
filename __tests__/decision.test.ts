import { describe, expect, it } from 'vitest';
import { businessHeadline, businessLines, estimateYear, fitLines } from '@/lib/decision';
import { parseBusiness, type YahooBusiness } from '@/lib/actions/yahoo.actions';
import { le } from '@/lib/format';

const biz = (over: Partial<YahooBusiness> = {}): YahooBusiness => ({
    currency: 'ILS', yearly: [{ year: 2024, revenue: 100, earnings: 10 }, { year: 2025, revenue: 116, earnings: 13.4 }], quarterly: [],
    revenueGrowthPct: null, earningsGrowthPct: null, profitMarginPct: 11.6, operatingMarginPct: null, roePct: null,
    debtToEquityPct: 40, freeCashflow: 5, nextYearEarningsGrowthPct: 9, nextYearRevenueGrowthPct: null, recommendations: null, ...over,
});

describe('estimateYear', () => {
    it('starts at the market average without analysts', () => {
        expect(estimateYear({ price: 100, targetMean: null, analysts: 0, dividendPct: null, series: null }).systemPct).toBe(7);
    });
    it('moves a sixth of the way for one analyst, and further with more', () => {
        const one = estimateYear({ price: 100, targetMean: 131, analysts: 1, dividendPct: 0.5, series: null });
        expect(one.analystTotalPct).toBeCloseTo(31.5, 5);
        expect(one.systemPct).toBeCloseTo(7 + (31.5 - 7) / 6, 1);
        const four = estimateYear({ price: 6.92, targetMean: 8.55, analysts: 4, dividendPct: 4.2, series: null });
        expect(four.weightPct).toBe(44);
        expect(four.systemPct).toBeGreaterThan(one.systemPct);
    });
});

describe('business sentences', () => {
    it('says what happened in plain words and in the right currency', () => {
        const lines = businessLines(biz({ currency: 'USD' })).map((l) => l.text).join(' | ');
        expect(lines).toContain('ההכנסות ב-2025 עלו ב-16%');
        expect(lines).toContain('הרווח עלה ב-34%');
        expect(lines).toContain('מכל 100 דולר');
        expect(lines).toContain('החוב נמוך');
        expect(businessHeadline(biz())!.text).toBe('ב-2025 ההכנסות עלו 16%, והרווח עלה 34%');
    });
    it('flags high debt and burning cash', () => {
        const tones = businessLines(biz({ debtToEquityPct: 327, freeCashflow: -3 })).filter((l) => l.tone === 'bad').map((l) => l.text).join(' ');
        expect(tones).toContain('פי 3.3');
        expect(tones).toContain('יותר מזומנים ממה שהכניסה');
    });
});

describe('parseBusiness', () => {
    it("drops Yahoo's zero rows and stale years instead of drawing a fake trend", () => {
        const b = parseBusiness({
            financialData: { financialCurrency: 'ILS', profitMargins: { raw: 0.0777 } },
            earnings: { financialsChart: {
                yearly: [{ date: 2017, revenue: { raw: 5.48e9 } }, { date: 2023, revenue: { raw: 10.5e9 }, earnings: { raw: 4.9e8 } }, { date: 2025, revenue: { raw: 12.5e9 }, earnings: { raw: 0 } }, { date: 2024, revenue: { raw: 0 } }],
                quarterly: [{ date: '1Q2025', revenue: { raw: 0 } }, { date: '2Q2025', revenue: { raw: 3.07e9 }, earnings: { raw: 6.4e7 } }],
            } },
        } as never)!;
        expect(b.yearly.map((y) => y.year)).toEqual([2023, 2025]);
        expect(b.quarterly.map((q) => q.quarter)).toEqual(['2Q2025']);
        expect(b.profitMarginPct).toBe(7.8);
    });
});

describe('plain portfolio fit', () => {
    it('names the holding and never says correlation', () => {
        const lines = fitLines({ correlation: 0.05, heldNames: ['הפניקס'], drawdownBefore: -20, drawdownAfter: -16, weightPct: 20 }).map((l) => l.text).join(' ');
        expect(lines).toContain('הפניקס');
        expect(lines).toContain('16% במקום 20%');
        expect(lines).not.toContain('מתאם');
        expect(le('הפניקס')).toBe('לפניקס');
        expect(le('המניות שכבר יש לך')).toBe('למניות שכבר יש לך');
    });
});

describe('one answer per stock', () => {
    it('follows the method, and explains the rest', async () => {
        const { decideCall } = await import('@/lib/decision');
        const base = { kind: 'stock' as const, total: 41, keepTop: 15, held: false };
        expect(decideCall({ ...base, rank: 1, momentumPct: 66.8, isBuy: true }).call).toBe('buy');
        expect(decideCall({ ...base, rank: 9, momentumPct: 43, isBuy: false, held: true }).call).toBe('hold');
        const skipped = decideCall({ ...base, rank: 4, momentumPct: 56, isBuy: false, skipBecause: 'כבר יש לך את הפניקס מאותו ענף' });
        expect(skipped.call).toBe('good');
        expect(skipped.text).toContain('הפניקס');
        expect(decideCall({ ...base, rank: 22, momentumPct: 3, isBuy: false, held: true }).text).toContain('ומוכרת אותה');
        expect(decideCall({ ...base, kind: 'index', rank: null, momentumPct: null, isBuy: false }).call).toBe('base');
    });
    it('turns warnings into notes that say whether they were tested', async () => {
        const { cautionsFrom } = await import('@/lib/decision');
        const c = cautionsFrom(['המחיר בירידה: 18% מתחת למחיר הממוצע של עשרת החודשים האחרונים. עדיף לחכות שהירידה תיעצר', 'יקרה: המחיר שווה 111 שנים של הרווח שלה היום']);
        expect(c[0]).toContain('לא שיפר את השיטה');
        expect(c[0]).not.toContain('עדיף לחכות');
        expect(c[1]).toContain('אי אפשר לבדוק לאחור');
    });
});
