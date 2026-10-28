// Buy ideas for one user, by id (not a server action; see portfolio-data.ts).

import { getYahooFundamentals, getYahooHistory, type YahooBusiness } from '@/lib/actions/yahoo.actions';
import { loadPortfolio } from '@/lib/server/portfolio-data';
import { ASSUMED_RETURN, WINDOW } from '@/lib/server/outlook';
import { getInsight, getNews, type Headline, type Insight } from '@/lib/server/insight';
import { baseline, pickDistinct, rankIdeas, scoreIdea, type Idea } from '@/lib/recommend';
import { businessHeadline, businessLines, estimateYear, fitLines, type Estimate, type Line } from '@/lib/decision';
import { aboutHe, hebrewName, UNIVERSE, type UniverseEntry } from '@/lib/universe';
import { groupOf } from '@/lib/momentum';
import { price as fmtPrice } from '@/lib/format';
import type { Series } from '@/lib/forecast';
import type { Currency } from '@/lib/portfolio';

export const IDEA_WEIGHT_PCT = 20;

export type IdeaRow = Idea & {
    entry: UniverseEntry; about: string | null; price: number | null; currency: Currency;
    estimate: Estimate; business: YahooBusiness | null; businessHeadline: Line | null; fit: Line[];
    analystTarget: number | null; nextEarnings: string | null; trailingPE: number | null; dividendPct: number | null;
};

export type IdeasResult = {
    base: Currency;
    weightPct: number;
    totalValue: number;
    monthlyBudget: number;
    held: string[];
    heldNames: string[];
    probLossBefore: number | null;
    volBefore: number | null;
    ideas: IdeaRow[];
    computedAt: string;
};

type Cached = { at: number; key: string; value: IdeasResult; series: Map<string, Series> };
const cache = new Map<string, Cached>();
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

async function compute(userId: string): Promise<Cached> {
    const { portfolio, settings } = await loadPortfolio(userId);
    const open = portfolio.holdings.filter((h) => h.quantity > 0);
    const key = JSON.stringify([open.map((h) => [h.symbol, h.quantity]), settings.monthlyBudget, settings.targets]);
    const hit = cache.get(userId);
    if (hit && hit.key === key && Date.now() - hit.at < TTL) return hit;

    const heldHistories = await Promise.all(open.map((h) => getYahooHistory(h.symbol, '5y')));
    const held = open.map((h, i) => ({ h, s: heldHistories[i] })).filter((x) => x.s && x.s.closes.length > 60);
    const values = held.map((x) => x.h.value);
    const total = values.reduce((s, v) => s + v, 0);
    const targetMap = new Map(settings.targets.map((t) => [t.symbol, t.weightPct]));
    const targetSum = held.reduce((s, x) => s + (targetMap.get(x.h.symbol) ?? 0), 0);
    const weights = held.map((x) => (targetSum > 0 ? (targetMap.get(x.h.symbol) ?? 0) / targetSum : total > 0 ? x.h.value / total : 0));
    const heldNames = open.map((h) => hebrewName(h.symbol, h.name));
    const ctx = {
        holdings: held.map((x) => window(x.s!)), values, weights, monthly: settings.monthlyBudget,
        driftAnnual: ASSUMED_RETURN, weightPct: IDEA_WEIGHT_PCT, paths: 1000, heldNames,
    };
    const base = baseline(ctx);

    const heldSet = new Set(open.map((h) => h.symbol));
    const candidates = UNIVERSE.filter((u) => !heldSet.has(u.symbol));
    const series = new Map<string, Series>();
    const rows = await mapLimit(candidates, 6, async (entry): Promise<IdeaRow | null> => {
        const [history, f] = await Promise.all([getYahooHistory(entry.symbol, '5y'), getYahooFundamentals(entry.symbol).catch(() => null)]);
        if (!history || history.closes.length < 250) return null;
        const price = history.closes[history.closes.length - 1];
        const s = window(history);
        series.set(entry.symbol, s);
        const idea = scoreIdea(ctx, base, s, price, f);
        const estimate = estimateYear({ price, targetMean: f?.targetMeanPrice ?? null, analysts: f?.analysts ?? null, dividendPct: f?.dividendYieldPct ?? null, series: s });
        return {
            ...idea, entry, about: aboutHe(entry.symbol), price, currency: entry.symbol.endsWith('.TA') ? 'ILS' : 'USD',
            estimate, business: f?.business ?? null, businessHeadline: businessHeadline(f?.business ?? null),
            fit: fitLines({ correlation: idea.correlation, heldNames, drawdownBefore: idea.drawdownBefore, drawdownAfter: idea.drawdownAfter, weightPct: IDEA_WEIGHT_PCT }),
            analystTarget: f?.targetMeanPrice ?? null, nextEarnings: f?.nextEarnings ?? null, trailingPE: f?.trailingPE ?? null, dividendPct: f?.dividendYieldPct ?? null,
        };
    });

    const value: IdeasResult = {
        base: portfolio.base, weightPct: IDEA_WEIGHT_PCT, totalValue: portfolio.totalValue, monthlyBudget: settings.monthlyBudget,
        held: [...heldSet], heldNames, probLossBefore: base.sim3y?.probBelowContributed ?? null, volBefore: base.stats?.annualVolPct ?? null,
        ideas: pickDistinct(rankIdeas(rows.filter((r): r is IdeaRow => r !== null)), (s) => series.get(s)),
        computedAt: new Date().toISOString(),
    };
    const fresh = { at: Date.now(), key, value, series };
    cache.set(userId, fresh);
    return fresh;
}

export async function computeIdeas(userId: string): Promise<IdeasResult> {
    return (await compute(userId)).value;
}

export type Decision = {
    idea: IdeaRow;
    result: IdeasResult;
    businessLines: Line[];
    headlines: Headline[];
    insight: Insight | null;
};

const VERDICT_HE: Record<string, string> = { buy: 'מתאימה לתיק עכשיו', wait: 'מתאימה, אבל עדיף לחכות', weak: 'תורמת מעט לתיק', same: 'אותו הימור כמו מה שכבר יש' };

// Everything for one candidate's page: the numbers, the business, the news, and a plain summary.
export async function computeDecision(userId: string, symbol: string): Promise<Decision | null> {
    const { value: result } = await compute(userId);
    const idea = result.ideas.find((i) => i.symbol === symbol.toUpperCase());
    if (!idea) return null;
    const lines = businessLines(idea.business, ['bank', 'ins'].includes(groupOf(idea.symbol)));
    const headlines = idea.entry.kind === 'index'
        ? await getNews(idea.symbol === 'SPY' ? 'S&P 500 וול סטריט' : idea.symbol === 'QQQ' ? 'נאסד"ק מניות טכנולוגיה' : 'שווקים באירופה ויפן מניות')
        : await getNews(`"${idea.entry.he}"`);
    const insight = await getInsight({
        symbol: idea.symbol, name: idea.entry.he, about: idea.about, sector: idea.entry.sector,
        price: idea.price ? fmtPrice(idea.price, idea.currency) : null,
        systemEstimate: `הערכה לשנה: ${idea.estimate.systemPct}% (${idea.estimate.analysts} אנליסטים; ${VERDICT_HE[idea.verdict]})`,
        business: lines.map((l) => l.text), reasonsFromSystem: idea.reasons, headlines,
    });
    return { idea, result, businessLines: lines, headlines, insight };
}
