import Link from "next/link";
import { Activity, Briefcase, CalendarCheck, Lightbulb, Telescope, TrendingDown } from "lucide-react";
import Panel from "@/components/Panel";
import OutlookHoldings from "@/components/portfolio/OutlookHoldings";
import WhatIfCard from "@/components/portfolio/WhatIfCard";
import GoalCard from "@/components/portfolio/GoalCard";
import { getOutlook } from "@/lib/actions/outlook.actions";
import { dateHe, money, pct, yearsHe } from "@/lib/format";

export const metadata = { title: 'תחזית | OpenStock' };

// Ranges, not predictions: every number here is resampled from the holdings' own last three years.
export default async function OutlookPage({ searchParams }: { searchParams: Promise<{ add?: string; pct?: string }> }) {
    const { add, pct: pctParam } = await searchParams;
    const outlook = await getOutlook(add?.trim() || undefined, pctParam ? Number(pctParam) : undefined);
    const { base, stats, sims, holdings } = outlook;

    const tiles = stats ? [
        { label: 'כמה התיק עשה בעבר', value: pct(stats.annualReturnPct), sub: 'בממוצע לשנה, בשלוש השנים האחרונות. לא מניחים שזה יחזור', icon: Activity, tone: stats.annualReturnPct >= 0 ? 'text-up' : 'text-down' },
        { label: 'כמה התיק קופץ', value: `±${stats.annualVolPct.toFixed(0)}%`, sub: 'בשנה רגילה, למעלה או למטה', icon: Activity },
        { label: 'הירידה הכי גדולה', value: pct(stats.maxDrawdownPct), sub: 'מהשיא עד השפל, בשלוש השנים האחרונות', icon: TrendingDown, tone: 'text-down' },
        { label: 'על כמה ימים זה מבוסס', value: `${outlook.historyDays} ימי מסחר`, sub: outlook.historyFrom ? `מ-${dateHe(outlook.historyFrom)}` : '', icon: CalendarCheck },
    ] : [];

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">תחזית</h1>
                    <p className="page-sub">
                        אף אחד לא יודע מה יקרה, אז במקום מספר אחד יש טווח: מה קורה בשנה רעה, בשנה רגילה ובשנה טובה. המערכת מריצה אלפי שנים אפשריות לפי איך שהמניות שלך זזו בשלוש השנים האחרונות, ומניחה שבממוצע הן ירוויחו כמו שוק המניות, {outlook.assumedReturnPct}% בשנה.
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
                        sub={`התיק שווה היום ${money(outlook.totalValue, base)}${outlook.monthlyBudget ? `, ומוסיפים ${money(outlook.monthlyBudget, base)} בחודש לפי משקלי היעד` : ', בלי הפקדה חודשית'} · מחושב על 2,000 שנים אפשריות`}
                        className="mb-3"
                    >
                        {sims.length === 0 ? (
                            <p className="px-4 py-6 text-[13.5px] text-faint">עוד אין מספיק היסטוריית מחירים משותפת.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-[14px]">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>בעוד</th>
                                            <th className="is-num">הכסף שהכנסת</th>
                                            <th className="is-num">שנה רעה</th>
                                            <th className="is-num">שנה רגילה</th>
                                            <th className="is-num">שנה טובה</th>
                                            <th className="is-num">סיכוי להפסד</th>
                                            <th className="is-num">באמצע, כמה בשנה</th>
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
                            איך לקרוא: "שנה רעה" קורית בערך פעם בעשר שנים, וכך גם "שנה טובה". "שנה רגילה" היא האמצע. "סיכוי להפסד" הוא כמה מהשנים האפשריות נגמרו עם פחות כסף ממה שהכנסת. מניה שעלתה הרבה בעבר לא אמורה לחזור על זה, ולכן ההנחה היא ממוצע של שוק. אחזקות בדולרים מחושבות בשער של היום.
                        </p>
                    </Panel>

                    <Panel title="כל מניה בתיק" sub="מה קרה לה, מה האנליסטים אומרים, והסיבה שבגללה קנית אותה" className="mb-3">
                        <OutlookHoldings holdings={holdings} base={base} />
                    </Panel>
                </>
            )}

            <Panel title="המטרה שלך" sub="כמה כסף אתה רוצה, ועד מתי. המערכת אומרת מה הסיכוי וכמה צריך בחודש" className="mb-3">
                <GoalCard goal={outlook.goal} amount={outlook.goalAmount} date={outlook.goalDate} monthly={outlook.monthlyBudget} />
            </Panel>

            <Panel title="מה יקרה אם אוסיף מניה?" sub="אותה היסטוריה ואותה סימולציה, עם המועמדת במשקל שבוחרים">
                <WhatIfCard whatIf={outlook.whatIf} base={base} hasHoldings={holdings.length > 0} initialSymbol={add ?? ''} initialPct={pctParam ?? '10'} />
            </Panel>
        </>
    );
}
