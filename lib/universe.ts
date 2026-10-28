// The candidates the buy-ideas screen measures: the large Tel Aviv names (roughly the TA-35 and the bigger
// TA-125 members) plus three broad index funds. Hebrew names are the ones Israeli brokers display.

export type UniverseKind = 'index' | 'stock';
export type UniverseEntry = { symbol: string; he: string; kind: UniverseKind; sector: string };

export const UNIVERSE: UniverseEntry[] = [
    { symbol: 'SPY', he: 'מדד S&P 500', kind: 'index', sector: '500 החברות הגדולות בארה"ב' },
    { symbol: 'VXUS', he: 'מדד עולמי ללא ארה"ב', kind: 'index', sector: 'אירופה, יפן, שווקים מתעוררים' },
    { symbol: 'QQQ', he: 'מדד נאסד"ק 100', kind: 'index', sector: 'טכנולוגיה אמריקאית' },

    { symbol: 'LUMI.TA', he: 'לאומי', kind: 'stock', sector: 'בנקים' },
    { symbol: 'POLI.TA', he: 'פועלים', kind: 'stock', sector: 'בנקים' },
    { symbol: 'DSCT.TA', he: 'דיסקונט', kind: 'stock', sector: 'בנקים' },
    { symbol: 'MZTF.TA', he: 'מזרחי טפחות', kind: 'stock', sector: 'בנקים' },
    { symbol: 'FIBI.TA', he: 'הבינלאומי', kind: 'stock', sector: 'בנקים' },
    { symbol: 'PHOE.TA', he: 'הפניקס', kind: 'stock', sector: 'ביטוח' },
    { symbol: 'HARL.TA', he: 'הראל', kind: 'stock', sector: 'ביטוח' },
    { symbol: 'CLIS.TA', he: 'כלל ביטוח', kind: 'stock', sector: 'ביטוח' },
    { symbol: 'MGDL.TA', he: 'מגדל', kind: 'stock', sector: 'ביטוח' },
    { symbol: 'TEVA.TA', he: 'טבע', kind: 'stock', sector: 'פארמה' },
    { symbol: 'NICE.TA', he: 'נייס', kind: 'stock', sector: 'תוכנה' },
    { symbol: 'ESLT.TA', he: 'אלביט מערכות', kind: 'stock', sector: 'ביטחוני' },
    { symbol: 'NVMI.TA', he: 'נובה', kind: 'stock', sector: 'שבבים' },
    { symbol: 'TSEM.TA', he: 'טאואר', kind: 'stock', sector: 'שבבים' },
    { symbol: 'ICL.TA', he: 'כי"ל', kind: 'stock', sector: 'כימיקלים' },
    { symbol: 'BEZQ.TA', he: 'בזק', kind: 'stock', sector: 'תקשורת' },
    { symbol: 'PTNR.TA', he: 'פרטנר', kind: 'stock', sector: 'תקשורת' },
    { symbol: 'CEL.TA', he: 'סלקום', kind: 'stock', sector: 'תקשורת' },
    { symbol: 'AZRG.TA', he: 'קבוצת עזריאלי', kind: 'stock', sector: 'נדל"ן' },
    { symbol: 'MLSR.TA', he: 'מליסרון', kind: 'stock', sector: 'נדל"ן' },
    { symbol: 'BIG.TA', he: 'ביג', kind: 'stock', sector: 'נדל"ן' },
    { symbol: 'AMOT.TA', he: 'אמות', kind: 'stock', sector: 'נדל"ן' },
    { symbol: 'ALHE.TA', he: 'אלוני חץ', kind: 'stock', sector: 'נדל"ן' },
    { symbol: 'MVNE.TA', he: 'מבנה', kind: 'stock', sector: 'נדל"ן' },
    { symbol: 'AURA.TA', he: 'אאורה', kind: 'stock', sector: 'נדל"ן למגורים' },
    { symbol: 'ISCN.TA', he: 'ישראל קנדה', kind: 'stock', sector: 'נדל"ן למגורים' },
    { symbol: 'DLEKG.TA', he: 'קבוצת דלק', kind: 'stock', sector: 'אנרגיה' },
    { symbol: 'NWMD.TA', he: 'ניו-מד אנרג\'י', kind: 'stock', sector: 'אנרגיה' },
    { symbol: 'ORA.TA', he: 'אורמת', kind: 'stock', sector: 'אנרגיה מתחדשת' },
    { symbol: 'ENLT.TA', he: 'אנלייט', kind: 'stock', sector: 'אנרגיה מתחדשת' },
    { symbol: 'ENRG.TA', he: 'אנרג\'יקס', kind: 'stock', sector: 'אנרגיה מתחדשת' },
    { symbol: 'OPCE.TA', he: 'או.פי.סי', kind: 'stock', sector: 'חשמל' },
    { symbol: 'SAE.TA', he: 'שופרסל', kind: 'stock', sector: 'קמעונאות' },
    { symbol: 'STRS.TA', he: 'שטראוס', kind: 'stock', sector: 'מזון' },
    { symbol: 'FTAL.TA', he: 'פתאל', kind: 'stock', sector: 'מלונאות' },
    { symbol: 'ELAL.TA', he: 'אל על', kind: 'stock', sector: 'תעופה' },
    { symbol: 'SPEN.TA', he: 'שפיר הנדסה', kind: 'stock', sector: 'תשתיות' },
    { symbol: 'DANE.TA', he: 'דנאל', kind: 'stock', sector: 'סיעוד' },
    { symbol: 'MTRX.TA', he: 'מטריקס', kind: 'stock', sector: 'שירותי מחשוב' },
    { symbol: 'ONE.TA', he: 'וואן טכנולוגיות', kind: 'stock', sector: 'שירותי מחשוב' },
    { symbol: 'FORTY.TA', he: 'פורמולה מערכות', kind: 'stock', sector: 'שירותי מחשוב' },
];

const BY_SYMBOL = new Map(UNIVERSE.map((u) => [u.symbol, u]));

// The Hebrew display name for a symbol, when we know one; otherwise the fallback (usually the English name).
export function hebrewName(symbol: string, fallback?: string): string {
    return BY_SYMBOL.get(symbol.toUpperCase())?.he ?? fallback ?? symbol;
}

export function universeEntry(symbol: string): UniverseEntry | undefined {
    return BY_SYMBOL.get(symbol.toUpperCase());
}

export const hasHebrew = (s: string) => /[֐-׿]/.test(s);

// Finnhub's search only understands Latin names, so a Hebrew query ("פניקס", "בנק לאומי") is matched here:
// quote marks and a leading ה are ignored on both sides, and either side may contain the other.
const normalise = (s: string) => s.replace(/["'״׳\-.]/g, '').replace(/\s+/g, ' ').trim();
const bare = (s: string) => normalise(s).replace(/^ה(?=\S{2})/, '');

export function searchHebrew(query: string): UniverseEntry[] {
    const q = bare(query);
    if (!q) return [];
    return UNIVERSE.filter((u) => {
        const name = bare(u.he);
        const words = normalise(u.he).split(' ').map(bare);
        return name.includes(q) || q.includes(name) || words.some((w) => w.length > 1 && (w.startsWith(q) || q.split(' ').includes(w)));
    });
}
