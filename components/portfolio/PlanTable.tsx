import { formatPrice } from "@/lib/utils";
import type { BuyDayPlan } from "@/lib/portfolio";

import { money } from "@/lib/format";
import { hebrewName } from "@/lib/universe";

const ACTION: Record<BuyDayPlan['rows'][number]['action'], { label: string; className: string }> = {
    BUY: { label: 'לקנות', className: 'pill is-up' },
    SELL: { label: 'למכור', className: 'pill is-down' },
    HOLD: { label: 'להחזיק', className: 'pill' },
};

export default function PlanTable({ plan }: { plan: BuyDayPlan }) {
    if (plan.rows.length === 0) {
        return <p className="px-4 py-8 text-center text-[13.5px] text-faint">קבעו משקלי יעד וסכום חודשי, ותקבלו תוכנית.</p>;
    }
    return (
        <div className="overflow-x-auto rounded-[14px]">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>מניה</th>
                        <th>פעולה</th>
                        <th className="is-num">כמות</th>
                        <th className="is-num">סכום</th>
                        <th className="is-num">עכשיו</th>
                        <th className="is-num">אחרי</th>
                        <th className="is-num">יעד</th>
                        <th>למה</th>
                    </tr>
                </thead>
                <tbody>
                    {plan.rows.map((r) => {
                        const a = ACTION[r.action];
                        return (
                            <tr key={r.symbol}>
                                <td>
                                    <span className="block font-semibold text-foreground">{hebrewName(r.symbol, r.name)} <span dir="ltr" className="mono text-[11.5px] font-normal text-faint">{r.symbol}</span></span>
                                    <span className="block text-[12px] text-faint">{r.price ? formatPrice(r.price, r.currency) : 'אין מחיר'}</span>
                                </td>
                                <td><span className={a.className}>{a.label}</span></td>
                                <td className="is-num font-semibold text-foreground">{r.shares || '—'}</td>
                                <td className="is-num text-foreground">{r.amountBase ? money(r.amountBase, plan.base) : '—'}</td>
                                <td className="is-num text-muted-foreground">{r.currentPct.toFixed(1)}%</td>
                                <td className="is-num text-muted-foreground">{r.afterPct.toFixed(1)}%</td>
                                <td className="is-num text-muted-foreground">{r.targetPct ? `${r.targetPct}%` : '—'}</td>
                                <td className="min-w-[240px] whitespace-normal text-[12.5px] leading-snug text-faint">{r.reason}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
