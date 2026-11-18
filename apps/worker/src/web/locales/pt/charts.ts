/**
 * The chart pages and their readouts in Portuguese (Brazil): web/cvd.ts, web/kchart.ts,
 * web/sentiment.ts, web/funding-chart.ts and web/slot-chart.ts (web/rail.ts has no words of its own).
 * Glossary and style: ./index.ts.
 *
 * Keys shared with the liquidations part (months, dates, "Window", the hover hints) carry the same
 * translation there, which i18n.test.ts holds.
 */

import type { Catalog } from "../../i18n";

export const charts: Catalog = {
  // Dates on the axes and in the hover readouts; the month names are marked in web/slot-chart.ts.
  Jan: "jan",
  Feb: "fev",
  Mar: "mar",
  Apr: "abr",
  May: "mai",
  Jun: "jun",
  Jul: "jul",
  Aug: "ago",
  Sep: "set",
  Oct: "out",
  Nov: "nov",
  Dec: "dez",
  "{month} {day}": "{day} {month}",
  "{month} {day} {time} {zone}": "{day} {month} {time} {zone}",

  // web/slot-chart.ts: the hover readouts of the CVD and longs-vs-shorts charts.
  "{low} – {high} ({pct} from the mark)": "{low} – {high} ({pct} do preço de marcação)",
  "longs liquidate here: {usd} ({n})": "longs liquidados aqui: {usd} ({n})",
  "shorts liquidate here: {usd} ({n})": "shorts liquidados aqui: {usd} ({n})",
  "{n} position": "{n} posição",
  "no whale liquidates here": "nenhuma baleia é liquidada aqui",
  "{usd} of longs liquidate between here and the mark":
    "{usd} em longs liquidados entre aqui e o preço de marcação",
  "{usd} of shorts liquidate between the mark and here":
    "{usd} em shorts liquidados entre o preço de marcação e aqui",
  Cursor: "Cursor",
  cursor: "cursor",
  bar: "barra",
  cross: "mira",
  "Light up the bar under the pointer": "Destaca a barra sob o ponteiro",
  "Dashed crosshair at the pointer, with the value there on each axis":
    "Mira tracejada no ponteiro, com o valor daquele ponto em cada eixo",
  "no flow recorded": "nenhum fluxo registrado",
  "close {price}": "fechamento {price}",
  "close {price} ({pct} since start)": "fechamento {price} ({pct} desde o início)",
  "bought {usd}": "comprado {usd}",
  "sold {usd}": "vendido {usd}",
  "net {net}": "líquido {net}",
  "net {net} ({pct} of volume)": "líquido {net} ({pct} do volume)",
  "nothing force-closed": "nada fechado à força",
  "longs closed {usd}": "longs fechados {usd}",
  "shorts closed {usd}": "shorts fechados {usd}",
  "longs − shorts {diff}": "longs − shorts {diff}",
  even: "empate",
  "longs heavier, {pct}%": "longs maiores, {pct}%",
  "shorts heavier, {pct}%": "shorts maiores, {pct}%",
  "{n} liquidation": "{n} liquidação",
  "{n} liquidations": "{n} liquidações",
  "{when} (still filling)": "{when} (ainda em formação)",

  // web/cvd.ts: the chart.
  "{asset} · cumulative volume delta · {n}-hour bars, {zone}":
    "{asset} · delta de volume cumulativo · barras de {n} h, {zone}",
  "{asset} · cumulative volume delta · {n}-minute bars, {zone}":
    "{asset} · delta de volume cumulativo · barras de {n} min, {zone}",
  "{asset} futures taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.":
    "CVD taker de futuros de {asset}, últimos {window}: {cvd}. Compradores a mercado {bought} vs vendedores {sold}.",
  "{asset}, last {window}: futures CVD {futures}, spot CVD {spot}, delta {delta}.":
    "{asset}, últimos {window}: CVD de futuros {futures}, CVD spot {spot}, delta {delta}.",
  "Last {window}": "Últimos {window}",
  "Loading {interval} bars…": "Carregando barras de {interval}…",
  "Loading {asset}…": "Carregando {asset}…",
  "Not available yet: there is not enough history for {interval} bars":
    "Ainda indisponível: não há histórico suficiente para barras de {interval}",
  "Not available yet": "Ainda indisponível",
  Price: "Preço",
  "Net buy": "Compra líquida",
  "Net sell": "Venda líquida",
  "hover or tap a bar to read it": "passe o mouse ou toque numa barra para ver o valor",
  "{asset} bars; arrow keys read one at a time": "barras de {asset}; as setas leem uma de cada vez",
  "{asset} price and cumulative volume delta over the last {window}":
    "preço de {asset} e delta de volume cumulativo nos últimos {window}",
  "{asset} net taker flow per bar": "fluxo taker líquido de {asset} por barra",

  // web/cvd.ts: tiles, controls and the screener table.
  Volume: "Volume",
  CVD: "CVD",
  "CVD / volume": "CVD / volume",
  Change: "Variação",
  "CVD breadth": "Amplitude do CVD",
  "of {n} assets with net taker buying": "dos {n} ativos com compra taker líquida",
  "Bullish divergences": "Divergências de alta",
  "price down ≥{price}%, takers net buying ≥{flow}% of volume":
    "preço caiu ≥{price}%, takers comprando em termos líquidos ≥{flow}% do volume",
  "Bearish divergences": "Divergências de baixa",
  "price up ≥{price}%, takers net selling ≥{flow}% of volume":
    "preço subiu ≥{price}%, takers vendendo em termos líquidos ≥{flow}% do volume",
  "Top CVD flows": "Maiores fluxos de CVD",
  "largest net buy / net sell": "maior compra / venda líquida",
  Window: "Janela",
  "bullish div": "div. de alta",
  "bearish div": "div. de baixa",
  "Search symbol": "Buscar símbolo",
  Find: "Buscar",
  "Pick an asset to chart": "Escolha um ativo para o gráfico",
  "{n} assets": "{n} ativos",
  "No asset matches.": "Nenhum ativo corresponde.",
  "No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.":
    "Nenhum fluxo taker foi coletado nos últimos {window}. A coleta consulta cada corretora a cada cinco minutos; uma nova implantação preenche cerca de uma semana de histórico na primeira hora.",
  Asset: "Ativo",
  "Reference market's first close to last close in the window":
    "Do primeiro ao último fechamento do mercado de referência na janela",
  "Taker buys less taker sells, in dollars, summed over the polled venues":
    "Compras taker menos vendas taker, em dólares, somadas nas corretoras consultadas",
  "CVD as a share of the window's taker volume": "CVD como fração do volume taker da janela",
  "Taker buys plus taker sells, in dollars": "Compras taker mais vendas taker, em dólares",
  "Polled venues with flow for this asset": "Corretoras consultadas com fluxo para este ativo",
  Venues: "Corretoras",
  "Price and flow disagreeing by more than the divergence thresholds in the tiles":
    "Preço e fluxo em direções opostas além dos limites de divergência dos cards",
  Signal: "Sinal",
  "No live market lists {asset}, so there is no flow to chart.":
    "Nenhum mercado ativo lista {asset}, então não há fluxo para o gráfico.",
  "Newest bucket {age}.": "Intervalo mais recente {age}.",
  "The venues that publish statistics release each 5-minute bucket after it closes, so the newest bar holds only the live tapes for a few minutes.":
    "As corretoras que publicam estatísticas liberam cada intervalo de 5 minutos depois que ele fecha, então a barra mais recente traz só os negócios ao vivo por alguns minutos.",

  // web/cvd.ts: the page.
  "taker buys": "compras taker",
  "taker sells": "vendas taker",
  "The asset button beside the intervals opens the screener: every polled asset's taker flow over the window. Pick one to chart it, find a ticker in its box, or sort by a heading. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance, Aster, Gate and Bitget publish weeks of it and OKX five days, while every other venue, spot books other than Binance's included, is counted from its live trades since 28 October 2026, so older bars sum fewer venues.":
    "O botão de ativo ao lado dos intervalos abre o screener: o fluxo taker de cada ativo consultado na janela. Escolha um para ver o gráfico, procure um ticker na caixa ou ordene por um cabeçalho. Variação vai do primeiro ao último fechamento do mercado consultado mais movimentado na janela. O histórico varia por corretora: Binance, Aster, Gate e Bitget publicam semanas dele e a OKX cinco dias, enquanto todas as outras corretoras, incluindo os livros spot além do da Binance, são contadas a partir dos negócios ao vivo desde 28 de outubro de 2026, então as barras mais antigas somam menos corretoras.",

  // web/funding-chart.ts
  "The funding chart is unavailable right now. The backtest below is unaffected.":
    "O gráfico de financiamento está indisponível no momento. O backtest abaixo não é afetado.",
  "No stored funding for this window yet.":
    "Ainda não há financiamento armazenado para esta janela.",
  Spread: "Spread",
  "Funding by exchange, annualized · hourly": "Financiamento por corretora, anualizado · por hora",
  "Funding by exchange, annualized · daily": "Financiamento por corretora, anualizado · diário",
  "Funding APR by exchange over the window": "APR de financiamento por corretora na janela",
  "Hover the chart to read every visible line at one moment.":
    "Passe o mouse sobre o gráfico para ler todas as linhas visíveis no mesmo momento.",
  "Signed log scale, so ordinary rates keep room beside extreme ones. Each line holds a rate until that exchange's next settlement; a break is time with no recorded funding, not a zero.":
    "Escala logarítmica com sinal, para que as taxas comuns tenham espaço ao lado das extremas. Cada linha mantém uma taxa até o próximo pagamento daquela corretora; uma interrupção é um período sem financiamento registrado, não um zero.",

  // web/sentiment.ts
  "No readings yet in this window.": "Ainda não há leituras nesta janela.",
  "Fear & greed: {score}, {label}": "Medo e ganância: {score}, {label}",
  "Fear and greed score reaches {score} ({label})":
    "Índice de medo e ganância chega a {score} ({label})",
  "{n} readings, every 30 minutes · {age} to now":
    "{n} leituras, a cada 30 minutos · de {age} até agora",
  "no data in window": "sem dados na janela",
  "Fear &amp; greed · updated {ago}": "Medo e ganância · atualizado {ago}",
  "Fear &amp; greed": "Medo e ganância",
  component: "componente",
  reading: "leitura",
  "percentile (30d, greed direction)": "percentil (30d, direção da ganância)",
  "funding (OI-weighted APR)": "financiamento (APR ponderado por OI)",
  "open interest": "open interest",
  "liquidation skew (24h)": "viés de liquidações (24h)",
  "{pct} long-heavy": "{pct} pesado em longs",
  "taker flow (24h)": "fluxo taker (24h)",
  "{pct} net buy": "{pct} compra líquida",
  "Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.":
    "O índice é a média de quatro componentes, cada um um ranking percentil contra o próprio histórico de 30 dias deste livro — não uma escala fixa, então o mesmo número bruto se lê de um jeito num período calmo e de outro num volátil. <b>Financiamento</b> e <b>open interest</b> indicam mais ganância quanto mais altos (longs alavancados e lotados pagando para manter a posição). O <b>viés de liquidações</b> é invertido antes da média: um livro em que longs estão sendo forçados a sair é medo, por mais incomum que essa leitura pareça frente ao próprio histórico. O <b>fluxo taker</b> é a compra agressiva líquida sobre a venda agressiva, nas últimas 24h. Calculado a cada 30 minutos pelo coletor (belyjelli/profitlock-worker, o job <code>market sentiment</code>, irmão do <code>collector rank-eval</code>); a cobertura de liquidações e de fluxo taker não inclui todas as corretoras, então isto é uma aproximação, não uma garantia para o mercado todo.",
  "Fear & Greed": "Medo e Ganância",
  "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.":
    "Um índice de medo e ganância do mercado de financiamento: financiamento ponderado por OI, open interest, viés de liquidações e fluxo taker, cada um ranqueado contra o próprio histórico de 30 dias.",
  "{month} {day} {time}–{end} {zone}": "{day} {month} {time}–{end} {zone}",
  "close, {market}": "fechamento, {market}",
  "open {open} · high {high} · low {low} · close {close}":
    "abertura {open} · máxima {high} · mínima {low} · fechamento {close}",
  "volume {usd}": "volume {usd}",
  "large taker buys {usd} ({n})": "grandes compras taker {usd} ({n})",
  "large taker sells {usd} ({n})": "grandes vendas taker {usd} ({n})",
  "no candle": "sem candle",
  "{month} {day} {hours} {zone}": "{day} {month} {hours} {zone}",
  "{hours} {zone}": "{hours} {zone}",

  // web/kchart.ts: the trading chart on /cvd.
  "Loading older bars…": "Carregando barras mais antigas…",
  "Nothing older: taker flow is kept for {days} days.":
    "Nada mais antigo: o fluxo taker é guardado por {days} dias.",
  "Older bars did not load. Drag again to retry.":
    "As barras mais antigas não carregaram. Arraste de novo para tentar.",
  "drag to look back · wheel or pinch to zoom · hover a candle to read it":
    "arraste para voltar no tempo · roda ou pinça para zoom · passe o mouse num candle para ver os valores",
  "Futures CVD": "CVD de futuros",
  "Spot CVD": "CVD spot",
  "Delta buy": "Delta compra",
  "Delta sell": "Delta venda",
  "{asset} delta per bar, spot and futures net taker flow summed":
    "delta de {asset} por barra, soma do fluxo taker líquido spot e de futuros",
  "No taker flow for {asset} in the last {window}. Only the ~500 assets deepest on {venues} are polled; pick one from the asset list above.":
    "Sem fluxo taker para {asset} nos últimos {window}. Só os ~500 ativos com mais profundidade em {venues} são consultados; escolha um na lista de ativos acima.",
  "Price with cumulative volume delta under it: spot and futures taker buying against taker selling, their combined delta per bar, and where price and order flow disagree.":
    "Preço com o delta de volume cumulativo abaixo: compras taker spot e de futuros contra vendas taker, o delta combinado por barra e onde preço e fluxo de ordens divergem.",
  "Price, with cumulative volume delta (CVD) under it: {buys} less {sells}, in dollars, summed over every exchange we collect that lists the asset, with its USDT, USDC and USD markets counted as one. Futures CVD adds up the perpetuals on <b>{futures}</b>; spot CVD the spot books on <b>{spot}</b>. It covers the ~500 assets deepest by open interest and every commodity, index and currency pair, in 5-minute buckets. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.":
    "Preço, com o delta de volume cumulativo (CVD) abaixo: {buys} menos {sells}, em dólares, somados em todas as corretoras que coletamos e que listam o ativo, com os mercados em USDT, USDC e USD contados como um só. O CVD de futuros soma os perpétuos em <b>{futures}</b>; o CVD spot, os livros spot em <b>{spot}</b>. Cobre os ~500 ativos com maior open interest e todas as commodities, índices e pares de moedas, em intervalos de 5 minutos. Uma divergência marca uma janela em que preço e fluxo apontaram para lados opostos; ela descreve o que aconteceu, não o que vem a seguir.",
  "Each key above the chart says how many venues its line sums for this asset; hover it for their names. Spot covers crypto and stocks: a stock's spot books are its tokenized shares (xStocks, Ondo and the like) on the collected exchanges, counted only while they trade at the stock's own price. Commodities and indices show futures only. Spot and futures each have a pane, because their sizes differ by an order of magnitude on most assets. The histogram under them is the delta: each bar's spot and futures net summed.":
    "Cada legenda acima do gráfico diz quantas corretoras sua linha soma para este ativo; passe o mouse para ver os nomes. Spot cobre cripto e ações: os livros spot de uma ação são suas ações tokenizadas (xStocks, Ondo e similares) nas corretoras coletadas, contadas só enquanto negociam ao preço da própria ação. Commodities e índices mostram só futuros. Spot e futuros têm cada um seu painel, porque seus tamanhos diferem em uma ordem de grandeza na maioria dos ativos. O histograma abaixo deles é o delta: a soma do líquido spot e de futuros de cada barra.",
  "Price is the busiest polled market's own candle. Each pane has its own scale, so where lines cross means nothing. Drag to look back, wheel or pinch to zoom, and hover a candle to read it in the box beside it; on a phone, tap.":
    "O preço é o candle do mercado consultado mais movimentado. Cada painel tem sua própria escala, então o ponto onde as linhas se cruzam não significa nada. Arraste para voltar no tempo, use a roda ou a pinça para zoom e passe o mouse num candle para ler os valores na caixa ao lado; no celular, toque.",
  "futures net {net}": "líquido futuros {net}",
  "spot net {net}": "líquido spot {net}",
  "delta {net}": "delta {net}",
  "delta {net} ({pct} of volume)": "delta {net} ({pct} do volume)",
  "CVD futures {futures}, spot {spot}": "CVD futuros {futures}, spot {spot}",
  Open: "Abertura",
  High: "Máxima",
  Low: "Mínima",
  Futures: "Futuros",
  "Spot (Binance)": "Spot (Binance)",
  // The Chart page's fund-flow dropdown (web/fund-flow.ts).
  "No spot book for this asset on the collected exchanges.":
    "Não há livro spot para este ativo nas corretoras coletadas.",
  "No futures flow for this asset yet.": "Ainda não há fluxo de futuros para este ativo.",
  Time: "Período",
  "Taker buys in the window, in dollars": "Compras taker na janela, em dólares",
  "Inflow ($)": "Entrada ($)",
  "Taker sells in the window, in dollars": "Vendas taker na janela, em dólares",
  "Outflow ($)": "Saída ($)",
  "Inflow less outflow": "Entrada menos saída",
  "Net inflow ($)": "Entrada líquida ($)",
  "Net inflow against the window of the same length before it":
    "Entrada líquida comparada com a janela anterior de mesmo tamanho",
  "Net inflow change": "Variação da entrada líquida",
  "Net inflow as a share of the asset's market cap":
    "Entrada líquida como fração do valor de mercado do ativo",
  "F/M cap ratio": "Razão F/cap",
  "Spot fund": "Fluxo spot",
  "Spot books on {venues}": "Livros spot em {venues}",
  "{count} venues": "{count} corretoras",
  "Futures fund": "Fluxo de futuros",
  "Perpetuals on {venues}": "Perpétuos em {venues}",
  "Fund flow": "Fluxo de capital",
  "Inflow is taker buying and outflow taker selling, summed over each window back from the newest bucket every venue has published. Net inflow change compares the net with the window of the same length before it. F/M cap ratio is the net as a share of the asset's market cap (CoinGecko). A dash means the history does not reach back that far yet.":
    "Entrada é a compra taker e saída a venda taker, somadas em cada janela a partir do intervalo mais recente que todas as corretoras publicaram. A variação da entrada líquida compara o líquido com a janela anterior de mesmo tamanho. A razão F/cap é o líquido como fração do valor de mercado do ativo (CoinGecko). Um traço significa que o histórico ainda não vai tão longe.",
  "Up to": "Até",

  // web/cvd.ts: the Detail view, the charted asset's own figures in place of the chart.
  "{ratio} of {volume} taker volume, {venues}": "{ratio} de {volume} de volume taker, {venues}",
  "Bullish divergence": "Divergência de alta",
  "Bearish divergence": "Divergência de baixa",
  "No divergence": "Sem divergência",
  "price {change}, futures flow {ratio} of volume; a flag needs both past {price}% and {flow}%":
    "preço {change}, fluxo de futuros {ratio} do volume; o sinal exige passar de {price}% e de {flow}%",
  "{venue} spot": "{venue} spot",
  "largest net buy and net sell by exchange": "maior compra e venda líquida por corretora",
  "{n} markets, 24h volume {volume}": "{n} mercados, volume em 24h {volume}",
  "weighted by open interest; {low} to {high} across markets":
    "ponderado por open interest; de {low} a {high} entre os mercados",
  "Market cap": "Valor de mercado",
  "CoinGecko's, read hourly; crypto only": "da CoinGecko, lido a cada hora; só cripto",
  "{interval} bars": "barras de {interval}",
  "Signal by window": "Sinal por janela",
  "More on {asset}:": "Mais sobre {asset}:",
  "By exchange": "Por corretora",
  "Back to the chart": "Voltar ao gráfico",
  "{asset}'s flow by window and by exchange, with its open interest and funding":
    "fluxo de {asset} por janela e por corretora, com open interest e financiamento",
  Detail: "Detalhe",
  "Detail, beside Fund flow, puts the asset's own figures where the chart and the market's tiles are, over the same window: its futures and spot CVD, whether it diverged, the exchanges that bought and sold it most, its open interest, funding and market cap; then its signal over every interval's span, and its flow exchange by exchange. Chart brings the chart back.":
    "Detalhe, ao lado de Fluxo de capital, coloca os números do próprio ativo onde ficam o gráfico e os cards do mercado, na mesma janela: seu CVD de futuros e spot, se houve divergência, as corretoras que mais o compraram e venderam, seu open interest, financiamento e valor de mercado; depois seu sinal no período de cada intervalo e seu fluxo corretora por corretora. Gráfico traz o gráfico de volta.",
  // The Chart page's spot ETF flow pins (web/kchart.ts).
  "Spot ETF net inflow": "Entrada líquida em ETFs spot",
  "Spot ETF net outflow": "Saída líquida de ETFs spot",
  "Counted: {funds}. Not read: {missing}, whose issuers block automated reads.":
    "Contados: {funds}. Não lidos: {missing}, cujos emissores bloqueiam leituras automáticas.",
  "pins: spot ETF net flow per trade day, at the 4 pm New York NAV":
    "marcadores: fluxo líquido de ETFs spot por pregão, pelo NAV das 16h de Nova York",
  "{date}, 4 pm New York close": "{date}, fechamento das 16h de Nova York",
  "Not reported yet: {funds}": "Ainda não divulgado: {funds}",
  "Spot ETF net inflow so far": "Entrada líquida em ETFs spot até agora",
  "Spot ETF net outflow so far": "Saída líquida de ETFs spot até agora",
  "{n} of {total} funds reported": "{n} de {total} fundos divulgados",
  "{asset} chart: price and CVD": "Gráfico de {asset}: preço e CVD",
  "{asset} price with cumulative volume delta under it: spot and futures taker buying against taker selling across exchanges, and where price and order flow disagree.":
    "Preço de {asset} com o delta de volume cumulativo abaixo: compras taker spot e de futuros contra vendas taker nas corretoras, e onde preço e fluxo de ordens divergem.",
  "{asset} · interbank rate · {n}-hour bars, {zone}":
    "{asset} · taxa interbancária · barras de {n} h, {zone}",
  "{asset} · interbank rate · {n}-minute bars, {zone}":
    "{asset} · taxa interbancária · barras de {n} min, {zone}",
  "Last {window}: {from} to {to}": "Últimos {window}: de {from} a {to}",
  "No exchange trades {asset}, so it has no taker flow to sum: this is its interbank rate, quoted every five minutes. Last quote {age}.":
    "Nenhuma exchange negocia {asset}, então não há fluxo tomador para somar: esta é a sua taxa interbancária, cotada a cada cinco minutos. Última cotação {age}.",
  "interbank rate": "taxa interbancária",
  "{asset} interbank rate over the last {window}":
    "Taxa interbancária de {asset} nos últimos {window}",
  "No exchange trades it: its interbank rate, with no taker flow":
    "Nenhuma exchange negocia: só a taxa interbancária, sem fluxo tomador",
  "rate only": "só a taxa",
  "{asset} chart: interbank rate": "Gráfico de {asset}: taxa interbancária",
  "{asset} interbank rate, quoted every five minutes. No exchange trades it, so it has no taker flow or CVD.":
    "Taxa interbancária de {asset}, cotada a cada cinco minutos. Nenhuma exchange a negocia, então não há fluxo tomador nem CVD.",
  "A currency pair that no exchange trades, USD/CNY and USD/HKD among them, is listed with its interbank rate instead: quoted every five minutes, with no taker flow, so its row has no CVD and its chart is the rate alone.":
    "Um par de moedas que nenhuma exchange negocia, como USD/CNY e USD/HKD, aparece com a sua taxa interbancária: cotada a cada cinco minutos, sem fluxo tomador, então a sua linha não tem CVD e o gráfico mostra só a taxa.",
  "its interbank rate, quoted every five minutes":
    "a sua taxa interbancária, cotada a cada cinco minutos",
  "No exchange trades {asset}, so it has no taker flow to sum: this is its interbank rate, worked out from {first} and {second}, each quoted every five minutes. Older quote {age}.":
    "Nenhuma exchange negocia {asset}, então não há fluxo tomador para somar: esta é a sua taxa interbancária, calculada a partir de {first} e {second}, cada uma cotada a cada cinco minutos. Cotação mais antiga {age}.",
  Currency: "Moeda",
};
