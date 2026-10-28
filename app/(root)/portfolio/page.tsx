import Link from "next/link";
import { Suspense } from "react";
import ThesisPanel, { ThesisSkeleton } from "@/components/portfolio/ThesisPanel";
import { CalendarCheck, Lightbulb, PlusCircle, Sigma, Telescope, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Panel from "@/components/Panel";
import DataFreshness from "@/components/DataFreshness";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import TradesList from "@/components/portfolio/TradesList";
import AddTradeModal from "@/components/portfolio/AddTradeModal";
import { getPortfolio } from "@/lib/actions/portfolio.actions";
import { money } from "@/lib/format";
import { hebrewName } from "@/lib/universe";

export const metadata = { title: 'התיק | OpenStock' };


export default async function PortfolioPage() {
    const { portfolio, settings, trades, fxLive } = await getPortfolio();
    const base = portfolio.base;
    const open = portfolio.holdings.filter((h) => h.quantity > 0);
    const reached = open.filter((h) => h.targetReached);
    const hasUsd = open.some((h) => h.currency === 'USD') || base === 'USD';

    const tiles = [
        { label: 'שווי', value: money(portfolio.totalValue, base), sub: open.length === 1 ? 'מניה אחת' : `${open.length} מניות`, icon: Wallet },
        { label: 'רווח על הנייר', value: `${portfolio.totalUnrealised > 0 ? '+' : ''}${money(portfolio.totalUnrealised, base)}`, sub: portfolio.totalUnrealisedPct === null ? 'עוד אין מחירים' : `${portfolio.totalUnrealisedPct > 0 ? '+' : ''}${portfolio.totalUnrealisedPct.toFixed(1)}% על העלות`, icon: portfolio.totalUnrealised >= 0 ? TrendingUp : TrendingDown, tone: portfolio.totalUnrealised >= 0 ? 'text-up' : 'text-down' },
        { label: 'רווח ממומש', value: `${portfolio.totalRealised > 0 ? '+' : ''}${money(portfolio.totalRealised, base)}`, sub: 'ממכירות, לפי FIFO', icon: CalendarCheck },
        { label: 'הגיעו ליעד', value: String(reached.length), sub: reached.length ? reached.map((h) => hebrewName(h.symbol, h.name)).join(', ') : 'אין מה למכור לפי יעד', icon: CalendarCheck, tone: reached.length ? 'text-brand-ink' : undefined },
    ];

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">התיק</h1>
                    <p className="page-sub num flex flex-wrap items-center gap-x-2">
                        ב{base === 'ILS' ? 'שקלים' : 'דולרים'}{hasUsd ? ` · דולר ${portfolio.usdIls.toFixed(3)} ₪${fxLive ? '' : ' (שער גיבוי)'}` : ''} <span aria-hidden>·</span> <DataFreshness />
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio/strategy" className="btn btn-ghost"><Sigma /> השיטה</Link>
                    <Link href="/portfolio/ideas" className="btn btn-ghost"><Lightbulb /> מה לקנות</Link>
                    <Link href="/portfolio/outlook" className="btn btn-ghost"><Telescope /> תחזית</Link>
                    <Link href="/portfolio/buy-day" className="btn btn-ghost"><CalendarCheck /> יום קנייה</Link>
                    <AddTradeModal><button type="button" className="btn btn-primary"><PlusCircle /> רישום עסקה</button></AddTradeModal>
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
                <Panel title="המניות בתיק" sub={settings.targets.length ? 'המשקלים מול היעדים מופיעים בעמוד יום קנייה' : 'בעמוד יום קנייה קובעים משקלי יעד, כדי לתכנן כל חודש'}>
                    <HoldingsTable holdings={portfolio.holdings} base={base} />
                </Panel>
                <Panel title="עסקאות" sub={trades.length === 1 ? 'עסקה אחת' : `${trades.length} עסקאות`} className="self-start">
                    <TradesList trades={trades} />
                </Panel>
            </div>

            <Panel title="האם הסיבה שבגללה קנית עדיין נכונה?" sub="נבדק מול התוצאות העסקיות והחדשות האחרונות, פעם ביום" className="mt-3">
                <Suspense fallback={<ThesisSkeleton />}>
                    <ThesisPanel />
                </Suspense>
            </Panel>
        </>
    );
}
