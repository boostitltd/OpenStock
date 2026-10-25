"use client";

import Link from "next/link";
import { Briefcase, MinusCircle, PlusCircle } from "lucide-react";
import ChangePill from "@/components/ChangePill";
import AddTradeModal from "@/components/portfolio/AddTradeModal";
import { formatPrice } from "@/lib/utils";
import type { Currency, Holding } from "@/lib/portfolio";

const money = (v: number, c: Currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);
const signed = (v: number, c: Currency) => `${v > 0 ? '+' : ''}${money(v, c)}`;

export default function HoldingsTable({ holdings, base }: { holdings: Holding[]; base: Currency }) {
    const open = holdings.filter((h) => h.quantity > 0);

    if (open.length === 0) {
        return (
            <div className="empty-state">
                <span className="empty-icon"><Briefcase className="size-5" /></span>
                <h3>No positions yet</h3>
                <p className="max-w-sm">Record what you already hold, one buy at a time, with the reason and the target for each.</p>
                <AddTradeModal><button type="button" className="btn btn-primary mt-3"><PlusCircle /> Record a buy</button></AddTradeModal>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-[14px]">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th className="is-num">Shares</th>
                        <th className="is-num">Avg cost</th>
                        <th className="is-num">Price</th>
                        <th className="is-num">Value</th>
                        <th className="is-num">P&amp;L</th>
                        <th className="is-num">Weight</th>
                        <th className="is-num">To target</th>
                        <th className="w-[80px]"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    {open.map((h) => (
                        <tr key={h.symbol}>
                            <td className="max-w-[300px]">
                                <Link href={`/stocks/${encodeURIComponent(h.symbol)}`} className="group flex min-w-0 flex-col">
                                    <span className="truncate font-semibold text-foreground transition-colors group-hover:text-brand-ink" title={h.name}>{h.name}</span>
                                    <span className="mono text-[12px] text-faint">{h.symbol}{h.thesis ? ` · ${h.thesis}` : ''}</span>
                                </Link>
                            </td>
                            <td className="is-num text-muted-foreground">{h.quantity}</td>
                            <td className="is-num text-muted-foreground">{formatPrice(h.avgCost, h.currency)}</td>
                            <td className="is-num font-semibold text-foreground">{h.price ? formatPrice(h.price, h.currency) : '—'}</td>
                            <td className="is-num text-foreground">{money(h.value, base)}</td>
                            <td className="is-num">
                                <span className="flex items-center justify-end gap-2">
                                    <span className={h.unrealised > 0 ? 'text-up' : h.unrealised < 0 ? 'text-down' : 'text-muted-foreground'}>{h.price ? signed(h.unrealised, base) : '—'}</span>
                                    <ChangePill value={h.unrealisedPct} />
                                </span>
                            </td>
                            <td className="is-num text-muted-foreground">{h.weightPct.toFixed(1)}%</td>
                            <td className="is-num">
                                {h.targetPrice === null ? (
                                    <span className="pill" title="No target on the last buy">no target</span>
                                ) : h.targetReached ? (
                                    <span className="pill is-brand" title={`Target ${formatPrice(h.targetPrice, h.currency)} reached`}>reached</span>
                                ) : (
                                    <span className="text-muted-foreground" title={`Target ${formatPrice(h.targetPrice, h.currency)}`}>+{h.targetDistancePct?.toFixed(1)}%</span>
                                )}
                            </td>
                            <td>
                                <div className="flex items-center justify-end gap-1">
                                    <AddTradeModal symbol={h.symbol} side="BUY" currentPrice={h.price}>
                                        <button type="button" className="icon-btn" title={`Buy more ${h.symbol}`} aria-label={`Buy more ${h.symbol}`}><PlusCircle /></button>
                                    </AddTradeModal>
                                    <AddTradeModal symbol={h.symbol} side="SELL" heldQuantity={h.quantity} currentPrice={h.price}>
                                        <button type="button" className="icon-btn" title={`Sell ${h.symbol}`} aria-label={`Sell ${h.symbol}`}><MinusCircle /></button>
                                    </AddTradeModal>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
