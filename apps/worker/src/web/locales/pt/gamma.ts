import type { Catalog } from "../../i18n";

/**
 * The Rates page's Gamma Exposure tab (web/gamma.ts), its chart readout (web/slot-chart.ts), the
 * IV Walls, Ceiling & Floor and Greek tabs and the page's two tab labels, in Portuguese (Brazil).
 * Glossary and style: ./index.ts.
 *
 * Terms: gamma exposure exposição gama (gama in prose; "gamma flip" stays as traders write it),
 * option opção, call / put stay call / put, strike strike, expiry vencimento, spot spot, dealer
 * dealer, flip flip, call wall / put wall muralha de calls / de puts, hedging hedge, implied
 * volatility volatilidade implícita (IV), max pain max pain, premium prêmio, ceiling / floor teto /
 * piso. Delta, vega and theta keep their Greek names, and Black-76 stays as written.
 */
export const gamma: Catalog = {
  "Funding rates": "Taxas de financiamento",
  Funding: "Financiamento",
  "Gamma Exposure": "Exposição gama",
  Gamma: "Gama",
  "Next: {date}": "Próximo: {date}",
  "Next expiry": "Próximo vencimento",
  "7 days": "7 dias",
  "30 days": "30 dias",
  "All expiries": "Todos os vencimentos",
  "Option book": "Livro de opções",
  Expiries: "Vencimentos",
  "spot {price}": "spot {price}",
  "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it":
    "líquido {net} por movimento de 1% com spot em {spot} · {bars} · passe o mouse ou toque num strike para ver",
  "bars are each strike's calls and puts": "as barras são as calls e puts de cada strike",
  "bars are each strike's calls and puts added": "as barras somam as calls e puts de cada strike",
  "Net long": "Long líquido",
  "Net short": "Short líquido",
  "short gamma": "short gama",
  "long gamma": "long gama",
  View: "Visão",
  view: "visão",
  "calls/puts": "calls/puts",
  "Each strike's calls above zero and its puts below":
    "As calls de cada strike acima de zero e as puts abaixo",
  net: "líquido",
  "One bar per strike: its calls and puts added": "Uma barra por strike: calls e puts somadas",
  zones: "zonas",
  "Net bars, with the prices shaded where dealers would be short gamma or long it":
    "Barras líquidas, com sombreado nos preços em que os dealers ficariam short ou long gama",
  "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).":
    "O seletor de visão ao lado do cursor desenha as barras de três formas: calls/puts, com as calls de cada strike acima de zero e as puts abaixo; líquido, as duas somadas numa só barra; e zonas, as barras líquidas com sombreado nos preços em que a linha fica abaixo de zero (dealers short gama, vermelho) ou acima dele (long gama, azul).",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.":
    "Strikes além de ±{pct} do spot ficam fora do gráfico: {usd} de exposição, de qualquer sinal.",
  "flip {price}": "flip {price}",
  "{currency} · {source} options · gamma exposure by strike · {scope}":
    "{currency} · opções {source} · exposição gama por strike · {scope}",
  Calls: "Calls",
  Puts: "Puts",
  "Net if the spot moved there": "Líquido se o spot fosse até lá",
  Spot: "Spot",
  "{currency} strike bands; arrow keys read one at a time":
    "faixas de strike de {currency}; as setas leem uma de cada vez",
  "{currency} options gamma exposure by strike":
    "exposição gama das opções de {currency} por strike",
  "net gamma keeps one sign within ±30% of the spot":
    "o gama líquido mantém o sinal dentro de ±30% do spot",
  "{pct} from spot; net gamma changes sign here":
    "{pct} do spot; o gama líquido muda de sinal aqui",
  "Net gamma exposure": "Exposição gama líquida",
  "per 1% move · dealers long gamma: their hedging damps moves":
    "por movimento de 1% · dealers long gama: o hedge deles amortece os movimentos",
  "per 1% move · dealers short gamma: their hedging adds to moves":
    "por movimento de 1% · dealers short gama: o hedge deles amplia os movimentos",
  "Gamma flip": "Gamma flip",
  "Call wall / put wall": "Muralha de calls / de puts",
  "the strikes holding the most call and put gamma": "os strikes com mais gama de calls e de puts",
  "calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries":
    "calls / puts no spot · put/call {ratio} · {options} opções, {expiries} vencimentos",
  "calls / puts at the spot · put/call {ratio} · {options} options, one expiry":
    "calls / puts no spot · put/call {ratio} · {options} opções, um vencimento",
  "By expiry": "Por vencimento",
  Expiry: "Vencimento",
  Left: "Restante",
  Options: "Opções",
  "Call OI ({unit})": "OI de calls ({unit})",
  "Put OI ({unit})": "OI de puts ({unit})",
  Net: "Líquido",
  "Of the chain's exposure, either sign counted": "Da exposição da cadeia, contando os dois sinais",
  Share: "Fatia",
  "Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.":
    "Exposição em dólares por movimento de 1%. Vencimentos fora do intervalo escolhido ficam esmaecidos. Toda opção da Deribit vence às 08:00 UTC; a que está na última hora fica de fora.",
  "Gamma exposure is how much of the underlying the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, per 1% move in the currency the contract pays, added up by strike.":
    "A exposição gama é quanto do ativo subjacente os detentores das opções teriam de comprar ou vender para continuar com hedge num movimento de 1% no preço: o gama de cada opção vezes seu open interest, por movimento de 1% na moeda em que o contrato paga, somado por strike.",
  "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.":
    "Calls contam como positivas e puts como negativas. Essa é a leitura padrão, e uma suposição: ela considera os dealers long nas calls que os clientes lhes venderam e short nas puts que os clientes compraram. Nenhuma corretora publica quem está de cada lado, então todo número com sinal aqui depende disso; onde ficam o open interest e o gama, não.",
  "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.":
    "Exposição líquida positiva significa que os dealers vendem nas altas e compram nas quedas, o que tende a amortecer os movimentos; negativa significa que eles perseguem o preço, o que tende a ampliá-los. O flip é onde o líquido mudaria de sinal se o spot fosse até lá, e a linha mostra o líquido em cada um desses preços. As muralhas são os strikes com mais gama de calls e de puts.",
  "Crypto: Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.":
    "Cripto: os livros de BTC e ETH da Deribit, que concentram a maior parte das opções cripto listadas; Bybit, OKX e Binance listam bem menos e não estão incluídas. Open interest, volatilidade de marcação e o forward de cada vencimento são da própria Deribit; o gama é calculado a partir deles com Black-76, que reproduz o delta e o vega da própria Deribit. Lido a cada cinco minutos.",
  "United States: Cboe's 15-minute delayed chains for the S&amp;P 500, Nasdaq-100 and Russell 2000 indexes and the most traded ETFs and stocks, with Cboe's own volatility and open interest, the spot taken as the forward. Read every 15 minutes through the US session; outside it the figures are the last session's.":
    "Estados Unidos: as cadeias da Cboe com 15 minutos de atraso para os índices S&amp;P 500, Nasdaq-100 e Russell 2000 e os ETFs e ações mais negociados, com a volatilidade e o open interest da própria Cboe e o spot tomado como forward. Lido a cada 15 minutos durante o pregão americano; fora dele, os números são do último pregão.",
  "Chips and memory: the same Cboe chains for the chip, memory and hardware stocks and ETFs the perps trade most. SK hynix is its Nasdaq ADR (SKHY), the price the SKHY perps follow; the SKHYNIX perps quote one Seoul share instead. Samsung's options trade only on the Korea Exchange and are not read yet, and neither Deribit nor Binance lists options on stocks.":
    "Chips e memória: as mesmas cadeias da Cboe para as ações e ETFs de chips, memória e hardware que os perpétuos mais negociam. A SK hynix é sua ADR na Nasdaq (SKHY), o preço que os perpétuos SKHY seguem; os perpétuos SKHYNIX cotam uma ação de Seul. As opções da Samsung só são negociadas na Korea Exchange e ainda não são lidas, e nem a Deribit nem a Binance listam opções de ações.",
  "Biotech and health, and Metals and mining: the same Cboe chains for the drug makers, health care and biotech funds, and for the gold, silver and copper miners, their funds, gold and silver themselves (GLD, SLV), and the lithium, nickel and rare-earth producers batteries need. The perps trade few of them; a book is kept when its open interest is about $0.5B or more, which leaves out the small lithium names.":
    "Biotecnologia e saúde, e Metais e mineração: as mesmas cadeias da Cboe para as farmacêuticas, os fundos de saúde e biotecnologia, e para as mineradoras de ouro, prata e cobre, seus fundos, o próprio ouro e a prata (GLD, SLV) e os produtores de lítio, níquel e terras raras de que as baterias precisam. Os perpétuos negociam poucos deles; um livro é mantido quando seu open interest fica em torno de $0.5B ou mais, o que deixa de fora os pequenos nomes de lítio.",
  "Asia-Pacific and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, its three nearest months), ASX (S&amp;P/ASX 200), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement (for ASX, its closing theoretical price) with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.":
    "Ásia-Pacífico e Europa: o arquivo de fim de dia de cada bolsa, lido uma vez após a publicação -- HKEX (índices Hang Seng), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, seus três meses mais próximos), ASX (S&amp;P/ASX 200), NSE e BSE (Nifty, Sensex) e Eurex (Euro Stoxx 50, DAX, SMI). Elas publicam preços de ajuste e open interest, mas não a volatilidade, então a de cada strike é extraída do ajuste fora do dinheiro (na ASX, do preço teórico de fechamento) com Black-76, contra o forward dado pela paridade put-call ou pelo próprio futuro da bolsa. Os números estão na moeda em que o contrato paga e valem para o fechamento daquele dia.",
  "Indonesia: the IDX lists no options on the Jakarta Composite and no exchange lists a perp on it, so Indonesia's book is Cboe's chain for the iShares MSCI Indonesia ETF (EIDO), in dollars, shown under Asia-Pacific. It follows MSCI's Indonesia index, not the Jakarta Composite, and it is thin: about eleven thousand contracts open in four expiries.":
    "Indonésia: a IDX não lista opções sobre o Jakarta Composite e nenhuma corretora lista um perpétuo sobre ele, então o livro da Indonésia é a cadeia da Cboe do iShares MSCI Indonesia ETF (EIDO), em dólares, mostrada em Ásia-Pacífico. Ele segue o índice MSCI da Indonésia, não o Jakarta Composite, e é raso: cerca de onze mil contratos em aberto em quatro vencimentos.",
  "The options data could not be read right now.": "Não foi possível ler os dados de opções agora.",
  "No gamma exposure has been computed for {currency} yet.":
    "Ainda não foi calculada exposição gama para {currency}.",
  "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.":
    "As opções de {currency} da {source} foram lidas pela última vez {ago}, há tempo demais para mostrar como posicionamento atual.",
  "Not updated since {ago}: the latest read of {source} failed, so these figures are that old.":
    "Atualizado pela última vez {ago}: a leitura mais recente da {source} falhou, então estes números são dessa época.",
  "Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.":
    "Atualizado pela última vez {ago}: nada mais novo foi lido da {source}, por feriado ou falha na leitura, então estes números são dessa época.",
  "No expiry in this range": "Nenhum vencimento neste intervalo",
  "No {currency} option expires in this range; the nearest expires {date}.":
    "Nenhuma opção de {currency} vence neste intervalo; a mais próxima vence em {date}.",
  "No strike has open interest in this range.": "Nenhum strike tem open interest neste intervalo.",
  "Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. {source} options, {asof}.":
    "Calls positivas, puts negativas: supõe-se dealers long em calls e short em puts, já que nenhuma corretora publica quem está de cada lado. Opções {source}, {asof}.",
  "read {ago}": "lido {ago}",
  "15-minute delayed, read {ago}": "atraso de 15 minutos, lido {ago}",
  "from the end-of-day file for {date}": "do arquivo de fim de dia de {date}",
  expired: "vencida",
  "Call OI": "OI de calls",
  "Put OI": "OI de puts",
  "Exposure in {unit} per 1% move; open interest at its value at the spot. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Exposição em {unit} por movimento de 1%; open interest pelo valor no spot. Vencimentos fora do intervalo escolhido ficam esmaecidos; uma opção na última hora fica de fora.",
  // The book picker.
  "Pick an option book": "Escolha um livro de opções",
  "{n} books": "{n} livros",
  "Filter books": "Filtrar livros",
  Book: "Livro",
  "Net gamma": "Gama líquido",
  "Every expiry, per 1% move, in the currency the contract pays":
    "Todos os vencimentos, por movimento de 1%, na moeda em que o contrato paga",
  "Calls / puts": "Calls / puts",
  Flip: "Flip",
  "Where net gamma changes sign, from the spot":
    "Onde o gama líquido muda de sinal, a partir do spot",
  "As of": "Data",
  "No book matches.": "Nenhum livro corresponde.",
  "calls {calls} · puts {puts}": "calls {calls} · puts {puts}",
  "close {date}": "fechamento {date}",
  Crypto: "Cripto",
  "United States": "Estados Unidos",
  "Chips and memory": "Chips e memória",
  "Biotech and health": "Biotecnologia e saúde",
  "Metals and mining": "Metais e mineração",
  "Asia-Pacific": "Ásia-Pacífico",
  Europe: "Europa",
  Other: "Outros",
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
  "strike {strikes} ({pct} from spot)": "strike {strikes} ({pct} do spot)",
  "{low} – {high} ({pct} from spot)": "{low} – {high} ({pct} do spot)",
  "no open interest here": "sem open interest aqui",
  "calls {usd} ({oi} open)": "calls {usd} ({oi} em aberto)",
  "puts {usd} ({oi} open)": "puts {usd} ({oi} em aberto)",
  "net {usd}": "líquido {usd}",
  "if the spot were here: net {usd}": "se o spot estivesse aqui: líquido {usd}",
  "Expected price move": "Movimento de preço esperado",
  "1 day ahead": "1 dia à frente",
  "1 week ahead": "1 semana à frente",
  "30 days ahead": "30 dias à frente",
  "to the {date} expiry": "até o vencimento de {date}",
  "IV {iv}": "IV {iv}",
  "ATM IV": "IV ATM",
  "Implied volatility at the expiry's forward, a year":
    "Volatilidade implícita no forward do vencimento, anualizada",
  "closed inside 1σ on {one} and 2σ on {two} of days since {year}":
    "fechou dentro de 1σ em {one} e de 2σ em {two} dos dias desde {year}",
  "expected move, 1σ and 2σ, {horizon}": "movimento esperado, 1σ e 2σ, {horizon}",
  "spot · {source} IV": "spot · IV {source}",
  "One standard deviation is the price × IV × √(days/365), from each expiry's at-the-money implied volatility (between two expiries, their total variance interpolated). The walls are one and two deviations either side of the spot. A normal distribution ends inside them 68% and 95% of the time; real prices have fatter tails, and options usually price in more movement than follows.":
    "Um desvio-padrão é preço × IV × √(dias/365), pela volatilidade implícita at-the-money de cada vencimento (entre dois vencimentos, a variância total interpolada). As muralhas ficam a um e dois desvios de cada lado do spot. Uma distribuição normal termina dentro delas 68% e 95% das vezes; preços reais têm caudas mais grossas, e as opções costumam precificar mais movimento do que vem depois.",
  "The last line of a branch is how often it really did, from Deribit's 30-day volatility index (DVOL) and the perpetual's daily settlement: one 30-day IV for every horizon, and overlapping windows, so frequencies rather than independent trials.":
    "A última linha de cada ramo é com que frequência isso de fato aconteceu, pelo índice de volatilidade de 30 dias da Deribit (DVOL) e o ajuste diário do perpétuo: uma única IV de 30 dias para todo horizonte, e janelas que se sobrepõem, então são frequências, não tentativas independentes.",
  "The expected move is the range the options have priced in: one standard deviation is the price times the at-the-money implied volatility times the square root of the days ahead over 365, and the walls sit one and two deviations either side of the spot. The chart draws them for the chosen expiries (30 days ahead for all of them); the mind map under it gives every horizon. They are not support or resistance, only the market's own estimate of how far price may travel.":
    "O movimento esperado é o intervalo que as opções precificaram: um desvio-padrão é o preço vezes a volatilidade implícita at-the-money vezes a raiz quadrada dos dias à frente sobre 365, e as muralhas ficam a um e dois desvios de cada lado do spot. O gráfico as desenha para os vencimentos escolhidos (30 dias à frente para todos eles); o mapa mental abaixo dá cada horizonte. Não são suporte nem resistência, só a estimativa do próprio mercado de até onde o preço pode ir.",
  reference: "referência",
  Level: "Nível",
  "From the reference": "Da referência",
  "the next session": "o próximo pregão",
  "{date}, from 08:00 UTC": "{date}, a partir das 08:00 UTC",
  "{date} session": "pregão de {date}",
  "no trade yet today": "sem negócios hoje ainda",
  "above it now": "acima dela agora",
  "below it now": "abaixo dela agora",
  "reached it today and back inside": "tocou hoje e voltou para dentro",
  "inside all day so far": "dentro o dia todo até agora",
  "No history is kept for this book's walls yet, so its 90% wall is the normal distribution's 1.645 standard deviations of the options' own IV, not a measured one. Its record starts with its first day below.":
    "Ainda não há histórico das muralhas deste livro, então sua muralha de 90% são os 1.645 desvios-padrão da distribuição normal sobre a própria IV das opções, não um valor medido. O registro dele começa com seu primeiro dia, abaixo.",
  "Measured on {days} sessions since {since} {year}, against Cboe's 1-day VIX: the S&amp;P 500 closed inside one standard deviation on {inside1}, and within {k90} of them on 90%, so that is where the 90% wall sits. Cboe's free history has the index's closes only, so touches of a wall during the day are not counted here; this book's own record below counts them.":
    "Medido em {days} pregões desde {since} {year}, contra o VIX de 1 dia da Cboe: o S&amp;P 500 fechou dentro de um desvio-padrão em {inside1}, e dentro de {k90} deles em 90%, então é aí que fica a muralha de 90%. O histórico gratuito da Cboe só tem os fechamentos do índice, então toques numa muralha durante o dia não são contados aqui; o registro deste livro, abaixo, os conta.",
  "Measured on {days} Deribit days since {since} {year}, against the 30-day volatility index (DVOL) as each day began: the whole day stayed within {k90} standard deviations on 90% of days, so that is where the 90% wall sits. Within one, the whole day stayed on {inside1} and the close on {close1}. A touch of the 1σ wall closed back inside {rev1} of {touch1} times; a touch of the 90% wall, {rev90} of {touch90} times.":
    "Medido em {days} dias da Deribit desde {since} {year}, contra o índice de volatilidade de 30 dias (DVOL) no início de cada dia: o dia inteiro ficou dentro de {k90} desvios-padrão em 90% dos dias, então é aí que fica a muralha de 90%. Dentro de um, o dia inteiro ficou em {inside1} e o fechamento em {close1}. Um toque na muralha de 1σ fechou de volta dentro {rev1} de {touch1} vezes; um toque na muralha de 90%, {rev90} de {touch90} vezes.",
  "not reached": "não tocada",
  "reached, closed back inside": "tocada, fechou de volta dentro",
  "closed beyond": "fechou além",
  "above: {what}": "acima: {what}",
  "below: {what}": "abaixo: {what}",
  "The IV wall is the move the options price for the day: the reference close plus and minus one standard deviation, the close times the options' implied volatility a day ahead times the square root of 1/365. The levels are fixed when the day begins (Deribit's day at 08:00 UTC, a US session at its first read) so they do not drift through the day.":
    "A muralha de IV é o movimento que as opções precificam para o dia: o fechamento de referência mais e menos um desvio-padrão, o fechamento vezes a volatilidade implícita das opções um dia à frente vezes a raiz quadrada de 1/365. Os níveis são fixados quando o dia começa (o dia da Deribit às 08:00 UTC, um pregão americano na primeira leitura), então não se deslocam ao longo do dia.",
  "The 90% wall is where history says price stayed: the multiple of a day's standard deviation that held on 90% of past days. BTC and ETH are measured on every Deribit day since 2021 against DVOL, their whole day's range; the S&amp;P 500 on every session since 2022 against Cboe's 1-day VIX, closes only. A book with no history uses the normal distribution's 1.645.":
    "A muralha de 90% é onde o histórico diz que o preço ficou: o múltiplo do desvio-padrão diário que se manteve em 90% dos dias passados. BTC e ETH são medidos em todos os dias da Deribit desde 2021 contra o DVOL, na amplitude do dia inteiro; o S&amp;P 500 em todos os pregões desde 2022 contra o VIX de 1 dia da Cboe, só nos fechamentos. Um livro sem histórico usa o 1.645 da distribuição normal.",
  "A wall is a probability, not a promise: a touch of the IV wall has closed back inside a little over half the time, not nine times in ten. The record under the ladder shows each day's outcome for this book.":
    "Uma muralha é uma probabilidade, não uma promessa: um toque na muralha de IV fechou de volta dentro pouco mais da metade das vezes, não nove em dez. O registro abaixo da escada mostra o resultado de cada dia deste livro.",
  "{currency}'s options carry no implied volatility to draw walls from yet.":
    "As opções de {currency} ainda não têm volatilidade implícita para desenhar muralhas.",
  "1.645 standard deviations of the options' IV (normal distribution)":
    "1.645 desvios-padrão da IV das opções (distribuição normal)",
  "{k90} standard deviations of {method} {sigma}, measured":
    "{k90} desvios-padrão de {method} {sigma}, medido",
  "IV wall, 1σ": "Muralha de IV, 1σ",
  "±{move} (±{pct}) from IV {iv} a day ahead": "±{move} (±{pct}) pela IV {iv} um dia à frente",
  "90% wall": "Muralha de 90%",
  "The day so far": "O dia até agora",
  Reference: "Referência",
  "high {high} · low {low}": "máxima {high} · mínima {low}",
  "IV wall: {status}": "Muralha de IV: {status}",
  "the latest close, for the next session": "o último fechamento, para o próximo pregão",
  "Reference close": "Fechamento de referência",
  "{currency} · {source} options · IV walls · {day}":
    "{currency} · opções {source} · muralhas de IV · {day}",
  "The day's range": "A amplitude do dia",
  "IV wall": "Muralha de IV",
  "90% wall, above": "Muralha de 90%, acima",
  "IV wall, above": "Muralha de IV, acima",
  "1σ of the options' IV": "1σ da IV das opções",
  "IV wall, below": "Muralha de IV, abaixo",
  "90% wall, below": "Muralha de 90%, abaixo",
  "{currency} comes from an end-of-day file, so its walls are for the next session and are not kept day by day.":
    "{currency} vem de um arquivo de fim de dia, então suas muralhas são para o próximo pregão e não são guardadas dia a dia.",
  "{currency}'s own record starts with today; each finished day is added here.":
    "O registro próprio de {currency} começa hoje; cada dia encerrado é adicionado aqui.",
  "{currency}'s own record, {days} finished days since {since}. IV wall: touched {reached}, closed back inside {held}. 90% wall: touched {reached90}, closed back inside {held90}.":
    "Registro próprio de {currency}, {days} dias encerrados desde {since}. Muralha de IV: tocada {reached}, fechou de volta dentro {held}. Muralha de 90%: tocada {reached90}, fechou de volta dentro {held90}.",
  "High / low": "Máxima / mínima",
  Close: "Fechamento",
  "At the IV wall": "Na muralha de IV",
  "At the 90% wall": "Na muralha de 90%",
  "How price has behaved at the walls": "Como o preço se comportou nas muralhas",
  "Prices in {unit}. {source} options, read {ago}.":
    "Preços em {unit}. Opções {source}, lidas {ago}.",
  "Two readings of where the market makers stand, side by side, for the nearest expiry. The gamma ceiling is the strike above the spot holding the most call gamma, and the gamma floor the strike below it holding the most put gamma: where hedging flows are largest.":
    "Duas leituras de onde estão os market makers, lado a lado, para o vencimento mais próximo. O teto gama é o strike acima do spot com mais gama de calls, e o piso gama o strike abaixo dele com mais gama de puts: onde os fluxos de hedge são maiores.",
  "The dealer range reads every option as sold by dealers who keep the premium, as max pain does: at expiry they pay out what the options are worth, so they earn most at the max pain strike and start losing beyond the break-evens either side, the dealer ceiling and floor. No exchange publishes who sold what, so this rests on that assumption, and the Gamma Exposure tab's sign assumes the opposite for calls.":
    "O intervalo dos dealers trata cada opção como vendida por dealers que ficam com o prêmio, como faz o max pain: no vencimento eles pagam o que as opções valem, então ganham mais no strike de max pain e começam a perder além dos pontos de equilíbrio de cada lado, o teto e o piso dos dealers. Nenhuma corretora publica quem vendeu o quê, então isso depende dessa suposição, e o sinal da aba Exposição gama supõe o contrário para as calls.",
  "A ceiling or floor within a quarter of the day's move of an IV wall is marked as lined up with it. Whether price turns there more often than elsewhere is what the record under the ladder is for: it starts with this tab and grows a day at a time.":
    "Um teto ou piso a menos de um quarto do movimento do dia de uma muralha de IV é marcado como alinhado a ela. Se o preço vira ali mais vezes do que em outros lugares é o que o registro abaixo da escada vai mostrar: ele começa com esta aba e cresce um dia de cada vez.",
  "gamma ceiling": "teto gama",
  "dealer ceiling": "teto dos dealers",
  "gamma floor": "piso gama",
  "dealer floor": "piso dos dealers",
  "Gamma ceiling / floor": "Teto / piso gama",
  "the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}":
    "os strikes com mais gama de calls acima do spot e de puts abaixo dele, vencendo em {expiry}",
  "Dealer ceiling / floor": "Teto / piso dos dealers",
  "where dealers who sold every option of that expiry break even; max pain {pain}":
    "onde os dealers que venderam todas as opções desse vencimento empatam; max pain {pain}",
  "max pain": "max pain",
  "{currency} · {source} options · ceiling and floor · expiring {expiry}":
    "{currency} · opções {source} · teto e piso · vencendo em {expiry}",
  "dealer ceiling and floor": "teto e piso dos dealers",
  "lined up with a wall": "alinhado a uma muralha",
  "Dealer range by expiry": "Intervalo dos dealers por vencimento",
  Premium: "Prêmio",
  "Dealer floor": "Piso dos dealers",
  "Max pain": "Max pain",
  "Dealer ceiling": "Teto dos dealers",
  "From the spot": "Do spot",
  "Lined up with a wall": "Alinhado a uma muralha",
  "{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.":
    "{currency} vem de um arquivo de fim de dia, então seus níveis são para o próximo pregão e não são guardados dia a dia.",
  Days: "Dias",
  Reached: "Tocado",
  "Closed back inside": "Fechou de volta dentro",
  "Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.":
    "Em {days} dias encerrados desde {since}, contando os dois lados; um nível é tocado quando a máxima (ou a mínima) do dia o atinge, e se mantém quando o dia fecha de volta dentro dele.",
  "How price has behaved at these levels": "Como o preço se comportou nesses níveis",
  "IV Walls": "Muralhas de IV",
  "IV walls": "muralhas de IV",
  "Ceiling & Floor": "Teto e piso",
  Ceiling: "Teto",
  "the spot now": "o spot agora",
  "week from {date}": "semana a partir de {date}",
  "Levels for": "Níveis para",
  "The Day and Week switch reads the same levels for the nearest expiry or for the week's: Deribit's Friday 08:00 UTC weekly, or a US book's last expiry of the week. The week's levels are fixed by its first read, its IV walls span the time to that expiry, and its 90% wall is measured on whole past weeks where there is history.":
    "O seletor Dia e Semana lê os mesmos níveis para o vencimento mais próximo ou para o da semana: o semanal da Deribit às 08:00 UTC de sexta, ou o último vencimento da semana de um livro americano. Os níveis da semana são fixados na primeira leitura dela, suas muralhas de IV cobrem o tempo até esse vencimento e sua muralha de 90% é medida em semanas inteiras passadas onde há histórico.",
  "the strikes holding the most call gamma above the spot and put gamma below it, in everything expiring by {expiry}":
    "os strikes com mais gama de calls acima do spot e de puts abaixo dele, em tudo que vence até {expiry}",
  "The week so far": "A semana até agora",
  "the spot now; this week's levels are fixed by its first read":
    "o spot agora; os níveis desta semana são fixados pela primeira leitura dela",
  "{currency}'s weekly record starts with this week; each finished week is added here.":
    "O registro semanal de {currency} começa nesta semana; cada semana encerrada é adicionada aqui.",
  Weeks: "Semanas",
  "Over {weeks} finished weeks since {since}, both sides counted; a level is reached when the week's high (or low) touches it, and held when the week closes back inside it.":
    "Em {weeks} semanas encerradas desde {since}, contando os dois lados; um nível é tocado quando a máxima (ou a mínima) da semana o atinge, e se mantém quando a semana fecha de volta dentro dele.",
  "{currency} · {source} options · IV walls day by day":
    "{currency} · opções {source} · muralhas de IV dia a dia",
  "{currency} · {source} options · ceiling and floor day by day":
    "{currency} · opções {source} · teto e piso dia a dia",
  "daily candle": "candle diário",
  "week's expiry": "vencimento da semana",
  "Each day's candle under the walls it opened with. The walls are fixed by the day's first read, so they move only from one day to the next.":
    "O candle de cada dia sob as muralhas com que ele abriu. As muralhas são fixadas pela primeira leitura do dia, então só mudam de um dia para o outro.",
  "Each day's candle under the levels it opened with. They are fixed by the day's first read, so they move only from one day to the next; the dotted rule marks each week's expiry.":
    "O candle de cada dia sob os níveis com que ele abriu. Eles são fixados pela primeira leitura do dia, então só mudam de um dia para o outro; a linha pontilhada marca o vencimento de cada semana.",
  "Each day's candle under its week's levels. They are fixed by the week's first read, so they move only at a week's expiry, the dotted rule.":
    "O candle de cada dia sob os níveis da sua semana. Eles são fixados pela primeira leitura da semana, então só mudam no vencimento da semana, a linha pontilhada.",
  // The Delta, Vega and Theta tabs (web/greeks.ts).
  Delta: "Delta",
  "{currency} · {source} options · delta by strike · {scope}":
    "{currency} · opções {source} · delta por strike · {scope}",
  "{currency} · {source} options · vega by strike · {scope}":
    "{currency} · opções {source} · vega por strike · {scope}",
  "{currency} · {source} options · theta by strike · {scope}":
    "{currency} · opções {source} · theta por strike · {scope}",
  "net {net} at spot {spot} · calls above zero, puts below · hover or tap a strike to read it":
    "líquido {net} com spot em {spot} · calls acima de zero, puts abaixo · passe o mouse ou toque num strike para ver",
  "{total} per IV point at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "{total} por ponto de IV com spot em {spot} · calls e puts de cada strike empilhadas · passe o mouse ou toque num strike para ver",
  "{total} a day at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "{total} por dia com spot em {spot} · calls e puts de cada strike empilhadas · passe o mouse ou toque num strike para ver",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of the total.":
    "Strikes além de ±{pct} do spot ficam fora do gráfico: {usd} do total.",
  "total {usd}": "total {usd}",
  "{share} of it in that expiry, {left} left": "{share} disso nesse vencimento, faltam {left}",
  "≈ {coins} at the spot; what the open options move like, as their buyers hold them":
    "≈ {coins} no spot; quanto do ativo as opções em aberto equivalem, do lado dos compradores",
  "what the open options move like, as their buyers hold them":
    "quanto do ativo as opções em aberto equivalem, do lado dos compradores",
  "Net delta": "Delta líquido",
  "calls' delta is positive, puts' negative": "o delta das calls é positivo, o das puts negativo",
  "Most delta": "Mais delta",
  Vega: "Vega",
  "per IV point: what the open options gain if implied volatility rises one point, and their writers lose":
    "por ponto de IV: quanto as opções em aberto ganham se a volatilidade implícita sobe um ponto, e seus vendedores perdem",
  "every option gains as implied volatility rises":
    "toda opção ganha quando a volatilidade implícita sobe",
  "Most vega": "Mais vega",
  "of the options' value a day, {premium} in all":
    "do valor das opções por dia, {premium} no total",
  Theta: "Theta",
  "a day: what the open options lose to time with price and IV unchanged, paid by their buyers to their writers":
    "por dia: quanto as opções em aberto perdem com o tempo com preço e IV inalterados, pago pelos compradores aos vendedores",
  "every option loses value as expiry nears, faster the closer it is":
    "toda opção perde valor com a aproximação do vencimento, mais rápido quanto mais perto",
  "Most theta": "Mais theta",
  "Decay rate": "Taxa de decaimento",
  "Delta in {unit}: the value of the underlying each expiry's open options move like. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Delta em {unit}: o valor do ativo subjacente a que equivalem as opções em aberto de cada vencimento. Vencimentos fora do intervalo escolhido ficam esmaecidos; uma opção na última hora fica de fora.",
  "Vega in {unit} per IV point. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Vega em {unit} por ponto de IV. Vencimentos fora do intervalo escolhido ficam esmaecidos; uma opção na última hora fica de fora.",
  "Theta in {unit} a day. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Theta em {unit} por dia. Vencimentos fora do intervalo escolhido ficam esmaecidos; uma opção na última hora fica de fora.",
  "Of the chain's total, either side counted": "Do total da cadeia, contando os dois lados",
  Total: "Total",
  "Delta is how much an option's value moves with the underlying: about a half at the money, near 1 deep in the money and near 0 far out of it, negative for puts. Times open interest and the forward, it is the value of the underlying the open options move like, added up by strike.":
    "Delta é quanto o valor de uma opção se move com o ativo subjacente: cerca de metade no dinheiro, perto de 1 bem dentro do dinheiro e perto de 0 bem fora dele, negativo para puts. Vezes o open interest e o forward, é o valor do ativo a que as opções em aberto equivalem, somado por strike.",
  "It is read from the side of whoever bought the options: calls positive, puts negative. Whoever wrote them holds exactly the opposite, so were every writer hedged, their hedges would hold this much of the underlying. Nothing here assumes who is on which side, unlike gamma exposure.":
    "É lido do lado de quem comprou as opções: calls positivas, puts negativas. Quem as vendeu está exatamente do lado oposto, então, se todo vendedor estivesse com hedge, seus hedges teriam essa quantidade do ativo. Nada aqui supõe quem está de cada lado, ao contrário da exposição gama.",
  "Most delta sits in options already in the money, away from the spot, so this chart often reaches wider than the gamma chart.":
    "A maior parte do delta está em opções já dentro do dinheiro, longe do spot, então este gráfico costuma ir mais longe que o de gama.",
  "Vega is how much an option's value moves when implied volatility moves one point, say from 40% to 41%: largest at the money and for options with long to run. Times open interest, it is what the open options gain if IV rises a point, added up by strike.":
    "Vega é quanto o valor de uma opção se move quando a volatilidade implícita se move um ponto, digamos de 40% para 41%: maior no dinheiro e em opções com muito prazo pela frente. Vezes o open interest, é quanto as opções em aberto ganham se a IV sobe um ponto, somado por strike.",
  "Every option carries positive vega for whoever bought it and the same amount negative for whoever wrote it, so the total is what option writers stand to lose if IV rises a point, and gain if it falls one.":
    "Toda opção tem vega positivo para quem a comprou e o mesmo valor negativo para quem a vendeu, então o total é o que os vendedores de opções podem perder se a IV subir um ponto, e ganhar se cair um.",
  "Theta is how much an option's value falls in a day with price and implied volatility unchanged: largest at the money and in an option's last days. Times open interest, it is what the open options lose in a day, added up by strike.":
    "Theta é quanto o valor de uma opção cai em um dia com preço e volatilidade implícita inalterados: maior no dinheiro e nos últimos dias de uma opção. Vezes o open interest, é quanto as opções em aberto perdem em um dia, somado por strike.",
  "Buyers pay it and writers collect it: the total is roughly what option writers earn in a quiet day, the carry they are paid for taking on gamma. The decay rate divides it by what the options in range are worth.":
    "Os compradores pagam e os vendedores recebem: o total é mais ou menos o que os vendedores de opções ganham num dia calmo, o carry que recebem por assumir gama. A taxa de decaimento divide isso pelo valor das opções no intervalo.",
  "The same books and reads as Gamma Exposure: Deribit's BTC and ETH every five minutes, Cboe's US chains every 15 minutes through the session, and the exchanges' end-of-day files for Asia-Pacific and Europe. Each option's Greeks are Black-76 at a zero rate on its own open interest, implied volatility and forward, in the currency the contract pays; they reproduce Deribit's own to within 0.03%.":
    "Os mesmos livros e leituras da Exposição gama: BTC e ETH da Deribit a cada cinco minutos, as cadeias americanas da Cboe a cada 15 minutos durante o pregão e os arquivos de fim de dia das bolsas para Ásia-Pacífico e Europa. As gregas de cada opção são Black-76 com taxa zero sobre seu próprio open interest, volatilidade implícita e forward, na moeda em que o contrato paga; elas reproduzem as da própria Deribit com diferença de até 0.03%.",
  "Delta as the options' buyers hold it: calls positive, puts negative; whoever wrote them holds the opposite. {source} options, {asof}.":
    "Delta do lado dos compradores das opções: calls positivas, puts negativas; quem as vendeu tem o oposto. Opções {source}, {asof}.",
  "Vega as the options' buyers hold it, per point of implied volatility; whoever wrote them holds the opposite. {source} options, {asof}.":
    "Vega do lado dos compradores das opções, por ponto de volatilidade implícita; quem as vendeu tem o oposto. Opções {source}, {asof}.",
  "Theta as the options' buyers hold it, per day; whoever wrote them collects it. {source} options, {asof}.":
    "Theta do lado dos compradores das opções, por dia; quem as vendeu recebe. Opções {source}, {asof}.",
  "Delta, vega and theta have not been computed for {currency} yet; they arrive with its next read.":
    "Delta, vega e theta ainda não foram calculados para {currency}; chegam com a próxima leitura.",
  // The Gamma Exposure tab's By expiry chart (web/gamma.ts) and its readout (web/slot-chart.ts).
  "Each expiry's calls above zero and its puts below, at their value at the spot":
    "As calls de cada vencimento acima de zero e as puts abaixo, pelo valor no spot",
  "Each expiry's gamma exposure: calls above zero, puts below":
    "A exposição gama de cada vencimento: calls acima de zero, puts abaixo",
  gamma: "gama",
  "Each expiry's at-the-money implied volatility: the term structure":
    "A volatilidade implícita at-the-money de cada vencimento: a estrutura a termo",
  show: "mostrar",
  "{n} expiries · open interest {calls} in calls, {puts} in puts · hover or tap an expiry to read it":
    "{n} vencimentos · open interest {calls} em calls, {puts} em puts · passe o mouse ou toque num vencimento para ver",
  "{currency} · {source} options · by expiry": "{currency} · opções {source} · por vencimento",
  "{currency} expiries; arrow keys read one at a time":
    "vencimentos de {currency}; as setas leem um de cada vez",
  "One bar per expiry in date order, so the gaps between them are not to scale; expiries outside the chosen range are dimmed.":
    "Uma barra por vencimento em ordem de data, então os espaços entre elas não estão em escala; vencimentos fora do intervalo escolhido ficam esmaecidos.",
  "{date}, {left} left": "{date}, faltam {left}",
  "{n} options": "{n} opções",
  "calls {oi} open": "calls {oi} em aberto",
  "puts {oi} open": "puts {oi} em aberto",
  "put/call {ratio}": "put/call {ratio}",
  "gamma {calls} / {puts}, net {net}": "gama {calls} / {puts}, líquido {net}",
  "ATM IV {iv}": "IV ATM {iv}",
  "max pain {price}": "max pain {price}",
  "dealer range {low} – {high}": "intervalo dos dealers {low} – {high}",
  "premium {usd}": "prêmio {usd}",
  // Reaction zones (web/confluence.ts).
  "reaction zone, today": "zona de reação, hoje",
  "gamma wall": "muralha gama",
  "dealer break-even": "equilíbrio dos dealers",
  "gamma flip": "gamma flip",
  "the spot is inside it now": "o spot está dentro dela agora",
  "{points} ({pct}) away, {sigmas} of the day's move":
    "a {points} ({pct}), {sigmas} do movimento do dia",
  "No zone above": "Nenhuma zona acima",
  "No zone below": "Nenhuma zona abaixo",
  "no IV wall lines up with a ceiling": "nenhuma muralha de IV se alinha a um teto",
  "no IV wall lines up with a floor": "nenhuma muralha de IV se alinha a um piso",
  "Above the spot": "Acima do spot",
  "Below the spot": "Abaixo do spot",
  zone: "zona",
  "Dealers long gamma ({net} per 1% move, every expiry): their hedging sells rises and buys dips, which is what lets a wall hold.":
    "Dealers long gama ({net} por movimento de 1%, todos os vencimentos): o hedge deles vende as altas e compra as quedas, e é isso que permite a uma muralha segurar.",
  "Dealers short gamma ({net} per 1% move, every expiry): their hedging chases the price, so walls give way more easily and fading them is riskier.":
    "Dealers short gama ({net} por movimento de 1%, todos os vencimentos): o hedge deles persegue o preço, então as muralhas cedem com mais facilidade e operar contra elas é mais arriscado.",
  "Flip {price}, {pct} ({sigmas}).": "Flip {price}, {pct} ({sigmas}).",
  "Since {year}, a touch of this book's 1σ wall closed back inside {rev1} of {touch1} times, of its 90% wall {rev90} of {touch90}: better than a coin toss, not nine in ten.":
    "Desde {year}, um toque na muralha de 1σ deste livro fechou de volta dentro {rev1} de {touch1} vezes, e na muralha de 90% {rev90} de {touch90}: melhor que cara ou coroa, não nove em dez.",
  "A zone is where an IV wall and a market maker's level fall within a quarter of the day's 1σ move of each other: a place to wait for a rejection, not a trade on its own, and least reliable when dealers are short gamma.":
    "Uma zona é onde uma muralha de IV e um nível de market maker ficam a menos de um quarto do movimento de 1σ do dia um do outro: um lugar para esperar uma rejeição, não uma operação por si só, e menos confiável quando os dealers estão short gama.",
  "the week's 1σ move": "o movimento de 1σ da semana",
  "the day's 1σ move": "o movimento de 1σ do dia",
  "Reaction zones": "Zonas de reação",
  "σ is {unit}, {move}": "σ é {unit}, {move}",
  "between the IV walls": "entre as muralhas de IV",
  "between the 90% walls": "entre as muralhas de 90%",
  "each line's mark is beside its name below": "a marca de cada linha fica ao lado do nome, abaixo",
  "Each expiry's delta: calls above zero, puts below":
    "O delta de cada vencimento: calls acima de zero, puts abaixo",
  "Each expiry's theta a day, its calls and puts stacked down from the top":
    "O theta diário de cada vencimento, calls e puts empilhadas de cima para baixo",
  "Each expiry's vega, its calls and puts stacked":
    "O vega de cada vencimento, calls e puts empilhadas",
  "Its own zone record, {days} finished days since {since}: {zones} zones, price reached {reached} and closed back on the near side of {held}; its IV walls on those days were reached {wallReached} times and held {wallHeld}.":
    "Registro de zonas próprio, {days} dias encerrados desde {since}: {zones} zonas, o preço tocou {reached} e fechou de volta do lado próximo de {held}; suas muralhas de IV nesses dias foram tocadas {wallReached} vezes e seguraram {wallHeld}.",
  "This book's zone record starts with today: each finished day adds whether price reached a zone and turned there.":
    "O registro de zonas deste livro começa hoje: cada dia encerrado adiciona se o preço tocou uma zona e virou ali.",
  "Zone record": "Registro de zonas",
  "dealers long gamma": "dealers long gama",
  "dealers short gamma": "dealers short gama",
  delta: "delta",
  "delta {calls} / {puts}, net {net}": "delta {calls} / {puts}, líquido {net}",
  "each finished day adds whether price reached a zone and closed back on its near side":
    "cada dia encerrado adiciona se o preço tocou uma zona e fechou de volta do lado próximo",
  "no zone above": "nenhuma zona acima",
  "no zone below": "nenhuma zona abaixo",
  "starts this week": "começa nesta semana",
  "starts today": "começa hoje",
  "the spot is in the zone {range}": "o spot está na zona {range}",
  theta: "theta",
  "theta {calls} / {puts} a day, total {net}": "theta {calls} / {puts} por dia, total {net}",
  "this book's days are not kept, so its zones have no record":
    "os dias deste livro não são guardados, então suas zonas não têm registro",
  vega: "vega",
  "vega {calls} / {puts}, total {net}": "vega {calls} / {puts}, total {net}",
  "zone above {range}, {sigmas} away": "zona acima {range}, a {sigmas}",
  "zone below {range}, {sigmas} away": "zona abaixo {range}, a {sigmas}",
  "zones reached and held over {days} finished days; the IV walls alone: {wallHeld} / {wallReached}":
    "zonas tocadas e mantidas em {days} dias encerrados; só as muralhas de IV: {wallHeld} / {wallReached}",
  "zones reached and held over {days} finished weeks; the IV walls alone: {wallHeld} / {wallReached}":
    "zonas tocadas e mantidas em {days} semanas encerradas; só as muralhas de IV: {wallHeld} / {wallReached}",
};
