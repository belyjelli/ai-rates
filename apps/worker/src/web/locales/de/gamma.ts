import type { Catalog } from "../../i18n";

/**
 * The Rates page's Gamma Exposure tab (web/gamma.ts), its chart readout (web/slot-chart.ts), the
 * IV Walls, Ceiling & Floor and Greek tabs and the page's two tab labels, in German.
 * Glossary and style: ./index.ts.
 *
 * Terms: gamma exposure Gamma-Exposure (GEX), option Option, call / put stay Call / Put, strike
 * Strike, expiry Verfall, spot Spot, dealer Dealer, flip Flip, gamma flip Gamma-Flip, call wall /
 * put wall Call-Wand / Put-Wand, hedging Absicherung (Hedge), implied volatility implizite
 * Volatilität (IV), max pain Max Pain, premium Prämie, ceiling / floor Decke / Boden. Delta, Vega,
 * Theta and Gamma keep their names, and Black-76 stays as written.
 */
export const gamma: Catalog = {
  "Funding rates": "Funding-Raten",
  Funding: "Funding",
  "Gamma Exposure": "Gamma-Exposure",
  Gamma: "Gamma",
  "Next: {date}": "Nächster: {date}",
  "Next expiry": "Nächster Verfall",
  "7 days": "7 Tage",
  "30 days": "30 Tage",
  "All expiries": "Alle Verfälle",
  "Option book": "Optionsbuch",
  Expiries: "Verfälle",
  "spot {price}": "Spot {price}",
  "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it":
    "netto {net} pro 1% Bewegung bei Spot {spot} · {bars} · Strike antippen oder darauf zeigen",
  "bars are each strike's calls and puts": "Balken sind Calls und Puts je Strike",
  "bars are each strike's calls and puts added": "Balken sind Calls und Puts je Strike, addiert",
  "Net long": "Netto long",
  "Net short": "Netto short",
  "short gamma": "Short Gamma",
  "long gamma": "Long Gamma",
  View: "Ansicht",
  view: "Ansicht",
  "calls/puts": "Calls/Puts",
  "Each strike's calls above zero and its puts below": "Calls je Strike über null, Puts darunter",
  net: "netto",
  "One bar per strike: its calls and puts added": "Ein Balken je Strike: Calls und Puts addiert",
  zones: "Zonen",
  "Net bars, with the prices shaded where dealers would be short gamma or long it":
    "Netto-Balken, die Preise schattiert, bei denen Dealer short oder long Gamma wären",
  "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).":
    "Der Ansichtsschalter neben dem Cursor zeichnet die Balken auf drei Arten: Calls/Puts, die Calls je Strike über null und die Puts darunter; netto, beide zu einem Balken addiert; und Zonen, die Netto-Balken mit schattierten Preisen, wo die Linie unter null liegt (Dealer short Gamma, rot) oder darüber (long Gamma, blau).",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.":
    "Strikes jenseits von ±{pct} vom Spot liegen außerhalb des Charts: {usd} Exposure, beide Vorzeichen.",
  "flip {price}": "Flip {price}",
  "{currency} · {source} options · gamma exposure by strike · {scope}":
    "{currency} · {source}-Optionen · Gamma-Exposure nach Strike · {scope}",
  Calls: "Calls",
  Puts: "Puts",
  "Net if the spot moved there": "Netto, wenn der Spot dorthin liefe",
  Spot: "Spot",
  "{currency} strike bands; arrow keys read one at a time":
    "{currency}-Strike-Bänder; Pfeiltasten lesen eins nach dem anderen",
  "{currency} options gamma exposure by strike":
    "Gamma-Exposure der {currency}-Optionen nach Strike",
  "net gamma keeps one sign within ±30% of the spot":
    "Netto-Gamma behält innerhalb von ±30% vom Spot ein Vorzeichen",
  "{pct} from spot; net gamma changes sign here":
    "{pct} vom Spot; hier wechselt das Netto-Gamma das Vorzeichen",
  "Net gamma exposure": "Netto-Gamma-Exposure",
  "per 1% move · dealers long gamma: their hedging damps moves":
    "pro 1% Bewegung · Dealer long Gamma: ihre Absicherung dämpft Bewegungen",
  "per 1% move · dealers short gamma: their hedging adds to moves":
    "pro 1% Bewegung · Dealer short Gamma: ihre Absicherung verstärkt Bewegungen",
  "Gamma flip": "Gamma-Flip",
  "Call wall / put wall": "Call-Wand / Put-Wand",
  "the strikes holding the most call and put gamma":
    "die Strikes mit dem meisten Call- und Put-Gamma",
  "calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries":
    "Calls / Puts am Spot · Put/Call {ratio} · {options} Optionen, {expiries} Verfälle",
  "calls / puts at the spot · put/call {ratio} · {options} options, one expiry":
    "Calls / Puts am Spot · Put/Call {ratio} · {options} Optionen, ein Verfall",
  "By expiry": "Nach Verfall",
  Expiry: "Verfall",
  Left: "Rest",
  Options: "Optionen",
  "Call OI ({unit})": "Call-OI ({unit})",
  "Put OI ({unit})": "Put-OI ({unit})",
  Net: "Netto",
  "Of the chain's exposure, either sign counted": "Anteil am Exposure der Kette, beide Vorzeichen",
  Share: "Anteil",
  "Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.":
    "Exposure in Dollar pro 1% Bewegung. Verfälle außerhalb des gewählten Bereichs sind abgeblendet. Jede Deribit-Option verfällt um 08:00 UTC; eine in ihrer letzten Stunde bleibt außen vor.",
  "Gamma exposure is how much of the underlying the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, per 1% move in the currency the contract pays, added up by strike.":
    "Gamma-Exposure ist, wie viel vom Basiswert die Halter seiner Optionen kaufen oder verkaufen müssten, um bei einer Preisbewegung von 1% abgesichert zu bleiben: das Gamma jeder Option mal ihr Open Interest, pro 1% Bewegung in der Währung, in der der Kontrakt zahlt, nach Strike summiert.",
  "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.":
    "Calls zählen positiv, Puts negativ. Das ist die übliche Lesart und eine Annahme: Sie geht davon aus, dass Dealer long in den Calls sind, die Kunden ihnen verkauft haben, und short in den Puts, die Kunden gekauft haben. Keine Börse veröffentlicht, wer welche Seite hält, daher beruht jede Zahl mit Vorzeichen hier darauf; wo Open Interest und Gamma liegen, nicht.",
  "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.":
    "Positives Netto-Exposure heißt, Dealer verkaufen in Anstiege und kaufen in Rückgänge, was Bewegungen eher dämpft; negatives heißt, sie laufen dem Preis hinterher, was Bewegungen eher verstärkt. Der Flip ist, wo das Netto das Vorzeichen wechseln würde, wenn der Spot dorthin liefe, und die Linie zeigt das Netto bei jedem solchen Preis. Die Wände sind die Strikes mit dem meisten Call- und Put-Gamma.",
  "Crypto: Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.":
    "Krypto: die BTC- und ETH-Bücher von Deribit, die die meisten gelisteten Krypto-Optionen halten; Bybit, OKX und Binance listen weit weniger und sind nicht enthalten. Open Interest, Mark-Volatilität und der Forward jedes Verfalls stammen von Deribit selbst; das Gamma wird daraus mit Black-76 berechnet, das Deribits eigenes Delta und Vega reproduziert. Alle fünf Minuten gelesen.",
  "United States: Cboe's 15-minute delayed chains for the S&amp;P 500, Nasdaq-100 and Russell 2000 indexes and the most traded ETFs and stocks, with Cboe's own volatility and open interest, the spot taken as the forward. Read every 15 minutes through the US session; outside it the figures are the last session's.":
    "USA: die um 15 Minuten verzögerten Ketten der Cboe für die Indizes S&amp;P 500, Nasdaq-100 und Russell 2000 sowie die meistgehandelten ETFs und Aktien, mit Cboes eigener Volatilität und eigenem Open Interest, der Spot als Forward genommen. Während der US-Sitzung alle 15 Minuten gelesen; außerhalb davon gelten die Zahlen der letzten Sitzung.",
  "Chips and memory: the same Cboe chains for the chip, memory and hardware stocks and ETFs the perps trade most. SK hynix is its Nasdaq ADR (SKHY), the price the SKHY perps follow; the SKHYNIX perps quote one Seoul share instead. Samsung's options trade only on the Korea Exchange and are not read yet, and neither Deribit nor Binance lists options on stocks.":
    "Chips und Speicher: dieselben Cboe-Ketten für die Chip-, Speicher- und Hardware-Aktien und -ETFs, die als Perps am meisten gehandelt werden. SK hynix ist sein Nasdaq-ADR (SKHY), der Kurs, dem die SKHY-Perps folgen; die SKHYNIX-Perps notieren stattdessen eine Aktie aus Seoul. Samsungs Optionen werden nur an der Korea Exchange gehandelt und noch nicht gelesen, und weder Deribit noch Binance listen Optionen auf Aktien.",
  "Biotech and health, and Metals and mining: the same Cboe chains for the drug makers, health care and biotech funds, and for the gold, silver and copper miners, their funds, gold and silver themselves (GLD, SLV), and the lithium, nickel and rare-earth producers batteries need. The perps trade few of them; a book is kept when its open interest is about $0.5B or more, which leaves out the small lithium names.":
    "Biotech und Gesundheit sowie Metalle und Bergbau: dieselben Cboe-Ketten für die Pharmahersteller, Gesundheits- und Biotech-Fonds und für die Gold-, Silber- und Kupferminen, ihre Fonds, Gold und Silber selbst (GLD, SLV) sowie die Lithium-, Nickel- und Seltene-Erden-Produzenten, die Batterien brauchen. Als Perps werden nur wenige davon gehandelt; ein Buch bleibt, wenn sein Open Interest bei etwa $0.5B oder mehr liegt, was die kleinen Lithium-Werte ausschließt.",
  "Asia-Pacific and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, its three nearest months), ASX (S&amp;P/ASX 200), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement (for ASX, its closing theoretical price) with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.":
    "Asien-Pazifik und Europa: die Tagesend-Datei jeder Börse, einmal nach der Veröffentlichung gelesen -- HKEX (Hang-Seng-Indizes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, die drei nächsten Monate), ASX (S&amp;P/ASX 200), NSE und BSE (Nifty, Sensex) und Eurex (Euro Stoxx 50, DAX, SMI). Sie veröffentlichen Abrechnungspreise und Open Interest, aber keine Volatilität, daher wird sie für jeden Strike aus seinem Out-of-the-Money-Abrechnungspreis (bei der ASX aus dem theoretischen Schlusspreis) mit Black-76 zurückgerechnet, gegen den Forward aus der Put-Call-Parität oder dem eigenen Future der Börse. Ihre Zahlen sind in der Währung, in der der Kontrakt zahlt, und gelten zum Schluss jenes Tages.",
  "Indonesia: the IDX lists no options on the Jakarta Composite and no exchange lists a perp on it, so Indonesia's book is Cboe's chain for the iShares MSCI Indonesia ETF (EIDO), in dollars, shown under Asia-Pacific. It follows MSCI's Indonesia index, not the Jakarta Composite, and it is thin: about eleven thousand contracts open in four expiries.":
    "Indonesien: Die IDX listet keine Optionen auf den Jakarta Composite, und keine Börse listet einen Perp darauf, daher ist Indonesiens Buch die Cboe-Kette für den iShares MSCI Indonesia ETF (EIDO), in Dollar, unter Asien-Pazifik gezeigt. Er folgt dem MSCI-Indonesien-Index, nicht dem Jakarta Composite, und ist dünn: etwa elftausend offene Kontrakte in vier Verfällen.",
  "The options data could not be read right now.":
    "Die Optionsdaten konnten gerade nicht gelesen werden.",
  "No gamma exposure has been computed for {currency} yet.":
    "Für {currency} wurde noch kein Gamma-Exposure berechnet.",
  "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.":
    "Die {currency}-Optionen von {source} wurden zuletzt {ago} gelesen, zu lange her, um sie als aktuelle Positionierung zu zeigen.",
  "Not updated since {ago}: the latest read of {source} failed, so these figures are that old.":
    "Nicht aktualisiert seit {ago}: Der letzte Abruf von {source} schlug fehl, daher sind diese Zahlen so alt.",
  "Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.":
    "Nicht aktualisiert seit {ago}: Von {source} wurde nichts Neueres gelesen, ein Feiertag oder ein fehlgeschlagener Abruf, daher sind diese Zahlen so alt.",
  "No expiry in this range": "Kein Verfall in diesem Bereich",
  "No {currency} option expires in this range; the nearest expires {date}.":
    "Keine {currency}-Option verfällt in diesem Bereich; die nächste verfällt am {date}.",
  "No strike has open interest in this range.": "Kein Strike hat Open Interest in diesem Bereich.",
  "Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. {source} options, {asof}.":
    "Calls positiv, Puts negativ: Dealer als long Calls und short Puts angenommen, da keine Börse veröffentlicht, wer welche Seite hält. {source}-Optionen, {asof}.",
  "read {ago}": "gelesen {ago}",
  "15-minute delayed, read {ago}": "15 Minuten verzögert, gelesen {ago}",
  "from the end-of-day file for {date}": "aus der Tagesend-Datei vom {date}",
  expired: "verfallen",
  "Call OI": "Call-OI",
  "Put OI": "Put-OI",
  "Exposure in {unit} per 1% move; open interest at its value at the spot. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Exposure in {unit} pro 1% Bewegung; Open Interest zu seinem Wert am Spot. Verfälle außerhalb des gewählten Bereichs sind abgeblendet; eine Option in ihrer letzten Stunde bleibt außen vor.",
  // The book picker.
  "Pick an option book": "Optionsbuch wählen",
  "{n} books": "{n} Bücher",
  "Filter books": "Bücher filtern",
  Book: "Buch",
  "Net gamma": "Netto-Gamma",
  "Every expiry, per 1% move, in the currency the contract pays":
    "Alle Verfälle, pro 1% Bewegung, in der Währung, in der der Kontrakt zahlt",
  "Calls / puts": "Calls / Puts",
  Flip: "Flip",
  "Where net gamma changes sign, from the spot":
    "Wo das Netto-Gamma das Vorzeichen wechselt, vom Spot aus",
  "As of": "Stand",
  "No book matches.": "Kein Buch passt.",
  "calls {calls} · puts {puts}": "Calls {calls} · Puts {puts}",
  "close {date}": "Schluss {date}",
  Crypto: "Krypto",
  "United States": "USA",
  "Chips and memory": "Chips und Speicher",
  "Biotech and health": "Biotech und Gesundheit",
  "Metals and mining": "Metalle und Bergbau",
  "Asia-Pacific": "Asien-Pazifik",
  Europe: "Europa",
  Other: "Sonstige",
  Bitcoin: "Bitcoin",
  Ether: "Ether",
  "S&P 500": "S&P 500",
  "Nasdaq-100": "Nasdaq-100",
  "Russell 2000": "Russell 2000",
  "SPDR S&P 500 ETF": "SPDR S&P 500 ETF",
  "Invesco QQQ": "Invesco QQQ",
  "iShares Russell 2000 ETF": "iShares Russell 2000 ETF",
  "SPDR Gold Shares": "SPDR Gold Shares",
  "iShares Silver Trust": "iShares Silver Trust",
  "United States Oil Fund": "United States Oil Fund",
  "iShares Bitcoin Trust": "iShares Bitcoin Trust",
  "iShares Ethereum Trust": "iShares Ethereum Trust",
  Strategy: "Strategy",
  Coinbase: "Coinbase",
  NVIDIA: "NVIDIA",
  Tesla: "Tesla",
  Micron: "Micron",
  "SK hynix (ADR)": "SK hynix (ADR)",
  Sandisk: "Sandisk",
  "Western Digital": "Western Digital",
  Seagate: "Seagate",
  "Roundhill Memory ETF": "Roundhill Memory ETF",
  AMD: "AMD",
  Broadcom: "Broadcom",
  "TSMC (ADR)": "TSMC (ADR)",
  Intel: "Intel",
  Marvell: "Marvell",
  Arm: "Arm",
  Qualcomm: "Qualcomm",
  ASML: "ASML",
  "Applied Materials": "Applied Materials",
  "Lam Research": "Lam Research",
  KLA: "KLA",
  Dell: "Dell",
  Supermicro: "Supermicro",
  Lumentum: "Lumentum",
  Coherent: "Coherent",
  "Applied Optoelectronics": "Applied Optoelectronics",
  Corning: "Corning",
  "VanEck Semiconductor ETF": "VanEck Semiconductor ETF",
  "iShares Semiconductor ETF": "iShares Semiconductor ETF",
  "Direxion Semiconductor Bull 3X": "Direxion Semiconductor Bull 3X",
  "iShares MSCI South Korea ETF": "iShares MSCI South Korea ETF",
  "iShares MSCI Indonesia ETF": "iShares MSCI Indonesia ETF",
  "Direxion Semiconductor Bear 3X": "Direxion Semiconductor Bear 3X",
  "Direxion Micron Bull 2X": "Direxion Micron Bull 2X",
  "Direxion South Korea Bull 3X": "Direxion South Korea Bull 3X",
  "Eli Lilly": "Eli Lilly",
  UnitedHealth: "UnitedHealth",
  Moderna: "Moderna",
  "Health Care Select Sector SPDR": "Health Care Select Sector SPDR",
  "Johnson & Johnson": "Johnson & Johnson",
  "SPDR S&P Biotech ETF": "SPDR S&P Biotech ETF",
  AbbVie: "AbbVie",
  Merck: "Merck",
  Pfizer: "Pfizer",
  "Novo Nordisk (ADR)": "Novo Nordisk (ADR)",
  "Intuitive Surgical": "Intuitive Surgical",
  Amgen: "Amgen",
  "Thermo Fisher": "Thermo Fisher",
  Regeneron: "Regeneron",
  Gilead: "Gilead",
  "Tempus AI": "Tempus AI",
  Vertex: "Vertex",
  "AstraZeneca (ADR)": "AstraZeneca (ADR)",
  "Hims & Hers": "Hims & Hers",
  Biogen: "Biogen",
  "iShares Biotechnology ETF": "iShares Biotechnology ETF",
  "Viking Therapeutics": "Viking Therapeutics",
  "VanEck Gold Miners ETF": "VanEck Gold Miners ETF",
  Newmont: "Newmont",
  Barrick: "Barrick",
  "Agnico Eagle": "Agnico Eagle",
  "VanEck Junior Gold Miners ETF": "VanEck Junior Gold Miners ETF",
  "Wheaton Precious Metals": "Wheaton Precious Metals",
  "Kinross Gold": "Kinross Gold",
  "First Majestic Silver": "First Majestic Silver",
  "Amplify Junior Silver Miners ETF": "Amplify Junior Silver Miners ETF",
  "Hecla Mining": "Hecla Mining",
  "Pan American Silver": "Pan American Silver",
  "Global X Silver Miners ETF": "Global X Silver Miners ETF",
  "Coeur Mining": "Coeur Mining",
  "Freeport-McMoRan": "Freeport-McMoRan",
  "Global X Copper Miners ETF": "Global X Copper Miners ETF",
  "BHP (ADR)": "BHP (ADR)",
  "Rio Tinto (ADR)": "Rio Tinto (ADR)",
  "Southern Copper": "Southern Copper",
  "Vale (ADR)": "Vale (ADR)",
  Albemarle: "Albemarle",
  "MP Materials": "MP Materials",
  "USA Rare Earth": "USA Rare Earth",
  "Hang Seng": "Hang Seng",
  "Hang Seng China Enterprises": "Hang Seng China Enterprises",
  "Hang Seng TECH": "Hang Seng TECH",
  "CSI 300": "CSI 300",
  "SSE 50": "SSE 50",
  "CSI 1000": "CSI 1000",
  TAIEX: "TAIEX",
  "Nikkei 225": "Nikkei 225",
  "S&P/ASX 200": "S&P/ASX 200",
  "Nifty 50": "Nifty 50",
  "Nifty Bank": "Nifty Bank",
  "BSE Sensex": "BSE Sensex",
  "Euro Stoxx 50": "Euro Stoxx 50",
  DAX: "DAX",
  "Swiss Market Index": "Swiss Market Index",
  // Chart readout (slot-chart.ts).
  "strike {strikes} ({pct} from spot)": "Strike {strikes} ({pct} vom Spot)",
  "{low} – {high} ({pct} from spot)": "{low} – {high} ({pct} vom Spot)",
  "no open interest here": "hier kein Open Interest",
  "calls {usd} ({oi} open)": "Calls {usd} ({oi} offen)",
  "puts {usd} ({oi} open)": "Puts {usd} ({oi} offen)",
  "net {usd}": "netto {usd}",
  "if the spot were here: net {usd}": "wäre der Spot hier: netto {usd}",
  "Expected price move": "Erwartete Preisbewegung",
  "1 day ahead": "1 Tag voraus",
  "1 week ahead": "1 Woche voraus",
  "30 days ahead": "30 Tage voraus",
  "to the {date} expiry": "bis zum Verfall am {date}",
  "IV {iv}": "IV {iv}",
  "ATM IV": "ATM-IV",
  "Implied volatility at the expiry's forward, a year":
    "Implizite Volatilität am Forward des Verfalls, annualisiert",
  "closed inside 1σ on {one} and 2σ on {two} of days since {year}":
    "schloss an {one} der Tage seit {year} innerhalb von 1σ und an {two} innerhalb von 2σ",
  "expected move, 1σ and 2σ, {horizon}": "erwartete Bewegung, 1σ und 2σ, {horizon}",
  "spot · {source} IV": "Spot · {source}-IV",
  "One standard deviation is the price × IV × √(days/365), from each expiry's at-the-money implied volatility (between two expiries, their total variance interpolated). The walls are one and two deviations either side of the spot. A normal distribution ends inside them 68% and 95% of the time; real prices have fatter tails, and options usually price in more movement than follows.":
    "Eine Standardabweichung ist Preis × IV × √(Tage/365), aus der At-the-Money-Volatilität jedes Verfalls (zwischen zwei Verfällen ihre Gesamtvarianz interpoliert). Die Wände liegen eine und zwei Abweichungen beiderseits des Spots. Eine Normalverteilung endet in 68% und 95% der Fälle innerhalb davon; echte Preise haben dickere Ränder, und Optionen preisen meist mehr Bewegung ein, als dann folgt.",
  "The last line of a branch is how often it really did, from Deribit's 30-day volatility index (DVOL) and the perpetual's daily settlement: one 30-day IV for every horizon, and overlapping windows, so frequencies rather than independent trials.":
    "Die letzte Zeile eines Zweigs zeigt, wie oft es wirklich so kam, aus Deribits 30-Tage-Volatilitätsindex (DVOL) und der täglichen Abrechnung des Perpetuals: eine 30-Tage-IV für jeden Horizont und sich überlappende Zeiträume, also Häufigkeiten statt unabhängiger Versuche.",
  "The expected move is the range the options have priced in: one standard deviation is the price times the at-the-money implied volatility times the square root of the days ahead over 365, and the walls sit one and two deviations either side of the spot. The chart draws them for the chosen expiries (30 days ahead for all of them); the mind map under it gives every horizon. They are not support or resistance, only the market's own estimate of how far price may travel.":
    "Die erwartete Bewegung ist die Spanne, die die Optionen eingepreist haben: Eine Standardabweichung ist der Preis mal die At-the-Money-Volatilität mal die Wurzel aus den Tagen voraus durch 365, und die Wände liegen eine und zwei Abweichungen beiderseits des Spots. Der Chart zeichnet sie für die gewählten Verfälle (30 Tage voraus für alle); die Mindmap darunter zeigt jeden Horizont. Sie sind weder Unterstützung noch Widerstand, nur die eigene Schätzung des Markts, wie weit der Preis laufen kann.",
  reference: "Referenz",
  Level: "Level",
  "From the reference": "Von der Referenz",
  "the next session": "die nächste Sitzung",
  "{date}, from 08:00 UTC": "{date}, ab 08:00 UTC",
  "{date} session": "Sitzung vom {date}",
  "no trade yet today": "heute noch kein Handel",
  "above it now": "jetzt darüber",
  "below it now": "jetzt darunter",
  "reached it today and back inside": "heute erreicht und wieder innerhalb",
  "inside all day so far": "bisher den ganzen Tag innerhalb",
  "No history is kept for this book's walls yet, so its 90% wall is the normal distribution's 1.645 standard deviations of the options' own IV, not a measured one. Its record starts with its first day below.":
    "Für die Wände dieses Buchs gibt es noch keine Historie, daher ist seine 90%-Wand das 1.645-Fache der Standardabweichung der Normalverteilung auf die eigene IV der Optionen, kein gemessener Wert. Seine Bilanz beginnt mit seinem ersten Tag unten.",
  "Measured on {days} sessions since {since} {year}, against Cboe's 1-day VIX: the S&amp;P 500 closed inside one standard deviation on {inside1}, and within {k90} of them on 90%, so that is where the 90% wall sits. Cboe's free history has the index's closes only, so touches of a wall during the day are not counted here; this book's own record below counts them.":
    "Gemessen an {days} Sitzungen seit {since} {year}, gegen den 1-Tages-VIX der Cboe: Der S&amp;P 500 schloss an {inside1} innerhalb einer Standardabweichung und an 90% innerhalb von {k90} davon, daher liegt dort die 90%-Wand. Die kostenlose Historie der Cboe hat nur die Schlusskurse des Index, daher werden Berührungen einer Wand im Tagesverlauf hier nicht gezählt; die eigene Bilanz dieses Buchs unten zählt sie.",
  "Measured on {days} Deribit days since {since} {year}, against the 30-day volatility index (DVOL) as each day began: the whole day stayed within {k90} standard deviations on 90% of days, so that is where the 90% wall sits. Within one, the whole day stayed on {inside1} and the close on {close1}. A touch of the 1σ wall closed back inside {rev1} of {touch1} times; a touch of the 90% wall, {rev90} of {touch90} times.":
    "Gemessen an {days} Deribit-Tagen seit {since} {year}, gegen den 30-Tage-Volatilitätsindex (DVOL) zu Beginn jedes Tages: Der ganze Tag blieb an 90% der Tage innerhalb von {k90} Standardabweichungen, daher liegt dort die 90%-Wand. Innerhalb von einer blieb der ganze Tag an {inside1} und der Schluss an {close1}. Eine Berührung der 1σ-Wand schloss {rev1} von {touch1} Mal wieder innerhalb; eine Berührung der 90%-Wand {rev90} von {touch90} Mal.",
  "not reached": "nicht erreicht",
  "reached, closed back inside": "erreicht, wieder innerhalb geschlossen",
  "closed beyond": "jenseits geschlossen",
  "above: {what}": "darüber: {what}",
  "below: {what}": "darunter: {what}",
  "The IV wall is the move the options price for the day: the reference close plus and minus one standard deviation, the close times the options' implied volatility a day ahead times the square root of 1/365. The levels are fixed when the day begins (Deribit's day at 08:00 UTC, a US session at its first read) so they do not drift through the day.":
    "Die IV-Wand ist die Bewegung, die die Optionen für den Tag einpreisen: der Referenzschluss plus und minus eine Standardabweichung, der Schluss mal die implizite Volatilität der Optionen einen Tag voraus mal die Wurzel aus 1/365. Die Levels werden zu Tagesbeginn festgelegt (Deribits Tag um 08:00 UTC, eine US-Sitzung beim ersten Abruf), damit sie im Tagesverlauf nicht wandern.",
  "The 90% wall is where history says price stayed: the multiple of a day's standard deviation that held on 90% of past days. BTC and ETH are measured on every Deribit day since 2021 against DVOL, their whole day's range; the S&amp;P 500 on every session since 2022 against Cboe's 1-day VIX, closes only. A book with no history uses the normal distribution's 1.645.":
    "Die 90%-Wand ist, wo der Preis laut Historie blieb: das Vielfache der täglichen Standardabweichung, das an 90% der vergangenen Tage hielt. BTC und ETH werden an jedem Deribit-Tag seit 2021 gegen den DVOL gemessen, über die Spanne des ganzen Tages; der S&amp;P 500 an jeder Sitzung seit 2022 gegen den 1-Tages-VIX der Cboe, nur Schlusskurse. Ein Buch ohne Historie nutzt die 1.645 der Normalverteilung.",
  "A wall is a probability, not a promise: a touch of the IV wall has closed back inside a little over half the time, not nine times in ten. The record under the ladder shows each day's outcome for this book.":
    "Eine Wand ist eine Wahrscheinlichkeit, kein Versprechen: Eine Berührung der IV-Wand schloss in gut der Hälfte der Fälle wieder innerhalb, nicht neun von zehn Mal. Die Bilanz unter der Leiter zeigt das Ergebnis jedes Tages für dieses Buch.",
  "{currency}'s options carry no implied volatility to draw walls from yet.":
    "Die {currency}-Optionen haben noch keine implizite Volatilität, aus der sich Wände zeichnen ließen.",
  "1.645 standard deviations of the options' IV (normal distribution)":
    "1.645 Standardabweichungen der Options-IV (Normalverteilung)",
  "{k90} standard deviations of {method} {sigma}, measured":
    "{k90} Standardabweichungen von {method} {sigma}, gemessen",
  "IV wall, 1σ": "IV-Wand, 1σ",
  "±{move} (±{pct}) from IV {iv} a day ahead": "±{move} (±{pct}) aus IV {iv} einen Tag voraus",
  "90% wall": "90%-Wand",
  "The day so far": "Der Tag bisher",
  Reference: "Referenz",
  "high {high} · low {low}": "Hoch {high} · Tief {low}",
  "IV wall: {status}": "IV-Wand: {status}",
  "the latest close, for the next session": "der letzte Schluss, für die nächste Sitzung",
  "Reference close": "Referenzschluss",
  "{currency} · {source} options · IV walls · {day}":
    "{currency} · {source}-Optionen · IV-Wände · {day}",
  "The day's range": "Die Tagesspanne",
  "IV wall": "IV-Wand",
  "90% wall, above": "90%-Wand, oben",
  "IV wall, above": "IV-Wand, oben",
  "1σ of the options' IV": "1σ der Options-IV",
  "IV wall, below": "IV-Wand, unten",
  "90% wall, below": "90%-Wand, unten",
  "{currency} comes from an end-of-day file, so its walls are for the next session and are not kept day by day.":
    "{currency} stammt aus einer Tagesend-Datei, daher gelten seine Wände für die nächste Sitzung und werden nicht Tag für Tag gespeichert.",
  "{currency}'s own record starts with today; each finished day is added here.":
    "Die eigene Bilanz von {currency} beginnt heute; jeder abgeschlossene Tag kommt hier hinzu.",
  "{currency}'s own record, {days} finished days since {since}. IV wall: touched {reached}, closed back inside {held}. 90% wall: touched {reached90}, closed back inside {held90}.":
    "Eigene Bilanz von {currency}, {days} abgeschlossene Tage seit {since}. IV-Wand: berührt {reached}, wieder innerhalb geschlossen {held}. 90%-Wand: berührt {reached90}, wieder innerhalb geschlossen {held90}.",
  "High / low": "Hoch / Tief",
  Close: "Schluss",
  "At the IV wall": "An der IV-Wand",
  "At the 90% wall": "An der 90%-Wand",
  "How price has behaved at the walls": "Wie sich der Preis an den Wänden verhalten hat",
  "Prices in {unit}. {source} options, read {ago}.":
    "Preise in {unit}. {source}-Optionen, gelesen {ago}.",
  "Two readings of where the market makers stand, side by side, for the nearest expiry. The gamma ceiling is the strike above the spot holding the most call gamma, and the gamma floor the strike below it holding the most put gamma: where hedging flows are largest.":
    "Zwei Lesarten, wo die Market Maker stehen, nebeneinander, für den nächsten Verfall. Die Gamma-Decke ist der Strike über dem Spot mit dem meisten Call-Gamma, der Gamma-Boden der Strike darunter mit dem meisten Put-Gamma: wo die Absicherungsflüsse am größten sind.",
  "The dealer range reads every option as sold by dealers who keep the premium, as max pain does: at expiry they pay out what the options are worth, so they earn most at the max pain strike and start losing beyond the break-evens either side, the dealer ceiling and floor. No exchange publishes who sold what, so this rests on that assumption, and the Gamma Exposure tab's sign assumes the opposite for calls.":
    "Die Dealer-Spanne liest jede Option als von Dealern verkauft, die die Prämie behalten, wie es Max Pain tut: Beim Verfall zahlen sie aus, was die Optionen wert sind, verdienen also am meisten am Max-Pain-Strike und beginnen jenseits der Break-evens beiderseits zu verlieren, der Dealer-Decke und dem Dealer-Boden. Keine Börse veröffentlicht, wer was verkauft hat, daher beruht das auf dieser Annahme, und das Vorzeichen im Tab Gamma-Exposure nimmt für Calls das Gegenteil an.",
  "A ceiling or floor within a quarter of the day's move of an IV wall is marked as lined up with it. Whether price turns there more often than elsewhere is what the record under the ladder is for: it starts with this tab and grows a day at a time.":
    "Eine Decke oder ein Boden innerhalb eines Viertels der Tagesbewegung von einer IV-Wand wird als mit ihr ausgerichtet markiert. Ob der Preis dort öfter dreht als anderswo, zeigt die Bilanz unter der Leiter: Sie beginnt mit diesem Tab und wächst Tag für Tag.",
  "gamma ceiling": "Gamma-Decke",
  "dealer ceiling": "Dealer-Decke",
  "gamma floor": "Gamma-Boden",
  "dealer floor": "Dealer-Boden",
  "Gamma ceiling / floor": "Gamma-Decke / -Boden",
  "the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}":
    "die Strikes mit dem meisten Call-Gamma über dem Spot und Put-Gamma darunter, Verfall {expiry}",
  "Dealer ceiling / floor": "Dealer-Decke / -Boden",
  "where dealers who sold every option of that expiry break even; max pain {pain}":
    "wo Dealer, die alle Optionen dieses Verfalls verkauft haben, ihren Break-even erreichen; Max Pain {pain}",
  "max pain": "Max Pain",
  "{currency} · {source} options · ceiling and floor · expiring {expiry}":
    "{currency} · {source}-Optionen · Decke und Boden · Verfall {expiry}",
  "dealer ceiling and floor": "Dealer-Decke und -Boden",
  "lined up with a wall": "mit einer Wand ausgerichtet",
  "Dealer range by expiry": "Dealer-Spanne nach Verfall",
  Premium: "Prämie",
  "Dealer floor": "Dealer-Boden",
  "Max pain": "Max Pain",
  "Dealer ceiling": "Dealer-Decke",
  "From the spot": "Vom Spot",
  "Lined up with a wall": "Mit einer Wand ausgerichtet",
  "{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.":
    "{currency} stammt aus einer Tagesend-Datei, daher gelten seine Levels für die nächste Sitzung und werden nicht Tag für Tag gespeichert.",
  Days: "Tage",
  Reached: "Erreicht",
  "Closed back inside": "Wieder innerhalb geschlossen",
  "Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.":
    "Über {days} abgeschlossene Tage seit {since}, beide Seiten gezählt; ein Level gilt als erreicht, wenn Tageshoch (oder -tief) es berührt, und als gehalten, wenn der Tag wieder innerhalb davon schließt.",
  "How price has behaved at these levels": "Wie sich der Preis an diesen Levels verhalten hat",
  "IV Walls": "IV-Wände",
  "IV walls": "IV-Wände",
  "Ceiling & Floor": "Decke und Boden",
  Ceiling: "Decke",
  "the spot now": "der Spot jetzt",
  "week from {date}": "Woche ab {date}",
  "Levels for": "Levels für",
  "The Day and Week switch reads the same levels for the nearest expiry or for the week's: Deribit's Friday 08:00 UTC weekly, or a US book's last expiry of the week. The week's levels are fixed by its first read, its IV walls span the time to that expiry, and its 90% wall is measured on whole past weeks where there is history.":
    "Der Schalter Tag und Woche liest dieselben Levels für den nächsten Verfall oder für den der Woche: Deribits Wochen-Verfall freitags um 08:00 UTC oder den letzten Verfall der Woche eines US-Buchs. Die Levels der Woche werden beim ersten Abruf festgelegt, ihre IV-Wände decken die Zeit bis zu diesem Verfall ab, und ihre 90%-Wand wird an ganzen vergangenen Wochen gemessen, wo es Historie gibt.",
  "the strikes holding the most call gamma above the spot and put gamma below it, in everything expiring by {expiry}":
    "die Strikes mit dem meisten Call-Gamma über dem Spot und Put-Gamma darunter, in allem, was bis {expiry} verfällt",
  "The week so far": "Die Woche bisher",
  "the spot now; this week's levels are fixed by its first read":
    "der Spot jetzt; die Levels dieser Woche stehen seit ihrem ersten Abruf fest",
  "{currency}'s weekly record starts with this week; each finished week is added here.":
    "Die Wochenbilanz von {currency} beginnt mit dieser Woche; jede abgeschlossene Woche kommt hier hinzu.",
  Weeks: "Wochen",
  "Over {weeks} finished weeks since {since}, both sides counted; a level is reached when the week's high (or low) touches it, and held when the week closes back inside it.":
    "Über {weeks} abgeschlossene Wochen seit {since}, beide Seiten gezählt; ein Level gilt als erreicht, wenn Wochenhoch (oder -tief) es berührt, und als gehalten, wenn die Woche wieder innerhalb davon schließt.",
  "{currency} · {source} options · IV walls day by day":
    "{currency} · {source}-Optionen · IV-Wände Tag für Tag",
  "{currency} · {source} options · ceiling and floor day by day":
    "{currency} · {source}-Optionen · Decke und Boden Tag für Tag",
  "daily candle": "Tageskerze",
  "week's expiry": "Wochen-Verfall",
  "Each day's candle under the walls it opened with. The walls are fixed by the day's first read, so they move only from one day to the next.":
    "Die Kerze jedes Tages unter den Wänden, mit denen er eröffnete. Die Wände werden beim ersten Abruf des Tages festgelegt, daher ändern sie sich nur von einem Tag zum nächsten.",
  "Each day's candle under the levels it opened with. They are fixed by the day's first read, so they move only from one day to the next; the dotted rule marks each week's expiry.":
    "Die Kerze jedes Tages unter den Levels, mit denen er eröffnete. Sie werden beim ersten Abruf des Tages festgelegt, daher ändern sie sich nur von einem Tag zum nächsten; die gepunktete Linie markiert den Verfall jeder Woche.",
  "Each day's candle under its week's levels. They are fixed by the week's first read, so they move only at a week's expiry, the dotted rule.":
    "Die Kerze jedes Tages unter den Levels ihrer Woche. Sie werden beim ersten Abruf der Woche festgelegt, daher ändern sie sich nur beim Verfall einer Woche, der gepunkteten Linie.",
  // The Delta, Vega and Theta tabs (web/greeks.ts).
  Delta: "Delta",
  "{currency} · {source} options · delta by strike · {scope}":
    "{currency} · {source}-Optionen · Delta nach Strike · {scope}",
  "{currency} · {source} options · vega by strike · {scope}":
    "{currency} · {source}-Optionen · Vega nach Strike · {scope}",
  "{currency} · {source} options · theta by strike · {scope}":
    "{currency} · {source}-Optionen · Theta nach Strike · {scope}",
  "net {net} at spot {spot} · calls above zero, puts below · hover or tap a strike to read it":
    "netto {net} bei Spot {spot} · Calls über null, Puts darunter · Strike antippen oder darauf zeigen",
  "{total} per IV point at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "{total} pro IV-Punkt bei Spot {spot} · Calls und Puts je Strike gestapelt · Strike antippen oder darauf zeigen",
  "{total} a day at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "{total} pro Tag bei Spot {spot} · Calls und Puts je Strike gestapelt · Strike antippen oder darauf zeigen",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of the total.":
    "Strikes jenseits von ±{pct} vom Spot liegen außerhalb des Charts: {usd} der Summe.",
  "total {usd}": "gesamt {usd}",
  "{share} of it in that expiry, {left} left": "{share} davon in diesem Verfall, noch {left}",
  "≈ {coins} at the spot; what the open options move like, as their buyers hold them":
    "≈ {coins} am Spot; wie viel Basiswert die offenen Optionen entsprechen, aus Sicht ihrer Käufer",
  "what the open options move like, as their buyers hold them":
    "wie viel Basiswert die offenen Optionen entsprechen, aus Sicht ihrer Käufer",
  "Net delta": "Netto-Delta",
  "calls' delta is positive, puts' negative":
    "das Delta von Calls ist positiv, das von Puts negativ",
  "Most delta": "Meistes Delta",
  Vega: "Vega",
  "per IV point: what the open options gain if implied volatility rises one point, and their writers lose":
    "pro IV-Punkt: was die offenen Optionen gewinnen, wenn die implizite Volatilität um einen Punkt steigt, und ihre Verkäufer verlieren",
  "every option gains as implied volatility rises":
    "jede Option gewinnt, wenn die implizite Volatilität steigt",
  "Most vega": "Meistes Vega",
  "of the options' value a day, {premium} in all": "des Optionswerts pro Tag, {premium} insgesamt",
  Theta: "Theta",
  "a day: what the open options lose to time with price and IV unchanged, paid by their buyers to their writers":
    "pro Tag: was die offenen Optionen bei unverändertem Preis und IV durch Zeit verlieren, von ihren Käufern an ihre Verkäufer gezahlt",
  "every option loses value as expiry nears, faster the closer it is":
    "jede Option verliert Wert, je näher der Verfall rückt, umso schneller, je näher er ist",
  "Most theta": "Meistes Theta",
  "Decay rate": "Zerfallsrate",
  "Delta in {unit}: the value of the underlying each expiry's open options move like. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Delta in {unit}: der Wert des Basiswerts, dem die offenen Optionen jedes Verfalls entsprechen. Verfälle außerhalb des gewählten Bereichs sind abgeblendet; eine Option in ihrer letzten Stunde bleibt außen vor.",
  "Vega in {unit} per IV point. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Vega in {unit} pro IV-Punkt. Verfälle außerhalb des gewählten Bereichs sind abgeblendet; eine Option in ihrer letzten Stunde bleibt außen vor.",
  "Theta in {unit} a day. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Theta in {unit} pro Tag. Verfälle außerhalb des gewählten Bereichs sind abgeblendet; eine Option in ihrer letzten Stunde bleibt außen vor.",
  "Of the chain's total, either side counted":
    "Anteil an der Summe der Kette, beide Seiten gezählt",
  Total: "Gesamt",
  "Delta is how much an option's value moves with the underlying: about a half at the money, near 1 deep in the money and near 0 far out of it, negative for puts. Times open interest and the forward, it is the value of the underlying the open options move like, added up by strike.":
    "Delta ist, wie stark sich der Wert einer Option mit dem Basiswert bewegt: etwa die Hälfte am Geld, nahe 1 tief im Geld und nahe 0 weit aus dem Geld, negativ bei Puts. Mal Open Interest und Forward ist es der Wert des Basiswerts, dem die offenen Optionen entsprechen, nach Strike summiert.",
  "It is read from the side of whoever bought the options: calls positive, puts negative. Whoever wrote them holds exactly the opposite, so were every writer hedged, their hedges would hold this much of the underlying. Nothing here assumes who is on which side, unlike gamma exposure.":
    "Es wird aus Sicht der Käufer der Optionen gelesen: Calls positiv, Puts negativ. Wer sie verkauft hat, hält genau das Gegenteil; wäre also jeder Verkäufer abgesichert, hielten ihre Hedges so viel vom Basiswert. Anders als beim Gamma-Exposure wird hier nichts darüber angenommen, wer auf welcher Seite steht.",
  "Most delta sits in options already in the money, away from the spot, so this chart often reaches wider than the gamma chart.":
    "Das meiste Delta steckt in Optionen, die schon im Geld sind, abseits vom Spot, daher reicht dieser Chart oft weiter als der Gamma-Chart.",
  "Vega is how much an option's value moves when implied volatility moves one point, say from 40% to 41%: largest at the money and for options with long to run. Times open interest, it is what the open options gain if IV rises a point, added up by strike.":
    "Vega ist, wie stark sich der Wert einer Option bewegt, wenn sich die implizite Volatilität um einen Punkt bewegt, etwa von 40% auf 41%: am größten am Geld und bei Optionen mit langer Laufzeit. Mal Open Interest ist es, was die offenen Optionen gewinnen, wenn die IV um einen Punkt steigt, nach Strike summiert.",
  "Every option carries positive vega for whoever bought it and the same amount negative for whoever wrote it, so the total is what option writers stand to lose if IV rises a point, and gain if it falls one.":
    "Jede Option hat positives Vega für ihren Käufer und denselben Betrag negativ für ihren Verkäufer, daher ist die Summe das, was Optionsverkäufer verlieren, wenn die IV um einen Punkt steigt, und gewinnen, wenn sie um einen fällt.",
  "Theta is how much an option's value falls in a day with price and implied volatility unchanged: largest at the money and in an option's last days. Times open interest, it is what the open options lose in a day, added up by strike.":
    "Theta ist, wie stark der Wert einer Option an einem Tag bei unverändertem Preis und unveränderter impliziter Volatilität fällt: am größten am Geld und in den letzten Tagen einer Option. Mal Open Interest ist es, was die offenen Optionen an einem Tag verlieren, nach Strike summiert.",
  "Buyers pay it and writers collect it: the total is roughly what option writers earn in a quiet day, the carry they are paid for taking on gamma. The decay rate divides it by what the options in range are worth.":
    "Käufer zahlen es und Verkäufer kassieren es: Die Summe ist ungefähr, was Optionsverkäufer an einem ruhigen Tag verdienen, der Carry, den sie dafür bekommen, Gamma zu übernehmen. Die Zerfallsrate teilt es durch den Wert der Optionen im Bereich.",
  "The same books and reads as Gamma Exposure: Deribit's BTC and ETH every five minutes, Cboe's US chains every 15 minutes through the session, and the exchanges' end-of-day files for Asia-Pacific and Europe. Each option's Greeks are Black-76 at a zero rate on its own open interest, implied volatility and forward, in the currency the contract pays; they reproduce Deribit's own to within 0.03%.":
    "Dieselben Bücher und Abrufe wie bei Gamma-Exposure: Deribits BTC und ETH alle fünf Minuten, die US-Ketten der Cboe alle 15 Minuten während der Sitzung und die Tagesend-Dateien der Börsen für Asien-Pazifik und Europa. Die Greeks jeder Option sind Black-76 mit Nullzins auf ihr eigenes Open Interest, ihre implizite Volatilität und ihren Forward, in der Währung, in der der Kontrakt zahlt; sie reproduzieren Deribits eigene bis auf 0.03%.",
  "Delta as the options' buyers hold it: calls positive, puts negative; whoever wrote them holds the opposite. {source} options, {asof}.":
    "Delta aus Sicht der Käufer der Optionen: Calls positiv, Puts negativ; wer sie verkauft hat, hält das Gegenteil. {source}-Optionen, {asof}.",
  "Vega as the options' buyers hold it, per point of implied volatility; whoever wrote them holds the opposite. {source} options, {asof}.":
    "Vega aus Sicht der Käufer der Optionen, pro Punkt impliziter Volatilität; wer sie verkauft hat, hält das Gegenteil. {source}-Optionen, {asof}.",
  "Theta as the options' buyers hold it, per day; whoever wrote them collects it. {source} options, {asof}.":
    "Theta aus Sicht der Käufer der Optionen, pro Tag; wer sie verkauft hat, kassiert es. {source}-Optionen, {asof}.",
  "Delta, vega and theta have not been computed for {currency} yet; they arrive with its next read.":
    "Delta, Vega und Theta wurden für {currency} noch nicht berechnet; sie kommen mit dem nächsten Abruf.",
  // The Gamma Exposure tab's By expiry chart (web/gamma.ts) and its readout (web/slot-chart.ts).
  "Each expiry's calls above zero and its puts below, at their value at the spot":
    "Calls je Verfall über null, Puts darunter, zu ihrem Wert am Spot",
  "Each expiry's gamma exposure: calls above zero, puts below":
    "Gamma-Exposure je Verfall: Calls über null, Puts darunter",
  gamma: "Gamma",
  "Each expiry's at-the-money implied volatility: the term structure":
    "At-the-Money-Volatilität je Verfall: die Laufzeitstruktur",
  show: "zeigen",
  "{n} expiries · open interest {calls} in calls, {puts} in puts · hover or tap an expiry to read it":
    "{n} Verfälle · Open Interest {calls} in Calls, {puts} in Puts · Verfall antippen oder darauf zeigen",
  "{currency} · {source} options · by expiry": "{currency} · {source}-Optionen · nach Verfall",
  "{currency} expiries; arrow keys read one at a time":
    "{currency}-Verfälle; Pfeiltasten lesen einen nach dem anderen",
  "One bar per expiry in date order, so the gaps between them are not to scale; expiries outside the chosen range are dimmed.":
    "Ein Balken je Verfall in Datumsreihenfolge, daher sind die Abstände dazwischen nicht maßstabsgetreu; Verfälle außerhalb des gewählten Bereichs sind abgeblendet.",
  "{date}, {left} left": "{date}, noch {left}",
  "{n} options": "{n} Optionen",
  "calls {oi} open": "Calls {oi} offen",
  "puts {oi} open": "Puts {oi} offen",
  "put/call {ratio}": "Put/Call {ratio}",
  "gamma {calls} / {puts}, net {net}": "Gamma {calls} / {puts}, netto {net}",
  "ATM IV {iv}": "ATM-IV {iv}",
  "max pain {price}": "Max Pain {price}",
  "dealer range {low} – {high}": "Dealer-Spanne {low} – {high}",
  "premium {usd}": "Prämie {usd}",
  // Reaction zones (web/confluence.ts).
  "reaction zone, today": "Reaktionszone, heute",
  "gamma wall": "Gamma-Wand",
  "dealer break-even": "Dealer-Break-even",
  "gamma flip": "Gamma-Flip",
  "the spot is inside it now": "der Spot liegt jetzt darin",
  "{points} ({pct}) away, {sigmas} of the day's move":
    "{points} ({pct}) entfernt, {sigmas} der Tagesbewegung",
  "No zone above": "Keine Zone darüber",
  "No zone below": "Keine Zone darunter",
  "no IV wall lines up with a ceiling": "keine IV-Wand liegt auf Höhe einer Decke",
  "no IV wall lines up with a floor": "keine IV-Wand liegt auf Höhe eines Bodens",
  "Above the spot": "Über dem Spot",
  "Below the spot": "Unter dem Spot",
  zone: "Zone",
  "Dealers long gamma ({net} per 1% move, every expiry): their hedging sells rises and buys dips, which is what lets a wall hold.":
    "Dealer long Gamma ({net} pro 1% Bewegung, alle Verfälle): Ihre Absicherung verkauft Anstiege und kauft Rücksetzer, und genau das lässt eine Wand halten.",
  "Dealers short gamma ({net} per 1% move, every expiry): their hedging chases the price, so walls give way more easily and fading them is riskier.":
    "Dealer short Gamma ({net} pro 1% Bewegung, alle Verfälle): Ihre Absicherung läuft dem Preis hinterher, daher geben Wände leichter nach und gegen sie zu handeln ist riskanter.",
  "Flip {price}, {pct} ({sigmas}).": "Flip {price}, {pct} ({sigmas}).",
  "Since {year}, a touch of this book's 1σ wall closed back inside {rev1} of {touch1} times, of its 90% wall {rev90} of {touch90}: better than a coin toss, not nine in ten.":
    "Seit {year} schloss eine Berührung der 1σ-Wand dieses Buchs {rev1} von {touch1} Mal wieder innerhalb, der 90%-Wand {rev90} von {touch90} Mal: besser als ein Münzwurf, nicht neun von zehn.",
  "A zone is where an IV wall and a market maker's level fall within a quarter of the day's 1σ move of each other: a place to wait for a rejection, not a trade on its own, and least reliable when dealers are short gamma.":
    "Eine Zone ist, wo eine IV-Wand und ein Level der Market Maker innerhalb eines Viertels der täglichen 1σ-Bewegung voneinander liegen: ein Ort, um auf eine Abweisung zu warten, kein Trade für sich, und am wenigsten verlässlich, wenn Dealer short Gamma sind.",
  "the week's 1σ move": "die 1σ-Bewegung der Woche",
  "the day's 1σ move": "die 1σ-Bewegung des Tages",
  "Reaction zones": "Reaktionszonen",
  "σ is {unit}, {move}": "σ ist {unit}, {move}",
  "between the IV walls": "zwischen den IV-Wänden",
  "between the 90% walls": "zwischen den 90%-Wänden",
  "each line's mark is beside its name below":
    "die Markierung jeder Linie steht unten neben ihrem Namen",
  "Each expiry's delta: calls above zero, puts below":
    "Delta je Verfall: Calls über null, Puts darunter",
  "Each expiry's theta a day, its calls and puts stacked down from the top":
    "Theta je Verfall pro Tag, Calls und Puts von oben nach unten gestapelt",
  "Each expiry's vega, its calls and puts stacked": "Vega je Verfall, Calls und Puts gestapelt",
  "Its own zone record, {days} finished days since {since}: {zones} zones, price reached {reached} and closed back on the near side of {held}; its IV walls on those days were reached {wallReached} times and held {wallHeld}.":
    "Eigene Zonenbilanz, {days} abgeschlossene Tage seit {since}: {zones} Zonen, der Preis erreichte {reached} und schloss bei {held} wieder auf der nahen Seite; die IV-Wände wurden an diesen Tagen {wallReached} Mal erreicht und hielten {wallHeld} Mal.",
  "This book's zone record starts with today: each finished day adds whether price reached a zone and turned there.":
    "Die Zonenbilanz dieses Buchs beginnt heute: Jeder abgeschlossene Tag ergänzt, ob der Preis eine Zone erreicht hat und dort gedreht hat.",
  "Zone record": "Zonenbilanz",
  "dealers long gamma": "Dealer long Gamma",
  "dealers short gamma": "Dealer short Gamma",
  delta: "Delta",
  "delta {calls} / {puts}, net {net}": "Delta {calls} / {puts}, netto {net}",
  "each finished day adds whether price reached a zone and closed back on its near side":
    "jeder abgeschlossene Tag ergänzt, ob der Preis eine Zone erreicht und wieder auf ihrer nahen Seite geschlossen hat",
  "no zone above": "keine Zone darüber",
  "no zone below": "keine Zone darunter",
  "starts this week": "beginnt diese Woche",
  "starts today": "beginnt heute",
  "the spot is in the zone {range}": "der Spot liegt in der Zone {range}",
  theta: "Theta",
  "theta {calls} / {puts} a day, total {net}": "Theta {calls} / {puts} pro Tag, gesamt {net}",
  "this book's days are not kept, so its zones have no record":
    "die Tage dieses Buchs werden nicht gespeichert, daher haben seine Zonen keine Bilanz",
  vega: "Vega",
  "vega {calls} / {puts}, total {net}": "Vega {calls} / {puts}, gesamt {net}",
  "zone above {range}, {sigmas} away": "Zone darüber {range}, {sigmas} entfernt",
  "zone below {range}, {sigmas} away": "Zone darunter {range}, {sigmas} entfernt",
  "zones reached and held over {days} finished days; the IV walls alone: {wallHeld} / {wallReached}":
    "Zonen erreicht und gehalten über {days} abgeschlossene Tage; nur die IV-Wände: {wallHeld} / {wallReached}",
  "zones reached and held over {days} finished weeks; the IV walls alone: {wallHeld} / {wallReached}":
    "Zonen erreicht und gehalten über {days} abgeschlossene Wochen; nur die IV-Wände: {wallHeld} / {wallReached}",
};
