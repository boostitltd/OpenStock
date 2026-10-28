// Buy ideas for one user, by id (not a server action; see portfolio-data.ts).

import { getYahooFundamentals, getYahooHistory } from '@/lib/actions/yahoo.actions';
import { loadPortfolio } from '@/lib/server/portfolio-data';
import { ASSUMED_RETURN, WINDOW } from '@/lib/server/outlook';
import { baseline, pickDistinct, rankIdeas, scoreIdea, type Idea } from '@/lib/recommend';
import { UNIVERSE, type UniverseEntry } from '@/lib/universe';
import type { Series } from '@/lib/forecast';
import type { Currency } from '@/lib/portfolio';

export const IDEA_WEIGHT_PCT = 20;

export type IdeaRow = Idea & { entry: UniverseEntry; price: number | null; currency: Currency };

export type IdeasResult = {
    base: Currency;
    weightPct: number;
    totalValue: number;
    monthlyBudget: number;
    held: string[];
    probLossBefore: number | null;
    volBefore: number | null;
    ideas: IdeaRow[];
    computedAt: string;
};

const cache = new Map<string, { at: number; key: string; value: IdeasResult }>();
const TTL = 60 * 60 * 1000;

// A few requests at a time: Yahoo throttles bursts, and the history is cached for six hours anyway.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
    }));
    return out;
}

const window = (s: { symbol: string; dates: string[]; closes: number[] }): Series => ({ symbol: s.symbol, dates: s.dates.slice(-WINDOW), closes: s.closes.slice(-WINDOW) });

export async function computeIdeas(userId: string): Promise<IdeasResult> {
    const { portfolio, settings } = await loadPortfolio(userId);
    const open = portfolio.holdings.filter((h) => h.quantity > 0);
    const key = JSON.stringify([open.map((h) => [h.symbol, h.quantity]), settings.monthlyBudget, settings.targets]);
    const hit = cache.get(userId);
    if (hit && hit.key === key && Date.now() - hit.at < TTL) return hit.value;

    const heldHistories = await Promise.all(open.map((h) => getYahooHistory(h.symbol, '5y')));
    const held = open.map((h, i) => ({ h, s: heldHistories[i] })).filter((x) => x.s && x.s.closes.length > 60);
    const values = held.map((x) => x.h.value);
    const total = values.reduce((s, v) => s + v, 0);
    const targetMap = new Map(settings.targets.map((t) => [t.symbol, t.weightPct]));
    const targetSum = held.reduce((s, x) => s + (targetMap.get(x.h.symbol) ?? 0), 0);
    const weights = held.map((x) => (targetSum > 0 ? (targetMap.get(x.h.symbol) ?? 0) / targetSum : total > 0 ? x.h.value / total : 0));
    const ctx = {
        holdings: held.map((x) => window(x.s!)), values, weights, monthly: settings.monthlyBudget,
        driftAnnual: ASSUMED_RETURN, weightPct: IDEA_WEIGHT_PCT, paths: 1000,
    };
    const base = baseline(ctx);

    const heldSet = new Set(open.map((h) => h.symbol));
    const candidates = UNIVERSE.filter((u) => !heldSet.has(u.symbol));
    const seriesBySymbol = new Map<string, Series>();
    const rows = await mapLimit(candidates, 6, async (entry): Promise<IdeaRow | null> => {
        const [history, fundamentals] = await Promise.all([getYahooHistory(entry.symbol, '5y'), getYahooFundamentals(entry.symbol).catch(() => null)]);
        if (!history || history.closes.length < 250) return null;
        const price = history.closes[history.closes.length - 1];
        const series = window(history);
        seriesBySymbol.set(entry.symbol, series);
        const idea = scoreIdea(ctx, base, series, price, fundamentals);
        return { ...idea, entry, price, currency: entry.symbol.endsWith('.TA') ? 'ILS' : 'USD' };
    });

    const value: IdeasResult = {
        base: portfolio.base, weightPct: IDEA_WEIGHT_PCT, totalValue: portfolio.totalValue, monthlyBudget: settings.monthlyBudget,
        held: [...heldSet], probLossBefore: base.sim3y?.probBelowContributed ?? null, volBefore: base.stats?.annualVolPct ?? null,
        ideas: pickDistinct(rankIdeas(rows.filter((r): r is IdeaRow => r !== null)), (s) => seriesBySymbol.get(s)),
        computedAt: new Date().toISOString(),
    };
    cache.set(userId, { at: Date.now(), key, value });
    return value;
}
