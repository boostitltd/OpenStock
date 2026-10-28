import Link from "next/link";
import type { HoldingOutlook } from "@/lib/actions/outlook.actions";
import type { Currency } from "@/lib/portfolio";
import { formatPrice } from "@/lib/utils";

const money = (v: number, c: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);
const pct = (v: number | null | undefined, sign = true) => (v == null ? '—' : `${sign && v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const tone = (v: number | null | undefined) => (v == null ? 'text-muted-foreground' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted-foreground');

const REC: Record<string, string> = { strong_buy: 'Strong buy', buy: 'Buy', hold: 'Hold', underperform: 'Underperform', sell: 'Sell' };

function Row({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-faint">{label}</span>
            <span className={`num text-right ${className}`}>{value}</span>
        </div>
    );
}

export default function OutlookHoldings({ holdings, base }: { holdings: HoldingOutlook[]; base: Currency }) {
    return (
        <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {holdings.map((h) => {
                const f = h.fundamentals, s = h.stats, sim = h.sim1y;
                const signals: { text: string; kind: 'up' | 'down' | 'brand' }[] = [];
                if (h.targetReached) signals.push({ text: 'Your target reached', kind: 'brand' });
                if (s?.vsMa200Pct != null) signals.push(s.vsMa200Pct >= 0 ? { text: 'Above 200-day average', kind: 'up' } : { text: 'Below 200-day average', kind: 'down' });
                if (s && s.fromHigh52wPct <= -15) signals.push({ text: `${s.fromHigh52wPct.toFixed(0)}% from 52-week high`, kind: 'down' });
                return (
                    <section key={h.symbol} className="flex flex-col gap-3 rounded-[12px] bg-page/60 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Link href={`/stocks/${encodeURIComponent(h.symbol)}`} className="block truncate font-semibold text-foreground hover:text-brand-ink">{h.name}</Link>
                                <p className="mono text-[12px] text-faint">{h.symbol} · {h.weightPct.toFixed(1)}% of portfolio · {money(h.value, base)}</p>
                            </div>
                            <span className="num shrink-0 text-[15px] font-semibold text-foreground">{h.price ? formatPrice(h.price, h.currency) : '—'}</span>
                        </div>

                        {signals.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {signals.map((sig) => <span key={sig.text} className={`pill ${sig.kind === 'up' ? 'is-up' : sig.kind === 'down' ? 'is-down' : 'is-brand'}`}>{sig.text}</span>)}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">Your promise</p>
                            <Row label="Sell target" value={h.targetPrice ? `${formatPrice(h.targetPrice, h.currency)} (${pct(h.targetDistancePct)} to go)` : 'none set'} className={h.targetReached ? 'text-brand-ink' : 'text-foreground'} />
                            {h.thesis && <p className="text-[12.5px] leading-snug text-muted-foreground">“{h.thesis}”</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">Next 12 months: its own swings, market-average trend</p>
                            {sim ? (
                                <>
                                    <Row label="Bad case (10%)" value={money(sim.p10, base)} className="text-down" />
                                    <Row label="Middle" value={money(sim.p50, base)} className="font-semibold text-foreground" />
                                    <Row label="Good case (90%)" value={money(sim.p90, base)} className="text-up" />
                                    <Row label="Chance of being down" value={`${sim.probBelowContributed.toFixed(0)}%`} className="text-muted-foreground" />
                                </>
                            ) : <p className="text-[12.5px] text-faint">Not enough history</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">Analysts and multiples</p>
                            <Row label="Consensus target" value={f?.targetMeanPrice ? `${formatPrice(f.targetMeanPrice, h.currency)} (${pct(h.analystUpsidePct)}) · ${f.analysts ?? '?'} ${f.analysts === 1 ? 'analyst' : 'analysts'}` : 'no coverage on Yahoo'} className={tone(h.analystUpsidePct)} />
                            {f?.recommendation && <Row label="Rating" value={REC[f.recommendation] ?? f.recommendation} className="text-foreground" />}
                            <Row label="P/E · forward" value={`${f?.trailingPE ? f.trailingPE.toFixed(1) : '—'} · ${f?.forwardPE ? f.forwardPE.toFixed(1) : '—'}`} className="text-foreground" />
                            <Row label="Dividend yield" value={f?.dividendYieldPct != null ? `${f.dividendYieldPct.toFixed(2)}%` : '—'} className="text-foreground" />
                            <Row label="Next earnings" value={f?.nextEarnings ?? '—'} className="text-foreground" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">Its behaviour</p>
                            <Row label="Past return / yr (3y)" value={pct(s?.annualReturnPct)} className={tone(s?.annualReturnPct)} />
                            <Row label="Volatility" value={pct(s?.annualVolPct, false)} className="text-foreground" />
                            <Row label="Worst drawdown (3y)" value={pct(s?.maxDrawdownPct)} className="text-down" />
                            <Row label="vs 200-day avg" value={pct(s?.vsMa200Pct)} className={tone(s?.vsMa200Pct)} />
                            <Row label="From 52-week high" value={pct(s?.fromHigh52wPct)} className={tone(s?.fromHigh52wPct)} />
                            <Row label="Moves with the rest" value={h.correlationWithRest == null ? 'only holding' : `${h.correlationWithRest.toFixed(2)} correlation`} className="text-foreground" />
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
