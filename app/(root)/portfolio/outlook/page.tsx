import Link from "next/link";
import { Activity, Briefcase, CalendarCheck, Telescope, TrendingDown } from "lucide-react";
import Panel from "@/components/Panel";
import OutlookHoldings from "@/components/portfolio/OutlookHoldings";
import WhatIfCard from "@/components/portfolio/WhatIfCard";
import { getOutlook } from "@/lib/actions/outlook.actions";
import type { Currency } from "@/lib/portfolio";

export const metadata = { title: 'Outlook | OpenStock' };

const money = (v: number, c: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);
const pct = (v: number | null | undefined, sign = true) => (v == null ? '—' : `${sign && v > 0 ? '+' : ''}${v.toFixed(1)}%`);

// Ranges, not predictions: every number here is resampled from the holdings' own last three years.
export default async function OutlookPage({ searchParams }: { searchParams: Promise<{ add?: string; pct?: string }> }) {
    const { add, pct: pctParam } = await searchParams;
    const outlook = await getOutlook(add?.trim() || undefined, pctParam ? Number(pctParam) : undefined);
    const { base, stats, sims, holdings } = outlook;

    const tiles = stats ? [
        { label: 'Past return', value: pct(stats.annualReturnPct), sub: 'a year, last 3 years · not projected', icon: Activity, tone: stats.annualReturnPct >= 0 ? 'text-up' : 'text-down' },
        { label: 'Volatility', value: pct(stats.annualVolPct, false), sub: 'typical swing in a year', icon: Activity },
        { label: 'Worst drawdown', value: pct(stats.maxDrawdownPct), sub: 'peak to trough, last 3 years', icon: TrendingDown, tone: 'text-down' },
        { label: 'History used', value: `${outlook.historyDays} days`, sub: outlook.historyFrom ? `since ${outlook.historyFrom}` : '', icon: CalendarCheck },
    ] : [];

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">Outlook</h1>
                    <p className="page-sub">
                        Ranges, not predictions. Each simulation reuses your holdings&apos; real swings, crashes and how they move together over the last three years, but assumes an average market return of {outlook.assumedReturnPct}% a year instead of repeating their past trend.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/portfolio" className="btn btn-ghost"><Briefcase /> Portfolio</Link>
                    <Link href="/portfolio/buy-day" className="btn btn-ghost"><CalendarCheck /> Buy day</Link>
                </div>
            </header>

            {holdings.length === 0 ? (
                <Panel title="Nothing to project yet">
                    <div className="empty-state">
                        <span className="empty-icon"><Telescope className="size-5" /></span>
                        <h3>Record a position first</h3>
                        <p className="max-w-sm">The outlook is built from the price history of what you hold. Record a buy on the Portfolio page and come back.</p>
                    </div>
                </Panel>
            ) : (
                <>
                    {tiles.length > 0 && (
                        <div className="bento mb-3">
                            {tiles.map(({ label, value, sub, icon: Icon, tone }) => (
                                <div key={label} className="bento-tile">
                                    <div className="bento-head"><span className="bento-ico"><Icon /></span><span>{label}</span></div>
                                    <p className={`bento-value ${tone ?? ''}`}>{value}</p>
                                    <p className="bento-foot num truncate">{sub}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <Panel
                        title="Where the portfolio could be"
                        sub={`Starting from ${money(outlook.totalValue, base)}${outlook.monthlyBudget ? `, adding ${money(outlook.monthlyBudget, base)} a month at your target weights` : ', with no monthly contributions set'} · ${outlook.assumedReturnPct}% average return assumed · 2,000 simulated paths`}
                        className="mb-3"
                    >
                        {sims.length === 0 ? (
                            <p className="px-4 py-6 text-[13.5px] text-faint">Not enough shared price history yet.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-[14px]">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Horizon</th>
                                            <th className="is-num">Money in</th>
                                            <th className="is-num">Bad case (10%)</th>
                                            <th className="is-num">Middle (50%)</th>
                                            <th className="is-num">Good case (90%)</th>
                                            <th className="is-num">Chance of loss</th>
                                            <th className="is-num">Middle growth / yr</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sims.map((s) => (
                                            <tr key={s.years}>
                                                <td className="font-semibold text-foreground">{s.years} {s.years === 1 ? 'year' : 'years'}</td>
                                                <td className="is-num text-muted-foreground">{money(s.contributed, base)}</td>
                                                <td className="is-num text-down">{money(s.p10, base)}</td>
                                                <td className="is-num font-semibold text-foreground">{money(s.p50, base)}</td>
                                                <td className="is-num text-up">{money(s.p90, base)}</td>
                                                <td className="is-num text-muted-foreground">{s.probBelowContributed.toFixed(0)}%</td>
                                                <td className="is-num text-muted-foreground">{pct(s.medianAnnualPct)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="px-4 pb-3 pt-2 text-[12px] text-faint">
                            Bad case: one in ten paths ended below it. Good case: one in ten ended above. Chance of loss: paths that ended under the money put in. The spread comes from your holdings&apos; own history; the {outlook.assumedReturnPct}% average does not, so a stock that tripled is not assumed to triple again. Dollar holdings are converted at today&apos;s rate; the shekel-dollar move itself is not simulated.
                        </p>
                    </Panel>

                    <Panel title="Each holding" sub="Its own history, the analysts, and the promise it was bought on" className="mb-3">
                        <OutlookHoldings holdings={holdings} base={base} />
                    </Panel>
                </>
            )}

            <Panel title="What would adding a stock do?" sub="Same history, same simulation, with the candidate mixed in at the weight you choose">
                <WhatIfCard whatIf={outlook.whatIf} base={base} hasHoldings={holdings.length > 0} initialSymbol={add ?? ''} initialPct={pctParam ?? '10'} />
            </Panel>
        </>
    );
}
