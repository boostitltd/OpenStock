import Link from "next/link";
import { CalendarCheck, PlusCircle, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Panel from "@/components/Panel";
import DataFreshness from "@/components/DataFreshness";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import TradesList from "@/components/portfolio/TradesList";
import AddTradeModal from "@/components/portfolio/AddTradeModal";
import { getPortfolio } from "@/lib/actions/portfolio.actions";
import type { Currency } from "@/lib/portfolio";

export const metadata = { title: 'Portfolio | OpenStock' };

const money = (v: number, c: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);

export default async function PortfolioPage() {
    const { portfolio, settings, trades, fxLive } = await getPortfolio();
    const base = portfolio.base;
    const open = portfolio.holdings.filter((h) => h.quantity > 0);
    const reached = open.filter((h) => h.targetReached);
    const hasUsd = open.some((h) => h.currency === 'USD') || base === 'USD';

    const tiles = [
        { label: 'Value', value: money(portfolio.totalValue, base), sub: `${open.length} ${open.length === 1 ? 'position' : 'positions'}`, icon: Wallet },
        { label: 'Unrealised', value: `${portfolio.totalUnrealised > 0 ? '+' : ''}${money(portfolio.totalUnrealised, base)}`, sub: portfolio.totalUnrealisedPct === null ? 'no prices yet' : `${portfolio.totalUnrealisedPct > 0 ? '+' : ''}${portfolio.totalUnrealisedPct.toFixed(1)}% on cost`, icon: portfolio.totalUnrealised >= 0 ? TrendingUp : TrendingDown, tone: portfolio.totalUnrealised >= 0 ? 'text-up' : 'text-down' },
        { label: 'Realised', value: `${portfolio.totalRealised > 0 ? '+' : ''}${money(portfolio.totalRealised, base)}`, sub: 'closed lots, FIFO', icon: CalendarCheck },
        { label: 'Targets reached', value: String(reached.length), sub: reached.length ? reached.map((h) => h.symbol).join(', ') : 'nothing to sell on target', icon: CalendarCheck, tone: reached.length ? 'text-brand-ink' : undefined },
    ];

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">Portfolio</h1>
                    <p className="page-sub num flex flex-wrap items-center gap-x-2">
                        in {base}{hasUsd ? ` · USD/ILS ${portfolio.usdIls.toFixed(3)}${fxLive ? '' : ' (fallback rate)'}` : ''} <span aria-hidden>·</span> <DataFreshness />
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/portfolio/buy-day" className="btn btn-ghost"><CalendarCheck /> Buy day</Link>
                    <AddTradeModal><button type="button" className="btn btn-primary"><PlusCircle /> Record a trade</button></AddTradeModal>
                </div>
            </header>

            <div className="bento mb-3">
                {tiles.map(({ label, value, sub, icon: Icon, tone }) => (
                    <div key={label} className="bento-tile">
                        <div className="bento-head"><span className="bento-ico"><Icon /></span><span>{label}</span></div>
                        <p className={`bento-value ${tone ?? ''}`}>{value}</p>
                        <p className="bento-foot num truncate">{sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <Panel title="Positions" sub={settings.targets.length ? 'Weights against your targets are on the Buy day page' : 'Set target weights on the Buy day page to plan each month'}>
                    <HoldingsTable holdings={portfolio.holdings} base={base} />
                </Panel>
                <Panel title="Trades" sub={`${trades.length} recorded`} className="self-start">
                    <TradesList trades={trades} />
                </Panel>
            </div>
        </>
    );
}
