"use client";

import { useEffect, useRef, useState } from "react";
import { searchStocks } from "@/lib/actions/finnhub.actions";
import { cn } from "@/lib/utils";

type Props = {
    value: string;
    onChange: (symbol: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
    inputClassName?: string;
};

// Tel Aviv and US listings first: that's what this portfolio is priced in. Everything else stays, but lower.
const rank = (s: Stock) => (s.symbol.endsWith('.TA') ? 0 : s.exchange === 'US' ? 1 : 2);

// Type a company name ("phoenix", "leumi") or a ticker and pick the listing; the field then holds the symbol
// the rest of the app understands (PHOE.TA, LUMI.TA, AAPL). Typing a symbol directly still works.
export default function SymbolPicker({ value, onChange, placeholder = 'חברה או סימול', autoFocus, className, inputClassName }: Props) {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<Stock[]>([]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [loading, setLoading] = useState(false);
    const latest = useRef(0);
    const skipSearch = useRef(Boolean(value)); // set when a result was just picked, so the field doesn't search for its own symbol
    const box = useRef<HTMLDivElement>(null);

    // The parent may set the symbol (prefilled from a holding); typing already keeps the two in step
    useEffect(() => {
        if (value.toUpperCase() !== query.trim().toUpperCase()) { skipSearch.current = true; setQuery(value); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    useEffect(() => {
        const q = query.trim();
        if (skipSearch.current) { skipSearch.current = false; setResults([]); return; }
        if (q.length < 2 || q.length > 20) { setResults([]); return; } // Finnhub rejects long queries (422)
        const id = ++latest.current;
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const found = await searchStocks(q);
                if (id !== latest.current) return;
                setResults([...found].sort((a, b) => rank(a) - rank(b)).slice(0, 8));
                setActive(0);
                setOpen(true);
            } catch {
                if (id === latest.current) setResults([]);
            } finally {
                if (id === latest.current) setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const pick = (s: Stock) => { skipSearch.current = true; setQuery(s.symbol); onChange(s.symbol); setOpen(false); setResults([]); };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open || results.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]); }
        else if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={box} className={cn('relative', className)}>
            <input
                value={query}
                autoFocus={autoFocus}
                placeholder={placeholder}
                autoComplete="off"
                onChange={(e) => { setQuery(e.target.value); onChange(e.target.value.trim().toUpperCase()); }}
                onFocus={() => results.length && setOpen(true)}
                onKeyDown={onKeyDown}
                dir="auto"
                className={cn('mono uppercase text-start', inputClassName)}
                aria-autocomplete="list"
            />
            {loading && <span className="absolute end-0 top-1/2 -translate-y-1/2 text-[11px] text-faint">…</span>}
            {open && results.length > 0 && (
                <ul role="listbox" className="absolute start-0 top-full z-50 mt-1 max-h-72 w-[420px] max-w-[80vw] overflow-y-auto rounded-[11px] border border-line bg-card p-1 shadow-xl">
                    {results.map((s, i) => (
                        <li key={s.symbol} role="option" aria-selected={i === active}>
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)} onMouseEnter={() => setActive(i)}
                                className={cn('flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-start', i === active ? 'bg-hover' : 'hover:bg-hover/60')}>
                                <span dir="ltr" className="mono w-24 shrink-0 text-start text-[13px] font-semibold text-foreground">{s.symbol}</span>
                                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{s.name}</span>
                                <span className="pill h-5 px-1.5 text-[10.5px]">{s.symbol.endsWith('.TA') ? 'ת"א · ₪' : s.exchange === 'US' ? 'ארה"ב · $' : s.exchange}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
