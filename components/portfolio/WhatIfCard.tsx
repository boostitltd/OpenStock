"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import SymbolPicker from "@/components/portfolio/SymbolPicker";
import type { WhatIf } from "@/lib/server/outlook";
import type { Currency } from "@/lib/portfolio";
import { money, pct } from "@/lib/format";
import { formatPrice } from "@/lib/utils";
import { hebrewName } from "@/lib/universe";

const delta = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : Math.round((b - a) * 10) / 10);

const ERRORS: Record<string, string> = {
    'Invalid symbol': 'הסימול לא תקין',
    'Weight must be between 0 and 100': 'המשקל צריך להיות בין 0 ל-100',
    'Not enough price history for this symbol': 'אין מספיק היסטוריית מחירים למניה הזו',
};

function Compare({ label, before, after, betterWhen }: { label: string; before: number | null | undefined; after: number | null | undefined; betterWhen: 'higher' | 'lower' | 'closer-to-zero' }) {
    const d = delta(before, after);
    const better = d == null ? null : betterWhen === 'higher' ? d > 0 : betterWhen === 'lower' ? d < 0 : (after ?? 0) > (before ?? 0);
    return (
        <tr>
            <td className="text-faint">{label}</td>
            <td className="is-num text-muted-foreground">{pct(before)}</td>
            <td className="is-num font-semibold text-foreground">{pct(after)}</td>
            <td className={`is-num ${better == null ? 'text-faint' : better ? 'text-up' : 'text-down'}`}>{d == null ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(1)}`}</td>
        </tr>
    );
}

export default function WhatIfCard({ whatIf, base, hasHoldings, initialSymbol, initialPct }: { whatIf: WhatIf | null; base: Currency; hasHoldings: boolean; initialSymbol: string; initialPct: string }) {
    const router = useRouter();
    const [symbol, setSymbol] = useState(initialSymbol);
    const [weight, setWeight] = useState(initialPct);
    const [busy, setBusy] = useState(false);

    const run = (e: React.FormEvent) => {
        e.preventDefault();
        if (!symbol.trim()) return;
        setBusy(true);
        router.push(`/portfolio/outlook?add=${encodeURIComponent(symbol.trim().toUpperCase())}&pct=${encodeURIComponent(weight || '10')}`);
    };

    const field = "flex h-11 items-center gap-2 rounded-[11px] border border-line bg-page px-3 focus-within:border-brand";
    const input = "num w-full bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-faint";
    const name = whatIf ? hebrewName(whatIf.symbol) : '';

    return (
        <div className="flex flex-col gap-4 p-4">
            <form onSubmit={run} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                <label className="flex flex-col gap-1.5">
                    <span className="form-label">מועמדת</span>
                    <span className={field}><SymbolPicker value={symbol} onChange={setSymbol} placeholder="שם החברה או סימול" className="min-w-0 flex-1" inputClassName={input} /></span>
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="form-label">משקל</span>
                    <span className={field}><input type="number" inputMode="decimal" min="1" max="99" step="1" value={weight} onChange={(e) => setWeight(e.target.value)} className={input} /><span className="text-xs text-faint">%</span></span>
                </label>
                <button type="submit" disabled={busy || !symbol.trim()} className="btn btn-primary h-11"><FlaskConical /> {busy ? 'מחשבים' : 'לבדוק'}</button>
            </form>

            {whatIf?.error && <p className="text-[13px] text-down">{ERRORS[whatIf.error] ?? whatIf.error}</p>}

            {whatIf && !whatIf.error && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-[15px] font-semibold text-foreground">{name}</span>
                        {name !== whatIf.symbol && <span dir="ltr" className="mono text-[13px] text-faint">{whatIf.symbol}</span>}
                        <span className="num text-[13px] text-muted-foreground">{whatIf.price ? formatPrice(whatIf.price, whatIf.currency) : ''}</span>
                        {whatIf.stats && <span className="text-[13px] text-faint">בשלוש השנים האחרונות: <span dir="ltr">{pct(whatIf.stats.annualReturnPct)}</span> בשנה, תנודתיות {pct(whatIf.stats.annualVolPct, false)}, נפילה גרועה של {Math.abs(whatIf.stats.maxDrawdownPct).toFixed(1)}%</span>}
                        {whatIf.fundamentals?.targetMeanPrice && <span className="text-[13px] text-faint">אנליסטים: {formatPrice(whatIf.fundamentals.targetMeanPrice, whatIf.currency)} ({whatIf.fundamentals.analysts})</span>}
                    </div>

                    {whatIf.correlationWithPortfolio != null && (
                        <p className="text-[13px] text-muted-foreground">
                            המתאם שלה עם התיק הנוכחי הוא <span className="num font-semibold text-foreground">{whatIf.correlationWithPortfolio.toFixed(2)}</span>
                            {whatIf.correlationWithPortfolio >= 0.7 ? ': בעיקר אותו הימור, כמעט בלי פיזור.' : whatIf.correlationWithPortfolio >= 0.4 ? ': קשורה, פיזור חלקי.' : ': זזה בעיקר לבד, פיזור אמיתי.'}
                        </p>
                    )}

                    {hasHoldings && (
                        <div className="overflow-x-auto rounded-[12px]">
                            <table className="data-table">
                                <thead>
                                    <tr><th>עם {whatIf.weightPct}% ב{name}</th><th className="is-num">עכשיו</th><th className="is-num">אחרי</th><th className="is-num">שינוי</th></tr>
                                </thead>
                                <tbody>
                                    <Compare label="תשואה בעבר, לשנה" before={whatIf.before?.annualReturnPct} after={whatIf.after?.annualReturnPct} betterWhen="higher" />
                                    <Compare label="תנודתיות" before={whatIf.before?.annualVolPct} after={whatIf.after?.annualVolPct} betterWhen="lower" />
                                    <Compare label="הנפילה הגרועה" before={whatIf.before?.maxDrawdownPct} after={whatIf.after?.maxDrawdownPct} betterWhen="closer-to-zero" />
                                </tbody>
                            </table>
                        </div>
                    )}

                    {(whatIf.sim3yAfter || whatIf.sim3yBefore) && (
                        <div className="overflow-x-auto rounded-[12px]">
                            <table className="data-table">
                                <thead>
                                    <tr><th>3 שנים, בסימולציה</th><th className="is-num">תרחיש רע (10%)</th><th className="is-num">אמצע</th><th className="is-num">תרחיש טוב (90%)</th><th className="is-num">סיכוי להפסד</th></tr>
                                </thead>
                                <tbody>
                                    {whatIf.sim3yBefore && (
                                        <tr><td className="text-faint">בלעדיה</td><td className="is-num text-down">{money(whatIf.sim3yBefore.p10, base)}</td><td className="is-num text-foreground">{money(whatIf.sim3yBefore.p50, base)}</td><td className="is-num text-up">{money(whatIf.sim3yBefore.p90, base)}</td><td className="is-num text-muted-foreground">{whatIf.sim3yBefore.probBelowContributed.toFixed(0)}%</td></tr>
                                    )}
                                    {whatIf.sim3yAfter && (
                                        <tr><td className="font-semibold text-foreground">איתה</td><td className="is-num text-down">{money(whatIf.sim3yAfter.p10, base)}</td><td className="is-num font-semibold text-foreground">{money(whatIf.sim3yAfter.p50, base)}</td><td className="is-num text-up">{money(whatIf.sim3yAfter.p90, base)}</td><td className="is-num text-muted-foreground">{whatIf.sim3yAfter.probBelowContributed.toFixed(0)}%</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {!whatIf && <p className="text-[12.5px] text-faint">בחרו מניה שאתם שוקלים. תקבלו את ההיסטוריה שלה, כמה היא זזה יחד עם מה שכבר יש לכם, ואת המספרים של התיק איתה ובלעדיה.</p>}
        </div>
    );
}
