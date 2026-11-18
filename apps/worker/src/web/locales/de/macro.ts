import type { Catalog } from "../../i18n";

/**
 * The Rates page's macro tabs (web/macro.ts) and the macro charts' readout words (web/slot-chart.ts),
 * in German. Glossary and style: ./index.ts.
 *
 * Terms, as German market media write them: die Fed, FOMC, Fed Funds, target range Zielspanne,
 * effective rate effektiver Satz, interest on reserves Zinsen auf Reserven (IORB), midpoint Mitte,
 * cut / hold / hike Senkung / Pause / Erhöhung, policy rate Leitzins, balance sheet Bilanz, SEP, Dot
 * Plot, Treasuries, yield Rendite, yield curve Zinskurve, inverted invertiert, real yield
 * Realrendite, breakeven Breakeven-Inflation, TIPS, Reverse Repo, net liquidity Nettoliquidität, on the
 * month zum Vormonat, year on year zum Vorjahr, annualized annualisiert, core Kern, print
 * Veröffentlichung, payrolls Payrolls, unemployment rate Arbeitslosenquote, jobless claims Anträge auf
 * Arbeitslosenhilfe, job openings offene Stellen, average hourly earnings Stundenlöhne, Sahm rule
 * Sahm-Regel, retail sales Einzelhandelsumsätze, industrial production Industrieproduktion, recession
 * Rezession, odds Quoten, middle estimate mittlere Schätzung, pp Pp., bp bps, Commitments of Traders
 * (COT), Dealer, asset managers Vermögensverwalter, leveraged funds gehebelte Fonds, Managed Money,
 * producers and merchants Produzenten und Händler, Swap-Dealer, net netto, 3-year rank 3-Jahres-Rang,
 * Stablecoin, supply Angebot, GDP BIP, CPI CPI (the US index; Verbraucherpreisindex in the prose that
 * introduces it), crowd Crowd, Smart Money, prediction-market settlement Fälligkeit. Agency names stay
 * as written: BLS, BEA, FRED, CFTC, CME, Kalshi, DefiLlama, GDPNow, NFCI, M2, SOFR, JOLTS, E-mini, VIX.
 */
export const macro: Catalog = {
  // The tab bar.
  "Inflation (CPI)": "Inflation (CPI)",
  CPI: "CPI",
  "Fed policy": "Fed-Politik",
  Fed: "Fed",
  Employment: "Beschäftigung",
  Jobs: "Jobs",
  Growth: "Wachstum",
  "Policy signals": "Geldpolitische Signale",
  Signals: "Signale",
  "Positioning and flows": "Positionierung und Flows",
  Flows: "Flows",

  // Units, dates and the chart frame. "{n} pp" and "{n} bp" are suffixes after a signed figure.
  "{n} pp": "{n} Pp.",
  "{n} bp": "{n} bps",
  "{month} {year}": "{month} {year}",
  "Q{q} {year}": "Q{q} {year}",
  "in {time}": "in {time}",
  "hover or tap the chart to read any point":
    "mit der Maus über den Chart fahren oder tippen, um jeden Punkt abzulesen",
  "{chart}; arrow keys read one point at a time": "{chart}; Pfeiltasten lesen Punkt für Punkt",

  // The release calendar.
  "PCE prices": "PCE-Preise",
  "Jobs report": "Arbeitsmarktbericht",
  "Jobless claims": "Anträge auf Arbeitslosenhilfe",
  "Job openings (JOLTS)": "Offene Stellen (JOLTS)",
  GDP: "BIP",
  "Retail sales": "Einzelhandelsumsätze",
  "Industrial production": "Industrieproduktion",
  "FOMC decision": "FOMC-Entscheid",
  "Coming up": "Demnächst",

  // Kalshi's ladders and the footnotes.
  "below {value}": "unter {value}",
  "above {value}": "über {value}",
  "middle estimate {value}": "mittlere Schätzung {value}",
  "Not updated since {ago}: the latest reads of these sources failed, so the figures are that old.":
    "Seit {ago} nicht aktualisiert: Die letzten Abrufe dieser Quellen sind fehlgeschlagen, die Zahlen sind also so alt.",
  "{sources} Last read {ago}.": "{sources} Zuletzt gelesen {ago}.",

  // Inflation.
  "No inflation figures have been read yet.": "Noch keine Inflationsdaten gelesen.",
  "CPI, year on year": "CPI zum Vorjahr",
  "{month}: {mom} on the month · core {core}": "{month}: {mom} zum Vormonat · Kern {core}",
  "Core PCE, year on year": "Kern-PCE zum Vorjahr",
  "{month} · the measure the Fed's 2% target is set in":
    "{month} · das Maß, in dem das 2%-Ziel der Fed festgelegt ist",
  "Next CPI": "Nächster CPI",
  "Kalshi: {headline} on the month, core {core}": "Kalshi: {headline} zum Vormonat, Kern {core}",
  "no date published yet": "noch kein Termin veröffentlicht",
  "5-year breakeven": "5-jährige Breakeven-Inflation",
  "the inflation Treasuries price in · 5y5y forward {fwd}":
    "die in Treasuries eingepreiste Inflation · 5y5y Forward {fwd}",
  "Inflation, year on year": "Inflation zum Vorjahr",
  "Core CPI": "Kern-CPI",
  PCE: "PCE",
  "Core PCE": "Kern-PCE",
  "Fed's 2% target": "2%-Ziel der Fed",
  "Inflation the bond market prices in": "Vom Anleihemarkt eingepreiste Inflation",
  "10-year breakeven": "10-jährige Breakeven-Inflation",
  "5y5y forward": "5y5y Forward",
  "Breakeven: the gap between a nominal Treasury's yield and an inflation-protected one's of the same term. Weekly, each week's last close.":
    "Breakeven: die Differenz zwischen der Rendite einer nominalen Treasury und der einer inflationsgeschützten gleicher Laufzeit. Wöchentlich, jeweils der letzte Schlusskurs der Woche.",
  "Latest prints": "Letzte Veröffentlichungen",
  Measure: "Maß",
  Month: "Monat",
  "On the month": "Zum Vormonat",
  "3 months, annualized": "3 Monate, annualisiert",
  "6 months, annualized": "6 Monate, annualisiert",
  "Year on year": "Zum Vorjahr",
  "A year earlier": "Ein Jahr zuvor",
  "CPI, on the month": "CPI zum Vormonat",
  "Core CPI, on the month": "Kern-CPI zum Vormonat",
  Inflation: "Inflation",
  "CPI is the Bureau of Labor Statistics' consumer price index, published monthly; core leaves out food and energy. PCE is the Bureau of Economic Analysis' price index for personal consumption, published about two weeks after CPI; the Fed's 2% target is set in it, and core PCE is the figure it watches most.":
    "Der CPI ist der Verbraucherpreisindex des Bureau of Labor Statistics (BLS), monatlich veröffentlicht; der Kern lässt Lebensmittel und Energie außen vor. Der PCE ist der Preisindex für den privaten Konsum des Bureau of Economic Analysis (BEA), etwa zwei Wochen nach dem CPI veröffentlicht; in ihm ist das 2%-Ziel der Fed festgelegt, und der Kern-PCE ist die Zahl, auf die sie am meisten achtet.",
  "The changes are worked out here from the seasonally adjusted indexes: on the month, over three and six months annualized (the recent pace, which the year-on-year figure is slow to show), and on the year.":
    "Die Veränderungen werden hier aus den saisonbereinigten Indizes berechnet: zum Vormonat, über drei und sechs Monate annualisiert (das jüngste Tempo, das die Vorjahreszahl erst spät zeigt) und zum Vorjahr.",
  "The breakevens are the inflation the Treasury market prices in, from the Fed's daily yields: 5-year and 10-year, and the 5-year rate starting five years from now (5y5y), which the Fed reads as long-run expectations.":
    "Die Breakeven-Inflation ist die vom Treasury-Markt eingepreiste Inflation, aus den täglichen Renditen der Fed: 5- und 10-jährig sowie der 5-Jahres-Satz, der in fünf Jahren beginnt (5y5y), den die Fed als langfristige Erwartung liest.",
  "Kalshi, a CFTC-regulated exchange, lists contracts that pay if the next print is above a level. Their prices read as the market's chances; the middle estimate is where the chance of above crosses one half.":
    "Kalshi, eine von der CFTC regulierte Börse, listet Kontrakte, die auszahlen, wenn die nächste Veröffentlichung über einem Niveau liegt. Ihre Preise lesen sich als die Chancen des Markts; die mittlere Schätzung ist dort, wo die Chance auf „darüber“ die Hälfte kreuzt.",
  "What Kalshi's traders expect": "Was die Trader bei Kalshi erwarten",
  "Sources: BLS and BEA through FRED; breakevens from the Fed's Treasury yields; odds from Kalshi.":
    "Quellen: BLS und BEA über FRED; Breakeven aus den Treasury-Renditen der Fed; Quoten von Kalshi.",

  // Fed policy.
  "cut more than 25 bp": "Senkung um mehr als 25 bps",
  "cut 25 bp": "Senkung um 25 bps",
  hold: "Pause",
  "hike 25 bp": "Erhöhung um 25 bps",
  "hike more than 25 bp": "Erhöhung um mehr als 25 bps",
  "No Fed policy figures have been read yet.": "Noch keine Daten zur Fed-Politik gelesen.",
  "Target range": "Zielspanne",
  "effective {effr} · SOFR {sofr} · interest on reserves {iorb}":
    "effektiv {effr} · SOFR {sofr} · Zinsen auf Reserven {iorb}",
  "Next FOMC decision": "Nächster FOMC-Entscheid",
  "with projections": "mit Projektionen",
  "Kalshi: {outcome} {p}": "Kalshi: {outcome} {p}",
  "Rate path the market prices": "Vom Markt eingepreister Zinspfad",
  "midpoint after {meeting}: {move} from today's {mid}":
    "Mitte nach {meeting}: {move} gegenüber heute {mid}",
  "no Kalshi odds read yet": "noch keine Kalshi-Quoten gelesen",
  "Fed balance sheet": "Fed-Bilanz",
  "{change} over four weeks · week of {date}": "{change} über vier Wochen · Woche vom {date}",
  "A meeting with a Summary of Economic Projections":
    "Eine Sitzung mit Summary of Economic Projections (SEP)",
  SEP: "SEP",
  "Each meeting's odds, from Kalshi": "Die Quoten jeder Sitzung, von Kalshi",
  Meeting: "Sitzung",
  "Cut &gt;25": "Senkung &gt;25",
  "Cut 25": "Senkung 25",
  Hold: "Pause",
  "Hike 25": "Erhöhung 25",
  "Hike &gt;25": "Erhöhung &gt;25",
  "Each outcome's move times its chance, added up":
    "Die Bewegung jedes Ausgangs mal seine Chance, aufsummiert",
  "Expected move": "Erwartete Bewegung",
  "Today's midpoint plus every expected move to this meeting":
    "Die heutige Mitte plus jede erwartete Bewegung bis zu dieser Sitzung",
  "Implied midpoint": "Implizite Mitte",
  "The Fed's own projections": "Die eigenen Projektionen der Fed",
  "Median, end of year": "Median, Jahresende",
  "Longer run": "Langfristig",
  "Fed funds rate": "Fed-Funds-Satz",
  "PCE inflation": "PCE-Inflation",
  "Core PCE inflation": "Kern-PCE-Inflation",
  "Unemployment rate": "Arbeitslosenquote",
  "Real GDP growth": "Reales BIP-Wachstum",
  "From the Summary of Economic Projections of {date}: the median of the committee's forecasts (the dot plot's middle dot for the rate). Inflation and growth are fourth quarter on fourth quarter; unemployment is the fourth quarter's average.":
    "Aus der Summary of Economic Projections vom {date}: der Median der Prognosen des Ausschusses (für den Zins der mittlere Punkt des Dot Plots). Inflation und Wachstum sind viertes Quartal gegen viertes Quartal; die Arbeitslosigkeit ist der Durchschnitt des vierten Quartals.",
  "Policy rate": "Leitzins",
  "Top of the range": "Obergrenze der Spanne",
  "Bottom of the range": "Untergrenze der Spanne",
  "Effective rate": "Effektiver Satz",
  "Fed balance sheet, total assets": "Fed-Bilanz, Gesamtvermögen",
  "Total assets": "Gesamtvermögen",
  "The target range is the Federal Open Market Committee's range for the federal funds rate; the effective rate is where overnight fed funds actually trade, SOFR is the overnight Treasury repo rate, and interest on reserves is what the Fed pays banks, which holds the effective rate inside the range.":
    "Die Zielspanne ist die Spanne des Federal Open Market Committee (FOMC) für den Fed-Funds-Satz; der effektive Satz ist, wo Overnight-Fed-Funds tatsächlich gehandelt werden, SOFR ist der Overnight-Repo-Satz für Treasuries, und die Zinsen auf Reserven zahlt die Fed den Banken, was den effektiven Satz in der Spanne hält.",
  "The odds are Kalshi's: for each meeting, contracts that pay on a cut of more than 25 basis points, a 25 bp cut, a hold, a 25 bp hike or a larger hike. Each meeting's prices are scaled to add up to 100%. The expected move is each outcome's size times its chance; the implied midpoint adds every expected move from today's midpoint, a path in the way CME's FedWatch draws one from fed funds futures.":
    "Die Quoten stammen von Kalshi: für jede Sitzung Kontrakte, die bei einer Senkung um mehr als 25 Basispunkte, einer Senkung um 25 bps, einer Pause, einer Erhöhung um 25 bps oder einer größeren Erhöhung auszahlen. Die Preise jeder Sitzung werden so skaliert, dass sie 100% ergeben. Die erwartete Bewegung ist die Größe jedes Ausgangs mal seine Chance; die implizite Mitte addiert jede erwartete Bewegung zur heutigen Mitte, ein Pfad, wie ihn FedWatch der CME aus Fed-Funds-Futures zeichnet.",
  "The projections are the committee's own, published four times a year with the meeting's statement; the dot plot is each member's view of where the rate should be at the end of each year.":
    "Die Projektionen sind die des Ausschusses selbst, viermal im Jahr mit dem Statement der Sitzung veröffentlicht; der Dot Plot zeigt, wo jedes Mitglied den Zins am Ende jedes Jahres sieht.",
  "The balance sheet is the Fed's total assets, weekly, as of Wednesday. It grows when the Fed buys bonds and shrinks as they run off.":
    "Die Bilanz ist das Gesamtvermögen der Fed, wöchentlich, Stand Mittwoch. Sie wächst, wenn die Fed Anleihen kauft, und schrumpft, wenn diese auslaufen.",
  "Sources: the Federal Reserve and the New York Fed through FRED; the FOMC calendar from the Federal Reserve; odds from Kalshi.":
    "Quellen: die Federal Reserve und die New York Fed über FRED; der FOMC-Kalender von der Federal Reserve; Quoten von Kalshi.",

  // Employment.
  "No employment figures have been read yet.": "Noch keine Arbeitsmarktdaten gelesen.",
  "Payrolls, {month}": "Payrolls, {month}",
  "jobs added on the month · three-month average {avg}":
    "neue Stellen im Monat · Dreimonatsschnitt {avg}",
  "{month} · Sahm rule {sahm} (a recession signal from 0.50)":
    "{month} · Sahm-Regel {sahm} (ein Rezessionssignal ab 0.50)",
  "Initial jobless claims": "Erstanträge auf Arbeitslosenhilfe",
  "week to {date} · four-week average {avg} · continuing {cont}":
    "Woche bis {date} · Vierwochenschnitt {avg} · Folgeanträge {cont}",
  "Next jobs report": "Nächster Arbeitsmarktbericht",
  "Kalshi: payrolls {pay}, unemployment {u}": "Kalshi: Payrolls {pay}, Arbeitslosigkeit {u}",
  "Jobs added each month": "Neue Stellen pro Monat",
  "Payrolls, change on the month": "Payrolls, Veränderung zum Vormonat",
  "Three-month average": "Dreimonatsschnitt",
  "Nonfarm payrolls, thousands, seasonally adjusted. The latest two months are revised with each report.":
    "Nonfarm Payrolls, in Tausend, saisonbereinigt. Die letzten beiden Monate werden mit jedem Bericht revidiert.",
  "The Sahm rule is the three-month average unemployment rate less its low of the past twelve months, in percentage points; every US recession since 1970 began with it at 0.50 or more. A gap is a month with no household survey.":
    "Die Sahm-Regel ist die durchschnittliche Arbeitslosenquote der letzten drei Monate minus ihr Tief der vergangenen zwölf Monate, in Prozentpunkten; jede US-Rezession seit 1970 begann mit einem Wert von 0.50 oder mehr. Eine Lücke ist ein Monat ohne Haushaltsbefragung.",
  "Initial claims": "Erstanträge",
  "Four-week average": "Vierwochenschnitt",
  "Latest figures": "Neueste Zahlen",
  Latest: "Neueste",
  Context: "Kontext",
  "Average hourly earnings": "Durchschnittliche Stundenlöhne",
  "{month}, year on year · {mom} on the month": "{month}, zum Vorjahr · {mom} zum Vormonat",
  "Job openings": "Offene Stellen",
  "{month} · {before} a year earlier": "{month} · {before} ein Jahr zuvor",
  "Continuing claims": "Folgeanträge",
  "week to {date}": "Woche bis {date}",
  Payrolls: "Payrolls",
  "Payrolls and the unemployment rate come from the Bureau of Labor Statistics' monthly jobs report, usually the first Friday of the month: payrolls from a survey of employers, unemployment from a survey of households. Jobless claims are the Labor Department's weekly count of new filings for unemployment insurance, the most timely read on layoffs.":
    "Payrolls und Arbeitslosenquote stammen aus dem monatlichen Arbeitsmarktbericht des Bureau of Labor Statistics (BLS), meist am ersten Freitag des Monats: die Payrolls aus einer Befragung der Arbeitgeber, die Arbeitslosigkeit aus einer Befragung der Haushalte. Die Anträge auf Arbeitslosenhilfe sind die wöchentliche Zählung neuer Anträge durch das Arbeitsministerium, das aktuellste Signal für Entlassungen.",
  "Job openings are from the JOLTS survey, a month behind the jobs report. Average hourly earnings are private employers' pay, a gauge of wage inflation.":
    "Die offenen Stellen stammen aus der JOLTS-Erhebung, einen Monat hinter dem Arbeitsmarktbericht. Die durchschnittlichen Stundenlöhne sind die Bezahlung privater Arbeitgeber, ein Maß für die Lohninflation.",
  "The odds are Kalshi's contracts on the next report's payrolls and unemployment rate; the middle estimate is where the chance of above crosses one half.":
    "Die Quoten sind die Kalshi-Kontrakte auf Payrolls und Arbeitslosenquote des nächsten Berichts; die mittlere Schätzung ist dort, wo die Chance auf „darüber“ die Hälfte kreuzt.",
  "Sources: BLS and the Labor Department through FRED; odds from Kalshi.":
    "Quellen: BLS und Arbeitsministerium über FRED; Quoten von Kalshi.",

  // Growth.
  "No growth figures have been read yet.": "Noch keine Wachstumsdaten gelesen.",
  "Real GDP, {quarter}": "Reales BIP, {quarter}",
  "on the quarter, annualized · recession probability {p}":
    "zum Vorquartal, annualisiert · Rezessionswahrscheinlichkeit {p}",
  "GDPNow, {quarter}": "GDPNow, {quarter}",
  "the Atlanta Fed's running estimate of the quarter not yet published":
    "die laufende Schätzung der Atlanta Fed für das noch nicht veröffentlichte Quartal",
  "Next GDP estimate": "Nächste BIP-Schätzung",
  "Kalshi: {value} for {quarter}": "Kalshi: {value} für {quarter}",
  "Real GDP growth, annualized": "Reales BIP-Wachstum, annualisiert",
  "Real GDP": "Reales BIP",
  "GDPNow estimate": "GDPNow-Schätzung",
  "Quarter on quarter at an annual rate, as the Bureau of Economic Analysis publishes it; the latest figure is revised twice.":
    "Zum Vorquartal auf Jahresrate hochgerechnet, wie das Bureau of Economic Analysis es veröffentlicht; die neueste Zahl wird zweimal revidiert.",
  "Activity, year on year": "Aktivität zum Vorjahr",
  "Retail sales are in dollars, so they include price rises; industrial production is a volume index.":
    "Die Einzelhandelsumsätze sind in Dollar, enthalten also Preissteigerungen; die Industrieproduktion ist ein Mengenindex.",
  "Real GDP is the Bureau of Economic Analysis' measure of the economy's output after inflation, quarter on quarter at an annual rate. Each quarter is first estimated about a month after it ends and revised twice.":
    "Das reale BIP ist das Maß des Bureau of Economic Analysis (BEA) für die inflationsbereinigte Wirtschaftsleistung, zum Vorquartal auf Jahresrate hochgerechnet. Jedes Quartal wird etwa einen Monat nach seinem Ende erstmals geschätzt und zweimal revidiert.",
  "GDPNow is the Atlanta Fed's model estimate of the quarter not yet published, updated as each month's data come in; it is a model, not a forecast by the Fed.":
    "GDPNow ist die Modellschätzung der Atlanta Fed für das noch nicht veröffentlichte Quartal, aktualisiert, sobald die Daten jedes Monats eintreffen; es ist ein Modell, keine Prognose der Fed.",
  "Industrial production (the Fed's index of factory, mining and utility output) and retail sales (the Census Bureau's) are monthly. The recession probability is the Chauvet and Piger model's, from four monthly indicators, as FRED publishes it.":
    "Industrieproduktion (der Fed-Index für Fabrik-, Bergbau- und Versorgerleistung) und Einzelhandelsumsätze (vom Census Bureau) sind monatlich. Die Rezessionswahrscheinlichkeit stammt aus dem Modell von Chauvet und Piger, aus vier Monatsindikatoren, wie FRED sie veröffentlicht.",
  "The odds are Kalshi's contracts on the next GDP estimate.":
    "Die Quoten sind die Kalshi-Kontrakte auf die nächste BIP-Schätzung.",
  "Sources: BEA, the Federal Reserve, the Census Bureau and the Atlanta Fed through FRED; odds from Kalshi.":
    "Quellen: BEA, Federal Reserve, Census Bureau und Atlanta Fed über FRED; Quoten von Kalshi.",

  // Policy signals.
  "No market signals have been read yet.": "Noch keine Marktsignale gelesen.",
  "2-year yield less fed funds": "2-Jahres-Rendite minus Fed Funds",
  "2-year {two} above the effective rate: the market prices rates higher over two years":
    "2 Jahre {two} über dem effektiven Satz: Der Markt preist in zwei Jahren höhere Zinsen ein",
  "2-year {two} below the effective rate: the market prices cuts over two years":
    "2 Jahre {two} unter dem effektiven Satz: Der Markt preist in zwei Jahren Senkungen ein",
  "Yield curve, 10-year less 2-year": "Zinskurve, 10 Jahre minus 2 Jahre",
  "10-year less 3-month {s} · below zero the curve is inverted":
    "10 Jahre minus 3 Monate {s} · unter null ist die Kurve invertiert",
  "10-year real yield": "10-jährige Realrendite",
  "inflation-protected Treasury · nominal 10-year {ten}":
    "inflationsgeschützte Treasury · nominal 10 Jahre {ten}",
  "Net liquidity": "Nettoliquidität",
  "Fed assets less the Treasury's account and reverse repos":
    "Fed-Vermögen minus Konto des Finanzministeriums und Reverse Repos",
  "{change} over four weeks · Fed assets less the Treasury's account and reverse repos":
    "{change} über vier Wochen · Fed-Vermögen minus Konto des Finanzministeriums und Reverse Repos",
  "Treasury yields": "Treasury-Renditen",
  "3-month": "3 Monate",
  "2-year": "2 Jahre",
  "10-year": "10 Jahre",
  "30-year": "30 Jahre",
  "Yield curve": "Zinskurve",
  "10-year less 2-year": "10 Jahre minus 2 Jahre",
  "10-year less 3-month": "10 Jahre minus 3 Monate",
  "An inverted curve, long yields below short ones, has come before every US recession since the 1970s, often by a year or more; the turn back above zero has often come closer to it.":
    "Eine invertierte Kurve, lange Renditen unter kurzen, ging jeder US-Rezession seit den 1970ern voraus, oft um ein Jahr oder mehr; die Rückkehr über null kam oft näher an sie heran.",
  "The Fed's total assets less the Treasury General Account and the overnight reverse repo facility: a rough count of the dollars the Fed's balance sheet leaves in the market, which many crypto traders watch against prices.":
    "Das Gesamtvermögen der Fed minus Treasury General Account und Overnight-Reverse-Repo-Fazilität: eine grobe Zählung der Dollar, die die Fed-Bilanz im Markt lässt und die viele Krypto-Trader gegen die Kurse beobachten.",
  "Other signals": "Weitere Signale",
  "4 weeks": "4 Wochen",
  "1 year": "1 Jahr",
  Reading: "Stand",
  "Dollar, broad index": "Dollar, breiter Index",
  "the Fed's trade-weighted dollar; a rising dollar tightens conditions worldwide":
    "der handelsgewichtete Dollar der Fed; ein steigender Dollar verschärft die Bedingungen weltweit",
  "Financial conditions (NFCI)": "Finanzierungsbedingungen (NFCI)",
  "below zero: looser than average": "unter null: lockerer als im Schnitt",
  "above zero: tighter than average": "über null: straffer als im Schnitt",
  "Money supply (M2)": "Geldmenge (M2)",
  "{month}, year on year": "{month}, zum Vorjahr",
  "What the bond market says about policy before the Fed does. The 2-year Treasury yield tracks where traders expect the policy rate over the next two years: well above the effective rate, they expect it higher; well below, they expect cuts.":
    "Was der Anleihemarkt über die Geldpolitik sagt, bevor die Fed es tut. Die Rendite der 2-jährigen Treasury folgt dem Leitzins, den Trader in den nächsten zwei Jahren erwarten: deutlich über dem effektiven Satz erwarten sie ihn höher, deutlich darunter erwarten sie Senkungen.",
  "The yield curve is the 10-year yield less the 2-year, and less the 3-month bill. Real yields are inflation-protected Treasuries' (TIPS); a high real yield is a high cost of holding assets that pay nothing, crypto among them.":
    "Die Zinskurve ist die 10-Jahres-Rendite minus die 2-Jahres-Rendite und minus die der 3-Monats-Bill. Realrenditen sind die inflationsgeschützter Treasuries (TIPS); eine hohe Realrendite bedeutet hohe Kosten für das Halten von Assets, die nichts abwerfen, Krypto eingeschlossen.",
  "Net liquidity is the Fed's balance sheet less the Treasury's cash at the Fed and the reverse repo facility, worked out here from the weekly figures; it is a rule of thumb, not an official measure. The NFCI is the Chicago Fed's index of financial conditions, zero at its long-run average.":
    "Die Nettoliquidität ist die Fed-Bilanz minus das Guthaben des Finanzministeriums bei der Fed und die Reverse-Repo-Fazilität, hier aus den Wochenzahlen berechnet; sie ist eine Faustregel, kein offizielles Maß. Der NFCI ist der Index der Chicago Fed für Finanzierungsbedingungen, null bei seinem langfristigen Durchschnitt.",
  "Sources: Treasury yields, the Federal Reserve and the Chicago Fed through FRED.":
    "Quellen: Treasury-Renditen, Federal Reserve und Chicago Fed über FRED.",

  // Positioning and flows: the futures markets.
  "Bitcoin (CME)": "Bitcoin (CME)",
  "Ether (CME)": "Ether (CME)",
  "S&P 500 E-mini": "S&P 500 E-mini",
  "Nasdaq-100 E-mini": "Nasdaq-100 E-mini",
  "Russell 2000 E-mini": "Russell 2000 E-mini",
  "VIX futures": "VIX-Futures",
  "2-year Treasury note": "2-jährige Treasury Note",
  "10-year Treasury note": "10-jährige Treasury Note",
  "Treasury bond": "Treasury Bond",
  "3-month SOFR": "3-Monats-SOFR",
  "30-day fed funds": "30-Tage-Fed-Funds",
  "US dollar index": "US-Dollar-Index (DXY)",
  Euro: "Euro",
  "Japanese yen": "Japanischer Yen",
  Gold: "Gold",
  Silver: "Silber",
  "WTI crude oil": "Rohöl WTI",
  Copper: "Kupfer",

  // Positioning and flows: the tables, tiles and charts.
  "Leveraged funds": "Gehebelte Fonds",
  "Asset managers": "Vermögensverwalter",
  Dealers: "Dealer",
  "Managed money": "Managed Money",
  "Producers and merchants": "Produzenten und Händler",
  "Swap dealers": "Swap-Dealer",
  "Financial futures: who holds them": "Finanzfutures: wer sie hält",
  "Commodity futures: who holds them": "Rohstofffutures: wer sie hält",
  "{group}, net": "{group}, netto",
  Week: "Woche",
  "Where this week's net sits among the last three years' weeks: 0% the shortest, 100% the longest":
    "Wo das Netto dieser Woche unter den Wochen der letzten drei Jahre liegt: 0% am meisten short, 100% am meisten long",
  "3-year rank": "3-Jahres-Rang",
  "3 years": "3 Jahre",
  "No positioning data has been read yet.": "Noch keine Positionierungsdaten gelesen.",
  "contracts net, {share} of open interest · 3-year rank {rank} · {other} {otherNet}":
    "Kontrakte netto, {share} des Open Interest · 3-Jahres-Rang {rank} · {other} {otherNet}",
  "Stablecoin supply": "Stablecoin-Angebot",
  "{d30} in 30 days · {d90} in 90 days": "{d30} in 30 Tagen · {d90} in 90 Tagen",
  "CME Bitcoin, leveraged funds": "CME-Bitcoin, gehebelte Fonds",
  "asset managers": "Vermögensverwalter",
  "CME Ether, leveraged funds": "CME-Ether, gehebelte Fonds",
  "Gold, managed money": "Gold, Managed Money",
  producers: "Produzenten",
  "Who holds CME Bitcoin futures": "Wer die Bitcoin-Futures der CME hält",
  "Net contracts (longs less shorts) of five bitcoin each, as of each Tuesday. Leveraged funds are hedge funds and trading firms; much of their short is the futures leg of a cash-and-carry trade against spot ETFs, not a bet on a fall.":
    "Netto-Kontrakte (Longs minus Shorts) zu je fünf Bitcoin, Stand jeden Dienstag. Gehebelte Fonds sind Hedgefonds und Tradingfirmen; ein Großteil ihres Shorts ist das Futures-Leg eines Cash-and-Carry-Trades gegen Spot-ETFs, keine Wette auf fallende Kurse.",
  "Dollar stablecoins in circulation": "Dollar-Stablecoins im Umlauf",
  "Every dollar-pegged stablecoin's supply, added up by DefiLlama: dollars already on-chain, the first money to reach crypto prices.":
    "Das Angebot aller an den Dollar gekoppelten Stablecoins, aufsummiert von DefiLlama: Dollar, die schon on-chain sind, das erste Geld, das die Kryptokurse erreicht.",
  "Who actually holds the futures, from the CFTC's weekly Commitments of Traders: positions as of Tuesday, published the Friday after. For financial futures the CFTC splits traders into dealers (the banks that make markets), asset managers (pension funds, insurers, mutual funds: slower, real money) and leveraged funds (hedge funds and trading firms: faster, speculative). For commodities it splits producers and merchants (hedgers), swap dealers and managed money (the speculators).":
    "Wer die Futures tatsächlich hält, aus dem wöchentlichen Commitments of Traders (COT) der CFTC: Positionen Stand Dienstag, veröffentlicht am Freitag darauf. Bei Finanzfutures teilt die CFTC die Trader in Dealer (die Banken, die Märkte stellen), Vermögensverwalter (Pensionsfonds, Versicherer, Investmentfonds: langsamer, echtes Geld) und gehebelte Fonds (Hedgefonds und Tradingfirmen: schneller, spekulativ). Bei Rohstoffen in Produzenten und Händler (Hedger), Swap-Dealer und Managed Money (die Spekulanten).",
  "Net is longs less shorts, in contracts; its share is of the market's open interest. The 3-year rank says where this week's net sits among every week of the last three years: near 0% the speculators are as short as they have been, near 100% as long, which is when positioning tends to unwind.":
    "Netto ist Longs minus Shorts, in Kontrakten; der Anteil bezieht sich auf das Open Interest des Markts. Der 3-Jahres-Rang sagt, wo das Netto dieser Woche unter allen Wochen der letzten drei Jahre liegt: nahe 0% sind die Spekulanten so short wie lange nicht, nahe 100% so long, und dann löst sich die Positionierung oft auf.",
  "Stablecoin supply is the dollars already on-chain, from DefiLlama: when it grows, new money is arriving in crypto.":
    "Das Stablecoin-Angebot sind die Dollar, die schon on-chain sind, laut DefiLlama: Wenn es wächst, kommt neues Geld in Krypto an.",
  "Sources: the CFTC's Commitments of Traders, futures only{date}; DefiLlama for stablecoins.":
    "Quellen: Commitments of Traders der CFTC, nur Futures{date}; DefiLlama für Stablecoins.",
  ", report of {date}": ", Bericht vom {date}",
  "The macro data could not be read right now.":
    "Die Makrodaten konnten gerade nicht gelesen werden.",

  // Chart readout (slot-chart.ts).
  "week of {month} {day}, {year}": "Woche vom {day}. {month} {year}",
  // The Rates page's prediction-market tabs (web/crowd.ts).
  "1d": "1d",
  "1d change": "Veränderung 1d",
  "7d": "7d",
  "Another Fed hike in 2026": "Noch eine Fed-Erhöhung 2026",
  "BTC odds": "BTC-Quoten",
  "BTC: crowd vs options": "BTC: Crowd vs. Optionen",
  "Bitcoin above, {when}": "Bitcoin über, {when}",
  "Bitcoin now": "Bitcoin jetzt",
  Chance: "Chance",
  "Change in the expected move over the last day":
    "Veränderung der erwarteten Bewegung am letzten Tag",
  "Deribit index at the option chain's read": "Deribit-Index beim Abruf der Optionskette",
  "Deribit's option chain: Black-76 with the smile's slope, between the expiries either side":
    "Optionskette von Deribit: Black-76 mit der Steigung des Smiles, zwischen den Verfällen beiderseits",
  "Each FOMC meeting, both venues": "Jede FOMC-Sitzung, beide Plattformen",
  "Each price is the chance the venue's traders give the outcome, its Yes price; a fed meeting's outcomes are scaled to add up to one. Changes are in percentage points against the price a day and a week before. Polymarket is read every 15 minutes and kept hourly for good; Kalshi's odds are the Fed, Jobs and Growth tabs' own.":
    "Jeder Preis ist die Chance, die die Trader der Plattform dem Ausgang geben, sein Ja-Preis; die Ausgänge einer Fed-Sitzung werden so skaliert, dass sie eins ergeben. Veränderungen sind in Prozentpunkten gegenüber dem Preis einen Tag und eine Woche zuvor. Polymarket wird alle 15 Minuten gelesen und stündlich dauerhaft gespeichert; die Kalshi-Quoten sind dieselben wie in den Tabs Fed, Jobs und Wachstum.",
  "Fed cuts in 2026": "Fed-Senkungen 2026",
  "Fed rate at the end of 2026": "Fed-Zins Ende 2026",
  "GDP growth, the quarter": "BIP-Wachstum, das Quartal",
  Gap: "Abstand",
  "How high US unemployment goes in 2026": "Wie hoch die US-Arbeitslosigkeit 2026 steigt",
  "How high inflation gets in 2026": "Wie hoch die Inflation 2026 steigt",
  "How many Fed cuts in 2026": "Wie viele Fed-Senkungen 2026",
  "Kalshi median": "Kalshi-Median",
  "Next settlement": "Nächste Fälligkeit",
  "No Bitcoin ladder has been read yet. The collector reads Polymarket every 15 minutes.":
    "Noch keine Bitcoin-Leiter gelesen. Der Collector liest Polymarket alle 15 Minuten.",
  "No prediction market has been read yet. The collector reads Polymarket every 15 minutes.":
    "Noch kein Prognosemarkt gelesen. Der Collector liest Polymarket alle 15 Minuten.",
  "Percentage points over the last day": "Prozentpunkte am letzten Tag",
  "Percentage points over the last week": "Prozentpunkte in der letzten Woche",
  "Polymarket less options, in percentage points": "Polymarket minus Optionen, in Prozentpunkten",
  "Polymarket median": "Polymarket-Median",
  "Polymarket's change over the last day, in percentage points":
    "Veränderung bei Polymarket am letzten Tag, in Prozentpunkten",
  "Polymarket's ladders settle on Binance's BTC/USDT one-minute close at noon New York. The options column is what Deribit's latest BTC chain implies for the same price and moment: each strike's volatility from the smile, the chance of finishing above it with the smile's slope counted, the total variance read between the expiries either side. A positive gap means Polymarket's crowd gives the price better odds than the options do. Smart $ is what the smart wallets (the leaderboard's most profitable, as on the Prediction markets tab) hold on Yes less what they hold on No.":
    "Die Leitern von Polymarket werden auf den Einminuten-Schlusskurs von BTC/USDT bei Binance um 12 Uhr New Yorker Zeit abgerechnet. Die Optionsspalte ist, was die neueste BTC-Kette von Deribit für denselben Preis und Zeitpunkt impliziert: die Volatilität jedes Strikes aus dem Smile, die Chance, darüber zu schließen, mit der Steigung des Smiles eingerechnet, die Gesamtvarianz zwischen den Verfällen beiderseits. Ein positiver Abstand heißt, die Crowd bei Polymarket gibt dem Preis bessere Chancen als die Optionen. Smart $ ist, was die Smart Wallets (die profitabelsten der Rangliste, wie im Tab Prognosemärkte) auf Ja halten, minus was sie auf Nein halten.",
  "Polymarket's median outcome": "Median-Ausgang bei Polymarket",
  "Prediction markets": "Prognosemärkte",
  Predictions: "Prognosen",
  Print: "Veröffentlichung",
  Settles: "Fällig",
  "The Fed rate at the end of 2026": "Der Fed-Zins Ende 2026",
  "The next prints, both venues": "Die nächsten Veröffentlichungen, beide Plattformen",
  "The outcome bucket where Polymarket's chances, in order, pass one half":
    "Die Ausgangsklasse, in der die Chancen bei Polymarket der Reihe nach die Hälfte überschreiten",
  "The prediction markets could not be read right now.":
    "Die Prognosemärkte konnten gerade nicht gelesen werden.",
  "The year ahead, on Polymarket": "Das kommende Jahr bei Polymarket",
  "US GDP growth in 2026": "US-BIP-Wachstum 2026",
  "US recession": "US-Rezession",
  "Where Kalshi's ladder of above-X chances crosses one half":
    "Wo die Leiter der Über-X-Chancen bei Kalshi die Hälfte kreuzt",
  "Widest gap": "Größter Abstand",
  "above {price} on {date}: the crowd is {side} than the options":
    "über {price} am {date}: Die Crowd ist {side} als die Optionen",
  bp: "bps",
  "by the end of each year": "bis Ende jedes Jahres",
  "crowd median {crowd} · options median {options}":
    "Crowd-Median {crowd} · Options-Median {options}",
  "more bearish": "bärischer",
  "more bullish": "bullischer",
  "no option chain read yet": "noch keine Optionskette gelesen",
  "noon New York": "12 Uhr New York",
  "{change} pp over a week": "{change} Pp. in einer Woche",
  "{n} more outcomes under 1%": "Weitere Ausgänge unter 1%: {n}",
  "Change in the smart share over the last day, in percentage points":
    "Veränderung des Smart-Anteils am letzten Tag, in Prozentpunkten",
  Crowd: "Crowd",
  "Fed, {meeting}": "Fed, {meeting}",
  No: "Nein",
  Question: "Frage",
  "Share of smart $": "Anteil Smart $",
  "Smart $": "Smart $",
  "Smart money backs": "Smart Money setzt auf",
  "Smart money is the {n} wallets with the most profit on Polymarket's own leaderboard in Economics and in Crypto, over the past month or all time. Each market's top 100 holders per outcome are read every hour; a smart wallet holding less than that is not seen. Where smart money and the crowd's price part, one side is wrong, and the smart side has the better record.":
    "Smart Money sind die {n} Wallets mit dem meisten Gewinn auf der eigenen Rangliste von Polymarket in Wirtschaft und Krypto, im letzten Monat oder insgesamt. Die Top 100 Halter je Ausgang jedes Markts werden stündlich gelesen; eine Smart Wallet, die weniger hält, wird nicht gesehen. Wo Smart Money und der Preis der Crowd auseinandergehen, liegt eine Seite falsch, und die Smart-Seite hat die bessere Bilanz.",
  "Smart money on Polymarket": "Smart Money auf Polymarket",
  "That outcome's share of the smart wallets' dollars on the question":
    "Der Anteil dieses Ausgangs an den Dollar der Smart Wallets zur Frage",
  "The crowd's price for that outcome": "Der Preis der Crowd für diesen Ausgang",
  "The smart wallets' dollars on Yes less their dollars on No":
    "Die Dollar der Smart Wallets auf Ja minus ihre Dollar auf Nein",
  Wallets: "Wallets",
  Yes: "Ja",
  // World indexes tab (web/indexes.ts)
  Country: "Land",
  "World indexes": "Weltindizes",
  Indexes: "Indizes",
  India: "Indien",
  Japan: "Japan",
  Korea: "Korea",
  Singapore: "Singapur",
  Australia: "Australien",
  Americas: "Amerika",
  "Middle East": "Naher Osten",
  Canada: "Kanada",
  Brazil: "Brasilien",
  Mexico: "Mexiko",
  Germany: "Deutschland",
  "United Kingdom": "Vereinigtes Königreich",
  France: "Frankreich",
  "Euro area": "Euroraum",
  Netherlands: "Niederlande",
  Spain: "Spanien",
  Italy: "Italien",
  Switzerland: "Schweiz",
  Portugal: "Portugal",
  Belgium: "Belgien",
  Austria: "Österreich",
  Sweden: "Schweden",
  Denmark: "Dänemark",
  Poland: "Polen",
  Turkey: "Türkei",
  Israel: "Israel",
  "Saudi Arabia": "Saudi-Arabien",
  "Hong Kong": "Hongkong",
  China: "China",
  Taiwan: "Taiwan",
  Thailand: "Thailand",
  Indonesia: "Indonesien",
  Philippines: "Philippinen",
  Malaysia: "Malaysia",
  Vietnam: "Vietnam",
  Other: "Sonstige",
  "{n} daily closes, {change}%": "{n} Tagesschlusskurse, {change}%",
  "Its option book on the Gamma Exposure tab": "Sein Optionsbuch im Tab Gamma-Exposure",
  live: "live",
  closing: "Schluss",
  "The index levels could not be read right now.":
    "Die Indexstände konnten gerade nicht gelesen werden.",
  "No index level has been read yet. The collector reads them every five minutes.":
    "Noch kein Indexstand gelesen. Der Collector liest sie alle fünf Minuten.",
  "Stock index levels across the Americas, Europe, the Middle East and Asia-Pacific: the day's change against the previous close, the day's range, and a month of daily closes.":
    "Aktienindexstände in Amerika, Europa, dem Nahen Osten und Asien-Pazifik: die Tagesveränderung gegenüber dem Vortagesschluss, die Tagesspanne und ein Monat Tagesschlusskurse.",
  Index: "Index",
  Level: "Level",
  Change: "Veränderung",
  "Day range": "Tagesspanne",
  "India's Nifty indexes, Nifty Bank and India VIX are NSE's daily closing file, read once each evening. The rest are read every five minutes: KOSPI and KOSPI 200 from the Korea Exchange, the Nikkei 225, TOPIX, Straits Times and S&P/ASX 200 from Sina's quotes, and the other indexes from quotes delayed by up to 20 minutes; a market that has closed shows its close.":
    "Indiens Nifty-Indizes, Nifty Bank und India VIX stammen aus der täglichen Schlussdatei der NSE, einmal am Abend gelesen. Die übrigen werden alle fünf Minuten gelesen: KOSPI und KOSPI 200 von der Korea Exchange, Nikkei 225, TOPIX, Straits Times und S&P/ASX 200 aus den Kursen von Sina und die anderen Indizes aus Kursen mit bis zu 20 Minuten Verzögerung; ein geschlossener Markt zeigt seinen Schlusskurs.",
  // An index's page (web/index-page.ts)
  "No index {ticker}.": "Kein Index {ticker}.",
  "the Korea Exchange's own index charts, every five minutes":
    "die eigenen Indexcharts der Korea Exchange, alle fünf Minuten",
  "Sina's quote feed, every five minutes": "der Kursfeed von Sina, alle fünf Minuten",
  "NSE's daily closing file, read once each evening":
    "die tägliche Schlussdatei der NSE, einmal am Abend gelesen",
  "TradingView's quotes, up to 20 minutes behind, every five minutes":
    "die Kurse von TradingView, bis zu 20 Minuten verzögert, alle fünf Minuten",
  "Yahoo Finance's quotes, every five minutes": "die Kurse von Yahoo Finance, alle fünf Minuten",
  "Hover or tap the chart to read a point.":
    "Mit der Maus über den Chart fahren oder tippen, um einen Punkt abzulesen.",
  "from {prev}": "von {prev}",
  "Daily closes": "Tagesschlusskurse",
  "The last 36 hours": "Die letzten 36 Stunden",
  "The collector has kept this index since {date}: {n} daily closes so far. The chart fills in a close a day.":
    "Der Collector speichert diesen Index seit {date}: bisher {n} Tagesschlusskurse. Der Chart füllt sich um einen Schlusskurs pro Tag.",
  "No close kept yet.": "Noch kein Schlusskurs gespeichert.",
  "Perpetuals on it: {base}": "Perpetuals darauf: {base}",
  "{n} markets, {oi} open interest": "Märkte: {n}, Open Interest {oi}",
  "Its chart and order flow (CVD)": "Sein Chart und Orderflow (CVD)",
  "Its liquidations": "Seine Liquidationen",
  "Its option book: gamma exposure, Greeks and IV walls":
    "Sein Optionsbuch: Gamma-Exposure, Griechen und IV-Wände",
  "Every index on the World indexes tab": "Alle Indizes im Tab Weltindizes",
  "{name} index level": "Indexstand {name}",
  "{name}: the level now, the day's change and range, and the daily closes kept since the site began reading it.":
    "{name}: der aktuelle Stand, Tagesveränderung und Tagesspanne sowie die Tagesschlusskurse, die gespeichert werden, seit die Seite ihn liest.",
  "On this site": "Auf dieser Seite",
  "The level is from {source}.": "Der Stand stammt von {source}.",
  "A close is the session's last level; a market that is shut shows its close until it opens again. Daily closes are each UTC day's last level.":
    "Ein Schlusskurs ist der letzte Stand der Sitzung; ein geschlossener Markt zeigt seinen Schlusskurs, bis er wieder öffnet. Tagesschlusskurse sind der letzte Stand jedes UTC-Tages.",
  Table: "Tabelle",
  "Return map": "Renditekarte",
  "By country": "Nach Land",
  View: "Ansicht",
  "5 days": "5 Tage",
  "the last 5 sessions": "die letzten 5 Sitzungen",
  "the last 21 sessions": "die letzten 21 Sitzungen",
  "Europe and the Middle East": "Europa und Naher Osten",
  "Markets with too little history for this window yet, left out: {n}.":
    "Märkte mit noch zu wenig Historie für diesen Zeitraum, ausgelassen: {n}.",
  "Too little history for this window yet.": "Noch zu wenig Historie für diesen Zeitraum.",
  "{market} · {name}: {ret} over {span}, {day} in the latest session, {swing} on a typical day":
    "{market} · {name}: {ret} über {span}, {day} in der letzten Sitzung, {swing} an einem typischen Tag",
  "{n} markets, {up} up over {span} · hover or tap a bubble to read it":
    "{n} Märkte, {up} im Plus über {span} · Blase antippen oder mit der Maus darauf zeigen",
  "Return over {span} against the latest session, one index per market":
    "Rendite über {span} gegen die letzte Sitzung, ein Index pro Markt",
  "bubble size: the typical daily move": "Blasengröße: die typische Tagesbewegung",
  "Markets by return over {span} and the latest session":
    "Märkte nach Rendite über {span} und der letzten Sitzung",
  "Return over {span}": "Rendite über {span}",
  "Change in the latest session": "Veränderung in der letzten Sitzung",
  "{market} over {span}: {list}": "{market} über {span}: {list}",
  "{n} markets · hover or tap a row to read it":
    "{n} Märkte · Zeile antippen oder mit der Maus darauf zeigen",
  "Each market's indexes by return over {span}: the bar is its first index in the table, a dot each of its others":
    "Die Indizes jedes Markts nach Rendite über {span}: Der Balken ist sein erster Index in der Tabelle, ein Punkt jeder der anderen",
  "other indexes": "weitere Indizes",
  "Volatility indexes (VIX, India VIX) are left out of the charts: their moves are not returns.":
    "Volatilitätsindizes (VIX, India VIX) bleiben aus den Charts heraus: Ihre Bewegungen sind keine Renditen.",
  // The homepage's prediction-market section (web/bets.ts).
  "What the crowd is betting on": "Worauf die Crowd setzt",
  "Prediction markets on Polymarket and Kalshi: the question we pinned, the one with the most money traded over the last 24 hours on either venue, and the next ones, at least three from each venue. Sports are left out, and so are the short questions that repeat every day or week (today's Bitcoin range, tomorrow's weather, a week of tweets).":
    "Prognosemärkte auf Polymarket und Kalshi: die Frage, die wir angepinnt haben, die mit dem meisten Geld gehandelte der letzten 24 Stunden auf einer der beiden Plattformen und die nächsten, mindestens drei von jeder. Sport bleibt außen vor, ebenso die kurzen Fragen, die sich jeden Tag oder jede Woche wiederholen (die heutige Bitcoin-Spanne, das Wetter von morgen, eine Woche Tweets).",
  "A price is the crowd's chance: a Yes share at 9¢ pays $1 if it happens, so the crowd puts it at 9%. Kalshi counts its volume in contracts that pay $1; here it is contracts times their price, the dollars paid, as Polymarket counts it. The charts are each venue's own price history. Read every five minutes.":
    "Ein Preis ist die Chance aus Sicht der Crowd: Ein Yes-Anteil zu 9¢ zahlt $1, wenn es eintritt, also sieht die Crowd 9%. Kalshi zählt sein Volumen in Kontrakten, die $1 zahlen; hier sind es Kontrakte mal Preis, also die gezahlten Dollar, so wie Polymarket zählt. Die Charts sind die eigene Preishistorie jeder Plattform. Alle fünf Minuten gelesen.",
  "The prediction markets could not be read just now.":
    "Die Prognosemärkte konnten gerade nicht gelesen werden.",
  "Chance of Yes since {date}": "Chance auf Yes seit {date}",
  "{question}: the chance of each answer over time":
    "{question}: die Chance jeder Antwort im Zeitverlauf",
  "pts in 24h": "Pkt. in 24h",
  "Traded since {date}": "Gehandelt seit {date}",
  Traded: "Gehandelt",
  "{venue} has {n} more": "{venue}: {n} weitere",
  "The likeliest answer; for a question asked by date, the nearest date; for levels that can all come true, the one closest to even odds":
    "Die wahrscheinlichste Antwort; bei einer Frage nach Datum das nächste Datum; bei Stufen, die alle zugleich eintreten können, die am nächsten an 50:50",
  "Leading answer": "Führende Antwort",
  "Change in the chance over the last 24 hours, in percentage points":
    "Veränderung der Chance in den letzten 24 Stunden, in Prozentpunkten",
  "Pinned until {date}": "Angepinnt bis {date}",
  "Most traded in the last 24 hours": "Am meisten gehandelt in den letzten 24 Stunden",
  "No open question on Polymarket or Kalshi right now.":
    "Gerade keine offene Frage auf Polymarket oder Kalshi.",
  "Prices and volumes from Polymarket and Kalshi, read {time}. A chance is the price of a Yes share; it is what the crowd is paying, not a forecast of ours.":
    "Preise und Volumen von Polymarket und Kalshi, gelesen um {time}. Eine Chance ist der Preis eines Yes-Anteils; das zahlt die Crowd, es ist keine Prognose von uns.",
  // The homepage section's automatic pin (web/bets.ts, app/pin-finder.ts).
  "Picked automatically until {date}": "Automatisch gewählt bis {date}",
  "A story across {n} questions": "Eine Story über {n} Fragen",
  "On Polymarket and Kalshi": "Auf Polymarket und Kalshi",
  "{volume} traded on it in 24h": "{volume} darauf gehandelt in 24h",
  "Polymarket's featured #{n}": "Polymarket-Featured #{n}",
  "New since {date}": "Neu seit {date}",
  "When nothing is pinned by hand, the biggest new story is pinned by itself for three days. Questions that share a topic Polymarket tagged in the last month are one story; it scores the money traded on it over 24 hours, more for questions opened this week, for markets, companies, the economy and tech, and for what Polymarket features. It is pinned when it scores at least half as much again as any other, and a story twice its size takes the pin sooner. The card says why it was picked.":
    "Wenn nichts von Hand angepinnt ist, wird die größte neue Story für drei Tage von selbst angepinnt. Fragen, die ein Thema teilen, das Polymarket im letzten Monat getaggt hat, sind eine Story; sie wird nach dem Geld bewertet, das in 24 Stunden darauf gehandelt wurde, stärker gewichtet für Fragen, die diese Woche eröffnet wurden, für Märkte, Unternehmen, Wirtschaft und Tech und für das, was Polymarket hervorhebt. Angepinnt wird sie, wenn sie mindestens anderthalbmal so hoch bewertet ist wie jede andere, und eine doppelt so große Story übernimmt den Platz früher. Die Karte sagt, warum sie gewählt wurde.",
};
