"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTrade, type TradeRow } from "@/lib/actions/portfolio.actions";
import { formatPrice } from "@/lib/utils";

export default function TradesList({ trades }: { trades: TradeRow[] }) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);

    const remove = async (t: TradeRow) => {
        if (!confirm(`Delete this ${t.side.toLowerCase()} of ${t.quantity} ${t.symbol}? Cost basis and P&L will be recomputed.`)) return;
        setPendingId(t._id);
        try {
            await deleteTrade(t._id);
            toast.success('Trade removed');
            router.refresh();
        } catch {
            toast.error("Couldn't remove the trade");
        } finally {
            setPendingId(null);
        }
    };

    if (trades.length === 0) return <p className="px-4 py-6 text-center text-[13px] text-faint">Trades you record show up here.</p>;

    return (
        <ul className="row-list">
            {trades.map((t) => (
                <li key={t._id} className="flex items-center gap-3 px-3.5 py-3">
                    <span className={t.side === 'BUY' ? 'pill is-up' : 'pill is-down'}>{t.side === 'BUY' ? 'Buy' : 'Sell'}</span>
                    <span className="min-w-0 flex-1">
                        <span className="num block text-[13.5px] text-foreground">
                            <span className="mono font-semibold">{t.symbol}</span> · {t.quantity} × {formatPrice(t.price, t.currency)}
                            {t.fees ? <span className="text-faint"> · fees {formatPrice(t.fees, t.currency)}</span> : null}
                        </span>
                        <span className="block truncate text-[12.5px] text-faint" title={t.thesis || t.note}>
                            {new Date(t.tradedAt).toLocaleDateString('en-GB')}
                            {t.side === 'BUY' && (t.targetPrice ? ` · target ${formatPrice(t.targetPrice, t.currency)}` : t.targetReturnPct != null ? ` · target +${t.targetReturnPct}%` : '')}
                            {t.thesis ? ` · ${t.thesis}` : t.note ? ` · ${t.note}` : ''}
                        </span>
                    </span>
                    <button type="button" className="icon-btn is-danger" disabled={pendingId === t._id} onClick={() => remove(t)} title="Delete trade" aria-label="Delete trade"><Trash2 /></button>
                </li>
            ))}
        </ul>
    );
}
