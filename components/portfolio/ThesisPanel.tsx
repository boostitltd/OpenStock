import { CheckCircle2, CircleAlert, CircleHelp, CircleMinus, XCircle } from "lucide-react";
import { getThesisChecks } from "@/lib/actions/ideas.actions";
import { STATUS_HE, type ThesisCheck } from "@/lib/server/thesis";
import { dateHe } from "@/lib/format";
import AdoptThesisButton from "@/components/portfolio/AdoptThesisButton";

const STATUS_CLS: Record<ThesisCheck['status'], string> = { intact: 'is-up', weakened: 'is-brand', broken: 'is-down', unclear: '' };
const PART_ICON = {
    holds: { Icon: CheckCircle2, cls: 'text-up', label: 'מחזיק' },
    weaker: { Icon: CircleAlert, cls: 'text-brand-ink', label: 'נחלש' },
    broken: { Icon: XCircle, cls: 'text-down', label: 'נשבר' },
    unknown: { Icon: CircleHelp, cls: 'text-faint', label: 'אין מידע' },
} as const;

// Server component, streamed: the model runs at most once a day per holding, so the page itself never waits on it.
export default async function ThesisPanel() {
    const checks = await getThesisChecks().catch(() => [] as ThesisCheck[]);
    if (!checks.length) return <p className="px-4 py-6 text-[13.5px] text-faint">כשתרשום קנייה עם סיבה, המערכת תבדוק כאן אם הסיבה עדיין נכונה.</p>;
    return (
        <div className="grid gap-3 p-3 xl:grid-cols-2">
            {checks.map((c) => (
                <section key={c.symbol} className="flex flex-col gap-3 rounded-[12px] bg-page/60 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-semibold text-foreground">{c.name}</p>
                            <p className="text-[12.5px] text-faint">הסיבה שכתבת: &quot;{c.thesis}&quot;</p>
                        </div>
                        <span className={`pill shrink-0 ${STATUS_CLS[c.status]}`}>{STATUS_HE[c.status]}</span>
                    </div>
                    <p className="text-[14.5px] leading-snug text-foreground">{c.headline}</p>
                    {c.parts.length > 0 && (
                        <ul className="flex flex-col gap-1.5">
                            {c.parts.map((p) => {
                                const v = PART_ICON[p.verdict];
                                return (
                                    <li key={p.part} className="flex items-start gap-2 text-[13.5px] leading-snug">
                                        <v.Icon className={`mt-0.5 size-4 flex-none ${v.cls}`} />
                                        <span><span className="font-semibold text-foreground">{p.part}</span> <span className={`text-[12px] ${v.cls}`}>({v.label})</span>: <span className="text-muted-foreground">{p.evidence}</span></span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {c.against.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <p className="kicker text-down">מה הולך נגד</p>
                            {c.against.map((a) => <p key={a} className="flex items-start gap-2 text-[13px] text-muted-foreground"><CircleMinus className="mt-0.5 size-3.5 flex-none text-down" />{a}</p>)}
                        </div>
                    )}
                    {c.watch && <p className="rounded-[10px] bg-brand-soft/40 px-3 py-2 text-[13px] text-foreground"><span className="font-semibold">מה לבדוק: </span>{c.watch}</p>}
                    {c.rewrite && (
                        <div className="flex flex-col gap-2 rounded-[10px] px-3 py-2 shadow-[inset_0_0_0_1px_var(--line)]">
                            <p className="text-[13px] text-muted-foreground">הסיבה כללית מדי לבדיקה. ניסוח שאפשר לבדוק:</p>
                            <p className="text-[13.5px] font-semibold text-foreground">&quot;{c.rewrite}&quot;</p>
                            <AdoptThesisButton symbol={c.symbol} thesis={c.rewrite} />
                        </div>
                    )}
                    <p className="text-[11.5px] text-faint">נבדק ב-{dateHe(c.generatedAt)} מול הנתונים העסקיים ו-{c.headlines.length} כותרות מהחודשיים האחרונים.</p>
                </section>
            ))}
        </div>
    );
}

export function ThesisSkeleton() {
    return <div className="grid gap-3 p-3 xl:grid-cols-2" aria-busy="true"><div className="h-48 animate-pulse rounded-[12px] bg-hover/60" /></div>;
}
