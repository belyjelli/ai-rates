/**
 * The chart pages and their readouts in German: web/cvd.ts, web/kchart.ts, web/sentiment.ts,
 * web/funding-chart.ts and web/slot-chart.ts (web/rail.ts has no words of its own).
 * Glossary and style: ./index.ts.
 *
 * Keys shared with the liquidations part (months, dates, "Window", the hover hints) carry the same
 * translation there, which i18n.test.ts holds.
 */

import type { Catalog } from "../../i18n";

export const charts: Catalog = {
  // Dates on the axes and in the hover readouts; the month names are marked in web/slot-chart.ts.
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
  "{month} {day} {time} {zone}": "{day}. {month} {time} {zone}",

  // web/slot-chart.ts: the hover readouts of the CVD and longs-vs-shorts charts.
  "{low} – {high} ({pct} from the mark)": "{low} – {high} ({pct} vom Mark-Preis)",
  "longs liquidate here: {usd} ({n})": "Longs werden hier liquidiert: {usd} ({n})",
  "shorts liquidate here: {usd} ({n})": "Shorts werden hier liquidiert: {usd} ({n})",
  "{n} position": "{n} Position",
  "no whale liquidates here": "hier wird kein Wal liquidiert",
  "{usd} of longs liquidate between here and the mark":
    "{usd} an Longs werden zwischen hier und dem Mark-Preis liquidiert",
  "{usd} of shorts liquidate between the mark and here":
    "{usd} an Shorts werden zwischen dem Mark-Preis und hier liquidiert",
  Cursor: "Cursor",
  cursor: "Cursor",
  bar: "Balken",
  cross: "Fadenkreuz",
  "Light up the bar under the pointer": "Hebt den Balken unter dem Zeiger hervor",
  "Dashed crosshair at the pointer, with the value there on each axis":
    "Gestricheltes Fadenkreuz am Zeiger, mit dem Wert dort auf jeder Achse",
  "no flow recorded": "kein Flow erfasst",
  "close {price}": "Schluss {price}",
  "close {price} ({pct} since start)": "Schluss {price} ({pct} seit Beginn)",
  "bought {usd}": "gekauft {usd}",
  "sold {usd}": "verkauft {usd}",
  "net {net}": "netto {net}",
  "net {net} ({pct} of volume)": "netto {net} ({pct} des Volumens)",
  "nothing force-closed": "nichts zwangsgeschlossen",
  "longs closed {usd}": "Longs geschlossen {usd}",
  "shorts closed {usd}": "Shorts geschlossen {usd}",
  "longs − shorts {diff}": "Longs − Shorts {diff}",
  even: "ausgeglichen",
  "longs heavier, {pct}%": "mehr Longs, {pct}%",
  "shorts heavier, {pct}%": "mehr Shorts, {pct}%",
  "{n} liquidation": "{n} Liquidation",
  "{n} liquidations": "{n} Liquidationen",
  "{when} (still filling)": "{when} (läuft noch)",

  // web/cvd.ts: the chart.
  "{asset} · cumulative volume delta · {n}-hour bars, {zone}":
    "{asset} · kumuliertes Volumendelta · {n}-Stunden-Balken, {zone}",
  "{asset} · cumulative volume delta · {n}-minute bars, {zone}":
    "{asset} · kumuliertes Volumendelta · {n}-Minuten-Balken, {zone}",
  "{asset} futures taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.":
    "Taker-CVD der {asset}-Futures, letzte {window}: {cvd}. Market-Käufer {bought} vs. Verkäufer {sold}.",
  "{asset}, last {window}: futures CVD {futures}, spot CVD {spot}, delta {delta}.":
    "{asset}, letzte {window}: Futures-CVD {futures}, Spot-CVD {spot}, Delta {delta}.",
  "Last {window}": "Letzte {window}",
  "Loading {interval} bars…": "Lade {interval}-Balken…",
  "Loading {asset}…": "Lade {asset}…",
  "Not available yet: there is not enough history for {interval} bars":
    "Noch nicht verfügbar: zu wenig Historie für {interval}-Balken",
  "Not available yet": "Noch nicht verfügbar",
  Price: "Preis",
  "Net buy": "Netto-Kauf",
  "Net sell": "Netto-Verkauf",
  "hover or tap a bar to read it": "Balken antippen oder mit der Maus darauf zeigen",
  "{asset} bars; arrow keys read one at a time":
    "{asset}-Balken; Pfeiltasten lesen einen nach dem anderen",
  "{asset} price and cumulative volume delta over the last {window}":
    "{asset}-Preis und kumuliertes Volumendelta über die letzten {window}",
  "{asset} net taker flow per bar": "Netto-Taker-Flow von {asset} pro Balken",

  // web/cvd.ts: tiles, controls and the screener table.
  Volume: "Volumen",
  CVD: "CVD",
  "CVD / volume": "CVD / Volumen",
  Change: "Veränderung",
  "CVD breadth": "CVD-Breite",
  "of {n} assets with net taker buying": "von {n} Assets mit Netto-Taker-Käufen",
  "Bullish divergences": "Bullische Divergenzen",
  "price down ≥{price}%, takers net buying ≥{flow}% of volume":
    "Preis ≥{price}% gefallen, Taker netto kaufend ≥{flow}% des Volumens",
  "Bearish divergences": "Bärische Divergenzen",
  "price up ≥{price}%, takers net selling ≥{flow}% of volume":
    "Preis ≥{price}% gestiegen, Taker netto verkaufend ≥{flow}% des Volumens",
  "Top CVD flows": "Größte CVD-Flows",
  "largest net buy / net sell": "größter Netto-Kauf / Netto-Verkauf",
  Window: "Zeitraum",
  "bullish div": "bull. Div.",
  "bearish div": "bär. Div.",
  "Search symbol": "Symbol suchen",
  Find: "Suchen",
  "Pick an asset to chart": "Asset für den Chart wählen",
  "{n} assets": "{n} Assets",
  "No asset matches.": "Kein Asset passt.",
  "No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.":
    "In den letzten {window} wurde kein Taker-Flow erfasst. Die Erfassung fragt jede Börse alle fünf Minuten ab; ein neues Deployment füllt in der ersten Stunde etwa eine Woche nach.",
  Asset: "Asset",
  "Reference market's first close to last close in the window":
    "Erster bis letzter Schluss des Referenzmarkts im Zeitraum",
  "Taker buys less taker sells, in dollars, summed over the polled venues":
    "Taker-Käufe minus Taker-Verkäufe in Dollar, summiert über die abgefragten Börsen",
  "CVD as a share of the window's taker volume": "CVD als Anteil am Taker-Volumen des Zeitraums",
  "Taker buys plus taker sells, in dollars": "Taker-Käufe plus Taker-Verkäufe in Dollar",
  "Polled venues with flow for this asset": "Abgefragte Börsen mit Flow für dieses Asset",
  Venues: "Börsen",
  "Price and flow disagreeing by more than the divergence thresholds in the tiles":
    "Preis und Flow weichen stärker voneinander ab als die Divergenz-Schwellen in den Kacheln",
  Signal: "Signal",
  "No live market lists {asset}, so there is no flow to chart.":
    "Kein aktiver Markt listet {asset}, daher gibt es keinen Flow für den Chart.",
  "Newest bucket {age}.": "Neuestes Intervall {age}.",
  "The venues that publish statistics release each 5-minute bucket after it closes, so the newest bar holds only the live tapes for a few minutes.":
    "Börsen, die Statistiken veröffentlichen, geben jedes 5-Minuten-Intervall erst nach seinem Ende frei, daher enthält der neueste Balken einige Minuten lang nur die Live-Trades.",

  // web/cvd.ts: the page.
  "taker buys": "Taker-Käufe",
  "taker sells": "Taker-Verkäufe",
  "The asset button beside the intervals opens the screener: every polled asset's taker flow over the window. Pick one to chart it, find a ticker in its box, or sort by a heading. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance, Aster, Gate and Bitget publish weeks of it and OKX five days, while every other venue, spot books other than Binance's included, is counted from its live trades since 28 October 2026, so older bars sum fewer venues.":
    "Der Asset-Button neben den Intervallen öffnet den Screener: den Taker-Flow jedes abgefragten Assets im Zeitraum. Wähl eins für den Chart, such einen Ticker im Feld oder sortier nach einer Spalte. Veränderung reicht vom ersten bis zum letzten Schluss des umsatzstärksten abgefragten Markts im Zeitraum. Die Historie ist je Börse verschieden: Binance, Aster, Gate und Bitget veröffentlichen Wochen davon, OKX fünf Tage, während jede andere Börse, Spot-Orderbücher außer dem von Binance eingeschlossen, ab ihren Live-Trades seit dem 28. Oktober 2026 gezählt wird, daher summieren ältere Balken weniger Börsen.",

  // web/funding-chart.ts
  "The funding chart is unavailable right now. The backtest below is unaffected.":
    "Der Funding-Chart ist gerade nicht verfügbar. Der Backtest darunter ist nicht betroffen.",
  "No stored funding for this window yet.":
    "Für diesen Zeitraum ist noch kein Funding gespeichert.",
  Spread: "Spread",
  "Funding by exchange, annualized · hourly": "Funding nach Börse, annualisiert · stündlich",
  "Funding by exchange, annualized · daily": "Funding nach Börse, annualisiert · täglich",
  "Funding APR by exchange over the window": "Funding-APR nach Börse im Zeitraum",
  "Hover the chart to read every visible line at one moment.":
    "Zeig mit der Maus auf den Chart, um alle sichtbaren Linien zu einem Zeitpunkt abzulesen.",
  "Signed log scale, so ordinary rates keep room beside extreme ones. Each line holds a rate until that exchange's next settlement; a break is time with no recorded funding, not a zero.":
    "Logarithmische Skala mit Vorzeichen, damit normale Raten neben extremen Platz behalten. Jede Linie hält eine Rate bis zur nächsten Abrechnung dieser Börse; eine Lücke ist Zeit ohne erfasstes Funding, keine Null.",

  // web/sentiment.ts
  "No readings yet in this window.": "In diesem Zeitraum noch keine Werte.",
  "Fear & greed: {score}, {label}": "Angst und Gier: {score}, {label}",
  "Fear and greed score reaches {score} ({label})":
    "Angst-und-Gier-Wert erreicht {score} ({label})",
  "{n} readings, every 30 minutes · {age} to now": "{n} Werte, alle 30 Minuten · {age} bis jetzt",
  "no data in window": "keine Daten im Zeitraum",
  "Fear &amp; greed · updated {ago}": "Angst und Gier · aktualisiert {ago}",
  "Fear &amp; greed": "Angst und Gier",
  component: "Komponente",
  reading: "Wert",
  "percentile (30d, greed direction)": "Perzentil (30 T, Richtung Gier)",
  "funding (OI-weighted APR)": "Funding (OI-gewichtete APR)",
  "open interest": "Open Interest",
  "liquidation skew (24h)": "Liquidations-Schiefe (24h)",
  "{pct} long-heavy": "{pct} long-lastig",
  "taker flow (24h)": "Taker-Flow (24h)",
  "{pct} net buy": "{pct} Netto-Kauf",
  "Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.":
    "Der Wert ist der Mittelwert aus vier Komponenten, jede ein Perzentilrang gegen die eigene 30-Tage-Historie dieses Buchs — keine feste Skala, daher liest sich dieselbe Rohzahl in einer ruhigen Phase anders als in einer volatilen. Bei <b>Funding</b> und <b>Open Interest</b> heißt hoch gierig (volle, gehebelte Longs, die fürs Halten zahlen). Die <b>Liquidations-Schiefe</b> wird vor dem Mitteln umgekehrt: Ein Buch, in dem Longs herausgedrängt werden, ist Angst, wie ungewöhnlich dieser Wert gegen die eigene Historie auch aussieht. Der <b>Taker-Flow</b> sind aggressive Netto-Käufe gegenüber aggressiven Verkäufen, letzte 24h. Alle 30 Minuten vom Collector berechnet (belyjelli/profitlock-worker, der Job <code>market sentiment</code> neben <code>collector rank-eval</code>); Liquidationen und Taker-Flow decken nicht alle Börsen ab, daher ist das eine Näherung, keine Garantie für den ganzen Markt.",
  "Fear & Greed": "Angst und Gier",
  "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.":
    "Ein Angst-und-Gier-Wert für den Funding-Markt: OI-gewichtetes Funding, Open Interest, Liquidations-Schiefe und Taker-Flow, jeweils gegen die eigene 30-Tage-Historie eingestuft.",
  "{month} {day} {time}–{end} {zone}": "{day}. {month} {time}–{end} {zone}",
  "close, {market}": "Schluss, {market}",
  "open {open} · high {high} · low {low} · close {close}":
    "Eröffnung {open} · Hoch {high} · Tief {low} · Schluss {close}",
  "volume {usd}": "Volumen {usd}",
  "large taker buys {usd} ({n})": "große Taker-Käufe {usd} ({n})",
  "large taker sells {usd} ({n})": "große Taker-Verkäufe {usd} ({n})",
  "no candle": "keine Kerze",
  "{month} {day} {hours} {zone}": "{day}. {month} {hours} {zone}",
  "{hours} {zone}": "{hours} {zone}",

  // web/kchart.ts: the trading chart on /cvd.
  "Loading older bars…": "Lade ältere Balken…",
  "Nothing older: taker flow is kept for {days} days.":
    "Nichts Älteres: Taker-Flow wird {days} Tage gespeichert.",
  "Older bars did not load. Drag again to retry.":
    "Ältere Balken wurden nicht geladen. Zieh erneut, um es nochmal zu versuchen.",
  "drag to look back · wheel or pinch to zoom · hover a candle to read it":
    "ziehen zum Zurückblättern · Mausrad oder Pinch zum Zoomen · auf eine Kerze zeigen zum Ablesen",
  "Futures CVD": "Futures-CVD",
  "Spot CVD": "Spot-CVD",
  "Delta buy": "Delta Kauf",
  "Delta sell": "Delta Verkauf",
  "{asset} delta per bar, spot and futures net taker flow summed":
    "{asset}-Delta pro Balken, Netto-Taker-Flow aus Spot und Futures summiert",
  "No taker flow for {asset} in the last {window}. Only the ~500 assets deepest on {venues} are polled; pick one from the asset list above.":
    "Kein Taker-Flow für {asset} in den letzten {window}. Nur die ~500 liquidesten Assets auf {venues} werden abgefragt; wähl eins aus der Asset-Liste oben.",
  "Price with cumulative volume delta under it: spot and futures taker buying against taker selling, their combined delta per bar, and where price and order flow disagree.":
    "Preis mit dem kumulierten Volumendelta darunter: Taker-Käufe gegen Taker-Verkäufe in Spot und Futures, ihr gemeinsames Delta pro Balken und wo Preis und Orderflow auseinanderlaufen.",
  "Price, with cumulative volume delta (CVD) under it: {buys} less {sells}, in dollars, summed over every exchange we collect that lists the asset, with its USDT, USDC and USD markets counted as one. Futures CVD adds up the perpetuals on <b>{futures}</b>; spot CVD the spot books on <b>{spot}</b>. It covers the ~500 assets deepest by open interest and every commodity, index and currency pair, in 5-minute buckets. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.":
    "Preis, mit dem kumulierten Volumendelta (CVD) darunter: {buys} minus {sells} in Dollar, summiert über jede erfasste Börse, die das Asset listet, wobei seine USDT-, USDC- und USD-Märkte als einer zählen. Der Futures-CVD summiert die Perpetuals auf <b>{futures}</b>, der Spot-CVD die Spot-Orderbücher auf <b>{spot}</b>. Abgedeckt sind die ~500 Assets mit dem höchsten Open Interest und alle Rohstoffe, Indizes und Währungspaare, in 5-Minuten-Intervallen. Eine Divergenz markiert einen Zeitraum, in dem Preis und Flow in entgegengesetzte Richtungen zeigten; sie beschreibt, was geschah, nicht was als Nächstes kommt.",
  "Each key above the chart says how many venues its line sums for this asset; hover it for their names. Spot covers crypto and stocks: a stock's spot books are its tokenized shares (xStocks, Ondo and the like) on the collected exchanges, counted only while they trade at the stock's own price. Commodities and indices show futures only. Spot and futures each have a pane, because their sizes differ by an order of magnitude on most assets. The histogram under them is the delta: each bar's spot and futures net summed.":
    "Jede Legende über dem Chart sagt, wie viele Börsen ihre Linie für dieses Asset summiert; zeig darauf für die Namen. Spot umfasst Krypto und Aktien: Die Spot-Orderbücher einer Aktie sind ihre tokenisierten Anteile (xStocks, Ondo und ähnliche) auf den erfassten Börsen, gezählt nur solange sie zum Kurs der Aktie selbst handeln. Rohstoffe und Indizes zeigen nur Futures. Spot und Futures haben je ein eigenes Feld, weil ihre Größen bei den meisten Assets um eine Größenordnung abweichen. Das Histogramm darunter ist das Delta: das Netto aus Spot und Futures je Balken, summiert.",
  "Price is the busiest polled market's own candle. Each pane has its own scale, so where lines cross means nothing. Drag to look back, wheel or pinch to zoom, and hover a candle to read it in the box beside it; on a phone, tap.":
    "Der Preis ist die Kerze des umsatzstärksten abgefragten Markts. Jedes Feld hat seine eigene Skala, daher bedeutet es nichts, wo sich Linien kreuzen. Zieh zum Zurückblättern, zoom mit Mausrad oder Pinch und zeig auf eine Kerze, um sie im Feld daneben abzulesen; am Handy tippen.",
  "futures net {net}": "Futures netto {net}",
  "spot net {net}": "Spot netto {net}",
  "delta {net}": "Delta {net}",
  "delta {net} ({pct} of volume)": "Delta {net} ({pct} des Volumens)",
  "CVD futures {futures}, spot {spot}": "CVD Futures {futures}, Spot {spot}",
  Open: "Eröffnung",
  High: "Hoch",
  Low: "Tief",
  Futures: "Futures",
  "Spot (Binance)": "Spot (Binance)",
  // The Chart page's fund-flow dropdown (web/fund-flow.ts).
  "No spot book for this asset on the collected exchanges.":
    "Kein Spot-Orderbuch für dieses Asset auf den erfassten Börsen.",
  "No futures flow for this asset yet.": "Noch kein Futures-Flow für dieses Asset.",
  Time: "Zeitraum",
  "Taker buys in the window, in dollars": "Taker-Käufe im Zeitraum, in Dollar",
  "Inflow ($)": "Zufluss ($)",
  "Taker sells in the window, in dollars": "Taker-Verkäufe im Zeitraum, in Dollar",
  "Outflow ($)": "Abfluss ($)",
  "Inflow less outflow": "Zufluss minus Abfluss",
  "Net inflow ($)": "Netto-Zufluss ($)",
  "Net inflow against the window of the same length before it":
    "Netto-Zufluss gegenüber dem gleich langen Zeitraum davor",
  "Net inflow change": "Veränderung Netto-Zufluss",
  "Net inflow as a share of the asset's market cap":
    "Netto-Zufluss als Anteil an der Marktkapitalisierung des Assets",
  "F/M cap ratio": "F/MCap-Verhältnis",
  "Spot fund": "Spot-Flow",
  "Spot books on {venues}": "Spot-Orderbücher auf {venues}",
  "{count} venues": "{count} Börsen",
  "Futures fund": "Futures-Flow",
  "Perpetuals on {venues}": "Perpetuals auf {venues}",
  "Fund flow": "Kapitalfluss",
  "Inflow is taker buying and outflow taker selling, summed over each window back from the newest bucket every venue has published. Net inflow change compares the net with the window of the same length before it. F/M cap ratio is the net as a share of the asset's market cap (CoinGecko). A dash means the history does not reach back that far yet.":
    "Zufluss sind Taker-Käufe und Abfluss Taker-Verkäufe, summiert über jeden Zeitraum ab dem neuesten Intervall, das alle Börsen veröffentlicht haben. Die Veränderung des Netto-Zuflusses vergleicht das Netto mit dem gleich langen Zeitraum davor. Das F/MCap-Verhältnis ist das Netto als Anteil an der Marktkapitalisierung des Assets (CoinGecko). Ein Strich heißt, dass die Historie noch nicht so weit zurückreicht.",
  "Up to": "Bis",

  // web/cvd.ts: the Detail view, the charted asset's own figures in place of the chart.
  "{ratio} of {volume} taker volume, {venues}": "{ratio} von {volume} Taker-Volumen, {venues}",
  "Bullish divergence": "Bullische Divergenz",
  "Bearish divergence": "Bärische Divergenz",
  "No divergence": "Keine Divergenz",
  "price {change}, futures flow {ratio} of volume; a flag needs both past {price}% and {flow}%":
    "Preis {change}, Futures-Flow {ratio} des Volumens; ein Signal braucht beides über {price}% und {flow}%",
  "{venue} spot": "{venue} Spot",
  "largest net buy and net sell by exchange": "größter Netto-Kauf und Netto-Verkauf nach Börse",
  "{n} markets, 24h volume {volume}": "{n} Märkte, 24h-Volumen {volume}",
  "weighted by open interest; {low} to {high} across markets":
    "nach Open Interest gewichtet; {low} bis {high} über die Märkte",
  "Market cap": "Marktkapitalisierung",
  "CoinGecko's, read hourly; crypto only": "von CoinGecko, stündlich gelesen; nur Krypto",
  "{interval} bars": "{interval}-Balken",
  "Signal by window": "Signal nach Zeitraum",
  "More on {asset}:": "Mehr zu {asset}:",
  "By exchange": "Nach Börse",
  "Back to the chart": "Zurück zum Chart",
  "{asset}'s flow by window and by exchange, with its open interest and funding":
    "Flow von {asset} nach Zeitraum und Börse, mit Open Interest und Funding",
  Detail: "Detail",
  "Detail, beside Fund flow, puts the asset's own figures where the chart and the market's tiles are, over the same window: its futures and spot CVD, whether it diverged, the exchanges that bought and sold it most, its open interest, funding and market cap; then its signal over every interval's span, and its flow exchange by exchange. Chart brings the chart back.":
    "Detail, neben Kapitalfluss, zeigt die eigenen Zahlen des Assets dort, wo Chart und Marktkacheln stehen, im selben Zeitraum: seinen Futures- und Spot-CVD, ob es eine Divergenz gab, die Börsen, die es am meisten gekauft und verkauft haben, sein Open Interest, Funding und seine Marktkapitalisierung; dann sein Signal über die Spanne jedes Intervalls und seinen Flow Börse für Börse. Chart bringt den Chart zurück.",
  // The Chart page's spot ETF flow pins (web/kchart.ts).
  "Spot ETF net inflow": "Netto-Zufluss Spot-ETFs",
  "Spot ETF net outflow": "Netto-Abfluss Spot-ETFs",
  "Counted: {funds}. Not read: {missing}, whose issuers block automated reads.":
    "Gezählt: {funds}. Nicht gelesen: {missing}, deren Emittenten automatisches Auslesen blockieren.",
  "pins: spot ETF net flow per trade day, at the 4 pm New York NAV":
    "Markierungen: Netto-Flow der Spot-ETFs pro Handelstag, zum NAV um 16 Uhr New York",
  "{date}, 4 pm New York close": "{date}, Schluss 16 Uhr New York",
  "Not reported yet: {funds}": "Noch nicht gemeldet: {funds}",
  "Spot ETF net inflow so far": "Netto-Zufluss Spot-ETFs bisher",
  "Spot ETF net outflow so far": "Netto-Abfluss Spot-ETFs bisher",
  "{n} of {total} funds reported": "{n} von {total} Fonds gemeldet",
  "{asset} chart: price and CVD": "{asset}-Chart: Preis und CVD",
  "{asset} price with cumulative volume delta under it: spot and futures taker buying against taker selling across exchanges, and where price and order flow disagree.":
    "{asset}-Preis mit dem kumulierten Volumendelta darunter: Taker-Käufe gegen Taker-Verkäufe in Spot und Futures über die Börsen hinweg und wo Preis und Orderflow auseinanderlaufen.",
  "{asset} · interbank rate · {n}-hour bars, {zone}":
    "{asset} · Interbankenkurs · {n}-Stunden-Balken, {zone}",
  "{asset} · interbank rate · {n}-minute bars, {zone}":
    "{asset} · Interbankenkurs · {n}-Minuten-Balken, {zone}",
  "Last {window}: {from} to {to}": "Letzte {window}: {from} bis {to}",
  "No exchange trades {asset}, so it has no taker flow to sum: this is its interbank rate, quoted every five minutes. Last quote {age}.":
    "Keine Börse handelt {asset}, daher gibt es keinen Taker-Flow zu summieren: Das ist der Interbankenkurs, alle fünf Minuten notiert. Letzte Notierung {age}.",
  "interbank rate": "Interbankenkurs",
  "{asset} interbank rate over the last {window}":
    "Interbankenkurs von {asset} der letzten {window}",
  "No exchange trades it: its interbank rate, with no taker flow":
    "Von keiner Börse gehandelt: nur der Interbankenkurs, ohne Taker-Flow",
  "rate only": "nur Kurs",
  "{asset} chart: interbank rate": "{asset}-Chart: Interbankenkurs",
  "{asset} interbank rate, quoted every five minutes. No exchange trades it, so it has no taker flow or CVD.":
    "Interbankenkurs von {asset}, alle fünf Minuten notiert. Keine Börse handelt ihn, daher gibt es weder Taker-Flow noch CVD.",
  "A currency pair that no exchange trades, USD/CNH and USD/HKD among them, is listed with its interbank rate instead: quoted every five minutes, with no taker flow, so its row has no CVD and its chart is the rate alone.":
    "Ein Währungspaar, das keine Börse handelt, darunter USD/CNH und USD/HKD, wird stattdessen mit seinem Interbankenkurs geführt: alle fünf Minuten notiert, ohne Taker-Flow, daher hat seine Zeile kein CVD und sein Chart zeigt nur den Kurs.",
  "its interbank rate, quoted every five minutes": "der Interbankenkurs, alle fünf Minuten notiert",
  "No exchange trades {asset}, so it has no taker flow to sum: this is its interbank rate, worked out from {first} and {second}, each quoted every five minutes. Older quote {age}.":
    "Keine Börse handelt {asset}, daher gibt es keinen Taker-Flow zu summieren: Das ist der Interbankenkurs, errechnet aus {first} und {second}, beide alle fünf Minuten notiert. Ältere Notierung {age}.",
};
