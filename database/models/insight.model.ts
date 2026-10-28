import { Schema, model, models, type Model } from 'mongoose';

// One AI summary per stock per day (Asia/Jerusalem), shared by every user: it is about the company, not a portfolio.
export interface IStockInsight {
    symbol: string;
    day: string;            // YYYY-MM-DD
    insight: { story: string; drivers: string[]; risks: string[]; watch: string; generatedAt: string; model: string };
    headlines: { title: string; source: string; url: string; date: string }[];
}

const StockInsightSchema = new Schema<IStockInsight>(
    {
        symbol: { type: String, required: true, uppercase: true },
        day: { type: String, required: true },
        insight: { type: Schema.Types.Mixed, required: true },
        headlines: { type: [{ _id: false, title: String, source: String, url: String, date: String }], default: [] },
    },
    { timestamps: true }
);

StockInsightSchema.index({ symbol: 1, day: 1 }, { unique: true });

export const StockInsight: Model<IStockInsight> =
    (models?.StockInsight as Model<IStockInsight>) || model<IStockInsight>('StockInsight', StockInsightSchema);
