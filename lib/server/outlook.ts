// The outlook for one user, by id. Not a server action (see portfolio-data.ts); getOutlook in
// lib/actions/outlook.actions.ts binds it to the signed-in user, the weekly brief to each user in turn.

import { loadPortfolio } from '@/lib/server/portfolio-data';
import { getLiveQuotes } from '@/lib/actions/finnhub.actions';
import { getYahooFundamentals, getYahooHistory, type YahooFundamentals } from '@/lib/actions/yahoo.actions';
import { alignReturns, correlation, portfolioStats, seriesStats, simulate, type Series, type SeriesStats, type SimResult } from '@/lib/forecast';
import { symbolCurrency, toBase, type Currency, type Holding } from '@/lib/portfolio';

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.&:-]{0,24}$/;
const HORIZONS = [1, 3, 5];
// The trend every simulation assumes: roughly the long-run nominal return of a broad stock index. A single
// stock's own past trend is shown as history, never projected; only its swings and correlations are reused.
export const ASSUMED_RETURN = 0.07;
// Three years of trading days: the window for every past-return, volatility and drawdown figure on the page.
export const WINDOW = 756;

export type HoldingOutlook = {
    symbol: string; name: string; currency: Currency; price: number | null; weightPct: number; value: number;
    stats: SeriesStats | null;
    fundamentals: YahooFundamentals | null;
    analystUpsidePct: number | null;          // consensus target vs price
    targetPrice: number | null; targetDistancePct: number | null; targetReached: boolean; thesis: string;
    sim1y: SimResult | null;                  // this holding alone, no contributions, in base currency
    correlationWithRest: number | null;       // vs the rest of the portfolio
    historyDays: number;
};

export type PortfolioOutlook = {
    assumedReturnPct: number;
    base: Currency; usdIls: number; monthlyBudget: number;
    totalValue: number;
    stats: { annualReturnPct: number; annualVolPct: number; maxDrawdownPct: number } | null;
    sims: SimResult[];                         // 1y, 3y, 5y with monthly contributions at target weights
    historyFrom: string | null; historyDays: number;
    holdings: HoldingOutlook[];
    whatIf: WhatIf | null;
};

export type WhatIf = {
    symbol: string; name: string; weightPct: number; price: number | null; currency: Currency;
    stats: SeriesStats | null; correlationWithPortfolio: number | null;
    before: { annualReturnPct: number; annualVolPct: number; maxDrawdownPct: number } | null;
    after: { annualReturnPct: number; annualVolPct: number; maxDrawdownPct: number } | null;
    sim3yBefore: SimResult | null; sim3yAfter: SimResult | null;
    fundamentals: YahooFundamentals | null;
    error?: string;
};

const toSeries = (h: { symbol: string; dates: string[]; closes: number[] } | null, symbol: string): Series | null => (h ? { symbol, dates: h.dates, closes: h.closes } : null);

// Everything on the outlook page, from history that is resampled, never extrapolated.
export async function computeOutlook(userId: string, whatIfSymbol?: string, whatIfPct?: number): Promise<PortfolioOutlook> {
    const { portfolio, settings } = await loadPortfolio(userId);
    const base = portfolio.base, usdIls = portfolio.usdIls;
    const open: Holding[] = portfolio.holdings.filter((h) => h.quantity > 0);
    const symbols = open.map((h) => h.symbol);

    const [histories, fundamentals] = await Promise.all([
        Promise.all(symbols.map((s) => getYahooHistory(s, '5y'))),
        Promise.all(symbols.map((s) => getYahooFundamentals(s).catch(() => null))),
    ]);
    const series = histories.map((h, i) => toSeries(h, symbols[i]));
    const withHistory = open.map((h, i) => ({ h, s: series[i], f: fundamentals[i] })).filter((x) => x.s !== null) as { h: Holding; s: Series; f: YahooFundamentals | null }[];

    // Joint history (3 years keeps enough days even for a young listing), values in base currency
    const joint = alignReturns(withHistory.map((x) => ({ ...x.s, dates: x.s.dates.slice(-WINDOW), closes: x.s.closes.slice(-WINDOW) })));
    const values = withHistory.map((x) => x.h.value);
    const total = values.reduce((s, v) => s + v, 0);
    const targetMap = new Map(settings.targets.map((t) => [t.symbol, t.weightPct]));
    const targetSum = withHistory.reduce((s, x) => s + (targetMap.get(x.h.symbol) ?? 0), 0);
    // Contributions follow the target weights of held symbols; without targets, today's weights
    const weights = withHistory.map((x) => (targetSum > 0 ? (targetMap.get(x.h.symbol) ?? 0) / targetSum : total > 0 ? x.h.value / total : 0));
    const stats = portfolioStats(joint.rows, values);
    const sims = HORIZONS.map((years) => simulate({ rows: joint.rows, values, monthly: settings.monthlyBudget, weights, years , driftAnnual: ASSUMED_RETURN })).filter((s): s is SimResult => s !== null);

    const holdings: HoldingOutlook[] = withHistory.map((x, i) => {
        const st = seriesStats(x.s.closes.slice(-WINDOW));
        const own = alignReturns([x.s]).rows;
        const sim1y = simulate({ rows: own, values: [x.h.value], monthly: 0, weights: [1], years: 1, paths: 1500 , driftAnnual: ASSUMED_RETURN });
        // Correlation with the rest of the portfolio (value-weighted), from the joint history
        let corr: number | null = null;
        if (withHistory.length > 1 && joint.rows.length) {
            const restW = values.map((v, k) => (k === i ? 0 : v)); const restTotal = restW.reduce((s, v) => s + v, 0);
            const rest = joint.rows.map((r) => Math.log(r.reduce((s, ret, k) => s + (restW[k] / restTotal) * Math.exp(ret), 0)));
            corr = correlation(joint.rows.map((r) => r[i]), rest);
        }
        const price = x.h.price;
        const f = x.f;
        return {
            symbol: x.h.symbol, name: x.h.name, currency: x.h.currency, price, weightPct: x.h.weightPct, value: x.h.value,
            stats: st, fundamentals: f,
            analystUpsidePct: f?.targetMeanPrice && price ? Math.round((f.targetMeanPrice / price - 1) * 1000) / 10 : null,
            targetPrice: x.h.targetPrice, targetDistancePct: x.h.targetDistancePct, targetReached: x.h.targetReached, thesis: x.h.thesis,
            sim1y, correlationWithRest: corr, historyDays: x.s.closes.length,
        };
    });

    let whatIf: WhatIf | null = null;
    if (whatIfSymbol) whatIf = await buildWhatIf(whatIfSymbol, whatIfPct ?? 10, withHistory.map((x) => x.s), values, weights, settings.monthlyBudget, base, usdIls, stats);

    return {
        assumedReturnPct: Math.round(ASSUMED_RETURN * 1000) / 10,
        base, usdIls, monthlyBudget: settings.monthlyBudget, totalValue: portfolio.totalValue, stats, sims,
        historyFrom: joint.dates[0] ?? null, historyDays: joint.rows.length, holdings, whatIf,
    };
}

// What would the portfolio look like with `pct` of it in `symbol`? Same joint history, same simulation,
// with the candidate added at that weight (the rest scaled down), so before and after are comparable.
async function buildWhatIf(
    rawSymbol: string, pct: number, series: Series[], values: number[], weights: number[], monthly: number,
    base: Currency, usdIls: number, before: PortfolioOutlook['stats'],
): Promise<WhatIf> {
    const symbol = rawSymbol.trim().toUpperCase();
    const currency = symbolCurrency(symbol);
    const empty: WhatIf = { symbol, name: symbol, weightPct: pct, price: null, currency, stats: null, correlationWithPortfolio: null, before, after: null, sim3yBefore: null, sim3yAfter: null, fundamentals: null };
    if (!SYMBOL_PATTERN.test(symbol)) return { ...empty, error: 'Invalid symbol' };
    if (!(pct > 0 && pct < 100)) return { ...empty, error: 'Weight must be between 0 and 100' };
    const [history, quotes, fundamentals] = await Promise.all([getYahooHistory(symbol, '5y'), getLiveQuotes([symbol]), getYahooFundamentals(symbol).catch(() => null)]);
    if (!history || history.closes.length < 60) return { ...empty, error: 'Not enough price history for this symbol' };
    const price = quotes[symbol]?.c ?? history.closes[history.closes.length - 1];
    const candidate: Series = { symbol, dates: history.dates.slice(-WINDOW), closes: history.closes.slice(-WINDOW) };
    const name = symbol;
    const stats = seriesStats(history.closes.slice(-WINDOW));

    const total = values.reduce((s, v) => s + v, 0);
    if (total <= 0) {
        // Nothing held yet: the candidate alone
        const own = alignReturns([candidate]).rows;
        const startValue = toBase(price * 1, currency, base, usdIls) * 100;
        return { ...empty, name, price, stats, correlationWithPortfolio: null, before: null, after: portfolioStats(own, [startValue]), sim3yBefore: null, sim3yAfter: simulate({ rows: own, values: [startValue], monthly, weights: [1], years: 3 , driftAnnual: ASSUMED_RETURN }), fundamentals };
    }

    const jointBefore = alignReturns(series.map((s) => ({ ...s, dates: s.dates.slice(-WINDOW), closes: s.closes.slice(-WINDOW) })));
    const jointAfter = alignReturns([...series.map((s) => ({ ...s, dates: s.dates.slice(-WINDOW), closes: s.closes.slice(-WINDOW) })), candidate]);
    const scale = 1 - pct / 100;
    const valuesAfter = [...values.map((v) => v * scale), total * (pct / 100)];
    const weightsAfter = [...weights.map((w) => w * scale), pct / 100];
    const portfolioDaily = jointAfter.rows.map((r) => Math.log(r.slice(0, -1).reduce((s, ret, k) => s + (values[k] / total) * Math.exp(ret), 0)));
    return {
        symbol, name, weightPct: pct, price, currency, stats,
        correlationWithPortfolio: correlation(jointAfter.rows.map((r) => r[r.length - 1]), portfolioDaily),
        before, after: portfolioStats(jointAfter.rows, valuesAfter),
        sim3yBefore: simulate({ rows: jointBefore.rows, values, monthly, weights, years: 3 , driftAnnual: ASSUMED_RETURN }),
        sim3yAfter: simulate({ rows: jointAfter.rows, values: valuesAfter, monthly, weights: weightsAfter, years: 3 , driftAnnual: ASSUMED_RETURN }),
        fundamentals,
    };
}
