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
