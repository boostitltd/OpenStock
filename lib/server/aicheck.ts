// Read-through cache for AI answers in MongoDB: return today's saved answer, or compute, save and return it.

import { connectToDatabase } from '@/database/mongoose';
import { AiCheck } from '@/database/models/aicheck.model';
import { todayIL } from '@/lib/server/insight';

export async function cachedCheck<T>(kind: string, key: string, compute: () => Promise<T | null>, day = todayIL()): Promise<T | null> {
    try {
        await connectToDatabase();
        const saved = await AiCheck.findOne({ kind, key, day }).lean();
        if (saved?.data) return saved.data as T;
    } catch (error) { console.error('AI cache read failed', kind, key, error); }
    const data = await compute().catch((error) => { console.error('AI check failed', kind, key, error); return null; });
    if (data) {
        try { await AiCheck.updateOne({ kind, key, day }, { $set: { data } }, { upsert: true }); }
        catch (error) { console.error('AI cache write failed', kind, key, error); }
    }
    return data;
}

// A short stable key for a piece of text (a thesis), so a rewritten thesis gets a fresh check.
export function textKey(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}
