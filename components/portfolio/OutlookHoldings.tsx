import Link from "next/link";
import type { HoldingOutlook } from "@/lib/server/outlook";
import type { Currency } from "@/lib/portfolio";
import { changeWords, dateHe, money, pct, price } from "@/lib/format";
import { formatPrice } from "@/lib/utils";
import { hebrewName } from "@/lib/universe";

const tone = (v: number | null | undefined) => (v == null ? 'text-muted-foreground' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted-foreground');

const REC: Record<string, string> = { strong_buy: 'קנייה חזקה', buy: 'קנייה', hold: 'החזקה', underperform: 'תשואת חסר', sell: 'מכירה' };

function Row({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-faint">{label}</span>
            <span className={`num text-left ${className}`}>{value}</span>
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
                if (s?.vsMa200Pct != null) signals.push(s.vsMa200Pct >= 0 ? { text: 'במגמת עלייה', kind: 'up' } : { text: 'במגמת ירידה', kind: 'down' });
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
                            <Row label="יעד מכירה" value={h.targetPrice ? `${price(h.targetPrice, h.currency)}${h.targetReached ? ', הושג' : h.targetDistancePct != null ? `, חסרים עוד ${h.targetDistancePct.toFixed(0)}%` : ''}` : 'לא נקבע'} className={h.targetReached ? 'text-brand-ink' : 'text-foreground'} />
                            {h.thesis && <p className="text-[12.5px] leading-snug text-muted-foreground">&quot;{h.thesis}&quot;</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">מה יכול לקרות לחלק הזה בתיק בשנה הקרובה</p>
                            {sim ? (
                                <>
                                    <Row label="שנה רעה (1 מכל 10)" value={money(sim.p10, base)} className="text-down" />
                                    <Row label="שנה רגילה" value={money(sim.p50, base)} className="font-semibold text-foreground" />
                                    <Row label="שנה טובה (1 מכל 10)" value={money(sim.p90, base)} className="text-up" />
                                    <Row label="הסיכוי להיות בהפסד בעוד שנה" value={`${sim.probBelowContributed.toFixed(0)}%`} className="text-muted-foreground" />
                                </>
                            ) : <p className="text-[12.5px] text-faint">אין מספיק היסטוריה</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">מה אומרים עליה</p>
                            <Row label="המחיר שהאנליסטים צופים" value={f?.targetMeanPrice ? `${price(f.targetMeanPrice, h.currency)}, ${h.analystUpsidePct != null ? changeWords(h.analystUpsidePct) : ''} · ${f.analysts === 1 ? 'אנליסט אחד' : `${f.analysts ?? '?'} אנליסטים`}` : 'אין אנליסטים שמכסים אותה'} className={tone(h.analystUpsidePct)} />
                            {f?.recommendation && <Row label="המלצת האנליסטים" value={REC[f.recommendation] ?? f.recommendation} className="text-foreground" />}
                            <Row label="המחיר שווה כמה שנות רווח" value={f?.trailingPE ? `${f.trailingPE.toFixed(0)} שנים` : '—'} className="text-foreground" />
                            <Row label="דיבידנד בשנה" value={f?.dividendYieldPct != null ? `${f.dividendYieldPct.toFixed(2)}%` : '—'} className="text-foreground" />
                            <Row label="הדוח הבא" value={f?.nextEarnings ? dateHe(f.nextEarnings) : '—'} className="text-foreground" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="kicker">מה קרה לה בשלוש השנים האחרונות</p>
                            <Row label="עלתה בממוצע לשנה" value={pct(s?.annualReturnPct)} className={tone(s?.annualReturnPct)} />
                            <Row label="כמה היא קופצת בשנה רגילה" value={s ? `±${s.annualVolPct.toFixed(0)}%` : '—'} className="text-foreground" />
                            <Row label="הירידה הכי גדולה" value={pct(s?.maxDrawdownPct)} className="text-down" />
                            <Row label="מול המחיר הממוצע ב-10 החודשים האחרונים" value={pct(s?.vsMa200Pct)} className={tone(s?.vsMa200Pct)} />
                            <Row label="מול המחיר הגבוה בשנה האחרונה" value={pct(s?.fromHigh52wPct)} className={tone(s?.fromHigh52wPct)} />
                            <Row label="זזה יחד עם שאר התיק?" value={h.correlationWithRest == null ? 'זו המניה היחידה בתיק' : h.correlationWithRest >= 0.6 ? 'כמעט תמיד' : h.correlationWithRest >= 0.3 ? 'לפעמים' : 'כמעט לא'} className="text-foreground" />
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
