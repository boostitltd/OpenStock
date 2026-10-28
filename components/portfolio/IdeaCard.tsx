import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { IdeaRow } from "@/lib/server/ideas";
import type { Line } from "@/lib/decision";
import { changeWords, price, signedPct } from "@/lib/format";
import { hebrewName } from "@/lib/universe";

export const VERDICT = {
    buy: { label: 'מתאימה לקנייה', cls: 'is-up' },
    wait: { label: 'לחכות', cls: 'is-brand' },
    weak: { label: 'תורמת מעט', cls: '' },
    same: { label: 'אותו הימור', cls: 'is-down' },
} as const;

export const toneClass = (l: Line | null) => (!l ? 'text-faint' : l.tone === 'good' ? 'text-up' : l.tone === 'bad' ? 'text-down' : 'text-foreground');

function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1 border-t border-line pt-2.5">
            <p className="kicker">{title}</p>
            {children}
        </div>
    );
}

// One candidate, answering three questions in plain words: how much might it make, how is the business doing,
// and what does it do for my portfolio. The full case is one click away.
export default function IdeaCard({ idea }: { idea: IdeaRow }) {
    const v = VERDICT[idea.verdict];
    const e = idea.estimate;
    return (
        <section className="flex flex-col gap-3 rounded-[12px] bg-page/60 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-foreground">{idea.entry.he}</p>
                    <p className="text-[12px] text-faint"><span dir="ltr" className="mono">{idea.symbol}</span> · {idea.entry.sector}{idea.price != null ? ` · ${price(idea.price, idea.currency)}` : ''}</p>
                </div>
                <span className={`pill shrink-0 ${v.cls}`}>{v.label}</span>
            </div>
            {idea.about && <p className="text-[13px] leading-snug text-muted-foreground">{idea.about}</p>}
            {idea.similarTo && <p className="text-[12.5px] text-faint">דומה מאוד ל{hebrewName(idea.similarTo)}: מספיקה אחת מהשתיים.</p>}

            <Block title="כמה אפשר להרוויח בשנה">
                <p className="flex items-baseline gap-2">
                    <span dir="ltr" className={`num text-[24px] font-bold ${e.systemPct >= 0 ? 'text-up' : 'text-down'}`}>{signedPct(e.systemPct)}</span>
                    <span className="text-[12.5px] text-faint">הערכת המערכת</span>
                </p>
                {e.rangeLowPct !== null && e.rangeHighPct !== null && (
                    <p className="text-[13px] text-muted-foreground">בשנה רעה <span dir="ltr" className="num text-down">{signedPct(e.rangeLowPct)}</span>, בשנה טובה <span dir="ltr" className="num text-up">{signedPct(e.rangeHighPct)}</span></p>
                )}
                <p className="text-[12px] text-faint">
                    {e.analysts === 0 ? 'אין אנליסטים שמכסים אותה, אז זו הערכת ממוצע השוק' : e.analysts < 3 ? `${e.analysts === 1 ? 'אנליסט אחד' : `${e.analysts} אנליסטים`} בלבד, אז הצפי שלהם מקבל משקל קטן` : `${e.analysts} אנליסטים צופים ${changeWords(e.analystUpsidePct ?? 0)}`}{e.dividendPct >= 1 ? ` · כולל דיבידנד ${e.dividendPct.toFixed(1)}%` : ''}
                </p>
            </Block>

            <Block title="העסק">
                <p className={`text-[13.5px] ${toneClass(idea.businessHeadline)}`}>{idea.businessHeadline?.text ?? (idea.entry.kind === 'index' ? 'קרן על מדד: מאות חברות, אז אין דוח של חברה אחת לבדוק' : 'אין נתונים עסקיים ב-Yahoo')}</p>
            </Block>

            <Block title="מה היא עושה לתיק שלך">
                <p className={`text-[13.5px] leading-snug ${toneClass(idea.fit[0] ?? null)}`}>{idea.fit[0]?.text ?? '—'}</p>
                {idea.verdict === 'wait' && <p className="text-[13px] leading-snug text-brand-ink">{idea.reasons.find((r) => r.startsWith('המחיר בירידה') || r.startsWith('יקרה') || r.startsWith('קופצת'))}</p>}
            </Block>

            <Link href={`/portfolio/ideas/${encodeURIComponent(idea.symbol)}`} className="btn btn-ghost self-start">כל מה שצריך כדי להחליט <ArrowLeft /></Link>
        </section>
    );
}
