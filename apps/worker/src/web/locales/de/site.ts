/**
 * The site-wide pieces and the small pages, in German: web/about.ts, web/legal.ts and web/tos.ts
 * (their notice only -- the bodies stay English), web/referral-links.ts, web/referral.ts,
 * web/install.ts, web/share.ts, web/await.ts, web/tabs.ts and web/glossary.ts. Glossary and style:
 * ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const site: Catalog = {
  // web/about.ts
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
  "{month} {day}, {year}": "{day}. {month} {year}",
  project: "Projekt",
  commit: "Commit",
  "not recorded": "nicht erfasst",
  "This build did not record its commit. Deployed builds stamp the commit they were built from here.":
    "Dieser Build hat seinen Commit nicht erfasst. Veröffentlichte Builds vermerken hier den Commit, aus dem sie gebaut wurden.",
  committed: "committet",
  deployed: "veröffentlicht",
  "Release notes are written in English.": "Die Versionshinweise sind auf Englisch.",
  About: "Über",
  "What airrates is, which version is running, and what has changed recently.":
    "Was airrates ist, welche Version läuft und was sich zuletzt geändert hat.",
  "About airrates": "Über airrates",
  "airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.":
    "airrates ist ein Funding-Rate-Screener für Perpetual Futures. Es liest das Funding jede Minute aus der öffentlichen API jeder Börse und zeigt, wo du mit demselben Asset Long auf einer Börse und Short auf einer anderen die Differenz zwischen ihren Raten kassierst – und was das tatsächlich gebracht hat.",
  "This version": "Diese Version",
  "Recent changes": "Letzte Änderungen",

  // web/legal.ts, web/tos.ts
  "This page is available in English only. The English text is the binding version.":
    "Diese Seite gibt es nur auf Englisch. Maßgeblich ist der englische Text.",

  // web/referral-links.ts
  "<b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. {link}":
    "<b>Hinweis.</b> airrates kann eine Provision erhalten, wenn du über einen Link auf dieser Seite ein Konto eröffnest – ohne Mehrkosten für dich. Empfehlungslinks beeinflussen nie, welche Märkte erscheinen oder wie sie gereiht werden. Ein Eintrag hier ist keine Empfehlung: Prüfe vor der Registrierung, ob die Börse in deinem Land verfügbar ist, und denk daran, dass Perpetual Futures gehebelt sind und du mehr als deine Margin verlieren kannst. {link}",
  "How referral links work": "So funktionieren Empfehlungslinks",
  "No referral links yet.": "Noch keine Empfehlungslinks.",
  "Referral links are not shown in your location.":
    "Empfehlungslinks werden an deinem Standort nicht angezeigt.",
  "None of these exchanges' referral links can be shown in your location.":
    "Keiner der Empfehlungslinks dieser Börsen kann an deinem Standort angezeigt werden.",
  "The link applies the referral itself": "Der Link setzt die Empfehlung selbst",
  Exchange: "Börse",
  Type: "Typ",
  "Referral code": "Empfehlungscode",
  "Sign up": "Registrieren",
  "{count} more exchange's link is not available in your location.":
    "Weitere Börsen ohne Link an deinem Standort: {count}.",
  "{count} more exchanges' links are not available in your location.":
    "Weitere Börsen ohne Link an deinem Standort: {count}.",
  "Referral links": "Empfehlungslinks",
  "Referral links for the exchanges airrates tracks, for readers opening a new account.":
    "Empfehlungslinks für die Börsen, die airrates verfolgt – für alle, die ein neues Konto eröffnen.",
  "The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.":
    "Die Börsen, für die airrates einen Empfehlungslink hat. Wenn du dort noch kein Konto hast, kannst du es über den Link eröffnen.",

  // web/referral.ts
  "How this works": "So funktioniert das",
  "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "Empfehlungslink: Code {code}. airrates kann eine Provision erhalten, wenn du dich darüber registrierst – ohne Kosten für dich. {how}",
  "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "Empfehlungslink: airrates kann eine Provision erhalten, wenn du dich darüber registrierst – ohne Kosten für dich. {how}",
  "Open a {venue} account": "Konto bei {venue} eröffnen",

  // web/install.ts
  "Install the app": "App installieren",
  "Install airrates": "airrates installieren",
  "Opens in its own window, from your home screen.":
    "Öffnet sich in einem eigenen Fenster, direkt vom Startbildschirm.",
  "Install app": "App installieren",
  "Not now": "Nicht jetzt",

  // web/share.ts
  "Share the chart in view as an image sized for X":
    "Den angezeigten Chart als Bild im Format für X teilen",
  chart: "Chart",
  "Quote this page's best line, with a link back to it":
    "Die beste Zeile dieser Seite zitieren, mit Link zurück",
  cite: "zitieren",
  "No chart on this view": "In dieser Ansicht gibt es keinen Chart",
  close: "schließen",
  Copied: "Kopiert",
  "Select + copy": "Markieren + kopieren",
  "Cite this page": "Diese Seite zitieren",
  "Pick the line · the page's own numbers, as they read now":
    "Zeile wählen · die Zahlen der Seite, so wie sie gerade stehen",
  "Your post · edit it freely": "Dein Post · frei bearbeitbar",
  "Back-link · this exact page, venue and filters":
    "Rücklink · genau diese Seite, Börse und Filter",
  Copy: "Kopieren",
  "Post on X": "Auf X posten",
  "Copy line + link": "Zeile + Link kopieren",
  "Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: {stamp}. Not financial advice.":
    "Zitiere die Zahl und verlinke, wo sie stand. Das Funding ändert sich jede Minute, deshalb sagt die Zeile, wann sie galt: {stamp}. Keine Anlageberatung.",
  "{count} characters left with the link": "Zeichen übrig mit Link: {count}",
  "+{count} more": "+{count}",
  "public venue APIs · not financial advice": "öffentliche Börsen-APIs · keine Anlageberatung",
  "Share your line": "Deine Zeile teilen",
  "chart image": "Chart-Bild",
  "Image · 1600 × 900, X's own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.":
    "Bild · 1600 × 900, das 16:9 von X selbst — erscheint ungeschnitten in der Timeline. Zum Speichern Rechtsklick oder lange drücken.",
  "Copy image": "Bild kopieren",
  "Download PNG": "PNG herunterladen",
  "Link · this exact view": "Link · genau diese Ansicht",
  "Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues', the call is yours.":
    "Kopiere das Bild, tippe auf Auf X posten und füge es in den Post ein. Das Bild trägt die Adresse, von der es stammt; der Link öffnet dieselbe Ansicht. Wir geben nie eine Richtung vor — die Zahlen sind die der Börsen, die Entscheidung ist deine.",
  "the image could not be drawn in this browser":
    "das Bild konnte in diesem Browser nicht gezeichnet werden",
  "Copy blocked — download instead": "Kopieren blockiert — stattdessen herunterladen",

  // web/await.ts
  "Building report": "Bericht wird erstellt",
  "Still building": "Wird noch erstellt",

  // web/tabs.ts
  Sections: "Bereiche",

  // web/glossary.ts (and its entry in the footer menu and the shortcut map)
  terminology: "Begriffe",
  Terminology: "Begriffe",
  "Order flow": "Orderflow",
  "Aggressive buying minus aggressive selling.": "Aggressive Käufe minus aggressive Verkäufe.",
  "cumulative volume delta": "kumuliertes Volumendelta",
  "Delta added up through the session.": "Das über die Sitzung aufsummierte Delta.",
  'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.':
    'Auf der Seite <a href="/chart">Chart</a>, Spot und Futures getrennt, über die Börsen summiert.',
  Imbalance: "Ungleichgewicht",
  "One side trading 3x or more the other at a price.":
    "Eine Seite handelt auf einem Preis 3x oder mehr als die andere.",
  Absorption: "Absorption",
  "Heavy aggression, no progress.": "Viel Aggression, kein Fortschritt.",
  'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.':
    'Zu lesen im Tab Quoten der Seite <a href="/liquidations#odds">Liquidationen</a>, als Initiative vs. Absorption.',
  "Volume profile": "Volumenprofil",
  "volume point of control": "Volume Point of Control",
  "The price with the most volume.": "Der Preis mit dem meisten Volumen.",
  "Value area": "Value Area",
  "Where 70% of the volume traded.": "Wo 70% des Volumens gehandelt wurden.",
  "low-volume node": "Low-Volume-Node",
  "A thin price the market moved through fast.":
    "Ein dünn gehandelter Preis, den der Markt schnell durchlaufen hat.",
  "Single prints": "Single Prints",
  "A zone only one 30-minute period traded.":
    "Eine Zone, die nur in einer 30-Minuten-Periode gehandelt wurde.",
  // web/glossary.ts: the terms added 2026-11-10 beside the owner's first eight
  "Delta (order flow)": "Delta (Orderflow)",
  Initiative: "Initiative",
  "Aggression that moves price; the opposite of absorption.":
    "Aggression, die den Preis bewegt; das Gegenteil von Absorption.",
  "Taker flow": "Taker-Flow",
  "The trades CVD is added up from, buys against sells.":
    "Die Trades, aus denen das CVD aufsummiert wird, Käufe gegen Verkäufe.",
  "Options and gamma": "Optionen und Gamma",
  "gamma exposure": "Gamma-Exposure",
  "How much dealers must buy or sell for each 1% move.":
    "Wie viel die Dealer bei jeder Bewegung um 1% kaufen oder verkaufen müssen.",
  'Shown on the <a href="/rates#gamma">Rates</a> page’s Gamma Exposure tab, and told as it moves by the market narrator at the top of every page.':
    'Im Tab Gamma-Exposure der Seite <a href="/rates#gamma">Raten</a>, und vom Markt-Erzähler oben auf jeder Seite kommentiert, sobald es sich bewegt.',
  "The price where dealers' net gamma changes sign.":
    "Der Preis, bei dem das Netto-Gamma der Dealer das Vorzeichen wechselt.",
  'Marked on the <a href="/rates#gamma">Gamma Exposure</a> tab, and the line the market narrator reads every price against.':
    'Markiert im Tab <a href="/rates#gamma">Gamma-Exposure</a>, und die Linie, an der der Markt-Erzähler jeden Preis misst.',
  "Long / short gamma": "Long / Short Gamma",
  "Long: dealers' hedging sells rises and buys dips, damping moves. Short: it chases price, adding to moves.":
    "Long: Das Hedging der Dealer verkauft Anstiege und kauft Rücksetzer und dämpft so die Bewegungen. Short: Es läuft dem Preis hinterher und verstärkt die Bewegungen.",
  'Shaded in the zones view of the <a href="/rates#gamma">Gamma Exposure</a> tab.':
    'Schattiert in der Zonenansicht des Tabs <a href="/rates#gamma">Gamma-Exposure</a>.',
  "The strike holding the most call or put gamma; it tends to cap or floor price.":
    "Der Strike mit dem meisten Call- oder Put-Gamma; er wirkt oft als Deckel oder Boden für den Preis.",
  'Shown on the <a href="/rates#gamma">Gamma Exposure</a> tab and in every market narrator line.':
    'Im Tab <a href="/rates#gamma">Gamma-Exposure</a> und in jeder Zeile des Markt-Erzählers.',
  "Delta (options)": "Delta (Optionen)",
  "How much an option's price moves per point of the underlying.":
    "Wie stark sich der Preis einer Option pro Punkt des Basiswerts bewegt.",
  'By strike on the <a href="/rates#delta">Rates</a> page’s Delta tab.':
    'Nach Strike im Tab Delta der Seite <a href="/rates#delta">Raten</a>.',
  "How much an option's price moves per point of implied volatility.":
    "Wie stark sich der Preis einer Option pro Punkt impliziter Volatilität bewegt.",
  'By strike on the <a href="/rates#vega">Rates</a> page’s Vega tab.':
    'Nach Strike im Tab Vega der Seite <a href="/rates#vega">Raten</a>.',
  "What an option loses in value each day as expiry nears.":
    "Was eine Option jeden Tag an Wert verliert, je näher der Verfall rückt.",
  'By strike on the <a href="/rates#theta">Rates</a> page’s Theta tab.':
    'Nach Strike im Tab Theta der Seite <a href="/rates#theta">Raten</a>.',
  "implied volatility": "implizite Volatilität",
  "The size of move the option prices expect, per year.":
    "Die Größe der Bewegung, die die Optionspreise erwarten, pro Jahr.",
  'Drawn as walls on the <a href="/rates#ivwalls">Rates</a> page’s IV Walls tab.':
    'Als Wände gezeichnet im Tab IV-Wände der Seite <a href="/rates#ivwalls">Raten</a>.',
  "1σ move": "1σ-Bewegung",
  "The day's expected move from the options: one standard deviation either side.":
    "Die von den Optionen erwartete Tagesbewegung: eine Standardabweichung in jede Richtung.",
  'The IV walls on the <a href="/rates#ivwalls">Rates</a> page, and the IV move on <a href="/whales">Whales</a>.':
    'Die IV-Wände auf der Seite <a href="/rates#ivwalls">Raten</a> und die IV-Bewegung auf <a href="/whales">Wale</a>.',
  "The strike where option buyers lose the most at expiry.":
    "Der Strike, bei dem Optionskäufer zum Verfall am meisten verlieren.",
  'Marked on the <a href="/rates#levels">Rates</a> page’s Ceiling &amp; Floor tab.':
    'Markiert im Tab Decke &amp; Boden der Seite <a href="/rates#levels">Raten</a>.',
  "Reaction zone": "Reaktionszone",
  "Where an IV wall and a gamma wall line up.":
    "Wo eine IV-Wand und eine Gamma-Wand zusammenfallen.",
  'In full on the <a href="/rates#ivwalls">IV Walls</a> and <a href="/rates#levels">Ceiling &amp; Floor</a> tabs, folded on the other option tabs.':
    'Vollständig in den Tabs <a href="/rates#ivwalls">IV-Wände</a> und <a href="/rates#levels">Decke &amp; Boden</a>, eingeklappt in den anderen Options-Tabs.',
  "Funding and perps": "Funding und Perps",
  "Funding rate": "Funding-Rate",
  "What longs pay shorts, or shorts pay longs, to keep a perp near spot.":
    "Was Longs an Shorts zahlen oder Shorts an Longs, damit ein Perp nah am Spot bleibt.",
  'Every exchange side by side on the <a href="/rates">Rates</a> page.':
    'Alle Börsen nebeneinander auf der Seite <a href="/rates">Raten</a>.',
  "annual percentage rate": "effektiver Jahreszins",
  "A funding rate scaled to a year, so different settlement intervals compare.":
    "Eine Funding-Rate auf ein Jahr hochgerechnet, damit sich verschiedene Abrechnungsintervalle vergleichen lassen.",
  'The unit the <a href="/screener">Screener</a> shows by default.':
    'Die Einheit, die der <a href="/screener">Screener</a> standardmäßig zeigt.',
  "Settlement interval": "Abrechnungsintervall",
  "How often funding is paid: every 1, 4 or 8 hours.":
    "Wie oft Funding gezahlt wird: alle 1, 4 oder 8 Stunden.",
  'In each leg of a <a href="/screener">Screener</a> row.':
    'In jedem Leg einer Zeile im <a href="/screener">Screener</a>.',
  "Funding spread / carry": "Funding-Spread / Carry",
  "Long where funding is cheap, short where it is rich, and collect the gap.":
    "Long, wo das Funding günstig ist, Short, wo es teuer ist, und die Differenz kassieren.",
  'The pairs the <a href="/">home page</a> and the <a href="/screener">Screener</a> rank.':
    'Die Paare, die die <a href="/">Startseite</a> und der <a href="/screener">Screener</a> reihen.',
  "Contracts still open: money in the market, not traded volume.":
    "Noch offene Kontrakte: Geld im Markt, kein gehandeltes Volumen.",
  'In each leg of a <a href="/screener">Screener</a> row, and per asset on the <a href="/chart">Chart</a> page.':
    'In jedem Leg einer Zeile im <a href="/screener">Screener</a> und pro Asset auf der Seite <a href="/chart">Chart</a>.',
  "A perp or future's price minus spot.": "Der Preis eines Perps oder Futures minus Spot.",
  "Mark / index price": "Mark- / Indexpreis",
  "Mark is the price used for liquidations; index is the spot average it tracks.":
    "Der Mark-Preis ist der Preis für Liquidationen; der Index ist der Spot-Durchschnitt, dem er folgt.",
  'Each pair’s page, opened from a row on <a href="/arbitrage">Arbitrage</a>, charts the mark prices hourly.':
    'Die Seite jedes Paares, geöffnet über eine Zeile in <a href="/arbitrage">Arbitrage</a>, zeigt die Mark-Preise stündlich im Chart.',
  "Taker / maker": "Taker / Maker",
  "A taker crosses the spread and pays the higher fee; a maker rests an order and waits.":
    "Ein Taker überquert den Spread und zahlt die höhere Gebühr; ein Maker legt eine Order ins Buch und wartet.",
  'The <a href="/markets">Exchanges</a> page prices a $10k market order with each exchange’s taker fee.':
    'Die Seite <a href="/markets">Börsen</a> rechnet eine Market-Order über $10k mit der Taker-Gebühr jeder Börse.',
  "Liquidations and whales": "Liquidationen und Wale",
  Liquidation: "Liquidation",
  "A position the exchange closes because its margin ran out.":
    "Eine Position, die die Börse schließt, weil die Margin aufgebraucht ist.",
  'Every exchange’s, live, on the <a href="/liquidations">Liquidations</a> page.':
    'Die aller Börsen, live, auf der Seite <a href="/liquidations">Liquidationen</a>.',
  "Whale order": "Wal-Order",
  "A resting order big enough to show on the depth chart.":
    "Eine liegende Order, groß genug, um im Tiefenchart aufzutauchen.",
  'Binance walls and Hyperliquid whale orders on the <a href="/whales">Whales</a> page.':
    'Binance-Wände und Hyperliquid-Wal-Orders auf der Seite <a href="/whales">Wale</a>.',
  "The site's terms in one line each: order flow, the volume profile, options and gamma, funding and perps, liquidations and whales.":
    "Die Begriffe der Seite in je einer Zeile: Orderflow, Volumenprofil, Optionen und Gamma, Funding und Perps, Liquidationen und Wale.",
  "The words the site uses, each in one line: order flow, the volume profile, options and gamma, funding, liquidations. Every term has its own link to share: /glossary#cvd opens this page at CVD.":
    "Die Wörter, die die Seite verwendet, je in einer Zeile: Orderflow, Volumenprofil, Optionen und Gamma, Funding, Liquidationen. Jeder Begriff hat einen eigenen Link zum Teilen: /glossary#cvd öffnet diese Seite bei CVD.",
  "Crypto derivatives glossary: funding, liquidations, options":
    "Glossar für Krypto-Derivate: Funding, Liquidationen, Optionen",
};
