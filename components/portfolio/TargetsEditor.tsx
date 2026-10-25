"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { savePortfolioSettings, type PortfolioSettingsRow } from "@/lib/actions/portfolio.actions";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/portfolio";

type Props = { settings: PortfolioSettingsRow; heldSymbols: string[] };

// The shape the portfolio should have: a weight per symbol, the monthly amount, and the base currency.
// Saved as a whole; the buy-day plan reads it on the next render.
export default function TargetsEditor({ settings, heldSymbols }: Props) {
    const router = useRouter();
    const [targets, setTargets] = useState(settings.targets.map((t) => ({ symbol: t.symbol, weightPct: String(t.weightPct) })));
    const [budget, setBudget] = useState(String(settings.monthlyBudget || ''));
    const [base, setBase] = useState<Currency>(settings.baseCurrency);
    const [tolerance, setTolerance] = useState(String(settings.driftTolerancePct));
    const [newSymbol, setNewSymbol] = useState('');
    const [saving, setSaving] = useState(false);

    const sum = useMemo(() => targets.reduce((s, t) => s + (parseFloat(t.weightPct) || 0), 0), [targets]);
    const missing = heldSymbols.filter((s) => !targets.some((t) => t.symbol === s));

    const add = (symbol: string) => {
        const sym = symbol.trim().toUpperCase();
        if (!sym || targets.some((t) => t.symbol === sym)) return;
        setTargets((ts) => [...ts, { symbol: sym, weightPct: '' }]);
        setNewSymbol('');
    };

    const save = async () => {
        setSaving(true);
        try {
            await savePortfolioSettings({
                baseCurrency: base,
                monthlyBudget: parseFloat(budget) || 0,
                driftTolerancePct: parseFloat(tolerance),
                targets: targets.map((t) => ({ symbol: t.symbol, weightPct: parseFloat(t.weightPct) || 0 })),
            });
            toast.success('Targets saved');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Couldn't save");
        } finally {
            setSaving(false);
        }
    };

    const field = "flex h-10 items-center gap-2 rounded-[10px] border border-line bg-page px-3 focus-within:border-brand";
    const input = "num w-full bg-transparent text-[14px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-faint";

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3">
                <label className="flex flex-col gap-1.5">
                    <span className="form-label">Monthly amount</span>
                    <span className={field}><span className="mono text-xs text-faint">{base}</span><input type="number" inputMode="decimal" min="0" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" className={input} /></span>
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="form-label">Tolerance</span>
                    <span className={cn(field, 'w-[84px]')}><input type="number" inputMode="decimal" min="0" max="50" step="0.5" value={tolerance} onChange={(e) => setTolerance(e.target.value)} className={input} /><span className="text-xs text-faint">pts</span></span>
                </label>
                <div className="flex flex-col gap-1.5">
                    <span className="form-label">Base</span>
                    <div className="grid h-10 grid-cols-2 gap-1 rounded-[10px] bg-page p-1" role="radiogroup" aria-label="Base currency">
                        {(['ILS', 'USD'] as const).map((c) => (
                            <button key={c} type="button" role="radio" aria-checked={base === c} onClick={() => setBase(c)}
                                className={cn('mono rounded-[7px] px-2.5 text-[12.5px] font-semibold transition-colors', base === c ? 'bg-hover text-foreground' : 'text-faint hover:text-foreground')}>{c}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                    <span className="form-label">Target weights</span>
                    <span className={cn('num text-[12.5px]', sum > 100.001 ? 'text-down' : 'text-faint')}>{sum.toFixed(1)}% of 100</span>
                </div>
                {targets.length === 0 && <p className="py-2 text-[13px] text-faint">Add the symbols you want to own and how much of the portfolio each should be.</p>}
                <ul className="flex flex-col gap-1.5">
                    {targets.map((t, i) => (
                        <li key={t.symbol} className="grid grid-cols-[1fr_110px_36px] items-center gap-2">
                            <span className="mono truncate text-[13.5px] font-semibold text-foreground">{t.symbol}</span>
                            <span className={field}>
                                <input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={t.weightPct} placeholder="0"
                                    onChange={(e) => setTargets((ts) => ts.map((x, j) => (j === i ? { ...x, weightPct: e.target.value } : x)))} className={input} />
                                <span className="text-xs text-faint">%</span>
                            </span>
                            <button type="button" className="icon-btn is-danger" onClick={() => setTargets((ts) => ts.filter((_, j) => j !== i))} aria-label={`Remove ${t.symbol}`}><X /></button>
                        </li>
                    ))}
                </ul>
                <form onSubmit={(e) => { e.preventDefault(); add(newSymbol); }} className="mt-1 flex gap-2">
                    <span className={cn(field, 'flex-1')}><input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="Add a symbol, e.g. POLI.TA" className={cn(input, 'mono uppercase')} /></span>
                    <button type="submit" className="btn btn-ghost h-10" disabled={!newSymbol.trim()}><Plus /> Add</button>
                </form>
                {missing.length > 0 && (
                    <p className="text-[12.5px] text-faint">
                        Held but no target: {missing.map((s) => (
                            <button key={s} type="button" onClick={() => add(s)} className="mono ml-1 text-brand-ink hover:underline">{s}</button>
                        ))}
                    </p>
                )}
            </div>

            <button type="button" onClick={save} disabled={saving || sum > 100.001} className="btn btn-primary h-11">{saving ? 'Saving' : 'Save targets'}</button>
        </div>
    );
}
