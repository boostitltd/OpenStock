import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { briefRecipients, runBrief } from '@/lib/server/brief';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const authorised = (req: NextRequest) => {
    const secret = process.env.CRON_SECRET;
    const given = req.headers.get('x-cron-secret');
    if (!secret || !given) return false;
    const a = Buffer.from(secret), b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
};

// Weekly brief for every user with a portfolio. Called by Cloud Scheduler with X-Cron-Secret.
// ?dry=1 composes without sending or saving, and returns the HTML of the first brief for a look.
export async function POST(req: NextRequest) {
    if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const dry = req.nextUrl.searchParams.get('dry') === '1';
    const users = await briefRecipients();
    const results = [];
    for (const userId of users) {
        try {
            results.push(await runBrief(userId, { dry, appUrl: process.env.BETTER_AUTH_URL }));
        } catch (error) {
            console.error('Brief failed for', userId, error);
            results.push({ userId, sent: false, error: error instanceof Error ? error.message : String(error) });
        }
    }
    if (dry && results[0] && 'html' in results[0] && req.nextUrl.searchParams.get('html') === '1') {
        return new NextResponse(results[0].html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    const summary = results.map((r) => ({ ...r, html: undefined }));
    const failed = summary.filter((r) => !dry && !r.sent).length;
    return NextResponse.json({ dry, users: users.length, failed, results: summary }, { status: failed ? 500 : 200 });
}
