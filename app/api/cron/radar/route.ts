import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ingestRadar } from '@/lib/server/radar';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const authorised = (req: NextRequest) => {
    const secret = process.env.CRON_SECRET;
    const given = req.headers.get('x-cron-secret');
    if (!secret || !given) return false;
    const a = Buffer.from(secret), b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
};

// Daily: save new Trump posts and White House actions, read new House transaction reports. Cloud Scheduler, X-Cron-Secret.
export async function POST(req: NextRequest) {
    if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const result = await ingestRadar();
    return NextResponse.json(result);
}
