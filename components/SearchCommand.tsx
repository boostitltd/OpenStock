"use client"

import { useEffect, useState } from "react"
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command"
import { ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { searchStocks } from "@/lib/actions/finnhub.actions";
import { useDebounce } from "@/hooks/useDebounce";

const OPEN_SEARCH_EVENT = 'open-search';

// Any button can open the one palette mounted in the app shell.
// Finnhub labels, shown in Hebrew
const EXCHANGE_HE: Record<string, string> = { TA: 'ת"א', US: 'ארה"ב' };
const TYPE_HE: Record<string, string> = { 'Common Stock': 'מניה', Stock: 'מניה', ETP: 'קרן סל', ETF: 'קרן סל', ADR: 'ADR', REIT: 'קרן ריט' };

export const openSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));

export const SearchButton = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" onClick={openSearch} className={className}>{children}</button>
);

export default function SearchCommand({ initialStocks }: { initialStocks: StockWithWatchlistStatus[] }) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(false)
    const [stocks, setStocks] = useState<StockWithWatchlistStatus[]>(initialStocks);
    // The palette starts closed, so render it only after hydration (avoids Radix id mismatches)
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const isSearchMode = !!searchTerm.trim();
    const displayStocks = isSearchMode ? stocks : stocks?.slice(0, 10);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault()
                setOpen(v => !v)
            }
        }
        const onOpen = () => setOpen(true)
        window.addEventListener("keydown", onKeyDown)
        window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
        return () => {
            window.removeEventListener("keydown", onKeyDown)
            window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
        }
    }, [])

    const handleSearch = async () => {
        if(!isSearchMode) return setStocks(initialStocks);

        setLoading(true)
        try {
            const results = await searchStocks(searchTerm.trim());
            setStocks(results);
        } catch {
            setStocks([])
        } finally {
            setLoading(false)
        }
    }

    const debouncedSearch = useDebounce(handleSearch, 300);

    useEffect(() => {
        debouncedSearch();
    }, [debouncedSearch, searchTerm]);

    const handleSelectStock = () => {
        setOpen(false);
        setSearchTerm("");
        setStocks(initialStocks);
    }

    if (!mounted) return null;

    return (
        <CommandDialog open={open} onOpenChange={setOpen} className="search-dialog">
            <div className="search-field">
                <CommandInput value={searchTerm} onValueChange={setSearchTerm} placeholder="חיפוש לפי שם חברה או סימול, גם בעברית" className="search-input" />
                {loading && <Loader2 className="search-loader" />}
            </div>
            <CommandList className="search-list">
                {loading ? (
                    <CommandEmpty className="search-list-empty">מחפשים…</CommandEmpty>
                ) : displayStocks?.length === 0 ? (
                    <div className="search-list-indicator">
                        {isSearchMode ? `לא נמצא כלום עבור "${searchTerm.trim()}"` : 'אין מניות להצגה'}
                    </div>
                ) : (
                    <ul>
                        <li className="search-count">
                            {isSearchMode ? 'תוצאות' : 'פופולריות'} · {displayStocks?.length || 0}
                        </li>
                        {displayStocks?.map((stock) => (
                            <li key={stock.symbol} className="search-item">
                                <Link
                                    href={`/stocks/${stock.symbol}`}
                                    onClick={handleSelectStock}
                                    className="search-item-link group"
                                >
                                    <span dir="ltr" className="mono w-20 shrink-0 truncate text-start text-[13px] font-semibold text-brand-ink">{stock.symbol}</span>
                                    <span className="search-item-name flex-1">{stock.name}</span>
                                    <span className="hidden sm:block text-xs text-faint truncate max-w-40">{[EXCHANGE_HE[stock.exchange] ?? stock.exchange, TYPE_HE[stock.type] ?? stock.type].filter(Boolean).join(' · ')}</span>
                                    <ArrowUpRight className="size-4 text-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </CommandList>
        </CommandDialog>
    )
}
