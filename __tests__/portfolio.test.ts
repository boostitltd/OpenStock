import { describe, expect, it } from 'vitest';
import { buildPortfolio, planBuyDay, symbolCurrency, toBase, type TradeInput } from '@/lib/portfolio';

const buy = (symbol: string, quantity: number, price: number, tradedAt: string, extra: Partial<TradeInput> = {}): TradeInput => ({
    symbol, side: 'BUY', quantity, price, currency: symbolCurrency(symbol), tradedAt, thesis: 'because', ...extra,
});
const sell = (symbol: string, quantity: number, price: number, tradedAt: string, extra: Partial<TradeInput> = {}): TradeInput => ({
    symbol, side: 'SELL', quantity, price, currency: symbolCurrency(symbol), tradedAt, ...extra,
});

describe('currencies', () => {
    it('prices Tel Aviv in shekels and the rest in dollars', () => {
        expect(symbolCurrency('TEVA.TA')).toBe('ILS');
        expect(symbolCurrency('TEVA')).toBe('USD');
        expect(symbolCurrency('BINANCE:BTCUSDT')).toBe('USD');
    });

    it('converts through USD/ILS both ways and leaves same-currency amounts alone', () => {
        expect(toBase(100, 'USD', 'ILS', 3.5)).toBe(350);
        expect(toBase(350, 'ILS', 'USD', 3.5)).toBe(100);
        expect(toBase(42, 'ILS', 'ILS', 3.5)).toBe(42);
    });
});

describe('buildPortfolio', () => {
    it('averages cost with fees and marks to market in the base currency', () => {
        const trades = [buy('LUMI.TA', 100, 70, '2026-01-05', { fees: 20 }), buy('LUMI.TA', 50, 80, '2026-02-05', { fees: 10 })];
        const p = buildPortfolio(trades, { 'LUMI.TA': { price: 74.55, name: 'Bank Leumi' } }, 'ILS', 3.5);
        const h = p.holdings[0];
        expect(h.quantity).toBe(150);
        expect(h.costBasis).toBe(100 * 70 + 20 + 50 * 80 + 10); // 11030
        expect(h.avgCost).toBeCloseTo(11030 / 150, 4);
        expect(h.value).toBe(150 * 74.55);
        expect(h.unrealised).toBeCloseTo(150 * 74.55 - 11030, 2);
        expect(h.name).toBe('Bank Leumi');
        expect(p.totalValue).toBe(h.value);
        expect(h.weightPct).toBe(100);
    });

    it('closes lots FIFO: the oldest shares leave first and the realised gain is theirs', () => {
        const trades = [
            buy('TEVA', 10, 30, '2026-01-10'),
            buy('TEVA', 10, 40, '2026-02-10'),
            sell('TEVA', 15, 50, '2026-03-10', { fees: 15 }),
        ];
        const p = buildPortfolio(trades, { TEVA: { price: 39.41 } }, 'USD', 3.5);
        const h = p.holdings[0];
        // 10 @ 30 and 5 @ 40 sold at 50 less $1 fee per share
        expect(h.realised).toBeCloseTo(10 * (49 - 30) + 5 * (49 - 40), 2);
        expect(h.quantity).toBe(5);
        expect(h.avgCost).toBe(40);
    });

    it('mixes shekels and dollars into one base-currency total with weights', () => {
        const trades = [buy('TEVA.TA', 10, 120, '2026-01-10'), buy('TEVA', 10, 35, '2026-01-10')];
        const p = buildPortfolio(trades, { 'TEVA.TA': { price: 123.2 }, TEVA: { price: 39.41 } }, 'ILS', 3.11);
        const ta = p.holdings.find((h) => h.symbol === 'TEVA.TA')!;
        const ny = p.holdings.find((h) => h.symbol === 'TEVA')!;
        expect(ta.value).toBe(1232);
        expect(ny.value).toBeCloseTo(10 * 39.41 * 3.11, 2);
        expect(p.totalValue).toBeCloseTo(1232 + 394.1 * 3.11, 2);
        expect(ta.weightPct + ny.weightPct).toBeCloseTo(100, 1);
    });

    it('derives the sell target from the last buy and reports when it is reached', () => {
        const priced = buildPortfolio([buy('NICE.TA', 5, 600, '2026-01-10', { targetReturnPct: 25 })], { 'NICE.TA': { price: 760 } }, 'ILS', 3.5);
        expect(priced.holdings[0].targetPrice).toBe(750);
        expect(priced.holdings[0].targetReached).toBe(true);
        expect(priced.holdings[0].targetDistancePct).toBeCloseTo((750 / 760 - 1) * 100, 1);

        const explicit = buildPortfolio([buy('NICE.TA', 5, 600, '2026-01-10', { targetPrice: 900 })], { 'NICE.TA': { price: 760 } }, 'ILS', 3.5);
        expect(explicit.holdings[0].targetPrice).toBe(900);
        expect(explicit.holdings[0].targetReached).toBe(false);
    });

    it('keeps a position with no price at cost, so totals never silently drop it', () => {
        const p = buildPortfolio([buy('ESLT.TA', 2, 1000, '2026-01-10')], {}, 'ILS', 3.5);
        expect(p.holdings[0].price).toBeNull();
        expect(p.holdings[0].value).toBe(2000);
        expect(p.holdings[0].unrealised).toBe(0);
        expect(p.holdings[0].unrealisedPct).toBeNull();
    });
});

describe('planBuyDay', () => {
    const quotes = { 'LUMI.TA': { price: 70 }, 'TEVA.TA': { price: 120 }, 'NICE.TA': { price: 750 } };
    const portfolio = () => buildPortfolio(
        [buy('LUMI.TA', 100, 70, '2026-01-05'), buy('TEVA.TA', 10, 120, '2026-01-05')],
        quotes, 'ILS', 3.5,
    ); // LUMI 7000 (85%), TEVA 1200 (15%); NICE not held

    it('spends the month on whatever is furthest under target, in whole shares', () => {
        const plan = planBuyDay(portfolio(), [{ symbol: 'LUMI.TA', weightPct: 50 }, { symbol: 'TEVA.TA', weightPct: 50 }], 2000);
        // total after = 10200; TEVA target 5100, has 1200 → gap 3900 > budget → all 2000 to TEVA → 16 shares = 1920
        const teva = plan.rows.find((r) => r.symbol === 'TEVA.TA')!;
        expect(teva.action).toBe('BUY');
        expect(teva.shares).toBe(16);
        expect(teva.amountBase).toBe(1920);
        expect(plan.leftover).toBe(80);
        const lumi = plan.rows.find((r) => r.symbol === 'LUMI.TA')!;
        expect(lumi.action).toBe('SELL'); // 7000 vs target 5100: 18.6 points over, past the 2% tolerance
        expect(lumi.shares).toBe(Math.ceil(1900 / 70));
    });

    it('splits the budget across several gaps in proportion when it cannot close them all', () => {
        const plan = planBuyDay(portfolio(), [{ symbol: 'LUMI.TA', weightPct: 40 }, { symbol: 'TEVA.TA', weightPct: 30 }, { symbol: 'NICE.TA', weightPct: 30 }], 3000, 2, quotes);
        // total after 11200: TEVA target 3360 (gap 2160), NICE target 3360 (gap 3360); sum 5520 > 3000
        const teva = plan.rows.find((r) => r.symbol === 'TEVA.TA')!;
        const nice = plan.rows.find((r) => r.symbol === 'NICE.TA')!;
        expect(teva.shares).toBe(Math.floor((2160 * 3000 / 5520) / 120));
        expect(nice.shares).toBe(Math.floor((3360 * 3000 / 5520) / 750));
        expect(teva.amountBase + nice.amountBase).toBeLessThanOrEqual(3000);
        expect(plan.leftover).toBe(3000 - teva.amountBase - nice.amountBase);
    });

    it('leaves small overweights alone and flags holdings with no target', () => {
        const plan = planBuyDay(portfolio(), [{ symbol: 'LUMI.TA', weightPct: 84 }], 0, 2);
        const lumi = plan.rows.find((r) => r.symbol === 'LUMI.TA')!;
        expect(lumi.action).toBe('HOLD');
        expect(lumi.reason).toContain('tolerance');
        const teva = plan.rows.find((r) => r.symbol === 'TEVA.TA')!;
        expect(teva.action).toBe('SELL');
        expect(teva.shares).toBe(10);
        expect(teva.reason).toContain('Not in your targets');
    });

    it('explains a gap too small for one share instead of pretending to buy', () => {
        const plan = planBuyDay(portfolio(), [{ symbol: 'LUMI.TA', weightPct: 85 }, { symbol: 'TEVA.TA', weightPct: 10 }, { symbol: 'NICE.TA', weightPct: 5 }], 300, 2, quotes);
        const nice = plan.rows.find((r) => r.symbol === 'NICE.TA')!;
        expect(nice.action).toBe('HOLD');
        expect(nice.reason).toContain('less than one share');
    });
});
