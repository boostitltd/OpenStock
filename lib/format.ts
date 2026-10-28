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
