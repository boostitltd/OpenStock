import Link from "next/link";
import { Briefcase } from "lucide-react";
import Panel from "@/components/Panel";
import PlanTable from "@/components/portfolio/PlanTable";
import TargetsEditor from "@/components/portfolio/TargetsEditor";
import { getBuyDayPlan } from "@/lib/actions/portfolio.actions";
import { money } from "@/lib/format";

export const metadata = { title: 'יום קנייה | OpenStock' };


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
                    <h1 className="page-title">יום קנייה</h1>
                    <p className="page-sub num">
                        {money(plan.budget, base)} החודש · התיק עולה מ-{money(plan.totalBefore, base)} ל-{money(plan.totalAfter, base)}
                        {plan.targetsSumPct > 0 && plan.targetsSumPct < 99.999 ? ` · היעדים מסתכמים ב-${plan.targetsSumPct}%, והשאר נשאר במזומן` : ''}
                    </p>
                </div>
                <form className="flex flex-wrap items-center gap-2" action="/portfolio/buy-day">
                    <label className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-card px-3 focus-within:border-brand">
                        <span className="text-xs text-faint">{base === 'ILS' ? '₪' : '$'}</span>
                        <input name="budget" type="number" inputMode="decimal" min="0" step="any" defaultValue={plan.budget || ''} placeholder="סכום החודש" className="num w-28 bg-transparent text-[14px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-faint" />
                    </label>
                    <button type="submit" className="btn btn-ghost h-10">לחשב מחדש</button>
                    <Link href="/portfolio" className="btn btn-ghost h-10"><Briefcase /> התיק</Link>
                </form>
            </header>

            <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <div className="flex min-w-0 flex-col gap-3">
                    <Panel
                        title="התוכנית"
                        sub={plan.rows.length
                            ? `${buys.length === 1 ? 'קנייה אחת' : `${buys.length} קניות`} ב-${money(spent, base)}${plan.leftover > 0 ? `, נשארים ${money(plan.leftover, base)}` : ''}${sells.length ? ` · ${sells.length === 1 ? 'מניה אחת לצמצם' : `${sells.length} מניות לצמצם`}` : ' · אין מה לצמצם'}`
                            : 'עוד אין מה לתכנן'}
                    >
                        <PlanTable plan={plan} />
                    </Panel>
                    {sells.length > 0 && (
                        <p className="px-1 text-[12.5px] text-faint">
                            הצמצומים מחושבים ממשקלי היעד שלך ומהסטייה המותרת ({settings.driftTolerancePct} נקודות). מניה בלי יעד מסומנת כל חודש, עד שקובעים לה יעד או מוכרים אותה.
                        </p>
                    )}
                </div>
                <Panel title="יעדים" sub="איך התיק אמור להיראות" className="self-start" bodyClassName="p-0">
                    <TargetsEditor settings={settings} heldSymbols={heldSymbols} />
                </Panel>
            </div>
        </>
    );
}
