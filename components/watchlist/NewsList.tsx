import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { ArrowUpRight, Newspaper } from "lucide-react";

export default function NewsList({ news }: { news: MarketNewsArticle[] }) {
    if (news.length === 0) {
        return (
            <div className="empty-state">
                <span className="empty-icon"><Newspaper className="size-5" /></span>
                <h3>אין חדשות אחרונות</h3>
                <p>לא פורסם כלום על המניות האלה בימים האחרונים.</p>
            </div>
        );
    }

    return (
        <ul className="row-list">
            {news.map((item) => (
                <li key={`${item.id}-${item.url}`}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 px-3 py-3 transition-colors hover:bg-hover/50">
                        <span dir="ltr" className="pill mono mt-0.5 w-16 justify-center">{item.related || 'שוק'}</span>
                        <span className="min-w-0 flex-1">
                            <span dir="auto" className="line-clamp-2 block text-start font-semibold text-foreground group-hover:text-brand-ink transition-colors">{item.headline}</span>
                            <span className="mt-1 block truncate text-[12.5px] text-faint">
                                {item.source}{item.datetime ? ` · ${formatDistanceToNow(item.datetime * 1000, { addSuffix: true, locale: he })}` : ''}
                            </span>
                        </span>
                        <ArrowUpRight className="mt-1 size-4 flex-none text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                </li>
            ))}
        </ul>
    );
}
