// Everything a person needs to decide on one stock, in plain Hebrew: how much it might make in a year, how the
// business is doing, and what it does for their portfolio. Pure, so every sentence is tested.

import { le } from '@/lib/format';
import { alignReturns, simulate, type Series } from '@/lib/forecast';
import type { YahooBusiness } from '@/lib/actions/yahoo.actions';

export const MARKET_AVERAGE = 0.07;   // a broad index's long-run yearly return, the starting point for every stock
export const ANALYST_PRIOR = 5;       // analysts it takes for their view to count as much as the market average

export type Estimate = {
    analystUpsidePct: number | null;   // consensus target vs price
    dividendPct: number;
    analystTotalPct: number | null;    // upside + dividend
    analysts: number;
    weightPct: number;                 // how much of the estimate comes from the analysts
    systemPct: number;                 // the system's yearly estimate
    rangeLowPct: number | null;        // a bad year (1 in 10)
    rangeHighPct: number | null;       // a good year (1 in 10)
};

// Analyst targets lean optimistic and one analyst is one opinion, so the estimate starts at the market average and
// moves toward the analysts in proportion to how many there are: 1 analyst moves it a sixth of the way, 5 halfway.
export function estimateYear(input: { price: number | null; targetMean: number | null; analysts: number | null; dividendPct: number | null; series: Series | null }): Estimate {
    const n = input.analysts ?? 0;
    const dividendPct = input.dividendPct ?? 0;
    const upside = input.price && input.targetMean && n > 0 ? (input.targetMean / input.price - 1) * 100 : null;
    const analystTotal = upside === null ? null : upside + dividendPct;
    const w = analystTotal === null ? 0 : n / (n + ANALYST_PRIOR);
    const systemPct = Math.round((w * (analystTotal ?? 0) + (1 - w) * MARKET_AVERAGE * 100) * 10) / 10;
    let rangeLowPct: number | null = null, rangeHighPct: number | null = null;
    if (input.series && input.series.closes.length > 250) {
        const rows = alignReturns([input.series]).rows;
        const sim = simulate({ rows, values: [100], monthly: 0, weights: [1], years: 1, paths: 1500, driftAnnual: systemPct / 100 });
        if (sim) { rangeLowPct = Math.round(sim.p10 - 100); rangeHighPct = Math.round(sim.p90 - 100); }
    }
    const r = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
    return { analystUpsidePct: r(upside), dividendPct: r(dividendPct)!, analystTotalPct: r(analystTotal), analysts: n, weightPct: Math.round(w * 100), systemPct, rangeLowPct, rangeHighPct };
}

export type Line = { text: string; tone: 'good' | 'bad' | 'neutral' };

const growth = (a: number, b: number) => (b / a - 1) * 100;
const word = (v: number, up: string, down: string) => (v >= 0 ? up : down);

// How the company is doing, one plain sentence per fact, best evidence first.
export function businessLines(b: YahooBusiness | null): Line[] {
    if (!b) return [{ text: 'אין ב-Yahoo נתונים עסקיים על החברה הזו.', tone: 'neutral' }];
    const out: Line[] = [];
    const y = b.yearly;
    if (y.length >= 2) {
        const last = y[y.length - 1], prev = y[y.length - 2];
        const g = growth(prev.revenue, last.revenue);
        out.push({ text: `ההכנסות ב-${last.year} ${word(g, 'עלו', 'ירדו')} ב-${Math.abs(g).toFixed(0)}% לעומת ${prev.year}.`, tone: g > 3 ? 'good' : g < -3 ? 'bad' : 'neutral' });
        if (last.earnings !== null && prev.earnings !== null && prev.earnings > 0) {
            const e = growth(prev.earnings, last.earnings);
            out.push({ text: `הרווח ${word(e, 'עלה', 'ירד')} ב-${Math.abs(e).toFixed(0)}% באותה שנה.`, tone: e > 5 ? 'good' : e < -5 ? 'bad' : 'neutral' });
        }
        if (y.length >= 3) {
            const first = y[0];
            const cagr = (Math.pow(last.revenue / first.revenue, 1 / (last.year - first.year)) - 1) * 100;
            out.push({ text: `לאורך ${last.year - first.year} שנים ההכנסות ${word(cagr, 'צמחו', 'ירדו')} בממוצע ${Math.abs(cagr).toFixed(0)}% בשנה.`, tone: cagr > 3 ? 'good' : cagr < -2 ? 'bad' : 'neutral' });
        }
    } else if (b.revenueGrowthPct !== null) {
        out.push({ text: `ההכנסות ברבעון האחרון ${word(b.revenueGrowthPct, 'עלו', 'ירדו')} ב-${Math.abs(b.revenueGrowthPct).toFixed(0)}% לעומת שנה קודם.`, tone: b.revenueGrowthPct > 3 ? 'good' : b.revenueGrowthPct < -3 ? 'bad' : 'neutral' });
    }
    if (b.profitMarginPct !== null) {
        const m = b.profitMarginPct;
        const cur = b.currency === 'USD' ? 'דולר' : 'ש"ח';
        out.push({ text: `מכל 100 ${cur} הכנסות נשארים לה ${m.toFixed(0)} ${cur} רווח נקי.`, tone: m >= 12 ? 'good' : m < 3 ? 'bad' : 'neutral' });
    }
    if (b.debtToEquityPct !== null) {
        const d = b.debtToEquityPct;
        out.push(d > 150
            ? { text: `החוב גבוה: פי ${(d / 100).toFixed(1)} מההון העצמי. זה מכביד עליה כשהריבית גבוהה.`, tone: 'bad' }
            : d < 50 ? { text: 'החוב נמוך ביחס להון שלה.', tone: 'good' } : { text: 'החוב בינוני ביחס להון שלה.', tone: 'neutral' });
    }
    if (b.freeCashflow !== null) {
        out.push(b.freeCashflow > 0
            ? { text: 'מייצרת יותר מזומנים ממה שהיא מוציאה.', tone: 'good' }
            : { text: 'בשנה האחרונה הוציאה יותר מזומנים ממה שהכניסה.', tone: 'bad' });
    }
    if (b.nextYearEarningsGrowthPct !== null) {
        const g = b.nextYearEarningsGrowthPct;
        out.push({ text: `האנליסטים צופים שהרווח ${word(g, 'יעלה', 'ירד')} בשנה הבאה ב-${Math.abs(g).toFixed(0)}%.`, tone: g > 5 ? 'good' : g < 0 ? 'bad' : 'neutral' });
    }
    if (y.length < 2 && b.quarterly.length < 2) out.push({ text: 'הנתונים ב-Yahoo חלקיים לחברה הזו, אז כדאי לבדוק גם בדוחות שלה.', tone: 'neutral' });
    return out;
}

// One sentence for the card: revenue and profit, the latest full year.
export function businessHeadline(b: YahooBusiness | null): Line | null {
    const y = b?.yearly ?? [];
    if (y.length >= 2) {
        const last = y[y.length - 1], prev = y[y.length - 2];
        const g = growth(prev.revenue, last.revenue);
        const e = last.earnings !== null && prev.earnings !== null && prev.earnings > 0 ? growth(prev.earnings, last.earnings) : null;
        const text = `ב-${last.year} ההכנסות ${word(g, 'עלו', 'ירדו')} ${Math.abs(g).toFixed(0)}%${e === null ? '' : `, והרווח ${word(e, 'עלה', 'ירד')} ${Math.abs(e).toFixed(0)}%`}`;
        const score = g + (e ?? 0) / 2;
        return { text, tone: score > 5 ? 'good' : score < -5 ? 'bad' : 'neutral' };
    }
    if (b?.revenueGrowthPct != null) return { text: `ההכנסות ברבעון האחרון ${word(b.revenueGrowthPct, 'עלו', 'ירדו')} ${Math.abs(b.revenueGrowthPct).toFixed(0)}% משנה קודם`, tone: b.revenueGrowthPct > 3 ? 'good' : b.revenueGrowthPct < -3 ? 'bad' : 'neutral' };
    return null;
}

// What it does for the portfolio, without the word "correlation".
export function fitLines(input: { correlation: number | null; heldNames: string[]; drawdownBefore: number | null; drawdownAfter: number | null; weightPct: number }): Line[] {
    const held = input.heldNames.length === 1 ? input.heldNames[0] : 'המניות שכבר יש לך';
    const out: Line[] = [];
    const c = input.correlation;
    if (c === null) out.push({ text: 'עוד אין לך מניות, אז אין למה להשוות.', tone: 'neutral' });
    else if (c < 0.3) out.push({ text: `כמעט לא זזה יחד עם ${held}: כש${held === 'המניות שכבר יש לך' ? 'הן יורדות' : `${held} יורדת`}, היא בדרך כלל לא יורדת איתה. זה מה שמאזן תיק.`, tone: 'good' });
    else if (c < 0.5) out.push({ text: `זזה קצת יחד עם ${held}, אבל בעיקר לבד. מוסיפה איזון.`, tone: 'good' });
    else if (c < 0.6) out.push({ text: `די קשורה ${le(held)}: בימים רעים הן נוטות לרדת יחד.`, tone: 'neutral' });
    else out.push({ text: `זזה כמעט כמו ${held}. היא לא מאזנת את התיק, רק מגדילה את אותו הימור.`, tone: 'bad' });
    if (input.drawdownBefore !== null && input.drawdownAfter !== null && c !== null) {
        const b = Math.abs(input.drawdownBefore), a = Math.abs(input.drawdownAfter);
        if (b - a >= 1) out.push({ text: `אם ${input.weightPct}% מהתיק היו בה בשלוש השנים האחרונות, הירידה הכי גדולה של התיק הייתה ${a.toFixed(0)}% במקום ${b.toFixed(0)}%.`, tone: 'good' });
        else if (a - b >= 1) out.push({ text: `אם ${input.weightPct}% מהתיק היו בה בשלוש השנים האחרונות, הירידה הכי גדולה של התיק הייתה ${a.toFixed(0)}% במקום ${b.toFixed(0)}%.`, tone: 'bad' });
    }
    return out;
}
