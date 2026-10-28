import Link from "next/link";
import { Briefcase, Lightbulb, Telescope } from "lucide-react";
import Panel from "@/components/Panel";
import BacktestChart from "@/components/portfolio/BacktestChart";
import { getStrategy } from "@/lib/actions/ideas.actions";
import { KEEP_TOP, TOP_BUY } from "@/lib/momentum";
import { money, price } from "@/lib/format";

export const metadata = { title: 'השיטה | OpenStock' };

const monthHe = (ym: string) => new Date(`${ym}-15`).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

// A rule tested on twenty years of Tel Aviv prices, and what it says to do this month.
export default async function StrategyPage() {
    const s = await getStrategy();
    const [full, first, second, recent] = s.backtests;
    const sells = s.holdings.filter((h) => h.action === 'sell');
    const keeps = s.holdings.filter((h) => h.action === 'keep');
    const outside = s.holdings.filter((h) => h.action === 'outside');

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">השיטה</h1>
                    <p className="page-sub max-w-4xl">
                        כלל פשוט אחד, שנבדק על 20 שנה של הבורסה בתל אביב: כל חודש קונים את {TOP_BUY} המניות שעלו הכי הרבה בשנה האחרונה, לכל היותר אחת מכל ענף. מוכרים מניה רק כשהיא יוצאת מ-{KEEP_TOP} המובילות. מניות שעלו נוטות להמשיך לעלות עוד כמה חודשים, וזו אחת התופעות הכי מתועדות במחקר על שוק ההון.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio" className="btn btn-ghost"><Briefcase /> התיק</Link>
                    <Link href="/portfolio/ideas" className="btn btn-ghost"><Lightbulb /> מה לקנות</Link>
                    <Link href="/portfolio/outlook" className="btn btn-ghost"><Telescope /> תחזית</Link>
                </div>
            </header>

            <div className="flex flex-col gap-3">
                <Panel title="מה לעשות החודש" sub={`לפי הדירוג בסוף ${monthHe(s.asOf)}`}>
                    <div className="grid gap-4 p-4 xl:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <p className="kicker text-up">לקנות</p>
                            <ul className="flex flex-col gap-2">
                                {s.buys.map((b) => (
                                    <li key={b.symbol} className="flex items-center justify-between gap-3 rounded-[10px] bg-page/60 px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
                                        <span className="min-w-0">
                                            <Link href={`/portfolio/ideas/${encodeURIComponent(b.symbol)}`} className="font-semibold text-foreground hover:text-brand-ink">{b.name}</Link>
                                            <span className="block text-[12.5px] text-faint">מקום {b.rank} · עלתה {b.momentumPct.toFixed(0)}% בשנה האחרונה{b.price ? ` · ${price(b.price, 'ILS')}` : ''}</span>
                                        </span>
                                        <span className="shrink-0 text-end text-[13px]">
                                            {s.monthlyBudget > 0 ? (b.shares > 0 ? <><span className="font-semibold text-foreground">{b.shares} מניות</span><span className="block text-faint">{money(b.amount, 'ILS')}</span></> : <span className="text-faint">הסכום קטן ממחיר מניה אחת</span>) : null}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {s.monthlyBudget > 0
                                ? <p className="text-[12.5px] text-faint">{money(s.monthlyBudget, s.base)} בחודש, מחולק שווה בין {TOP_BUY} המניות{s.leftover > 0 ? `. נשארים ${money(s.leftover, s.base)} כי קונים מניות שלמות` : ''}.</p>
                                : <p className="text-[12.5px] text-brand-ink">עוד לא הגדרת סכום חודשי, אז אין כמויות. מגדירים אותו בעמוד <Link href="/portfolio/buy-day" className="underline">יום קנייה</Link>.</p>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <p className="kicker">מה שכבר יש לך</p>
                            {s.holdings.length === 0 && <p className="text-[13.5px] text-faint">עוד אין מניות בתיק.</p>}
                            <ul className="flex flex-col gap-2">
                                {[...sells, ...keeps, ...outside].map((h) => (
                                    <li key={h.symbol} className="rounded-[10px] bg-page/60 px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-semibold text-foreground">{h.name}</span>
                                            <span className={`pill ${h.action === 'sell' ? 'is-down' : h.action === 'keep' ? 'is-up' : ''}`}>{h.action === 'sell' ? 'למכור' : h.action === 'keep' ? 'להחזיק' : 'מחוץ לשיטה'}</span>
                                        </div>
                                        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                                            {h.action === 'keep' && `במקום ${h.rank} מתוך ${s.ranking.length}, בתוך ${KEEP_TOP} המובילות. ממשיכים להחזיק.`}
                                            {h.action === 'sell' && `ירדה למקום ${h.rank}, מחוץ ל-${KEEP_TOP} המובילות. לפי השיטה זה הזמן למכור ולהעביר את הכסף לקניות של החודש.`}
                                            {h.action === 'outside' && 'השיטה מדרגת רק את המניות הגדולות בתל אביב, אז אין לה המלצה על המניה הזו.'}
                                            {h.action !== 'outside' && h.gain > 0 && ` אם מוכרים: רווח של ${money(h.gain, s.base)} ומס של בערך ${money(h.tax, s.base)}.`}
                                            {h.action !== 'outside' && h.gain < 0 && ` אם מוכרים: הפסד של ${money(-h.gain, s.base)}, שמקזז מס על רווחים אחרים השנה.`}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </Panel>

                {full && (
                    <Panel title="למה לסמוך על זה: מה היה קורה בעבר" sub="1,000 ש&quot;ח בכל חודש, ובסוף מוכרים הכול ומשלמים 25% מס על הרווח">
                        <div className="flex flex-col gap-4 p-4">
                            <BacktestChart points={s.curve} />
                            <div className="overflow-x-auto rounded-[12px]">
                                <table className="data-table">
                                    <thead><tr><th>תקופה</th><th className="is-num">הכסף שהוכנס</th><th className="is-num">מדד ת&quot;א 125</th><th className="is-num">כל המניות שוות</th><th className="is-num">השיטה</th><th className="is-num">השיטה, פטור ממס</th></tr></thead>
                                    <tbody>
                                        {[['20 השנים', full], ['2006 עד 2015', first], ['2016 עד היום', second], ['5 השנים האחרונות', recent]].filter(([, r]) => r).map(([label, r]) => {
                                            const x = r as typeof full;
                                            return (
                                                <tr key={label as string}>
                                                    <td className="font-semibold">{label as string}</td>
                                                    <td className="is-num text-muted-foreground">{money(x.invested, 'ILS')}</td>
                                                    <td className="is-num">{money(x.index, 'ILS')} <span className="text-[12px] text-faint">({x.indexPct}% בשנה)</span></td>
                                                    <td className="is-num">{money(x.equal, 'ILS')} <span className="text-[12px] text-faint">({x.equalPct}%)</span></td>
                                                    <td className="is-num font-semibold text-up">{money(x.strategy, 'ILS')} <span className="text-[12px] font-normal text-faint">({x.strategyPct}%)</span></td>
                                                    <td className="is-num text-muted-foreground">{money(x.strategyTaxFree, 'ILS')} <span className="text-[12px] text-faint">({x.strategyTaxFreePct}%)</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                                <p className="font-semibold text-foreground">מה צריך לדעת לפני שסומכים על זה</p>
                                <p>• הבדיקה רצה על המניות הגדולות של היום. חברות שנעלמו בדרך לא בפנים, ולכן כל המספרים בטבלה גבוהים מהמציאות. את השיטה כדאי להשוות לעמודה &quot;כל המניות שוות&quot;, שסובלת מאותה בעיה בדיוק. גם מולה השיטה ניצחה, בכל אחד משני העשורים.</p>
                                <p>• לשיטה יש נקודת חולשה ידועה: כשהשוק מתהפך מירידה לעלייה, כמו ב-2009, המניות שהובילו בירידה נשארות מאחור, והשיטה מפגרת כמה חודשים.</p>
                                <p>• את הכלל &quot;אחת מכל ענף&quot; הוספתי אחרי הבדיקה הראשונה. הוא לא פגע בתוצאה, והוא מונע ריכוז בענף אחד.</p>
                                <p>• בעבר זה עבד. זה לא מבטיח שזה יעבוד גם בעתיד.</p>
                            </div>
                        </div>
                    </Panel>
                )}

                <div className="grid gap-3 xl:grid-cols-2">
                    <Panel title="המס" sub={`${s.taxRatePct}% מס על רווח כשמוכרים`}>
                        <div className="flex flex-col gap-2 p-4 text-[13.5px] leading-relaxed text-muted-foreground">
                            <p>רווח שמימשת השנה: <span className="font-semibold text-foreground">{money(s.realisedThisYear, s.base)}</span>.</p>
                            {s.harvest.length > 0 ? (
                                <div className="rounded-[10px] bg-brand-soft/40 px-3 py-2 text-foreground">
                                    <p className="font-semibold">אפשר לחסוך מס לפני 31 בדצמבר</p>
                                    {s.harvest.map((h) => <p key={h.symbol}>מכירה של {h.name} (בהפסד של {money(h.loss, s.base)}) מקזזת מס של בערך {money(h.saving, s.base)}. אפשר לקנות אותה שוב אחר כך, אבל כדאי לוודא את זה מול רואה החשבון.</p>)}
                                </div>
                            ) : <p>אין כרגע מניה בהפסד שאפשר לקזז מולה, או שעוד לא מימשת רווח השנה.</p>}
                            <p>השיטה מוכרת לעיתים רחוקות, אבל כל מכירה ברווח עולה 25%. בחשבון שבו קנייה ומכירה לא יוצרות מס, למשל קרן השתלמות או פוליסה בניהול אישי (IRA), השיטה הייתה מרוויחה בעבר הרבה יותר. כדאי לבדוק את האפשרות הזו מול יועץ פנסיוני.</p>
                            <p>כשהתיק לא מאוזן, עדיף לאזן אותו עם הכסף החודשי החדש מאשר למכור מניה ברווח.</p>
                        </div>
                    </Panel>

                    <Panel title="הדירוג המלא" sub="כמה כל מניה עלתה בשנה האחרונה, בלי החודש האחרון">
                        <div className="max-h-[520px] overflow-auto rounded-[12px]">
                            <table className="data-table">
                                <thead><tr><th>מקום</th><th>מניה</th><th className="is-num">בשנה האחרונה</th><th>מצב</th></tr></thead>
                                <tbody>
                                    {s.ranking.map((r) => (
                                        <tr key={r.symbol}>
                                            <td className="text-faint">{r.rank}</td>
                                            <td className="font-semibold">{r.name}{r.held ? <span className="ms-1.5 text-[11.5px] font-normal text-brand-ink">בתיק שלך</span> : null}</td>
                                            <td className={`is-num ${r.momentumPct >= 0 ? 'text-up' : 'text-down'}`}><span dir="ltr">{r.momentumPct > 0 ? '+' : ''}{r.momentumPct.toFixed(0)}%</span></td>
                                            <td className="text-[12.5px]">{r.buy ? <span className="pill is-up">לקנות החודש</span> : r.rank <= KEEP_TOP ? <span className="text-muted-foreground">להחזיק אם יש</span> : <span className="text-faint">מחוץ ל-{KEEP_TOP}</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </div>

                <p className="text-[12px] text-faint">מחירים חודשיים מתואמים לדיבידנדים מ-Yahoo, מ-2002. נקודות שבורות בנתונים (קפיצה של פי 10 שחוזרת בחודש שאחרי) הוסרו. עלות מסחר של 0.2% לכל קנייה ומכירה. זה כלי לקבלת החלטות, לא ייעוץ השקעות.</p>
            </div>
        </>
    );
}
