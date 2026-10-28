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

const asNumber = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? NaN : Number(v));

// ---- Trades --------------------------------------------------------------------------------

async function addTradeOrThrow(input: {
    symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number; currency?: Currency; fees?: number;
    tradedAt: string; targetPrice?: number | null; targetReturnPct?: number | null; thesis?: string; note?: string;
}) {
    const userId = await requireUserId();
    const symbol = String(input.symbol ?? '').trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) throw new Error('הסימול לא תקין. בחרו מניה מהרשימה');
    const side = input.side === 'SELL' ? 'SELL' : input.side === 'BUY' ? 'BUY' : null;
    if (!side) throw new Error('סוג העסקה צריך להיות קנייה או מכירה');
    const quantity = asNumber(input.quantity);
    const price = asNumber(input.price);
    const fees = input.fees == null ? 0 : asNumber(input.fees);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('הכמות צריכה להיות מספר חיובי');
    if (!Number.isFinite(price) || price <= 0) throw new Error('המחיר צריך להיות מספר חיובי');
    if (!Number.isFinite(fees) || fees < 0) throw new Error('העמלה צריכה להיות אפס או יותר');
    const currency = (input.currency ?? symbolCurrency(symbol)) as Currency;
    if (!CURRENCIES.includes(currency)) throw new Error('המטבע צריך להיות שקל או דולר');
    const tradedAt = new Date(input.tradedAt);
    if (Number.isNaN(tradedAt.getTime())) throw new Error('התאריך לא תקין');
    if (tradedAt.getTime() > Date.now() + 24 * 3600 * 1000) throw new Error('התאריך בעתיד');

    let targetPrice: number | null = null;
    let targetReturnPct: number | null = null;
    let thesis = '';
    if (side === 'BUY') {
        if (input.targetPrice != null && String(input.targetPrice) !== '') {
            targetPrice = asNumber(input.targetPrice);
            if (!Number.isFinite(targetPrice) || targetPrice <= 0) throw new Error('מחיר היעד צריך להיות מספר חיובי');
        }
        if (input.targetReturnPct != null && String(input.targetReturnPct) !== '') {
            targetReturnPct = asNumber(input.targetReturnPct);
            if (!Number.isFinite(targetReturnPct) || targetReturnPct <= -100 || targetReturnPct > 10000) throw new Error('תשואת היעד צריכה להיות אחוז גבוה מ-100-');
        }
        thesis = String(input.thesis ?? '').trim().slice(0, 500);
        // A buy without a reason is the habit this screen exists to break
        if (!thesis) throw new Error('כתבו משפט אחד: למה קונים');
        if (targetPrice === null && targetReturnPct === null) throw new Error('קבעו מחיר יעד או תשואת יעד, כדי שהמערכת תדע מתי המניה סיימה את תפקידה');
    }
    const note = String(input.note ?? '').trim().slice(0, 500);

    await connectToDatabase();
    if ((await Trade.countDocuments({ userId })) >= MAX_TRADES) throw new Error(`אפשר לרשום עד ${MAX_TRADES} עסקאות`);
    if (side === 'SELL') {
        const held = await heldQuantity(userId, symbol);
        if (quantity > held + 1e-9) throw new Error(`יש לך ${held} מניות ${symbol}, אז אי אפשר למכור ${quantity}`);
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

async function saveSettingsOrThrow(input: Partial<PortfolioSettingsRow>) {
    const userId = await requireUserId();
    const update: Partial<PortfolioSettingsRow> = {};
    if (input.baseCurrency !== undefined) {
        if (!CURRENCIES.includes(input.baseCurrency)) throw new Error('המטבע צריך להיות שקל או דולר');
        update.baseCurrency = input.baseCurrency;
    }
    if (input.monthlyBudget !== undefined) {
        const budget = asNumber(input.monthlyBudget);
        if (!Number.isFinite(budget) || budget < 0) throw new Error('הסכום החודשי צריך להיות אפס או יותר');
        update.monthlyBudget = budget;
    }
    if (input.driftTolerancePct !== undefined) {
        const tol = asNumber(input.driftTolerancePct);
        if (!Number.isFinite(tol) || tol < 0 || tol > 50) throw new Error('הסטייה המותרת צריכה להיות בין 0 ל-50');
        update.driftTolerancePct = tol;
    }
    if (input.targets !== undefined) {
        if (!Array.isArray(input.targets) || input.targets.length > MAX_TARGETS) throw new Error(`עד ${MAX_TARGETS} יעדים`);
        const seen = new Set<string>();
        const targets: Target[] = [];
        for (const t of input.targets) {
            const symbol = String(t?.symbol ?? '').trim().toUpperCase();
            const weightPct = asNumber(t?.weightPct);
            if (!SYMBOL_PATTERN.test(symbol)) throw new Error(`סימול לא תקין: ${symbol || '(ריק)'}`);
            if (!Number.isFinite(weightPct) || weightPct < 0 || weightPct > 100) throw new Error(`המשקל של ${symbol} צריך להיות בין 0 ל-100`);
            if (seen.has(symbol)) throw new Error(`${symbol} מופיעה פעמיים`);
            seen.add(symbol);
            targets.push({ symbol, weightPct: Math.round(weightPct * 100) / 100 });
        }
        const sum = targets.reduce((s, t) => s + t.weightPct, 0);
        if (sum > 100.001) throw new Error(`משקלי היעד מסתכמים ב-${sum.toFixed(1)}%, והמקסימום הוא 100%`);
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

// Next.js replaces a thrown server-action error with a generic message in production, so the reason a form
// was refused ("write one sentence on why") would never reach the person. The exported actions return it.
type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

const asResult = async <T,>(run: () => Promise<T>): Promise<ActionResult<T>> => {
    try {
        return { ok: true, value: await run() };
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        return { ok: false, error: message === 'Unauthorized' ? 'צריך להתחבר מחדש' : message || 'משהו השתבש' };
    }
};

export async function addTrade(input: Parameters<typeof addTradeOrThrow>[0]): Promise<ActionResult<TradeRow>> {
    return asResult(() => addTradeOrThrow(input));
}

export async function savePortfolioSettings(input: Partial<PortfolioSettingsRow>): Promise<ActionResult<{ success: boolean }>> {
    return asResult(() => saveSettingsOrThrow(input));
}
