'use server';

import { requireUserId } from '@/lib/better-auth/auth';
import { computeDecision, computeIdeas, type Decision, type IdeasResult } from '@/lib/server/ideas';

// Buy ideas for the signed-in user.
export async function getIdeas(): Promise<IdeasResult> {
    return computeIdeas(await requireUserId());
}

// One candidate's full page for the signed-in user.
export async function getDecision(symbol: string): Promise<Decision | null> {
    if (!/^[A-Z0-9][A-Z0-9.&:-]{0,24}$/i.test(symbol)) return null;
    return computeDecision(await requireUserId(), symbol);
}

// The momentum plan for the signed-in user.
export async function getStrategy() {
    const { computeStrategy } = await import('@/lib/server/strategy');
    return computeStrategy(await requireUserId());
}

// Is the reason behind each holding still true?
export async function getThesisChecks() {
    const { computeThesisChecks } = await import('@/lib/server/thesis');
    return computeThesisChecks(await requireUserId());
}

// The political and insider radar, for the holdings and this month's candidates.
export async function getRadar() {
    const userId = await requireUserId();
    const { computeRadar } = await import('@/lib/server/radar');
    const { computeStrategy } = await import('@/lib/server/strategy');
    const s = await computeStrategy(userId).catch(() => null);
    return computeRadar(userId, (s?.buys ?? []).map((b) => b.symbol));
}
