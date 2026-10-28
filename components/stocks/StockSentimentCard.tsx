import type { StockSentimentInsights } from '@/lib/actions/adanos.helpers';
import { cn } from '@/lib/utils';

interface StockSentimentCardProps {
    insight: StockSentimentInsights | null;
}

function formatScore(value: number | null, suffix: string): string {
    if (value === null) return '—';
    return `${value.toFixed(1)}${suffix}`;
}

function formatCompactNumber(value: number): string {
    return new Intl.NumberFormat('he-IL', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

const ALIGNMENT_HE: Record<string, string> = {
    'Bullish alignment': 'כולם שוריים',
    'Bearish alignment': 'כולם דוביים',
    'Wide divergence': 'פער גדול',
    Mixed: 'מעורב',
    'Tight alignment': 'הסכמה רחבה',
    'No sentiment mix': 'אין מספיק נתונים',
};

const METRIC_HE: Record<string, string> = { Mentions: 'אזכורים', Trades: 'עסקאות' };

const TREND_HE: Record<string, string> = { rising: 'עולה', falling: 'יורדת', stable: 'יציבה' };

const TREND_CLASS: Record<string, string> = {
    rising: 'is-up',
    falling: 'is-down',
    stable: '',
};

function getAlignmentClass(alignment: string): string {
    if (alignment === 'Bullish alignment') return 'text-up';
    if (alignment === 'Bearish alignment' || alignment === 'Wide divergence') return 'text-down';
    if (alignment === 'Mixed') return 'text-warn';
    return 'text-muted-foreground';
}

export default function StockSentimentCard({ insight }: StockSentimentCardProps) {
    if (!insight) {
        return null;
    }

    const summary = [
        { label: 'באזז ממוצע', value: formatScore(insight.averageBuzz, '/100') },
        { label: 'שוריים בממוצע', value: formatScore(insight.bullishAverage, '%') },
        { label: 'כיסוי', value: `${insight.availableSources} מתוך 4 מקורות` },
    ];

    return (
        <div className="flex flex-col">
            <div className="grid grid-cols-3 gap-2 p-3">
                {summary.map(({ label, value }) => (
                    <div key={label} className="min-w-0">
                        <p className="kicker">{label}</p>
                        <p className="num mt-1 truncate font-bold text-foreground">{value}</p>
                    </div>
                ))}
            </div>
            <p className="border-t border-line px-3 py-2.5 text-[12.5px] text-faint">
                הסכמה בין המקורות: <span className={cn('font-semibold', getAlignmentClass(insight.sourceAlignment))}>{ALIGNMENT_HE[insight.sourceAlignment] ?? insight.sourceAlignment}</span>
            </p>

            <ul className="row-list border-t border-line">
                {insight.sources.map((source) => (
                    <li key={source.source} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{source.label === 'News' ? 'חדשות' : source.label}</p>
                            <p className="num truncate text-[12px] text-faint">
                                {formatCompactNumber(source.metricValue)} {METRIC_HE[source.metricLabel] ?? source.metricLabel.toLowerCase()}
                            </p>
                        </div>
                        <div className="num text-left text-[12.5px]">
                            <p className="font-semibold text-foreground">{formatScore(source.buzzScore, '')}</p>
                            <p className="text-faint">באזז</p>
                        </div>
                        <span className={cn('pill w-[74px] justify-center capitalize', TREND_CLASS[source.trend ?? ''])}>
                            {source.bullishPct !== null ? `${source.bullishPct.toFixed(0)}% שוריים` : (TREND_HE[source.trend ?? ''] ?? 'אין מגמה')}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
