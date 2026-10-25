# Market support

What OpenStock can show depends on free data sources. This table was tested against them on the free plans (September 2026; Tel Aviv added October 2026). Paid Finnhub or TradingView plans unlock more.

| Market | Charts and widgets (TradingView embeds) | Our quotes, watchlist prices, alerts |
|---|---|---|
| 🇺🇸 United States (NYSE, Nasdaq, AMEX) | Live | Yes (Finnhub) |
| Crypto (Binance pairs, e.g. `BINANCE:BTCUSDT`) | Live | Yes (Finnhub) |
| 🇮🇱 Israel (TASE, `.TA` symbols) | Delayed 15 min | Yes, delayed (Yahoo Finance, unofficial) |
| Forex (e.g. `FX:EURUSD`) | Live | No |
| 🇨🇦 Canada (TSX) | Delayed | No |
| 🇦🇺 Australia (ASX) | Delayed | No |
| 🇮🇳 India, through BSE (`.BO`; `.NS` symbols are charted on BSE) | End of day | No |
| 🇩🇪 Germany (Xetra) | End of day | No |
| India NSE (charted on BSE instead) | Blocked in embeds | No |
| London, Tokyo, Hong Kong, Korea, Taiwan, Singapore, New Zealand, Thailand, Malaysia, Istanbul, TSX Venture, Mexico, Johannesburg | Candle chart blocked; financials, technicals and profile work | No |
| Index tickers such as NIFTY, FTSE 100, DAX, Nikkei 225, Hang Seng | Blocked in embeds | No |

## What that means in the app

- **Dashboard:** pick a market (US, Israel, India, Germany, Canada, Australia, Crypto, Forex). US, crypto and Tel Aviv tiles use our own cached quotes; the others use TradingView quote tiles.
- **Stock pages:** symbols we can price (Finnhub for US and crypto, Yahoo for `.TA`) get the full header (price, day range; market cap and logo for Finnhub symbols). Others get TradingView's quote panel.
- **Alerts:** an OpenStock Cloud feature (or self-hosted in realtime mode). US stocks, Tel Aviv and crypto, because the alert checker needs a quote source it can call every five minutes.
- **Tel Aviv specifics:** Yahoo's chart endpoint is unofficial and may change; quotes are delayed about 15-20 minutes and converted from agorot to shekels (`lib/actions/yahoo.actions.ts`). TASE trades Monday to Friday; the Friday early close isn't modelled.
- **Search:** Finnhub search returns listings worldwide. On exchanges whose chart is blocked, the stock page links to the chart on TradingView instead (the list is `CHART_BLOCKED_EXCHANGES` in `lib/utils.ts`, each confirmed with two tickers).

## Adding a market

Add an entry to `lib/markets.ts` with symbols from an exchange that renders in TradingView embeds (open one symbol in a quote widget first). To price and alert on more exchanges, you need a data plan that covers them.
