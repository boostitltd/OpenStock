'use server';

import { requireUserId } from '@/lib/better-auth/auth';
import { runBrief } from '@/lib/server/brief';

// Send the signed-in user their brief now, to their own account address only.
export async function sendBriefNow(): Promise<{ ok: boolean; to: string | null; message: string }> {
    const result = await runBrief(await requireUserId());
    const reasons: Record<string, string> = {
        'RESEND_API_KEY is not set': 'שליחת מיילים לא מוגדרת בשרת',
        'No email address for this user': 'לחשבון אין כתובת מייל',
    };
    return result.sent
        ? { ok: true, to: result.to, message: `נשלח אל ${result.to}` }
        : { ok: false, to: result.to, message: `השליחה נכשלה: ${reasons[result.error ?? ''] ?? result.error ?? 'סיבה לא ידועה'}` };
}
