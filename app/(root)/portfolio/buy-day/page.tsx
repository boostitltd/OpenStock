import Link from "next/link";
import { Briefcase } from "lucide-react";
import Panel from "@/components/Panel";
import PlanTable from "@/components/portfolio/PlanTable";
import TargetsEditor from "@/components/portfolio/TargetsEditor";
import { getBuyDayPlan } from "@/lib/actions/portfolio.actions";
import type { Currency } from "@/lib/portfolio";

export const metadata = { title: 'Buy day | OpenStock' };

const money = (v: number, c: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);

// Once a month: where does this month's money go so the portfolio lands closest to its target weights,
// and what has drifted far enough over target to trim. The user decides; nothing here places an order.
export default async function BuyDayPage({ searchParams }: { searchParams: Promise<{ budget?: string }> }) {
    const { budget: budgetParam } = await searchParams;
    const override = budgetParam !== undefined ? Number(budgetParam) : undefined;
    const { plan, portfolio, settings } = await getBuyDayPlan(Number.isFinite(override) ? override : undefined);
    const base = plan.base;
    const buys = plan.rows.filter((r) => r.action === 'BUY');
    const sells = plan.rows.filter((r) => r.action === 'SELL');
    const spent = buys.reduce((s, r) => s + r.amountBase, 0);
    const heldSymbols = portfolio.holdings.filter((h) => h.quantity > 0).map((h) => h.symbol);

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">Buy day</h1>
                    <p className="page-sub num">
                        {money(plan.budget, base)} this month · portfolio {money(plan.totalBefore, base)} → {money(plan.totalAfter, base)}
                        {plan.targetsSumPct > 0 && plan.targetsSumPct < 99.999 ? ` · targets add up to ${plan.targetsSumPct}%, the rest stays cash` : ''}
                    </p>
                </div>
                <form className="flex items-center gap-2" action="/portfolio/buy-day">
                    <label className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-card px-3 focus-within:border-brand">
                        <span className="mono text-xs text-faint">{base}</span>
                        <input name="budget" type="number" inputMode="decimal" min="0" step="any" defaultValue={plan.budget || ''} placeholder="this month" className="num w-28 bg-transparent text-[14px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-faint" />
                    </label>
                    <button type="submit" className="btn btn-ghost h-10">Re-plan</button>
                    <Link href="/portfolio" className="btn btn-ghost h-10"><Briefcase /> Portfolio</Link>
                </form>
            </header>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div className="flex min-w-0 flex-col gap-3">
                    <Panel
                        title="The plan"
                        sub={plan.rows.length
                            ? `${buys.length} ${buys.length === 1 ? 'buy' : 'buys'} for ${money(spent, base)}${plan.leftover > 0 ? `, ${money(plan.leftover, base)} left over` : ''}${sells.length ? ` · ${sells.length} to trim` : ' · nothing to trim'}`
                            : 'Nothing to plan yet'}
                    >
                        <PlanTable plan={plan} />
                    </Panel>
                    {sells.length > 0 && (
                        <p className="px-1 text-[12.5px] text-faint">
                            Trims are suggestions from your own target weights and tolerance ({settings.driftTolerancePct} points). A symbol with no target is flagged every month until you give it one or sell it.
                        </p>
                    )}
                </div>
                <Panel title="Targets" sub="What the portfolio should look like" className="self-start" bodyClassName="p-0">
                    <TargetsEditor settings={settings} heldSymbols={heldSymbols} />
                </Panel>
            </div>
        </>
    );
}
