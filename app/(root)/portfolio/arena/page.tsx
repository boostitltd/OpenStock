import Link from "next/link";
import { Lightbulb, Sigma } from "lucide-react";
import Panel from "@/components/Panel";
import ArenaChart from "@/components/portfolio/ArenaChart";
import { getArena } from "@/lib/actions/ideas.actions";
import { PASS_BEAT, type MethodResult } from "@/lib/arena";
import { money } from "@/lib/format";

export const metadata = { title: 'זירת הקופים | OpenStock' };

const monthHe = (ym: string) => new Date(`${ym}-15`).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

function why(m: MethodResult, typical: [number, number]) {
    if (m.passed) return `ניצחה ${m.beatMonkeysPct}% מהקופים, וגם את הקוף האמצעי בכל עשור בנפרד.`;
    if (m.beatMonkeysPct < PASS_BEAT) return `ניצחה רק ${m.beatMonkeysPct}% מהקופים. קוף שבוחר באקראי עושה את זה לא פעם.`;
    const lost = [m.decadePcts[0] <= typical[0] ? '2006 עד 2015' : null, m.decadePcts[1] <= typical[1] ? '2016 עד היום' : null].filter(Boolean).join(' וגם ב-');
    return `ניצחה ${m.beatMonkeysPct}% מהקופים על כל התקופה, אבל ב-${lost} היא לא עברה את הקוף האמצעי. ההצלחה שלה באה מתקופה אחת.`;
}

// Other ways of choosing stocks against monkeys, through the method's own rules, and a live game from now on.
export default async function ArenaPage() {
    const { asOf, arena, paper } = await getArena();
    const typical: [number, number] = arena ? [arena.monkey.first, arena.monkey.second] : [0, 0];
    const system = arena?.methods.find((m) => m.id === 'momentum');
    const top = arena?.methods[0];
    const passed = arena?.methods.filter((m) => m.passed) ?? [];

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">זירת הקופים</h1>
                    <p className="page-sub max-w-4xl">
                        כמה דרכים לבחור מניות, כולן לפי אותם כללים: כל חודש קונים 5 מניות, אחת מכל ענף, ומוכרים מניה כשהיא יוצאת מ-15 המובילות. מולן מתחרים {arena?.monkeys ?? 300} קופים שמסדרים את המניות באקראי. שיטה שלא מנצחת כמעט את כל הקופים, היא כנראה מזל.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/portfolio/strategy" className="btn btn-ghost"><Sigma /> השיטה</Link>
                    <Link href="/portfolio/ideas" className="btn btn-ghost"><Lightbulb /> מה לקנות</Link>
                </div>
            </header>

            {!arena ? (
                <Panel title="התחרות"><p className="px-4 py-6 text-[13.5px] text-faint">הנתונים עוד לא זמינים. נסו שוב בעוד כמה דקות.</p></Panel>
            ) : (
                <div className="flex flex-col gap-3">
                    <Panel title="מה יצא" sub={`1,000 ש"ח בכל חודש מ-2006 עד ${monthHe(asOf)}`}>
                        <div className="flex flex-col gap-2 p-4 text-[14px] leading-relaxed text-foreground">
                            {system && <p>{system.passed ? <>השיטה של המערכת <b>עברה את המבחן</b>: {why(system, typical)}</> : <>השיטה של המערכת <b>לא עברה את המבחן</b>. {why(system, typical)}</>}</p>}
                            <p className="text-muted-foreground">
                                עברו את המבחן: {passed.length ? passed.map((m) => m.name).join(', ') : 'אף שיטה'}. לא עברו: {arena.methods.filter((m) => !m.passed).map((m) => m.name).join(', ') || 'אין'}.
                            </p>
                            {system && top && top.id !== 'momentum' && top.passed && system.passed && (
                                <p className="text-muted-foreground">
                                    השיטה <b className="text-foreground">{top.name}</b> יצאה קצת יותר טוב ({top.afterTaxPct}% בשנה אחרי מס, מול {system.afterTaxPct}%). לא מחליפים אליה. השיטה של המערכת נבחרה מראש, לפי המחקר, לפני שראינו את התוצאות. לבחור את המנצחת אחרי שרואים את התוצאות, זו בדיוק המלכודת שהקופים נועדו לתפוס. וגם הסדר ביניהן מתהפך: ב-2006 עד 2015 {system.decadePcts[0] > top.decadePcts[0] ? 'השיטה של המערכת' : `השיטה ${top.name}`} הובילה, וב-2016 עד היום {system.decadePcts[1] > top.decadePcts[1] ? 'השיטה של המערכת' : `השיטה ${top.name}`}.
                                </p>
                            )}
                        </div>
                    </Panel>

                    <Panel title="השיטות מול הקופים" sub="תשואה בשנה, בלי מס, כדי שההשוואה לקופים תהיה הוגנת: קוף מוכר הרבה יותר, ומשלם יותר מס">
                        <div className="p-4"><ArenaChart arena={arena} /></div>
                    </Panel>

                    <Panel title="הטבלה המלאה" sub={`שיטה עוברת אם ניצחה לפחות ${PASS_BEAT}% מהקופים על כל התקופה, וגם את הקוף האמצעי בכל עשור לבד`}>
                        <div className="overflow-x-auto rounded-[12px]">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>שיטה</th><th className="is-num">בשנה, אחרי מס</th><th className="is-num">בלי מס</th>
                                        <th className="is-num">2006 עד 2015 <span className="block text-[11px] font-normal text-faint">קוף אמצעי {typical[0]}%</span></th>
                                        <th className="is-num">2016 עד היום <span className="block text-[11px] font-normal text-faint">קוף אמצעי {typical[1]}%</span></th>
                                        <th className="is-num">ניצחה קופים</th><th>תוצאה</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {arena.methods.map((m) => (
                                        <tr key={m.id}>
                                            <td className="font-semibold text-foreground">{m.name}{m.id === 'momentum' && <span className="ms-1.5 text-[11.5px] font-normal text-brand-ink">השיטה של המערכת</span>}<span className="block max-w-[300px] whitespace-normal text-[12px] font-normal text-faint">{m.how}</span></td>
                                            <td className="is-num font-semibold">{m.afterTaxPct}%</td>
                                            <td className="is-num text-muted-foreground">{m.beforeTaxPct}%</td>
                                            <td className={`is-num ${m.decadePcts[0] > typical[0] ? '' : 'text-down'}`}>{m.decadePcts[0]}%</td>
                                            <td className={`is-num ${m.decadePcts[1] > typical[1] ? '' : 'text-down'}`}>{m.decadePcts[1]}%</td>
                                            <td className="is-num">{m.beatMonkeysPct}%</td>
                                            <td className="min-w-[240px] whitespace-normal text-[12.5px] leading-snug">
                                                <span className={`pill ${m.passed ? 'is-up' : ''}`}>{m.passed ? 'עברה' : 'לא עברה'}</span>
                                                <span className="mt-1 block text-muted-foreground">{why(m, typical)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr><td className="text-muted-foreground">הקוף האמצעי</td><td className="is-num">{arena.monkey.medianAfterTaxPct}%</td><td className="is-num text-muted-foreground">{arena.monkey.medianPct}%</td><td className="is-num">{typical[0]}%</td><td className="is-num">{typical[1]}%</td><td /><td className="text-[12.5px] text-faint">אותם כללים, בחירה אקראית</td></tr>
                                    <tr><td className="text-muted-foreground">כל המניות בחלקים שווים</td><td className="is-num">{arena.equal.afterTaxPct}%</td><td /><td /><td /><td /><td className="text-[12.5px] text-faint">קונים הכול ולא מוכרים</td></tr>
                                    <tr><td className="text-muted-foreground">מדד ת&quot;א 125</td><td className="is-num">{arena.index.afterTaxPct}%</td><td /><td /><td /><td /><td className="text-[12.5px] text-faint">בלי דיבידנדים, ולכן נמוך מדי בכ-2% עד 3% בשנה</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    <Panel title="המשחק החי" sub={`מ${monthHe(paper.start)}: כל שיטה מקבלת 1,000 ש"ח מדומים בחודש וקונה ומוכרת לבד, בלי כסף אמיתי`}>
                        <div className="overflow-x-auto rounded-[12px]">
                            <table className="data-table">
                                <thead><tr><th>מקום</th><th>שיטה</th><th className="is-num">הוכנס</th><th className="is-num">שווה היום, אחרי מס</th><th className="is-num">רווח</th></tr></thead>
                                <tbody>
                                    {paper.rows.map((r, k) => (
                                        <tr key={r.id}>
                                            <td className="text-faint">{k + 1}</td>
                                            <td className={r.id === 'momentum' ? 'font-semibold text-foreground' : ''}>{r.name}{r.id === 'momentum' && <span className="ms-1.5 text-[11.5px] font-normal text-brand-ink">השיטה של המערכת</span>}</td>
                                            <td className="is-num text-muted-foreground">{money(r.invested, 'ILS')}</td>
                                            <td className="is-num font-semibold">{money(r.value, 'ILS')}</td>
                                            <td className={`is-num ${r.gainPct > 0 ? 'text-up' : r.gainPct < 0 ? 'text-down' : 'text-muted-foreground'}`}><span dir="ltr">{r.gainPct > 0 ? '+' : ''}{r.gainPct}%</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="px-4 pb-3 pt-2 text-[12.5px] leading-relaxed text-faint">
                            {paper.monkeyRange && <>8 מכל 10 קופים נמצאים כרגע בין <span dir="ltr">{paper.monkeyRange[0]}%</span> ל-<span dir="ltr">{paper.monkeyRange[1]}%</span>. </>}
                            הקניות נעשות במחיר של סוף כל חודש, ובחודש הנוכחי במחיר של היום. הכללים קבועים מראש, כך שאי אפשר לשפר אותם בדיעבד. שנה או שנתיים של משחק לא יגידו איזו שיטה עדיפה, כי בטווח כזה המזל חזק מהשיטה. המשחק נועד לבדוק שהשיטה מתנהגת במציאות כמו בבדיקה.
                        </p>
                    </Panel>

                    <div className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                        <p className="font-semibold text-foreground">מה צריך לדעת</p>
                        <p>• התשואות כוללות את הדיבידנדים, כאילו הושקעו מחדש. הנתונים של Yahoo לתל אביב לא כוללים אותם, ולכן הם מחושבים כאן מרשימת הדיבידנדים של כל מניה.</p>
                        <p>• הבדיקה רצה על המניות הגדולות של היום. חברות שנעלמו בדרך לא בפנים, ולכן כל המספרים גבוהים מהמציאות. זה פוגע בכל השיטות ובקופים באותה מידה, כך שההשוואה ביניהם עדיין הוגנת.</p>
                        <p>• לא בדקנו &quot;זולה ביחס לרווח&quot;, כי אין נתוני רווח היסטוריים. &quot;מה שירד הכי הרבה&quot; היא הדרך הקרובה ביותר לבדוק &quot;לקנות בזול&quot; עם מחירים בלבד.</p>
                        <p>• בדקנו {arena.methods.length} שיטות. גם עם כמה שיטות, לפעמים אחת עוברת במזל. לכן יש גם את המבחן של כל עשור לבד.</p>
                    </div>
                </div>
            )}
        </>
    );
}
