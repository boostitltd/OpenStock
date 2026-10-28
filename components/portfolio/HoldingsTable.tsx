"use client";

import Link from "next/link";
import { Briefcase, MinusCircle, PlusCircle } from "lucide-react";
import ChangePill from "@/components/ChangePill";
import AddTradeModal from "@/components/portfolio/AddTradeModal";
import { formatPrice } from "@/lib/utils";
import type { Currency, Holding } from "@/lib/portfolio";
import { hebrewName } from "@/lib/universe";

import { money } from "@/lib/format";
const signed = (v: number, c: Currency) => `${v > 0 ? '+' : ''}${money(v, c)}`;

export default function HoldingsTable({ holdings, base }: { holdings: Holding[]; base: Currency }) {
    const open = holdings.filter((h) => h.quantity > 0);

    if (open.length === 0) {
        return (
            <div className="empty-state">
                <span className="empty-icon"><Briefcase className="size-5" /></span>
                <h3>עוד אין מניות בתיק</h3>
                <p className="max-w-sm">רשמו את מה שכבר יש לכם, קנייה אחרי קנייה, עם הסיבה והיעד לכל אחת.</p>
                <AddTradeModal><button type="button" className="btn btn-primary mt-3"><PlusCircle /> רישום קנייה</button></AddTradeModal>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-[14px]">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>מניה</th>
                        <th className="is-num">כמות</th>
                        <th className="is-num">מחיר קנייה ממוצע</th>
                        <th className="is-num">מחיר</th>
                        <th className="is-num">שווי</th>
                        <th className="is-num">רווח והפסד</th>
                        <th className="is-num">משקל</th>
                        <th className="is-num">עד היעד</th>
                        <th className="w-[80px]"><span className="sr-only">פעולות</span></th>
                    </tr>
                </thead>
                <tbody>
                    {open.map((h) => (
                        <tr key={h.symbol}>
                            <td>
                                <Link href={`/stocks/${encodeURIComponent(h.symbol)}`} className="group flex w-[260px] max-w-[260px] flex-col">
                                    <span className="truncate font-semibold text-foreground transition-colors group-hover:text-brand-ink" title={h.name}>{hebrewName(h.symbol, h.name)}</span>
                                    <span className="truncate text-[12px] text-faint" title={h.thesis}><span dir="ltr" className="mono">{h.symbol}</span>{h.thesis ? ` · ${h.thesis}` : ''}</span>
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
                                    <span className="pill" title="לקנייה האחרונה אין יעד">אין יעד</span>
                                ) : h.targetReached ? (
                                    <span className="pill is-brand" title={`היעד ${formatPrice(h.targetPrice, h.currency)} הושג`}>הגיעה ליעד</span>
                                ) : (
                                    <span className="text-muted-foreground" title={`יעד ${formatPrice(h.targetPrice, h.currency)}`}>+{h.targetDistancePct?.toFixed(1)}%</span>
                                )}
                            </td>
                            <td>
                                <div className="flex items-center justify-end gap-1">
                                    <AddTradeModal symbol={h.symbol} side="BUY" currentPrice={h.price}>
                                        <button type="button" className="icon-btn" title={`לקנות עוד ${h.name}`} aria-label={`לקנות עוד ${h.name}`}><PlusCircle /></button>
                                    </AddTradeModal>
                                    <AddTradeModal symbol={h.symbol} side="SELL" heldQuantity={h.quantity} currentPrice={h.price}>
                                        <button type="button" className="icon-btn" title={`למכור ${h.name}`} aria-label={`למכור ${h.name}`}><MinusCircle /></button>
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
