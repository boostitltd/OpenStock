// Is the reason you bought it still true? For each holding with a written reason, Gemini weighs that reason against
// the latest numbers, the latest quarterly results and recent Hebrew headlines, and answers in plain Hebrew.
// This is the sell signal that comes from the business, next to the price-based one from the strategy.

import { getYahooFundamentals } from '@/lib/actions/yahoo.actions';
import { loadPortfolio } from '@/lib/server/portfolio-data';
import { cachedCheck, textKey } from '@/lib/server/aicheck';
import { cleanList, GEMINI_MODEL, geminiJson, getNews, type Headline } from '@/lib/server/insight';
import { businessLines } from '@/lib/decision';
import { aboutHe, hebrewName } from '@/lib/universe';
import { groupOf } from '@/lib/momentum';
import { price as fmtPrice } from '@/lib/format';

export type ThesisStatus = 'intact' | 'weakened' | 'broken' | 'unclear';

export type ThesisCheck = {
    symbol: string;
    name: string;
    thesis: string;
    status: ThesisStatus;
    headline: string;        // one sentence: the verdict and why
    supporting: string[];
    against: string[];
    watch: string;           // what would change the verdict
    rewrite: string | null;  // when the reason is too vague to check, a sharper version to adopt
    parts: { part: string; verdict: 'holds' | 'weaker' | 'broken' | 'unknown'; evidence: string }[];
    headlines: Headline[];
    generatedAt: string;
    model: string;
};

export const STATUS_HE: Record<ThesisStatus, string> = { intact: 'הסיבה מחזיקה', weakened: 'הסיבה נחלשה', broken: 'הסיבה נשברה', unclear: 'אי אפשר לבדוק' };

const INSTRUCTIONS = `אתה בודק עבור משקיע פרטי אם הסיבה שבגללה קנה מניה עדיין נכונה. הוא לא איש מקצוע.
קיבלת את הסיבה שהוא כתב במילים שלו, ונתונים עדכניים: מחיר, תוצאות עסקיות, יעדי אנליסטים וכותרות מהחודשיים האחרונים.
קודם פרק את הסיבה לחלקים. למשל "ביטוח רווחי, ריבית גבוהה, דיבידנד" הם שלושה חלקים: האם הביטוח רווחי, האם הריבית גבוהה, האם יש דיבידנד.
בדוק כל חלק מול העובדות וקבע לו מצב: holds (העובדות תומכות), weaker (יש עובדות נגד), broken (נסתר בבירור), unknown (אין עובדות לבדוק).
ואז החלט על מצב כללי אחד:
- intact: החלקים החשובים מחזיקים, ואין שום דבר שסותר אותם.
- weakened: חלק חשוב נחלש.
- broken: החלק המרכזי נסתר בבירור.
- unclear: רק אם אי אפשר לבדוק אף חלק, כי הסיבה לא אומרת כלום על העסק (למשל "בדיקה" או "נראה לי טוב"). במקרה כזה כתוב ב-rewrite סיבה ברורה שאפשר לבדוק, שמתאימה לחברה.
השתמש רק בעובדות שקיבלת. אל תמציא מספרים, אירועים או תחזיות. כל טענה ב-supporting וב-against נשענת על נתון או כותרת מסוימים.
כתוב בעברית פשוטה, במשפטים קצרים. בלי המילים: מתאם, תנודתיות, מכפיל, EPS, קטליזטור, מומנטום.
אל תכתוב "קנה" או "מכור".`;

const SCHEMA = {
    type: 'OBJECT',
    properties: {
        status: { type: 'STRING', enum: ['intact', 'weakened', 'broken', 'unclear'] },
        headline: { type: 'STRING', description: 'משפט אחד: המצב ולמה' },
        supporting: { type: 'ARRAY', items: { type: 'STRING' }, description: 'עד שלוש עובדות שתומכות בסיבה' },
        against: { type: 'ARRAY', items: { type: 'STRING' }, description: 'עד שלוש עובדות שהולכות נגדה' },
        watch: { type: 'STRING', description: 'משפט אחד: מה ישנה את התשובה, למשל מה לבדוק בדוח הבא' },
        rewrite: { type: 'STRING', description: 'רק במצב unclear: סיבה ברורה שאפשר לבדוק. אחרת מחרוזת ריקה' },
        parts: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: { part: { type: 'STRING' }, verdict: { type: 'STRING', enum: ['holds', 'weaker', 'broken', 'unknown'] }, evidence: { type: 'STRING', description: 'משפט אחד: על איזו עובדה זה נשען' } },
                required: ['part', 'verdict', 'evidence'],
            },
        },
    },
    required: ['status', 'headline', 'supporting', 'against', 'watch', 'rewrite', 'parts'],
};

export async function checkThesis(input: {
    symbol: string; name: string; thesis: string; openedAt: string | null; avgCost: number; price: number | null; currency: 'ILS' | 'USD';
    targetPrice: number | null;
}): Promise<ThesisCheck | null> {
    const name = hebrewName(input.symbol, input.name);
    return cachedCheck<ThesisCheck>('thesis', `${input.symbol}:${textKey(input.thesis)}`, async () => {
        const [f, headlines, rates] = await Promise.all([getYahooFundamentals(input.symbol).catch(() => null), getNews(`"${name}"`), getNews('ריבית בנק ישראל', 4)]);
        const b = f?.business ?? null;
        const facts = {
            company: name, about: aboutHe(input.symbol), reasonTheInvestorWrote: input.thesis,
            boughtOn: input.openedAt, averageBuyPrice: fmtPrice(input.avgCost, input.currency),
            priceNow: input.price ? fmtPrice(input.price, input.currency) : null,
            changeSinceBuyPct: input.price ? Math.round((input.price / input.avgCost - 1) * 1000) / 10 : null,
            investorsTarget: input.targetPrice ? fmtPrice(input.targetPrice, input.currency) : null,
            business: businessLines(b, ['bank', 'ins'].includes(groupOf(input.symbol))).map((l) => l.text),
            dividendYieldPerYearPct: f?.dividendYieldPct ?? null,
            priceIsHowManyYearsOfProfit: f?.trailingPE ? Math.round(f.trailingPE) : null,
            lastQuarters: (b?.quarterly ?? []).map((q) => ({ quarter: q.quarter, revenue: q.revenue, profit: q.earnings, currency: b?.currency })),
            analysts: f?.targetMeanPrice ? { count: f.analysts, averageTarget: fmtPrice(f.targetMeanPrice, input.currency) } : null,
            nextReport: f?.nextEarnings ?? null,
            headlines: headlines.map((h) => ({ title: h.title, source: h.source, date: h.date.slice(0, 10) })),
            israelInterestRateHeadlines: rates.map((h) => ({ title: h.title, date: h.date.slice(0, 10) })),
        };
        const r = await geminiJson<{ status: ThesisStatus; headline: string; supporting: string[]; against: string[]; watch: string; rewrite: string; parts: ThesisCheck['parts'] }>(
            INSTRUCTIONS, [{ text: `העובדות (JSON):\n${JSON.stringify(facts, null, 1)}` }], SCHEMA);
        if (!r || !['intact', 'weakened', 'broken', 'unclear'].includes(r.status) || !r.headline) return null;
        return {
            symbol: input.symbol, name, thesis: input.thesis, status: r.status, headline: r.headline.trim(),
            supporting: cleanList(r.supporting, 3), against: cleanList(r.against, 3), watch: String(r.watch ?? '').trim(),
            rewrite: r.status === 'unclear' && r.rewrite?.trim() ? r.rewrite.trim() : null,
            parts: (r.parts ?? []).filter((p) => p.part && ['holds', 'weaker', 'broken', 'unknown'].includes(p.verdict)).slice(0, 6),
            headlines, generatedAt: new Date().toISOString(), model: GEMINI_MODEL,
        };
    });
}

// Every holding that has a written reason, checked (from today's cache when it exists).
export async function computeThesisChecks(userId: string): Promise<ThesisCheck[]> {
    const { portfolio } = await loadPortfolio(userId);
    const open = portfolio.holdings.filter((h) => h.quantity > 0 && h.thesis.trim());
    const checks = await Promise.all(open.map((h) => checkThesis({
        symbol: h.symbol, name: h.name, thesis: h.thesis, openedAt: h.openedAt, avgCost: h.avgCost, price: h.price, currency: h.currency, targetPrice: h.targetPrice,
    })));
    return checks.filter((c): c is ThesisCheck => c !== null);
}
