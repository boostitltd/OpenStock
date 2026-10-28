// Hebrew number formatting shared by the pages and the weekly email. Shekel amounts read "5,394 ₪" the way
// Israeli banks print them; percentages carry their sign so a change is never ambiguous.

import type { Currency } from '@/lib/portfolio';

export const money = (v: number, c: Currency = 'ILS', digits = 0) =>
    new Intl.NumberFormat('he-IL', { style: 'currency', currency: c, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);

export const price = (v: number, c: Currency) => money(v, c, 2);

export const pct = (v: number | null | undefined, sign = true, digits = 1) =>
    v == null || !Number.isFinite(v) ? '—' : `${sign && v > 0 ? '+' : ''}${v.toFixed(digits)}%`;

export const num = (v: number, digits = 0) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: digits }).format(v);

export const dateHe = (iso: string | Date) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Jerusalem' });

export const yearsHe = (n: number) => (n === 1 ? 'שנה' : n === 2 ? 'שנתיים' : `${n} שנים`);

// The Hebrew preposition ל- in front of a name: the ה of a definite name merges into it (הפניקס, לפניקס).
export const le = (name: string) => (name.startsWith('ה') ? `ל${name.slice(1)}` : `ל${name}`);

// Company-sized amounts: "7.9 מיליארד $".
export const bigMoney = (v: number, currency: string) => {
    const sign = currency === 'USD' ? '$' : currency === 'ILS' ? '₪' : currency;
    const a = Math.abs(v);
    const n = a >= 1e9 ? `${(v / 1e9).toFixed(1)} מיליארד` : a >= 1e6 ? `${(v / 1e6).toFixed(0)} מיליון` : new Intl.NumberFormat('he-IL').format(Math.round(v));
    return `${n} ${sign}`;
};

export const signedPct = (v: number, digits = 0) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(digits)}%`;

// A change said in words inside a sentence, so no sign can jump sides: "עלייה של 23%".
export const changeWords = (v: number, digits = 0) => (v >= 0 ? `עלייה של ${v.toFixed(digits)}%` : `ירידה של ${Math.abs(v).toFixed(digits)}%`);
