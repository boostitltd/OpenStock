"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateThesis } from "@/lib/actions/portfolio.actions";

export default function AdoptThesisButton({ symbol, thesis }: { symbol: string; thesis: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const adopt = async () => {
        setBusy(true);
        const r = await updateThesis(symbol, thesis);
        setBusy(false);
        if (!r.ok) { toast.error(r.error); return; }
        toast.success('הסיבה עודכנה. הבדיקה הבאה תהיה מולה');
        router.refresh();
    };
    return <button type="button" onClick={adopt} disabled={busy} className="btn btn-ghost self-start">{busy ? 'מעדכנים' : 'להשתמש בניסוח הזה'}</button>;
}
