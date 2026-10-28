import Link from "next/link";
import { Briefcase, CalendarCheck, Sigma, Telescope } from "lucide-react";
import Panel from "@/components/Panel";
import SendBriefButton from "@/components/portfolio/SendBriefButton";
import IdeaCard, { CALL_CLS } from "@/components/portfolio/IdeaCard";
import { getIdeas } from "@/lib/actions/ideas.actions";
import type { IdeaRow } from "@/lib/server/ideas";
import { CALL_LABEL } from "@/lib/decision";
import { dateHe, signedPct } from "@/lib/format";

export const metadata = { title: 'מה לקנות | OpenStock' };

function CompactTable({ ideas }: { ideas: IdeaRow[] }) {
    return (
        <div className="overflow-x-auto rounded-[14px]">
            <table className="data-table">
                <thead>
                    <tr><th>מקום</th><th>מניה</th><th>החלטה</th><th className="is-num">בשנה רגילה</th><th>למה</th><th /></tr>
                </thead>
                <tbody>
                    {ideas.map((i) => (
                        <tr key={i.symbol}>
                            <td className="text-faint">{i.rank ?? '—'}</td>
                            <td className="font-semibold text-foreground">{i.entry.he} <span className="block text-[12px] font-normal text-faint">{i.entry.sector}</span></td>
                            <td><span className={`pill ${CALL_CLS[i.call]}`}>{CALL_LABEL[i.call]}</span></td>
                            <td className={`is-num ${i.estimate.systemPct >= 0 ? 'text-up' : 'text-down'}`}><span dir="ltr">{signedPct(i.estimate.systemPct)}</span></td>
                            <td className="min-w-[320px] whitespace-normal text-[12.5px] leading-snug text-muted-foreground">{i.callText}</td>
                            <td><Link href={`/portfolio/ideas/${encodeURIComponent(i.symbol)}`} className="text-[12.5px] text-brand-ink hover:underline">פרטים</Link></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const byRank = (a: IdeaRow, b: IdeaRow) => (a.rank ?? 999) - (b.rank ?? 999);

// What to buy. One answer per stock, from the method that was tested on twenty years of prices; everything else on
// the card explains that answer and never contradicts it.
export default async function IdeasPage() {
    const r = await getIdeas();
    const stocks = r.ideas.filter((i) => i.entry.kind === 'stock').sort(byRank);
    const buys = stocks.filter((i) => i.call === 'buy');
    const held = stocks.filter((i) => i.held);
    const good = stocks.filter((i) => i.call === 'good');
    const no = stocks.filter((i) => i.call === 'no' && !i.held);
    const indexes = r.ideas.filter((i) => i.entry.kind === 'index');

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">מה לקנות</h1>
                    <p className="page-sub max-w-4xl">
                        תשובה אחת לכל מניה, לפי השיטה שנבדקה על 20 שנה: קונים את 5 המניות שעלו הכי הרבה בשנה האחרונה, אחת מכל ענף, ומוכרים רק כשמניה יוצאת מ-15 המובילות. בכל כרטיס: כמה אפשר להרוויח, איך העסק מתפקד, ומה היא עושה לתיק. אזהרות מופיעות תחת &quot;שימו לב&quot;, ולא משנות את ההחלטה.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio/strategy" className="btn btn-ghost"><Sigma /> השיטה</Link>
                    <Link href="/portfolio" className="btn btn-ghost"><Briefcase /> התיק</Link>
                    <Link href="/portfolio/buy-day" className="btn btn-ghost"><CalendarCheck /> יום קנייה</Link>
                    <Link href="/portfolio/outlook" className="btn btn-ghost"><Telescope /> תחזית</Link>
                </div>
            </header>

            <Panel title="לקנות החודש" sub="5 המניות שהשיטה קונה, לפי הסדר בדירוג" className="mb-3">
                {buys.length ? (
                    <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                        {buys.map((i) => <IdeaCard key={i.symbol} idea={i} />)}
                    </div>
                ) : <p className="px-4 py-6 text-[13.5px] text-faint">הדירוג עוד לא זמין. נסו שוב בעוד כמה דקות.</p>}
            </Panel>

            {held.length > 0 && (
                <Panel title="מה שכבר יש לך" sub="מה השיטה אומרת על המניות בתיק" className="mb-3">
                    <CompactTable ideas={held} />
                </Panel>
            )}

            <Panel title="בסיס לתיק: קרן על מדד רחב" sub="לא חלק מהדירוג. מאות חברות בקנייה אחת, לצד המניות" className="mb-3">
                <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                    {indexes.map((i) => <IdeaCard key={i.symbol} idea={i} />)}
                </div>
                <p className="px-4 pb-3 text-[12px] text-faint">
                    את אותו מדד אפשר לקנות כקרן סל אמריקאית או כקרן מחקה בבורסה בתל אביב. בקרן אמריקאית יש חשיפה למס עיזבון אמריקאי מעל 60 אלף דולר, ובקרן מחקה ישראלית אין. כדאי להשוות דמי ניהול בבנק או אצל הברוקר.
                </p>
            </Panel>

            {good.length > 0 && (
                <Panel title="טובות, לא החודש" sub="בין 15 המובילות: אם יש לך אותן, ממשיכים להחזיק. לא קונים אותן החודש" className="mb-3">
                    <CompactTable ideas={good} />
                </Panel>
            )}

            {no.length > 0 && (
                <Panel title="לא לפי השיטה" sub="מחוץ ל-15 המובילות" className="mb-3">
                    <CompactTable ideas={no} />
                </Panel>
            )}

            <Panel title="סיכום שבועי במייל" sub="כל יום ראשון בבוקר: מה השתנה בתחזית, מה קרה במניות שלך ומה לקנות">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <p className="text-[13px] text-muted-foreground">הסיכום יוצא אוטומטית. אפשר גם לשלוח אותו עכשיו.</p>
                    <SendBriefButton />
                </div>
            </Panel>

            <p className="mt-3 text-[12px] leading-relaxed text-faint">
                &quot;בשנה רגילה&quot;, &quot;שנה רעה&quot; ו&quot;שנה טובה&quot; למניה: מה שקרה בעבר, מ-2006, למניות שהיו באותו מקום בדירוג, ב-12 החודשים שאחרי. שנה רעה ושנה טובה קורות בערך פעם בעשר שנים. החישוב רץ על החברות ששרדו עד היום, ולכן המספרים אופטימיים. חושב ב-{dateHe(r.computedAt)} מנתוני Yahoo. זה כלי לקבלת החלטות, לא ייעוץ השקעות.
            </p>
        </>
    );
}
