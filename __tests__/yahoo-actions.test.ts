import { describe, expect, it } from 'vitest';
import { normaliseYahooChart } from '@/lib/actions/yahoo.actions';

// A trimmed real response for TEVA.TA (2026-10-23): Yahoo prices TASE shares in agorot ("ILA").
const teva = {
    chart: {
        result: [{
            meta: {
                currency: 'ILA', symbol: 'TEVA.TA', exchangeName: 'TLV', regularMarketTime: 1792752467,
                regularMarketPrice: 12320, chartPreviousClose: 12410, regularMarketDayHigh: 12490, regularMarketDayLow: 12250,
                longName: 'Teva Pharmaceutical Industries Limited', shortName: 'TEVA PHARMA IND',
            },
            indicators: { quote: [{ open: [12410] }] },
        }],
        error: null,
    },
};

describe('normaliseYahooChart', () => {
    it('converts agorot to shekels and fills the Finnhub quote shape', () => {
        const q = normaliseYahooChart(teva)!;
        expect(q.c).toBe(123.2);
        expect(q.pc).toBe(124.1);
        expect(q.d).toBeCloseTo(-0.9, 4);
        expect(q.dp).toBeCloseTo(-0.73, 2);
        expect(q.h).toBe(124.9);
        expect(q.l).toBe(122.5);
        expect(q.o).toBe(124.1);
        expect(q.t).toBe(1792752467);
        expect(q.currency).toBe('ILS');
        expect(q.exchange).toBe('TASE');
        expect(q.name).toBe('Teva Pharmaceutical Industries Limited');
    });

    it('leaves shekel-denominated indices untouched', () => {
        const q = normaliseYahooChart({ chart: { result: [{ meta: { currency: 'ILS', regularMarketPrice: 4034.99, chartPreviousClose: 4072.11, regularMarketTime: 1 } }] } })!;
        expect(q.c).toBe(4034.99);
        expect(q.currency).toBe('ILS');
    });

    it('returns null for an unknown symbol', () => {
        expect(normaliseYahooChart({ chart: { result: null, error: { code: 'Not Found' } } })).toBeNull();
        expect(normaliseYahooChart({})).toBeNull();
    });
});
