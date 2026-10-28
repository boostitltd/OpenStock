import type { BacktestPoint } from "@/lib/momentum";

const SERIES = [
    { key: 'strategyTaxFree', label: 'השיטה בחשבון פטור ממס', color: 'var(--brand)', dash: '5 4' },
    { key: 'strategy', label: 'השיטה, אחרי מס', color: 'var(--brand)', dash: '' },
    { key: 'equal', label: 'כל המניות שוות', color: 'oklch(0.75 0.12 80)', dash: '' },
    { key: 'index', label: 'מדד ת"א 125', color: 'oklch(0.7 0.02 260)', dash: '' },
    { key: 'invested', label: 'הכסף שהוכנס', color: 'oklch(0.55 0 0)', dash: '2 4' },
] as const;

const fmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} מיליון` : `${Math.round(v / 1000)} אלף`);

// Year-end values of 1,000 ש"ח a month under each approach. Time runs left to right, as on every financial chart.
export default function BacktestChart({ points }: { points: BacktestPoint[] }) {
    if (points.length < 2) return null;
    const W = 900, H = 320, L = 64, R = 16, T = 16, B = 30;
    const max = Math.max(...points.map((p) => Math.max(p.strategyTaxFree, p.strategy, p.equal, p.index)));
    const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R);
    const y = (v: number) => T + (1 - v / max) * (H - T - B);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
    return (
        <div className="flex flex-col gap-2">
            <div dir="ltr"><svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="השיטה מול קנייה שווה ומול המדד, לאורך השנים">
                {ticks.map((t) => (
                    <g key={t}>
                        <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                        <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">{t ? fmt(t) : '0'}</text>
                    </g>
                ))}
                {points.map((p, i) => (i % 2 === 0 || i === points.length - 1) && (
                    <text key={p.month} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--faint)">{p.month.slice(0, 4)}</text>
                ))}
                {SERIES.map((s) => (
                    <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={s.key === 'strategy' ? 2.6 : 1.8} strokeDasharray={s.dash}
                        points={points.map((p, i) => `${x(i)},${y(p[s.key])}`).join(' ')} />
                ))}
            </svg></div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
                {SERIES.map((s) => (
                    <li key={s.key} className="flex items-center gap-1.5">
                        <svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth="2.4" strokeDasharray={s.dash} /></svg>
                        {s.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
