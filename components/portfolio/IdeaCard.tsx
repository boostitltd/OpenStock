import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";
import type { IdeaRow } from "@/lib/server/ideas";
import { CALL_LABEL, type Call, type Line } from "@/lib/decision";
import { changeWords, price, signedPct } from "@/lib/format";
import { hebrewName } from "@/lib/universe";

export const CALL_CLS: Record<Call, string> = { buy: 'is-up', hold: 'is-up', good: 'is-brand', no: '', base: 'is-brand' };

export const toneClass = (l: Line | null) => (!l ? 'text-faint' : l.tone === 'good' ? 'text-up' : l.tone === 'bad' ? 'text-down' : 'text-foreground');

export const RANK_FROM_HE: Record<string, string> = { '1-5': 'במקומות 1 עד 5', '6-15': 'במקומות 6 עד 15', '16+': 'ממקום 16 ומטה' };

function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1 border-t border-line pt-2.5">
            <p className="kicker">{title}</p>
            {children}
        </div>
    );
}

// One stock, one answer: the method's call first, then how much it might make, the business, and the fit.
// Warnings are shown as information, never as a second verdict.
export default function IdeaCard({ idea }: { idea: IdeaRow }) {
    const e = idea.estimate;
    return (
        <section className="flex flex-col gap-3 rounded-[12px] bg-page/60 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-foreground">{idea.entry.he}</p>
                    <p className="text-[12px] text-faint"><span dir="ltr" className="mono">{idea.symbol}</span> · {idea.entry.sector}{idea.price != null ? ` · ${price(idea.price, idea.currency)}` : ''}</p>
                </div>
                <span className={`pill shrink-0 ${CALL_CLS[idea.call]}`}>{CALL_LABEL[idea.call]}</span>
            </div>
            <p className="text-[13.5px] leading-snug text-foreground">{idea.callText}</p>
            {idea.about && <p className="text-[13px] leading-snug text-muted-foreground">{idea.about}</p>}
            {idea.similarTo && idea.call === 'base' && <p className="text-[12.5px] text-faint">דומה מאוד ל{hebrewName(idea.similarTo)}: מספיקה אחת מהשתיים.</p>}

            <Block title="כמה אפשר להרוויח בשנה">
                <p className="flex items-baseline gap-2">
                    <span dir="ltr" className={`num text-[24px] font-bold ${e.systemPct >= 0 ? 'text-up' : 'text-down'}`}>{signedPct(e.systemPct)}</span>
                    <span className="text-[12.5px] text-faint">{e.basis === 'rank' ? 'בשנה רגילה' : 'הערכת המערכת'}</span>
                </p>
                {e.rangeLowPct !== null && e.rangeHighPct !== null && (
                    <p className="text-[13px] text-muted-foreground">בשנה רעה <span dir="ltr" className="num text-down">{signedPct(e.rangeLowPct)}</span>, בשנה טובה <span dir="ltr" className="num text-up">{signedPct(e.rangeHighPct)}</span></p>
                )}
                <p className="text-[12px] leading-snug text-faint">
                    {e.basis === 'rank'
                        ? `לפי מה שקרה בעבר למניות ${RANK_FROM_HE[e.rankFrom ?? '16+']} בדירוג, בשנה שאחרי. ${e.upPct}% מהן עלו.`
                        : e.analysts === 0 ? 'אין אנליסטים שמכסים אותה, אז זו הערכת ממוצע השוק' : `${e.analysts} אנליסטים צופים ${changeWords(e.analystUpsidePct ?? 0)}`}
                </p>
            </Block>

            <Block title="העסק">
                <p className={`text-[13.5px] ${toneClass(idea.businessHeadline)}`}>{idea.businessHeadline?.text ?? (idea.entry.kind === 'index' ? 'קרן על מדד: מאות חברות, אז אין דוח של חברה אחת לבדוק' : 'אין נתונים עסקיים ב-Yahoo')}</p>
            </Block>

            <Block title="מה היא עושה לתיק שלך">
                <p className={`text-[13.5px] leading-snug ${toneClass(idea.fit[0] ?? null)}`}>{idea.fit[0]?.text ?? '—'}</p>
            </Block>

            {idea.cautions.length > 0 && (
                <div className="flex flex-col gap-1 rounded-[10px] bg-brand-soft/30 px-3 py-2">
                    <p className="kicker flex items-center gap-1.5 text-brand-ink"><CircleAlert className="size-3.5" /> שימו לב</p>
                    {idea.cautions.map((c) => <p key={c} className="text-[12.5px] leading-snug text-muted-foreground">{c}</p>)}
                </div>
            )}

            <Link href={`/portfolio/ideas/${encodeURIComponent(idea.symbol)}`} className="btn btn-ghost self-start">כל מה שצריך כדי להחליט <ArrowLeft /></Link>
        </section>
    );
}
