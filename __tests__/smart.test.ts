import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'zlib';
import { harvestIdeas, realisedByYear } from '@/lib/tax';
import { parseIndex, readZipEntry } from '@/lib/server/radar';
import { alignReturns, planGoal, rng } from '@/lib/forecast';
import { composeBrief, type BriefNow } from '@/lib/brief';
import type { Holding } from '@/lib/portfolio';

describe('tax', () => {
    it('realises FIFO gains per year, fees included', () => {
        const r = realisedByYear([
            { symbol: 'A.TA', side: 'BUY', quantity: 10, price: 100, currency: 'ILS', fees: 10, tradedAt: '2025-01-05' },
            { symbol: 'A.TA', side: 'BUY', quantity: 10, price: 200, currency: 'ILS', tradedAt: '2025-06-05' },
            { symbol: 'A.TA', side: 'SELL', quantity: 10, price: 150, currency: 'ILS', fees: 5, tradedAt: '2026-03-01' },
        ], 'ILS', 3.6);
        expect(r).toEqual([{ year: 2026, gain: 1500 - 5 - 1010 }]);
    });
    it('suggests selling losers only up to this year\'s gains', () => {
        const h = (symbol: string, unrealised: number) => ({ symbol, name: symbol, quantity: 1, unrealised } as Holding);
        expect(harvestIdeas([h('A', -800), h('B', -300), h('C', 500)], 1000)).toEqual([
            { symbol: 'A', name: 'A', loss: 800, saving: 200 }, { symbol: 'B', name: 'B', loss: 300, saving: 50 },
        ]);
        expect(harvestIdeas([h('A', -800)], 0)).toEqual([]);
    });
});

describe('House filings', () => {
    it('reads the index out of a ZIP and keeps only transaction reports', () => {
        const txt = 'Prefix\tLast\tFirst\tSuffix\tFilingType\tStateDst\tYear\tFilingDate\tDocID\nHon.\tAlford\tMark\t\tP\tMO04\t2026\t3/31/2026\t20034201\nHon.\tX\tY\t\tA\tTX01\t2026\t3/1/2026\t1';
        const data = deflateRawSync(Buffer.from(txt));
        const name = Buffer.from('2026FD.txt');
        const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt16LE(name.length, 26);
        const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
        const cdOffset = local.length + name.length + data.length;
        const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + name.length, 12); eocd.writeUInt32LE(cdOffset, 16);
        const zip = Buffer.concat([local, name, data, central, name, eocd]);
        const filings = parseIndex(readZipEntry(zip, '2026FD.txt')!.toString('utf8'));
        expect(filings).toEqual([{ docId: '20034201', member: 'Mark Alford', state: 'MO04', filed: '2026-03-31', year: 2026 }]);
    });
});

describe('goal', () => {
    it('finds a higher monthly amount when the chance is low', () => {
        const r = rng(3);
        const closes = [100];
        for (let i = 1; i < 500; i++) closes.push(closes[i - 1] * Math.exp(0.0003 + 0.012 * (r() - 0.5) * 3.4));
        const rows = alignReturns([{ symbol: 'X', dates: closes.map((_, i) => `2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`), closes }]).rows;
        const g = planGoal({ rows, values: [10000], weights: [1], monthly: 500, amount: 150000, years: 10, date: '2036-12-31', driftAnnual: 0.07, paths: 300 })!;
        expect(g.chancePct).toBeLessThan(80);
        expect(g.requiredMonthly!).toBeGreaterThan(500);
        const easy = planGoal({ rows, values: [10000], weights: [1], monthly: 500, amount: 20000, years: 10, date: '2036-12-31', driftAnnual: 0.07, paths: 300 })!;
        expect(easy.chancePct).toBeGreaterThanOrEqual(80);
    });
});

describe('brief with the smart parts', () => {
    const base: BriefNow = {
        at: new Date('2026-11-01T06:00:00Z'), base: 'ILS', totalValue: 5400, monthlyBudget: 1000, assumedReturnPct: 7,
        sims: [], holdings: [], ideas: [], plan: { hasTargets: false, buys: [], sells: [], leftover: 0 },
        strategy: {
            buys: [{ name: 'אנלייט', rank: 1, momentumPct: 66.8, shares: 0, amount: 0 }],
            sells: [{ name: 'הפניקס', rank: 22, gain: 400, tax: 100 }], keeps: [],
            backtest: { strategyPct: 17.3, equalPct: 13.9, indexPct: 8.5 },
        },
        thesis: [{ name: 'הפניקס', status: 'broken', headline: 'הרווח ירד שני רבעונים ברצף' }],
        radar: { political: [{ explanation: 'מכס על טורבינות רוח', affects: ['אנלייט'], direction: 'down', source: 'whitehouse' }], insiders: [], congress: [{ ticker: 'NVDA', members: 2 }] },
        goal: { amount: 500000, date: '2036-12-31', chancePct: 41, requiredMonthly: 2500 },
        harvest: [{ name: 'טבע', saving: 250 }],
    };
    it('puts a strategy sell and a broken reason in the subject, and shows every section', () => {
        const b = composeBrief(base, null, 'https://x');
        expect(b.subject).toContain('2 דברים לטפל בהם');
        for (const s of ['לפי השיטה', 'אנלייט', 'נשברה', 'ראדאר', 'NVDA', 'המטרה שלך', '41%', 'לחסוך מס']) expect(b.html).toContain(s);
    });
});
