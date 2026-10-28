"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTrade } from "@/lib/actions/portfolio.actions";
import type { TradeRow } from "@/lib/server/portfolio-data";
import { formatPrice } from "@/lib/utils";

export default function TradesList({ trades }: { trades: TradeRow[] }) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);

    const remove = async (t: TradeRow) => {
        if (!confirm(`למחוק את ה${t.side === 'BUY' ? 'קנייה' : 'מכירה'} של ${t.quantity} ${t.symbol}? העלות והרווח יחושבו מחדש.`)) return;
        setPendingId(t._id);
        try {
            await deleteTrade(t._id);
            toast.success('העסקה נמחקה');
            router.refresh();
        } catch {
            toast.error("לא הצלחנו למחוק את העסקה");
        } finally {
            setPendingId(null);
        }
    };

    if (trades.length === 0) return <p className="px-4 py-6 text-center text-[13px] text-faint">העסקאות שתרשמו יופיעו כאן.</p>;

    return (
        <ul className="row-list">
            {trades.map((t) => (
                <li key={t._id} className="flex items-center gap-3 px-3.5 py-3">
                    <span className={t.side === 'BUY' ? 'pill is-up' : 'pill is-down'}>{t.side === 'BUY' ? 'קנייה' : 'מכירה'}</span>
                    <span className="min-w-0 flex-1">
                        <span className="num block text-[13.5px] text-foreground">
                            <span dir="ltr" className="mono font-semibold">{t.symbol}</span> · {t.quantity} × {formatPrice(t.price, t.currency)}
                            {t.fees ? <span className="text-faint"> · עמלה {formatPrice(t.fees, t.currency)}</span> : null}
                        </span>
                        <span className="block truncate text-[12.5px] text-faint" title={t.thesis || t.note}>
                            {new Date(t.tradedAt).toLocaleDateString('he-IL')}
                            {t.side === 'BUY' && (t.targetPrice ? ` · יעד ${formatPrice(t.targetPrice, t.currency)}` : t.targetReturnPct != null ? ` · יעד +${t.targetReturnPct}%` : '')}
                            {t.thesis ? ` · ${t.thesis}` : t.note ? ` · ${t.note}` : ''}
                        </span>
                    </span>
                    <button type="button" className="icon-btn is-danger" disabled={pendingId === t._id} onClick={() => remove(t)} title="מחיקת העסקה" aria-label="מחיקת העסקה"><Trash2 /></button>
                </li>
            ))}
        </ul>
    );
}
