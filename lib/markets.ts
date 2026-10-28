// Markets OpenStock can show for free. Coverage was tested against the free data sources:
//   - Finnhub free: US stocks and crypto only (every other exchange returns 403).
//   - Yahoo Finance (unofficial chart endpoint): Tel Aviv (.TA) quotes, delayed ~15-20 min. See lib/actions/yahoo.actions.ts.
//   - TradingView embeds: US, crypto, forex live; TSX + ASX delayed; BSE + XETRA end-of-day.
//     NSE and TVC indices (NIFTY, FTSE, DAX, N225, HSI) are blocked in embeds; LSE, Tokyo, Hong Kong and
//     others block only the candle chart (see CHART_BLOCKED_EXCHANGES in lib/utils.ts).
// Adding a market = adding an entry here with symbols from an exchange that renders in embeds.

import { isInternationalSymbol } from "@/lib/utils";

export type MarketId = 'us' | 'il' | 'in' | 'de' | 'ca' | 'au' | 'crypto' | 'fx';

type Hours = { open: number; close: number }; // minutes of the local day

export type Market = {
    id: MarketId;
    name: string;
    short: string;
    timeZone: string;
    hours: Hours | '24/7' | '24/5';
    feed: 'Live' | 'Delayed' | 'End of day';
    // Tiles on the dashboard. `finnhub` or `yahoo` set = native tile with our own cached quote; otherwise a TradingView quote.
    pulse: { symbol: string; label: string; finnhub?: string; yahoo?: string }[];
    groups: { title: string; symbols: [symbol: string, name: string][] }[];
    heatmap?: 'stocks' | 'crypto';
    news: 'stock' | 'crypto' | 'forex';
};

const hm = (h: number, m = 0) => h * 60 + m;

export const MARKETS: Market[] = [
    {
        id: 'us', name: 'ארה"ב', short: 'US', timeZone: 'America/New_York', hours: { open: hm(9, 30), close: hm(16) }, feed: 'Live',
        pulse: [
            { symbol: 'AMEX:SPY', label: 'S&P 500', finnhub: 'SPY' },
            { symbol: 'NASDAQ:QQQ', label: 'Nasdaq 100', finnhub: 'QQQ' },
            { symbol: 'AMEX:DIA', label: 'Dow 30', finnhub: 'DIA' },
            { symbol: 'AMEX:IWM', label: 'Russell 2000', finnhub: 'IWM' },
        ],
        groups: [
            { title: 'פיננסים', symbols: [['NYSE:JPM', 'JPMorgan Chase'], ['NYSE:BAC', 'Bank of America'], ['NYSE:WFC', 'Wells Fargo'], ['NYSE:GS', 'Goldman Sachs'], ['NYSE:MA', 'Mastercard'], ['NYSE:V', 'Visa']] },
            { title: 'טכנולוגיה', symbols: [['NASDAQ:AAPL', 'Apple'], ['NASDAQ:MSFT', 'Microsoft'], ['NASDAQ:NVDA', 'NVIDIA'], ['NASDAQ:GOOGL', 'Alphabet'], ['NASDAQ:META', 'Meta'], ['NASDAQ:AMD', 'AMD']] },
            { title: 'צריכה', symbols: [['NASDAQ:AMZN', 'Amazon'], ['NASDAQ:TSLA', 'Tesla'], ['NYSE:WMT', 'Walmart'], ['NASDAQ:COST', 'Costco'], ['NYSE:KO', 'Coca-Cola'], ['NASDAQ:NFLX', 'Netflix']] },
        ],
        heatmap: 'stocks', news: 'stock',
    },
    {
        // TASE trades Monday to Friday since January 2026 (Friday closes early, ~14:00; not modelled).
        // Quotes and alerts come from Yahoo Finance (delayed); charts, profiles and financials from TradingView embeds.
        id: 'il', name: 'ישראל', short: 'IL', timeZone: 'Asia/Jerusalem', hours: { open: hm(9, 59), close: hm(17, 14) }, feed: 'Delayed',
        pulse: [
            { symbol: 'TASE:TA35', label: 'ת"א 35' },
            { symbol: 'TASE:TA125', label: 'ת"א 125' },
            { symbol: 'TASE:TEVA', label: 'טבע', yahoo: 'TEVA.TA' },
            { symbol: 'TASE:LUMI', label: 'לאומי', yahoo: 'LUMI.TA' },
        ],
        groups: [
            { title: 'בנקים ופיננסים', symbols: [['TASE:LUMI', 'לאומי'], ['TASE:POLI', 'פועלים'], ['TASE:DSCT', 'דיסקונט'], ['TASE:MZTF', 'מזרחי טפחות'], ['TASE:PHOE', 'הפניקס'], ['TASE:HARL', 'הראל']] },
            { title: 'טכנולוגיה וביטחוני', symbols: [['TASE:NICE', 'נייס'], ['TASE:ESLT', 'אלביט מערכות'], ['TASE:TSEM', 'טאואר'], ['TASE:NVMI', 'נובה']] },
            { title: 'תעשייה ונדל"ן', symbols: [['TASE:TEVA', 'טבע'], ['TASE:ICL', 'כי"ל'], ['TASE:ORL', 'בזן'], ['TASE:AZRG', 'עזריאלי'], ['TASE:BEZQ', 'בזק'], ['TASE:ELAL', 'אל על']] },
        ],
        news: 'stock',
    },
    {
        id: 'in', name: 'הודו', short: 'IN', timeZone: 'Asia/Kolkata', hours: { open: hm(9, 15), close: hm(15, 30) }, feed: 'End of day',
        pulse: [
            { symbol: 'BSE:SENSEX', label: 'Sensex' },
            { symbol: 'BSE:RELIANCE', label: 'Reliance' },
            { symbol: 'BSE:TCS', label: 'TCS' },
            { symbol: 'BSE:HDFCBANK', label: 'HDFC Bank' },
        ],
        groups: [
            { title: 'בנקים', symbols: [['BSE:HDFCBANK', 'HDFC Bank'], ['BSE:ICICIBANK', 'ICICI Bank'], ['BSE:SBIN', 'State Bank of India'], ['BSE:KOTAKBANK', 'Kotak Mahindra'], ['BSE:AXISBANK', 'Axis Bank']] },
            { title: 'טכנולוגיה', symbols: [['BSE:TCS', 'TCS'], ['BSE:INFY', 'Infosys'], ['BSE:WIPRO', 'Wipro'], ['BSE:HCLTECH', 'HCLTech'], ['BSE:TECHM', 'Tech Mahindra']] },
            { title: 'תעשייה', symbols: [['BSE:RELIANCE', 'Reliance'], ['BSE:LT', 'Larsen & Toubro'], ['BSE:ONGC', 'ONGC'], ['BSE:NTPC', 'NTPC'], ['BSE:TATASTEEL', 'Tata Steel']] },
        ],
        news: 'stock',
    },
    {
        id: 'de', name: 'גרמניה', short: 'DE', timeZone: 'Europe/Berlin', hours: { open: hm(9), close: hm(17, 30) }, feed: 'End of day',
        pulse: [
            { symbol: 'XETR:SAP', label: 'SAP' },
            { symbol: 'XETR:SIE', label: 'Siemens' },
            { symbol: 'XETR:ALV', label: 'Allianz' },
            { symbol: 'XETR:DTE', label: 'Deutsche Telekom' },
        ],
        groups: [
            { title: 'תעשייה', symbols: [['XETR:SIE', 'Siemens'], ['XETR:BAS', 'BASF'], ['XETR:BMW', 'BMW'], ['XETR:MBG', 'Mercedes-Benz'], ['XETR:VOW3', 'Volkswagen']] },
            { title: 'פיננסים', symbols: [['XETR:ALV', 'Allianz'], ['XETR:MUV2', 'Munich Re'], ['XETR:DBK', 'Deutsche Bank'], ['XETR:CBK', 'Commerzbank']] },
            { title: 'טכנולוגיה', symbols: [['XETR:SAP', 'SAP'], ['XETR:IFX', 'Infineon'], ['XETR:DTE', 'Deutsche Telekom'], ['XETR:ADS', 'Adidas']] },
        ],
        news: 'stock',
    },
    {
        id: 'ca', name: 'קנדה', short: 'CA', timeZone: 'America/Toronto', hours: { open: hm(9, 30), close: hm(16) }, feed: 'Delayed',
        pulse: [
            { symbol: 'TSX:RY', label: 'Royal Bank' },
            { symbol: 'TSX:SHOP', label: 'Shopify' },
            { symbol: 'TSX:ENB', label: 'Enbridge' },
            { symbol: 'TSX:TD', label: 'TD Bank' },
        ],
        groups: [
            { title: 'בנקים', symbols: [['TSX:RY', 'Royal Bank'], ['TSX:TD', 'TD Bank'], ['TSX:BNS', 'Scotiabank'], ['TSX:BMO', 'Bank of Montreal']] },
            { title: 'אנרגיה', symbols: [['TSX:ENB', 'Enbridge'], ['TSX:CNQ', 'Canadian Natural'], ['TSX:SU', 'Suncor']] },
            { title: 'צמיחה', symbols: [['TSX:SHOP', 'Shopify'], ['TSX:CNR', 'CN Rail'], ['TSX:CP', 'CPKC']] },
        ],
        news: 'stock',
    },
    {
        id: 'au', name: 'אוסטרליה', short: 'AU', timeZone: 'Australia/Sydney', hours: { open: hm(10), close: hm(16) }, feed: 'Delayed',
        pulse: [
            { symbol: 'ASX:CBA', label: 'CommBank' },
            { symbol: 'ASX:BHP', label: 'BHP' },
            { symbol: 'ASX:CSL', label: 'CSL' },
            { symbol: 'ASX:NAB', label: 'NAB' },
        ],
        groups: [
            { title: 'בנקים', symbols: [['ASX:CBA', 'CommBank'], ['ASX:NAB', 'NAB'], ['ASX:WBC', 'Westpac'], ['ASX:ANZ', 'ANZ'], ['ASX:MQG', 'Macquarie']] },
            { title: 'משאבי טבע', symbols: [['ASX:BHP', 'BHP'], ['ASX:FMG', 'Fortescue'], ['ASX:RIO', 'Rio Tinto']] },
            { title: 'צריכה ובריאות', symbols: [['ASX:CSL', 'CSL'], ['ASX:WES', 'Wesfarmers'], ['ASX:WOW', 'Woolworths']] },
        ],
        news: 'stock',
    },
    {
        id: 'crypto', name: 'קריפטו', short: 'Crypto', timeZone: 'UTC', hours: '24/7', feed: 'Live',
        pulse: [
            { symbol: 'BINANCE:BTCUSDT', label: 'Bitcoin', finnhub: 'BINANCE:BTCUSDT' },
            { symbol: 'BINANCE:ETHUSDT', label: 'Ethereum', finnhub: 'BINANCE:ETHUSDT' },
            { symbol: 'BINANCE:SOLUSDT', label: 'Solana', finnhub: 'BINANCE:SOLUSDT' },
            { symbol: 'BINANCE:BNBUSDT', label: 'BNB', finnhub: 'BINANCE:BNBUSDT' },
        ],
        groups: [
            { title: 'המרכזיים', symbols: [['BINANCE:BTCUSDT', 'Bitcoin'], ['BINANCE:ETHUSDT', 'Ethereum'], ['BINANCE:SOLUSDT', 'Solana'], ['BINANCE:BNBUSDT', 'BNB'], ['BINANCE:XRPUSDT', 'XRP']] },
            { title: 'עוד', symbols: [['BINANCE:ADAUSDT', 'Cardano'], ['BINANCE:DOGEUSDT', 'Dogecoin'], ['BINANCE:AVAXUSDT', 'Avalanche'], ['BINANCE:LINKUSDT', 'Chainlink'], ['BINANCE:DOTUSDT', 'Polkadot']] },
        ],
        heatmap: 'crypto', news: 'crypto',
    },
    {
        id: 'fx', name: 'מט"ח', short: 'FX', timeZone: 'America/New_York', hours: '24/5', feed: 'Live',
        pulse: [
            { symbol: 'FX:EURUSD', label: 'EUR / USD' },
            { symbol: 'FX:GBPUSD', label: 'GBP / USD' },
            { symbol: 'FX:USDJPY', label: 'USD / JPY' },
            { symbol: 'FX:AUDUSD', label: 'AUD / USD' },
        ],
        groups: [
            { title: 'המרכזיים', symbols: [['FX:EURUSD', 'EUR / USD'], ['FX:GBPUSD', 'GBP / USD'], ['FX:USDJPY', 'USD / JPY'], ['FX:USDCHF', 'USD / CHF']] },
            { title: 'מטבעות סחורות', symbols: [['FX:AUDUSD', 'AUD / USD'], ['FX:USDCAD', 'USD / CAD'], ['FX:NZDUSD', 'NZD / USD']] },
        ],
        news: 'forex',
    },
];

export const DEFAULT_MARKET: MarketId = 'us';
export const MARKET_COOKIE = 'openstock-market';

export const getMarket = (id?: string | null) => MARKETS.find((m) => m.id === id) ?? MARKETS[0];

const COUNTRY_MARKET: Record<string, MarketId> = { IL: 'il', IN: 'in', DE: 'de', CA: 'ca', AU: 'au' };
export const marketForCountry = (country?: string | null): MarketId => COUNTRY_MARKET[country ?? ''] ?? DEFAULT_MARKET;

// Finnhub free can price (and so alert on) US listings and Binance pairs only.
export const hasFinnhubQuotes = (symbol: string) => {
    const upper = symbol.toUpperCase();
    if (upper.startsWith('BINANCE:')) return true;
    return !upper.includes(':') && !isInternationalSymbol(upper);
};

// Is the market trading right now, in its own time zone? Holidays aren't modelled.
export function isMarketOpen(market: Market, date = new Date()) {
    if (market.hours === '24/7') return true;
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone: market.timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
            .formatToParts(date).map((p) => [p.type, p.value]),
    );
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    if (market.hours === '24/5') {
        // FX: Sunday 17:00 to Friday 17:00, New York time
        if (day === 6) return false;
        if (day === 0) return minutes >= hm(17);
        if (day === 5) return minutes < hm(17);
        return true;
    }
    return day >= 1 && day <= 5 && minutes >= market.hours.open && minutes < market.hours.close;
}

// Tel Aviv listings are priced through Yahoo Finance instead (delayed).
export const hasYahooQuotes = (symbol: string) => symbol.toUpperCase().endsWith('.TA');

// Anything we can price ourselves, from whichever source: live header, watchlist prices and price alerts.
export const hasQuotes = (symbol: string) => hasFinnhubQuotes(symbol) || hasYahooQuotes(symbol);

// The native pulse-tile symbol for a tile, whichever source prices it.
export const pulseQuoteSymbol = (tile: Market['pulse'][number]) => tile.finnhub ?? tile.yahoo;

// How each feed is described in Hebrew on screen; the English values above stay as the logic's keys.
export const FEED_HE: Record<Market['feed'], string> = { Live: 'בזמן אמת', Delayed: 'בעיכוב', 'End of day': 'סוף יום' };
