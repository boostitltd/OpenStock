'use server';

import { requireUserId } from '@/lib/better-auth/auth';
import { computeIdeas, type IdeasResult } from '@/lib/server/ideas';

// Buy ideas for the signed-in user.
export async function getIdeas(): Promise<IdeasResult> {
    return computeIdeas(await requireUserId());
}
