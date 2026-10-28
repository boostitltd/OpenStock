import Link from "next/link";
import type { HoldingOutlook } from "@/lib/actions/outlook.actions";
import type { Currency } from "@/lib/portfolio";
import { dateHe, money, pct } from "@/lib/format";
import { formatPrice } from "@/lib/utils";
import { hebrewName } from "@/lib/universe";

const tone = (v: number | null | undefined) => (v == null ? 'text-muted-foreground' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted-foreground');

const REC: Record<string, string> = { strong_buy: 'קנייה חזקה', buy: 'קנייה', hold: 'החזקה', underperform: 'תשואת חסר', sell: 'מכירה' };

function Row({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-faint">{label}</span>
            <span className={`num text-end ${className}`}>{value}</span>
        </div>
    );
}

export default function OutlookHoldings({ holdings, base }: { holdings: HoldingOutlook[]; base: Currency }) {
    return (
        <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {holdings.map((h) => {
                const f = h.fundamentals, s = h.stats, sim = h.sim1y;
                const signals: { text: string; kind: 'up' | 'down' | 'brand' }[] = [];
                if (h.targetReached) signals.push({ text: 'הגיעה ליעד שלך', kind: 'brand' });
                if (s?.vsMa200Pct != null) signals.push(s.vsMa200Pct >= 0 ? { text: 'מעל ממוצע 200 הימים', kind: 'up' } : { text: 'מתחת לממוצע 200 הימים', kind: 'down' });
                if (s && s.fromHigh52wPct <= -15) signals.push({ text: `${Math.abs(s.fromHigh52wPct).toFixed(0)}% מתחת לשיא השנתי`, kind: 'down' });
                return (
                    <section key={h.symbol} className="flex flex-col gap-3 rounded-[12px] bg-page/60 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Link href={`/stocks/${encodeURIComponent(h.symbol)}`} className="block truncate font-semibold text-foreground hover:text-brand-ink">{hebrewName(h.symbol, h.name)}</Link>
                                <p className="text-[12px] text-faint"><span dir="ltr" className="mono">{h.symbol}</span> · {h.weightPct.toFixed(1)}% מהתיק · {money(h.value, base)}</p>
                            </div>
                            <span className="num shrink-0 text-[15px] font-semibold text-foreground">{h.price ? formatPrice(h.price, h.currency) : '—'}</span>
                        </div>

                        {signals.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {signals.map((sig) => <span key={sig.text} className={`pill ${sig.kind === 'up' ? 'is-up' : sig.kind === 'down' ? 'is-down' : 'is-brand'}`}>{sig.text}</span>)}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">ההבטחה שלך</p>
                            <Row label="יעד מכירה" value={h.targetPrice ? `${formatPrice(h.targetPrice, h.currency)}${h.targetReached ? ' (הושג)' : h.targetDistancePct != null ? ` (עוד ${h.targetDistancePct.toFixed(1)}%)` : ''}` : 'לא נקבע'} className={h.targetReached ? 'text-brand-ink' : 'text-foreground'} />
                            {h.thesis && <p className="text-[12.5px] leading-snug text-muted-foreground">&quot;{h.thesis}&quot;</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">12 החודשים הבאים: התנודות שלה, מגמה ממוצעת של שוק</p>
                            {sim ? (
                                <>
                                    <Row label="תרחיש רע (10%)" value={money(sim.p10, base)} className="text-down" />
                                    <Row label="אמצע" value={money(sim.p50, base)} className="font-semibold text-foreground" />
                                    <Row label="תרחיש טוב (90%)" value={money(sim.p90, base)} className="text-up" />
                                    <Row label="סיכוי להיות בהפסד" value={`${sim.probBelowContributed.toFixed(0)}%`} className="text-muted-foreground" />
                                </>
                            ) : <p className="text-[12.5px] text-faint">אין מספיק היסטוריה</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">אנליסטים ומכפילים</p>
                            <Row label="יעד ממוצע" value={f?.targetMeanPrice ? `${formatPrice(f.targetMeanPrice, h.currency)} (${pct(h.analystUpsidePct)}) · ${f.analysts === 1 ? 'אנליסט אחד' : `${f.analysts ?? '?'} אנליסטים`}` : 'אין כיסוי ב-Yahoo'} className={tone(h.analystUpsidePct)} />
                            {f?.recommendation && <Row label="המלצה" value={REC[f.recommendation] ?? f.recommendation} className="text-foreground" />}
                            <Row label="מכפיל רווח · צפוי" value={`${f?.trailingPE ? f.trailingPE.toFixed(1) : '—'} · ${f?.forwardPE ? f.forwardPE.toFixed(1) : '—'}`} className="text-foreground" />
                            <Row label="תשואת דיבידנד" value={f?.dividendYieldPct != null ? `${f.dividendYieldPct.toFixed(2)}%` : '—'} className="text-foreground" />
                            <Row label="הדוח הבא" value={f?.nextEarnings ? dateHe(f.nextEarnings) : '—'} className="text-foreground" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">איך היא מתנהגת</p>
                            <Row label="תשואה בעבר, לשנה (3 שנים)" value={pct(s?.annualReturnPct)} className={tone(s?.annualReturnPct)} />
                            <Row label="תנודתיות" value={pct(s?.annualVolPct, false)} className="text-foreground" />
                            <Row label="הנפילה הגרועה (3 שנים)" value={pct(s?.maxDrawdownPct)} className="text-down" />
                            <Row label="מול ממוצע 200 הימים" value={pct(s?.vsMa200Pct)} className={tone(s?.vsMa200Pct)} />
                            <Row label="מול השיא השנתי" value={pct(s?.fromHigh52wPct)} className={tone(s?.fromHigh52wPct)} />
                            <Row label="קשר לשאר התיק" value={h.correlationWithRest == null ? 'המניה היחידה' : `מתאם ${h.correlationWithRest.toFixed(2)}`} className="text-foreground" />
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
