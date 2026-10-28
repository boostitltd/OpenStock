import Link from "next/link";
import { Briefcase, CalendarCheck, FlaskConical, Lightbulb, Telescope } from "lucide-react";
import Panel from "@/components/Panel";
import SendBriefButton from "@/components/portfolio/SendBriefButton";
import { getIdeas } from "@/lib/actions/ideas.actions";
import type { IdeaRow } from "@/lib/server/ideas";
import { dateHe, pct, price } from "@/lib/format";
import { hebrewName } from "@/lib/universe";

export const metadata = { title: 'מה לקנות | OpenStock' };

const VERDICT = {
    buy: { label: 'מתאימה לקנייה', cls: 'is-up' },
    wait: { label: 'לחכות', cls: 'is-brand' },
    weak: { label: 'תורמת מעט', cls: '' },
    same: { label: 'אותו הימור', cls: 'is-down' },
} as const;

function Metric({ label, before, after }: { label: string; before: number | null; after: number | null }) {
    if (before == null || after == null) return null;
    const better = Math.abs(after) < Math.abs(before);
    return (
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-faint">{label}</span>
            <span className="num">
                <span className="text-muted-foreground">מ-{Math.abs(before).toFixed(0)}%</span>
                <span className="mx-1 text-faint">ל-</span>
                <span className={better ? 'font-semibold text-up' : 'font-semibold text-down'}>{Math.abs(after).toFixed(0)}%</span>
            </span>
        </div>
    );
}

function IdeaCard({ idea, weightPct }: { idea: IdeaRow; weightPct: number }) {
    const v = VERDICT[idea.verdict];
    return (
        <section className="flex flex-col gap-3 rounded-[12px] bg-page/60 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{idea.entry.he}</p>
                    <p className="text-[12px] text-faint"><span className="mono" dir="ltr">{idea.symbol}</span> · {idea.entry.sector}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`pill ${v.cls}`}>{v.label}</span>
                    {idea.price != null && <span className="num text-[13px] text-muted-foreground">{price(idea.price, idea.currency)}</span>}
                </div>
            </div>
            {idea.similarTo && <p className="text-[12.5px] text-faint">זזה כמעט כמו {hebrewName(idea.similarTo)}: מספיקה אחת מהשתיים.</p>}
            <ul className="flex list-disc flex-col gap-1 ps-4 text-[13px] leading-snug text-muted-foreground">
                {idea.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}
            </ul>
            <div className="flex flex-col gap-1 border-t border-line pt-2">
                <p className="kicker">התיק עם {weightPct}% בה</p>
                <Metric label="תנודתיות בשנה" before={idea.volBefore} after={idea.volAfter} />
                <Metric label="הנפילה הגרועה" before={idea.drawdownBefore} after={idea.drawdownAfter} />
                <Metric label="סיכוי להפסד ב-3 שנים" before={idea.probLossBefore} after={idea.probLossAfter} />
            </div>
            <Link href={`/portfolio/outlook?add=${encodeURIComponent(idea.symbol)}&pct=${weightPct}`} className="btn btn-ghost self-start"><FlaskConical /> לבדוק בסימולציה</Link>
        </section>
    );
}

function CompactTable({ ideas }: { ideas: IdeaRow[] }) {
    return (
        <div className="overflow-x-auto rounded-[14px]">
            <table className="data-table">
                <thead>
                    <tr><th>מניה</th><th>ענף</th><th className="is-num">מתאם לתיק</th><th className="is-num">תנודתיות שלה</th><th className="is-num">מול ממוצע 200</th><th>למה</th></tr>
                </thead>
                <tbody>
                    {ideas.map((i) => (
                        <tr key={i.symbol}>
                            <td className="font-semibold text-foreground">{i.entry.he} <span className="mono text-[11.5px] font-normal text-faint" dir="ltr">{i.symbol}</span></td>
                            <td className="text-faint">{i.entry.sector}</td>
                            <td className="is-num">{i.correlation?.toFixed(2) ?? '—'}</td>
                            <td className="is-num">{pct(i.stats?.annualVolPct, false, 0)}</td>
                            <td className={`is-num ${(i.stats?.vsMa200Pct ?? 0) < 0 ? 'text-down' : 'text-up'}`}><span dir="ltr">{pct(i.stats?.vsMa200Pct, true, 0)}</span></td>
                            <td className="text-[12.5px] text-muted-foreground">{i.reasons.filter((r) => !r.startsWith('מורידה') && !r.startsWith('הנפילה')).slice(0, 2).join(' · ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// What to buy next, measured by what each candidate does to this portfolio. Not a forecast of which stock rises.
export default async function IdeasPage() {
    const r = await getIdeas();
    const indexes = r.ideas.filter((i) => i.entry.kind === 'index');
    const stocks = r.ideas.filter((i) => i.entry.kind === 'stock');
    const topStocks = stocks.filter((i) => i.verdict === 'buy' && !i.similarTo).slice(0, 6);
    const wait = stocks.filter((i) => i.verdict === 'wait');
    const same = stocks.filter((i) => i.verdict === 'same');
    const rest = stocks.filter((i) => (i.verdict === 'buy' && !topStocks.includes(i)) || i.verdict === 'weak');

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">מה לקנות</h1>
                    <p className="page-sub">
                        אף מודל לא יודע איזו מניה תעלה, ולכן הדירוג לא מנחש את זה. כל מועמדת נבדקת לפי מה שהיא עושה לתיק שלך: בכמה היא מורידה את התנודתיות ואת הנפילה הגרועה, וכמה היא קשורה למה שכבר יש לך. מניה שיורדת עכשיו, יקרה מאוד או תנודתית מאוד מסומנת &quot;לחכות&quot;.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio" className="btn btn-ghost"><Briefcase /> התיק</Link>
                    <Link href="/portfolio/buy-day" className="btn btn-ghost"><CalendarCheck /> יום קנייה</Link>
                    <Link href="/portfolio/outlook" className="btn btn-ghost"><Telescope /> תחזית</Link>
                </div>
            </header>

            {r.held.length === 0 && (
                <Panel title="עוד אין מניות בתיק" className="mb-3">
                    <div className="empty-state">
                        <span className="empty-icon"><Lightbulb className="size-5" /></span>
                        <h3>הדירוג עובד הכי טוב מול תיק קיים</h3>
                        <p className="max-w-sm">בלי מניות בתיק, המועמדות מדורגות לפי התנודתיות שלהן בלבד. רשמו קנייה בעמוד התיק, והדירוג יימדד מולה.</p>
                    </div>
                </Panel>
            )}

            <Panel title="הבסיס: מדד רחב" sub={`מאות חברות בקנייה אחת. כל מדד נבדק כאילו הוא ${r.weightPct}% מהתיק.`} className="mb-3">
                <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                    {indexes.map((i) => <IdeaCard key={i.symbol} idea={i} weightPct={r.weightPct} />)}
                </div>
                <p className="px-4 pb-3 text-[12px] text-faint">
                    את אותו מדד אפשר לקנות כקרן סל אמריקאית או כקרן מחקה בבורסה בתל אביב. קרן אמריקאית חשופה למס עיזבון אמריקאי מעל 60 אלף דולר, וקרן מחקה ישראלית לא. כדאי להשוות דמי ניהול בבנק או אצל הברוקר.
                </p>
            </Panel>

            <Panel title="מניות בתל אביב שמתאימות לתיק" sub="הכי מורידות את הסיכון של התיק, בלי סימני אזהרה" className="mb-3">
                {topStocks.length ? (
                    <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                        {topStocks.map((i) => <IdeaCard key={i.symbol} idea={i} weightPct={r.weightPct} />)}
                    </div>
                ) : <p className="px-4 py-6 text-[13.5px] text-faint">אף מניה לא עוברת את כל הבדיקות כרגע.</p>}
            </Panel>

            {wait.length > 0 && (
                <Panel title="לחכות איתן" sub="מתאימות לתיק, אבל המחיר יורד, המכפיל גבוה או שהתנודתיות חריגה" className="mb-3">
                    <CompactTable ideas={wait} />
                </Panel>
            )}

            {same.length > 0 && (
                <Panel title="לא להוסיף: אותו הימור" sub="זזות כמעט כמו מה שכבר יש לך, אז הן מגדילות את הסיכון במקום לפזר אותו" className="mb-3">
                    <CompactTable ideas={same} />
                </Panel>
            )}

            {rest.length > 0 && (
                <Panel title="שאר המועמדות" sub="עוברות את הבדיקות, אבל תורמות פחות מהרשימה שלמעלה" className="mb-3">
                    <CompactTable ideas={rest} />
                </Panel>
            )}

            <Panel title="סיכום שבועי במייל" sub="כל יום ראשון בבוקר: מה השתנה בתחזית, מה קרה במניות שלך ומה לקנות">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <p className="text-[13px] text-muted-foreground">הסיכום יוצא אוטומטית. אפשר גם לשלוח אותו עכשיו, כדי לראות איך הוא נראה.</p>
                    <SendBriefButton />
                </div>
            </Panel>

            <p className="mt-3 text-[12px] text-faint">
                חושב ב-{dateHe(r.computedAt)} מנתוני Yahoo, שלוש שנות מחירים לכל מניה. כל המניות מניחות אותה תשואה ממוצעת, ולכן הדירוג משווה סיכון ולא רווח צפוי. זה כלי לקבלת החלטות, לא ייעוץ השקעות.
            </p>
        </>
    );
}
