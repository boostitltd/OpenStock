import { Schema, model, models, type Model } from 'mongoose';

// What the portfolio looked like when a brief was sent. The next brief compares against the latest one, so
// "what changed" means since the last email, not since some arbitrary day.
export interface IBriefSnapshot {
    userId: string;
    sentTo: string;
    createdAt: Date;
    totalValue: number;
    base: 'ILS' | 'USD';
    monthlyBudget: number;
    sims: { years: number; contributed: number; p10: number; p50: number; p90: number; probBelowContributed: number }[];
    holdings: {
        symbol: string; quantity: number; price: number | null; value: number; weightPct: number;
        vsMa200Pct: number | null; fromHigh52wPct: number | null; analystTarget: number | null; targetReached: boolean;
    }[];
    ideas: { symbol: string; verdict: string }[];
}

const BriefSnapshotSchema = new Schema<IBriefSnapshot>(
    {
        userId: { type: String, required: true, index: true },
        sentTo: { type: String, default: '' },
        totalValue: Number,
        base: { type: String, enum: ['ILS', 'USD'], default: 'ILS' },
        monthlyBudget: Number,
        sims: [{ _id: false, years: Number, contributed: Number, p10: Number, p50: Number, p90: Number, probBelowContributed: Number }],
        holdings: [{
            _id: false, symbol: String, quantity: Number, price: Number, value: Number, weightPct: Number,
            vsMa200Pct: Number, fromHigh52wPct: Number, analystTarget: Number, targetReached: Boolean,
        }],
        ideas: [{ _id: false, symbol: String, verdict: String }],
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

BriefSnapshotSchema.index({ userId: 1, createdAt: -1 });

export const BriefSnapshot: Model<IBriefSnapshot> =
    (models?.BriefSnapshot as Model<IBriefSnapshot>) || model<IBriefSnapshot>('BriefSnapshot', BriefSnapshotSchema);
