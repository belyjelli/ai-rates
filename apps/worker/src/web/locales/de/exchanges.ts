import type { Catalog } from "../../i18n";

/**
 * The Exchanges page (web/exchanges.ts) and one exchange's trading-cost section on its own page, in
 * German. Glossary and style: ./index.ts.
 *
 * Terms: grade Note (the letters S/A/B/C/D stay as written), score Punktzahl, execution Ausführung,
 * liquidity Liquidität, activity Aktivität, order book / book Orderbuch / Buch, mid Mittelkurs, market
 * order Market-Order, depth Markttiefe, credited angerechnet, basket Korb, majors Majors, snapshot
 * Abfrage, median Median, fill Ausführung, book reach Buchreichweite, taker fee Taker-Gebühr, bp bp,
 * reserves Reserven, wallets Wallets, own token eigener Token, clean (without the exchange's own
 * token) bereinigt, collateral Sicherheiten, pillar Säule, breadth Breite, points Punkte, n/a k. A.,
 * breakdown Aufschlüsselung, the leader der Spitzenreiter. Sizes ($10k, $100k) and bands (±0.1%, ±1%)
 * stay exactly as written; markouts, CEX, DEX and DefiLlama too.
 */
export const exchanges: Catalog = {
  // the grade badge and the table
  "Grade {grade}, score {score}: the breakdown":
    "Note {grade}, Punktzahl {score}: die Aufschlüsselung",
  "clean, of {total} in wallets": "bereinigt, von {total} in Wallets",
  collateral: "Sicherheiten",
  "fee {fee}{mark}": "Gebühr {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "$100k wurden auf {n} Büchern des Korbs meist nicht ausgeführt; jedes zählt als {bps} bp",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, 2% of the exchange's daily volume or 5% of its clean reserves is not counted":
    "Die Note rechnet davon {usd} an: Markttiefe über ein Zehntel des Open Interest eines Markts, 2% des Tagesvolumens der Börse oder 5% ihrer bereinigten Reserven hinaus zählt nicht",
  "{n} of {total} assets": "{n} von {total} Assets",
  "Not measured: its order book is not read yet":
    "Nicht gemessen: ihr Orderbuch wird noch nicht gelesen",

  // the grade's breakdown card
  Reserves: "Reserven",
  Execution: "Ausführung",
  Activity: "Aktivität",
  Liquidity: "Liquidität",
  "not measured": "nicht gemessen",
  "no wallets published": "keine Wallets veröffentlicht",
  "collateral not identified: the DEXes' median": "Sicherheiten nicht ermittelt: Median der DEXs",
  "{clean} clean of {total} in tracked wallets":
    "{clean} bereinigt von {total} in beobachteten Wallets",
  "{usd} protocol collateral": "{usd} Protokoll-Sicherheiten",
  "{cost} to trade $10k, {slip} slippage at $100k":
    "{cost} für $10k Handel, {slip} Slippage bei $100k",
  "{volume} volume; no open interest published":
    "{volume} Volumen; kein Open Interest veröffentlicht",
  "{oi} open interest, {volume} volume": "{oi} Open Interest, {volume} Volumen",
  "{usd} credited within 0.1%; {n} of {total} markets hold $100k":
    "{usd} innerhalb von 0.1% angerechnet; {n} von {total} Märkten halten $100k",
  "#{rank} of {of} CEXs": "#{rank} von {of} CEXs",
  "#{rank} of {of} DEXs": "#{rank} von {of} DEXs",
  "n/a": "k. A.",
  "Built from this site's own reading of the order books and DefiLlama's reserves. n/a never counts as zero; its weight goes to the others. S from 85, A 70, B 55, C 40, else D.":
    "Berechnet aus der eigenen Auswertung der Orderbücher durch diese Seite und den Reserven von DefiLlama. k. A. zählt nie als null; das Gewicht geht an die anderen. S ab 85, A 70, B 55, C 40, sonst D.",
  "How the grade is built": "So entsteht die Note",

  // the tiles
  "across {n} exchanges reporting now": "über {n} Börsen, die gerade melden",
  "as each exchange reports it": "wie jede Börse es meldet",
  "Cheapest $10k": "Günstigste $10k",
  "{venue}: taker fee and slippage, the basket's mix":
    "{venue}: Taker-Gebühr und Slippage, im Mix des Korbs",
  "no book measured yet": "noch kein Buch gemessen",
  "Deepest books": "Tiefste Bücher",
  "{venue}: credited within 0.1% of the mid, 12 majors":
    "{venue}: angerechnet innerhalb von 0.1% des Mittelkurses, 12 Majors",

  // column heads and their tooltips
  Grade: "Note",
  "This site's grade after DefiLlama's REAL score: reserves, execution, activity and liquidity. A grade opens its breakdown":
    "Die Note dieser Seite nach dem REAL-Score von DefiLlama: Reserven, Ausführung, Aktivität und Liquidität. Ein Klick auf eine Note öffnet die Aufschlüsselung",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain without its own token, a DEX's protocol collateral":
    "Was die Börse hält, laut DefiLlama: die on-chain beobachteten Wallets einer CEX ohne eigenen Token, die Protokoll-Sicherheiten einer DEX",
  "Cost to trade $10k": "Kosten für $10k",
  "A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid":
    "Eine Market-Order über $10k inklusive allem: die veröffentlichte Standard-Taker-Gebühr plus das, was das Buch über den Mittelkurs hinaus kostet",
  Slippage: "Slippage",
  "What a $10k and a $100k market order pay beyond the mid, from the book, before fees":
    "Was eine Market-Order über $10k und über $100k laut Buch über den Mittelkurs hinaus zahlt, vor Gebühren",
  "The gap between the best bid and ask, basis points of the mid":
    "Der Abstand zwischen bestem Geld- und Briefkurs, in Basispunkten des Mittelkurses",
  Depth: "Markttiefe",
  "Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them":
    "Dollar, die innerhalb von 0.1% und von 1% des Mittelkurses auf beiden Seiten liegen, über die Bücher des Korbs summiert, wie das öffentliche Buch jeder Börse sie zeigt",
  "Summed over the exchange's perpetual markets, as it reports them":
    "Summiert über die Perpetual-Märkte der Börse, wie sie sie meldet",
  "Live perpetual markets": "Aktive Perpetual-Märkte",

  // the help panel
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "Jede Perpetual-Börse, die diese Seite erfasst, sortiert nach den Kosten des Handels dort. Die Kosten stammen aus dem öffentlichen Orderbuch jeder Börse, alle zehn Minuten für zwölf Majors gelesen (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); jeder Wert ist der Median der letzten sieben Tage.",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "Die Kosten für $10k sind eine Market-Order über $10k inklusive allem: die veröffentlichte Standard-Taker-Gebühr der Börse (VIP-Stufen, Gebühren-Token und Rabatte senken sie) plus das, was das Buch über den Mittelkurs hinaus kostet, den halben Spread eingeschlossen. Slippage ist nur dieser zweite Teil, bei $10k und $100k. Jedes Asset zählt nach seinem Open Interest über alle Börsen, damit jede Börse mit demselben Mix bewertet wird.",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that.":
    "Markttiefe sind die Dollar, die innerhalb von 0.1% und von 1% des Mittelkurses liegen, wie das öffentliche Buch jeder Börse sie zeigt. Börsen veröffentlichen nur begrenzt viele Stufen (bei Binance reichen sie etwa 0.15% um BTC), daher ist der 1%-Wert eine Untergrenze und die Note nutzt den 0.1%-Wert, den jedes gemessene Buch erreicht. Eine einzelne Stufe über 5% des Open Interest des Markts zählt nur bis dahin.",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade follows DefiLlama's REAL score: reserves 30, execution 30, activity 20, liquidity 20. A grade opens its breakdown; how each pillar is built is under the table.":
    "Das sind Versprechen der Bücher, keine Ausführungen: Es wird kein Trade gemessen, daher fehlen Markouts (wohin der Preis nach einer Ausführung geht). Die Note folgt dem REAL-Score von DefiLlama: Reserven 30, Ausführung 30, Aktivität 20, Liquidität 20. Ein Klick auf eine Note öffnet die Aufschlüsselung; wie jede Säule entsteht, steht unter der Tabelle.",

  // how the grade is built
  "{n} points": "{n} Punkte",
  "After DefiLlama's REAL score: a weighted mean of four pillars, each 0 to 100. Sizes are on a log scale, so an exchange a tenth the size of the leader still scores about 70. A pillar this site cannot measure for an exchange hands its weight to the others and never counts as zero. CEXes and DEXes are scored together and ranked within their own kind. Fixed bands, so a new exchange does not reshuffle the rest: S from 85, A from 70, B from 55, C from 40, D below.":
    "Nach dem REAL-Score von DefiLlama: ein gewichteter Mittelwert aus vier Säulen, jede von 0 bis 100. Größen stehen auf einer logarithmischen Skala, daher kommt eine Börse mit einem Zehntel der Größe des Spitzenreiters noch auf etwa 70. Eine Säule, die diese Seite für eine Börse nicht messen kann, gibt ihr Gewicht an die anderen ab und zählt nie als null. CEXs und DEXs werden gemeinsam bewertet und innerhalb ihrer Art gereiht. Feste Stufen, damit eine neue Börse die anderen nicht durcheinanderbringt: S ab 85, A ab 70, B ab 55, C ab 40, darunter D.",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain, without its own token; a DEX's protocol collateral, a floor, since market makers' money can sit elsewhere. Two thirds is size against the largest; one third is whether its open interest, a day's volume and the book it shows within 1% are sizes it could back, and how much of it is its own token. A CEX publishing no wallets scores 0; a DEX whose collateral is not identified scores the DEXes' median.":
    "Was die Börse hält, laut DefiLlama: die on-chain beobachteten Wallets einer CEX ohne eigenen Token; die Protokoll-Sicherheiten einer DEX, eine Untergrenze, da das Geld der Market Maker woanders liegen kann. Zwei Drittel sind die Größe im Vergleich zur größten; ein Drittel ist, ob ihr Open Interest, ein Tagesvolumen und das Buch, das sie innerhalb von 1% zeigt, Größen sind, die sie decken könnte, und wie viel davon eigener Token ist. Eine CEX ohne veröffentlichte Wallets erhält 0; eine DEX mit nicht ermittelten Sicherheiten erhält den Median der DEXs.",
  "What a market order costs, from each exchange's book every ten minutes over seven days: $10k all in (the published standard taker fee and the walk through the book), and what $10k and $100k pay beyond the mid, each against the cheapest exchange. DefiLlama also scores markouts and fills against the quote; those need trades, which this site does not record, so their weight goes to cost and slippage.":
    "Was eine Market-Order kostet, aus dem Buch jeder Börse alle zehn Minuten über sieben Tage: $10k inklusive allem (die veröffentlichte Standard-Taker-Gebühr und der Weg durchs Buch) und was $10k und $100k über den Mittelkurs hinaus zahlen, jeweils im Vergleich zur günstigsten Börse. DefiLlama bewertet auch Markouts und Ausführungen gegenüber dem Kurs; dafür braucht es Trades, die diese Seite nicht aufzeichnet, daher geht ihr Gewicht an Kosten und Slippage.",
  "Open interest, credited up to three times clean reserves, and a day's volume, credited up to five times open interest, each against the leader. An exchange that publishes no open interest is scored on volume alone, credited up to three times clean reserves.":
    "Open Interest, angerechnet bis zum Dreifachen der bereinigten Reserven, und ein Tagesvolumen, angerechnet bis zum Fünffachen des Open Interest, jeweils im Vergleich zum Spitzenreiter. Eine Börse ohne veröffentlichtes Open Interest wird nur nach Volumen bewertet, angerechnet bis zum Dreifachen der bereinigten Reserven.",
  "Depth within 0.1% of the mid across the twelve majors, credited up to a tenth of each market's open interest, 2% of the exchange's daily volume and 5% of its clean reserves; and breadth, how many of the twelve hold $100k within 0.1%. Halved for a CEX publishing no reserves.":
    "Markttiefe innerhalb von 0.1% des Mittelkurses über die zwölf Majors, angerechnet bis zu einem Zehntel des Open Interest jedes Markts, 2% des Tagesvolumens der Börse und 5% ihrer bereinigten Reserven; dazu die Breite, wie viele der zwölf $100k innerhalb von 0.1% halten. Halbiert für eine CEX ohne veröffentlichte Reserven.",
  "These are this site's grades by DefiLlama's method, not DefiLlama's scores. What exchanges report about themselves counts only as far as it can be checked: open interest up to three times reserves, volume up to five times open interest. Reputation, age, brand and listings count not at all.":
    "Das sind Noten dieser Seite nach der Methode von DefiLlama, keine Scores von DefiLlama. Was Börsen über sich selbst melden, zählt nur so weit, wie es sich prüfen lässt: Open Interest bis zum Dreifachen der Reserven, Volumen bis zum Fünffachen des Open Interest. Ruf, Alter, Marke und Listings zählen gar nicht.",

  // the page description and notes
  "Every perpetual futures exchange tracked by airrates, graded on reserves, trading cost, activity and liquidity: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "Jede Börse für Perpetual Futures, die airrates beobachtet, benotet nach Reserven, Handelskosten, Aktivität und Liquidität: Taker-Gebühr und Slippage bei $10k und $100k, Markttiefe, Open Interest und Volumen.",
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "Orderbücher gemessen seit {date}; die Werte sind Mediane der letzten sieben Tage.",
  "Order books are not measured yet.": "Orderbücher werden noch nicht gemessen.",
  "Reserves: DefiLlama, read every six hours.": "Reserven: DefiLlama, alle sechs Stunden gelesen.",
  "Reserves are not available right now; the grade goes on without them.":
    "Reserven sind gerade nicht verfügbar; die Note wird ohne sie berechnet.",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* Keine veröffentlichte Taker-Gebühr gefunden für {venues}: Der Standardwert der Seite von {bps} bp wird verwendet.",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "Noch ohne Note: Börsen, deren Orderbuch nicht gelesen wird. Noch nicht erfasst: {venues}.",

  // one exchange's trading cost
  "not listed": "nicht gelistet",
  "$100k did not fill in most snapshots": "$100k wurden in den meisten Abfragen nicht ausgeführt",
  "did not fill": "nicht ausgeführt",
  "{pct}%": "{pct}%",
  "Trading cost": "Handelskosten",
  "{value} to trade $10k": "{value} für $10k Handel",
  "taker fee {fee}{mark}": "Taker-Gebühr {fee}{mark}",
  "{value} slippage at $100k": "{value} Slippage bei $100k",
  "{value} within 0.1%": "{value} innerhalb von 0.1%",
  "What a $10k market order pays beyond the mid, before fees":
    "Was eine Market-Order über $10k über den Mittelkurs hinaus zahlt, vor Gebühren",
  "$10k slippage": "Slippage $10k",
  "What a $100k market order pays beyond the mid, before fees":
    "Was eine Market-Order über $100k über den Mittelkurs hinaus zahlt, vor Gebühren",
  "$100k slippage": "Slippage $100k",
  "Depth ±0.1%": "Markttiefe ±0.1%",
  "Depth ±1%": "Markttiefe ±1%",
  "How far from the mid the published book reached":
    "Wie weit das veröffentlichte Buch vom Mittelkurs reichte",
  "Book reach": "Buchreichweite",
  "Snapshots in the last seven days": "Abfragen in den letzten sieben Tagen",
  Samples: "Stichproben",
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. Reserves are DefiLlama's.":
    "Mediane der letzten sieben Tage aus Abfragen des öffentlichen Orderbuchs von {venue}, alle zehn Minuten; die Kosten sind die des Buchs, keine Ausführungen. Die Reserven stammen von DefiLlama.",
  "Quarantined: left out of the default rankings. {evidence}":
    "In Quarantäne: aus den Standard-Rankings ausgeschlossen. {evidence}",
  Quarantined: "In Quarantäne",
  "Quarantined: {venues}. Their numbers failed the venue review's checks (funding copied from another exchange, or volume and open interest far beyond what their reserves could back), so they are still collected and shown here but left out of the default Screener and Arbitrage rankings; tick them in the exchange picker to rank them.":
    "In Quarantäne: {venues}. Ihre Zahlen haben die Prüfungen der Börsenbewertung nicht bestanden (Funding von einer anderen Börse kopiert oder Volumen und Open Interest weit über dem, was ihre Reserven decken könnten), daher werden sie weiter erfasst und hier gezeigt, aber aus den Standard-Rankings von Screener und Arbitrage ausgeschlossen; hake sie in der Börsenauswahl an, um sie einzureihen.",
};
