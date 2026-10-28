// Buy ideas, pure and testable. Every candidate is assumed to earn the same average return (the simulation
// takes each one's swings from history but not its past trend), so the ranking cannot be a bet on which stock
// rises. What it can measure honestly is what the candidate does to THIS portfolio: how much it lowers the
// chance of ending under the money put in, the volatility and the worst drop. On top of that, three plain
// checks flag the ones to hold off on: a falling price, a stretched valuation, or a stock that is the same
// bet as what is already held.

import { le } from '@/lib/format';
import { alignReturns, correlation, portfolioStats, seriesStats, simulate, type Series, type SeriesStats, type SimResult } from '@/lib/forecast';

export type Verdict = 'buy' | 'wait' | 'weak' | 'same';

export type IdeaFundamentals = {
    targetMeanPrice: number | null; analysts: number | null; trailingPE: number | null; forwardPE: number | null; dividendYieldPct: number | null;
} | null;

export type Idea = {
    symbol: string;
    verdict: Verdict;
    reasons: string[];                  // Hebrew, one short clause each, most important first
    correlation: number | null;         // with the current portfolio
    probLossBefore: number | null;      // 3 years, % of paths under the money put in
    probLossAfter: number | null;
    volBefore: number | null; volAfter: number | null;
    drawdownBefore: number | null; drawdownAfter: number | null;
    p50After: number | null; p50Before: number | null;
    stats: SeriesStats | null;
    analystUpsidePct: number | null;
    score: number;                      // lower is better; only meaningful within a verdict
    similarTo?: string;                 // set by pickDistinct: a near-duplicate of a better-ranked idea
};

export const SAME_BET_CORRELATION = 0.6;
export const FALLING_VS_MA200 = -10;       // % under the 200-day average
export const EXPENSIVE_PE = 60;
export const FITS_CORRELATION = 0.5;       // under this the candidate is genuinely a different bet
export const RISKY_VOL = 45;               // % a year
export const RISKY_DRAWDOWN = -50;         // % peak to trough in the window

type Context = {
    holdings: Series[];          // current holdings, aligned windows
    values: number[];            // their values, base currency
    weights: number[];           // where monthly money goes
    monthly: number;
    driftAnnual: number;
    weightPct: number;           // the share of the portfolio the candidate is tested at
    heldNames?: string[];        // Hebrew names of what is held, so reasons can say "Phoenix" instead of "the portfolio"
    paths?: number;
};

export type Baseline = { stats: ReturnType<typeof portfolioStats>; sim3y: SimResult | null };

export function baseline(ctx: Context): Baseline {
    if (ctx.holdings.length === 0) return { stats: null, sim3y: null };
    const joint = alignReturns(ctx.holdings);
    return {
        stats: portfolioStats(joint.rows, ctx.values),
        sim3y: simulate({ rows: joint.rows, values: ctx.values, monthly: ctx.monthly, weights: ctx.weights, years: 3, driftAnnual: ctx.driftAnnual, paths: ctx.paths ?? 1000 }),
    };
}

const pe = (f: IdeaFundamentals) => f?.trailingPE ?? f?.forwardPE ?? null;

export function scoreIdea(ctx: Context, base: Baseline, candidate: Series, price: number | null, fundamentals: IdeaFundamentals): Idea {
    const stats = seriesStats(candidate.closes);
    const analystUpsidePct = fundamentals?.targetMeanPrice && price && (fundamentals.analysts ?? 0) > 0
        ? Math.round((fundamentals.targetMeanPrice / price - 1) * 1000) / 10 : null;
    const total = ctx.values.reduce((s, v) => s + v, 0);
    const empty: Idea = {
        symbol: candidate.symbol, verdict: 'weak', reasons: [], correlation: null,
        probLossBefore: base.sim3y?.probBelowContributed ?? null, probLossAfter: null,
        volBefore: base.stats?.annualVolPct ?? null, volAfter: null, drawdownBefore: base.stats?.maxDrawdownPct ?? null, drawdownAfter: null,
        p50Before: base.sim3y?.p50 ?? null, p50After: null, stats, analystUpsidePct, score: Infinity,
    };
    if (!stats || candidate.closes.length < 250) return { ...empty, reasons: ['אין מספיק היסטוריית מחירים'] };

    let corr: number | null = null;
    let after: ReturnType<typeof portfolioStats> = null;
    let sim: SimResult | null = null;
    if (ctx.holdings.length > 0 && total > 0) {
        const joint = alignReturns([...ctx.holdings, candidate]);
        const daily = joint.rows.map((r) => Math.log(r.slice(0, -1).reduce((s, ret, k) => s + (ctx.values[k] / total) * Math.exp(ret), 0)));
        corr = correlation(joint.rows.map((r) => r[r.length - 1]), daily);
        const scale = 1 - ctx.weightPct / 100;
        const valuesAfter = [...ctx.values.map((v) => v * scale), total * (ctx.weightPct / 100)];
        const weightsAfter = [...ctx.weights.map((w) => w * scale), ctx.weightPct / 100];
        after = portfolioStats(joint.rows, valuesAfter);
        sim = simulate({ rows: joint.rows, values: valuesAfter, monthly: ctx.monthly, weights: weightsAfter, years: 3, driftAnnual: ctx.driftAnnual, paths: ctx.paths ?? 1000 });
    } else {
        // Nothing held: the candidate on its own
        const own = alignReturns([candidate]).rows;
        after = portfolioStats(own, [10000]);
        sim = simulate({ rows: own, values: [10000], monthly: ctx.monthly, weights: [1], years: 3, driftAnnual: ctx.driftAnnual, paths: ctx.paths ?? 1000 });
    }

    const probCut = sim && base.sim3y ? sim.probBelowContributed - base.sim3y.probBelowContributed : null;
    const volCut = after && base.stats ? after.annualVolPct - base.stats.annualVolPct : null;
    const reasons: string[] = [];
    const falling = (stats.vsMa200Pct ?? 0) <= FALLING_VS_MA200;
    const valuation = pe(fundamentals);
    const expensive = valuation !== null && valuation > EXPENSIVE_PE;
    const same = corr !== null && corr >= SAME_BET_CORRELATION;

    const held = ctx.heldNames?.length === 1 ? ctx.heldNames[0] : 'המניות שכבר יש לך';
    const risky = stats.annualVolPct > RISKY_VOL || stats.maxDrawdownPct < RISKY_DRAWDOWN;
    const related = corr !== null && corr >= FITS_CORRELATION;

    let verdict: Verdict;
    if (same) {
        verdict = 'same';
        reasons.push(`זזה כמעט כמו ${held}, אז היא לא מאזנת את התיק אלא מגדילה את אותו הימור`);
    } else {
        if (volCut !== null && volCut <= -1) reasons.push(`מקטינה את הקפיצות של התיק: בשנה רגילה התיק יזוז בערך ${after!.annualVolPct.toFixed(0)}% למעלה או למטה, במקום ${base.stats!.annualVolPct.toFixed(0)}%`);
        if (after && base.stats && after.maxDrawdownPct - base.stats.maxDrawdownPct >= 2) reasons.push(`בשלוש השנים האחרונות, הירידה הכי גדולה של התיק הייתה ${Math.abs(after.maxDrawdownPct).toFixed(0)}% במקום ${Math.abs(base.stats.maxDrawdownPct).toFixed(0)}%`);
        if (corr !== null && corr < 0.3) reasons.push(`כמעט לא זזה יחד עם ${held}, ולכן מאזנת את התיק`);
        if (related) reasons.push(`די קשורה ${le(held)}: בימים רעים הן נוטות לרדת יחד`);
        const weak = related || ((probCut === null || probCut > -1) && (volCut === null || volCut > -1));
        if (falling) reasons.push(`המחיר בירידה: ${Math.abs(stats.vsMa200Pct!).toFixed(0)}% מתחת למחיר הממוצע של עשרת החודשים האחרונים. עדיף לחכות שהירידה תיעצר`);
        if (expensive) reasons.push(`יקרה: המחיר שווה ${valuation!.toFixed(0)} שנים של הרווח שלה היום`);
        if (risky) reasons.push(`קופצת מאוד: בשנה רגילה זזה ${stats.annualVolPct.toFixed(0)}% למעלה או למטה, ובשלוש השנים האחרונות ירדה בשלב מסוים ב-${Math.abs(stats.maxDrawdownPct).toFixed(0)}%`);
        verdict = falling || expensive || risky ? 'wait' : weak ? 'weak' : 'buy';
        if (weak && !related) reasons.push('מוסיפה מעט איזון לתיק');
    }
    if (analystUpsidePct !== null && (fundamentals?.analysts ?? 0) >= 3) reasons.push(`${fundamentals!.analysts} אנליסטים צופים בממוצע ${analystUpsidePct >= 0 ? `עלייה של ${analystUpsidePct.toFixed(0)}%` : `ירידה של ${Math.abs(analystUpsidePct).toFixed(0)}%`} בשנה הקרובה`);
    if (fundamentals?.dividendYieldPct && fundamentals.dividendYieldPct >= 3) reasons.push(`מחלקת דיבידנד של ${fundamentals.dividendYieldPct.toFixed(1)}% בשנה`);

    // Rank on the risk of the combined portfolio: its volatility, plus a quarter-weight on its worst drop. Not on
    // the chance of loss: with every stock assumed to earn the same average, a wilder stock lifts the simulated
    // average of the mix and would look "safer" there, which it is not.
    const score = (after?.annualVolPct ?? stats.annualVolPct) + 0.25 * Math.abs(after?.maxDrawdownPct ?? stats.maxDrawdownPct);
    return {
        ...empty, verdict, reasons, correlation: corr,
        probLossAfter: sim?.probBelowContributed ?? null, volAfter: after?.annualVolPct ?? null, drawdownAfter: after?.maxDrawdownPct ?? null,
        p50After: sim?.p50 ?? null, score,
    };
}

const ORDER: Record<Verdict, number> = { buy: 0, wait: 1, weak: 2, same: 3 };

export function rankIdeas<T extends Idea>(ideas: T[]): T[] {
    return [...ideas].sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict] || a.score - b.score);
}

export const DUPLICATE_CORRELATION = 0.75;

// Walk the ranked list and mark any idea that moves almost exactly like a better-ranked one (the S&P 500 and the
// Nasdaq 100, two big banks): recommending both is one recommendation twice. `seriesOf` gives each idea's prices.
export function pickDistinct<T extends Idea>(ranked: T[], seriesOf: (symbol: string) => Series | undefined): T[] {
    const kept: { symbol: string; s: Series }[] = [];
    return ranked.map((idea) => {
        if (idea.verdict !== 'buy') return idea;
        const s = seriesOf(idea.symbol);
        if (!s) return idea;
        for (const k of kept) {
            const joint = alignReturns([k.s, s]).rows;
            const c = correlation(joint.map((r) => r[0]), joint.map((r) => r[1]));
            if (c !== null && c >= DUPLICATE_CORRELATION) return { ...idea, similarTo: k.symbol };
        }
        kept.push({ symbol: idea.symbol, s });
        return idea;
    });
}
