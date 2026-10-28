"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAlert } from "@/lib/actions/alert.actions";
import { alertsEnabled } from "@/lib/market-data";
import { formatPrice } from "@/lib/utils";

type AlertRow = {
    _id: string;
    symbol: string;
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    triggered?: boolean;
    active?: boolean;
    expiresAt?: string;
};

const statusOf = (alert: AlertRow) => {
    if (alert.triggered) return { label: 'הופעלה', className: 'pill is-brand' };
    if (!alertsEnabled) return { label: 'מושהית', className: 'pill' };
    if (alert.expiresAt && new Date(alert.expiresAt) < new Date()) return { label: 'פגה', className: 'pill' };
    if (alert.active === false) return { label: 'מושהית', className: 'pill' };
    return { label: 'במעקב', className: 'pill is-up' };
};

export default function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);

    const handleDelete = async (alert: AlertRow) => {
        setPendingId(alert._id);
        try {
            await deleteAlert(alert._id);
            toast.success(`ההתראה ל-${alert.symbol} נמחקה`);
            router.refresh();
        } catch {
            toast.error("לא הצלחנו למחוק את ההתראה");
        } finally {
            setPendingId(null);
        }
    };

    if (alerts.length === 0 && !alertsEnabled) {
        return (
            <div className="empty-state py-10">
                <span className="empty-icon"><BellRing className="size-5" /></span>
                <h3>התראות הן חלק מ-Cloud</h3>
                <p className="max-w-64 text-[13px]">התראות מחיר במייל הן חלק מ-OpenStock Cloud, ב-5 דולר לחודש. השירות עוד לא פתוח.</p>
                <Link href="/#data" className="btn btn-ghost mt-2">על OpenStock Cloud</Link>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="empty-state py-10">
                <span className="empty-icon"><BellRing className="size-5" /></span>
                <h3>עוד אין התראות</h3>
                <p className="max-w-60 text-[13px]">לחצו על הפעמון בשורה של מניה, או על "התראה" בעמוד המניה. נשלח מייל כשההתראה מופעלת.</p>
            </div>
        );
    }

    return (
        <>
            {!alertsEnabled && (
                <p className="px-3 pt-3 pb-1 text-[12.5px] text-faint">
                    ההתראות עברו ל-<Link href="/#data" className="text-brand-ink hover:underline">OpenStock Cloud</Link>, ולכן אלה מושהות.
                </p>
            )}
            <ul className="row-list">
                {alerts.map((alert) => {
                    const status = statusOf(alert);
                    return (
                        <li key={alert._id} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p dir="ltr" className="mono text-start font-semibold text-foreground">{alert.symbol}</p>
                                <p className="num truncate text-[12.5px] text-faint">
                                    {alert.condition === 'ABOVE' ? 'מעל' : 'מתחת ל-'} {formatPrice(alert.targetPrice, alert.symbol.endsWith('.TA') ? 'ILS' : 'USD')}
                                    {alert.expiresAt && !alert.triggered && ` · עד ${new Date(alert.expiresAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`}
                                </p>
                            </div>
                            <span className={status.className}>{status.label}</span>
                            <button
                                type="button"
                                onClick={() => handleDelete(alert)}
                                disabled={pendingId === alert._id}
                                className="icon-btn is-danger"
                                title="מחיקת ההתראה"
                                aria-label={`מחיקת ההתראה ל-${alert.symbol}`}
                            >
                                <Trash2 />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
