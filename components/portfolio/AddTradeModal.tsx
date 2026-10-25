"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addTrade } from "@/lib/actions/portfolio.actions";
import { symbolCurrency, type Currency } from "@/lib/portfolio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
    children: React.ReactNode;
    symbol?: string;
    side?: 'BUY' | 'SELL';
    heldQuantity?: number;
    currentPrice?: number | null;
};

const today = () => new Date().toISOString().slice(0, 10);

// Recording a buy is the moment to write down why, and what "done" looks like. The form refuses a buy
// without both: the monthly review holds each position to that promise.
export default function AddTradeModal({ children, symbol: initialSymbol = '', side: initialSide = 'BUY', heldQuantity, currentPrice }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
    const [symbol, setSymbol] = useState(initialSymbol);
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState(currentPrice ? String(currentPrice) : '');
    const [fees, setFees] = useState('');
    const [tradedAt, setTradedAt] = useState(today());
    const [targetMode, setTargetMode] = useState<'return' | 'price'>('return');
    const [target, setTarget] = useState('');
    const [thesis, setThesis] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    const sym = symbol.trim().toUpperCase();
    const currency: Currency = sym ? symbolCurrency(sym) : 'USD';
    const qty = parseFloat(quantity);
    const px = parseFloat(price);
    const total = Number.isFinite(qty) && Number.isFinite(px) ? qty * px + (parseFloat(fees) || 0) : null;
    const impliedTarget = targetMode === 'return' && Number.isFinite(px) && Number.isFinite(parseFloat(target)) ? px * (1 + parseFloat(target) / 100) : null;

    const onOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) {
            setSide(initialSide);
            setSymbol(initialSymbol);
            setPrice(currentPrice ? currentPrice.toFixed(2) : '');
            setQuantity(initialSide === 'SELL' && heldQuantity ? String(heldQuantity) : '');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addTrade({
                symbol: sym, side, quantity: qty, price: px, currency, fees: parseFloat(fees) || 0, tradedAt,
                targetPrice: side === 'BUY' && targetMode === 'price' ? parseFloat(target) : null,
                targetReturnPct: side === 'BUY' && targetMode === 'return' ? parseFloat(target) : null,
                thesis, note,
            });
            toast.success(`${side === 'BUY' ? 'Bought' : 'Sold'} ${qty} ${sym}`);
            setOpen(false);
            setQuantity(''); setFees(''); setTarget(''); setThesis(''); setNote('');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Couldn't record the trade");
        } finally {
            setLoading(false);
        }
    };

    const field = "flex h-11 items-center gap-2 rounded-[11px] border border-line bg-page px-3 focus-within:border-brand";
    const input = "num w-full bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-faint";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[480px] gap-5">
                <div>
                    <p className="kicker text-brand-ink">Record a trade</p>
                    <DialogTitle className="mt-1 text-xl font-bold tracking-tight">{side === 'BUY' ? 'What did you buy, and why?' : 'What did you sell?'}</DialogTitle>
                    <DialogDescription className="mt-1 text-[13px] text-faint">
                        {side === 'BUY' ? 'Every buy needs a reason and a finish line. The monthly review checks both.' : 'Sold shares leave the oldest lots first (FIFO).'}
                    </DialogDescription>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-page p-1" role="radiogroup" aria-label="Side">
                        {(['BUY', 'SELL'] as const).map((value) => (
                            <button key={value} type="button" role="radio" aria-checked={side === value} onClick={() => setSide(value)}
                                className={cn('h-9 rounded-[9px] font-semibold transition-colors', side === value ? 'bg-hover text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.06)]' : 'text-faint hover:text-foreground')}>
                                {value === 'BUY' ? 'Buy' : 'Sell'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-[1fr_120px] gap-3">
                        <label className="flex flex-col gap-1.5">
                            <span className="form-label">Symbol</span>
                            <span className={field}>
                                <input value={symbol} onChange={(e) => setSymbol(e.target.value)} required autoFocus={!initialSymbol} placeholder="TEVA.TA or TEVA"
                                    className={cn(input, 'mono uppercase')} />
                                {sym && <span className="mono text-xs text-faint">{currency}</span>}
                            </span>
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="form-label">Date</span>
                            <span className={field}><input type="date" value={tradedAt} max={today()} onChange={(e) => setTradedAt(e.target.value)} required className={input} /></span>
                        </label>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <label className="flex flex-col gap-1.5">
                            <span className="form-label">Shares</span>
                            <span className={field}><input type="number" inputMode="decimal" step="any" min="0" required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={input} /></span>
                            {side === 'SELL' && heldQuantity != null && <span className="num text-[12px] text-faint">You hold {heldQuantity}</span>}
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="form-label">Price / share</span>
                            <span className={field}><input type="number" inputMode="decimal" step="any" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} className={input} /></span>
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="form-label">Fees</span>
                            <span className={field}><input type="number" inputMode="decimal" step="any" min="0" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" className={input} /></span>
                        </label>
                    </div>
                    {total !== null && <p className="num -mt-2 text-[12.5px] text-faint">Total {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(total)}</p>}

                    {side === 'BUY' && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <span className="form-label">Done when</span>
                                <div className="grid grid-cols-[150px_1fr] gap-2">
                                    <div className="grid grid-cols-2 gap-1 rounded-[11px] bg-page p-1" role="radiogroup" aria-label="Target type">
                                        {([['return', '+ %'], ['price', 'Price']] as const).map(([value, label]) => (
                                            <button key={value} type="button" role="radio" aria-checked={targetMode === value} onClick={() => setTargetMode(value)}
                                                className={cn('h-9 rounded-[8px] text-[13px] font-semibold transition-colors', targetMode === value ? 'bg-hover text-foreground' : 'text-faint hover:text-foreground')}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <span className={field}>
                                        <input type="number" inputMode="decimal" step="any" required value={target} onChange={(e) => setTarget(e.target.value)}
                                            placeholder={targetMode === 'return' ? 'e.g. 30' : 'target price'} className={input} />
                                        <span className="mono text-xs text-faint">{targetMode === 'return' ? '%' : currency}</span>
                                    </span>
                                </div>
                                {impliedTarget !== null && <span className="num text-[12px] text-faint">Sell candidate at {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(impliedTarget)}</span>}
                            </div>

                            <label className="flex flex-col gap-1.5">
                                <span className="form-label">Why (one sentence)</span>
                                <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} required maxLength={500} rows={2}
                                    placeholder="What has to stay true for this to work?"
                                    className="w-full resize-none rounded-[11px] border border-line bg-page px-3 py-2.5 text-[14px] text-foreground outline-none placeholder:text-faint focus:border-brand" />
                            </label>
                        </>
                    )}

                    {side === 'SELL' && (
                        <label className="flex flex-col gap-1.5">
                            <span className="form-label">Note (optional)</span>
                            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Target reached, thesis broke, rebalance..."
                                className="h-11 w-full rounded-[11px] border border-line bg-page px-3 text-[14px] text-foreground outline-none placeholder:text-faint focus:border-brand" />
                        </label>
                    )}

                    <button type="submit" disabled={loading || !sym || !(qty > 0) || !(px > 0)} className="btn btn-primary h-11">
                        {loading ? 'Saving' : side === 'BUY' ? 'Record buy' : 'Record sale'}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
