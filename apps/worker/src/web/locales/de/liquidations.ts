/**
 * web/liquidations.ts in German: the /liquidations map, the priced grid, the longs-vs-shorts chart,
 * the whale map, Largest, Cascades, the member tabs (History, vs OI, All cascades, Top traders) and
 * the summary sentences. Glossary and style: ./index.ts.
 *
 * Window codes ("24h", "7d") are left as written, as interval figures are elsewhere on the site: they
 * are units in a control strip and in its URLs, not words. Sentences around one say "in den letzten
 * {window}", which reads right for hours and days alike.
 */

import type { Catalog } from "../../i18n";

export const liquidations: Catalog = {
  // Axis dates.
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

  // Controls and legend.
  Window: "Zeitraum",
  Venue: "Börse",
  all: "alle",
  Cell: "Zelle",
  "longs closed": "Longs liquidiert",
  "shorts closed": "Shorts liquidiert",
  "Band width": "Bandbreite",
  Asset: "Asset",
  fit: "anpassen",

  // The map tab.
  "{usd} across {count} liquidation — {long} long, {short} short":
    "{usd} in {count} Liquidation — {long} Long, {short} Short",
  "{usd} across {count} liquidations — {long} long, {short} short":
    "{usd} in {count} Liquidationen — {long} Long, {short} Short",
  "This column is still filling": "Diese Spalte füllt sich noch",
  "<b>{usd}</b> · {events} liquidations · {markets} markets":
    "<b>{usd}</b> · {events} Liquidationen · {markets} Märkte",
  "no liquidations in this window": "keine Liquidationen in diesem Zeitraum",
  "other markets": "andere Märkte",
  total: "gesamt",
  "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.":
    "Keine Liquidationen in den letzten {window} erfasst. Hier erscheinen nur die Börsen, die einen Feed veröffentlichen, den der Collector liest; ein ruhiger Zeitraum heißt also nicht, dass der Markt ruhig war.",
  "Columns are {hours}-hour buckets in {zone}, newest on the right; the last one is still filling.":
    "Die Spalten sind {hours}-Stunden-Blöcke in {zone}, die neuesten rechts; der letzte füllt sich noch.",
  "Newest liquidation {age}.": "Neueste Liquidation {age}.",
  "Rows are the {count} busiest assets by notional across every feed, and the rest are summed into “other markets”, so the totals below the grid are real totals and add up.":
    "Die Zeilen sind die {count} Assets mit dem meisten Nominalwert über alle Feeds, der Rest wird unter „andere Märkte“ summiert, daher sind die Summen unter dem Raster echte Summen und gehen auf.",
  "Any row opens that asset at the price it died at.":
    "Jede Zeile öffnet dieses Asset bei dem Preis, zu dem die Positionen liquidiert wurden.",

  // The priced tab.
  "<b>{usd}</b> · {events} liquidations · {long} long / {short} short":
    "<b>{usd}</b> · {events} Liquidationen · {long} Long / {short} Short",
  "nothing force-closed here in this window": "hier in diesem Zeitraum nichts liquidiert",
  "Fill price": "Ausführungspreis",
  "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.":
    "Kein aktiver Markt für {asset} veröffentlicht einen Mark-Preis, daher gibt es keinen Preis, um Liquidationen in Bänder einzuteilen.",
  "No liquidations recorded for {asset} in the last {window}. Only the venues publishing a feed the collector reads appear here.":
    "Keine Liquidationen für {asset} in den letzten {window} erfasst. Hier erscheinen nur die Börsen, die einen Feed veröffentlichen, den der Collector liest.",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark; the outer rows hold everything further out.":
    "Gezeigt: <b>{asset}</b>, in Bändern von {pct}% um den Mark-Preis; die äußeren Zeilen fassen alles weiter Entfernte zusammen.",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark, fitted to where this asset's closes actually landed; the outer rows hold everything further out.":
    "Gezeigt: <b>{asset}</b>, in Bändern von {pct}% um den Mark-Preis, angepasst daran, wo die Liquidationen dieses Assets tatsächlich lagen; die äußeren Zeilen fassen alles weiter Entfernte zusammen.",
  "Banded from <b>{mark}</b>, the deepest market's mark — the same anchor the arbitrage guard uses, so both venues share rows.":
    "Bänder ab <b>{mark}</b>, dem Mark-Preis des tiefsten Markts — derselbe Anker, den der Arbitrage-Schutz nutzt, daher teilen sich beide Börsen die Zeilen.",

  // The longs-vs-shorts tab and its chart.
  "Last {window}": "Letzte {window}",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Longs took the beating.":
    "{asset}-Liquidationen, letzte {window}: {long} Longs und {short} Shorts zwangsgeschlossen, {events} Ereignisse. Die Longs traf es härter.",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Shorts took the beating.":
    "{asset}-Liquidationen, letzte {window}: {long} Longs und {short} Shorts zwangsgeschlossen, {events} Ereignisse. Die Shorts traf es härter.",
  "{asset} longs vs shorts over time · {hours}-hour bars, {zone}":
    "{asset} Longs vs. Shorts im Zeitverlauf · {hours}-Stunden-Balken, {zone}",
  "{asset} longs vs shorts over time · {minutes}-minute bars, {zone}":
    "{asset} Longs vs. Shorts im Zeitverlauf · {minutes}-Minuten-Balken, {zone}",
  "Longs closed": "Longs liquidiert",
  "Shorts closed": "Shorts liquidiert",
  "Longs at risk, modeled · price falls <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "Longs in Gefahr, modelliert · Preis fällt <b>{pct}</b> auf {range} · etwa <b>{usd}</b> würden liquidiert",
  "Shorts at risk, modeled · price rises <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "Shorts in Gefahr, modelliert · Preis steigt <b>{pct}</b> auf {range} · etwa <b>{usd}</b> würden liquidiert",
  "Shorts at risk above": "Shorts in Gefahr darüber",
  "Longs at risk below": "Longs in Gefahr darunter",
  "Modeled pending liquidations between {low} and {high}, around {mark}: about {shorts} of shorts above and {longs} of longs below":
    "Modellierte ausstehende Liquidationen zwischen {low} und {high}, um {mark}: etwa {shorts} Shorts darüber und {longs} Longs darunter",
  "Pending range": "Ausstehender Bereich",
  "Zoom in": "Vergrößern",
  "Columns are time, in your time zone ({zone}; click the clock at the top for UTC). Each is a {hours}-hour block named by its start hour. Where the day changes, the column shows date/hour (7/00 = the 7th at 00:00). The yellow column is the block in progress and still filling.":
    "Die Spalten sind die Zeit, in deiner Zeitzone ({zone}; klick oben auf die Uhr für UTC). Jede ist ein {hours}-Stunden-Block, benannt nach seiner Startstunde. Wo der Tag wechselt, zeigt die Spalte Tag/Stunde (7/00 = der 7. um 00:00). Die gelbe Spalte ist der laufende Block, der sich noch füllt.",
  "'All' is that price row's total over the whole window.":
    "„Alle“ ist die Summe dieser Preiszeile über den ganzen Zeitraum.",
  "{range}, still filling": "{range}, füllt sich noch",
  "This tab did not load.": "Dieser Tab hat nicht geladen.",
  "Try again": "Erneut versuchen",
  "Loading…": "Lädt…",
  "Open this tab": "Diesen Tab öffnen",
  "This tab has nothing to show right now.": "Dieser Tab hat gerade nichts anzuzeigen.",
  "Zoom out": "Verkleinern",
  "shorts liquidate if price rises": "Shorts werden liquidiert, wenn der Preis steigt",
  "longs liquidate if price falls": "Longs werden liquidiert, wenn der Preis fällt",
  "pending is modeled": "Ausstehendes ist modelliert",
  "pending by price band": "ausstehend nach Preisband",
  "axis squeezed above {usd}": "Achse über {usd} gestaucht",
  "Modeled from 30 days of open interest and price on each market and its leverage limits, not reported by venues.":
    "Modelliert aus 30 Tagen Open Interest und Preis jedes Markts und seinen Hebel-Limits, nicht von Börsen gemeldet.",
  Pending: "Ausstehend",
  "Pending on": "Ausstehend an",
  "Pending off": "Ausstehend aus",
  "hover or tap a bar to read it": "Balken antippen oder mit der Maus darauf zeigen",
  "{asset} bars; arrow keys read one at a time":
    "{asset}-Balken; Pfeiltasten lesen einen nach dem anderen",
  "{asset} longs closed above zero and shorts closed below, over the last {window}":
    "{asset}: liquidierte Longs über null und liquidierte Shorts darunter, in den letzten {window}",
  "Longs closed above the line, shorts closed below, on the same linear scale. Hover a bar to read it beside the cursor; on a phone, tap and it reads in the line above the chart. The last bar is still filling.":
    "Liquidierte Longs über der Linie, liquidierte Shorts darunter, auf derselben linearen Skala. Zeig mit der Maus auf einen Balken, um den Wert neben dem Cursor zu sehen; am Handy tippen, dann erscheint er in der Zeile über dem Chart. Der letzte Balken füllt sich noch.",
  "{usd} of longs closed between {band}": "{usd} Longs liquidiert zwischen {band}",
  "{usd} of shorts closed between {band}": "{usd} Shorts liquidiert zwischen {band}",
  "Longs closed <b>{usd}</b> · {share}%": "Longs liquidiert <b>{usd}</b> · {share}%",
  "Shorts closed <b>{usd}</b> · {share}%": "Shorts liquidiert <b>{usd}</b> · {share}%",
  All: "Alle",
  "Nothing was force-closed in {asset} in the last {window}, on either side.":
    "In {asset} wurde in den letzten {window} auf keiner Seite etwas liquidiert.",
  "Showing <b>{asset}</b>, every exchange added together — the split by exchange is one tab along. Rows are the same {pct}% price bands, banded from <b>{mark}</b>. A long close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran against. Any asset outside this list opens from a row on the map tab.":
    "Gezeigt: <b>{asset}</b>, alle Börsen zusammengerechnet — die Aufteilung nach Börse ist einen Tab weiter. Die Zeilen sind dieselben Preisbänder von {pct}%, ab <b>{mark}</b>. Die Liquidation eines Longs ist ein erzwungener VERKAUF, die eines Shorts ein erzwungener KAUF, daher ist die schwerere Seite die, gegen die die Bewegung lief. Jedes Asset außerhalb dieser Liste öffnet sich über eine Zeile im Karten-Tab.",

  // The page.
  "Nothing has been force-closed in this window, so there is no asset to price.":
    "In diesem Zeitraum wurde nichts liquidiert, daher gibt es kein Asset nach Preis zu zeigen.",
  "Nothing has been force-closed in this window, so there is no asset to split.":
    "In diesem Zeitraum wurde nichts liquidiert, daher gibt es kein Asset, das sich in Longs und Shorts aufteilen ließe.",
  "{first} and {last}": "{first} und {last}",
  ", ": ", ",
  Liquidations: "Liquidationen",
  "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.":
    "Wo Positionen zwangsgeschlossen wurden: nach Börse, Asset und Stunde und nach dem Preisniveau, auf dem sie endeten.",
  "Where positions were force-closed, by exchange. Colour is the side that was closed — {longs}, {shorts} — and intensity is the money, on a log scale.":
    "Wo Positionen zwangsgeschlossen wurden, nach Börse. Die Farbe ist die liquidierte Seite — {longs}, {shorts} — und die Intensität das Geld, auf logarithmischer Skala.",
  "blue for longs": "Blau für Longs",
  "red for shorts": "Rot für Shorts",
  "No venue has reported a liquidation in this window.":
    "Keine Börse hat in diesem Zeitraum eine Liquidation gemeldet.",
  "This is {venues}, the one venue whose liquidation feed the collector reads — not the whole market.":
    "Das ist {venues}, die einzige Börse, deren Liquidations-Feed der Collector liest — nicht der ganze Markt.",
  "This is {venues}, the {count} venues whose liquidation feed the collector reads — not the whole market.":
    "Das sind {venues}, die {count} Börsen, deren Liquidations-Feed der Collector liest — nicht der ganze Markt.",
  "Asset Timeline": "Asset-Zeitachse",
  Timeline: "Zeitachse",
  Assets: "Assets",
  "Longs vs shorts": "Longs vs. Shorts",
  "{asset} longs vs shorts": "{asset} Longs vs. Shorts",
  Sides: "Seiten",
  "By price level": "Nach Preisniveau",
  "{asset} price levels": "{asset} Preisniveaus",
  Prices: "Preise",
  "Updated {ago}.": "Aktualisiert {ago}.",

  // The odds tab.
  Odds: "Chancen",
  "{asset} odds": "{asset} Chancen",
  "Nothing has been force-closed in this window, so there is no asset to size.":
    "In diesem Zeitraum wurde nichts liquidiert, daher gibt es kein Asset zu bemessen.",
  "4 hours": "4 Stunden",
  "6 hours": "6 Stunden",
  "1 day": "1 Tag",
  "1 week": "1 Woche",
  Within: "Innerhalb",
  "Typical move (1 sigma)": "Typische Bewegung (1 Sigma)",
  "Closes higher than now": "Schließt höher als jetzt",
  "Reaches the heaviest forced-close level": "Erreicht das stärkste Liquidationsniveau",
  "Whichever of those two it reaches first": "Welches der beiden es zuerst erreicht",
  "The upper one first": "Das obere zuerst",
  "The lower one first": "Das untere zuerst",
  Neither: "Keines",
  "Reaches a move of": "Erreicht eine Bewegung von",
  "{price} ({where}) · {usd} closed, {share} of the window":
    "{price} ({where}) · {usd} liquidiert, {share} des Zeitraums",
  Theory: "Theorie",
  "Reading now": "Aktueller Wert",
  Leans: "Tendenz",
  "Moves the odds?": "Ändert die Chancen?",
  up: "aufwärts",
  down: "abwärts",
  "Forced-close burst fades": "Liquidationswelle läuft aus",
  "Funding crowding fades": "Funding-Gedränge läuft aus",
  "Stretch from the 50-hour average fades": "Abweichung vom 50-Stunden-Schnitt bildet sich zurück",
  "Initiative vs absorption": "Initiative vs. Absorption",
  "Fear and greed": "Angst und Gier",
  "Liquidation magnet": "Liquidationsmagnet",
  "Needs open positions by price level. The collector keeps closed ones only, so this cannot be read yet.":
    "Braucht offene Positionen nach Preisniveau. Der Collector speichert nur liquidierte, daher lässt sich das noch nicht lesen.",
  "Fewer than 5 forced closes in the last 4 hours: too thin to call a burst.":
    "Weniger als 5 Liquidationen in den letzten 4 Stunden: zu dünn für eine Welle.",
  "Not enough data.": "Nicht genug Daten.",
  "{longs} of the last 4 hours' forced closes were longs ({usd} in all)":
    "{longs} der Liquidationen der letzten 4 Stunden waren Longs ({usd} insgesamt)",
  "{apr} a year funding, weighted by open interest":
    "{apr} Funding pro Jahr, gewichtet nach Open Interest",
  "{sigma} bar-sigmas above its 50-hour average":
    "{sigma} Balken-Sigmas über dem 50-Stunden-Schnitt",
  "{sigma} bar-sigmas below its 50-hour average":
    "{sigma} Balken-Sigmas unter dem 50-Stunden-Schnitt",
  "takers net buying {pct} of volume": "Taker kaufen netto {pct} des Volumens",
  "takers net selling {pct} of volume": "Taker verkaufen netto {pct} des Volumens",
  "{flow}, price {change} over 4 hours": "{flow}, Preis {change} über 4 Stunden",
  "{score} out of 100": "{score} von 100",
  "No. Not yet tested, so it carries no weight.": "Nein. Noch nicht getestet, daher ohne Gewicht.",
  "No. Context only: its claim never leans.":
    "Nein. Nur Kontext: ihre Aussage hat nie eine Tendenz.",
  "No. Cannot be computed.": "Nein. Nicht berechenbar.",
  "There is not yet enough price history for {asset} to size its moves, or no live market is publishing a mark. The odds need at least 12 hours of closes.":
    "Für {asset} gibt es noch nicht genug Preishistorie, um seine Bewegungen zu bemessen, oder kein aktiver Markt veröffentlicht einen Mark-Preis. Die Chancen brauchen mindestens 12 Stunden Schlusskurse.",
  "These are the odds that <b>{asset}</b> reaches a price within each horizon, worked out from how far it has actually been moving: about {hourly} an hour over the last {hours} hours. They are not a forecast of direction.":
    "Das sind die Chancen, dass <b>{asset}</b> innerhalb jedes Horizonts einen Preis erreicht, berechnet daraus, wie weit es sich tatsächlich bewegt hat: etwa {hourly} pro Stunde in den letzten {hours} Stunden. Sie sind keine Prognose der Richtung.",
  "The levels are where the most dollars were force-closed in the last {window}. Those positions are gone, so a heavy level is somewhere price has been, not fuel waiting for it. The collector does not keep open positions by price, so the resting map a liquidation magnet needs cannot be built yet.":
    "Die Niveaus sind dort, wo in den letzten {window} die meisten Dollar liquidiert wurden. Diese Positionen sind weg, daher ist ein schweres Niveau ein Ort, an dem der Preis schon war, kein Treibstoff, der auf ihn wartet. Der Collector speichert keine offenen Positionen nach Preis, daher lässt sich die Karte ruhender Positionen, die ein Liquidationsmagnet braucht, noch nicht bauen.",
  "Real prices have fatter tails than this model assumes, so the far levels are reached more often than shown. Volatility is measured over the recent past and held constant.":
    "Echte Preise haben dickere Ränder, als dieses Modell annimmt, daher werden ferne Niveaus öfter erreicht als gezeigt. Die Volatilität wird über die jüngste Vergangenheit gemessen und konstant gehalten.",
  "Odds of reaching a level, from {asset}'s own volatility. They say how far it can go, not which way. The chance of closing higher stays at 50% until a theory below passes a test set in advance, after costs.":
    "Chancen, ein Niveau zu erreichen, aus der eigenen Volatilität von {asset}. Sie sagen, wie weit es gehen kann, nicht in welche Richtung. Die Chance, höher zu schließen, bleibt bei 50%, bis eine Theorie unten einen vorab festgelegten Test nach Kosten besteht.",
  "Levels closer than the 4-hour typical move ({pct}) are left out, because price is already standing in them.":
    "Niveaus näher als die typische 4-Stunden-Bewegung ({pct}) sind ausgelassen, weil der Preis schon in ihnen steht.",
  "No forced-close level lies beyond the 4-hour typical move":
    "Kein Liquidationsniveau liegt jenseits der typischen 4-Stunden-Bewegung",
  "What the liquidation theories read now": "Was die Liquidationstheorien jetzt anzeigen",
  "A reading that leans one way is a hypothesis, not a signal: none of these has been shown to beat the base rate. The first three are measured against a fade, the way their test was written down in advance, and a flat reading leans nowhere.":
    "Ein Wert mit Tendenz ist eine Hypothese, kein Signal: Keine davon hat nachweislich die Basisrate geschlagen. Die ersten drei werden gegen ein Auslaufen gemessen, so wie ihr Test vorab festgelegt wurde, und ein seitwärts gerichteter Wert hat keine Tendenz.",
  // web/liquidations.ts: the whale map tab.
  "Nothing has been force-closed in this window, so there is no asset to map.":
    "In diesem Zeitraum wurde nichts liquidiert, daher gibt es kein Asset für die Karte.",
  "Position size": "Positionsgröße",
  "Price range": "Preisspanne",
  "Whale map": "Wal-Karte",
  "{asset} whale map": "{asset} Wal-Karte",
  Whales: "Wale",

  // web/whale-map.ts
  "mark {price}": "Mark {price}",
  "{n} positions of {floor} or more · {longs} of longs, {shorts} of shorts · hover or tap a bar to read it":
    "Positionen ab {floor}: {n} · {longs} Longs, {shorts} Shorts · Balken antippen oder mit der Maus darauf zeigen",
  "Beyond ±{pct} of the mark, off the chart: {longs} of longs and {shorts} of shorts.":
    "Jenseits von ±{pct} des Mark-Preises, außerhalb des Charts: {longs} Longs und {shorts} Shorts.",
  "{asset} · whale positions by liquidation price · {venues}":
    "{asset} · Wal-Positionen nach Liquidationspreis · {venues}",
  "Longs liquidate": "Longs liquidiert",
  "Shorts liquidate": "Shorts liquidiert",
  "Total to the mark": "Summe bis zum Mark-Preis",
  "{asset} price bands; arrow keys read one at a time":
    "{asset}-Preisbänder; Pfeiltasten lesen eines nach dem anderen",
  "{asset} whale positions by the price they liquidate at":
    "{asset}-Wal-Positionen nach dem Preis, zu dem sie liquidiert werden",
  "Every position here is one an exchange publishes for a named account: reported, not modeled. Only Hyperliquid, Lighter and dYdX publish every account's positions, and together they hold about a tenth of the open interest; Binance, OKX and the other centralized exchanges publish none, so they are not in this map.":
    "Jede Position hier ist eine, die eine Börse für ein benanntes Konto veröffentlicht: gemeldet, nicht modelliert. Nur Hyperliquid, Lighter und dYdX veröffentlichen die Positionen aller Konten, und zusammen halten sie etwa ein Zehntel des Open Interest; Binance, OKX und die anderen zentralen Börsen veröffentlichen keine, daher fehlen sie in dieser Karte.",
  "Hyperliquid and Lighter report each position's liquidation price. dYdX does not, so its are computed from the account's own balance and positions with dYdX's maintenance margins, holding its other prices where they are; they are marked * in the table.":
    "Hyperliquid und Lighter melden den Liquidationspreis jeder Position. dYdX nicht, daher werden seine aus Guthaben und Positionen des Kontos mit den Maintenance-Margins von dYdX berechnet, wobei die übrigen Preise bleiben, wo sie sind; sie sind in der Tabelle mit * markiert.",
  "On Hyperliquid the collector watches the leaderboard's accounts worth $100k or more and any account it sees in a large trade, re-reading each every few minutes while it holds $1M or more and hourly while it holds $100k. On Lighter it follows the leaderboard's owners with $100k in the account or a $100k position, whose changes arrive as they happen. On dYdX it reads every account on the chain every five minutes. So the map covers the largest traders, not every account.":
    "Auf Hyperliquid beobachtet der Collector die Konten der Rangliste mit $100k oder mehr und jedes Konto, das er bei einem großen Trade sieht, und liest jedes alle paar Minuten neu, solange es $1M oder mehr hält, und stündlich, solange es $100k hält. Auf Lighter folgt er den Inhabern der Rangliste mit $100k im Konto oder einer $100k-Position, deren Änderungen sofort eintreffen. Auf dYdX liest er alle fünf Minuten jedes Konto der Chain. Die Karte deckt also die größten Trader ab, nicht jedes Konto.",
  "A cross-margin position's liquidation price moves with the rest of its account: its other positions' profit and loss, deposits and withdrawals. Each one is as of its account's last read, shown in the table. Bars are the money that liquidates in each price band, longs below the mark and shorts above; the lines add up everything between the mark and that price.":
    "Der Liquidationspreis einer Cross-Margin-Position bewegt sich mit dem Rest ihres Kontos: Gewinn und Verlust der anderen Positionen, Einzahlungen und Auszahlungen. Jede gilt mit Stand des letzten Lesens ihres Kontos, gezeigt in der Tabelle. Die Balken sind das Geld, das in jedem Preisband liquidiert wird, Longs unter dem Mark-Preis und Shorts darüber; die Linien summieren alles zwischen dem Mark-Preis und diesem Preis.",
  "The whale positions could not be read right now.":
    "Die Wal-Positionen konnten gerade nicht gelesen werden.",
  "No position of {floor} or more in {asset} among the accounts watched.":
    "Keine Position ab {floor} in {asset} unter den beobachteten Konten.",
  "There are {n} of $100k or more: switch to $100k+.": "Es gibt {n} ab $100k: wechsle zu $100k+.",
  "nearest at {price} ({pct})": "nächste bei {price} ({pct})",
  "none with a liquidation price": "keine mit Liquidationspreis",
  "Whale longs": "Wal-Longs",
  "{n} positions": "Positionen: {n}",
  "Whale shorts": "Wal-Shorts",
  "Within 5% of the mark": "Innerhalb 5% vom Mark-Preis",
  "longs below / shorts above": "Longs darunter / Shorts darüber",
  Accounts: "Konten",
  "read a median {age}": "gelesen im Median {age}",
  "No live mark for {asset}, so the positions cannot be placed on a price axis.":
    "Kein aktiver Mark-Preis für {asset}, daher lassen sich die Positionen nicht auf einer Preisachse einordnen.",
  long: "Long",
  short: "Short",
  "No liquidation price: the account's margin covers any move":
    "Kein Liquidationspreis: Die Margin des Kontos deckt jede Bewegung",
  "dYdX publishes no liquidation price: computed from the account's balance and positions with dYdX's maintenance margins":
    "dYdX veröffentlicht keinen Liquidationspreis: berechnet aus Guthaben und Positionen des Kontos mit den Maintenance-Margins von dYdX",
  "By venue:": "Nach Börse:",
  none: "keine",
  "{leverage}× isolated": "{leverage}× isoliert",
  // Cross margin, not the chart cursor's crosshair (charts.ts's "cross").
  "{leverage}× cross": "{leverage}× Cross",
  "The {n} nearest to liquidation of {total}.": "Die {n} nächsten zur Liquidation von {total}.",
  "Positions by distance to liquidation": "Positionen nach Abstand zur Liquidation",
  Trader: "Trader",
  Value: "Wert",
  Entry: "Einstieg",
  "Liquidates at": "Liquidiert bei",
  "From the market's mark to the liquidation price":
    "Vom Mark-Preis des Markts bis zum Liquidationspreis",
  Leverage: "Hebel",
  Unrealized: "Unrealisiert",
  "The whole account's value on its venue": "Der Wert des ganzen Kontos auf seiner Börse",
  Account: "Konto",
  Read: "Gelesen",
  // Before a link to the member login, inside the sentence below.
  "Log in": "Anmelden",
  "Refreshes every 30 s. {login} to refresh every 10 s, with the nearest accounts re-read about every minute.":
    "Aktualisiert alle 30 s. {login}, um alle 10 s zu aktualisieren, wobei die nächsten Konten etwa jede Minute neu gelesen werden.",
  "Live for members: refreshes every 10 s, and the nearest accounts are re-read about every minute.":
    "Live für Mitglieder: aktualisiert alle 10 s, und die nächsten Konten werden etwa jede Minute neu gelesen.",
  Indexes: "Indizes",
  "Other stocks": "Andere Aktien",
  "Energy and other commodities": "Energie und andere Rohstoffe",
  FX: "Devisen",
  "{long} long · {short} short": "{long} Long · {short} Short",
  "Pick an asset": "Asset wählen",
  "Filter assets": "Assets filtern",
  Liquidated: "Liquidiert",
  "Longs / shorts": "Longs / Shorts",
  Events: "Ereignisse",
  "{asset} liquidations": "{asset}-Liquidationen",
  "{asset} liquidations across exchanges: longs against shorts by the hour, the price levels positions were closed at, and where large open positions would be liquidated.":
    "{asset}-Liquidationen über alle Börsen: Longs gegen Shorts pro Stunde, die Preisniveaus, auf denen Positionen geschlossen wurden, und wo große offene Positionen liquidiert würden.",
  "All assets": "Alle Assets",
  "{n} exchange": "{n} Börse",
  "{n} asset": "{n} Asset",
  "In the last 7 days": "In den letzten 7 Tagen",
  "In the last 48 hours": "In den letzten 48 Stunden",
  "In the last 24 hours": "In den letzten 24 Stunden",
  "{share} of it longs": "davon {share} Longs",
  "{share} of it shorts": "davon {share} Shorts",
  "{window}, no {asset} position was force-closed on the exchanges whose liquidation feeds the collector reads.":
    "{window} wurde auf den Börsen, deren Liquidations-Feeds der Collector liest, keine {asset}-Position zwangsgeschlossen.",
  "{window}, {total} of {asset} positions were force-closed in {events} on {venues}, {sides}.":
    "{window} wurden {total} an {asset}-Positionen in {events} auf {venues} zwangsgeschlossen, {sides}.",
  "The largest single one was a {usd} long on {venue} at {price}, {ago}.":
    "Die größte einzelne war ein {usd}-Long auf {venue} bei {price}, {ago}.",
  "The largest single one was a {usd} short on {venue} at {price}, {ago}.":
    "Die größte einzelne war ein {usd}-Short auf {venue} bei {price}, {ago}.",
  "Of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX, {longs} of longs would be liquidated within 5% below the price and {shorts} of shorts within 5% above.":
    "Von den beobachteten Wal-Positionen ab $1M auf Hyperliquid, Lighter und dYdX würden {longs} Longs innerhalb von 5% unter dem Preis liquidiert und {shorts} Shorts innerhalb von 5% darüber.",
  "{window}, {total} of positions were force-closed across {assets} on {venues}, {sides}.":
    "{window} wurden {total} an Positionen über {assets} auf {venues} zwangsgeschlossen, {sides}.",
  "The most liquidated: {list}.": "Am meisten liquidiert: {list}.",
  "The largest single liquidation was a {usd} {asset} long on {venue} at {price} ({when} UTC).":
    "Die größte einzelne Liquidation war ein {usd}-{asset}-Long auf {venue} bei {price} ({when} UTC).",
  "The largest single liquidation was a {usd} {asset} short on {venue} at {price} ({when} UTC).":
    "Die größte einzelne Liquidation war ein {usd}-{asset}-Short auf {venue} bei {price} ({when} UTC).",
  Order: "Sortierung",
  "Largest first": "Größte zuerst",
  "Newest first": "Neueste zuerst",
  "Smallest close": "Kleinste Liquidation",
  "The largest liquidations could not be read right now.":
    "Die größten Liquidationen konnten gerade nicht gelesen werden.",
  "No single liquidation of {floor} or more in this window.":
    "Keine einzelne Liquidation ab {floor} in diesem Zeitraum.",
  "Nothing has been force-closed in this window.": "In diesem Zeitraum wurde nichts liquidiert.",
  "The {n} newest liquidations of {floor} or more in this window.":
    "Die {n} neuesten Liquidationen ab {floor} in diesem Zeitraum.",
  "Every liquidation of {floor} or more in this window.":
    "Jede Liquidation ab {floor} in diesem Zeitraum.",
  "The {n} largest single liquidations in this window.":
    "Die {n} größten einzelnen Liquidationen in diesem Zeitraum.",
  "Every liquidation in this window, largest first.":
    "Jede Liquidation in diesem Zeitraum, die größte zuerst.",
  "The position's value at the fill price": "Der Wert der Position zum Ausführungspreis",
  "Each row is one forced close as its exchange reported it: the side is the position that was closed, the size its value at the fill price. Times are in {zone}.":
    "Jede Zeile ist eine Liquidation, wie ihre Börse sie gemeldet hat: Die Seite ist die liquidierte Position, die Größe ihr Wert zum Ausführungspreis. Zeiten in {zone}.",
  "{asset} largest liquidations": "Größte {asset}-Liquidationen",
  "Largest liquidations": "Größte Liquidationen",
  Largest: "Größte",
  "None of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX would be liquidated within 5% of the price.":
    "Keine der beobachteten Wal-Positionen ab $1M auf Hyperliquid, Lighter und dYdX würde innerhalb von 5% des Preises liquidiert.",
  later: "später",
  "A cascade is a burst in which one asset's liquidations piled up within minutes: consecutive minutes each running at {pace} times its 7-day average pace or more, with no more than {gap} quiet minutes between them, and at least an hour's worth of that average pace, and {floor}, in all. Every exchange whose liquidation feed the collector reads is counted; the venue choices on the other tabs do not narrow it.":
    "Eine Kaskade ist ein Schub, in dem sich die Liquidationen eines Assets binnen Minuten häuften: aufeinanderfolgende Minuten, jede mit dem {pace}-fachen des durchschnittlichen 7-Tage-Tempos oder mehr, mit höchstens {gap} ruhigen Minuten dazwischen, und insgesamt mindestens eine Stunde dieses Durchschnittstempos sowie {floor}. Jede Börse, deren Liquidations-Feed der Collector liest, zählt mit; die Börsenauswahl in den anderen Tabs schränkt das nicht ein.",
  "Prices are the asset's busiest market in 5-minute candles. Into it is the move from the last close before the cascade to the furthest the price went inside it: the low when mostly longs were closed, the high when mostly shorts were. 1h and 4h after run from the close at its end to the close an hour and four hours later, and say later until that candle has closed.":
    "Die Preise stammen vom meistgehandelten Markt des Assets in 5-Minuten-Kerzen. „Während“ ist die Bewegung vom letzten Schlusskurs vor der Kaskade bis zum weitesten Punkt, den der Preis darin erreichte: das Tief, wenn überwiegend Longs liquidiert wurden, das Hoch, wenn überwiegend Shorts. „1h danach“ und „4h danach“ laufen vom Schlusskurs an ihrem Ende bis zum Schlusskurs eine bzw. vier Stunden später und zeigen „später“, bis diese Kerze geschlossen ist.",
  "The cascades could not be read right now.": "Die Kaskaden konnten gerade nicht gelesen werden.",
  "No cascade in {asset} in this window: no burst reached {pace} times its usual pace with an hour's worth of it. Its usual pace is {usd} a minute, the 7-day average.":
    "Keine Kaskade in {asset} in diesem Zeitraum: Kein Schub erreichte das {pace}-fache des üblichen Tempos über eine Stunde davon. Das übliche Tempo ist {usd} pro Minute, der 7-Tage-Durchschnitt.",
  "none in this window": "keine in diesem Zeitraum",
  "none an hour old yet": "noch keine eine Stunde alt",
  "higher in {up} of {n}": "höher in {up} von {n}",
  Cascades: "Kaskaden",
  "{usd} longs": "{usd} Longs",
  "{usd} shorts": "{usd} Shorts",
  "An hour after long cascades": "Eine Stunde nach Long-Kaskaden",
  "An hour after short cascades": "Eine Stunde nach Short-Kaskaden",
  "Usual pace": "Übliches Tempo",
  "a minute, the 7-day average": "pro Minute, 7-Tage-Durchschnitt",
  "{n} min": "{n} min",
  "longs {share}": "Longs {share}",
  "shorts {share}": "Shorts {share}",
  "Prices: {market} on {venue}, in 5-minute candles.":
    "Preise: {market} auf {venue}, in 5-Minuten-Kerzen.",
  "No price history for {asset}, so the moves are blank.":
    "Keine Preishistorie für {asset}, daher bleiben die Bewegungen leer.",
  Start: "Beginn",
  Length: "Dauer",
  "Exchanges with a liquidation in it": "Börsen mit einer Liquidation darin",
  "The last close before the cascade began": "Der letzte Schlusskurs vor Beginn der Kaskade",
  "Price before": "Preis davor",
  "From the price before to the furthest it went inside the cascade":
    "Vom Preis davor bis zum weitesten Punkt innerhalb der Kaskade",
  "Into it": "Während",
  "From the close at its end to the close an hour later":
    "Vom Schlusskurs an ihrem Ende bis zum Schlusskurs eine Stunde später",
  "1h after": "1h danach",
  "From the close at its end to the close four hours later":
    "Vom Schlusskurs an ihrem Ende bis zum Schlusskurs vier Stunden später",
  "4h after": "4h danach",
  "Newest first.": "Neueste zuerst.",
  "Times are in {zone}.": "Zeiten in {zone}.",
  "Nothing has been force-closed in this window, so there is no asset to read.":
    "In diesem Zeitraum wurde nichts liquidiert, daher gibt es kein Asset zum Auswerten.",
  "{asset} cascades": "{asset}-Kaskaden",
  "{asset} longs vs shorts by day · UTC days": "{asset} Longs vs. Shorts pro Tag · UTC-Tage",
  "30- and 90-day history": "30- und 90-Tage-Historie",
  "{asset} over 30 and 90 days": "{asset} über 30 und 90 Tage",
  "Every day's longs and shorts liquidated over the last 30 or 90 days, each day as a share of the open interest on the same exchanges, and the heaviest days ranked.":
    "Die liquidierten Longs und Shorts jedes Tages der letzten 30 oder 90 Tage, jeder Tag als Anteil am Open Interest auf denselben Börsen, und die stärksten Tage gereiht.",
  "Liquidations against open interest": "Liquidationen im Verhältnis zum Open Interest",
  "Which markets were really flushed rather than just big: every asset's liquidations in the window as a share of its open interest, and the same for crypto, stocks, commodities and indices.":
    "Welche Märkte wirklich ausgespült wurden und nicht nur groß sind: die Liquidationen jedes Assets im Zeitraum als Anteil an seinem Open Interest, und dasselbe für Krypto, Aktien, Rohstoffe und Indizes.",
  "For members": "Für Mitglieder",
  "Create a free account": "Kostenloses Konto erstellen",
  "Loading the member view…": "Mitgliederansicht lädt…",
  "The history could not be read right now.": "Die Historie konnte gerade nicht gelesen werden.",
  "Nothing was force-closed in {asset} over this span.":
    "In {asset} wurde in dieser Spanne nichts liquidiert.",
  "Liquidated over {span} days": "Liquidiert über {span} Tage",
  "A typical day": "Ein typischer Tag",
  "of open interest, on average": "des Open Interest, im Schnitt",
  "The heaviest day": "Der stärkste Tag",
  "Days with data": "Tage mit Daten",
  "from {date}": "ab {date}",
  "The heaviest days, as a share of open interest":
    "Die stärksten Tage, als Anteil am Open Interest",
  "Day (UTC)": "Tag (UTC)",
  "Exchanges that reported a liquidation that day":
    "Börsen, die an dem Tag eine Liquidation meldeten",
  "Open interest is the day's average on the exchanges whose liquidation feeds reported {asset}, so the share compares like with like.":
    "Das Open Interest ist der Tagesdurchschnitt auf den Börsen, deren Liquidations-Feeds {asset} meldeten, damit der Anteil Gleiches mit Gleichem vergleicht.",
  "Liquidation feeds were added over time: from {least} to {most} exchanges a day here, so early days undercount.":
    "Liquidations-Feeds kamen nach und nach dazu: hier {least} bis {most} Börsen pro Tag, daher sind frühe Tage untererfasst.",
  Commodities: "Rohstoffe",
  Indices: "Indizes",
  "The open interest could not be read right now.":
    "Das Open Interest konnte gerade nicht gelesen werden.",
  "{liq} of {oi} open": "{liq} von {oi} offen",
  "The markets most flushed for their size":
    "Die Märkte, die für ihre Größe am stärksten ausgespült wurden",
  "No market with $1M of open interest had a liquidation in this window.":
    "Kein Markt mit $1M Open Interest hatte in diesem Zeitraum eine Liquidation.",
  Class: "Klasse",
  "Liquidations over the last {window} against the open interest now, both on the {feeds} exchanges whose liquidation feeds reported closes in that window. Markets under $1M of open interest are left out of the ranking.":
    "Liquidationen der letzten {window} im Verhältnis zum aktuellen Open Interest, beides auf den {feeds} Börsen, deren Liquidations-Feeds in diesem Zeitraum Liquidationen meldeten. Märkte unter $1M Open Interest fehlen im Ranking.",
  Span: "Spanne",
  History: "Historie",
  "{asset} history": "{asset}-Historie",
  "Liquidations vs open interest": "Liquidationen vs. Open Interest",
  "vs OI": "vs. OI",
  "Every cascade, in every asset": "Jede Kaskade, in jedem Asset",
  "Every liquidation cascade in every asset, found each minute as it happens, with the price an hour and four hours after. Members can also have them sent to Telegram the moment they start.":
    "Jede Liquidationskaskade in jedem Asset, jede Minute gefunden, während sie passiert, mit dem Preis eine und vier Stunden danach. Mitglieder können sie sich auch auf Telegram schicken lassen, sobald sie beginnen.",
  "No cascade in any asset in the last {window}.":
    "Keine Kaskade in irgendeinem Asset in den letzten {window}.",
  "in {n} assets": "in {n} Assets",
  "Longs and shorts": "Longs und Shorts",
  "{longs} long cascades, {shorts} short": "{longs} Long-Kaskaden, {shorts} Short",
  "The deepest market's mark when the watch first saw it, a minute or two in":
    "Der Mark-Preis des tiefsten Markts, als die Überwachung sie zuerst sah, ein bis zwei Minuten nach Beginn",
  "Price when seen": "Preis bei Erkennung",
  "From the price when seen to the mark an hour after the cascade ended":
    "Vom Preis bei Erkennung bis zum Mark-Preis eine Stunde nach Ende der Kaskade",
  "From the price when seen to the mark four hours after the cascade ended":
    "Vom Preis bei Erkennung bis zum Mark-Preis vier Stunden nach Ende der Kaskade",
  "Every asset, found each minute as it happens, by the rule of each asset's Cascades tab. Prices are the asset's deepest market's mark when the watch saw it and an hour and four hours after it ended. Members can have them sent to Telegram from {alerts}.":
    "Jedes Asset, jede Minute gefunden, während es passiert, nach der Regel im Kaskaden-Tab jedes Assets. Die Preise sind der Mark-Preis des tiefsten Markts des Assets, als die Überwachung sie sah, sowie eine und vier Stunden nach ihrem Ende. Mitglieder können sie sich über {alerts} auf Telegram schicken lassen.",
  "the alerts page": "die Alerts-Seite",
  "All cascades": "Alle Kaskaden",
  // The member Top traders tab (web/trader.ts), 2026-11-15.
  "24h": "24h",
  "30d": "30d",
  "All time": "Gesamt",
  "over the last day": "über den letzten Tag",
  "over the last week": "über die letzte Woche",
  "over the last month": "über den letzten Monat",
  "over all time": "über die gesamte Zeit",
  "Long {coin}": "Long {coin}",
  "Short {coin}": "Short {coin}",
  "Rank by profit over": "Rang nach Gewinn über",
  "Hyperliquid's leaderboard could not be read right now. Try again in a minute.":
    "Die Rangliste von Hyperliquid konnte gerade nicht gelesen werden. Versuch es in einer Minute erneut.",
  "+{n} more": "+{n} weitere",
  "nothing over $100k": "nichts über $100k",
  Profit: "Gewinn",
  "Profit over the account's value, as Hyperliquid's leaderboard computes it":
    "Gewinn im Verhältnis zum Kontowert, wie die Rangliste von Hyperliquid ihn berechnet",
  Return: "Rendite",
  "Account value": "Kontowert",
  "Holding now": "Hält jetzt",
  "Hyperliquid's own leaderboard, every one of its {ranked} accounts ranked by profit {window}, read {ago}. Hyperliquid is the large perp exchange where every account is public, so any of them opens on its positions, fills and orders. Holdings are the whale tracker's: positions of $100k and up, read within three hours.":
    "Die eigene Rangliste von Hyperliquid, alle {ranked} Konten nach Gewinn {window} gereiht, gelesen {ago}. Hyperliquid ist die große Perp-Börse, auf der jedes Konto öffentlich ist, daher öffnet jedes davon mit seinen Positionen, Ausführungen und Orders. Die Bestände stammen vom Wal-Tracker: Positionen ab $100k, in den letzten drei Stunden gelesen.",
  "Too little history in this window to draw.":
    "Zu wenig Historie in diesem Zeitraum zum Zeichnen.",
  "Open long": "Long eröffnen",
  "Close long": "Long schließen",
  "Open short": "Short eröffnen",
  "Close short": "Short schließen",
  "Long to short": "Long zu Short",
  "Short to long": "Short zu Long",
  Buy: "Kauf",
  Sell: "Verkauf",
  Limit: "Limit",
  "Stop market": "Stop-Market",
  "Stop limit": "Stop-Limit",
  "Take profit market": "Take-Profit-Market",
  "Take profit limit": "Take-Profit-Limit",
  "reduce only": "nur reduzieren",
  "position TP/SL": "Positions-TP/SL",
  Filled: "Ausgeführt",
  Canceled: "Storniert",
  Triggered: "Ausgelöst",
  Rejected: "Abgelehnt",
  "Canceled: margin": "Storniert: Margin",
  "All top traders": "Alle Top-Trader",
  "#{place} on Hyperliquid's leaderboard by profit {window}.":
    "#{place} in der Rangliste von Hyperliquid nach Gewinn {window}.",
  "Hyperliquid is answering too many requests right now. Try again in a minute.":
    "Hyperliquid beantwortet gerade zu viele Anfragen. Versuch es in einer Minute erneut.",
  "Hyperliquid did not answer for this account right now. Try again in a minute.":
    "Hyperliquid hat für dieses Konto gerade nicht geantwortet. Versuch es in einer Minute erneut.",
  "{usd} free to withdraw": "{usd} frei auszahlbar",
  "Profit {window}": "Gewinn {window}",
  "{usd} traded": "{usd} gehandelt",
  "Open positions": "Offene Positionen",
  "{lev}x the account's value": "{lev}x des Kontowerts",
  "on the open positions": "auf die offenen Positionen",
  "Profit chart window": "Zeitraum des Gewinn-Charts",
  "Profit and loss {window}": "Gewinn und Verlust {window}",
  "The profit history could not be read right now.":
    "Die Gewinnhistorie konnte gerade nicht gelesen werden.",
  "No open positions.": "Keine offenen Positionen.",
  Coin: "Coin",
  "Unrealized profit over the margin the position holds":
    "Unrealisierter Gewinn im Verhältnis zur Margin der Position",
  ROE: "ROE",
  "Liq. price": "Liq.-Preis",
  "Funding the position has paid since it opened; a minus is funding received":
    "Funding, das die Position seit Eröffnung gezahlt hat; ein Minus ist erhaltenes Funding",
  isolated: "isoliert",
  "The positions could not be read right now.":
    "Die Positionen konnten gerade nicht gelesen werden.",
  "Resting orders": "Offene Orders",
  Placed: "Platziert",
  Trigger: "Trigger",
  "The fills could not be read right now.": "Die Ausführungen konnten gerade nicht gelesen werden.",
  "No fills on record.": "Keine Ausführungen verzeichnet.",
  "This account was liquidated in this fill": "Dieses Konto wurde bei dieser Ausführung liquidiert",
  liquidated: "liquidiert",
  "Results by coin": "Ergebnisse nach Coin",
  "Orders that filled": "Ausgeführte Orders",
  Trades: "Trades",
  "Profit realized by closing, before fees": "Durch Schließen realisierter Gewinn, vor Gebühren",
  "Closed P&amp;L": "Realisierter P&amp;L",
  Fees: "Gebühren",
  Direction: "Richtung",
  "Size-weighted over the order's fills": "Größengewichtet über die Ausführungen der Order",
  Fee: "Gebühr",
  "Fills the order took": "Ausführungen der Order",
  "No trades in {coin} among these fills.": "Keine Trades in {coin} unter diesen Ausführungen.",
  "Hyperliquid answers an account's last {n} fills, here from {date}; results by coin are over those fills only. Each trade is one order's fills taken together.":
    "Hyperliquid liefert die letzten {n} Ausführungen eines Kontos, hier ab {date}; die Ergebnisse nach Coin gelten nur für diese Ausführungen. Jeder Trade ist die Gesamtheit der Ausführungen einer Order.",
  "The order history could not be read right now.":
    "Die Order-Historie konnte gerade nicht gelesen werden.",
  market: "Market",
  "No orders on record.": "Keine Orders verzeichnet.",
  "Hyperliquid answers an account's last {n} orders, each shown once at its latest status.":
    "Hyperliquid liefert die letzten {n} Orders eines Kontos, jede einmal mit ihrem neuesten Status gezeigt.",
  "Hyperliquid throttled part of this read; what is missing says so. Try again in a minute.":
    "Hyperliquid hat einen Teil dieser Abfrage gedrosselt; was fehlt, ist gekennzeichnet. Versuch es in einer Minute erneut.",
  Positions: "Positionen",
  "Order history": "Order-Historie",
  "Read from Hyperliquid {ago}.": "Von Hyperliquid gelesen {ago}.",
  "Top traders, and every order they place": "Top-Trader und jede Order, die sie platzieren",
  "Hyperliquid's biggest winners over a day, a week, a month or all time, with what they hold now. Open any of them for their positions and liquidation prices, profit over time, and their recent trades and orders, coin by coin.":
    "Die größten Gewinner von Hyperliquid über einen Tag, eine Woche, einen Monat oder die gesamte Zeit, mit dem, was sie jetzt halten. Öffne einen davon für Positionen und Liquidationspreise, Gewinn im Zeitverlauf und die letzten Trades und Orders, Coin für Coin.",
  "Top traders": "Top-Trader",
  Winners: "Gewinner",
};
