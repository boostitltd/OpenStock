// Per-user portfolio reads that take the user id as an argument. Deliberately NOT a 'use server' module:
// a server action that accepted a user id could be called from any browser with someone else's id.
// The session-bound actions in lib/actions/portfolio.actions.ts and the cron route are the only callers.

import { connectToDatabase } from '@/database/mongoose';
import { PortfolioSettings, Trade } from '@/database/models/portfolio.model';
import { getCompanyProfile, getLiveQuotes } from '@/lib/actions/finnhub.actions';
import { getUsdIls } from '@/lib/actions/yahoo.actions';
import { buildPortfolio, type Currency, type Portfolio, type QuoteInput, type Target, type TradeInput } from '@/lib/portfolio';

export type TradeRow = TradeInput & { _id: string; tradedAt: string; createdAt?: string };

export type PortfolioSettingsRow = {
    baseCurrency: Currency;
    monthlyBudget: number;
    driftTolerancePct: number;
    targets: Target[];
};

export const DEFAULT_SETTINGS: PortfolioSettingsRow = { baseCurrency: 'ILS', monthlyBudget: 0, driftTolerancePct: 2, targets: [] };

export async function loadTrades(userId: string): Promise<TradeRow[]> {
    try {
        await connectToDatabase();
        const trades = await Trade.find({ userId }).sort({ tradedAt: -1, createdAt: -1 }).lean();
        return JSON.parse(JSON.stringify(trades));
    } catch (error) {
        console.error('Error fetching trades:', error);
        return [];
    }
}

export async function loadSettings(userId: string): Promise<PortfolioSettingsRow> {
    try {
        await connectToDatabase();
        const doc = await PortfolioSettings.findOne({ userId }).lean();
        if (!doc) return DEFAULT_SETTINGS;
        return {
            baseCurrency: doc.baseCurrency ?? 'ILS',
            monthlyBudget: doc.monthlyBudget ?? 0,
            driftTolerancePct: doc.driftTolerancePct ?? 2,
            targets: (doc.targets ?? []).map((t) => ({ symbol: t.symbol, weightPct: t.weightPct })),
        };
    } catch (error) {
        console.error('Error fetching portfolio settings:', error);
        return DEFAULT_SETTINGS;
    }
}

export type LoadedPortfolio = { portfolio: Portfolio; settings: PortfolioSettingsRow; trades: TradeRow[]; fxLive: boolean; quotes: Record<string, QuoteInput> };

// Trades, settings, today's prices and the FX rate, combined.
export async function loadPortfolio(userId: string): Promise<LoadedPortfolio> {
    const [trades, settings] = await Promise.all([loadTrades(userId), loadSettings(userId)]);
    const symbols = [...new Set([...trades.map((t) => t.symbol), ...settings.targets.map((t) => t.symbol)])];
    const [quotes, profiles, fx] = await Promise.all([
        symbols.length ? getLiveQuotes(symbols) : ({} as Awaited<ReturnType<typeof getLiveQuotes>>),
        Promise.all(symbols.map((s) => getCompanyProfile(s).catch(() => null))),
        getUsdIls(),
    ]);
    const quoteMap = Object.fromEntries(symbols.map((s, i) => [s, quotes[s]?.c ? { price: quotes[s]!.c!, name: profiles[i]?.name } : null]));
    const portfolio = buildPortfolio(trades, quoteMap, settings.baseCurrency, fx.rate);
    return { portfolio, settings, trades, fxLive: fx.live, quotes: quoteMap };
}
