import type { Catalog } from "../../i18n";

/**
 * /whales (web/whales.ts), its route's 404 (app/app.ts) and its nav and hotkey label, in German.
 *
 * Terms: whale orders Wal-Orders, wall Wand (bid wall Kaufwand, ask wall Verkaufswand), resting im
 * Buch, filled ausgeführt, pulled zurückgezogen. A taker burst (the circles) is a Taker-Kauf /
 * Taker-Verkauf, as German-speaking traders say it.
 */
export const whales: Catalog = {
  "{asset} is not one of the markets tracked on {venue}.":
    "{asset} gehört nicht zu den Märkten, die auf {venue} beobachtet werden.",
  whales: "Wale",
  bid: "Kauf",
  ask: "Verkauf",
  resting: "im Buch",
  filled: "ausgeführt",
  pulled: "zurückgezogen",
  "lost track": "aus den Augen verloren",
  "{n}m": "{n} min",
  "{d}d {h}h": "{d} T {h} h",
  "{side} wall {price} · {size} · {status} · {lived}":
    "{side}-Wand {price} · {size} · {status} · {lived}",
  "{asset} · {venue} perp · {n}-hour candles, {zone}":
    "{asset} · {venue} Perp · {n}-Stunden-Kerzen, {zone}",
  "{asset} · {venue} perp · {n}-minute candles, {zone}":
    "{asset} · {venue} Perp · {n}-Minuten-Kerzen, {zone}",
  "bid wall (buy orders)": "Kaufwand (Kauforders)",
  "ask wall (sell orders)": "Verkaufswand (Verkaufsorders)",
  "faded: filled or pulled": "verblasst: ausgeführt oder zurückgezogen",
  "last price": "letzter Preis",
  Markets: "Märkte",
  "hide pulled walls": "zurückgezogene Wände ausblenden",
  "show pulled walls": "zurückgezogene Wände zeigen",
  "Bid walls resting": "Kaufwände im Buch",
  "{n} buy walls below the price": "Kaufwände unter dem Preis: {n}",
  "Ask walls resting": "Verkaufswände im Buch",
  "{n} sell walls above the price": "Verkaufswände über dem Preis: {n}",
  "Largest wall": "Größte Wand",
  "{side} at {price}": "{side} bei {price}",
  "none resting": "keine im Buch",
  "Pulled in {window}": "Zurückgezogen in {window}",
  "cancelled before the price reached them; {n} filled":
    "storniert, bevor der Preis sie erreichte; ausgeführt: {n}",
  "No candles for {asset} yet. The collector backfills three days within a minute of a market joining the set.":
    "Noch keine Kerzen für {asset}. Der Collector lädt drei Tage nach, binnen einer Minute, nachdem ein Markt dazukommt.",
  Side: "Seite",
  "From the last price": "Vom letzten Preis",
  Distance: "Abstand",
  Size: "Größe",
  "The most it has held": "Das Meiste, das sie je hielt",
  Peak: "Spitze",
  "Since the collector first saw it": "Seit der Collector sie zuerst sah",
  "Resting since": "Im Buch seit",
  "No wall is resting in {asset}'s book right now.":
    "Gerade liegt keine Wand im Orderbuch von {asset}.",
  Lived: "Dauer",
  Ended: "Endete",
  How: "Wie",
  "No wall ended in the last {window}.": "Keine Wand endete im Zeitraum {window}.",
  "Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.":
    "Große ruhende Limit-Orders im USD-M-Buch von Binance für {asset}: ein Preisniveau mit mindestens {floor} für mindestens eine Minute. Eine {bid} sind Kauforders unter dem Preis, eine {ask} Verkaufsorders darüber. Jede Linie reicht von dem Moment, in dem der Collector die Wand zuerst sah, bis zu ihrem Verschwinden, und ist umso dicker, je größer sie ist.",
  "bid wall": "Kaufwand",
  "ask wall": "Verkaufswand",
  "A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.":
    "Eine endende Wand gilt als ausgeführt, wenn der Preis sie erreichte, und als zurückgezogen, wenn sie vorher storniert wurde. Zurückgezogene Wände sind standardmäßig ausgeblendet: Die meisten sind Spoofing oder Quotes, die mit dem Preis wandern. Wände sind eine Momentaufnahme der sichtbaren Liquidität, weder Boden noch Decke und keine Prognose; jede kann verschwinden, sobald der Preis näher kommt.",
  "The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.":
    "Die vierzig Märkte sind die vierzig größten nach Open Interest, summiert über alle Börsen, die wir erfassen, gelesen auf Binance. Die Schwelle wächst mit diesem Open Interest. Nach jedem Neustart des Collectors lernt das Buch preisferne Niveaus neu, sobald sie sich ändern, daher können die ältesten fernen Wände ein bis zwei Stunden brauchen, bis sie wieder erscheinen.",
  "Whale orders": "Wal-Orders",
  "whale orders": "Wal-Orders",
  "Large resting limit orders and large market orders on Binance and Hyperliquid futures, drawn over the price: where the walls sit, how big, whether they were filled or pulled, and who hit them.":
    "Große ruhende Limit-Orders und große Market-Orders auf Binance- und Hyperliquid-Futures, über den Preis gezeichnet: wo die Wände liegen, wie groß sie sind, ob sie ausgeführt oder zurückgezogen wurden und wer sie traf.",
  "The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.":
    "Der Wal-Order-Feed hat seine Märkte noch nicht gereiht. Das passiert wenige Minuten nach dem Start.",
  "Resting now": "Jetzt im Buch",
  "Orders and trades": "Orders und Trades",
  "{n} resting": "im Buch: {n}",
  "Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.":
    "Jede Wand, die gerade im Buch liegt, die größte zuerst. Der Abstand gilt ab dem letzten Preis; Größe ist, was das Niveau jetzt hält, Spitze das Meiste, das es je hielt.",
  "Ended in the last {window}": "Beendet in {window}",
  "taker buy": "Taker-Kauf",
  "taker sell": "Taker-Verkauf",
  "one fill": "1 Ausführung",
  "{n} fills": "{n} Ausführungen",
  "{side} {size} at {price} · {fills} · {time}": "{side} {size} bei {price} · {fills} · {time}",
  "large taker buy": "großer Taker-Kauf",
  "large taker sell": "großer Taker-Verkauf",
  "Large buys in {window}": "Große Käufe in {window}",
  "Large sells in {window}": "Große Verkäufe in {window}",
  "{n} taker bursts of {floor} or more": "Taker-Schübe ab {floor}: {n}",
  "Aggregate trades in the burst: roughly the price levels it took":
    "Aggregierte Trades im Schub: etwa die Preisniveaus, die er abräumte",
  Fills: "Ausführungen",
  When: "Wann",
  "No taker burst of {floor} or more in the last {window}.":
    "Kein Taker-Schub ab {floor} im Zeitraum {window}.",
  "Largest trades in the last {window}": "Größte Trades in {window}",
  "taker {address}": "Taker {address}",
  "{size} in {n} orders, one at least {proven}": "{size} in {n} Orders, eine mindestens {proven}",
  "no walls": "keine Wände",
  "{bid} bid · {ask} ask": "{bid} Kauf · {ask} Verkauf",
  "Pick a market": "Markt wählen",
  "{n} markets": "{n} Märkte",
  "Filter markets": "Märkte filtern",
  "Walls resting, bid / ask": "Wände im Buch, Kauf / Verkauf",
  "Large taker buys minus sells, last 24 hours":
    "Große Taker-Käufe minus Verkäufe, letzte 24 Stunden",
  "Whale flow 24h": "Wal-Fluss 24h",
  "No market matches.": "Kein Markt passt.",
  "Orders in the bucket at the last look": "Orders in der Stufe beim letzten Blick",
  Orders: "Orders",
  "The bucket's average order: its largest holds at least this":
    "Die durchschnittliche Order der Stufe: die größte hält mindestens so viel",
  "Largest ≥": "Größte ≥",
  Taker: "Taker",
  "Proven whale orders in {venue}'s book for {asset}. {venue} publishes only its 20 nearest price buckets a side, here {step} wide, each with how many orders it holds. A wall is a bucket whose average order is at least {floor}, so at least one order in it is that big; a {bid} sits below the price, an {ask} above it. It stays a wall while the bucket still holds what that order was proven to. A whale order sharing a bucket with many small ones cannot be proven, and is not drawn.":
    "Nachgewiesene Wal-Orders im Buch von {venue} für {asset}. {venue} veröffentlicht nur die 20 nächsten Preisstufen je Seite, hier {step} breit, jede mit der Zahl ihrer Orders. Eine Wand ist eine Stufe, deren durchschnittliche Order mindestens {floor} beträgt, also ist mindestens eine Order darin so groß; eine {bid} liegt unter dem Preis, eine {ask} darüber. Sie bleibt eine Wand, solange die Stufe noch hält, was für diese Order nachgewiesen wurde. Eine Wal-Order, die sich eine Stufe mit vielen kleinen teilt, lässt sich nicht nachweisen und wird nicht gezeichnet.",
  "Each circle is one account's market order in one block, of at least the same {floor}; the table names the account. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the order. The chart draws the 200 largest in the window.":
    "Jeder Kreis ist die Market-Order eines Kontos in einem Block, von mindestens denselben {floor}; die Tabelle nennt das Konto. Blau ist ein kaufender Taker, Rot ein verkaufender; je größer der Kreis, desto größer die Order. Der Chart zeichnet die 200 größten im Zeitraum.",
  "The markets are the top forty by open interest summed across every exchange we collect, among those {venue} lists, its HIP-3 markets included (gold is xyz:GOLD). The floor scales with that open interest.":
    "Die Märkte sind die vierzig größten nach Open Interest, summiert über alle Börsen, die wir erfassen, unter denen, die {venue} listet, ihre HIP-3-Märkte eingeschlossen (Gold ist xyz:GOLD). Die Schwelle wächst mit diesem Open Interest.",
  "Each circle is a large market order: every fill on one side in the same millisecond, counted as one burst, of at least the same {floor}. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the burst. The chart draws the 200 largest in the window.":
    "Jeder Kreis ist eine große Market-Order: alle Ausführungen auf einer Seite in derselben Millisekunde, als ein Schub gezählt, von mindestens denselben {floor}. Blau ist ein kaufender Taker, Rot ein verkaufender; je größer der Kreis, desto größer der Schub. Der Chart zeichnet die 200 größten im Zeitraum.",
  "off the chart:": "außerhalb des Charts:",
  "last {price}": "zuletzt {price}",
  "hover or tap a candle to read it": "Kerze antippen oder mit der Maus darauf zeigen",
  "{asset} candles; arrow keys read one at a time":
    "{asset}-Kerzen; Pfeiltasten lesen eine nach der anderen",
  "{asset} volume per candle": "{asset}-Volumen pro Kerze",
  // web/whales.ts: the GEX switch over the chart
  off: "aus",
  "Hide the options book": "Optionsbuch ausblenden",
  "Each strike's call and put gamma, as bars at the right edge":
    "Call- und Put-Gamma jedes Strikes, als Balken am rechten Rand",
  "Strike {strike} · calls {calls} · puts {puts} · net {net} per 1% move":
    "Strike {strike} · Calls {calls} · Puts {puts} · netto {net} pro 1% Bewegung",
  "call wall {price}": "Call-Wand {price}",
  "put wall {price}": "Put-Wand {price}",
  "call gamma": "Call-Gamma",
  "put gamma": "Put-Gamma",
  "flip {flip} · call wall {call} · put wall {put}":
    "Flip {flip} · Call-Wand {call} · Put-Wand {put}",
  "{source} options, all expiries, {age}": "{source}-Optionen, alle Verfälle, {age}",
  "IV move": "IV-Bewegung",
  "The expected move a day ahead: one and two standard deviations either side of the price":
    "Die erwartete Bewegung für den nächsten Tag: eine und zwei Standardabweichungen beiderseits des Preises",
  "Whale orders: BTC order book walls and large trades":
    "Wal-Orders: BTC-Orderbuch-Wände und große Trades",
};
