// Builds, sends and records the weekly brief for one user (not a server action; see portfolio-data.ts).

import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';
import { BriefSnapshot } from '@/database/models/brief.model';
import { PortfolioSettings, Trade } from '@/database/models/portfolio.model';
import { composeBrief, type BriefNow, type BriefPrev } from '@/lib/brief';
import { computeIdeas } from '@/lib/server/ideas';
import { computeOutlook } from '@/lib/server/outlook';
import { loadPortfolio } from '@/lib/server/portfolio-data';
import { planBuyDay } from '@/lib/portfolio';
import { computeStrategy } from '@/lib/server/strategy';
import { computeThesisChecks } from '@/lib/server/thesis';
import { computeRadar } from '@/lib/server/radar';
import { computeArena, type ArenaView } from '@/lib/server/arena';

// The live game in one line: who leads, and where the system's own method stands.
function arenaLine(a: ArenaView | null): BriefNow['arena'] {
    const rows = a?.paper.rows ?? [];
    const k = rows.findIndex((r) => r.id === 'momentum');
    if (!rows.length || k < 0) return null;
    return { months: rows[k].months, leader: rows[0].name, leaderPct: rows[0].gainPct, systemPlace: k + 1, systemPct: rows[k].gainPct, total: rows.length };
}

export async function buildBriefNow(userId: string): Promise<BriefNow> {
    const [outlook, ideas, loaded, strategy, thesis] = await Promise.all([
        computeOutlook(userId), computeIdeas(userId), loadPortfolio(userId),
        computeStrategy(userId).catch((e) => { console.error('Brief strategy failed', e); return null; }),
        computeThesisChecks(userId).catch((e) => { console.error('Brief thesis failed', e); return []; }),
    ]);
    const arena = await computeArena().catch((e) => { console.error('Brief arena failed', e); return null; });
    const radar = await computeRadar(userId, (strategy?.buys ?? []).map((b) => b.symbol)).catch((e) => { console.error('Brief radar failed', e); return null; });
    const { portfolio, settings, quotes } = loaded;
    const hasTargets = settings.targets.some((t) => t.weightPct > 0);
    const plan = hasTargets ? planBuyDay(portfolio, settings.targets, settings.monthlyBudget, settings.driftTolerancePct, quotes) : null;
    const held = new Map(portfolio.holdings.map((h) => [h.symbol, h]));
    return {
        at: new Date(), base: outlook.base, totalValue: outlook.totalValue, monthlyBudget: outlook.monthlyBudget, assumedReturnPct: outlook.assumedReturnPct,
        sims: outlook.sims.map((s) => ({ years: s.years, contributed: s.contributed, p10: s.p10, p50: s.p50, p90: s.p90, probBelowContributed: s.probBelowContributed })),
        holdings: outlook.holdings.map((h) => ({
            symbol: h.symbol, name: h.name, currency: h.currency, quantity: held.get(h.symbol)?.quantity ?? 0, price: h.price, value: h.value, weightPct: h.weightPct,
            vsMa200Pct: h.stats?.vsMa200Pct ?? null, fromHigh52wPct: h.stats?.fromHigh52wPct ?? null,
            analystTarget: h.fundamentals?.targetMeanPrice ?? null, analysts: h.fundamentals?.analysts ?? null,
            targetPrice: h.targetPrice, targetDistancePct: h.targetDistancePct, targetReached: h.targetReached, nextEarnings: h.fundamentals?.nextEarnings ?? null,
        })),
        ideas: ideas.ideas.map((i) => ({ symbol: i.symbol, he: i.entry.he, kind: i.entry.kind, verdict: i.call === 'base' ? 'buy' : i.call, reasons: i.reasons, similarTo: i.similarTo, volBefore: i.volBefore, volAfter: i.volAfter, about: i.about, systemPct: i.estimate.systemPct, rangeLowPct: i.estimate.rangeLowPct, rangeHighPct: i.estimate.rangeHighPct, business: i.businessHeadline?.text ?? null })),
        plan: {
            hasTargets,
            buys: (plan?.rows ?? []).filter((r) => r.action === 'BUY').map((r) => ({ symbol: r.symbol, shares: r.shares, amountBase: r.amountBase, currency: r.currency, price: r.price })),
            sells: (plan?.rows ?? []).filter((r) => r.action === 'SELL').map((r) => ({ symbol: r.symbol, shares: r.shares, amountBase: r.amountBase, currency: r.currency, price: r.price })),
            leftover: plan?.leftover ?? 0,
        },
        strategy: strategy ? {
            buys: strategy.buys.map((b) => ({ name: b.name, rank: b.rank, momentumPct: b.momentumPct, shares: b.shares, amount: b.amount })),
            sells: strategy.holdings.filter((h) => h.action === 'sell').map((h) => ({ name: h.name, rank: h.rank, gain: h.gain, tax: h.tax })),
            keeps: strategy.holdings.filter((h) => h.action === 'keep').map((h) => ({ name: h.name, rank: h.rank })),
            backtest: strategy.backtests[0] ? { strategyPct: strategy.backtests[0].strategyPct, equalPct: strategy.backtests[0].equalPct, indexPct: strategy.backtests[0].indexPct } : null,
        } : null,
        thesis: thesis.map((t) => ({ name: t.name, status: t.status, headline: t.headline })),
        radar: radar ? {
            political: radar.items.map((i) => ({ explanation: i.explanation, affects: i.affects, direction: i.direction, source: i.source })),
            insiders: radar.insiders.map((i) => ({ name: i.name, text: i.text })),
            congress: radar.congress.top.map((c) => ({ ticker: c.ticker, members: c.members.length })),
        } : null,
        goal: outlook.goal ? { amount: outlook.goal.amount, date: outlook.goal.date, chancePct: outlook.goal.chancePct, requiredMonthly: outlook.goal.requiredMonthly } : null,
        harvest: (strategy?.harvest ?? []).map((h) => ({ name: h.name, saving: h.saving })),
        arena: arenaLine(arena),
    };
}

async function lastSnapshot(userId: string): Promise<BriefPrev> {
    const doc = await BriefSnapshot.findOne({ userId }).sort({ createdAt: -1 }).lean();
    if (!doc) return null;
    return {
        createdAt: doc.createdAt, totalValue: doc.totalValue, monthlyBudget: doc.monthlyBudget ?? 0,
        sims: (doc.sims ?? []).map((s) => ({ ...s })),
        holdings: (doc.holdings ?? []).map((h) => ({ symbol: h.symbol, quantity: h.quantity, price: h.price ?? null, vsMa200Pct: h.vsMa200Pct ?? null, analystTarget: h.analystTarget ?? null, targetReached: Boolean(h.targetReached) })),
        ideas: (doc.ideas ?? []).map((i) => ({ symbol: i.symbol, verdict: i.verdict })),
    };
}

export async function userEmail(userId: string): Promise<string | null> {
    const db = (await connectToDatabase()).connection.db;
    if (!db) return null;
    const or: Record<string, unknown>[] = [{ id: userId }];
    if (mongoose.Types.ObjectId.isValid(userId)) or.push({ _id: new mongoose.Types.ObjectId(userId) });
    const user = await db.collection('user').findOne({ $or: or }, { projection: { email: 1 } });
    return typeof user?.email === 'string' ? user.email : null;
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<{ id: string | null; error?: string }> {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { id: null, error: 'RESEND_API_KEY is not set' };
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.BRIEF_FROM_EMAIL || 'OpenStock <info@boostit.co.il>', to: [to], subject, html, text }),
        signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { id: body.id ?? null } : { id: null, error: body.message ?? `Resend ${res.status}` };
}

export type BriefResult = { userId: string; to: string | null; subject: string; sent: boolean; error?: string; html?: string; urgent: number };

// Compose against the last snapshot; unless `dry`, send it and store the new snapshot.
export async function runBrief(userId: string, opts: { dry?: boolean; appUrl?: string } = {}): Promise<BriefResult> {
    await connectToDatabase();
    const [now, prev, to] = await Promise.all([buildBriefNow(userId), lastSnapshot(userId), userEmail(userId)]);
    const appUrl = (opts.appUrl || process.env.BETTER_AUTH_URL || '').replace(/\/$/, '');
    const brief = composeBrief(now, prev, appUrl);
    const urgent = brief.events.filter((x) => x.urgent).length;
    if (opts.dry) return { userId, to, subject: brief.subject, sent: false, html: brief.html, urgent };
    if (!to) return { userId, to, subject: brief.subject, sent: false, error: 'No email address for this user', urgent };
    const sent = await sendEmail(to, brief.subject, brief.html, brief.text);
    if (!sent.id) return { userId, to, subject: brief.subject, sent: false, error: sent.error, urgent };
    await BriefSnapshot.create({
        userId, sentTo: to, totalValue: now.totalValue, base: now.base, monthlyBudget: now.monthlyBudget, sims: now.sims,
        holdings: now.holdings.map((h) => ({ symbol: h.symbol, quantity: h.quantity, price: h.price, value: h.value, weightPct: h.weightPct, vsMa200Pct: h.vsMa200Pct, fromHigh52wPct: h.fromHigh52wPct, analystTarget: h.analystTarget, targetReached: h.targetReached })),
        ideas: now.ideas.map((i) => ({ symbol: i.symbol, verdict: i.verdict })),
    });
    return { userId, to, subject: brief.subject, sent: true, urgent };
}

// Everyone with at least one trade or saved settings.
export async function briefRecipients(): Promise<string[]> {
    await connectToDatabase();
    const [a, b] = await Promise.all([Trade.distinct('userId'), PortfolioSettings.distinct('userId')]);
    return [...new Set([...a, ...b].map(String))];
}
