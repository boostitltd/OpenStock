"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { sendBriefNow } from "@/lib/actions/brief.actions";

export default function SendBriefButton() {
    const [state, setState] = useState<{ busy: boolean; message?: string; ok?: boolean }>({ busy: false });
    const send = async () => {
        setState({ busy: true });
        try {
            const r = await sendBriefNow();
            setState({ busy: false, message: r.message, ok: r.ok });
        } catch {
            setState({ busy: false, message: 'השליחה נכשלה', ok: false });
        }
    };
    return (
        <div className="flex items-center gap-3">
            {state.message && <span className={`text-[13px] ${state.ok ? 'text-up' : 'text-down'}`}>{state.message}</span>}
            <button type="button" onClick={send} disabled={state.busy} className="btn btn-primary"><Mail /> {state.busy ? 'שולח…' : 'לשלוח לי עכשיו'}</button>
        </div>
    );
}
