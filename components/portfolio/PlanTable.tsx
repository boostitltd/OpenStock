import { formatPrice } from "@/lib/utils";
import type { BuyDayPlan, Currency } from "@/lib/portfolio";

const money = (v: number, c: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);

const ACTION: Record<BuyDayPlan['rows'][number]['action'], { label: string; className: string }> = {
    BUY: { label: 'Buy', className: 'pill is-up' },
    SELL: { label: 'Sell', className: 'pill is-down' },
    HOLD: { label: 'Hold', className: 'pill' },
};

export default function PlanTable({ plan }: { plan: BuyDayPlan }) {
    if (plan.rows.length === 0) {
        return <p className="px-4 py-8 text-center text-[13.5px] text-faint">Set target weights and a monthly amount to get a plan.</p>;
    }
    return (
        <div className="overflow-x-auto rounded-[14px]">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Action</th>
                        <th className="is-num">Shares</th>
                        <th className="is-num">Amount</th>
                        <th className="is-num">Now</th>
                        <th className="is-num">After</th>
                        <th className="is-num">Target</th>
                        <th>Why</th>
                    </tr>
                </thead>
                <tbody>
                    {plan.rows.map((r) => {
                        const a = ACTION[r.action];
                        return (
                            <tr key={r.symbol}>
                                <td>
                                    <span className="mono block font-semibold text-foreground">{r.symbol}</span>
                                    <span className="block text-[12px] text-faint">{r.price ? formatPrice(r.price, r.currency) : 'no price'}</span>
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
