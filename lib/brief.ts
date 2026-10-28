// The weekly brief, composed from plain data: what changed in the forecast since the last brief, what happened
// to each holding, what this month's money should buy, and the best new ideas. Pure, so it is tested without a
// database or a mail server. Hebrew, right to left, inline styles only (mail clients drop <style>).

import { escapeHtml } from '@/lib/utils';
import { dateHe, money, pct, price, yearsHe } from '@/lib/format';
import { hebrewName } from '@/lib/universe';
import type { Currency } from '@/lib/portfolio';

export type BriefSim = { years: number; contributed: number; p10: number; p50: number; p90: number; probBelowContributed: number };

export type BriefHolding = {
    symbol: string; name: string; currency: Currency; quantity: number; price: number | null; value: number; weightPct: number;
    vsMa200Pct: number | null; fromHigh52wPct: number | null; analystTarget: number | null; analysts: number | null;
    targetPrice: number | null; targetDistancePct: number | null; targetReached: boolean; nextEarnings: string | null;
};

export type BriefIdea = { symbol: string; he: string; kind: 'index' | 'stock'; verdict: string; reasons: string[]; similarTo?: string; volBefore: number | null; volAfter: number | null; about?: string | null; systemPct?: number; rangeLowPct?: number | null; rangeHighPct?: number | null; business?: string | null };

export type BriefBuy = { symbol: string; shares: number; amountBase: number; currency: Currency; price: number | null };

export type BriefNow = {
    at: Date; base: Currency; totalValue: number; monthlyBudget: number; assumedReturnPct: number;
    sims: BriefSim[]; holdings: BriefHolding[]; ideas: BriefIdea[];
    plan: { hasTargets: boolean; buys: BriefBuy[]; sells: BriefBuy[]; leftover: number } | null;
    strategy?: {
        buys: { name: string; rank: number; momentumPct: number; shares: number; amount: number }[];
        sells: { name: string; rank: number | null; gain: number; tax: number }[];
        keeps: { name: string; rank: number | null }[];
        backtest: { strategyPct: number; equalPct: number; indexPct: number } | null;
    } | null;
    thesis?: { name: string; status: 'intact' | 'weakened' | 'broken' | 'unclear'; headline: string }[];
    radar?: { political: { explanation: string; affects: string[]; direction: 'up' | 'down' | 'unclear'; source: 'trump' | 'whitehouse' }[]; insiders: { name: string; text: string }[]; congress: { ticker: string; members: number }[] } | null;
    goal?: { amount: number; date: string; chancePct: number; requiredMonthly: number | null } | null;
    harvest?: { name: string; saving: number }[];
};

export type BriefPrev = {
    createdAt: Date; totalValue: number; monthlyBudget: number; sims: BriefSim[];
    holdings: { symbol: string; quantity: number; price: number | null; vsMa200Pct: number | null; analystTarget: number | null; targetReached: boolean }[];
    ideas: { symbol: string; verdict: string }[];
} | null;

export type BriefEvent = { symbol: string; kind: 'target' | 'below-ma' | 'above-ma' | 'off-high' | 'earnings' | 'analyst' | 'strategy-sell' | 'thesis'; text: string; urgent: boolean };

const EARNINGS_DAYS = 14;

// Everything worth saying about the holdings, most urgent first.
export function holdingEvents(now: BriefNow, prev: BriefPrev): BriefEvent[] {
    const out: BriefEvent[] = [];
    const before = new Map((prev?.holdings ?? []).map((h) => [h.symbol, h]));
    for (const h of now.holdings) {
        const p = before.get(h.symbol);
        const name = hebrewName(h.symbol, h.name);
        if (h.targetReached && h.targetPrice) {
            out.push({ symbol: h.symbol, kind: 'target', urgent: true, text: `${name} ${p?.targetReached ? 'עדיין מעל' : 'הגיעה ל'}יעד שקבעת (${price(h.targetPrice, h.currency)}). המניה עשתה את שלה: למכור, או לקבוע יעד חדש ולכתוב למה.` });
        }
        if (h.vsMa200Pct !== null) {
            if (h.vsMa200Pct < 0 && (p?.vsMa200Pct ?? 0) >= 0 && p) {
                out.push({ symbol: h.symbol, kind: 'below-ma', urgent: true, text: `${name} ירדה ${Math.abs(h.vsMa200Pct).toFixed(0)}% מתחת לממוצע 200 הימים. זה סימן מוקדם שהמגמה נשברת: לא למכור על זה לבד, אבל לא להוסיף לה כסף עד שתחזור מעליו.` });
            } else if (h.vsMa200Pct < 0) {
                out.push({ symbol: h.symbol, kind: 'below-ma', urgent: false, text: `${name} עדיין ${Math.abs(h.vsMa200Pct).toFixed(0)}% מתחת לממוצע 200 הימים.` });
            } else if (p && (p.vsMa200Pct ?? 0) < 0) {
                out.push({ symbol: h.symbol, kind: 'above-ma', urgent: false, text: `${name} חזרה מעל ממוצע 200 הימים.` });
            }
        }
        if (h.fromHigh52wPct !== null && h.fromHigh52wPct <= -15) {
            out.push({ symbol: h.symbol, kind: 'off-high', urgent: h.fromHigh52wPct <= -25, text: `${name} נמצאת ${Math.abs(h.fromHigh52wPct).toFixed(0)}% מתחת לשיא של השנה האחרונה.` });
        }
        if (h.nextEarnings) {
            const days = Math.round((new Date(h.nextEarnings).getTime() - now.at.getTime()) / 86400000);
            if (days >= 0 && days <= EARNINGS_DAYS) out.push({ symbol: h.symbol, kind: 'earnings', urgent: false, text: `${name} מפרסמת דוח רבעוני ב-${dateHe(h.nextEarnings)}. סביב דוח המחיר זז יותר מהרגיל.` });
        }
        if (p?.analystTarget && h.analystTarget && Math.abs(h.analystTarget / p.analystTarget - 1) >= 0.05) {
            const up = h.analystTarget > p.analystTarget;
            out.push({ symbol: h.symbol, kind: 'analyst', urgent: false, text: `האנליסטים ${up ? 'העלו' : 'הורידו'} את יעד המחיר של ${name}: מ-${price(p.analystTarget, h.currency)} ל-${price(h.analystTarget, h.currency)}${h.analysts && h.analysts < 3 ? ` (רק ${h.analysts === 1 ? 'אנליסט אחד' : `${h.analysts} אנליסטים`})` : ''}.` });
        }
    }
    for (const s of now.strategy?.sells ?? []) {
        out.push({ symbol: s.name, kind: 'strategy-sell', urgent: true, text: `לפי השיטה הגיע הזמן למכור את ${s.name}: היא ירדה למקום ${s.rank ?? '?'}, מחוץ ל-15 המובילות.${s.tax > 0 ? ` המס על המכירה בערך ${money(s.tax, now.base)}.` : ''}` });
    }
    for (const t of now.thesis ?? []) {
        if (t.status === 'broken') out.push({ symbol: t.name, kind: 'thesis', urgent: true, text: `הסיבה שבגללה קנית את ${t.name} נשברה: ${t.headline}` });
    }
    return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

// Why the forecast moved since the last brief, in one sentence.
export function forecastDrivers(now: BriefNow, prev: BriefPrev): string[] {
    if (!prev) return [];
    const out: string[] = [];
    const before = new Map(prev.holdings.map((h) => [h.symbol, h]));
    const added = now.holdings.filter((h) => !before.has(h.symbol)).map((h) => hebrewName(h.symbol, h.name));
    const removed = prev.holdings.filter((h) => !now.holdings.some((n) => n.symbol === h.symbol)).map((h) => hebrewName(h.symbol));
    const changedQty = now.holdings.filter((h) => before.has(h.symbol) && Math.abs(before.get(h.symbol)!.quantity - h.quantity) > 1e-9).map((h) => hebrewName(h.symbol, h.name));
    if (added.length) out.push(`נוספו לתיק: ${added.join(', ')}`);
    if (removed.length) out.push(`יצאו מהתיק: ${removed.join(', ')}`);
    if (changedQty.length) out.push(`קנית או מכרת: ${changedQty.join(', ')}`);
    if (now.monthlyBudget !== prev.monthlyBudget) out.push(`הסכום החודשי השתנה מ-${money(prev.monthlyBudget, now.base)} ל-${money(now.monthlyBudget, now.base)}`);
    const valueMove = prev.totalValue > 0 ? (now.totalValue / prev.totalValue - 1) * 100 : null;
    if (valueMove !== null && !added.length && !removed.length && !changedQty.length) out.push(`המחירים זזו: שווי התיק ${valueMove >= 0 ? 'עלה' : 'ירד'} ${Math.abs(valueMove).toFixed(1)}% מאז הסיכום הקודם`);
    return out;
}

const C = { text: '#14181f', sub: '#5b6472', faint: '#8a93a1', line: '#e6e9ee', up: '#0f8a5f', down: '#c0392b', brand: '#0d7d74', soft: '#f5f7f9' };
const FF = 'font-family:Assistant,Arial,Helvetica,sans-serif;';
const e = escapeHtml;

const h2 = (t: string) => `<h2 style="${FF}margin:28px 0 10px;font-size:18px;color:${C.text};">${e(t)}</h2>`;
const p = (t: string, color = C.sub, size = 15) => `<p style="${FF}margin:0 0 10px;font-size:${size}px;line-height:1.6;color:${color};">${t}</p>`;
const ltr = (t: string) => `<span dir="ltr" style="unicode-bidi:isolate;">${e(t)}</span>`;
const cell = (t: string, opts: { head?: boolean; color?: string; bold?: boolean; align?: string } = {}) =>
    `<${opts.head ? 'th' : 'td'} style="${FF}padding:8px 10px;border-bottom:1px solid ${C.line};text-align:${opts.align ?? 'right'};font-size:${opts.head ? 12 : 14}px;color:${opts.color ?? (opts.head ? C.faint : C.text)};font-weight:${opts.bold || opts.head ? 600 : 400};white-space:nowrap;">${t}</${opts.head ? 'th' : 'td'}>`;
const table = (head: string[], rows: string[][]) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:6px 0 4px;"><tr>${head.map((h) => cell(e(h), { head: true })).join('')}</tr>${rows.map((r) => `<tr>${r.join('')}</tr>`).join('')}</table>`;

export function composeBrief(now: BriefNow, prev: BriefPrev, appUrl: string): { subject: string; html: string; text: string; events: BriefEvent[] } {
    const base = now.base;
    const events = holdingEvents(now, prev);
    const urgent = events.filter((x) => x.urgent);
    const drivers = forecastDrivers(now, prev);
    const prevSims = new Map((prev?.sims ?? []).map((s) => [s.years, s]));
    const valueMove = prev && prev.totalValue > 0 ? (now.totalValue / prev.totalValue - 1) * 100 : null;
    const topIndex = now.ideas.find((i) => i.kind === 'index' && i.verdict === 'buy' && !i.similarTo);
    const topStocks = now.ideas.filter((i) => i.kind === 'stock' && i.verdict === 'buy' && !i.similarTo).slice(0, 3);
    const prevTop = new Set((prev?.ideas ?? []).filter((i) => i.verdict === 'buy').map((i) => i.symbol));

    const subjectBits = [
        urgent.length ? (urgent.length === 1 ? 'דבר אחד לטפל בו' : `${urgent.length} דברים לטפל בהם`) : 'אין מה לטפל השבוע',
        `התיק ${money(now.totalValue, base)}${valueMove !== null ? ` (${pct(valueMove)})` : ''}`,
    ];
    const subject = `הסיכום השבועי של התיק: ${subjectBits.join(', ')}`;

    const parts: string[] = [];
    parts.push(`<h1 style="${FF}margin:0 0 6px;font-size:22px;color:${C.text};">הסיכום השבועי של התיק</h1>`);
    parts.push(p(`${dateHe(now.at)}${prev ? ` · השוואה לסיכום מ-${dateHe(prev.createdAt)}` : ' · הסיכום הראשון, אז אין עוד למה להשוות'}`, C.faint, 13));

    // 1. Bottom line
    parts.push(h2('השורה התחתונה'));
    const line = [`התיק שווה <b style="color:${C.text};">${e(money(now.totalValue, base))}</b>`];
    if (valueMove !== null) line.push(`<span style="color:${valueMove >= 0 ? C.up : C.down};">${ltr(pct(valueMove))}</span> מאז הסיכום הקודם`);
    parts.push(p(line.join(', ') + '.'));
    if (urgent.length) parts.push(p(`<b style="color:${C.down};">לטפל:</b> ${urgent.map((u) => e(u.text)).join(' ')}`, C.text));
    else parts.push(p('אין מניה שהגיעה ליעד או ששברה מגמה. אין צורך לעשות כלום חוץ מהקנייה החודשית.'));

    // 2. Forecast
    parts.push(h2('התחזית'));
    if (now.sims.length) {
        const rows = now.sims.map((s) => {
            const b = prevSims.get(s.years);
            const d = b ? s.probBelowContributed - b.probBelowContributed : null;
            return [
                cell(e(yearsHe(s.years)), { bold: true }),
                cell(e(money(s.p10, base)), { color: C.down }),
                cell(e(money(s.p50, base)), { bold: true }),
                cell(e(money(s.p90, base)), { color: C.up }),
                cell(`${s.probBelowContributed.toFixed(0)}%${d !== null && Math.abs(d) >= 1 ? ` <span style="color:${d < 0 ? C.up : C.down};font-size:12px;">(${d > 0 ? 'עלה' : 'ירד'} מ-${b!.probBelowContributed.toFixed(0)}%)</span>` : ''}`),
            ];
        });
        parts.push(table(['בעוד', 'שנה רעה', 'שנה רגילה', 'שנה טובה', 'סיכוי להפסד'], rows));
        parts.push(p(`"שנה רעה" ו"שנה טובה" הן מקרים שקורים בערך פעם בעשר שנים. החישוב לוקח מכל מניה את האופן שבו היא זזה בשלוש השנים האחרונות, ומניח שבממוצע היא תרוויח כמו שוק המניות, ${now.assumedReturnPct}% בשנה${now.monthlyBudget ? ` והפקדה של ${e(money(now.monthlyBudget, base))} בחודש` : ''}.`, C.faint, 12.5));
        if (drivers.length) parts.push(p(`מה הזיז את התחזית: ${drivers.map(e).join('. ')}.`));
        if (!now.monthlyBudget) parts.push(p('עוד לא הוגדר סכום חודשי, ולכן התחזית לא כוללת את ההפקדות. מגדירים אותו בעמוד יום קנייה.', C.sub, 13.5));
    } else parts.push(p('אין עוד מספיק היסטוריה משותפת לסימולציה.'));
    if (now.goal) parts.push(p(`<b>המטרה שלך:</b> ${e(money(now.goal.amount, base))} עד סוף ${now.goal.date.slice(0, 4)}. הסיכוי להגיע אליה כרגע: <b style="color:${now.goal.chancePct >= 80 ? C.up : now.goal.chancePct >= 50 ? C.brand : C.down};">${now.goal.chancePct}%</b>${now.goal.requiredMonthly && now.goal.chancePct < 80 ? `. כדי שיהיה 80%, צריך בערך ${e(money(now.goal.requiredMonthly, base))} בחודש` : ''}.`, C.text, 14));

    // 3. Holdings
    parts.push(h2('המניות שלך'));
    const prevH = new Map((prev?.holdings ?? []).map((h) => [h.symbol, h]));
    parts.push(table(['מניה', 'מחיר', 'מאז הסיכום הקודם', 'משקל', 'יעד שלך'], now.holdings.map((h) => {
        const ph = prevH.get(h.symbol);
        const move = ph?.price && h.price ? (h.price / ph.price - 1) * 100 : null;
        return [
            cell(`${e(hebrewName(h.symbol, h.name))} <span style="color:${C.faint};font-size:12px;">${ltr(h.symbol)}</span>`, { bold: true }),
            cell(h.price ? e(price(h.price, h.currency)) : '—'),
            cell(move === null ? '—' : ltr(pct(move)), { color: move === null ? C.faint : move >= 0 ? C.up : C.down }),
            cell(`${h.weightPct.toFixed(0)}%`),
            cell(h.targetPrice ? `${e(price(h.targetPrice, h.currency))}${h.targetDistancePct !== null && !h.targetReached ? ` <span style="color:${C.faint};font-size:12px;">(עוד ${ltr(pct(h.targetDistancePct, false, 0))})</span>` : ''}` : '—', { color: h.targetReached ? C.brand : C.text }),
        ];
    })));
    const calm = events.filter((x) => !x.urgent);
    if (calm.length) parts.push(`<ul style="${FF}margin:8px 0 0;padding-right:18px;color:${C.sub};font-size:14px;line-height:1.7;">${calm.map((x) => `<li>${e(x.text)}</li>`).join('')}</ul>`);
    const heavy = now.holdings.find((h) => h.weightPct >= 50);
    if (heavy) parts.push(p(`${e(hebrewName(heavy.symbol, heavy.name))} היא ${heavy.weightPct.toFixed(0)}% מהתיק. כשמניה אחת היא רוב התיק, נפילה שלה היא נפילה של כל התיק. הקנייה הבאה כדאי שתלך למשהו אחר.`, C.text, 14));

    // 3b. Reasons
    if (now.thesis?.length) {
        parts.push(h2('האם הסיבות שלך עדיין נכונות'));
        const TH: Record<string, [string, string]> = { intact: ['מחזיקה', C.up], weakened: ['נחלשה', C.brand], broken: ['נשברה', C.down], unclear: ['כללית מדי לבדיקה', C.faint] };
        parts.push(`<ul style="${FF}margin:4px 0 0;padding-right:18px;font-size:14px;line-height:1.7;color:${C.sub};">${now.thesis.map((t) => `<li><b style="color:${C.text};">${e(t.name)}</b>: <span style="color:${TH[t.status][1]};">${TH[t.status][0]}</span>. ${e(t.headline)}</li>`).join('')}</ul>`);
    }

    // 4. This month's buy
    parts.push(h2('מה לקנות החודש'));
    if (now.strategy?.buys.length) {
        const st = now.strategy;
        parts.push(p('לפי השיטה: קונים את 5 המניות שעלו הכי הרבה בשנה האחרונה, אחת מכל ענף, ומוכרים רק מניה שיוצאת מ-15 המובילות.', C.sub, 14));
        parts.push(table(['מניה', 'מקום', 'עלתה בשנה', now.monthlyBudget > 0 ? 'כמה לקנות' : ''], st.buys.map((b) => [
            cell(e(b.name), { bold: true }), cell(String(b.rank)), cell(ltr(`+${b.momentumPct.toFixed(0)}%`), { color: C.up }),
            cell(now.monthlyBudget > 0 ? (b.shares > 0 ? `${b.shares} מניות, ${e(money(b.amount, base))}` : 'פחות ממניה אחת') : ''),
        ])));
        if (st.keeps.length) parts.push(p(`להמשיך להחזיק: ${st.keeps.map((k) => `${e(k.name)} (מקום ${k.rank})`).join(', ')}.`, C.sub, 13.5));
        if (st.backtest) parts.push(p(`ב-20 השנים האחרונות, אחרי מס, השיטה הניבה ${st.backtest.strategyPct}% בשנה, מול ${st.backtest.equalPct}% לקנייה שווה של כל המניות ו-${st.backtest.indexPct}% למדד ת"א 125. בעבר זה עבד, וזה לא מבטיח את העתיד.`, C.faint, 12.5));
        if (!(now.monthlyBudget > 0)) parts.push(p('עוד לא הגדרת סכום חודשי, ולכן אין כמויות. מגדירים אותו בעמוד יום קנייה.', C.sub, 13.5));
    }
    if (now.plan?.hasTargets && now.monthlyBudget > 0) {
        parts.push(p('לפי משקלי היעד שקבעת:', C.text, 14));
        if (now.plan.buys.length) {
            parts.push(table(['מניה', 'כמה מניות', 'בערך'], now.plan.buys.map((b) => [
                cell(`${e(hebrewName(b.symbol))} <span style="color:${C.faint};font-size:12px;">${ltr(b.symbol)}</span>`, { bold: true }),
                cell(String(b.shares)), cell(e(money(b.amountBase, base))),
            ])));
            parts.push(p(`לפי משקלי היעד שקבעת ו-${e(money(now.monthlyBudget, base))} בחודש${now.plan.leftover > 0 ? `. נשארים ${e(money(now.plan.leftover, base))} כי קונים מניות שלמות` : ''}.`, C.faint, 12.5));
        } else parts.push(p('התיק כבר על משקלי היעד. הכסף של החודש יכול לחכות, או ללכת לרעיון חדש מהרשימה למטה.'));
        if (now.plan.sells.length) parts.push(p(`למכור לפי התוכנית: ${now.plan.sells.map((s) => `${e(hebrewName(s.symbol))} (${s.shares})`).join(', ')}.`, C.down));
    } else if (!now.strategy?.buys.length) {
        parts.push(p('עוד לא הגדרת סכום חודשי ומשקלי יעד, ולכן אין תוכנית קנייה מדויקת. ההמלצות למטה הן הכיוון.'));
    }
    if (now.harvest?.length && now.at.getMonth() >= 10) {
        parts.push(p(`<b>לחסוך מס לפני סוף השנה:</b> ${now.harvest.map((h) => `מכירה של ${e(h.name)} מקזזת בערך ${e(money(h.saving, base))}`).join('; ')}. כדאי לוודא מול רואה החשבון.`, C.text, 14));
    }

    // 4b. Radar
    const rd = now.radar;
    if (rd && (rd.political.length || rd.insiders.length || rd.congress.length)) {
        parts.push(h2('ראדאר: פוליטיקה ומה שקורה מבפנים'));
        const DIRH: Record<string, [string, string]> = { up: ['יכול לעזור', C.up], down: ['יכול להזיק', C.down], unclear: ['כיוון לא ברור', C.faint] };
        if (rd.political.length) parts.push(`<ul style="${FF}margin:4px 0 0;padding-right:18px;font-size:14px;line-height:1.7;color:${C.sub};">${rd.political.slice(0, 3).map((x) => `<li><b style="color:${C.text};">${e(x.affects.join(', '))}</b> <span style="color:${DIRH[x.direction][1]};">(${DIRH[x.direction][0]})</span>: ${e(x.explanation)}</li>`).join('')}</ul>`);
        if (rd.insiders.length) parts.push(p(`מבפנים: ${rd.insiders.slice(0, 3).map((x) => `${e(x.name)}: ${e(x.text)}`).join(' · ')}`, C.sub, 13.5));
        if (rd.congress.length) parts.push(p(`חברי בית הנבחרים קנו בחודש האחרון בעיקר: ${rd.congress.slice(0, 4).map((c) => `${ltr(c.ticker)} (${c.members} ${c.members === 1 ? 'חבר' : 'חברים'})`).join(', ')}. מידע, לא המלצה: הדיווח מגיע באיחור של עד 45 יום.`, C.faint, 12.5));
    }

    // 5. Ideas
    parts.push(h2('לגיוון התיק'));
    const ideaRow = (i: BriefIdea) => `<tr><td style="${FF}padding:10px 0;border-bottom:1px solid ${C.line};">
        <div style="font-size:15px;color:${C.text};font-weight:600;">${e(i.he)} <span style="color:${C.faint};font-size:12px;font-weight:400;">${ltr(i.symbol)}</span>${!prevTop.has(i.symbol) && prev ? ` <span style="color:${C.brand};font-size:12px;">חדש ברשימה</span>` : ''}</div>
        ${i.about ? `<div style="font-size:13.5px;color:${C.sub};line-height:1.6;">${e(i.about)}</div>` : ''}
        ${i.systemPct !== undefined ? `<div style="font-size:14px;color:${C.text};line-height:1.7;">הערכה לשנה: <b style="color:${i.systemPct >= 0 ? C.up : C.down};">${ltr(`${i.systemPct > 0 ? '+' : ''}${i.systemPct.toFixed(0)}%`)}</b>${i.rangeLowPct != null && i.rangeHighPct != null ? ` <span style="color:${C.faint};font-size:12.5px;">(בשנה רעה ${ltr(`${i.rangeLowPct}%`)}, בשנה טובה ${ltr(`+${i.rangeHighPct}%`)})</span>` : ''}</div>` : ''}
        ${i.business ? `<div style="font-size:13.5px;color:${C.sub};line-height:1.6;">העסק: ${e(i.business)}</div>` : ''}
        <div style="font-size:13.5px;color:${C.sub};line-height:1.6;">${i.reasons.slice(0, 2).map(e).join(' · ')}</div></td></tr>`;
    const ideaRows = [topIndex, ...topStocks].filter((x): x is BriefIdea => Boolean(x));
    if (ideaRows.length) {
        parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${ideaRows.map(ideaRow).join('')}</table>`);
        parts.push(p('ההערכה לשנה מתחילה מהממוצע של שוק המניות, 7%, וזזה לכיוון הצפי של האנליסטים לפי כמה אנליסטים יש. מניות שיורדות עכשיו, יקרות מאוד או קופצות חזק מדי לא נכנסות לרשימה.', C.faint, 12.5));
    } else parts.push(p('אף מועמדת לא עוברת את כל הבדיקות השבוע.'));

    parts.push(`<p style="${FF}margin:26px 0 0;"><a href="${e(appUrl)}/portfolio/ideas" style="display:inline-block;background:${C.brand};color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:15px;font-weight:600;">לכל הרעיונות</a> &nbsp; <a href="${e(appUrl)}/portfolio/outlook" style="color:${C.brand};font-size:14px;">לתחזית המלאה</a></p>`);
    parts.push(p('זה כלי לקבלת החלטות, לא ייעוץ השקעות. הנתונים מ-Yahoo, בעיכוב של 15 דקות.', C.faint, 12));

    const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.soft};">
<div dir="rtl" style="${FF}max-width:640px;margin:0 auto;padding:24px 16px;">
<div style="background:#fff;border-radius:14px;padding:26px 22px;border:1px solid ${C.line};text-align:right;">${parts.join('\n')}</div>
</div></body></html>`;

    const text = [
        subject, '',
        ...urgent.map((u) => `לטפל: ${u.text}`),
        ...now.sims.map((s) => `${yearsHe(s.years)}: רע ${money(s.p10, base)}, אמצע ${money(s.p50, base)}, טוב ${money(s.p90, base)}, סיכוי להפסד ${s.probBelowContributed.toFixed(0)}%`),
        '', ...ideaRows.map((i) => `${i.he} (${i.symbol}): ${i.reasons.slice(0, 2).join('. ')}`),
        '', `${appUrl}/portfolio/ideas`,
    ].join('\n');

    return { subject, html, text, events };
}
