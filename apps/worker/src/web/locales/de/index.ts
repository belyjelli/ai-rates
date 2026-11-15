/**
 * German (owner, 2026-11-15). One file per part of the site, so the catalog for a page sits in one
 * place and i18n.test.ts can tell two parts that translate the same English differently. Any `de`
 * browser language lands here: Germany, Austria and Switzerland alike.
 *
 * GLOSSARY. One term, one translation, across every part. The words German-speaking crypto traders
 * and the exchanges' German pages use (Binance, Bybit, Bitpanda, Trading-Gruppen), not dictionary
 * German; much of the jargon stays English, as it does there. Nouns are capitalized, English ones too.
 *
 *   funding rate        Funding-Rate             perpetual (perp)  Perpetual (Perp)
 *   funding (payment)   Funding                  spread            Spread
 *   funding spread      Funding-Spread           exchange / venue  Börse
 *   market              Markt                    long / short      Long / Short
 *   go long on X        Long auf X               leg (of a pair)   Leg
 *   pair                Paar                     open interest, OI Open Interest (OI)
 *   24h volume          24h-Volumen              APR / annualized  APR (annualisiert)
 *   settlement          Abrechnung               settled           abgerechnet
 *   interval            Intervall                backtest          Backtest
 *   carry               Carry                    arbitrage         Arbitrage
 *   screener            Screener                 rates             Raten
 *   liquidations        Liquidationen            taker / maker     Taker / Maker
 *   fees                Gebühren                 slippage          Slippage
 *   basis               Basis                    mark price        Mark-Preis
 *   index price         Indexpreis               quote currency    Quote-Währung
 *   stability           Stabilität               win rate          Trefferquote
 *   fear & greed        Angst und Gier           bps               bps
 *   whale               Wal                      order book        Orderbuch
 *   wall (in the book)  Wand                     CVD               CVD
 *   gamma flip          Gamma-Flip               call / put wall   Call-Wand / Put-Wand
 *   gamma exposure      Gamma-Exposure (GEX)     option book       Optionsbuch
 *   expiry              Verfall                  strike            Strike
 *   implied volatility  implizite Volatilität (IV)
 *   cascade             Kaskade                  member            Mitglied
 *   flat (momentum)     seitwärts                sign up / log in  registrieren / anmelden
 *   not financial advice  keine Anlageberatung
 *
 * SHARED KEYS. These English keys sit in more than one part; every part uses exactly this German.
 *   Months Jan…Dec      Jan, Feb, März, Apr, Mai, Juni, Juli, Aug, Sep, Okt, Nov, Dez
 *   {month} {day}       {day}. {month}
 *   Asset / asset       Asset / Asset            Window            Zeitraum
 *   Venues, Exchanges   Börsen                   Exchange          Börse
 *   Liquidations        Liquidationen            Indexes           Indizes
 *   Try again           Erneut versuchen         close             schließen
 *   Type                Typ                      Change            Veränderung
 *   View                Ansicht                  Other             Sonstige
 *   Level               Level                    Spread / spread   Spread
 *   open interest       Open Interest            Last {window}     Letzte {window}
 *   hover or tap a bar to read it               Balken antippen oder mit der Maus darauf zeigen
 *   {asset} bars; arrow keys read one at a time {asset}-Balken; Pfeiltasten lesen einen nach dem anderen
 *
 * Style: address the reader as «du», as German crypto and fintech apps do; short labels, since
 * German runs about a third longer than English and table heads, buttons and the nav must stay narrow
 * (h, min, s, d are the time units: "{h} h {m} min"; "vor {time}" for "{time} ago"). German quotes
 * „ “ for quotes, never an ASCII double quote (many keys sit in attributes). A count comes first, as
 * in English ("{count} Märkte"), where the noun is never singular; otherwise "Märkte: {count}" so 1
 * and many both read right. The site's " · " separators, figures, venue names, tickers, units ($, %,
 * bps) and code-like labels are left exactly as they are, and so are the English product names
 * (airrates, Telegram, MCP).
 */

import type { Catalog } from "../../i18n";
import { charts } from "./charts";
import { exchanges } from "./exchanges";
import { gamma } from "./gamma";
import { holdings } from "./holdings";
import { keyboard } from "./keyboard";
import { layout } from "./layout";
import { liquidations } from "./liquidations";
import { macro } from "./macro";
import { narrator } from "./narrator";
import { pages } from "./pages";
import { site } from "./site";
import { whales } from "./whales";

/** Each part on its own, for the test that checks two parts never disagree on one key. */
export const DE_PARTS: Readonly<Record<string, Catalog>> = {
  layout,
  pages,
  liquidations,
  charts,
  site,
  keyboard,
  whales,
  gamma,
  macro,
  exchanges,
  holdings,
  narrator,
};

export const de: Catalog = Object.assign({}, ...Object.values(DE_PARTS));
