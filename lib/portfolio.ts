// Portfolio arithmetic, pure and testable: FIFO cost basis, weights, and the buy-day plan.
// Money in a holding is in its own currency ("native"); totals and weights are in the base currency.

export type Currency = 'ILS' | 'USD';

export type TradeInput = {
    _id?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    currency: Currency;
    fees?: number;
    tradedAt: string | Date;
    targetPrice?: number | null;
    targetReturnPct?: number | null;
    thesis?: string;
    note?: string;
};

export type QuoteInput = { price: number; name?: string } | null | undefined;

export type Holding = {
    symbol: string;
    name: string;
    currency: Currency;
    quantity: number;
    avgCost: number;          // native, fees included
    costBasis: number;        // native, remaining lots
    price: number | null;     // native
    value: number;            // base
    costBase: number;         // base
    unrealised: number;       // base
    unrealisedPct: number | null;
    realised: number;         // base, closed lots (FIFO)
    weightPct: number;
    openedAt: string | null;
    thesis: string;
    targetPrice: number | null;      // native, the explicit one or implied from targetReturnPct
    targetDistancePct: number | null; // how far the price still has to go; <= 0 means reached
    targetReached: boolean;
};

export type Portfolio = {
    base: Currency;
    usdIls: number;
    holdings: Holding[];
    totalValue: number;
    totalCost: number;
    totalUnrealised: number;
    totalUnrealisedPct: number | null;
    totalRealised: number;
};

// Tel Aviv listings trade in shekels; everything else OpenStock prices is in dollars.
export const symbolCurrency = (symbol: string): Currency => (symbol.toUpperCase().endsWith('.TA') ? 'ILS' : 'USD');

export function toBase(amount: number, from: Currency, base: Currency, usdIls: number): number {
    if (from === base) return amount;
    return from === 'USD' ? amount * usdIls : amount / usdIls;
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export function buildPortfolio(trades: TradeInput[], quotes: Record<string, QuoteInput>, base: Currency, usdIls: number): Portfolio {
    const bySymbol = new Map<string, TradeInput[]>();
    for (const t of trades) {
        const key = t.symbol.toUpperCase();
        if (!bySymbol.has(key)) bySymbol.set(key, []);
        bySymbol.get(key)!.push(t);
    }

    const holdings: Holding[] = [];
    for (const [symbol, list] of bySymbol) {
        const ordered = [...list].sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());
        const currency = ordered[0].currency;
        // FIFO: open lots in purchase order; each sell consumes the oldest shares first
        const lots: { qty: number; unitCost: number; tradedAt: string | Date }[] = [];
        let realisedNative = 0;
        let lastBuy: TradeInput | null = null;

        for (const t of ordered) {
            const fees = t.fees ?? 0;
            if (t.side === 'BUY') {
                if (t.quantity > 0) lots.push({ qty: t.quantity, unitCost: t.price + fees / t.quantity, tradedAt: t.tradedAt });
                if (t.thesis || t.targetPrice || t.targetReturnPct) lastBuy = t;
                else if (!lastBuy) lastBuy = t;
                continue;
            }
            let remaining = t.quantity;
            const feePerShare = t.quantity > 0 ? fees / t.quantity : 0;
            while (remaining > 0 && lots.length) {
                const lot = lots[0];
                const take = Math.min(lot.qty, remaining);
                realisedNative += take * (t.price - feePerShare - lot.unitCost);
                lot.qty -= take;
                remaining -= take;
                if (lot.qty <= 1e-9) lots.shift();
            }
            // Selling more than was ever bought is a data error; the surplus is ignored rather than inventing a short.
        }

        const quantity = lots.reduce((s, l) => s + l.qty, 0);
        const costBasis = lots.reduce((s, l) => s + l.qty * l.unitCost, 0);
        const avgCost = quantity > 0 ? costBasis / quantity : 0;
        const quote = quotes[symbol];
        const price = quote && quote.price > 0 ? quote.price : null;
        const valueNative = price !== null ? price * quantity : costBasis;
        const value = toBase(valueNative, currency, base, usdIls);
        const costBase = toBase(costBasis, currency, base, usdIls);
        const unrealised = price !== null ? value - costBase : 0;

        const targetPrice = lastBuy?.targetPrice
            ? lastBuy.targetPrice
            : lastBuy?.targetReturnPct != null && avgCost > 0 ? round(avgCost * (1 + lastBuy.targetReturnPct / 100), 4) : null;
        const targetDistancePct = targetPrice !== null && price !== null && price > 0 ? round((targetPrice / price - 1) * 100) : null;

        if (quantity <= 1e-9 && Math.abs(realisedNative) < 1e-9) continue; // nothing ever really happened here
        holdings.push({
            symbol,
            name: quote?.name || symbol,
            currency,
            quantity: round(quantity, 6),
            avgCost: round(avgCost, 4),
            costBasis: round(costBasis),
            price,
            value: round(value),
            costBase: round(costBase),
            unrealised: round(unrealised),
            unrealisedPct: price !== null && costBase > 0 ? round((unrealised / costBase) * 100) : null,
            realised: round(toBase(realisedNative, currency, base, usdIls)),
            weightPct: 0,
            openedAt: lots[0] ? new Date(lots[0].tradedAt).toISOString() : null,
            thesis: lastBuy?.thesis ?? '',
            targetPrice,
            targetDistancePct,
            targetReached: targetDistancePct !== null && targetDistancePct <= 0,
        });
    }

    const open = holdings.filter((h) => h.quantity > 0);
    const totalValue = open.reduce((s, h) => s + h.value, 0);
    const totalCost = open.reduce((s, h) => s + h.costBase, 0);
    for (const h of holdings) h.weightPct = h.quantity > 0 && totalValue > 0 ? round((h.value / totalValue) * 100) : 0;
    holdings.sort((a, b) => b.value - a.value || a.symbol.localeCompare(b.symbol));

    const totalUnrealised = open.reduce((s, h) => s + h.unrealised, 0);
    return {
        base,
        usdIls,
        holdings,
        totalValue: round(totalValue),
        totalCost: round(totalCost),
        totalUnrealised: round(totalUnrealised),
        totalUnrealisedPct: totalCost > 0 ? round((totalUnrealised / totalCost) * 100) : null,
        totalRealised: round(holdings.reduce((s, h) => s + h.realised, 0)),
    };
}

export type Target = { symbol: string; weightPct: number };

export type PlanRow = {
    symbol: string;
    name: string;
    currency: Currency;
    price: number | null;     // native
    targetPct: number;
    currentPct: number;       // of today's portfolio
    afterPct: number;         // of portfolio + budget, if the plan is followed
    gapBase: number;          // what it would take to land exactly on target (+ buy, - sell)
    action: 'BUY' | 'SELL' | 'HOLD';
    amountBase: number;       // the plan's amount for this symbol (shares × price, in base)
    shares: number;
    reason: string;
};

export type BuyDayPlan = {
    base: Currency;
    budget: number;
    totalBefore: number;
    totalAfter: number;
    rows: PlanRow[];
    leftover: number;         // budget not spent because shares are whole
    targetsSumPct: number;
};

// Where should this month's money go so the portfolio lands closest to its target weights?
// Buys split the budget in proportion to each gap; sells are only suggested past the drift tolerance,
// and holdings with no target at all are flagged, not silently kept.
// `quotes` prices target symbols not held yet, so a first buy can be sized.
export function planBuyDay(portfolio: Portfolio, targets: Target[], budget: number, driftTolerancePct = 2, quotes: Record<string, QuoteInput> = {}): BuyDayPlan {
    const { base, usdIls } = portfolio;
    const held = new Map(portfolio.holdings.filter((h) => h.quantity > 0).map((h) => [h.symbol, h]));
    const targetMap = new Map(targets.filter((t) => t.weightPct > 0).map((t) => [t.symbol.toUpperCase(), t.weightPct]));
    const totalBefore = portfolio.totalValue;
    const totalAfter = totalBefore + budget;
    const targetsSumPct = round([...targetMap.values()].reduce((s, w) => s + w, 0));

    const symbols = [...new Set([...targetMap.keys(), ...held.keys()])];
    const rows: PlanRow[] = symbols.map((symbol) => {
        const h = held.get(symbol);
        const targetPct = targetMap.get(symbol) ?? 0;
        const currency = h?.currency ?? symbolCurrency(symbol);
        const price = h?.price ?? (quotes[symbol] && quotes[symbol]!.price > 0 ? quotes[symbol]!.price : null);
        const current = h?.value ?? 0;
        const currentPct = totalBefore > 0 ? round((current / totalBefore) * 100) : 0;
        const gapBase = round(totalAfter * (targetPct / 100) - current);
        return { symbol, name: h?.name ?? quotes[symbol]?.name ?? symbol, currency, price, targetPct, currentPct, afterPct: currentPct, gapBase, action: 'HOLD', amountBase: 0, shares: 0, reason: '' };
    });

    // Buys: share the budget across positive gaps, in proportion, then round down to whole shares
    const buyable = rows.filter((r) => r.gapBase > 0 && r.price !== null && r.price > 0);
    const gapSum = buyable.reduce((s, r) => s + r.gapBase, 0);
    let spent = 0;
    for (const r of buyable) {
        const allowance = gapSum > budget ? r.gapBase * (budget / gapSum) : r.gapBase;
        const priceBase = toBase(r.price!, r.currency, base, usdIls);
        const shares = Math.floor(allowance / priceBase);
        if (shares > 0) {
            r.action = 'BUY';
            r.shares = shares;
            r.amountBase = round(shares * priceBase);
            r.reason = gapSum > budget ? 'Under target; budget shared across all gaps' : 'Brings it to target';
            spent += r.amountBase;
        } else {
            r.reason = `Under target, but ${formatMoney(allowance, base)} buys less than one share`;
        }
    }
    for (const r of rows.filter((r) => r.gapBase > 0 && (r.price === null || r.price <= 0))) {
        r.reason = 'Under target; no price available to size the buy';
    }

    // Sells: only when the overweight is more than the tolerance, or the symbol has no target at all
    const tolerance = totalAfter * (driftTolerancePct / 100);
    for (const r of rows.filter((r) => r.gapBase < 0)) {
        const h = held.get(r.symbol)!;
        const noTarget = r.targetPct === 0;
        if (!noTarget && -r.gapBase <= tolerance) {
            r.reason = `Over target by ${round(-r.gapBase / totalAfter * 100, 1)} points; within the ${driftTolerancePct}% tolerance`;
            continue;
        }
        const priceBase = h.price ? toBase(h.price, h.currency, base, usdIls) : 0;
        const shares = priceBase > 0 ? Math.min(h.quantity, noTarget ? h.quantity : Math.ceil(-r.gapBase / priceBase)) : 0;
        r.action = 'SELL';
        r.shares = shares;
        r.amountBase = round(shares * priceBase);
        r.reason = noTarget ? 'Not in your targets: sell, or give it a target weight' : `Over target by ${round(-r.gapBase / totalAfter * 100, 1)} points`;
    }

    // Weights after the plan
    for (const r of rows) {
        const current = held.get(r.symbol)?.value ?? 0;
        const after = current + (r.action === 'BUY' ? r.amountBase : r.action === 'SELL' ? -r.amountBase : 0);
        r.afterPct = totalAfter > 0 ? round((after / totalAfter) * 100) : 0;
    }

    rows.sort((a, b) => (a.action === b.action ? b.targetPct - a.targetPct || a.symbol.localeCompare(b.symbol) : order(a.action) - order(b.action)));
    return { base, budget, totalBefore: round(totalBefore), totalAfter: round(totalAfter), rows, leftover: round(budget - spent), targetsSumPct };
}

const order = (a: PlanRow['action']) => (a === 'BUY' ? 0 : a === 'SELL' ? 1 : 2);

export function formatMoney(amount: number, currency: Currency) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}
