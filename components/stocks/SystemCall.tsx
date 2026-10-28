import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Panel from "@/components/Panel";
import { CALL_CLS } from "@/components/portfolio/IdeaCard";
import { getIdeas } from "@/lib/actions/ideas.actions";
import { CALL_LABEL } from "@/lib/decision";
import { signedPct } from "@/lib/format";

// The same answer the ideas page gives, on the stock's own page, so nothing here can contradict it.
export default async function SystemCall({ symbol }: { symbol: string }) {
    const r = await getIdeas().catch(() => null);
    const idea = r?.ideas.find((i) => i.symbol === symbol.toUpperCase());
    return (
        <Panel title="מה המערכת אומרת" sub="ההחלטה של השיטה, כמו בעמוד מה לקנות">
            {idea ? (
                <div className="flex flex-col gap-2.5 p-4">
                    <span className={`pill self-start ${CALL_CLS[idea.call]}`}>{CALL_LABEL[idea.call]}</span>
                    <p className="text-[14px] leading-snug text-foreground">{idea.callText}</p>
                    <p className="text-[13px] text-muted-foreground">
                        בשנה רגילה <span dir="ltr" className="num font-semibold">{signedPct(idea.estimate.systemPct)}</span>
                        {idea.estimate.rangeLowPct !== null && idea.estimate.rangeHighPct !== null && <> · שנה רעה <span dir="ltr" className="num text-down">{signedPct(idea.estimate.rangeLowPct)}</span> · שנה טובה <span dir="ltr" className="num text-up">{signedPct(idea.estimate.rangeHighPct)}</span></>}
                    </p>
                    <Link href={`/portfolio/ideas/${encodeURIComponent(idea.symbol)}`} className="btn btn-ghost self-start">כל מה שצריך כדי להחליט <ArrowLeft /></Link>
                </div>
            ) : (
                <p className="p-4 text-[13.5px] text-muted-foreground">השיטה מדרגת רק את המניות הגדולות בתל אביב, אז אין לה החלטה על המניה הזו.</p>
            )}
        </Panel>
    );
}
