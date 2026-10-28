import { Suspense } from "react";
import { CandlestickChart } from "lucide-react";
import TradingViewWidget from "@/components/TradingViewWidget";
import StockHeader, { StockHeaderSkeleton } from "@/components/stocks/StockHeader";
import StockSentimentCard from "@/components/stocks/StockSentimentCard";
import StockChart from "@/components/stocks/StockChart";
import Panel from "@/components/Panel";
import SystemCall from "@/components/stocks/SystemCall";
import {
    TECHNICAL_ANALYSIS_WIDGET_CONFIG,
    COMPANY_PROFILE_WIDGET_CONFIG,
    COMPANY_FINANCIALS_WIDGET_CONFIG,
} from "@/lib/constants";
import { getStockSentimentInsights } from '@/lib/actions/adanos.actions';
import { getStockMetrics } from '@/lib/actions/finnhub.actions';
import { formatSymbolForTradingView, isChartEmbeddable, tradingViewSymbolUrl } from '@/lib/utils';

const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

async function Sentiment({ symbol }: { symbol: string }) {
    const insight = await getStockSentimentInsights(symbol);
    if (!insight) return null;
    return (
        <Panel title="סנטימנט" sub="Reddit, X.com, חדשות ו-Polymarket">
            <StockSentimentCard insight={insight} />
        </Panel>
    );
}

async function DividendYield({ symbol }: { symbol: string }) {
    const dividendYield = await getStockMetrics(symbol);
    return (
        <Panel title="תשואת דיבידנד">
            <p className="num text-2xl font-semibold text-white">
                {dividendYield !== null ? `${dividendYield.toFixed(2)}%` : "—"}
            </p>
        </Panel>
    );
}

// Charts come straight from TradingView (live, no quota); only the header waits on Finnhub, and it streams.
export default async function StockDetails({ params }: StockDetailsPageProps) {
    const { symbol: rawSymbol } = await params;
    const symbol = decodeURIComponent(rawSymbol).toUpperCase();
    const tvSymbol = formatSymbolForTradingView(symbol);

    return (
        <>
            <Suspense fallback={<StockHeaderSkeleton />}>
                <StockHeader symbol={symbol} />
            </Suspense>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
                <div className="flex min-w-0 flex-col gap-3">
                    {isChartEmbeddable(tvSymbol) ? (
                        <StockChart tvSymbol={tvSymbol} scriptUrl={`${scriptUrl}advanced-chart.js`} />
                    ) : (
                        // TradingView refuses this exchange's chart in embeds; say so instead of showing its error
                        <Panel title="גרף" sub="לבורסה הזו רק באתר TradingView">
                            <div className="empty-state py-14">
                                <span className="empty-icon"><CandlestickChart className="size-5" /></span>
                                <h3>הגרף לא זמין כאן</h3>
                                <p className="max-w-80 text-[13px]">
                                    TradingView לא מרשה להציג גרפים של {tvSymbol.split(':')[0]} באתרים אחרים. הדוחות, הניתוח הטכני והפרופיל למטה עובדים.
                                </p>
                                <a href={tradingViewSymbolUrl(tvSymbol)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-2">
                                    לגרף ב-TradingView
                                </a>
                            </div>
                        </Panel>
                    )}
                    <Panel title="דוחות כספיים" sub="דוח רווח והפסד, מאזן ויחסים פיננסיים">
                        <TradingViewWidget
                            scriptUrl={`${scriptUrl}financials.js`}
                            config={COMPANY_FINANCIALS_WIDGET_CONFIG(tvSymbol)}
                            height={500}
                        />
                    </Panel>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                    <Suspense fallback={null}>
                        <SystemCall symbol={symbol} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <DividendYield symbol={symbol} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <Sentiment symbol={symbol} />
                    </Suspense>
                    <details className="hatch">
                        <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-semibold text-muted-foreground">ניתוח טכני של TradingView (לפי שעה, לא חלק מהשיטה)</summary>
                        <p className="px-4 pb-2 text-[12.5px] text-faint">המד הזה מסתכל על התנועה בשעות האחרונות, ולכן הוא משתנה כל הזמן ויכול להגיד &quot;מכירה&quot; על מניה שהשיטה קונה. למשקיע שקונה פעם בחודש הוא לא רלוונטי.</p>
                        <div className="card">
                            <TradingViewWidget
                                scriptUrl={`${scriptUrl}technical-analysis.js`}
                                config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(tvSymbol)}
                                height={400}
                            />
                        </div>
                    </details>
                    <Panel title="פרופיל" sub="במה החברה עוסקת">
                        <TradingViewWidget
                            scriptUrl={`${scriptUrl}symbol-profile.js`}
                            config={COMPANY_PROFILE_WIDGET_CONFIG(tvSymbol)}
                            height={440}
                        />
                    </Panel>
                </div>
            </div>
        </>
    );
}
