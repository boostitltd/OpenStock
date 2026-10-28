import Link from "next/link";
import { Activity, Briefcase, CalendarCheck, Lightbulb, Telescope, TrendingDown } from "lucide-react";
import Panel from "@/components/Panel";
import OutlookHoldings from "@/components/portfolio/OutlookHoldings";
import WhatIfCard from "@/components/portfolio/WhatIfCard";
import { getOutlook } from "@/lib/actions/outlook.actions";
import { dateHe, money, pct, yearsHe } from "@/lib/format";

export const metadata = { title: 'תחזית | OpenStock' };

// Ranges, not predictions: every number here is resampled from the holdings' own last three years.
export default async function OutlookPage({ searchParams }: { searchParams: Promise<{ add?: string; pct?: string }> }) {
    const { add, pct: pctParam } = await searchParams;
    const outlook = await getOutlook(add?.trim() || undefined, pctParam ? Number(pctParam) : undefined);
    const { base, stats, sims, holdings } = outlook;

    const tiles = stats ? [
        { label: 'תשואה בעבר', value: pct(stats.annualReturnPct), sub: 'בשנה, בשלוש השנים האחרונות · לא מוקרנת קדימה', icon: Activity, tone: stats.annualReturnPct >= 0 ? 'text-up' : 'text-down' },
        { label: 'תנודתיות', value: pct(stats.annualVolPct, false), sub: 'התנודה הרגילה בשנה', icon: Activity },
        { label: 'הנפילה הגרועה', value: pct(stats.maxDrawdownPct), sub: 'מהשיא לשפל, בשלוש השנים האחרונות', icon: TrendingDown, tone: 'text-down' },
        { label: 'היסטוריה בשימוש', value: `${outlook.historyDays} ימים`, sub: outlook.historyFrom ? `מ-${dateHe(outlook.historyFrom)}` : '', icon: CalendarCheck },
    ] : [];

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">תחזית</h1>
                    <p className="page-sub">
                        טווחים, לא ניבוי. כל סימולציה לוקחת את התנודות, הנפילות והתנועה המשותפת של המניות שלך בשלוש השנים האחרונות, אבל מניחה תשואה ממוצעת של שוק, {outlook.assumedReturnPct}% בשנה, במקום לחזור על המגמה שלהן בעבר.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio" className="btn btn-ghost"><Briefcase /> התיק</Link>
                    <Link href="/portfolio/ideas" className="btn btn-ghost"><Lightbulb /> מה לקנות</Link>
                    <Link href="/portfolio/buy-day" className="btn btn-ghost"><CalendarCheck /> יום קנייה</Link>
                </div>
            </header>

            {holdings.length === 0 ? (
                <Panel title="עוד אין מה להקרין">
                    <div className="empty-state">
                        <span className="empty-icon"><Telescope className="size-5" /></span>
                        <h3>קודם רושמים מניה</h3>
                        <p className="max-w-sm">התחזית נבנית מהיסטוריית המחירים של מה שיש לך. רשמו קנייה בעמוד התיק וחזרו לכאן.</p>
                    </div>
                </Panel>
            ) : (
                <>
                    {tiles.length > 0 && (
                        <div className="bento mb-3">
                            {tiles.map(({ label, value, sub, icon: Icon, tone }) => (
                                <div key={label} className="bento-tile">
                                    <div className="bento-head"><span className="bento-ico"><Icon /></span><span>{label}</span></div>
                                    <p className={`bento-value ${tone ?? ''}`}>{value}</p>
                                    <p className="bento-foot truncate">{sub}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <Panel
                        title="איפה התיק יכול להיות"
                        sub={`מתחילים מ-${money(outlook.totalValue, base)}${outlook.monthlyBudget ? `, ומוסיפים ${money(outlook.monthlyBudget, base)} בחודש לפי משקלי היעד` : ', בלי הפקדה חודשית'} · הנחה של ${outlook.assumedReturnPct}% בשנה · 2,000 מסלולים`}
                        className="mb-3"
                    >
                        {sims.length === 0 ? (
                            <p className="px-4 py-6 text-[13.5px] text-faint">עוד אין מספיק היסטוריית מחירים משותפת.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-[14px]">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>טווח</th>
                                            <th className="is-num">הכסף שנכנס</th>
                                            <th className="is-num">תרחיש רע (10%)</th>
                                            <th className="is-num">אמצע (50%)</th>
                                            <th className="is-num">תרחיש טוב (90%)</th>
                                            <th className="is-num">סיכוי להפסד</th>
                                            <th className="is-num">צמיחה באמצע, לשנה</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sims.map((s) => (
                                            <tr key={s.years}>
                                                <td className="font-semibold text-foreground">{yearsHe(s.years)}</td>
                                                <td className="is-num text-muted-foreground">{money(s.contributed, base)}</td>
                                                <td className="is-num text-down">{money(s.p10, base)}</td>
                                                <td className="is-num font-semibold text-foreground">{money(s.p50, base)}</td>
                                                <td className="is-num text-up">{money(s.p90, base)}</td>
                                                <td className="is-num text-muted-foreground">{s.probBelowContributed.toFixed(0)}%</td>
                                                <td className="is-num text-muted-foreground">{pct(s.medianAnnualPct)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="px-4 pb-3 pt-2 text-[12px] text-faint">
                            תרחיש רע: אחד מכל עשרה מסלולים הסתיים מתחתיו. תרחיש טוב: אחד מכל עשרה הסתיים מעליו. סיכוי להפסד: המסלולים שהסתיימו מתחת לכסף שנכנס. הפיזור מגיע מההיסטוריה של המניות שלך, והממוצע של {outlook.assumedReturnPct}% לא, ולכן מניה ששילשה את עצמה לא אמורה לשלש שוב. אחזקות בדולרים מומרות בשער של היום, ותנועת הדולר עצמה לא נכנסת לסימולציה.
                        </p>
                    </Panel>

                    <Panel title="כל מניה" sub="ההיסטוריה שלה, האנליסטים, וההבטחה שבגללה קנית אותה" className="mb-3">
                        <OutlookHoldings holdings={holdings} base={base} />
                    </Panel>
                </>
            )}

            <Panel title="מה יקרה אם אוסיף מניה?" sub="אותה היסטוריה ואותה סימולציה, עם המועמדת במשקל שבוחרים">
                <WhatIfCard whatIf={outlook.whatIf} base={base} hasHoldings={holdings.length > 0} initialSymbol={add ?? ''} initialPct={pctParam ?? '10'} />
            </Panel>
        </>
    );
}
