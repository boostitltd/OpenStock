'use server';

import { requireUserId } from '@/lib/better-auth/auth';
import { computeOutlook, type PortfolioOutlook } from '@/lib/server/outlook';

export type { HoldingOutlook, PortfolioOutlook, WhatIf } from '@/lib/server/outlook';

// The signed-in user's outlook: ranges resampled from history, never extrapolated.
export async function getOutlook(whatIfSymbol?: string, whatIfPct?: number): Promise<PortfolioOutlook> {
    return computeOutlook(await requireUserId(), whatIfSymbol, whatIfPct);
}
