import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, CircleMinus, ExternalLink, FlaskConical, Newspaper } from "lucide-react";
import Panel from "@/components/Panel";
import { VERDICT, toneClass } from "@/components/portfolio/IdeaCard";
import { getDecision } from "@/lib/actions/ideas.actions";
import type { Line } from "@/lib/decision";
import { bigMoney, changeWords, dateHe, price, signedPct } from "@/lib/format";

export const metadata = { title: 'החלטה על מניה | OpenStock' };

const VERDICT_SENTENCE = {
    buy: 'לפי הבדיקות של המערכת, היא מתאימה לתיק שלך עכשיו.',
    wait: 'היא יכולה להתאים לתיק, אבל עדיף לחכות.',
    weak: 'היא לא מזיקה, אבל מוסיפה לתיק מעט.',
    same: 'היא לא מאזנת את התיק: היא עוד מאותו דבר שכבר יש לך.',
} as const;

function LineItem({ line }: { line: Line }) {
    const Icon = line.tone === 'good' ? CheckCircle2 : line.tone === 'bad' ? CircleAlert : CircleMinus;
    return (
        <li className="flex items-start gap-2.5 text-[14px] leading-snug">
            <Icon className={`mt-0.5 size-4 flex-none ${toneClass(line)}`} />
            <span className="text-foreground">{line.text}</span>
        </li>
    );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
    return (
        <div className="flex flex-col gap-1 rounded-[12px] bg-page/60 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
            <p className="text-[12.5px] text-faint">{label}</p>
            <p className={`text-right text-[26px] font-bold ${tone ?? 'text-foreground'}`}><span dir="ltr" className="num">{value}</span></p>
            {sub && <p className="text-[12.5px] leading-snug text-muted-foreground">{sub}</p>}
        </div>
    );
}

// The whole case for one candidate on one page: the answer first, then the numbers behind it.
export default async function DecisionPage({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params;
    const d = await getDecision(decodeURIComponent(symbol).toUpperCase());

    if (!d) {
        return (
            <Panel title="המניה לא ברשימת המועמדות">
                <div className="empty-state">
                    <h3>אין עמוד החלטה למניה הזו</h3>
                    <p className="max-w-sm">עמוד ההחלטה קיים למועמדות שברשימת &quot;מה לקנות&quot;. מניה שכבר יש לך בתיק נמצאת בעמוד התחזית.</p>
                    <Link href="/portfolio/ideas" className="btn btn-ghost mt-2"><ArrowRight /> חזרה לרשימה</Link>
                </div>
            </Panel>
        );
    }

    const { idea, insight, headlines, businessLines, result } = d;
    const e = idea.estimate;
    const v = VERDICT[idea.verdict];
    const b = idea.business;
    const cur = b?.currency ?? 'ILS';

    return (
        <>
            <header className="page-head">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="page-title">{idea.entry.he}</h1>
                        <span className={`pill ${v.cls}`}>{v.label}</span>
                    </div>
                    <p className="page-sub"><span dir="ltr" className="mono">{idea.symbol}</span> · {idea.entry.sector}{idea.price != null ? ` · מחיר ${price(idea.price, idea.currency)}` : ''}</p>
                    {idea.about && <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-muted-foreground">{idea.about}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio/ideas" className="btn btn-ghost"><ArrowRight /> לכל הרעיונות</Link>
                    <Link href={`/stocks/${encodeURIComponent(idea.symbol)}`} className="btn btn-ghost">גרף ודוחות</Link>
                </div>
            </header>

            <div className="flex flex-col gap-3">
                <Panel title="השורה התחתונה">
                    <div className="flex flex-col gap-3 p-4">
                        <p className="text-[16px] font-semibold text-foreground">{VERDICT_SENTENCE[idea.verdict]}</p>
                        {insight?.story && <p className="max-w-4xl text-[14.5px] leading-relaxed text-muted-foreground">{insight.story}</p>}
                        <ul className="flex flex-col gap-1.5">
                            {idea.reasons.slice(0, 4).map((r) => <li key={r} className="text-[14px] leading-snug text-foreground">• {r}</li>)}
                        </ul>
                    </div>
                </Panel>

                <Panel title="כמה אפשר להרוויח" sub="לשנה הקרובה, כולל דיבידנד">
                    <div className="grid gap-3 p-3 md:grid-cols-3">
                        <Tile label="הערכת המערכת" value={signedPct(e.systemPct)} tone={e.systemPct >= 0 ? 'text-up' : 'text-down'}
                            sub={e.analysts === 0 ? 'אין אנליסטים, אז זו התשואה הממוצעת של שוק המניות.' : `${e.weightPct}% מההערכה מגיעים מהאנליסטים והשאר מהממוצע של השוק (7%).`} />
                        <Tile label="בשנה רעה (1 מכל 10)" value={e.rangeLowPct === null ? '—' : signedPct(e.rangeLowPct)} tone="text-down"
                            sub="גם כשהכול הולך לפי ההערכה, כך נראית שנה רעה לפי איך שהמניה זזה בשלוש השנים האחרונות." />
                        <Tile label="בשנה טובה (1 מכל 10)" value={e.rangeHighPct === null ? '—' : signedPct(e.rangeHighPct)} tone="text-up"
                            sub="ובאותו אופן, שנה טובה." />
                    </div>
                    <div className="flex flex-col gap-1.5 px-4 pb-4 text-[13.5px] text-muted-foreground">
                        {e.analysts > 0 && e.analystUpsidePct !== null && idea.analystTarget !== null && (
                            <p>
                                {e.analysts === 1 ? 'אנליסט אחד' : `${e.analysts} אנליסטים`} {e.analysts === 1 ? 'מעריך' : 'מעריכים בממוצע'} שהמחיר יגיע ל-{price(idea.analystTarget, idea.currency)}, כלומר {changeWords(e.analystUpsidePct)} מהמחיר היום.
                                {e.analysts < 3 ? ' זו דעה של מעט מאוד אנליסטים, ולכן היא מקבלת משקל קטן.' : ''}
                            </p>
                        )}
                        {b?.recommendations && (
                            <p>המלצות האנליסטים החודש: {b.recommendations.strongBuy + b.recommendations.buy} לקנות, {b.recommendations.hold} להחזיק, {b.recommendations.sell + b.recommendations.strongSell} למכור.</p>
                        )}
                        {e.dividendPct > 0 && <p>היא מחלקת דיבידנד של כ-{e.dividendPct.toFixed(1)}% בשנה, וזה כבר בתוך ההערכה.</p>}
                        {idea.trailingPE !== null && idea.trailingPE > 0 && <p>המחיר היום שווה {idea.trailingPE.toFixed(0)} שנים של הרווח שלה{idea.trailingPE > 25 ? ', שזה יקר' : idea.trailingPE < 12 ? ', שזה זול' : ''}.</p>}
                    </div>
                </Panel>

                <div className="grid gap-3 xl:grid-cols-2">
                    <Panel title="איך העסק מתפקד" sub={b ? `מהדוחות שלה, ב${cur === 'USD' ? 'דולרים' : 'שקלים'}` : undefined}>
                        <ul className="flex flex-col gap-2.5 p-4">
                            {businessLines.map((l) => <LineItem key={l.text} line={l} />)}
                        </ul>
                        {b && b.yearly.length > 0 && (
                            <div className="overflow-x-auto px-3 pb-3">
                                <table className="data-table">
                                    <thead><tr><th>שנה</th><th className="is-num">הכנסות</th><th className="is-num">רווח נקי</th></tr></thead>
                                    <tbody>
                                        {[...b.yearly].reverse().map((y) => (
                                            <tr key={y.year}><td className="font-semibold">{y.year}</td><td className="is-num">{bigMoney(y.revenue, cur)}</td><td className={`is-num ${(y.earnings ?? 0) < 0 ? 'text-down' : ''}`}>{y.earnings === null ? '—' : bigMoney(y.earnings, cur)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {idea.nextEarnings && <p className="px-4 pb-4 text-[13px] text-faint">הדוח הבא: {dateHe(idea.nextEarnings)}.</p>}
                    </Panel>

                    <Panel title="מה קורה בחברה ובשוק שלה" sub={insight ? 'סיכום שנכתב מהכותרות ומהנתונים בלבד' : undefined}>
                        <div className="flex flex-col gap-4 p-4">
                            {insight ? (
                                <>
                                    {insight.drivers.length > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            <p className="kicker text-up">מה יכול להעלות אותה</p>
                                            <ul className="flex flex-col gap-1.5">{insight.drivers.map((x) => <LineItem key={x} line={{ text: x, tone: 'good' }} />)}</ul>
                                        </div>
                                    )}
                                    {insight.risks.length > 0 && (
                                        <div className="flex flex-col gap-1.5">
                                            <p className="kicker text-down">מה יכול להוריד אותה</p>
                                            <ul className="flex flex-col gap-1.5">{insight.risks.map((x) => <LineItem key={x} line={{ text: x, tone: 'bad' }} />)}</ul>
                                        </div>
                                    )}
                                    {insight.watch && <p className="rounded-[10px] bg-brand-soft/40 px-3 py-2 text-[13.5px] text-foreground"><span className="font-semibold">מה לבדוק: </span>{insight.watch}</p>}
                                </>
                            ) : <p className="text-[13.5px] text-faint">הסיכום לא זמין כרגע. הכותרות האחרונות למטה.</p>}

                            <div className="flex flex-col gap-1">
                                <p className="kicker flex items-center gap-1.5"><Newspaper className="size-3.5" /> כותרות אחרונות</p>
                                {headlines.length === 0 ? <p className="text-[13px] text-faint">לא נמצאו כותרות בחודשיים האחרונים.</p> : (
                                    <ul className="row-list">
                                        {headlines.map((h) => (
                                            <li key={h.url}>
                                                <a href={h.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2 py-2 text-[13.5px] hover:text-brand-ink">
                                                    <span className="min-w-0 flex-1"><span className="text-foreground group-hover:text-brand-ink">{h.title}</span> <span className="text-[12px] text-faint">· {h.source} · {dateHe(h.date)}</span></span>
                                                    <ExternalLink className="mt-1 size-3.5 flex-none text-faint" />
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </Panel>
                </div>

                <Panel title="מה היא עושה לתיק שלך" sub={result.heldNames.length ? `מול מה שיש לך היום: ${result.heldNames.join(', ')}` : undefined}>
                    <div className="flex flex-col gap-3 p-4">
                        <ul className="flex flex-col gap-2.5">{idea.fit.map((l) => <LineItem key={l.text} line={l} />)}</ul>
                        <Link href={`/portfolio/outlook?add=${encodeURIComponent(idea.symbol)}&pct=${result.weightPct}`} className="btn btn-ghost self-start"><FlaskConical /> לראות את התחזית של התיק איתה</Link>
                    </div>
                </Panel>

                <p className="text-[12px] leading-relaxed text-faint">
                    נתוני מחירים ודוחות מ-Yahoo, כותרות מ-Google News{insight ? `, והסיכום נכתב על ידי ${insight.model} ב-${dateHe(insight.generatedAt)} מתוך הכותרות והנתונים האלה בלבד` : ''}. זה כלי לקבלת החלטות, לא ייעוץ השקעות.
                </p>
            </div>
        </>
    );
}
