// The momentum plan for one user (not a server action; see portfolio-data.ts): the backtest that justifies it,
// and what it says to do this month with this user's holdings and monthly amount.

import { getUsdIls, getYahooMonthly, getYahooQuote } from '@/lib/actions/yahoo.actions';
import { loadPortfolio } from '@/lib/server/portfolio-data';
import { backtest, forwardByBucket, KEEP_TOP, pickBuys, rankAt, TOP_BUY, toTable, type BacktestPoint, type BacktestStats, type BucketStats, type Monthly, type Ranked } from '@/lib/momentum';
import { groupOf } from '@/lib/momentum';
import { CAPITAL_GAINS_TAX, harvestIdeas, realisedByYear, taxIfSold, type Harvest } from '@/lib/tax';
import { hebrewName, UNIVERSE } from '@/lib/universe';
import type { Currency } from '@/lib/portfolio';

const INDEX = '^TA125.TA';
export const STOCKS = UNIVERSE.filter((u) => u.kind === 'stock').map((u) => u.symbol);

export type Market = { table: ReturnType<typeof toTable>; index: Monthly; at: number; buckets: BucketStats[] };
let market: Market | null = null;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } }));
    return out;
}

// Shared with the arena: the same twenty years of prices feed the method and everything it is compared with.
export async function loadMarket(): Promise<Market> {
    if (market && Date.now() - market.at < 12 * 3600 * 1000) return market;
    const [rows, index] = await Promise.all([mapLimit(STOCKS, 6, (s) => getYahooMonthly(s)), getYahooMonthly(INDEX)]);
    const series = Object.fromEntries(STOCKS.map((s, i) => [s, rows[i]]).filter(([, r]) => (r as Monthly).length > 13));
    const table = toTable(series);
    market = { table, index, at: Date.now(), buckets: forwardByBucket(table) };
    return market;
}

export type PlanBuy = Ranked & { name: string; price: number | null; shares: number; amount: number };
export type PlanHolding = { symbol: string; name: string; rank: number | null; momentumPct: number | null; action: 'keep' | 'sell' | 'outside'; value: number; gain: number; tax: number };

export type StrategyResult = {
    base: Currency;
    asOf: string;                       // the last completed month the ranking uses
    monthlyBudget: number;
    ranking: (Ranked & { name: string; buy: boolean; held: boolean })[];
    buys: PlanBuy[];
    leftover: number;
    holdings: PlanHolding[];
    backtests: BacktestStats[];
    curve: BacktestPoint[];
    realisedThisYear: number;
    harvest: Harvest[];
    taxRatePct: number;
    buckets: BucketStats[];
    heldSectorSkips: { symbol: string; name: string; rank: number; because: string }[];
};

const cache = new Map<string, { at: number; key: string; value: StrategyResult }>();

export async function computeStrategy(userId: string): Promise<StrategyResult> {
    const [{ portfolio, settings, trades }, m, fx] = await Promise.all([loadPortfolio(userId), loadMarket(), getUsdIls()]);
    const key = JSON.stringify([trades.length, settings.monthlyBudget, portfolio.holdings.map((h) => [h.symbol, h.quantity])]);
    const hit = cache.get(userId);
    if (hit && hit.key === key && Date.now() - hit.at < 3600 * 1000) return hit.value;

    const { table, index } = m;
    const last = table.months.length - 1;
    const ranked = rankAt(table, last, STOCKS);
    const heldNow = portfolio.holdings.filter((h) => h.quantity > 0).map((h) => h.symbol);
    const buys = pickBuys(ranked, TOP_BUY, undefined, heldNow);
    const buySet = new Set(buys.map((b) => b.symbol));
    const heldSet = new Set(portfolio.holdings.filter((h) => h.quantity > 0).map((h) => h.symbol));
    const rankOf = new Map(ranked.map((r) => [r.symbol, r]));

    // Size this month's buys: equal amounts, whole shares, at today's prices
    const quotes = await Promise.all(buys.map((b) => getYahooQuote(b.symbol, 3600).catch(() => null)));
    const per = settings.monthlyBudget > 0 ? settings.monthlyBudget / buys.length : 0;
    let spent = 0;
    const planBuys: PlanBuy[] = buys.map((b, i) => {
        const price = quotes[i]?.c ?? null;
        const shares = price && per > 0 ? Math.floor(per / price) : 0;
        spent += shares * (price ?? 0);
        return { ...b, name: hebrewName(b.symbol), price, shares, amount: Math.round(shares * (price ?? 0)) };
    });

    const holdings: PlanHolding[] = portfolio.holdings.filter((h) => h.quantity > 0).map((h) => {
        const r = rankOf.get(h.symbol);
        const inside = STOCKS.includes(h.symbol);
        const action = !inside || !r ? 'outside' : r.rank <= KEEP_TOP ? 'keep' : 'sell';
        return { symbol: h.symbol, name: hebrewName(h.symbol, h.name), rank: r?.rank ?? null, momentumPct: r?.momentumPct ?? null, action, value: Math.round(h.value), gain: Math.round(h.unrealised), tax: Math.round(taxIfSold(h)) };
    });

    const end = table.months[last - 1] ?? table.months[last];
    const periods: [string, string][] = [['2006-01', end], ['2006-01', '2015-12'], ['2016-01', end], [`${Number(end.slice(0, 4)) - 5}-01`, end]];
    const runs = periods.map(([a, b]) => backtest(table, index, a, b));
    const year = new Date().getFullYear();
    const realised = realisedByYear(trades, portfolio.base, fx.rate).find((r) => r.year === year)?.gain ?? 0;

    const value: StrategyResult = {
        base: portfolio.base, asOf: end, monthlyBudget: settings.monthlyBudget,
        ranking: ranked.map((r) => ({ ...r, name: hebrewName(r.symbol), buy: buySet.has(r.symbol), held: heldSet.has(r.symbol) })),
        buys: planBuys, leftover: Math.max(0, Math.round(settings.monthlyBudget - spent)),
        holdings, backtests: runs.filter((r): r is NonNullable<typeof r> => r !== null).map((r) => r.stats),
        curve: runs[0]?.points ?? [], realisedThisYear: realised, harvest: harvestIdeas(portfolio.holdings, realised),
        taxRatePct: CAPITAL_GAINS_TAX * 100,
        buckets: m.buckets,
        heldSectorSkips: ranked.filter((r) => r.rank <= (buys.at(-1)?.rank ?? 0) && !buySet.has(r.symbol)).map((r) => {
            const sameHeld = heldNow.find((h) => groupOf(h) === groupOf(r.symbol));
            const sameBuy = buys.find((b) => groupOf(b.symbol) === groupOf(r.symbol));
            return { symbol: r.symbol, name: hebrewName(r.symbol), rank: r.rank, because: sameHeld ? `כבר יש לך את ${hebrewName(sameHeld)} מאותו ענף` : sameBuy ? `${hebrewName(sameBuy.symbol)} מאותו ענף במקום גבוה יותר` : '' };
        }),
    };
    cache.set(userId, { at: Date.now(), key, value });
    return value;
}

export { TOP_BUY, KEEP_TOP };
