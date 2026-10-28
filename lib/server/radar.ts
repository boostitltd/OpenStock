// The political and insider radar. Not a trading signal: research finds little edge in copying politicians once the
// disclosure delay is counted, and a statement moves the market in minutes. Its job is that nothing that touches
// the portfolio comes as a surprise. Three sources, all public:
// - Trump's Truth Social posts (trumpstruth.org archive) and White House presidential actions, saved daily;
// - House members' periodic transaction reports (the House Clerk's official filings, read by Gemini from the PDFs);
// - Hebrew news about insiders and companies buying their own shares, for the holdings and this month's candidates.

import { inflateRawSync } from 'zlib';
import { connectToDatabase } from '@/database/mongoose';
import { AiCheck } from '@/database/models/aicheck.model';
import { cachedCheck } from '@/lib/server/aicheck';
import { cleanList, GEMINI_MODEL, geminiJson, getNews, todayIL } from '@/lib/server/insight';
import { loadPortfolio } from '@/lib/server/portfolio-data';
import { aboutHe, hebrewName, universeEntry } from '@/lib/universe';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const DAY = 86400000;

const stripHtml = (s: string) => s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<br\s*\/?>/g, '\n').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

const rssItems = (xml: string) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const get = (tag: string) => m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '';
    return { title: stripHtml(get('title')), text: stripHtml(get('description')), link: stripHtml(get('link')), date: new Date(stripHtml(get('pubDate'))).toISOString() };
}).filter((i) => i.link && !Number.isNaN(Date.parse(i.date)));

type Saved = { title: string; text: string; link: string; date: string };

async function saveAll(kind: string, items: Saved[]) {
    if (!items.length) return 0;
    await connectToDatabase();
    const ops = items.map((i) => ({ updateOne: { filter: { kind, key: i.link, day: 'forever' }, update: { $setOnInsert: { data: i } }, upsert: true } }));
    const r = await AiCheck.bulkWrite(ops, { ordered: false });
    return r.upsertedCount;
}

export async function ingestTruth(): Promise<number> {
    try {
        const res = await fetch('https://www.trumpstruth.org/feed', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000), cache: 'no-store' });
        if (!res.ok) throw new Error(`trumpstruth ${res.status}`);
        return saveAll('truth', rssItems(await res.text()).map((i) => ({ ...i, text: i.text.slice(0, 1200) })));
    } catch (error) { console.error('Truth ingest failed', error); return 0; }
}

export async function ingestActions(): Promise<number> {
    try {
        const res = await fetch('https://www.whitehouse.gov/presidential-actions/feed/', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000), cache: 'no-store' });
        if (!res.ok) throw new Error(`whitehouse ${res.status}`);
        return saveAll('wh-action', rssItems(await res.text()).map((i) => ({ ...i, text: i.text.slice(0, 600) })));
    } catch (error) { console.error('White House ingest failed', error); return 0; }
}

// ---- House periodic transaction reports ------------------------------------------------------------------------

// The yearly index ships as a ZIP. A ZIP is a list of entries with a central directory at the end; read it with
// zlib instead of adding a dependency for one file.
export function readZipEntry(zip: Buffer, name: string): Buffer | null {
    const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) return null;
    let p = zip.readUInt32LE(eocd + 16);
    const count = zip.readUInt16LE(eocd + 10);
    for (let k = 0; k < count; k++) {
        const method = zip.readUInt16LE(p + 10), size = zip.readUInt32LE(p + 20);
        const nameLen = zip.readUInt16LE(p + 28), extra = zip.readUInt16LE(p + 30), comment = zip.readUInt16LE(p + 32);
        const local = zip.readUInt32LE(p + 42);
        const entry = zip.toString('utf8', p + 46, p + 46 + nameLen);
        if (entry === name) {
            const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
            const data = zip.subarray(start, start + size);
            return method === 0 ? Buffer.from(data) : inflateRawSync(data);
        }
        p += 46 + nameLen + extra + comment;
    }
    return null;
}

export type Filing = { docId: string; member: string; state: string; filed: string; year: number };

// "Hon.\tAlford\tMark\t\tP\tMO04\t2026\t3/31/2026\t20034201": FilingType P is a periodic transaction report.
export function parseIndex(text: string): Filing[] {
    return text.split(/\r?\n/).slice(1).map((l) => l.split('\t')).filter((c) => c.length >= 9 && c[4] === 'P').map((c) => {
        const [m, d, y] = c[7].split('/').map(Number);
        return { docId: c[8].trim(), member: `${c[2]} ${c[1]}`.trim(), state: c[5], filed: new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10), year: Number(c[6]) };
    }).filter((f) => f.docId && !Number.isNaN(Date.parse(f.filed)));
}

export type CongressTrade = { asset: string; ticker: string | null; type: 'purchase' | 'sale' | 'exchange'; date: string | null; amount: string };
type ReadFiling = Filing & { trades: CongressTrade[] };

const PTR_SCHEMA = {
    type: 'OBJECT',
    properties: {
        trades: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    asset: { type: 'STRING' }, ticker: { type: 'STRING', description: 'stock ticker if shown, else empty' },
                    type: { type: 'STRING', enum: ['purchase', 'sale', 'exchange'] }, date: { type: 'STRING', description: 'transaction date YYYY-MM-DD' },
                    amount: { type: 'STRING', description: 'the amount range exactly as written, e.g. $1,001 - $15,000' },
                },
                required: ['asset', 'ticker', 'type', 'date', 'amount'],
            },
        },
    },
    required: ['trades'],
};

async function readFiling(f: Filing): Promise<ReadFiling | null> {
    return cachedCheck<ReadFiling>('congress-ptr', f.docId, async () => {
        const res = await fetch(`https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${f.year}/${f.docId}.pdf`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
        if (!res.ok) return null;
        const pdf = Buffer.from(await res.arrayBuffer());
        const r = await geminiJson<{ trades: CongressTrade[] }>(
            'Extract every transaction from this US House periodic transaction report. Use only what is printed. Type: P = purchase, S or S (partial) = sale, E = exchange.',
            [{ inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } }, { text: 'Return the transactions.' }], PTR_SCHEMA, 8192);
        if (!r) return null;
        const trades = (r.trades ?? []).map((t) => ({ ...t, ticker: t.ticker?.trim().toUpperCase() || null, date: t.date || null }));
        return { ...f, trades };
    }, 'forever');
}

// Read the reports filed in the last `days` that haven't been read yet, `limit` at a time (each is one model call).
export async function ingestCongress(days = 30, limit = 40): Promise<number> {
    const now = new Date();
    const years = [now.getUTCFullYear(), ...(now.getUTCMonth() === 0 ? [now.getUTCFullYear() - 1] : [])];
    const filings: Filing[] = [];
    for (const y of years) {
        try {
            const res = await fetch(`https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${y}FD.zip`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
            if (!res.ok) continue;
            const txt = readZipEntry(Buffer.from(await res.arrayBuffer()), `${y}FD.txt`);
            if (txt) filings.push(...parseIndex(txt.toString('utf8')));
        } catch (error) { console.error('House index failed', y, error); }
    }
    const since = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
    const recent = filings.filter((f) => f.filed >= since).sort((a, b) => b.filed.localeCompare(a.filed));
    await connectToDatabase();
    const done = new Set((await AiCheck.find({ kind: 'congress-ptr', key: { $in: recent.map((f) => f.docId) } }).select('key').lean()).map((d) => d.key));
    const todo = recent.filter((f) => !done.has(f.docId)).slice(0, limit);
    let read = 0;
    for (let i = 0; i < todo.length; i += 4) {
        const batch = await Promise.all(todo.slice(i, i + 4).map(readFiling));
        read += batch.filter(Boolean).length;
    }
    return read;
}

export type CongressBuy = { ticker: string; asset: string; members: string[]; buys: number; sells: number; lastDate: string };

async function congressSummary(days = 45): Promise<{ top: CongressBuy[]; filings: number; trades: number }> {
    await connectToDatabase();
    const since = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
    const docs = await AiCheck.find({ kind: 'congress-ptr', 'data.filed': { $gte: since } }).lean();
    const by = new Map<string, CongressBuy>();
    let trades = 0;
    for (const d of docs) {
        const f = d.data as ReadFiling;
        for (const t of f.trades ?? []) {
            trades++;
            if (!t.ticker || t.type === 'exchange') continue;
            const row = by.get(t.ticker) ?? { ticker: t.ticker, asset: t.asset, members: [], buys: 0, sells: 0, lastDate: '' };
            if (t.type === 'purchase') row.buys++; else row.sells++;
            if (!row.members.includes(f.member)) row.members.push(f.member);
            if ((t.date ?? '') > row.lastDate) row.lastDate = t.date ?? '';
            by.set(t.ticker, row);
        }
    }
    const top = [...by.values()].filter((r) => r.buys > 0).sort((a, b) => b.members.length - a.members.length || b.buys - a.buys).slice(0, 12);
    return { top, filings: docs.length, trades };
}

// ---- What touches this portfolio ---------------------------------------------------------------------------------

export type RadarItem = {
    title: string; date: string; link: string; source: 'trump' | 'whitehouse';
    affects: string[];                 // Hebrew company names, or "השוק בישראל" / "כל השוק"
    direction: 'up' | 'down' | 'unclear';
    explanation: string;               // plain Hebrew: what it means for the portfolio
    importance: 'high' | 'medium';
};

export type InsiderItem = { symbol: string; name: string; kind: 'insider-buy' | 'insider-sell' | 'buyback'; text: string; date: string; link: string };

export type Radar = {
    generatedAt: string; model: string;
    items: RadarItem[];
    postsRead: number; actionsRead: number;
    insiders: InsiderItem[];
    congress: Awaited<ReturnType<typeof congressSummary>>;
};

const RADAR_INSTRUCTIONS = `אתה עוזר למשקיע פרטי ישראלי שקונה מניות פעם בחודש ואינו איש מקצוע.
קיבלת את הפוסטים של טראמפ ואת הצווים של הבית הלבן מהימים האחרונים, ואת רשימת החברות שהוא מחזיק או שוקל.
בחר רק פריטים עם תוכן כלכלי ממשי שפוגע ישירות בעסק של חברה מהרשימה, בבורסה בישראל או בשוק המניות כולו:
צו או החלטה חתומים, מכסים, סנקציות, תקציבים, רגולציה, הסכמי סחר, מדיניות אנרגיה, לחץ על הריבית, צעדים צבאיים מול איראן או בנוגע לישראל.
הקשר חייב להיות ישיר: הפעולה עוסקת בענף שהוא העסק המרכזי של החברה. אסור לשרשר ("מתיחות מגדילה תקציבי ביטחון ולכן אלביט תעלה") אלא אם הפריט עוסק במפורש בתקציבי ביטחון או בביטחון ישראל.
פוסטים שבהם טראמפ תומך במועמדים, משבח אנשים, תוקף יריבים או מדבר על בחירות אינם רלוונטיים, גם אם מוזכרים בהם צבא או אנרגיה.
מותר להחזיר עד 6 פריטים, ועדיף פחות. importance=high רק לצו או החלטה חתומים שפוגעים ישירות בענף של חברה מהרשימה.
ב-affects כתוב רק שמות מתוך רשימת החברות שקיבלת, או "הבורסה בישראל", או "כל השוק".
לכל פריט: כתוב בעברית פשוטה מה זה אומר לתיק, על אילו חברות מהרשימה זה משפיע, ובאיזה כיוון. אם אי אפשר לומר מה ההשפעה, אל תכלול את הפריט.
אל תמציא. אל תגזים בחשיבות. אם אין שום דבר רלוונטי, החזר רשימה ריקה.
בלי המילים: מתאם, תנודתיות, מכפיל, קטליזטור, מומנטום.`;

const RADAR_SCHEMA = {
    type: 'OBJECT',
    properties: {
        items: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    ref: { type: 'INTEGER', description: 'the number of the source item' },
                    affects: { type: 'ARRAY', items: { type: 'STRING' } },
                    direction: { type: 'STRING', enum: ['up', 'down', 'unclear'] },
                    explanation: { type: 'STRING' },
                    importance: { type: 'STRING', enum: ['high', 'medium'] },
                },
                required: ['ref', 'affects', 'direction', 'explanation', 'importance'],
            },
        },
    },
    required: ['items'],
};

const INSIDER_SCHEMA = {
    type: 'OBJECT',
    properties: {
        items: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    ref: { type: 'INTEGER' },
                    kind: { type: 'STRING', enum: ['insider-buy', 'insider-sell', 'buyback', 'none'] },
                    text: { type: 'STRING', description: 'משפט אחד בעברית פשוטה: מי קנה או מכר, וכמה אם כתוב' },
                },
                required: ['ref', 'kind', 'text'],
            },
        },
    },
    required: ['items'],
};

// Insider buying, selling and buybacks for one company, from Hebrew headlines of the last two months.
async function insiderNews(symbol: string): Promise<InsiderItem[]> {
    const name = hebrewName(symbol);
    return (await cachedCheck<InsiderItem[]>('insider', symbol, async () => {
        const queries = [`"${name}" רכישה עצמית`, `"${name}" בעל השליטה רכש`, `"${name}" "רכש מניות"`, `"${name}" מכר מניות`];
        const lists = await Promise.all(queries.map((q) => getNews(q, 6)));
        const seen = new Set<string>();
        const heads = lists.flat().filter((h) => { if (seen.has(h.url)) return false; seen.add(h.url); return true; }).slice(0, 15);
        if (!heads.length) return [];
        const r = await geminiJson<{ items: { ref: number; kind: InsiderItem['kind'] | 'none'; text: string }[] }>(
            `סווג כותרות על החברה ${name}. insider-buy: מנהל, דירקטור או בעל שליטה קנה מניות של החברה. insider-sell: מכר. buyback: החברה עצמה קונה את המניות שלה. none: כל דבר אחר, או כותרת על חברה אחרת. כתוב בעברית פשוטה. אל תמציא.`,
            [{ text: heads.map((h, i) => `${i}. ${h.title} (${h.source}, ${h.date.slice(0, 10)})`).join('\n') }], INSIDER_SCHEMA);
        return (r?.items ?? []).filter((x) => x.kind !== 'none' && heads[x.ref]).map((x) => ({
            symbol, name, kind: x.kind as InsiderItem['kind'], text: x.text, date: heads[x.ref].date, link: heads[x.ref].url,
        }));
    })) ?? [];
}

// Everything the radar shows one user, cached per user per day.
export async function computeRadar(userId: string, candidates: string[] = []): Promise<Radar> {
    const { portfolio } = await loadPortfolio(userId);
    const held = portfolio.holdings.filter((h) => h.quantity > 0).map((h) => h.symbol);
    const watch = [...new Set([...held, ...candidates])].slice(0, 12);
    const allowed = new Set([...watch.map((s) => hebrewName(s)), 'הבורסה בישראל', 'כל השוק']);
    const companies = watch.map((s) => ({ name: hebrewName(s), sector: universeEntry(s)?.sector ?? '', about: aboutHe(s), held: held.includes(s) }));

    const [radar, insiders, congress] = await Promise.all([
        cachedCheck<Pick<Radar, 'items' | 'postsRead' | 'actionsRead' | 'generatedAt' | 'model'>>('radar', `${userId}:${watch.join(',')}`, async () => {
            await connectToDatabase();
            const since = new Date(Date.now() - 7 * DAY).toISOString(), sinceActions = new Date(Date.now() - 21 * DAY).toISOString();
            const posts = (await AiCheck.find({ kind: 'truth', 'data.date': { $gte: since } }).lean()).map((d) => d.data as Saved).filter((p) => !p.title.startsWith('RT @') && p.text.length > 40);
            const actions = (await AiCheck.find({ kind: 'wh-action', 'data.date': { $gte: sinceActions } }).lean()).map((d) => d.data as Saved);
            const sources = [
                ...posts.map((p) => ({ source: 'trump' as const, ...p })),
                ...actions.map((a) => ({ source: 'whitehouse' as const, ...a })),
            ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 140);
            const base = { postsRead: posts.length, actionsRead: actions.length, generatedAt: new Date().toISOString(), model: GEMINI_MODEL };
            if (!sources.length) return { ...base, items: [] };
            const list = sources.map((s, i) => `${i}. [${s.source === 'trump' ? 'Trump post' : 'White House action'} ${s.date.slice(0, 10)}] ${s.source === 'trump' ? s.text.slice(0, 500) : s.title}`).join('\n');
            const r = await geminiJson<{ items: { ref: number; affects: string[]; direction: RadarItem['direction']; explanation: string; importance: RadarItem['importance'] }[] }>(
                RADAR_INSTRUCTIONS, [{ text: `החברות של המשקיע:\n${JSON.stringify(companies)}\n\nהמקורות:\n${list}` }], RADAR_SCHEMA, 6000);
            if (!r) return null;
            const items: RadarItem[] = (r.items ?? []).filter((x) => sources[x.ref]).map((x) => {
                const s = sources[x.ref];
                return { title: s.source === 'trump' ? (s.text.slice(0, 220) + (s.text.length > 220 ? '…' : '')) : s.title, date: s.date, link: s.link, source: s.source, affects: cleanList(x.affects, 6).filter((a) => allowed.has(a)), direction: x.direction, explanation: x.explanation.trim(), importance: x.importance };
            }).filter((x) => x.affects.length > 0 && x.direction !== 'unclear').slice(0, 6).sort((a, b) => (a.importance === b.importance ? b.date.localeCompare(a.date) : a.importance === 'high' ? -1 : 1));
            return { ...base, items };
        }),
        Promise.all(watch.filter((s) => s.endsWith('.TA')).map(insiderNews)).then((x) => x.flat().sort((a, b) => b.date.localeCompare(a.date))),
        congressSummary(),
    ]);
    return {
        generatedAt: radar?.generatedAt ?? new Date().toISOString(), model: radar?.model ?? GEMINI_MODEL,
        items: radar?.items ?? [], postsRead: radar?.postsRead ?? 0, actionsRead: radar?.actionsRead ?? 0, insiders, congress,
    };
}

// The daily job: save new posts and actions, read new House filings.
export async function ingestRadar(): Promise<{ posts: number; actions: number; filings: number; day: string }> {
    const [posts, actions] = await Promise.all([ingestTruth(), ingestActions()]);
    const filings = await ingestCongress();
    return { posts, actions, filings, day: todayIL() };
}
