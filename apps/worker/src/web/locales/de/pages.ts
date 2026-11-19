/**
 * web/pages.ts (every page but the /status body, which stays English) and web/venues.ts, in German.
 * Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const pages: Catalog = {
  // shared helpers
  flat: "seitwärts",
  crypto: "Krypto",
  equity: "Aktien",
  commodity: "Rohstoffe",
  fx: "Devisen",
  index: "Index",
  "{days} charging days in the last 30": "{days} Funding-Tage in den letzten 30",
  Asset: "Asset",
  "7d settled": "7T abgerechnet",
  Stability: "Stabilität",
  "Long on {venue}": "Long auf {venue}",
  "Short on {venue}": "Short auf {venue}",
  day: "1 Tag",
  "{n} days": "{n} Tage",
  Any: "Beliebig",

  // home: verified ranking and hero
  "No replay yet: the nightly run needs a week of settled funding on both legs of a pair.":
    "Noch kein Replay: Der nächtliche Lauf braucht eine Woche abgerechnetes Funding auf beiden Legs eines Paars.",
  "Replayed, not forecast: {asset} long {long} / short {short} settled {net} on {size} a leg over 7 days. {apr} annualized, {win}% of days positive.":
    "Nachgespielt, keine Prognose: {asset} long {long} / short {short} hat mit {size} pro Leg in 7 Tagen {net} abgerechnet. {apr} annualisiert, {win} % der Tage positiv.",
  "Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into":
    "Open Interest des dünneren der beiden Legs. Eine große Zahl aus einem flachen Markt ist kein Trade, in den du mit Größe einsteigen kannst",
  "The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry":
    "Das Funding des extremeren Legs, absolut. Raten über einigen hundert Prozent bedeuten meist ein Delisting oder ein angeschlagenes Listing statt Carry",
  "Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg":
    "Funding, das beide Legs in den letzten 7 Tagen tatsächlich abgerechnet haben, pro $10,000 Nominal je Leg",
  Annualized: "Annualisiert",
  "Long leg": "Long-Leg",
  "Short leg": "Short-Leg",
  "Days the pair was net positive, as a share of days that settled at all":
    "Tage, an denen das Paar netto positiv war, als Anteil der Tage mit überhaupt einer Abrechnung",
  "Win rate": "Trefferquote",
  "Thinner leg OI": "OI des dünneren Legs",
  "Worst leg APR": "APR des schwächsten Legs",
  "How often the weaker leg held its funding direction over 30 days":
    "Wie oft das schwächere Leg seine Funding-Richtung über 30 Tage gehalten hat",
  "Widest funding spread right now": "Größter Funding-Spread gerade",
  "No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.":
    "Keine Börse hat in den letzten fünf Minuten Daten gemeldet, also gibt es nichts zu paaren. Schau in einer Minute wieder.",
  "Widest spreads": "Größte Spreads",
  "Open the screener": "Screener öffnen",
  "No pairs yet: an asset needs live markets on at least two venues.":
    "Noch keine Paare: Ein Asset braucht aktive Märkte auf mindestens zwei Börsen.",
  "What actually paid, last 7 days": "Was tatsächlich gezahlt hat, letzte 7 Tage",
  "replayed {date}": "nachgespielt am {date}",
  "Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.":
    "Keine Prognose: Beide Legs werden zu ihren eigenen Abrechnungszeiten aus gespeichertem Funding nachgespielt, mit $10,000 pro Leg. Sortiert nach dem Abgerechneten, ohne Filter — prüfe also die Tiefe des dünneren Legs und die Rate des schwächeren, bevor du eine große Zahl als Trade liest.",
  "{asset} carry, long {long} / short {short}: {funding} of funding settled on {size} a leg over the last {span}. {net} after retail fees. Price risk hedged, not guessed.":
    "{asset}-Carry, long {long} / short {short}: {funding} Funding abgerechnet mit {size} pro Leg in den letzten {span}. {net} nach Retail-Gebühren. Preisrisiko gehedgt, nicht geraten.",
  "Best verified carry, last {span}": "Bester verifizierter Carry, letzte {span}",
  "funding settled on {size} per leg": "Funding abgerechnet mit {size} pro Leg",
  "after retail fees {value}": "nach Retail-Gebühren {value}",
  "annualized {value} before fees": "annualisiert {value} vor Gebühren",
  "win rate {value} of days": "Trefferquote {value} der Tage",
  "thinner leg {value} open interest": "dünneres Leg {value} Open Interest",
  "stability {value}": "Stabilität {value}",
  "Open this backtest": "Diesen Backtest öffnen",
  "Settled, not forecast: both legs replayed at their own settlement times. This is the best pair in the newest nightly run with at least {oi} of open interest on its thinner leg, neither leg past {apr}% a year, stability of {stability} or better and no missed settlements. Retail fees are {bps} bps on each of {fills} fills, opening and closing both legs. Last week's funding is not a promise about next week's.":
    "Abgerechnet, nicht prognostiziert: Beide Legs werden zu ihren eigenen Abrechnungszeiten nachgespielt. Das ist das beste Paar im neuesten nächtlichen Lauf mit mindestens {oi} Open Interest auf dem dünneren Leg, keinem Leg über {apr} % pro Jahr, einer Stabilität von {stability} oder besser und keiner verpassten Abrechnung. Die Retail-Gebühren betragen {bps} bps auf jede der {fills} Ausführungen, Eröffnung und Schließung beider Legs. Das Funding der letzten Woche ist kein Versprechen für die nächste.",
  "Widest funding spread across perp exchanges right now: {asset} at {spread} a year. Long {long} at {longApr}, short {short} at {shortApr}.":
    "Größter Funding-Spread zwischen Perp-Börsen gerade: {asset} mit {spread} pro Jahr. Long {long} bei {longApr}, short {short} bei {shortApr}.",
  "funding spread, per year": "Funding-Spread pro Jahr",
  "{symbol} at {apr}": "{symbol} bei {apr}",
  "Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.":
    "Gleiche Größe auf beiden Legs hebt das Preisrisiko auf; die Differenz der beiden Funding-Raten ist, was das Paar in einem Jahr einnimmt, vor Handelsgebühren und bevor sich eine der Raten bewegt.",

  // screener
  "Funding spread screener": "Funding-Spread-Screener",
  "For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.":
    "Für jedes Asset der günstigste Markt für Long und der teuerste für Short, auf verschiedenen Börsen. Jedes Leg muss die Filter bestehen.",
  "No pairs match these filters. Lower the minimum open interest or include more exchange types.":
    "Keine Paare passen zu diesen Filtern. Senke das Mindest-Open-Interest oder nimm mehr Börsentypen dazu.",
  "Min open interest, each leg": "Min. Open Interest je Leg",
  "Min 24h volume, each leg": "Min. 24h-Volumen je Leg",
  "A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency":
    "Ein USDT-Leg gegen ein USDC-Leg trägt die Basis zwischen den beiden Stablecoins und braucht Sicherheiten in beiden. Angehakt wird jedes Asset nur innerhalb einer Quote-Währung gepaart",
  "Same quote currency on both legs": "Gleiche Quote-Währung auf beiden Legs",
  "Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads":
    "Delistings und angeschlagene Listings können über ±2000% APR zahlen und handelbare Spreads verdrängen",
  "Include beyond ±1000% APR": "Über ±1000% APR einbeziehen",
  Rows: "Zeilen",
  Spread: "Spread",
  Venues: "Börsen",
  "Neither leg has settled funding to score yet":
    "Noch kein Leg hat abgerechnetes Funding zum Bewerten",
  "The long leg has no settled funding to score yet":
    "Das Long-Leg hat noch kein abgerechnetes Funding zum Bewerten",
  "The short leg has no settled funding to score yet":
    "Das Short-Leg hat noch kein abgerechnetes Funding zum Bewerten",
  "Weaker leg held its direction on {days} of its charging days in the last 30":
    "Das schwächere Leg hat seine Richtung an {days} seiner Funding-Tage in den letzten 30 gehalten",
  "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg":
    "Diese Börse sagt nicht, worin das Leg abgerechnet wird, daher lässt sich nicht zeigen, dass es zum anderen Leg passt",
  "Settles in {quote} while the other leg settles in {other}: the pair carries the basis between them":
    "Rechnet in {quote} ab, während das andere Leg in {other} abrechnet: Das Paar trägt die Basis zwischen beiden",
  "an undeclared currency": "eine nicht angegebene Währung",
  "quote ?": "Quote ?",
  OI: "OI",
  "{asset} pays {spread} a year to hold both sides: long {long} at {longApr}, short {short} at {shortApr}. Same coin, two exchanges, price exposure cancelled.":
    "{asset} zahlt {spread} pro Jahr, wenn du beide Seiten hältst: long {long} bei {longApr}, short {short} bei {shortApr}. Gleicher Coin, zwei Börsen, Preisrisiko aufgehoben.",
  "Signed log scale, so ordinary rates keep room next to extreme ones":
    "Logarithmische Skala mit Vorzeichen, damit normale Raten neben extremen Platz behalten",
  "Long − short, log scale": "Long − Short, log. Skala",
  "Exchanges with a live market for this asset": "Börsen mit aktivem Markt für dieses Asset",
  "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "Wie oft das schwächere Leg seine Funding-Richtung über 30 Tage gehalten hat. 0.50 ist ein Münzwurf; 0.88 ist das Maximum für einen ganzen Monat",

  // exchanges and one exchange
  Exchanges: "Börsen",
  "No exchange has reported in the last five minutes.":
    "Keine Börse hat in den letzten fünf Minuten Daten gemeldet.",
  Exchange: "Börse",
  Type: "Typ",
  "Open interest": "Open Interest",
  "24h volume": "24h-Volumen",
  Updated: "Aktualisiert",
  "{venue}: {count} live perp markets, {oi} open interest. Richest funding {richest} at {richestApr} a year; cheapest {cheapest} at {cheapestApr}.":
    "{venue}: {count} aktive Perp-Märkte, {oi} Open Interest. Höchstes Funding {richest} mit {richestApr} pro Jahr; niedrigstes {cheapest} mit {cheapestApr}.",
  "{venue} funding rates": "Funding-Raten von {venue}",
  "Live funding rates, open interest and volume for every {venue} perpetual market.":
    "Live-Funding-Raten, Open Interest und Volumen für jeden Perpetual-Markt von {venue}.",
  "No live markets from {venue}: it isn't collected yet, or its last update is more than five minutes old.":
    "Keine aktiven Märkte von {venue}: Sie wird noch nicht erfasst, oder das letzte Update ist älter als fünf Minuten.",
  "{count} live markets": "{count} aktive Märkte",
  "{value} open interest": "{value} Open Interest",
  "updated {value}": "aktualisiert {value}",
  Market: "Markt",
  "Funding APR": "Funding-APR",
  "Rate, log scale": "Rate, log. Skala",
  Interval: "Intervall",
  "Next funding": "Nächstes Funding",
  "Mark price": "Mark-Preis",
  "Centralized exchange": "Zentralisierte Börse",
  "Onchain perp exchange": "Onchain-Perp-Börse",
  "Hyperliquid HIP-3 dex": "Hyperliquid-HIP-3-DEX",

  // rates
  now: "jetzt",
  asset: "Asset",
  "open interest": "Open Interest",
  spread: "Spread",
  "{asset} funding runs from {low} on {lowVenue} to {high} on {highVenue}: {gap} a year apart across {count} exchanges.":
    "Das Funding von {asset} reicht von {low} auf {lowVenue} bis {high} auf {highVenue}: {gap} pro Jahr Unterschied über {count} Börsen.",
  previous: "zurück",
  "assets {from}–{to}": "Assets {from}–{to}",
  next: "weiter",
  "No asset has live markets on two or more venues right now.":
    "Gerade hat kein Asset aktive Märkte auf zwei oder mehr Börsen.",
  Rates: "Raten",
  "Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.":
    "Das Funding jeder Börse für die tiefsten Assets auf einen Blick. Positiv heißt, Longs zahlen, ein Short kassiert also; eine leere Zelle heißt, dass die Börse keinen Markt für das Asset hat, nicht dass das Funding seitwärts ist.",

  // price gaps
  "{asset}: buy on {buyVenue} at {buyPrice}, sell on {sellVenue} at {sellPrice}. A {gap} bps gap at the top of the book.":
    "{asset}: kaufen auf {buyVenue} bei {buyPrice}, verkaufen auf {sellVenue} bei {sellPrice}. Eine Lücke von {gap} bps oben im Orderbuch.",
  "Quotes seen {quoted}; the older leg's funding row fetched {fetched}":
    "Kurse gesehen {quoted}; Funding-Daten des älteren Legs abgerufen {fetched}",
  "No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.":
    "Gerade zeigt kein Asset eine so große Lücke. Der Median vergleichbarer Assets liegt bei etwa 1.6 bps, versuch also eine niedrigere Untergrenze.",
  "Highest bid against lowest ask, across two different exchanges":
    "Höchstes Bid gegen niedrigstes Ask, auf zwei verschiedenen Börsen",
  "Gap, bps": "Lücke, bps",
  "The sell price less the buy price, in the asset's own price units":
    "Verkaufspreis minus Kaufpreis, in den eigenen Preiseinheiten des Assets",
  Basis: "Basis",
  "The smaller of the two resting sizes: what the gap is actually good for":
    "Die kleinere der beiden ruhenden Größen: wofür die Lücke tatsächlich reicht",
  "Good for": "Reicht für",
  "Buy price": "Kaufpreis",
  "Buy at": "Kaufen bei",
  "Ask size": "Ask-Größe",
  "Sell price": "Verkaufspreis",
  "Sell at": "Verkaufen bei",
  "Bid size": "Bid-Größe",
  "Exchanges quoting this asset that survived the mark-agreement check":
    "Börsen, die dieses Asset quotieren und die Mark-Prüfung bestanden haben",
  Quoted: "Quotiert",
  "Price gaps": "Preislücken",
  "For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps</b>, not fillable trades: nothing here reflects the book below level 1, the taker fees, or the two transfers a real position needs. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size.":
    "Für jedes Asset die günstigste Börse zum Kaufen und die teuerste zum Verkaufen, jeweils oben im Orderbuch. Das sind <b>quotierte Lücken</b>, keine ausführbaren Trades: Nichts hier berücksichtigt das Orderbuch unter Level 1, die Taker-Gebühren oder die zwei Transfers, die eine echte Position braucht. Die größten Lücken liegen in den dünnsten Orderbüchern — bei der Messung zeigten 395 von 721 Assets überhaupt eine Lücke, im Median 1.6 bps, während die Spitzenreiter nur für $3 ruhende Größe reichten.",
  Apply: "Anwenden",
  "This venue's mark disagrees with the rest, so it is excluded from the gap":
    "Der Mark-Preis dieser Börse weicht vom Rest ab, daher ist sie von der Lücke ausgeschlossen",
  "Marked {ratio}× above this asset's deepest market, so it is a different instrument, not a price gap":
    "Mark-Preis {ratio}× über dem tiefsten Markt dieses Assets, also ein anderes Instrument, keine Preislücke",
  "Marked {ratio}× below this asset's deepest market, so it is a different instrument, not a price gap":
    "Mark-Preis {ratio}× unter dem tiefsten Markt dieses Assets, also ein anderes Instrument, keine Preislücke",
  best: "beste",
  "This venue's own bid-ask spread, which a taker crosses on entry and again on exit":
    "Der eigene Bid-Ask-Spread dieser Börse, den ein Taker beim Einstieg und erneut beim Ausstieg kreuzt",
  "This venue's funding row has not been refreshed within the freshness window, so its mark is withheld rather than shown stale — the quote beside it is live":
    "Die Funding-Daten dieser Börse wurden nicht innerhalb des Aktualitätsfensters erneuert, daher wird ihr Mark-Preis zurückgehalten statt veraltet gezeigt — der Kurs daneben ist live",
  "Quote seen {quoted}; funding row fetched {fetched}":
    "Kurs gesehen {quoted}; Funding-Daten abgerufen {fetched}",
  "Every pair": "Alle Paare",
  "One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.":
    "Eine Zeile pro Richtung: kaufen an der ersten Börse, verkaufen an der zweiten. Die größte Lücke ist oft nicht die beste — ein engeres Paar kann viel mehr Größe dahinter haben, und die meisten Richtungen verlieren direkt.",
  "The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for":
    "Die kleinere aus Ask-Größe der Kaufseite und Bid-Größe der Verkaufsseite — wofür diese Richtung reicht",
  "No two exchanges quote {asset} in a way that can be compared right now.":
    "Gerade quotieren keine zwei Börsen {asset} so, dass man sie vergleichen kann.",
  "Buying on {buy} and selling on {sell} quotes {gap}, though one side's resting size is unknown.":
    "Kaufen auf {buy} und verkaufen auf {sell} quotiert {gap}, die ruhende Größe einer Seite ist aber unbekannt.",
  "Buying on {buy} and selling on {sell} quotes {gap}, good for about {size}.":
    "Kaufen auf {buy} und verkaufen auf {sell} quotiert {gap}, reicht für etwa {size}.",
  "That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.":
    "Das ist ein Kurs für die gezeigte Größe, kein ausführbarer Trade: vor Gebühren, vor dem Orderbuch unter Level 1 und vor dem Transfer zwischen zwei Börsen.",
  Status: "Status",
  "{count} venue is shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "Abgeblendet und von der Lücke ausgeschlossen: {count} Börse ({venues}). Ihr Mark-Preis weicht um mehr als 10 % vom nach Open Interest tiefsten Markt dieses Assets ab, was ein anders dimensioniertes oder anders benanntes Instrument bedeutet statt einer Preisdifferenz — die Prüfung, die verhindert, dass eine Abweichung von 1375× als Chance von 13,660,780 bps veröffentlicht wird. {status} nennt jeweils den Grund.",
  "{count} venues are shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "Abgeblendet und von der Lücke ausgeschlossen: {count} Börsen ({venues}). Ihre Mark-Preise weichen um mehr als 10 % vom nach Open Interest tiefsten Markt dieses Assets ab, was ein anders dimensioniertes oder anders benanntes Instrument bedeutet statt einer Preisdifferenz — die Prüfung, die verhindert, dass eine Abweichung von 1375× als Chance von 13,660,780 bps veröffentlicht wird. {status} nennt jeweils den Grund.",
  "{asset} price gaps by exchange": "Preislücken von {asset} nach Börse",
  "{asset} best bid and ask on every exchange that quotes it, with the size resting at each.":
    "Bestes Bid und Ask von {asset} auf jeder Börse, die es quotiert, mit der jeweils ruhenden Größe.",
  "Every exchange": "Alle Börsen",
  "Best bid": "Bestes Bid",
  "Best ask": "Bestes Ask",
  "The venue's own bid-ask spread in basis points":
    "Der eigene Bid-Ask-Spread der Börse in Basispunkten",
  "Own spread": "Eigener Spread",
  Mark: "Mark",
  "Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.":
    "Die Größen sind das Geld, das ganz oben in jedem Orderbuch ruht, umgerechnet in USD, weil die drei Börsen, die Tiefe veröffentlichen, unterschiedlich zählen — Gate in Kontrakten, OKX in Kontrakten gegen <code>ctVal</code>, Bybit im Basis-Coin. Diese Rohwerte nebeneinander zu lesen ist ein Fehler um 10,000×.",

  // one asset
  "Best pair: long on {long} at {longApr}, short on {short} at {shortApr}, a {spread} spread per year.":
    "Bestes Paar: long auf {long} bei {longApr}, short auf {short} bei {shortApr}, ein Spread von {spread} pro Jahr.",
  "Only markets with at least {minOi} open interest are paired.":
    "Nur Märkte mit mindestens {minOi} Open Interest werden gepaart.",
  "Funding only, before trading fees: none were entered.":
    "Nur Funding, vor Handelsgebühren: Es wurden keine eingegeben.",
  "Only one exchange lists it right now, so there's no cross-exchange pair.":
    "Gerade listet nur eine Börse es, also gibt es kein Paar zwischen Börsen.",
  "No two exchanges have at least {minOi} open interest in it, so there's no pair to show.":
    "Keine zwei Börsen haben darin mindestens {minOi} Open Interest, also gibt es kein Paar zu zeigen.",
  "{asset} funding rates by exchange": "Funding-Raten von {asset} nach Börse",
  "{asset} perpetual funding rates across {count} exchanges, with the widest long/short spread.":
    "Perpetual-Funding-Raten von {asset} über {count} Börsen, mit dem größten Long/Short-Spread.",
  "Funding by exchange": "Funding nach Börse",
  "{markets} live markets on {venues} exchanges.": "{markets} aktive Märkte auf {venues} Börsen.",
  "{asset} funding across {count} exchanges: long {long} at {longApr}, short {short} at {shortApr}. A {spread} spread a year on one coin.":
    "Funding von {asset} über {count} Börsen: long {long} bei {longApr}, short {short} bei {shortApr}. Ein Spread von {spread} pro Jahr auf einem Coin.",
  "Backtest this pair": "Dieses Paar backtesten",
  "long {long} · short {short} · {spread} a year, replayed on settled funding":
    "long {long} · short {short} · {spread} pro Jahr, nachgespielt mit abgerechnetem Funding",
  "24h settled": "24h abgerechnet",
  "How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "Wie oft dieser Markt seine Funding-Richtung über 30 Tage gehalten hat. 0.50 ist ein Münzwurf; 0.88 ist das Maximum für einen ganzen Monat",
  "Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had":
    "Die letzten 7 Funding-Tage gegen die Tage davor, in APR-Punkten. Aufwärts heißt, das Funding weitet sich in seiner bisherigen Richtung",
  "30d trend": "30T-Trend",

  // pair backtest
  "capital {amount} — {venue} will not open a position above {max} on {symbol}":
    "Kapital {amount} — {venue} eröffnet auf {symbol} keine Position über {max}",
  "capital {amount} across both legs at {leverage}":
    "Kapital {amount} über beide Legs mit {leverage}",
  "capital {amount} across both legs, unleveraged": "Kapital {amount} über beide Legs, ohne Hebel",
  "capital at least {amount} across both legs — {leverage} is the small-size maximum":
    "Kapital mindestens {amount} über beide Legs — {leverage} ist das Maximum für kleine Größen",
  "capital {amount} across both legs at {leverage} (small size)":
    "Kapital {amount} über beide Legs mit {leverage} (kleine Größe)",
  "Cumulative funding reaches {amount} after {days} days":
    "Kumuliertes Funding erreicht {amount} nach {days} Tagen",
  "Cumulative funding on {size} per leg · {from} to {to}":
    "Kumuliertes Funding mit {size} pro Leg · {from} bis {to}",
  "Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.":
    "Taker-Gebühr in Basispunkten pro Ausführung. Beide Legs müssen ausgefüllt sein, bevor Kosten berechnet werden.",
  "blank = ignore": "leer = ignorieren",
  Window: "Zeitraum",
  "Long on": "Long auf",
  "Short on": "Short auf",
  "Size per leg": "Größe pro Leg",
  "Long taker fee": "Taker-Gebühr Long",
  "Short taker fee": "Taker-Gebühr Short",
  "Run backtest": "Backtest starten",
  "swap legs": "Legs tauschen",
  "What entering and exiting would cost at each exchange's top of book":
    "Was Ein- und Ausstieg oben im Orderbuch jeder Börse kosten würden",
  "price gap": "Preislücke",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, before fees. Replayed from settled funding:":
    "{asset}-Funding-Carry, long {long} / short {short}: {net} mit {size} pro Leg in den letzten {span}, vor Gebühren. Nachgespielt aus abgerechnetem Funding:",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, after fees. Replayed from settled funding:":
    "{asset}-Funding-Carry, long {long} / short {short}: {net} mit {size} pro Leg in den letzten {span}, nach Gebühren. Nachgespielt aus abgerechnetem Funding:",
  "Share on X": "Auf X teilen",
  "opens a post with this result and a link back to it":
    "öffnet einen Post mit diesem Ergebnis und einem Link zurück",
  "after costs {net} on {fees} of fees": "nach Kosten {net} bei {fees} Gebühren",
  "never repays the fees at this rate": "holt die Gebühren bei dieser Rate nie herein",
  "fees repay in {days}": "Gebühren eingeholt in {days}",
  "under a day": "unter einem Tag",
  Jan: "Jan",
  Feb: "Feb",
  Mar: "März",
  Apr: "Apr",
  May: "Mai",
  Jun: "Juni",
  Jul: "Juli",
  Aug: "Aug",
  Sep: "Sep",
  Oct: "Okt",
  Nov: "Nov",
  Dec: "Dez",
  "{month} {day}": "{day}. {month}",
  "best day {amount} {date}": "bester Tag {amount} {date}",
  "worst day {amount} {date}": "schlechtester Tag {amount} {date}",
  "The largest fall in cumulative funding from a previous high, before costs":
    "Der größte Rückgang des kumulierten Fundings von einem vorherigen Hoch, vor Kosten",
  "max drawdown {amount}": "max. Drawdown {amount}",
  "{days}d avg {apr}": "Ø {days}T {apr}",
  "now {apr}, {average}, every {interval}": "jetzt {apr}, {average}, alle {interval}",
  "now {apr}, every {interval}": "jetzt {apr}, alle {interval}",
  "net funding over the last {span} · {apr} annualized":
    "Netto-Funding in den letzten {span} · {apr} annualisiert",
  "Long {venue}": "Long {venue}",
  "{n} settlements": "Abrechnungen: {n}",
  "Short {venue}": "Short {venue}",
  "win rate {value} of {days} days": "Trefferquote {value} von {days} Tagen",
  "average {value} a day": "Ø {value} pro Tag",
  "Missed settlements: {long} on {longVenue}, {short} on {shortVenue}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.":
    "Verpasste Abrechnungen: {long} auf {longVenue}, {short} auf {shortVenue}. Eine Lücke wird gemeldet statt als null gezählt, die Summe umfasst also nur tatsächlich erfasste Abrechnungen.",
  "Only {have} of the {asked} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.":
    "Nur {have} der {asked} angefragten Tage haben gespeicherte Abrechnungen. Der annualisierte Wert teilt trotzdem durch den ganzen Zeitraum und fällt daher niedrig aus. Die Tagesauswertung hält 70 Tage, und auf einigen Börsen füllt sich die Historie noch.",
  "Funding only, on a position kept at {size} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.":
    "Nur Funding, bei einer Position von {size} pro Leg. Handelsgebühren sind nicht enthalten, weil keine angegeben wurden: Taker-Gebühren hängen von deiner Volumenstufe und Rabatten ab, trag also oben die Gebühren beider Legs ein, um das Ergebnis nach Kosten zu sehen. Preisbewegungen zwischen Abrechnungen werden ebenfalls nicht modelliert, weil die Funding-Historie der Börsen eine Rate und eine Zeit liefert und fast nie einen Mark-Preis.",
  "Net of the fees you entered, on a position kept at {size} per leg: {long} bps long and {short} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.":
    "Nach den eingegebenen Gebühren, bei einer Position von {size} pro Leg: {long} bps Long und {short} bps Short, berechnet auf vier Ausführungen — Ein- und Ausstieg auf beiden Legs. Angenommen wird einmaliges Eröffnen und Schließen; jedes Rollen der Position kostet das erneut. Preisbewegungen zwischen Abrechnungen werden weiterhin nicht modelliert, weil die Funding-Historie der Börsen eine Rate und eine Zeit liefert und fast nie einen Mark-Preis.",
  "Only one exchange lists {asset} right now, so there's no pair to hold.":
    "Gerade listet nur eine Börse {asset}, also gibt es kein Paar zu halten.",
  "Pick two exchanges to hold against each other.":
    "Wähle zwei Börsen, die du gegeneinander hältst.",
  "{asset} funding carry backtest": "Funding-Carry-Backtest für {asset}",
  "What holding {asset} long on one exchange and short on another would have paid in funding.":
    "Was {asset} long auf einer Börse und short auf einer anderen an Funding gezahlt hätte.",
  backtest: "Backtest",
  "{asset} carry": "{asset}-Carry",
  "Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.":
    "Das Funding jeder Börse über einen Zeitraum und was die zwei gewählten Legs tatsächlich abgerechnet haben, summiert pro UTC-Tag. Zeiträume sind ganze Kalendertage bis heute, und die Zahlen werden stündlich aktualisiert.",

  // errors
  "Too many requests": "Zu viele Anfragen",
  "Too many backtests from this address.": "Zu viele Backtests von dieser Adresse.",
  "That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.":
    "Das sind mehr Backtests, als eine Adresse pro Minute ausführen darf. Warte kurz und versuch es erneut. Bereits berechnete Ergebnisse kommen aus dem Cache und sind nie begrenzt, eine Kombination, die schon jemand ausgeführt hat, lädt also sofort.",
  "Back to the screener": "Zurück zum Screener",
  "Not found": "Nicht gefunden",
  "Page not found.": "Seite nicht gefunden.",
  "Nothing lives at {path}.": "Unter {path} gibt es nichts.",
  "See today's widest spreads": "Die größten Spreads von heute ansehen",
  "A runner sprinting": "Ein sprintender Läufer",
  "Data center busy": "Rechenzentrum ausgelastet",
  "The data center is too busy and a runner is on it. Try again later.":
    "Das Rechenzentrum ist zu ausgelastet, und ein Läufer kümmert sich darum. Versuch es später erneut.",
  "The data center is getting too busy and is currently sprinting in circles":
    "Das Rechenzentrum ist zu ausgelastet und sprintet gerade im Kreis",
  "Every server is screaming, the funding rates are on fire, and one intern is running the whole thing on foot. Go touch grass and try again later.":
    "Alle Server schreien, die Funding-Raten brennen, und ein Praktikant betreibt das Ganze zu Fuß. Geh mal an die frische Luft und versuch es später erneut.",
  "Try again": "Erneut versuchen",
  // pages.ts invertedMark: an FX leg quoted the other way round (migration 041).
  "short this contract": "diesen Kontrakt shorten",
  "long this contract": "diesen Kontrakt longen",
  "sell this contract": "diesen Kontrakt verkaufen",
  "buy this contract": "diesen Kontrakt kaufen",
  "{symbol} quotes this pair the other way round, so this side of the pair is the opposite side of that contract. Its price is shown inverted and its funding with the sign flipped, in the pair's terms.":
    "{symbol} quotiert dieses Paar umgekehrt, diese Seite des Paars ist also die Gegenseite dieses Kontrakts. Sein Preis wird invertiert und sein Funding mit umgekehrtem Vorzeichen gezeigt, in den Einheiten des Paars.",
  Now: "Jetzt",
  "Payback, days": "Amortisation, Tage",
  Long: "Long",
  Short: "Short",
  "7d {apr}": "7T {apr}",
  "Where to hold the long side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "Wo die Long-Seite gehalten wird: Börse und ihr aktuelles Funding; Kontrakt, Intervall, Open Interest und 7-Tage-Funding darunter",
  "Where to hold the short side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "Wo die Short-Seite gehalten wird: Börse und ihr aktuelles Funding; Kontrakt, Intervall, Open Interest und 7-Tage-Funding darunter",
  "Days of the {days}-day spread it takes to repay {bps} bps of fees: a taker fill in and out of both legs, at public retail rates":
    "Tage des {days}-Tage-Spreads, die nötig sind, um {bps} bps Gebühren hereinzuholen: eine Taker-Ausführung rein und raus auf beiden Legs, zu öffentlichen Retail-Sätzen",
  "No {days} days of settlements yet, so this is from the spread now: days to repay {bps} bps of fees, a taker fill in and out of both legs, at public retail rates":
    "Noch keine {days} Tage Abrechnungen, daher aus dem aktuellen Spread: Tage, um {bps} bps Gebühren hereinzuholen, eine Taker-Ausführung rein und raus auf beiden Legs, zu öffentlichen Retail-Sätzen",
  "per {unit}": "pro {unit}",
  "Days of funding it takes to repay the fees of opening and closing both legs, at public retail taker rates. From the {days}-day spread; dimmed where there is only the spread now":
    "Tage an Funding, die nötig sind, um die Gebühren für Eröffnung und Schließung beider Legs hereinzuholen, zu öffentlichen Retail-Taker-Sätzen. Aus dem {days}-Tage-Spread; abgeblendet, wo es nur den aktuellen Spread gibt",
  "The funding spread now: short leg's rate minus long leg's":
    "Der aktuelle Funding-Spread: Rate des Short-Legs minus Rate des Long-Legs",
  "The same two markets' spread, averaged over the settlements of the last {days} days":
    "Der Spread derselben zwei Märkte, gemittelt über die Abrechnungen der letzten {days} Tage",
  "dollars, or 250k, 1.5m": "Dollar, oder 250k, 1.5m",
  "Delete preset": "Vorlage löschen",
  "No presets yet.": "Noch keine Vorlagen.",
  Presets: "Vorlagen",
  "Preset name": "Name der Vorlage",
  "Preset name…": "Name der Vorlage…",
  Save: "Speichern",
  "Clear all": "Alle abwählen",
  "Select all": "Alle auswählen",
  "{n} selected": "{n} ausgewählt",
  Filters: "Filter",
  "Asset class": "Assetklasse",
  TradFi: "TradFi",
  "Spread now (APR %)": "Spread jetzt (APR %)",
  "Both legs settle at this interval": "Beide Legs rechnen in diesem Intervall ab",
  "Funding interval": "Funding-Intervall",
  "No USDT leg against a USDC one": "Kein USDT-Leg gegen ein USDC-Leg",
  "Distressed and delisting markets": "Angeschlagene und auslaufende Märkte",
  "Reset all": "Alles zurücksetzen",
  Steadiness: "Beständigkeit",
  "Funding steadiness": "Funding-Beständigkeit",
  "How often a leg's funding kept its direction over the last 30 days: the dot beside each exchange in the Long and Short columns. The Stability column is the weaker leg's score.":
    "Wie oft das Funding eines Legs in den letzten 30 Tagen seine Richtung gehalten hat: der Punkt neben jeder Börse in den Spalten Long und Short. Die Spalte Stabilität ist der Wert des schwächeren Legs.",
  "Holds its direction almost every day. Income you can plan on.":
    "Hält seine Richtung fast jeden Tag. Einnahmen, mit denen du planen kannst.",
  "Flips now and then. Usable for a carry, but size for the days it pays the other way.":
    "Dreht ab und zu. Nutzbar für einen Carry, aber plane die Größe für die Tage, an denen es andersherum zahlt.",
  "Flips often. Today's rate says little about next week's, and a backtest of it says less.":
    "Dreht oft. Die heutige Rate sagt wenig über die der nächsten Woche, und ein Backtest davon noch weniger.",
  "Scored by direction, not by the coefficient of variation: that explodes whenever the average rate sits near zero. 0.50 is a coin flip; 0.88 is the most a full month can score.":
    "Bewertet nach Richtung, nicht nach dem Variationskoeffizienten: Der explodiert, sobald die durchschnittliche Rate nahe null liegt. 0.50 ist ein Münzwurf; 0.88 ist das Maximum für einen ganzen Monat.",
  "Search asset": "Asset suchen",
  "Search asset…": "Asset suchen…",
  Period: "Periode",
  "Rate unit": "Einheit der Rate",
  Day: "Tag",
  "No settled funding to score yet": "Noch kein abgerechnetes Funding zum Bewerten",
  "Funding held its direction on {days} of its charging days in the last 30: {band}":
    "Das Funding hat seine Richtung an {days} seiner Funding-Tage in den letzten 30 gehalten: {band}",
  erratic: "sprunghaft",
  mixed: "gemischt",
  steady: "beständig",
  Chart: "Chart",
  "Running the backtest…": "Backtest läuft…",
  "pick one": "eine wählen",
  "A price-convergence pair across two exchanges.": "Ein Preiskonvergenz-Paar über zwei Börsen.",
  "All quotes": "Alle Kurse",
  Average: "Durchschnitt",
  "Best bid / ask": "Bestes Bid / Ask",
  "Bid-ask, both books": "Bid-Ask, beide Orderbücher",
  "Breakeven move {pct}": "Breakeven-Bewegung {pct}",
  "Dollars resting at the best bid and the best ask":
    "Dollar, die am besten Bid und besten Ask ruhen",
  "Each hour's average mark on the two exchanges. Where a venue publishes no mark, its index stands in.":
    "Der durchschnittliche Mark-Preis jeder Stunde auf den zwei Börsen. Wo eine Börse keinen Mark-Preis veröffentlicht, springt ihr Index ein.",
  "Entry at the top of the book": "Einstieg oben im Orderbuch",
  "Every time in the window the spread rose to at least today's width, the hours until it next fell to the window's median. Hourly averages, so nothing shorter than an hour is seen, and the past is not a promise.":
    "Jedes Mal, wenn der Spread im Zeitraum mindestens auf die heutige Breite stieg, die Stunden, bis er wieder auf den Median des Zeitraums fiel. Stundendurchschnitte, nichts unter einer Stunde ist also sichtbar, und die Vergangenheit ist kein Versprechen.",
  "Exit target: the window's median spread, {median}. Full convergence to zero is rare, and waiting for it usually makes no sense.":
    "Ausstiegsziel: der Median-Spread des Zeitraums, {median}. Volle Konvergenz auf null ist selten, und darauf zu warten lohnt sich meist nicht.",
  "Fees, four taker fills": "Gebühren, vier Taker-Ausführungen",
  "From {n} comparable episodes in the last {window}; {open} had not closed by the end.":
    "Aus {n} vergleichbaren Episoden in den letzten {window}; {open} hatten sich bis zum Ende nicht geschlossen.",
  "Funding, est. {hold} hold": "Funding, geschätzt bei {hold} Haltedauer",
  Gross: "Brutto",
  "Hold time, from history": "Haltedauer, aus der Historie",
  "Hover the chart to read every line at one hour.":
    "Fahr mit der Maus über den Chart, um alle Linien zu einer Stunde abzulesen.",
  "If the spread closes from where it is now to each target. Fees are four taker fills, in and out of both legs. The books are each exchange's own bid-ask, crossed half on the way in and half on the way out, at the top of the book only. Funding is the short leg's rate less the long leg's over the hold, which can pay or cost.":
    "Wenn sich der Spread von seinem jetzigen Stand bis zu jedem Ziel schließt. Gebühren sind vier Taker-Ausführungen, rein und raus auf beiden Legs. Die Orderbücher sind der eigene Bid-Ask jeder Börse, halb beim Einstieg und halb beim Ausstieg gekreuzt, nur oben im Orderbuch. Funding ist die Rate des Short-Legs minus die des Long-Legs über die Haltedauer, was zahlen oder kosten kann.",
  "If the spread closes to": "Wenn der Spread sich schließt auf",
  "Long leg · {venue}": "Long-Leg · {venue}",
  "Long the exchange where the asset is cheaper, short the one where it is dearer, and close when the two prices meet. Price moves cancel between the legs; what is left is the gap closing, less fees, the books and funding. Marks are the exchanges' own fair prices, not fills, and the history is hourly averages.":
    "Geh long an der Börse, wo das Asset günstiger ist, short an der, wo es teurer ist, und schließe, wenn sich die beiden Preise treffen. Preisbewegungen heben sich zwischen den Legs auf; übrig bleibt das Schließen der Lücke, abzüglich Gebühren, Orderbüchern und Funding. Mark-Preise sind die fairen Preise der Börsen selbst, keine Ausführungen, und die Historie sind Stundendurchschnitte.",
  "Mark prices, hourly": "Mark-Preise, stündlich",
  Median: "Median",
  "Not verified for this exchange: the site's retail assumption of {bps} bps":
    "Für diese Börse nicht verifiziert: die Retail-Annahme der Seite von {bps} bps",
  "Off the market median": "Abstand zum Markt-Median",
  "One leg was listed recently or reported unevenly. The spread now is more trustworthy than the window's statistics.":
    "Ein Leg wurde kürzlich gelistet oder hat unregelmäßig gemeldet. Der aktuelle Spread ist verlässlicher als die Statistik des Zeitraums.",
  "Over the window's hours in which both legs reported a price, from each hour's average mark.":
    "Über die Stunden des Zeitraums, in denen beide Legs einen Preis gemeldet haben, aus dem durchschnittlichen Mark-Preis jeder Stunde.",
  "Own bid-ask": "Eigener Bid-Ask",
  "Price history is unavailable right now. The live figures below are unaffected.":
    "Die Preishistorie ist gerade nicht verfügbar. Die Live-Zahlen unten sind nicht betroffen.",
  "Price spread, hourly": "Preis-Spread, stündlich",
  "Profit calculator": "Gewinnrechner",
  Range: "Spanne",
  "Seen {age}": "Gesehen {age}",
  "Short leg · {venue}": "Short-Leg · {venue}",
  "Sparse history ({share}% of expected samples): statistics may be unreliable.":
    "Lückenhafte Historie ({share} % der erwarteten Werte): Die Statistik ist möglicherweise unzuverlässig.",
  "Spread now (mark)": "Spread jetzt (Mark)",
  "Spread statistics": "Spread-Statistik",
  "Std dev": "Std.-Abw.",
  "Swap legs": "Legs tauschen",
  "Taker fee": "Taker-Gebühr",
  "The exchange's published standard taker fee":
    "Die veröffentlichte Standard-Taker-Gebühr der Börse",
  "The price gap between {long} and {short} for {asset}: now, after costs, and over its history.":
    "Die Preislücke zwischen {long} und {short} für {asset}: jetzt, nach Kosten und über die Historie.",
  "The short leg is not the dearer one right now, so there is no gap to close in this direction.":
    "Das Short-Leg ist gerade nicht das teurere, also gibt es in dieser Richtung keine Lücke zu schließen.",
  "The short leg's hourly mark less the long leg's, as a share of the long leg's. The dashed lines are the spread now and the window's median.":
    "Der stündliche Mark-Preis des Short-Legs minus den des Long-Legs, als Anteil des Long-Legs. Die gestrichelten Linien sind der aktuelle Spread und der Median des Zeitraums.",
  "The short leg's mark less the long leg's, as a share of the long leg's. Marks are each exchange's fair price, not a price anyone traded at; the entry below is what the books offer.":
    "Der Mark-Preis des Short-Legs minus den des Long-Legs, als Anteil des Long-Legs. Mark-Preise sind der faire Preis jeder Börse, kein Preis, zu dem jemand gehandelt hat; der Einstieg unten ist das, was die Orderbücher bieten.",
  "The spread is already at or below its median for the window ({median}): nothing to wait for.":
    "Der Spread liegt bereits auf oder unter seinem Median des Zeitraums ({median}): Es gibt nichts abzuwarten.",
  "This leg's mark against the median mark of every exchange quoting the asset":
    "Der Mark-Preis dieses Legs gegen den Median-Mark aller Börsen, die das Asset quotieren",
  "This pair: long {long}, short {short}": "Dieses Paar: long {long}, short {short}",
  Ticker: "Ticker",
  "Too few comparable episodes in the last {window} to estimate how long this takes. Try a longer window.":
    "Zu wenige vergleichbare Episoden in den letzten {window}, um zu schätzen, wie lange das dauert. Versuch einen längeren Zeitraum.",
  "Top of book": "Oben im Orderbuch",
  "Trade long · {venue}": "Long handeln · {venue}",
  "Trade short · {venue}": "Short handeln · {venue}",
  "Window {window} · {n} hours of {expected}": "Zeitraum {window} · {n} von {expected} Stunden",
  "buying {venue}'s ask, selling {other}'s bid":
    "Kauf zum Ask von {venue}, Verkauf zum Bid von {other}",
  details: "Details",
  "full convergence pays {times}× the round trip": "volle Konvergenz zahlt {times}× den Roundtrip",
  "long {long} · short {short}": "long {long} · short {short}",
  "long {long} · short {short}, good for {size}; deeper fills cost more and are not shown":
    "long {long} · short {short}, reicht für {size}; tiefere Ausführungen kosten mehr und werden nicht gezeigt",
  "market median {price} · long {long} · short {short}":
    "Markt-Median {price} · long {long} · short {short}",
  median: "Median",
  pair: "Paar",
  "seen {long} / {short}": "gesehen {long} / {short}",
  "sized at {size} a leg": "mit {size} pro Leg",
  "the book is thinner than this size": "das Orderbuch ist dünner als diese Größe",
  "thin book: only {size} rests at those prices":
    "dünnes Orderbuch: Nur {size} ruht zu diesen Preisen",
  "typical time to close (middle half {from} to {to})":
    "typische Zeit bis zum Schließen (mittlere Hälfte {from} bis {to})",
  "wider than {share}% of the last {window}'s hours":
    "breiter als {share} % der Stunden der letzten {window}",
  "{asset} convergence trade": "{asset}-Konvergenztrade",
  "{asset} convergence trade: long {long}, short {short}":
    "{asset}-Konvergenztrade: long {long}, short {short}",
  "{asset} · convergence trade": "{asset} · Konvergenztrade",
  "{long} bps on the long leg and {short} bps on the short, in and out":
    "{long} bps auf dem Long-Leg und {short} bps auf dem Short-Leg, rein und raus",
  "{n}th percentile": "{n}. Perzentil",
  "{venues} has no comparable {asset} book right now. Pick another exchange above.":
    "{venues} hat gerade kein vergleichbares Orderbuch für {asset}. Wähle oben eine andere Börse.",
  "~1h": "~1h",
  "~{n} days": "~{n} Tage",
  "~{n}h": "~{n}h",
  "Price gap (bps)": "Preislücke (bps)",
  "Min resting size, thinner side": "Min. ruhende Größe, dünnere Seite",
  "A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid":
    "Ein HIP-3-Markt: von einem Drittanbieter gelistet und auf Hyperliquid abgerechnet",
  "A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid, with its own book and its own risks.":
    "Ein HIP-3-Markt: von einem Drittanbieter gelistet und auf Hyperliquid abgerechnet, mit eigenem Orderbuch und eigenen Risiken.",
  "A row offers a trade only with a LONG and a SHORT leg. Everything else is context.":
    "Eine Zeile bietet nur mit einem LONG- und einem SHORT-Leg einen Trade. Alles andere ist Kontext.",
  Badges: "Kennzeichen",
  LONG: "LONG",
  "Left out of the gap: its price disagrees with the asset's deepest market by more than a real arbitrage ever does, so it is a different instrument. Hover it for how far out.":
    "Von der Lücke ausgeschlossen: Sein Preis weicht vom tiefsten Markt des Assets stärker ab, als es echte Arbitrage je tut, es ist also ein anderes Instrument. Mit der Maus darauf zeigen, um zu sehen, wie weit.",
  "NO LIQ": "KEINE LIQ",
  "OFF-SYNC": "ASYNCHRON",
  OUTLIER: "AUSREISSER",
  "Quoted more than a minute before the price it is compared with. Pairing the two would read the asset's own move in the meantime as a gap.":
    "Mehr als eine Minute vor dem Vergleichspreis quotiert. Beide zu paaren würde die eigene Bewegung des Assets in der Zwischenzeit als Lücke lesen.",
  "Quoted {seconds}s before the price it is compared with":
    "{seconds}s vor dem Vergleichspreis quotiert",
  SHORT: "SHORT",
  "The cheapest venue: the leg you buy.": "Die günstigste Börse: das Leg, das du kaufst.",
  "The dearest venue: the leg you sell.": "Die teuerste Börse: das Leg, das du verkaufst.",
  "Under {volume} traded in 24 hours: a price with almost no trading behind it, which you may not be able to fill.":
    "Unter {volume} Umsatz in 24 Stunden: ein Preis fast ohne Handel dahinter, der sich womöglich nicht ausführen lässt.",
  "VIA HL": "VIA HL",
  "What the badges mean": "Was die Kennzeichen bedeuten",
  "{volume} traded in 24 hours: a price with almost no trading behind it":
    "{volume} Umsatz in 24 Stunden: ein Preis fast ohne Handel dahinter",
  "Quarantined on {date}: {evidence}. Its numbers are still collected and shown here, but it is left out of the default Screener and Arbitrage rankings until the venue review clears it.":
    "Unter Quarantäne seit {date}: {evidence}. Ihre Zahlen werden weiter erfasst und hier gezeigt, aber sie bleibt aus den Standard-Rankings von Screener und Arbitrage, bis die Börsenprüfung sie freigibt.",
  quarantined: "unter Quarantäne",
  "Quarantined exchanges are left out unless you tick them: their numbers are still collected, but not trusted to rank.":
    "Börsen unter Quarantäne bleiben außen vor, es sei denn, du hakst sie an: Ihre Zahlen werden weiter erfasst, gelten aber nicht als verlässlich fürs Ranking.",
  "Default exchanges": "Standardbörsen",
  "Crypto funding rate arbitrage across perp exchanges":
    "Krypto-Funding-Rate-Arbitrage zwischen Perpetual-Börsen",
  "Live crypto funding rate spreads between perpetual futures exchanges, refreshed every minute: which exchange to long, which to short, and what the best pair paid over the last 7 days.":
    "Live-Spreads der Krypto-Funding-Rates zwischen Perpetual-Futures-Börsen, jede Minute aktualisiert: wo long, wo short, und was das beste Paar in den letzten 7 Tagen gezahlt hat.",
  "Find funding rate arbitrage: filter live cross-exchange funding spreads for every perpetual pair by open interest, volume, steadiness and exchange.":
    "Funding-Rate-Arbitrage finden: Live-Funding-Spreads zwischen Börsen für jedes Perpetual-Paar nach Open Interest, Volumen, Stetigkeit und Börse filtern.",
  "Live perpetual futures funding rates for every asset on every exchange in one grid, as APR now or averaged over 7, 30 or 60 days, with options gamma, macro and prediction market tabs.":
    "Live-Funding-Rates von Perpetual Futures für jedes Asset an jeder Börse in einer Tabelle, als APR jetzt oder im Schnitt über 7, 30 oder 60 Tage, mit Tabs zu Options-Gamma, Makro und Prognosemärkten.",
  "Crypto arbitrage: price gaps across exchanges": "Krypto-Arbitrage: Preislücken zwischen Börsen",
  "Live crypto arbitrage across perpetual futures exchanges: where one exchange's bid sits above another's ask, by how much, and the basis between them.":
    "Live-Krypto-Arbitrage zwischen Perpetual-Futures-Börsen: wo das Bid einer Börse über dem Ask einer anderen liegt, um wie viel, und die Basis dazwischen.",
  "Funding rate arbitrage screener": "Funding-Rate-Arbitrage-Screener",
  "Crypto funding rates on every exchange": "Krypto-Funding-Rates an allen Börsen",
};
