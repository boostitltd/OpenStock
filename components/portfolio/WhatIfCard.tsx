"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import SymbolPicker from "@/components/portfolio/SymbolPicker";
import type { WhatIf } from "@/lib/actions/outlook.actions";
import type { Currency } from "@/lib/portfolio";
import { formatPrice } from "@/lib/utils";

const money = (v: number, c: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);
const pct = (v: number | null | undefined, sign = true) => (v == null ? '—' : `${sign && v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const delta = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : Math.round((b - a) * 10) / 10);

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

    return (
        <div className="flex flex-col gap-4 p-4">
            <form onSubmit={run} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                <label className="flex flex-col gap-1.5">
                    <span className="form-label">Candidate</span>
                    <span className={field}><SymbolPicker value={symbol} onChange={setSymbol} placeholder="Company name or symbol" className="min-w-0 flex-1" inputClassName={input} /></span>
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="form-label">Weight</span>
                    <span className={field}><input type="number" inputMode="decimal" min="1" max="99" step="1" value={weight} onChange={(e) => setWeight(e.target.value)} className={input} /><span className="text-xs text-faint">%</span></span>
                </label>
                <button type="submit" disabled={busy || !symbol.trim()} className="btn btn-primary h-11"><FlaskConical /> {busy ? 'Running' : 'Run'}</button>
            </form>

            {whatIf?.error && <p className="text-[13px] text-down">{whatIf.error}</p>}

            {whatIf && !whatIf.error && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="mono text-[15px] font-semibold text-foreground">{whatIf.symbol}</span>
                        <span className="num text-[13px] text-muted-foreground">{whatIf.price ? formatPrice(whatIf.price, whatIf.currency) : ''}</span>
                        {whatIf.stats && <span className="num text-[13px] text-faint">last 3 years: {pct(whatIf.stats.annualReturnPct)} a year, {pct(whatIf.stats.annualVolPct, false)} volatility, worst drawdown {pct(whatIf.stats.maxDrawdownPct)}</span>}
                        {whatIf.fundamentals?.targetMeanPrice && <span className="num text-[13px] text-faint">analysts: {formatPrice(whatIf.fundamentals.targetMeanPrice, whatIf.currency)} ({whatIf.fundamentals.analysts})</span>}
                    </div>

                    {whatIf.correlationWithPortfolio != null && (
                        <p className="text-[13px] text-muted-foreground">
                            Moves with your current portfolio at a correlation of <span className="num font-semibold text-foreground">{whatIf.correlationWithPortfolio.toFixed(2)}</span>
                            {whatIf.correlationWithPortfolio >= 0.7 ? ': mostly the same bet, little diversification.' : whatIf.correlationWithPortfolio >= 0.4 ? ': related, some diversification.' : ': largely its own thing, real diversification.'}
                        </p>
                    )}

                    {hasHoldings && (
                        <div className="overflow-x-auto rounded-[12px]">
                            <table className="data-table">
                                <thead>
                                    <tr><th>With {whatIf.weightPct}% in {whatIf.symbol}</th><th className="is-num">Now</th><th className="is-num">After</th><th className="is-num">Change</th></tr>
                                </thead>
                                <tbody>
                                    <Compare label="Past return / yr" before={whatIf.before?.annualReturnPct} after={whatIf.after?.annualReturnPct} betterWhen="higher" />
                                    <Compare label="Volatility" before={whatIf.before?.annualVolPct} after={whatIf.after?.annualVolPct} betterWhen="lower" />
                                    <Compare label="Worst drawdown" before={whatIf.before?.maxDrawdownPct} after={whatIf.after?.maxDrawdownPct} betterWhen="closer-to-zero" />
                                </tbody>
                            </table>
                        </div>
                    )}

                    {(whatIf.sim3yAfter || whatIf.sim3yBefore) && (
                        <div className="overflow-x-auto rounded-[12px]">
                            <table className="data-table">
                                <thead>
                                    <tr><th>3 years, simulated</th><th className="is-num">Bad case (10%)</th><th className="is-num">Middle</th><th className="is-num">Good case (90%)</th><th className="is-num">Chance of loss</th></tr>
                                </thead>
                                <tbody>
                                    {whatIf.sim3yBefore && (
                                        <tr><td className="text-faint">Without it</td><td className="is-num text-down">{money(whatIf.sim3yBefore.p10, base)}</td><td className="is-num text-foreground">{money(whatIf.sim3yBefore.p50, base)}</td><td className="is-num text-up">{money(whatIf.sim3yBefore.p90, base)}</td><td className="is-num text-muted-foreground">{whatIf.sim3yBefore.probBelowContributed.toFixed(0)}%</td></tr>
                                    )}
                                    {whatIf.sim3yAfter && (
                                        <tr><td className="font-semibold text-foreground">With it</td><td className="is-num text-down">{money(whatIf.sim3yAfter.p10, base)}</td><td className="is-num font-semibold text-foreground">{money(whatIf.sim3yAfter.p50, base)}</td><td className="is-num text-up">{money(whatIf.sim3yAfter.p90, base)}</td><td className="is-num text-muted-foreground">{whatIf.sim3yAfter.probBelowContributed.toFixed(0)}%</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {!whatIf && <p className="text-[12.5px] text-faint">Pick a stock you are considering. You get its history, how much it moves with what you already own, and the portfolio&apos;s numbers with and without it.</p>}
        </div>
    );
}
