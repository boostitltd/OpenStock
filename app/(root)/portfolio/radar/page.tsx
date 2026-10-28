import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Briefcase, CircleHelp, ExternalLink, Landmark, Lightbulb, Radar as RadarIcon, UserCheck } from "lucide-react";
import Panel from "@/components/Panel";
import { getRadar } from "@/lib/actions/ideas.actions";
import { dateHe } from "@/lib/format";

export const metadata = { title: 'ראדאר | OpenStock' };

const DIR = {
    up: { Icon: ArrowUpRight, cls: 'text-up', label: 'יכול לעזור' },
    down: { Icon: ArrowDownRight, cls: 'text-down', label: 'יכול להזיק' },
    unclear: { Icon: CircleHelp, cls: 'text-faint', label: 'לא ברור לאיזה כיוון' },
} as const;

const INSIDER = { 'insider-buy': { label: 'מישהו מבפנים קנה', cls: 'is-up' }, 'insider-sell': { label: 'מישהו מבפנים מכר', cls: 'is-down' }, buyback: { label: 'החברה קונה את המניות שלה', cls: 'is-up' } } as const;

// What politics and insiders did this week that touches the portfolio. Awareness, not a trading signal.
export default async function RadarPage() {
    const r = await getRadar();
    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">ראדאר</h1>
                    <p className="page-sub max-w-4xl">
                        מה טראמפ והבית הלבן עשו השבוע שנוגע למניות שלך ולמניות שהשיטה קונה החודש, מי מבפנים קנה או מכר, ומה חברי הקונגרס קנו. המטרה היא לא להיות מופתע, לא להעתיק: מחקרים מוצאים שהעתקה של פוליטיקאים כמעט לא מוסיפה תשואה אחרי האיחור בדיווח, והשוק מגיב להצהרה תוך דקות.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio" className="btn btn-ghost"><Briefcase /> התיק</Link>
                    <Link href="/portfolio/strategy" className="btn btn-ghost"><Lightbulb /> השיטה</Link>
                </div>
            </header>

            <div className="flex flex-col gap-3">
                <Panel title="טראמפ והבית הלבן" sub={`מתוך ${r.postsRead} פוסטים ב-7 הימים האחרונים ו-${r.actionsRead} צווים והחלטות ב-3 השבועות האחרונים`}>
                    {r.items.length === 0 ? (
                        <div className="empty-state py-10">
                            <span className="empty-icon"><RadarIcon className="size-5" /></span>
                            <h3>שקט</h3>
                            <p className="max-w-sm">לא היה השבוע שום דבר שנוגע ישירות למניות שלך או למניות שהשיטה קונה.</p>
                        </div>
                    ) : (
                        <ul className="row-list">
                            {r.items.map((i) => {
                                const d = DIR[i.direction];
                                return (
                                    <li key={i.link} className="flex flex-col gap-1.5 px-4 py-3.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`pill ${i.importance === 'high' ? 'is-brand' : ''}`}>{i.source === 'trump' ? 'פוסט של טראמפ' : 'צו של הבית הלבן'}</span>
                                            <span className={`flex items-center gap-1 text-[12.5px] ${d.cls}`}><d.Icon className="size-3.5" />{d.label}</span>
                                            <span className="text-[12.5px] font-semibold text-foreground">{i.affects.join(', ')}</span>
                                            <span className="text-[12px] text-faint">{dateHe(i.date)}</span>
                                        </div>
                                        <p className="text-[14.5px] leading-snug text-foreground">{i.explanation}</p>
                                        <a href={i.link} target="_blank" rel="noopener noreferrer" dir="ltr" className="flex items-start gap-1.5 text-start text-[12.5px] text-faint hover:text-brand-ink">
                                            <ExternalLink className="mt-0.5 size-3.5 flex-none" /><span>{i.title}</span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>

                <div className="grid gap-3 xl:grid-cols-2">
                    <Panel title="קניות מבפנים" sub="מנהלים ובעלי שליטה שקנו או מכרו, וחברות שקונות את המניות של עצמן, לפי החדשות בחודשיים האחרונים">
                        {r.insiders.length === 0 ? (
                            <div className="empty-state py-10">
                                <span className="empty-icon"><UserCheck className="size-5" /></span>
                                <p className="max-w-sm">לא נמצאו דיווחים כאלה על המניות שלך או על המניות שהשיטה קונה.</p>
                            </div>
                        ) : (
                            <ul className="row-list">
                                {r.insiders.map((x) => (
                                    <li key={x.link} className="flex flex-col gap-1 px-4 py-3">
                                        <div className="flex items-center gap-2"><span className="font-semibold text-foreground">{x.name}</span><span className={`pill ${INSIDER[x.kind].cls}`}>{INSIDER[x.kind].label}</span><span className="text-[12px] text-faint">{dateHe(x.date)}</span></div>
                                        <a href={x.link} target="_blank" rel="noopener noreferrer" className="text-[13.5px] text-muted-foreground hover:text-brand-ink">{x.text}</a>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="px-4 pb-3 text-[12px] text-faint">קנייה של מנהל בכסף שלו היא אחד הסימנים האמינים שיש. מכירה פחות אומרת: מנהלים מוכרים גם מסיבות אישיות.</p>
                    </Panel>

                    <Panel title="מה חברי הקונגרס קנו" sub={`בית הנבחרים בלבד, ${r.congress.filings} דיווחים ב-45 הימים האחרונים`}>
                        {r.congress.top.length === 0 ? (
                            <div className="empty-state py-10">
                                <span className="empty-icon"><Landmark className="size-5" /></span>
                                <p className="max-w-sm">עוד לא נקראו דיווחים. הם נקראים פעם ביום.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-[12px]">
                                <table className="data-table">
                                    <thead><tr><th>מניה</th><th className="is-num">קניות</th><th className="is-num">מכירות</th><th>מי</th></tr></thead>
                                    <tbody>
                                        {r.congress.top.map((c) => (
                                            <tr key={c.ticker}>
                                                <td><span dir="ltr" className="mono font-semibold text-foreground">{c.ticker}</span> <span dir="ltr" className="block max-w-[220px] truncate text-[12px] text-faint">{c.asset}</span></td>
                                                <td className="is-num text-up">{c.buys}</td>
                                                <td className="is-num text-down">{c.sells}</td>
                                                <td className="max-w-[220px] whitespace-normal text-[12.5px] text-muted-foreground" dir="ltr">{c.members.join(', ')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="px-4 pb-3 text-[12px] leading-relaxed text-faint">
                            חברי בית הנבחרים מדווחים עד 45 יום אחרי העסקה. מחקרים מלפני 2012 מצאו שהם הרוויחו יותר מהשוק. מחקרים מאז, כשהחוק הוחמר, מוצאים יתרון קטן או בכלל לא. את הסנאט אי אפשר לקרוא אוטומטית: האתר שלו חוסם. הדיווחים נקראים מהקבצים הרשמיים של בית הנבחרים.
                        </p>
                    </Panel>
                </div>

                <p className="text-[12px] text-faint">הפוסטים מהארכיון trumpstruth.org, הצווים מאתר הבית הלבן, החדשות מ-Google News והדיווחים מאתר בית הנבחרים. את הסינון והסיכום עושה {r.model}, מהמקורות האלה בלבד. עודכן ב-{dateHe(r.generatedAt)}.</p>
            </div>
        </>
    );
}
