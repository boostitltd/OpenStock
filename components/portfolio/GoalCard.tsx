"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { savePortfolioSettings } from "@/lib/actions/portfolio.actions";
import type { GoalResult } from "@/lib/forecast";

const ils = (v: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(v);

// "I want X by year Y": the chance of getting there as things stand, and the monthly amount that makes it likely.
export default function GoalCard({ goal, amount, date, monthly }: { goal: GoalResult | null; amount: number | null; date: string | null; monthly: number }) {
    const router = useRouter();
    const [a, setA] = useState(amount ? String(amount) : '');
    const [y, setY] = useState(date ? date.slice(0, 4) : String(new Date().getFullYear() + 10));
    const [busy, setBusy] = useState(false);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        const r = await savePortfolioSettings({ goalAmount: parseFloat(a), goalDate: `${y}-12-31` });
        setBusy(false);
        if (!r.ok) { toast.error(r.error); return; }
        toast.success('המטרה נשמרה');
        router.refresh();
    };

    const field = "flex h-11 items-center gap-2 rounded-[11px] border border-line bg-page px-3 focus-within:border-brand";
    const input = "num w-full bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-faint";

    return (
        <div className="flex flex-col gap-4 p-4">
            {goal && (
                <div className="flex flex-col gap-2">
                    <p className="text-[16px] text-foreground">
                        המטרה: <span className="font-semibold">{ils(goal.amount)}</span> עד סוף {goal.date.slice(0, 4)}.
                    </p>
                    <p className="text-[15px] text-foreground">
                        {monthly > 0 ? `עם ${ils(monthly)} בחודש, ` : 'בלי הפקדה חודשית, '}הסיכוי להגיע אליה הוא{' '}
                        <span className={`text-[20px] font-bold ${goal.chancePct >= 80 ? 'text-up' : goal.chancePct >= 50 ? 'text-brand-ink' : 'text-down'}`}>{goal.chancePct}%</span>.
                    </p>
                    {goal.requiredMonthly !== null && goal.chancePct < 80 && (
                        <p className="text-[14px] text-muted-foreground">כדי שהסיכוי יהיה 80%, צריך להשקיע בערך <span className="font-semibold text-foreground">{ils(goal.requiredMonthly)} בחודש</span>.</p>
                    )}
                    {goal.chancePct >= 80 && <p className="text-[14px] text-up">אתה בדרך. ממשיכים כך.</p>}
                    {goal.requiredMonthly === null && <p className="text-[14px] text-down">גם סכום חודשי גבוה מאוד לא מספיק עם התיק הנוכחי. כדאי להזיז את התאריך או להקטין את המטרה.</p>}
                    <p className="text-[12.5px] text-faint">בשנה רגילה, באמצע הטווח, התיק יגיע עד אז ל-{ils(goal.medianAtDate)}. החישוב לוקח את האופן שבו המניות שלך זזו בשלוש השנים האחרונות, ומניח ממוצע של שוק.</p>
                </div>
            )}
            <form onSubmit={save} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                <label className="flex flex-col gap-1.5">
                    <span className="form-label">כמה כסף אני רוצה</span>
                    <span className={field}><input type="number" min="1000" step="1000" value={a} onChange={(e) => setA(e.target.value)} placeholder="למשל 500000" className={input} required /><span className="text-xs text-faint">₪</span></span>
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="form-label">עד שנה</span>
                    <span className={field}><input type="number" min={new Date().getFullYear() + 1} max={new Date().getFullYear() + 50} value={y} onChange={(e) => setY(e.target.value)} className={input} required /></span>
                </label>
                <button type="submit" disabled={busy || !a} className="btn btn-primary h-11"><Target /> {busy ? 'מחשבים' : goal ? 'לעדכן' : 'לחשב'}</button>
            </form>
        </div>
    );
}
