import { Schema, model, models, type Model } from 'mongoose';

// One saved AI answer per kind of check, per subject, per day (Asia/Jerusalem): thesis checks, the political radar,
// insider news, Congress filings. Saving it means a page view never waits for the model twice on the same day.
export interface IAiCheck {
    kind: string;      // 'thesis' | 'radar' | 'insider' | 'congress-ptr'
    key: string;       // what it is about: a symbol + thesis hash, a user id, a filing id
    day: string;       // YYYY-MM-DD, or 'forever' for things that never change (a filed report)
    data: unknown;
}

const AiCheckSchema = new Schema<IAiCheck>(
    {
        kind: { type: String, required: true },
        key: { type: String, required: true },
        day: { type: String, required: true },
        data: { type: Schema.Types.Mixed, required: true },
    },
    { timestamps: true }
);

AiCheckSchema.index({ kind: 1, key: 1, day: 1 }, { unique: true });

export const AiCheck: Model<IAiCheck> = (models?.AiCheck as Model<IAiCheck>) || model<IAiCheck>('AiCheck', AiCheckSchema);
