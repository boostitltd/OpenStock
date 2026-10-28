// What is going on with one company, in plain Hebrew: recent Hebrew headlines from Google News, and a short
// summary Gemini writes from those headlines and the business numbers only. Saved per symbol per day in MongoDB,
// so a page view is a database read, and the model runs at most once a day per stock.

import { execFileSync } from 'child_process';
import { connectToDatabase } from '@/database/mongoose';
import { StockInsight } from '@/database/models/insight.model';

export type Headline = { title: string; source: string; url: string; date: string };

export type Insight = {
    story: string;          // what is going on with the company now
    drivers: string[];      // what could push the price up, each tied to a fact or a headline
    risks: string[];
    watch: string;          // what to check before buying
    generatedAt: string;
    model: string;
};

const NEWS_DAYS = 60;
const newsCache = new Map<string, { at: number; value: Headline[] }>();

const decode = (s: string) => s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').trim();

// Recent Hebrew coverage of a company. Google News titles end with " - <source>".
export async function getNews(query: string, limit = 8): Promise<Headline[]> {
    const hit = newsCache.get(query);
    if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.value;
    try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=he&gl=IL&ceid=IL:he`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
        if (!res.ok) throw new Error(`Google News ${res.status}`);
        const xml = await res.text();
        const since = Date.now() - NEWS_DAYS * 86400000;
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
            const get = (tag: string) => decode(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '');
            const full = get('title');
            const source = get('source') || full.split(' - ').pop() || '';
            const title = full.endsWith(` - ${source}`) ? full.slice(0, -(source.length + 3)) : full;
            const time = Date.parse(get('pubDate'));
            return { title, source, url: get('link'), date: Number.isFinite(time) ? new Date(time).toISOString() : '' };
        }).filter((h) => h.title && h.date && Date.parse(h.date) >= since);
        const seen = new Set<string>();
        const value = items
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
            .filter((h) => { const k = h.title.slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; })
            .slice(0, limit);
        newsCache.set(query, { at: Date.now(), value });
        return value;
    } catch (error) {
        console.error('News fetch failed for', query, error);
        return hit?.value ?? [];
    }
}

// On Cloud Run the service account's token comes from the metadata server; on a developer machine, from gcloud.
async function accessToken(): Promise<string | null> {
    try {
        const res = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
            headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(1500),
        });
        if (res.ok) return ((await res.json()) as { access_token?: string }).access_token ?? null;
    } catch { /* not on Google Cloud */ }
    try {
        return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', timeout: 15000, shell: process.platform === 'win32' }).trim() || null;
    } catch {
        return null;
    }
}

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'boostit-os';
const REGION = process.env.VERTEX_REGION || 'europe-west1';
const MODEL = process.env.VERTEX_MODEL || 'gemini-2.5-flash';

const INSTRUCTIONS = `אתה כותב למשקיע פרטי שקונה מניות פעם בחודש ואינו איש מקצוע.
כתוב בעברית פשוטה, במשפטים קצרים, כמו שמסבירים לחבר חכם שלא עובד בשוק ההון.
השתמש רק בעובדות שבנתונים ובכותרות שקיבלת. אל תמציא מספרים, אירועים, חוזים, שמות או תחזיות.
כל גורם שמניע וכל סיכון צריכים להישען על כותרת מסוימת או על נתון מסוים שקיבלת.
אם אין מספיק מידע, כתוב זאת במפורש במקום לנחש.
אל תשתמש במילים: מתאם, תנודתיות, מכפיל, EPS, קטליזטור, מומנטום, תמחור.
אל תכתוב "קנה" או "מכור": את ההחלטה מקבל המשקיע.`;

const SCHEMA = {
    type: 'OBJECT',
    properties: {
        story: { type: 'STRING', description: 'שניים-שלושה משפטים: מה קורה עם החברה עכשיו' },
        drivers: { type: 'ARRAY', items: { type: 'STRING' }, description: 'עד ארבעה דברים שיכולים להעלות את המחיר, כל אחד נשען על כותרת או נתון' },
        risks: { type: 'ARRAY', items: { type: 'STRING' }, description: 'עד ארבעה דברים שיכולים להוריד את המחיר' },
        watch: { type: 'STRING', description: 'משפט אחד: מה לבדוק לפני שקונים, או בדוח הבא' },
    },
    required: ['story', 'drivers', 'risks', 'watch'],
};

export type InsightFacts = {
    symbol: string; name: string; about: string | null; sector: string;
    price: string | null; systemEstimate: string; business: string[]; reasonsFromSystem: string[];
    headlines: Headline[];
};

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

// One JSON answer from Gemini on Vertex; `parts` may include an inline file (a PDF as base64). Null on any failure.
export async function geminiJson<T>(instructions: string, parts: Part[], schema: object, maxOutputTokens = 4096): Promise<T | null> {
    const token = await accessToken();
    if (!token) return null;
    const body = {
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts }],
        // Thinking off: it spends the output budget before the JSON is finished, and the answer arrives cut off
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens, thinkingConfig: { thinkingBudget: 0 } },
    };
    try {
        const res = await fetch(`https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${MODEL}:generateContent`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) { console.error('Vertex', res.status, (await res.text()).slice(0, 300)); return null; }
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        return JSON.parse(data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '') as T;
    } catch (error) {
        console.error('Vertex call failed or returned non-JSON', error);
        return null;
    }
}

export const GEMINI_MODEL = MODEL;
export const cleanList = (xs: unknown, n = 4) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, n) : []);

async function generate(facts: InsightFacts): Promise<Insight | null> {
    const parsed = await geminiJson<Omit<Insight, 'generatedAt' | 'model'>>(INSTRUCTIONS, [{ text: `הנתונים על החברה (JSON):\n${JSON.stringify(facts, null, 1)}` }], SCHEMA);
    if (!parsed || typeof parsed.story !== 'string' || !parsed.story.trim()) return null;
    return { story: parsed.story.trim(), drivers: cleanList(parsed.drivers), risks: cleanList(parsed.risks), watch: String(parsed.watch ?? '').trim(), generatedAt: new Date().toISOString(), model: MODEL };
}

export const todayIL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });



// Today's insight for a symbol: from MongoDB if it was written today, otherwise written now and saved.
export async function getInsight(facts: InsightFacts): Promise<Insight | null> {
    const day = todayIL();
    try {
        await connectToDatabase();
        const saved = await StockInsight.findOne({ symbol: facts.symbol, day }).lean();
        if (saved?.insight) return saved.insight as Insight;
    } catch (error) { console.error('Insight read failed', error); }
    const insight = await generate(facts).catch((error) => { console.error('Insight generation failed', error); return null; });
    if (insight) {
        try { await StockInsight.updateOne({ symbol: facts.symbol, day }, { $set: { insight, headlines: facts.headlines } }, { upsert: true }); }
        catch (error) { console.error('Insight save failed', error); }
    }
    return insight;
}
