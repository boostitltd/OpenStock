// The arena for the app (not a server action; see portfolio-data.ts). It is the same for every user, so it is
// computed once per market load: a few seconds for the 300 monkeys, then cached until the prices refresh.

import { runArena, runPaper, type ArenaResult, type PaperRow } from '@/lib/arena';
import { loadMarket } from '@/lib/server/strategy';

export type ArenaView = { asOf: string; arena: ArenaResult | null; paper: { start: string; rows: PaperRow[]; monkeyRange: [number, number] | null } };

let cached: { at: number; value: ArenaView } | null = null;

export async function computeArena(): Promise<ArenaView> {
    const m = await loadMarket();
    if (cached && cached.at === m.at) return cached.value;
    const months = m.table.months;
    const asOf = months[months.length - 2] ?? months[months.length - 1];
    const value: ArenaView = { asOf, arena: runArena(m.table, m.index, asOf), paper: runPaper(m.table, m.index) };
    cached = { at: m.at, value };
    return value;
}
