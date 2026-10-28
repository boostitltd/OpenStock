// Israeli capital-gains tax on a personal brokerage account, as the system uses it: 25% on real gains when a share
// is sold, losses in the same tax year offset gains. Pure and simple on purpose: the exact figure (inflation
// adjustment, dividends, a broker's own calculation) belongs to the broker's annual tax form and an accountant.

import { symbolCurrency, toBase, type Currency, type Holding, type TradeInput } from '@/lib/portfolio';

export const CAPITAL_GAINS_TAX = 0.25;

export type RealisedYear = { year: number; gain: number };   // base currency

// Realised gain or loss per calendar year, FIFO, fees included, converted at today's rate (approximate for dollars).
export function realisedByYear(trades: TradeInput[], base: Currency, usdIls: number): RealisedYear[] {
    const lots = new Map<string, { qty: number; costPer: number }[]>();
    const byYear = new Map<number, number>();
    const sorted = [...trades].sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());
    for (const t of sorted) {
        const cur = (t.currency ?? symbolCurrency(t.symbol)) as Currency;
        const q = lots.get(t.symbol) ?? [];
        if (t.side === 'BUY') {
            q.push({ qty: t.quantity, costPer: (t.quantity * t.price + (t.fees ?? 0)) / t.quantity });
            lots.set(t.symbol, q);
            continue;
        }
        let left = t.quantity, cost = 0;
        while (left > 1e-9 && q.length) {
            const lot = q[0], take = Math.min(left, lot.qty);
            cost += take * lot.costPer; lot.qty -= take; left -= take;
            if (lot.qty <= 1e-9) q.shift();
        }
        const proceeds = t.quantity * t.price - (t.fees ?? 0);
        const year = new Date(t.tradedAt).getFullYear();
        byYear.set(year, (byYear.get(year) ?? 0) + toBase(proceeds - cost, cur, base, usdIls));
    }
    return [...byYear].sort(([a], [b]) => a - b).map(([year, gain]) => ({ year, gain: Math.round(gain) }));
}

export const taxIfSold = (h: Holding) => Math.max(0, h.unrealised) * CAPITAL_GAINS_TAX;

export type Harvest = { symbol: string; name: string; loss: number; saving: number };

// Holdings at a loss that could offset this year's realised gains if sold before 31 December.
export function harvestIdeas(holdings: Holding[], realisedThisYear: number): Harvest[] {
    if (realisedThisYear <= 0) return [];
    let room = realisedThisYear;
    return holdings
        .filter((h) => h.quantity > 0 && h.unrealised < 0)
        .sort((a, b) => a.unrealised - b.unrealised)
        .flatMap((h) => {
            if (room <= 0) return [];
            const used = Math.min(room, -h.unrealised);
            room -= used;
            return [{ symbol: h.symbol, name: h.name, loss: Math.round(-h.unrealised), saving: Math.round(used * CAPITAL_GAINS_TAX) }];
        });
}
