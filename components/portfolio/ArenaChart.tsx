import type { ArenaResult } from "@/lib/arena";

// Each method's yearly return before tax, against the band where 9 of 10 monkeys landed. One measure, one scale;
// a method that passed the luck test is drawn in the brand colour and says so in words, never by colour alone.
export default function ArenaChart({ arena }: { arena: ArenaResult }) {
    const { monkey, methods } = arena;
    const max = Math.max(...methods.map((m) => m.beforeTaxPct), monkey.p95Pct) * 1.25;   // room for the value label at the end of the longest bar
    const at = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
    return (
        <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2.5">
                {[...methods].sort((a, b) => b.beforeTaxPct - a.beforeTaxPct).map((m) => (
                    <li key={m.id} className="grid grid-cols-[9.5rem_1fr] items-center gap-3 sm:grid-cols-[12rem_1fr]">
                        <span className="text-[13px] leading-tight text-foreground">
                            {m.name}
                            <span className={`block text-[11.5px] ${m.passed ? 'text-brand-ink' : 'text-faint'}`}>{m.passed ? 'עברה את המבחן' : 'לא עברה'}</span>
                        </span>
                        <div className="relative h-7" title={`${m.name}: ${m.beforeTaxPct}% בשנה בלי מס. ניצחה ${m.beatMonkeysPct}% מהקופים.`}>
                            <div className="absolute inset-y-0 rounded-[4px] bg-[var(--line)]" style={{ insetInlineStart: at(monkey.p5Pct), width: `calc(${at(monkey.p95Pct)} - ${at(monkey.p5Pct)})` }} />
                            <div className="absolute inset-y-[-3px] w-[2px] bg-[var(--line-strong)]" style={{ insetInlineStart: at(monkey.medianPct) }} />
                            <div className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-e-[4px] ${m.passed ? 'bg-[var(--brand)]' : 'bg-[var(--faint)]'}`} style={{ insetInlineStart: 0, width: at(m.beforeTaxPct) }} />
                            <span className="num absolute top-1/2 -translate-y-1/2 ps-1.5 text-[12.5px] font-semibold text-foreground" style={{ insetInlineStart: at(m.beforeTaxPct) }}>{m.beforeTaxPct}%</span>
                        </div>
                    </li>
                ))}
            </ul>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
                <li className="flex items-center gap-1.5"><span className="inline-block h-3 w-6 rounded-[3px] bg-[var(--line)]" aria-hidden /> כאן נחתו 9 מכל 10 קופים ({monkey.p5Pct}% עד {monkey.p95Pct}%)</li>
                <li className="flex items-center gap-1.5"><span className="inline-block h-3.5 w-[2px] bg-[var(--line-strong)]" aria-hidden /> הקוף האמצעי ({monkey.medianPct}%)</li>
            </ul>
        </div>
    );
}
