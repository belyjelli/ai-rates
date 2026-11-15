/**
 * The frame every page shares -- web/layout.ts (masthead, nav, footer), the time and label helpers in
 * web/format.ts -- and the not-found messages app/app.ts builds, in German.
 * Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const layout: Catalog = {
  // web/format.ts
  "{s}s": "{s}s",
  "{m}m": "{m} min",
  "{h}h {m}m": "{h} h {m} min",
  "{time} ago": "vor {time}",
  settling: "wird abgerechnet",
  never: "nie",
  "extreme fear": "extreme Angst",
  fear: "Angst",
  neutral: "neutral",
  greed: "Gier",
  "extreme greed": "extreme Gier",

  // web/layout.ts
  spreads: "Spreads",
  screener: "Screener",
  rates: "Raten",
  arbitrage: "Arbitrage",
  liquidations: "Liquidationen",
  exchanges: "Börsen",
  "{markets} markets · {venues} venues · updated {ago}":
    "{markets} Märkte · {venues} Börsen · aktualisiert {ago}",
  "no venue has reported in five minutes": "seit fünf Minuten hat keine Börse Daten gemeldet",
  "Fear &amp; greed: click for the chart": "Angst und Gier: klicken für den Chart",
  "What settled. Not what might.": "Was abgerechnet wurde. Nicht, was sein könnte.",
  "Your local time ({zone}). Click for UTC.": "Deine Ortszeit ({zone}). Klicken für UTC.",
  "UTC, the clock funding settles by. Click for your local time.":
    "UTC, die Uhr, nach der Funding abgerechnet wird. Klicken für deine Ortszeit.",
  filter: "filtern",
  login: "anmelden",
  telegram: "telegram",
  "Join the airrates group on Telegram: @airratesnet":
    "Tritt der airrates-Gruppe auf Telegram bei: @airratesnet",
  status: "Status",
  "geo-probe": "Geo-Test",
  about: "über",
  "referral links": "Empfehlungslinks",
  "MCP &amp; agents": "MCP und Agenten",
  "legal &amp; privacy": "Rechtliches und Datenschutz",
  terms: "AGB",
  Language: "Sprache",
  menu: "Menü",
  "Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.":
    "Keine Anlageberatung. Daten können verzögert oder ungenau sein. Mit keiner Börse verbunden und von keiner empfohlen.",

  // web/help.ts
  "What is this?": "Was ist das?",
  "About this page": "Über diese Seite",

  // app/app.ts
  "{asset} is not an asset address.": "{asset} ist keine Asset-Adresse.",
  "No live market for {asset}.": "Kein aktiver Markt für {asset}.",
  "No live market for {asset}, so nothing to band against.":
    "Kein aktiver Markt für {asset}, also nichts, woran sich Bänder ausrichten.",
  "No exchange is quoting a {asset} book right now.":
    "Gerade stellt keine Börse ein Orderbuch für {asset}.",
  "There's no exchange with that name.": "Es gibt keine Börse mit diesem Namen.",
  "No exchange has a live {asset} perpetual right now.":
    "Gerade hat keine Börse einen aktiven {asset}-Perpetual.",
  // web/command.ts: the site-wide search, and its key on /keys
  search: "suchen",
  "Search tickers, exchanges and indices": "Ticker, Börsen und Indizes suchen",
  Search: "Suchen",
  "Ticker, exchange or index": "Ticker, Börse oder Index",
  Results: "Ergebnisse",
  move: "bewegen",
  open: "öffnen",
  close: "schließen",
  "every exchange's rate and open interest": "Rate und Open Interest jeder Börse",
  "Funding spreads": "Funding-Spreads",
  "backtest a long/short pair": "Backtest eines Long/Short-Paars",
  Screener: "Screener",
  "its spreads, ranked": "seine Spreads, sortiert",
  Arbitrage: "Arbitrage",
  "price gaps between exchanges": "Preisunterschiede zwischen Börsen",
  "large resting orders and trades": "große ruhende Orders und Trades",
  Liquidations: "Liquidationen",
  "where positions are liquidated": "wo Positionen liquidiert werden",
  "options gamma by strike": "Options-Gamma nach Strike",
  "1 exchange": "1 Börse",
  "{n} exchanges": "{n} Börsen",
  "OI {usd}": "OI {usd}",
  Tickers: "Ticker",
  "Other tickers": "Weitere Ticker",
  Exchanges: "Börsen",
  "markets, costs and grade": "Märkte, Kosten und Note",
  "Index levels": "Indexstände",
  "the level, its daily closes and what trades on it":
    "der Stand, seine Tagesschlusskurse und was darauf gehandelt wird",
  "Indices and option books": "Indizes und Optionsbücher",
  Pages: "Seiten",
  Recent: "Zuletzt",
  "Loading tickers…": "Ticker werden geladen…",
  "The ticker list did not load. Exchanges and pages still match.":
    "Die Tickerliste wurde nicht geladen. Börsen und Seiten werden weiter gefunden.",
  "Nothing matches {q}.": "Nichts passt zu {q}.",
  "price, spot and futures CVD": "Preis, Spot- und Futures-CVD",
  System: "System",
  "Day or Night, as your device is set": "Tag oder Nacht, wie dein Gerät eingestellt ist",
  Settings: "Einstellungen",
  "Your settings on airrates: theme, clock, chart cursor, language and keyboard.":
    "Deine Einstellungen auf airrates: Design, Uhr, Chart-Cursor, Sprache und Tastatur.",
  "Each choice is kept in this browser, not on an account: it needs no login, and another browser or device starts from the defaults. Clearing the site's data resets them.":
    "Jede Auswahl wird in diesem Browser gespeichert, nicht in einem Konto: Du musst dich nicht anmelden, und ein anderer Browser oder ein anderes Gerät beginnt mit den Standardwerten. Wenn du die Daten der Seite löschst, werden sie zurückgesetzt.",
  Theme: "Design",
  "The colours of every page. Charts take the new colours from the next page you open.":
    "Die Farben jeder Seite. Charts übernehmen die neuen Farben ab der nächsten Seite, die du öffnest.",
  Clock: "Uhr",
  "The clock in the header, and the times on charts and tables.":
    "Die Uhr im Kopfbereich und die Zeiten in Charts und Tabellen.",
  "Local time": "Ortszeit",
  "Chart cursor": "Chart-Cursor",
  "What follows the pointer on a chart: a crosshair with the value on each axis, or the whole bar lit.":
    "Was dem Mauszeiger im Chart folgt: ein Fadenkreuz mit dem Wert auf jeder Achse oder der ganze Balken hervorgehoben.",
  "The site's language, kept for this browser.":
    "Die Sprache der Seite, für diesen Browser gespeichert.",
  "Every shortcut on the site. Members remap them into profiles kept on their account.":
    "Alle Tastenkürzel der Seite. Mitglieder belegen sie in Profilen neu, die in ihrem Konto gespeichert sind.",
  "keyboard shortcuts": "Tastenkürzel",
  Reset: "Zurücksetzen",
  "Back to the defaults: Night, local time, the crosshair, the narrator open and typing, and every chart's own view.":
    "Zurück zu den Standardwerten: Nacht, Ortszeit, das Fadenkreuz, der Erzähler offen und tippend und die eigene Ansicht jedes Charts.",
  "reset settings": "Einstellungen zurücksetzen",
  "Saved in this browser.": "In diesem Browser gespeichert.",
  "Back to the defaults.": "Zurück zu den Standardwerten.",
  settings: "Einstellungen",
  Night: "Nacht",
  "Black terminal, the default": "Schwarzes Terminal, der Standard",
  "Ink on white, for daylight": "Tinte auf Weiß, für Tageslicht",
  Solar: "Solar",
  "Solarized light: warm paper, soft contrast": "Solarized hell: warmes Papier, weicher Kontrast",
  "Solar dark": "Solar dunkel",
  "Solarized dark: deep teal": "Solarized dunkel: tiefes Petrol",
  Dusk: "Dämmerung",
  "Slate blue, easy on the eyes at night": "Schieferblau, nachts angenehm für die Augen",
  Sepia: "Sepia",
  "Old paper and brown ink": "Altes Papier und braune Tinte",
  Phosphor: "Phosphor",
  "Green screen, an old terminal": "Grüner Bildschirm, ein altes Terminal",
  "High contrast": "Hoher Kontrast",
  "White on black, brightest lines": "Weiß auf Schwarz, hellste Linien",
};
