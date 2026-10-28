'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { Trade } from '@/database/models/portfolio.model';
import { PortfolioSettings } from '@/database/models/portfolio.model';
import { requireUserId } from '@/lib/better-auth/auth';
import { loadPortfolio, loadSettings, loadTrades, type LoadedPortfolio, type PortfolioSettingsRow, type TradeRow } from '@/lib/server/portfolio-data';
import { planBuyDay, symbolCurrency, type Currency, type Target } from '@/lib/portfolio';

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.&:-]{0,24}$/;
const CURRENCIES: Currency[] = ['ILS', 'USD'];
const MAX_TRADES = 2000;
const MAX_TARGETS = 60;

export type { TradeRow, PortfolioSettingsRow } from '@/lib/server/portfolio-data';

const asNumber = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? NaN : Number(v));

// ---- Trades --------------------------------------------------------------------------------

export async function addTrade(input: {
    symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; currency?: Currency; fees?: number;
    tradedAt: string; targetPrice?: number | null; targetReturnPct?: number | null; thesis?: string; note?: string;
}) {
    const userId = await requireUserId();
    const symbol = String(input.symbol ?? '').trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) throw new Error('Invalid symbol');
    const side = input.side === 'SELL' ? 'SELL' : input.side === 'BUY' ? 'BUY' : null;
    if (!side) throw new Error('Side must be BUY or SELL');
    const quantity = asNumber(input.quantity);
    const price = asNumber(input.price);
    const fees = input.fees == null ? 0 : asNumber(input.fees);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be a positive number');
    if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
    if (!Number.isFinite(fees) || fees < 0) throw new Error('Fees must be zero or more');
    const currency = (input.currency ?? symbolCurrency(symbol)) as Currency;
    if (!CURRENCIES.includes(currency)) throw new Error('Currency must be ILS or USD');
    const tradedAt = new Date(input.tradedAt);
    if (Number.isNaN(tradedAt.getTime())) throw new Error('Invalid trade date');
    if (tradedAt.getTime() > Date.now() + 24 * 3600 * 1000) throw new Error('Trade date is in the future');

    let targetPrice: number | null = null;
    let targetReturnPct: number | null = null;
    let thesis = '';
    if (side === 'BUY') {
        if (input.targetPrice != null && String(input.targetPrice) !== '') {
            targetPrice = asNumber(input.targetPrice);
            if (!Number.isFinite(targetPrice) || targetPrice <= 0) throw new Error('Target price must be a positive number');
        }
        if (input.targetReturnPct != null && String(input.targetReturnPct) !== '') {
            targetReturnPct = asNumber(input.targetReturnPct);
            if (!Number.isFinite(targetReturnPct) || targetReturnPct <= -100 || targetReturnPct > 10000) throw new Error('Target return must be a percentage above -100');
        }
        thesis = String(input.thesis ?? '').trim().slice(0, 500);
        // A buy without a reason is the habit this screen exists to break
        if (!thesis) throw new Error('Write one sentence on why you are buying');
        if (targetPrice === null && targetReturnPct === null) throw new Error('Set a target price or a target return, so the review knows when this one is done');
    }
    const note = String(input.note ?? '').trim().slice(0, 500);

    await connectToDatabase();
    if ((await Trade.countDocuments({ userId })) >= MAX_TRADES) throw new Error(`You can record up to ${MAX_TRADES} trades`);
    if (side === 'SELL') {
        const held = await heldQuantity(userId, symbol);
        if (quantity > held + 1e-9) throw new Error(`You hold ${held} ${symbol}; you can't sell ${quantity}`);
    }

    const created = await Trade.create({ userId, symbol, side, quantity, price, currency, fees, tradedAt, targetPrice, targetReturnPct, thesis, note });
    revalidatePath('/portfolio', 'layout');
    return JSON.parse(JSON.stringify(created)) as TradeRow;
}

async function heldQuantity(userId: string, symbol: string) {
    const trades = await Trade.find({ userId, symbol }).select('side quantity').lean();
    return trades.reduce((s, t) => s + (t.side === 'BUY' ? t.quantity : -t.quantity), 0);
}

export async function deleteTrade(tradeId: string) {
    const userId = await requireUserId();
    await connectToDatabase();
    await Trade.findOneAndDelete({ _id: tradeId, userId });
    revalidatePath('/portfolio', 'layout');
    return { success: true };
}

export async function getTrades(): Promise<TradeRow[]> {
    return loadTrades(await requireUserId());
}

// ---- Settings ------------------------------------------------------------------------------

export async function getPortfolioSettings(): Promise<PortfolioSettingsRow> {
    return loadSettings(await requireUserId());
}

export async function savePortfolioSettings(input: Partial<PortfolioSettingsRow>) {
    const userId = await requireUserId();
    const update: Partial<PortfolioSettingsRow> = {};
    if (input.baseCurrency !== undefined) {
        if (!CURRENCIES.includes(input.baseCurrency)) throw new Error('Currency must be ILS or USD');
        update.baseCurrency = input.baseCurrency;
    }
    if (input.monthlyBudget !== undefined) {
        const budget = asNumber(input.monthlyBudget);
        if (!Number.isFinite(budget) || budget < 0) throw new Error('Monthly budget must be zero or more');
        update.monthlyBudget = budget;
    }
    if (input.driftTolerancePct !== undefined) {
        const tol = asNumber(input.driftTolerancePct);
        if (!Number.isFinite(tol) || tol < 0 || tol > 50) throw new Error('Drift tolerance must be between 0 and 50');
        update.driftTolerancePct = tol;
    }
    if (input.targets !== undefined) {
        if (!Array.isArray(input.targets) || input.targets.length > MAX_TARGETS) throw new Error(`Up to ${MAX_TARGETS} targets`);
        const seen = new Set<string>();
        const targets: Target[] = [];
        for (const t of input.targets) {
            const symbol = String(t?.symbol ?? '').trim().toUpperCase();
            const weightPct = asNumber(t?.weightPct);
            if (!SYMBOL_PATTERN.test(symbol)) throw new Error(`Invalid symbol: ${symbol || '(empty)'}`);
            if (!Number.isFinite(weightPct) || weightPct < 0 || weightPct > 100) throw new Error(`Weight for ${symbol} must be between 0 and 100`);
            if (seen.has(symbol)) throw new Error(`${symbol} appears twice`);
            seen.add(symbol);
            targets.push({ symbol, weightPct: Math.round(weightPct * 100) / 100 });
        }
        const sum = targets.reduce((s, t) => s + t.weightPct, 0);
        if (sum > 100.001) throw new Error(`Target weights add up to ${sum.toFixed(1)}%; the most is 100%`);
        update.targets = targets;
    }

    await connectToDatabase();
    await PortfolioSettings.findOneAndUpdate({ userId }, { $set: { userId, ...update } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    revalidatePath('/portfolio', 'layout');
    return { success: true };
}

// ---- Views ---------------------------------------------------------------------------------

// Everything the portfolio pages need: trades, settings, today's prices and the FX rate, combined.
export async function getPortfolio(): Promise<LoadedPortfolio> {
    return loadPortfolio(await requireUserId());
}

export async function getBuyDayPlan(budgetOverride?: number) {
    const { portfolio, settings, fxLive, quotes } = await getPortfolio();
    const budget = budgetOverride !== undefined && Number.isFinite(budgetOverride) && budgetOverride >= 0 ? budgetOverride : settings.monthlyBudget;
    return { plan: planBuyDay(portfolio, settings.targets, budget, settings.driftTolerancePct, quotes), portfolio, settings, fxLive };
}
