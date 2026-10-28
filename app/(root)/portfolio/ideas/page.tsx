import Link from "next/link";
import { Briefcase, CalendarCheck, Lightbulb, Telescope } from "lucide-react";
import Panel from "@/components/Panel";
import SendBriefButton from "@/components/portfolio/SendBriefButton";
import IdeaCard from "@/components/portfolio/IdeaCard";
import { getIdeas } from "@/lib/actions/ideas.actions";
import type { IdeaRow } from "@/lib/server/ideas";
import { dateHe, signedPct } from "@/lib/format";

export const metadata = { title: 'מה לקנות | OpenStock' };

function CompactTable({ ideas, why }: { ideas: IdeaRow[]; why: (i: IdeaRow) => string }) {
    return (
        <div className="overflow-x-auto rounded-[14px]">
            <table className="data-table">
                <thead>
                    <tr><th>מניה</th><th>מה היא עושה</th><th className="is-num">הערכה לשנה</th><th>למה ברשימה הזו</th><th /></tr>
                </thead>
                <tbody>
                    {ideas.map((i) => (
                        <tr key={i.symbol}>
                            <td className="font-semibold text-foreground">{i.entry.he}</td>
                            <td className="max-w-[260px] truncate text-[12.5px] text-faint" title={i.about ?? ''}>{i.entry.sector}</td>
                            <td className={`is-num ${i.estimate.systemPct >= 0 ? 'text-up' : 'text-down'}`}>{signedPct(i.estimate.systemPct)}</td>
                            <td className="min-w-[280px] whitespace-normal text-[12.5px] leading-snug text-muted-foreground">{why(i)}</td>
                            <td><Link href={`/portfolio/ideas/${encodeURIComponent(i.symbol)}`} className="text-[12.5px] text-brand-ink hover:underline">פרטים</Link></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const firstOf = (i: IdeaRow, starts: string[]) => i.reasons.find((r) => starts.some((s) => r.startsWith(s))) ?? i.reasons[0] ?? '';

// What to buy next. Each card answers: how much might it make, how is the business, what does it do for my portfolio.
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
                        לכל מניה שלוש תשובות: כמה אפשר להרוויח בשנה, איך העסק עצמו מתפקד, ומה היא עושה לתיק שלך. בכפתור &quot;כל מה שצריך כדי להחליט&quot; יש את כל הפרטים, כולל מה קורה בחברה עכשיו.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio" className="btn btn-ghost"><Briefcase /> התיק</Link>
                    <Link href="/portfolio/buy-day" className="btn btn-ghost"><CalendarCheck /> יום קנייה</Link>
                    <Link href="/portfolio/outlook" className="btn btn-ghost"><Telescope /> תחזית</Link>
                </div>
            </header>

            <Link href="/portfolio/strategy" className="mb-3 flex items-center justify-between gap-3 rounded-[12px] bg-brand-soft/40 px-4 py-3 shadow-[inset_0_0_0_1px_oklch(0.8_0.13_176/0.25)] hover:bg-brand-soft/60">
                <span className="text-[14px] text-foreground"><span className="font-semibold">רוצה כלל שנבדק על 20 שנה?</span> בעמוד השיטה: מה לקנות ומה למכור החודש, ומה זה היה עושה בעבר.</span>
                <span className="shrink-0 text-[13px] font-semibold text-brand-ink">לשיטה</span>
            </Link>

            {r.held.length === 0 && (
                <Panel title="עוד אין מניות בתיק" className="mb-3">
                    <div className="empty-state">
                        <span className="empty-icon"><Lightbulb className="size-5" /></span>
                        <h3>הדירוג עובד הכי טוב מול תיק קיים</h3>
                        <p className="max-w-sm">רשמו קנייה בעמוד התיק, וכל מועמדת תימדד מול מה שכבר יש לכם.</p>
                    </div>
                </Panel>
            )}

            <Panel title="הבסיס: קרן על מדד רחב" sub="מאות חברות בקנייה אחת. זה מה שהכי מאזן תיק של מניה אחת או שתיים." className="mb-3">
                <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                    {indexes.map((i) => <IdeaCard key={i.symbol} idea={i} />)}
                </div>
                <p className="px-4 pb-3 text-[12px] text-faint">
                    את אותו מדד אפשר לקנות כקרן סל אמריקאית או כקרן מחקה בבורסה בתל אביב. בקרן אמריקאית יש חשיפה למס עיזבון אמריקאי מעל 60 אלף דולר, ובקרן מחקה ישראלית אין. כדאי להשוות דמי ניהול בבנק או אצל הברוקר.
                </p>
            </Panel>

            <Panel title="מניות בתל אביב שמתאימות לתיק" sub="מאזנות את התיק, ואין בהן סימן אזהרה כרגע" className="mb-3">
                {topStocks.length ? (
                    <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                        {topStocks.map((i) => <IdeaCard key={i.symbol} idea={i} />)}
                    </div>
                ) : <p className="px-4 py-6 text-[13.5px] text-faint">אף מניה לא עוברת את כל הבדיקות כרגע.</p>}
            </Panel>

            {wait.length > 0 && (
                <Panel title="לחכות איתן" sub="היו יכולות להתאים, אבל המחיר יורד עכשיו, יקר מאוד, או שהמניה קופצת חזק מדי" className="mb-3">
                    <CompactTable ideas={wait} why={(i) => firstOf(i, ['המחיר בירידה', 'יקרה', 'קופצת'])} />
                </Panel>
            )}

            {same.length > 0 && (
                <Panel title="לא להוסיף: אותו הימור" sub="זזות כמעט כמו מה שכבר יש לך, אז הן מגדילות את הסיכון במקום לאזן אותו" className="mb-3">
                    <CompactTable ideas={same} why={(i) => i.reasons[0] ?? ''} />
                </Panel>
            )}

            {rest.length > 0 && (
                <Panel title="שאר המועמדות" sub="עוברות את הבדיקות, אבל מאזנות את התיק פחות מהרשימה שלמעלה" className="mb-3">
                    <CompactTable ideas={rest} why={(i) => i.fit[0]?.text ?? ''} />
                </Panel>
            )}

            <Panel title="סיכום שבועי במייל" sub="כל יום ראשון בבוקר: מה השתנה בתחזית, מה קרה במניות שלך ומה לקנות">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <p className="text-[13px] text-muted-foreground">הסיכום יוצא אוטומטית. אפשר גם לשלוח אותו עכשיו.</p>
                    <SendBriefButton />
                </div>
            </Panel>

            <p className="mt-3 text-[12px] leading-relaxed text-faint">
                איך מחושבת ההערכה לשנה: מתחילים מהתשואה הממוצעת של שוק המניות, 7% בשנה, ומזיזים אותה לכיוון הצפי של האנליסטים לפי כמה אנליסטים יש. אנליסט אחד מזיז אותה שישית מהדרך, חמישה מזיזים אותה חצי. &quot;שנה רעה&quot; ו&quot;שנה טובה&quot; הן אחת מכל עשר שנים, לפי איך שהמניה זזה בשלוש השנים האחרונות. חושב ב-{dateHe(r.computedAt)} מנתוני Yahoo. זה כלי לקבלת החלטות, לא ייעוץ השקעות.
            </p>
        </>
    );
}
