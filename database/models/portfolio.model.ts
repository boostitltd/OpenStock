import { Schema, model, models, type Document, type Model } from 'mongoose';

// A real trade the user made: every buy carries the reason it was made and what "done" looks like,
// so the monthly review can hold each position to the promise it was bought on.
export interface ITrade extends Document {
    userId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;          // per share, in `currency`
    currency: 'ILS' | 'USD';
    fees: number;           // total for the trade, in `currency`
    tradedAt: Date;
    targetPrice?: number | null;      // BUY: sell when the price gets here...
    targetReturnPct?: number | null;  // ...or when the position is up this much
    thesis?: string;                  // BUY: one sentence on why
    note?: string;
    createdAt: Date;
}

const TradeSchema = new Schema<ITrade>(
    {
        userId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        side: { type: String, enum: ['BUY', 'SELL'], required: true },
        quantity: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
        currency: { type: String, enum: ['ILS', 'USD'], required: true },
        fees: { type: Number, default: 0, min: 0 },
        tradedAt: { type: Date, required: true },
        targetPrice: { type: Number, default: null },
        targetReturnPct: { type: Number, default: null },
        thesis: { type: String, trim: true, maxlength: 500 },
        note: { type: String, trim: true, maxlength: 500 },
    },
    { timestamps: true }
);

TradeSchema.index({ userId: 1, symbol: 1, tradedAt: 1 });

export const Trade: Model<ITrade> = (models?.Trade as Model<ITrade>) || model<ITrade>('Trade', TradeSchema);

// One document per user: the shape the portfolio should have, and the monthly amount that moves it there.
export interface IPortfolioSettings extends Document {
    userId: string;
    baseCurrency: 'ILS' | 'USD';
    monthlyBudget: number;
    driftTolerancePct: number; // a holding this many portfolio-points over its target is a sell candidate
    targets: { symbol: string; weightPct: number }[];
    goalAmount?: number | null;   // "I want this much..."
    goalDate?: Date | null;       // "...by then"
}

const PortfolioSettingsSchema = new Schema<IPortfolioSettings>(
    {
        userId: { type: String, required: true, unique: true },
        baseCurrency: { type: String, enum: ['ILS', 'USD'], default: 'ILS' },
        monthlyBudget: { type: Number, default: 0, min: 0 },
        driftTolerancePct: { type: Number, default: 2, min: 0, max: 50 },
        targets: {
            type: [{ symbol: { type: String, uppercase: true, trim: true }, weightPct: { type: Number, min: 0, max: 100 } }],
            default: [],
        },
        goalAmount: { type: Number, default: null, min: 0 },
        goalDate: { type: Date, default: null },
    },
    { timestamps: true }
);

export const PortfolioSettings: Model<IPortfolioSettings> =
    (models?.PortfolioSettings as Model<IPortfolioSettings>) || model<IPortfolioSettings>('PortfolioSettings', PortfolioSettingsSchema);
