/**
 * web/pages.ts (every page but the /status body, which stays English) and web/venues.ts, in
 * Portuguese (Brazil). Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const pages: Catalog = {
  // shared helpers
  flat: "lateral",
  crypto: "cripto",
  equity: "ações",
  commodity: "commodities",
  fx: "câmbio",
  index: "índice",
  "{days} charging days in the last 30": "{days} dias de cobrança nos últimos 30",
  Asset: "Ativo",
  "7d settled": "Pago 7d",
  Stability: "Estabilidade",
  "Long on {venue}": "Long na {venue}",
  "Short on {venue}": "Short na {venue}",
  day: "1 dia",
  "{n} days": "{n} dias",
  Any: "Qualquer",

  // home: verified ranking and hero
  "No replay yet: the nightly run needs a week of settled funding on both legs of a pair.":
    "Nenhum replay ainda: a rodada noturna precisa de uma semana de financiamento pago nas duas pernas de um par.",
  "Replayed, not forecast: {asset} long {long} / short {short} settled {net} on {size} a leg over 7 days. {apr} annualized, {win}% of days positive.":
    "Replay, não previsão: {asset} long {long} / short {short} pagou {net} com {size} por perna em 7 dias. {apr} anualizado, {win}% dos dias positivos.",
  "Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into":
    "Open interest da perna mais rasa das duas. Um número grande ganho em um mercado raso não é uma operação em que você consiga entrar com tamanho",
  "The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry":
    "O financiamento da perna mais extrema, em valor absoluto. Taxas acima de algumas centenas por cento costumam indicar deslistagem ou listagem em apuros, não carry",
  "Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg":
    "Financiamento que as duas pernas de fato pagaram nos últimos 7 dias, por $10.000 de nocional em cada perna",
  Annualized: "Anualizado",
  "Long leg": "Perna long",
  "Short leg": "Perna short",
  "Days the pair was net positive, as a share of days that settled at all":
    "Dias em que o par fechou positivo, como fração dos dias com algum pagamento",
  "Win rate": "Taxa de acerto",
  "Thinner leg OI": "OI da perna mais rasa",
  "Worst leg APR": "APR da pior perna",
  "How often the weaker leg held its funding direction over 30 days":
    "Com que frequência a perna mais fraca manteve a direção do financiamento em 30 dias",
  "Widest funding spread right now": "Maior spread de financiamento agora",
  "No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.":
    "Nenhuma corretora enviou dados nos últimos cinco minutos, então não há o que parear. Confira de novo em um minuto.",
  "Widest spreads": "Maiores spreads",
  "Open the screener": "Abrir o screener",
  "No pairs yet: an asset needs live markets on at least two venues.":
    "Nenhum par ainda: um ativo precisa de mercados ativos em pelo menos duas corretoras.",
  "What actually paid, last 7 days": "O que de fato pagou, últimos 7 dias",
  "replayed {date}": "replay em {date}",
  "Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.":
    "Não é previsão: as duas pernas são reproduzidas nos próprios horários de pagamento a partir do financiamento armazenado, com $10.000 por perna. Ordenado pelo que foi pago, sem nenhum filtro — então confira a profundidade da perna mais rasa e a taxa da pior perna antes de ler um número grande como uma operação.",
  "{asset} carry, long {long} / short {short}: {funding} of funding settled on {size} a leg over the last {span}. {net} after retail fees. Price risk hedged, not guessed.":
    "Carry de {asset}, long {long} / short {short}: {funding} de financiamento pago com {size} por perna em {span}. {net} após tarifas de varejo. Risco de preço com hedge, não no chute.",
  "Best verified carry, last {span}": "Melhor carry verificado, últimos {span}",
  "funding settled on {size} per leg": "financiamento pago com {size} por perna",
  "after retail fees {value}": "após tarifas de varejo {value}",
  "annualized {value} before fees": "anualizado {value} antes das tarifas",
  "win rate {value} of days": "taxa de acerto {value} dos dias",
  "thinner leg {value} open interest": "perna mais rasa com {value} de open interest",
  "stability {value}": "estabilidade {value}",
  "Open this backtest": "Abrir este backtest",
  "Settled, not forecast: both legs replayed at their own settlement times. This is the best pair in the newest nightly run with at least {oi} of open interest on its thinner leg, neither leg past {apr}% a year, stability of {stability} or better and no missed settlements. Retail fees are {bps} bps on each of {fills} fills, opening and closing both legs. Last week's funding is not a promise about next week's.":
    "Pago, não previsto: as duas pernas reproduzidas nos próprios horários de pagamento. Este é o melhor par da rodada noturna mais recente com pelo menos {oi} de open interest na perna mais rasa, nenhuma perna acima de {apr}% ao ano, estabilidade de {stability} ou melhor e nenhum pagamento perdido. As tarifas de varejo são {bps} bps em cada uma das {fills} execuções, abrindo e fechando as duas pernas. O financiamento da semana passada não é promessa sobre o da próxima.",
  "Widest funding spread across perp exchanges right now: {asset} at {spread} a year. Long {long} at {longApr}, short {short} at {shortApr}.":
    "Maior spread de financiamento entre corretoras de perpétuos agora: {asset} a {spread} ao ano. Long {long} a {longApr}, short {short} a {shortApr}.",
  "funding spread, per year": "spread de financiamento, ao ano",
  "{symbol} at {apr}": "{symbol} a {apr}",
  "Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.":
    "Manter o mesmo tamanho nas duas pernas anula a exposição ao preço; a diferença entre as duas taxas de financiamento é o que o par recebe em um ano, antes das tarifas de negociação e antes de qualquer taxa mudar.",

  // screener
  "Funding spread screener": "Screener de spread de financiamento",
  "For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.":
    "Para cada ativo, o mercado mais barato para ficar long e o mais rico para ficar short, em corretoras diferentes. Cada perna precisa passar nos filtros.",
  "No pairs match these filters. Lower the minimum open interest or include more exchange types.":
    "Nenhum par atende a esses filtros. Reduza o open interest mínimo ou inclua mais tipos de corretora.",
  "Min open interest, each leg": "Open interest mínimo, cada perna",
  "Min 24h volume, each leg": "Volume mínimo em 24h, cada perna",
  "A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency":
    "Uma perna em USDT contra uma em USDC carrega o basis entre as duas stablecoins e exige garantia nas duas. Marcado, cada ativo só é pareado dentro de uma moeda de cotação",
  "Same quote currency on both legs": "Mesma moeda de cotação nas duas pernas",
  "Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads":
    "Deslistagens e listagens em apuros podem pagar além de ±2000% APR e tomar o lugar de spreads negociáveis",
  "Include beyond ±1000% APR": "Incluir acima de ±1000% APR",
  Rows: "Linhas",
  Spread: "Spread",
  Venues: "Corretoras",
  "Neither leg has settled funding to score yet":
    "Nenhuma perna tem financiamento pago para pontuar ainda",
  "The long leg has no settled funding to score yet":
    "A perna long ainda não tem financiamento pago para pontuar",
  "The short leg has no settled funding to score yet":
    "A perna short ainda não tem financiamento pago para pontuar",
  "Weaker leg held its direction on {days} of its charging days in the last 30":
    "A perna mais fraca manteve a direção em {days} dos seus dias de cobrança nos últimos 30",
  "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg":
    "Esta corretora não informa em que moeda a perna é paga, então não dá para mostrar que bate com a outra perna",
  "Settles in {quote} while the other leg settles in {other}: the pair carries the basis between them":
    "Paga em {quote} enquanto a outra perna paga em {other}: o par carrega o basis entre elas",
  "an undeclared currency": "uma moeda não declarada",
  "quote ?": "cotação ?",
  OI: "OI",
  "{asset} pays {spread} a year to hold both sides: long {long} at {longApr}, short {short} at {shortApr}. Same coin, two exchanges, price exposure cancelled.":
    "{asset} paga {spread} ao ano para manter os dois lados: long {long} a {longApr}, short {short} a {shortApr}. Mesma moeda, duas corretoras, exposição ao preço anulada.",
  "Signed log scale, so ordinary rates keep room next to extreme ones":
    "Escala log com sinal, para que taxas comuns tenham espaço ao lado das extremas",
  "Long − short, log scale": "Long − short, escala log",
  "Exchanges with a live market for this asset": "Corretoras com mercado ativo para este ativo",
  "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "Com que frequência a perna mais fraca manteve a direção do financiamento em 30 dias. 0,50 é cara ou coroa; 0,88 é o máximo que um mês inteiro pode marcar",

  // exchanges and one exchange
  Exchanges: "Corretoras",
  "No exchange has reported in the last five minutes.":
    "Nenhuma corretora enviou dados nos últimos cinco minutos.",
  Exchange: "Corretora",
  Type: "Tipo",
  "Open interest": "Open interest",
  "24h volume": "Volume em 24h",
  Updated: "Atualizado",
  "{venue}: {count} live perp markets, {oi} open interest. Richest funding {richest} at {richestApr} a year; cheapest {cheapest} at {cheapestApr}.":
    "{venue}: mercados de perpétuos ativos: {count}, open interest de {oi}. Financiamento mais rico {richest} a {richestApr} ao ano; mais barato {cheapest} a {cheapestApr}.",
  "{venue} funding rates": "Taxas de financiamento da {venue}",
  "Live funding rates, open interest and volume for every {venue} perpetual market.":
    "Taxas de financiamento, open interest e volume ao vivo de todos os mercados perpétuos da {venue}.",
  "No live markets from {venue}: it isn't collected yet, or its last update is more than five minutes old.":
    "Nenhum mercado ativo da {venue}: ela ainda não é coletada, ou a última atualização tem mais de cinco minutos.",
  "{count} live markets": "mercados ativos: {count}",
  "{value} open interest": "{value} de open interest",
  "updated {value}": "atualizado {value}",
  Market: "Mercado",
  "Funding APR": "APR de financiamento",
  "Rate, log scale": "Taxa, escala log",
  Interval: "Intervalo",
  "Next funding": "Próximo financiamento",
  "Mark price": "Preço de marcação",
  "Centralized exchange": "Corretora centralizada",
  "Onchain perp exchange": "Corretora de perpétuos on-chain",
  "Hyperliquid HIP-3 dex": "DEX HIP-3 da Hyperliquid",

  // rates
  now: "agora",
  asset: "ativo",
  "open interest": "open interest",
  spread: "spread",
  "{asset} funding runs from {low} on {lowVenue} to {high} on {highVenue}: {gap} a year apart across {count} exchanges.":
    "O financiamento de {asset} vai de {low} na {lowVenue} a {high} na {highVenue}: {gap} ao ano de diferença entre {count} corretoras.",
  previous: "anterior",
  "assets {from}–{to}": "ativos {from}–{to}",
  next: "próxima",
  "No asset has live markets on two or more venues right now.":
    "Nenhum ativo tem mercados ativos em duas ou mais corretoras agora.",
  Rates: "Taxas",
  "Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.":
    "O financiamento de cada corretora para os ativos mais profundos de uma vez. Positivo significa que os longs pagam, então um short recebe; uma célula vazia significa que a corretora não tem mercado para o ativo, não que o financiamento esteja lateral.",

  // price gaps
  "{asset}: buy on {buyVenue} at {buyPrice}, sell on {sellVenue} at {sellPrice}. A {gap} bps gap at the top of the book.":
    "{asset}: compre na {buyVenue} a {buyPrice}, venda na {sellVenue} a {sellPrice}. Uma diferença de {gap} bps no topo do livro.",
  "Quotes seen {quoted}; the older leg's funding row fetched {fetched}":
    "Cotações vistas {quoted}; dados de financiamento da perna mais antiga obtidos {fetched}",
  "No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.":
    "Nenhum ativo cota uma diferença tão grande agora. A mediana dos ativos comparáveis fica perto de 1,6 bps, então tente um piso menor.",
  "Highest bid against lowest ask, across two different exchanges":
    "Maior bid contra menor ask, em duas corretoras diferentes",
  "Gap, bps": "Diferença, bps",
  "The sell price less the buy price, in the asset's own price units":
    "O preço de venda menos o preço de compra, nas unidades de preço do próprio ativo",
  Basis: "Basis",
  "The smaller of the two resting sizes: what the gap is actually good for":
    "O menor dos dois tamanhos no livro: o quanto a diferença de fato comporta",
  "Good for": "Comporta",
  "Buy price": "Preço de compra",
  "Buy at": "Comprar em",
  "Ask size": "Tamanho do ask",
  "Sell price": "Preço de venda",
  "Sell at": "Vender em",
  "Bid size": "Tamanho do bid",
  "Exchanges quoting this asset that survived the mark-agreement check":
    "Corretoras que cotam este ativo e passaram na checagem de concordância do preço de marcação",
  Quoted: "Cotado",
  "Price gaps": "Diferenças de preço",
  "For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps</b>, not fillable trades: nothing here reflects the book below level 1, the taker fees, or the two transfers a real position needs. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size.":
    "Para cada ativo, a corretora mais barata para comprar e a mais cara para vender, no topo de cada livro. São <b>diferenças cotáveis</b>, não operações executáveis: nada aqui reflete o livro abaixo do nível 1, as tarifas de taker ou as duas transferências que uma posição real exige. As maiores diferenças ficam nos livros mais rasos — quando isso foi medido, 395 de 721 ativos mostravam alguma diferença, com mediana de 1,6 bps, enquanto os líderes comportavam apenas $3 de tamanho no livro.",
  Apply: "Aplicar",
  "This venue's mark disagrees with the rest, so it is excluded from the gap":
    "O preço de marcação desta corretora diverge do resto, então ela fica fora da diferença",
  "Marked {ratio}× above this asset's deepest market, so it is a different instrument, not a price gap":
    "Marcado {ratio}× acima do mercado mais profundo deste ativo, então é outro instrumento, não uma diferença de preço",
  "Marked {ratio}× below this asset's deepest market, so it is a different instrument, not a price gap":
    "Marcado {ratio}× abaixo do mercado mais profundo deste ativo, então é outro instrumento, não uma diferença de preço",
  best: "melhor",
  "This venue's own bid-ask spread, which a taker crosses on entry and again on exit":
    "O spread bid-ask próprio desta corretora, que um taker cruza na entrada e de novo na saída",
  "This venue's funding row has not been refreshed within the freshness window, so its mark is withheld rather than shown stale — the quote beside it is live":
    "Os dados de financiamento desta corretora não foram atualizados dentro da janela de validade, então o preço de marcação é omitido em vez de mostrado desatualizado — a cotação ao lado está ao vivo",
  "Quote seen {quoted}; funding row fetched {fetched}":
    "Cotação vista {quoted}; dados de financiamento obtidos {fetched}",
  "Every pair": "Todos os pares",
  "One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.":
    "Uma linha por direção: compre na primeira corretora, venda na segunda. A maior diferença muitas vezes não é a melhor — um par mais estreito pode ter muito mais tamanho no livro, e a maioria das direções perde de cara.",
  "The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for":
    "O menor entre o tamanho do ask do lado comprador e o do bid do lado vendedor — o quanto esta direção comporta",
  "No two exchanges quote {asset} in a way that can be compared right now.":
    "Não há duas corretoras cotando {asset} de forma comparável agora.",
  "Buying on {buy} and selling on {sell} quotes {gap}, though one side's resting size is unknown.":
    "Comprar na {buy} e vender na {sell} cota {gap}, embora o tamanho no livro de um dos lados seja desconhecido.",
  "Buying on {buy} and selling on {sell} quotes {gap}, good for about {size}.":
    "Comprar na {buy} e vender na {sell} cota {gap}, comportando cerca de {size}.",
  "That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.":
    "É uma cotação no tamanho mostrado, não uma operação executável: antes das tarifas, antes do livro abaixo do nível 1 e antes da transferência entre duas corretoras.",
  Status: "Status",
  "{count} venue is shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "Corretoras esmaecidas e fora da diferença: {count} ({venues}). Seus preços de marcação divergem mais de 10% do mercado mais profundo deste ativo por open interest, o que indica um instrumento de outro tamanho ou com outro nome, e não uma diferença de preço — a checagem que impede que um descasamento de 1375× seja publicado como uma oportunidade de 13,660,780 bps. {status} mostra o motivo de cada uma.",
  "{count} venues are shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "Corretoras esmaecidas e fora da diferença: {count} ({venues}). Seus preços de marcação divergem mais de 10% do mercado mais profundo deste ativo por open interest, o que indica um instrumento de outro tamanho ou com outro nome, e não uma diferença de preço — a checagem que impede que um descasamento de 1375× seja publicado como uma oportunidade de 13,660,780 bps. {status} mostra o motivo de cada uma.",
  "{asset} price gaps by exchange": "Diferenças de preço de {asset} por corretora",
  "{asset} best bid and ask on every exchange that quotes it, with the size resting at each.":
    "Melhor bid e ask de {asset} em todas as corretoras que o cotam, com o tamanho no livro em cada uma.",
  "Every exchange": "Todas as corretoras",
  "Best bid": "Melhor bid",
  "Best ask": "Melhor ask",
  "The venue's own bid-ask spread in basis points":
    "O spread bid-ask próprio da corretora, em pontos-base",
  "Own spread": "Spread próprio",
  Mark: "Marcação",
  "Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.":
    "Os tamanhos são o dinheiro parado no topo de cada livro, convertido em USD porque as três corretoras que publicam profundidade contam de jeitos diferentes — Gate em contratos, OKX em contratos contra <code>ctVal</code>, Bybit na moeda base. Ler esses números crus, lado a lado, é um erro de 10,000×.",

  // one asset
  "Best pair: long on {long} at {longApr}, short on {short} at {shortApr}, a {spread} spread per year.":
    "Melhor par: long na {long} a {longApr}, short na {short} a {shortApr}, um spread de {spread} ao ano.",
  "Only markets with at least {minOi} open interest are paired.":
    "Só mercados com pelo menos {minOi} de open interest são pareados.",
  "Funding only, before trading fees: none were entered.":
    "Só financiamento, antes das tarifas de negociação: nenhuma foi informada.",
  "Only one exchange lists it right now, so there's no cross-exchange pair.":
    "Só uma corretora o lista agora, então não há par entre corretoras.",
  "No two exchanges have at least {minOi} open interest in it, so there's no pair to show.":
    "Não há duas corretoras com pelo menos {minOi} de open interest nele, então não há par para mostrar.",
  "{asset} funding rates by exchange": "Taxas de financiamento de {asset} por corretora",
  "{asset} perpetual funding rates across {count} exchanges, with the widest long/short spread.":
    "Taxas de financiamento do perpétuo de {asset} em {count} corretoras, com o maior spread long/short.",
  "Funding by exchange": "Financiamento por corretora",
  "{markets} live markets on {venues} exchanges.":
    "Mercados ativos: {markets} em {venues} corretoras.",
  "{asset} funding across {count} exchanges: long {long} at {longApr}, short {short} at {shortApr}. A {spread} spread a year on one coin.":
    "Financiamento de {asset} em {count} corretoras: long {long} a {longApr}, short {short} a {shortApr}. Um spread de {spread} ao ano em uma só moeda.",
  "Backtest this pair": "Fazer backtest deste par",
  "long {long} · short {short} · {spread} a year, replayed on settled funding":
    "long {long} · short {short} · {spread} ao ano, replay com o financiamento pago",
  "24h settled": "Pago 24h",
  "How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "Com que frequência este mercado manteve a direção do financiamento em 30 dias. 0,50 é cara ou coroa; 0,88 é o máximo que um mês inteiro pode marcar",
  "Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had":
    "Os últimos 7 dias de cobrança contra os dias anteriores, em pontos de APR. Para cima significa que o financiamento está se ampliando na direção que já tinha",
  "30d trend": "Tendência 30d",

  // pair backtest
  "capital {amount} — {venue} will not open a position above {max} on {symbol}":
    "capital {amount} — a {venue} não abre posição acima de {max} em {symbol}",
  "capital {amount} across both legs at {leverage}":
    "capital {amount} nas duas pernas a {leverage}",
  "capital {amount} across both legs, unleveraged":
    "capital {amount} nas duas pernas, sem alavancagem",
  "capital at least {amount} across both legs — {leverage} is the small-size maximum":
    "capital de pelo menos {amount} nas duas pernas — {leverage} é o máximo para tamanhos pequenos",
  "capital {amount} across both legs at {leverage} (small size)":
    "capital {amount} nas duas pernas a {leverage} (tamanho pequeno)",
  "Cumulative funding reaches {amount} after {days} days":
    "O financiamento acumulado chega a {amount} após {days} dias",
  "Cumulative funding on {size} per leg · {from} to {to}":
    "Financiamento acumulado com {size} por perna · {from} a {to}",
  "Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.":
    "Tarifa de taker em pontos-base, por execução. As duas pernas precisam ser preenchidas antes de os custos serem cobrados.",
  "blank = ignore": "vazio = ignorar",
  Window: "Janela",
  "Long on": "Long na",
  "Short on": "Short na",
  "Size per leg": "Tamanho por perna",
  "Long taker fee": "Tarifa taker long",
  "Short taker fee": "Tarifa taker short",
  "Run backtest": "Rodar backtest",
  "swap legs": "trocar pernas",
  "What entering and exiting would cost at each exchange's top of book":
    "Quanto custaria entrar e sair no topo do livro de cada corretora",
  "price gap": "diferença de preço",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, before fees. Replayed from settled funding:":
    "Carry de financiamento de {asset}, long {long} / short {short}: {net} com {size} por perna em {span}, antes das tarifas. Replay a partir do financiamento pago:",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, after fees. Replayed from settled funding:":
    "Carry de financiamento de {asset}, long {long} / short {short}: {net} com {size} por perna em {span}, após as tarifas. Replay a partir do financiamento pago:",
  "Share on X": "Compartilhar no X",
  "opens a post with this result and a link back to it":
    "abre um post com este resultado e um link de volta",
  "after costs {net} on {fees} of fees": "após custos {net} com {fees} de tarifas",
  "never repays the fees at this rate": "nunca paga as tarifas a esta taxa",
  "fees repay in {days}": "as tarifas se pagam em {days}",
  "under a day": "menos de um dia",
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
  "best day {amount} {date}": "melhor dia {amount} {date}",
  "worst day {amount} {date}": "pior dia {amount} {date}",
  "The largest fall in cumulative funding from a previous high, before costs":
    "A maior queda do financiamento acumulado a partir de uma máxima anterior, antes dos custos",
  "max drawdown {amount}": "drawdown máximo {amount}",
  "{days}d avg {apr}": "média {days}d {apr}",
  "now {apr}, {average}, every {interval}": "agora {apr}, {average}, a cada {interval}",
  "now {apr}, every {interval}": "agora {apr}, a cada {interval}",
  "net funding over the last {span} · {apr} annualized":
    "financiamento líquido em {span} · {apr} anualizado",
  "Long {venue}": "Long {venue}",
  "{n} settlements": "pagamentos: {n}",
  "Short {venue}": "Short {venue}",
  "win rate {value} of {days} days": "taxa de acerto {value} em {days} dias",
  "average {value} a day": "média de {value} por dia",
  "Missed settlements: {long} on {longVenue}, {short} on {shortVenue}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.":
    "Pagamentos perdidos: {long} na {longVenue}, {short} na {shortVenue}. Uma lacuna é informada em vez de contada como zero, então este total cobre só os pagamentos de fato registrados.",
  "Only {have} of the {asked} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.":
    "Só {have} dos {asked} dias pedidos têm pagamentos armazenados. O número anualizado ainda divide pela janela inteira, então fica baixo. O consolidado diário guarda 70 dias, e o histórico ainda está sendo preenchido em algumas corretoras.",
  "Funding only, on a position kept at {size} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.":
    "Só financiamento, com a posição mantida em {size} por perna. As tarifas de negociação ficam de fora porque nenhuma foi informada: as tarifas de taker dependem do seu nível de volume e descontos, então preencha as tarifas das duas pernas acima para ver o resultado líquido de custos. Os movimentos de preço entre pagamentos também não são modelados, porque o histórico de financiamento das corretoras traz uma taxa e um horário, e quase nunca um preço de marcação.",
  "Net of the fees you entered, on a position kept at {size} per leg: {long} bps long and {short} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.":
    "Líquido das tarifas que você informou, com a posição mantida em {size} por perna: {long} bps no long e {short} bps no short, cobrados em quatro execuções — entrada e saída nas duas pernas. Supõe-se abrir e fechar uma vez; rolar a posição custaria isso de novo a cada vez. Os movimentos de preço entre pagamentos ainda não são modelados, porque o histórico de financiamento das corretoras traz uma taxa e um horário, e quase nunca um preço de marcação.",
  "Only one exchange lists {asset} right now, so there's no pair to hold.":
    "Só uma corretora lista {asset} agora, então não há par para manter.",
  "Pick two exchanges to hold against each other.":
    "Escolha duas corretoras para manter uma contra a outra.",
  "{asset} funding carry backtest": "Backtest de carry de financiamento de {asset}",
  "What holding {asset} long on one exchange and short on another would have paid in funding.":
    "Quanto ficar long em {asset} em uma corretora e short em outra teria pago em financiamento.",
  backtest: "backtest",
  "{asset} carry": "Carry de {asset}",
  "Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.":
    "O financiamento de cada corretora em uma janela, e o que as duas pernas que você escolher de fato pagaram, somado por dia UTC. As janelas são dias corridos inteiros terminando hoje, e os números se atualizam de hora em hora.",

  // errors
  "Too many requests": "Requisições demais",
  "Too many backtests from this address.": "Backtests demais a partir deste endereço.",
  "That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.":
    "São mais backtests do que um endereço pode rodar em um minuto. Espere um pouco e tente de novo. Resultados já calculados vêm do cache e nunca são limitados, então uma combinação que alguém já rodou carrega na hora.",
  "Back to the screener": "Voltar ao screener",
  "Not found": "Não encontrado",
  "Page not found.": "Página não encontrada.",
  "Nothing lives at {path}.": "Não há nada em {path}.",
  "See today's widest spreads": "Ver os maiores spreads de hoje",
  "A runner sprinting": "Um corredor em disparada",
  "Data center busy": "Data center ocupado",
  "The data center is too busy and a runner is on it. Try again later.":
    "O data center está ocupado demais e tem um corredor cuidando disso. Tente mais tarde.",
  "The data center is getting too busy and is currently sprinting in circles":
    "O data center está ficando ocupado demais e no momento corre em círculos",
  "Every server is screaming, the funding rates are on fire, and one intern is running the whole thing on foot. Go touch grass and try again later.":
    "Todos os servidores estão gritando, as taxas de financiamento estão pegando fogo e um estagiário toca tudo a pé. Vá dar uma volta e tente mais tarde.",
  "Try again": "Tentar de novo",
  // pages.ts invertedMark: an FX leg quoted the other way round (migration 041).
  "short this contract": "short neste contrato",
  "long this contract": "long neste contrato",
  "sell this contract": "vender este contrato",
  "buy this contract": "comprar este contrato",
  "{symbol} quotes this pair the other way round, so this side of the pair is the opposite side of that contract. Its price is shown inverted and its funding with the sign flipped, in the pair's terms.":
    "{symbol} cota este par ao contrário, então este lado do par é o lado oposto desse contrato. O preço aparece invertido e o financiamento com o sinal trocado, nos termos do par.",
  Now: "Agora",
  "Payback, days": "Retorno, dias",
  Long: "Long",
  Short: "Short",
  "7d {apr}": "7d {apr}",
  "Where to hold the long side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "Onde manter o lado long: corretora e seu financiamento agora; contrato, intervalo, open interest e financiamento de 7 dias abaixo",
  "Where to hold the short side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "Onde manter o lado short: corretora e seu financiamento agora; contrato, intervalo, open interest e financiamento de 7 dias abaixo",
  "Days of the {days}-day spread it takes to repay {bps} bps of fees: a taker fill in and out of both legs, at public retail rates":
    "Dias do spread de {days} dias necessários para pagar {bps} bps de tarifas: uma execução taker de entrada e saída nas duas pernas, a tarifas públicas de varejo",
  "No {days} days of settlements yet, so this is from the spread now: days to repay {bps} bps of fees, a taker fill in and out of both legs, at public retail rates":
    "Ainda não há {days} dias de pagamentos, então isto vem do spread atual: dias para pagar {bps} bps de tarifas, uma execução taker de entrada e saída nas duas pernas, a tarifas públicas de varejo",
  "per {unit}": "por {unit}",
  "Days of funding it takes to repay the fees of opening and closing both legs, at public retail taker rates. From the {days}-day spread; dimmed where there is only the spread now":
    "Dias de financiamento necessários para pagar as tarifas de abrir e fechar as duas pernas, a tarifas públicas de taker de varejo. Pelo spread de {days} dias; esmaecido onde só há o spread atual",
  "The funding spread now: short leg's rate minus long leg's":
    "O spread de financiamento agora: a taxa da perna short menos a da perna long",
  "The same two markets' spread, averaged over the settlements of the last {days} days":
    "O spread dos mesmos dois mercados, com média dos pagamentos dos últimos {days} dias",
  "dollars, or 250k, 1.5m": "dólares, ou 250k, 1.5m",
  "Delete preset": "Excluir predefinição",
  "No presets yet.": "Nenhuma predefinição ainda.",
  Presets: "Predefinições",
  "Preset name": "Nome da predefinição",
  "Preset name…": "Nome da predefinição…",
  Save: "Salvar",
  "Clear all": "Limpar tudo",
  "Select all": "Selecionar tudo",
  "{n} selected": "selecionados: {n}",
  Filters: "Filtros",
  "Asset class": "Classe de ativo",
  TradFi: "TradFi",
  "Spread now (APR %)": "Spread agora (APR %)",
  "Both legs settle at this interval": "As duas pernas pagam neste intervalo",
  "Funding interval": "Intervalo de financiamento",
  "No USDT leg against a USDC one": "Sem perna USDT contra uma USDC",
  "Distressed and delisting markets": "Mercados em apuros e em deslistagem",
  "Reset all": "Redefinir tudo",
  Steadiness: "Constância",
  "Funding steadiness": "Constância do financiamento",
  "How often a leg's funding kept its direction over the last 30 days: the dot beside each exchange in the Long and Short columns. The Stability column is the weaker leg's score.":
    "Com que frequência o financiamento de uma perna manteve a direção nos últimos 30 dias: o ponto ao lado de cada corretora nas colunas Long e Short. A coluna Estabilidade é a nota da perna mais fraca.",
  "Holds its direction almost every day. Income you can plan on.":
    "Mantém a direção quase todo dia. Renda com que você pode contar.",
  "Flips now and then. Usable for a carry, but size for the days it pays the other way.":
    "Vira de vez em quando. Serve para um carry, mas dimensione para os dias em que paga ao contrário.",
  "Flips often. Today's rate says little about next week's, and a backtest of it says less.":
    "Vira com frequência. A taxa de hoje diz pouco sobre a da próxima semana, e um backtest dela diz menos ainda.",
  "Scored by direction, not by the coefficient of variation: that explodes whenever the average rate sits near zero. 0.50 is a coin flip; 0.88 is the most a full month can score.":
    "Pontuado pela direção, não pelo coeficiente de variação: ele explode sempre que a taxa média fica perto de zero. 0,50 é cara ou coroa; 0,88 é o máximo que um mês inteiro pode marcar.",
  "Search asset": "Buscar ativo",
  "Search asset…": "Buscar ativo…",
  Period: "Período",
  "Rate unit": "Unidade da taxa",
  Day: "Dia",
  "No settled funding to score yet": "Nenhum financiamento pago para pontuar ainda",
  "Funding held its direction on {days} of its charging days in the last 30: {band}":
    "O financiamento manteve a direção em {days} dos seus dias de cobrança nos últimos 30: {band}",
  erratic: "errático",
  mixed: "misto",
  steady: "constante",
  Chart: "Gráfico",
  "Running the backtest…": "Rodando o backtest…",
  "pick one": "escolha uma",
  "A price-convergence pair across two exchanges.":
    "Um par de convergência de preço entre duas corretoras.",
  "All quotes": "Todas as cotações",
  Average: "Média",
  "Best bid / ask": "Melhor bid / ask",
  "Bid-ask, both books": "Bid-ask, os dois livros",
  "Breakeven move {pct}": "Movimento de equilíbrio {pct}",
  "Dollars resting at the best bid and the best ask":
    "Dólares parados no melhor bid e no melhor ask",
  "Each hour's average mark on the two exchanges. Where a venue publishes no mark, its index stands in.":
    "A marcação média de cada hora nas duas corretoras. Onde uma corretora não publica marcação, o índice entra no lugar.",
  "Entry at the top of the book": "Entrada no topo do livro",
  "Every time in the window the spread rose to at least today's width, the hours until it next fell to the window's median. Hourly averages, so nothing shorter than an hour is seen, and the past is not a promise.":
    "Cada vez que, na janela, o spread subiu pelo menos até a largura de hoje, as horas até ele voltar à mediana da janela. Médias horárias, então nada menor que uma hora aparece, e o passado não é promessa.",
  "Exit target: the window's median spread, {median}. Full convergence to zero is rare, and waiting for it usually makes no sense.":
    "Alvo de saída: o spread mediano da janela, {median}. Convergência total a zero é rara, e esperar por ela geralmente não faz sentido.",
  "Fees, four taker fills": "Tarifas, quatro execuções taker",
  "From {n} comparable episodes in the last {window}; {open} had not closed by the end.":
    "A partir de {n} episódios comparáveis em {window}; {open} não tinham fechado até o fim.",
  "Funding, est. {hold} hold": "Financiamento, estimativa para {hold} de posição",
  Gross: "Bruto",
  "Hold time, from history": "Tempo de posição, pelo histórico",
  "Hover the chart to read every line at one hour.":
    "Passe o mouse no gráfico para ler todas as linhas em uma hora.",
  "If the spread closes from where it is now to each target. Fees are four taker fills, in and out of both legs. The books are each exchange's own bid-ask, crossed half on the way in and half on the way out, at the top of the book only. Funding is the short leg's rate less the long leg's over the hold, which can pay or cost.":
    "Se o spread fechar de onde está agora até cada alvo. As tarifas são quatro execuções taker, entrada e saída nas duas pernas. Os livros são o bid-ask próprio de cada corretora, cruzado metade na entrada e metade na saída, só no topo do livro. O financiamento é a taxa da perna short menos a da perna long durante a posição, o que pode render ou custar.",
  "If the spread closes to": "Se o spread fechar em",
  "Long leg · {venue}": "Perna long · {venue}",
  "Long the exchange where the asset is cheaper, short the one where it is dearer, and close when the two prices meet. Price moves cancel between the legs; what is left is the gap closing, less fees, the books and funding. Marks are the exchanges' own fair prices, not fills, and the history is hourly averages.":
    "Fique long na corretora onde o ativo está mais barato, short naquela onde está mais caro, e feche quando os dois preços se encontrarem. Os movimentos de preço se anulam entre as pernas; o que sobra é o fechamento da diferença, menos tarifas, os livros e o financiamento. As marcações são os preços justos das próprias corretoras, não execuções, e o histórico é de médias horárias.",
  "Mark prices, hourly": "Preços de marcação, por hora",
  Median: "Mediana",
  "Not verified for this exchange: the site's retail assumption of {bps} bps":
    "Não verificado para esta corretora: a suposição de varejo do site, de {bps} bps",
  "Off the market median": "Fora da mediana do mercado",
  "One leg was listed recently or reported unevenly. The spread now is more trustworthy than the window's statistics.":
    "Uma perna foi listada recentemente ou reportou de forma irregular. O spread atual é mais confiável que as estatísticas da janela.",
  "Over the window's hours in which both legs reported a price, from each hour's average mark.":
    "Nas horas da janela em que as duas pernas reportaram preço, a partir da marcação média de cada hora.",
  "Own bid-ask": "Bid-ask próprio",
  "Price history is unavailable right now. The live figures below are unaffected.":
    "O histórico de preços está indisponível agora. Os números ao vivo abaixo não são afetados.",
  "Price spread, hourly": "Spread de preço, por hora",
  "Profit calculator": "Calculadora de lucro",
  Range: "Faixa",
  "Seen {age}": "Visto {age}",
  "Short leg · {venue}": "Perna short · {venue}",
  "Sparse history ({share}% of expected samples): statistics may be unreliable.":
    "Histórico esparso ({share}% das amostras esperadas): as estatísticas podem não ser confiáveis.",
  "Spread now (mark)": "Spread agora (marcação)",
  "Spread statistics": "Estatísticas do spread",
  "Std dev": "Desvio padrão",
  "Swap legs": "Trocar pernas",
  "Taker fee": "Tarifa de taker",
  "The exchange's published standard taker fee":
    "A tarifa padrão de taker publicada pela corretora",
  "The price gap between {long} and {short} for {asset}: now, after costs, and over its history.":
    "A diferença de preço entre {long} e {short} para {asset}: agora, após custos e ao longo do histórico.",
  "The short leg is not the dearer one right now, so there is no gap to close in this direction.":
    "A perna short não é a mais cara agora, então não há diferença a fechar nesta direção.",
  "The short leg's hourly mark less the long leg's, as a share of the long leg's. The dashed lines are the spread now and the window's median.":
    "A marcação horária da perna short menos a da perna long, como fração da perna long. As linhas tracejadas são o spread atual e a mediana da janela.",
  "The short leg's mark less the long leg's, as a share of the long leg's. Marks are each exchange's fair price, not a price anyone traded at; the entry below is what the books offer.":
    "A marcação da perna short menos a da perna long, como fração da perna long. As marcações são o preço justo de cada corretora, não um preço em que alguém negociou; a entrada abaixo é o que os livros oferecem.",
  "The spread is already at or below its median for the window ({median}): nothing to wait for.":
    "O spread já está na mediana da janela ou abaixo dela ({median}): nada a esperar.",
  "This leg's mark against the median mark of every exchange quoting the asset":
    "A marcação desta perna contra a marcação mediana de todas as corretoras que cotam o ativo",
  "This pair: long {long}, short {short}": "Este par: long {long}, short {short}",
  Ticker: "Ticker",
  "Too few comparable episodes in the last {window} to estimate how long this takes. Try a longer window.":
    "Poucos episódios comparáveis em {window} para estimar quanto tempo isso leva. Tente uma janela maior.",
  "Top of book": "Topo do livro",
  "Trade long · {venue}": "Operar long · {venue}",
  "Trade short · {venue}": "Operar short · {venue}",
  "Window {window} · {n} hours of {expected}": "Janela {window} · {n} horas de {expected}",
  "buying {venue}'s ask, selling {other}'s bid":
    "comprando o ask da {venue}, vendendo o bid da {other}",
  details: "detalhes",
  "full convergence pays {times}× the round trip":
    "a convergência total paga {times}× a ida e volta",
  "long {long} · short {short}": "long {long} · short {short}",
  "long {long} · short {short}, good for {size}; deeper fills cost more and are not shown":
    "long {long} · short {short}, comporta {size}; execuções mais profundas custam mais e não aparecem",
  "market median {price} · long {long} · short {short}":
    "mediana do mercado {price} · long {long} · short {short}",
  median: "mediana",
  pair: "par",
  "seen {long} / {short}": "visto {long} / {short}",
  "sized at {size} a leg": "com {size} por perna",
  "the book is thinner than this size": "o livro é mais raso que este tamanho",
  "thin book: only {size} rests at those prices": "livro raso: só {size} parado nesses preços",
  "typical time to close (middle half {from} to {to})":
    "tempo típico para fechar (metade central de {from} a {to})",
  "wider than {share}% of the last {window}'s hours":
    "mais largo que {share}% das horas de {window}",
  "{asset} convergence trade": "Operação de convergência de {asset}",
  "{asset} convergence trade: long {long}, short {short}":
    "Operação de convergência de {asset}: long {long}, short {short}",
  "{asset} · convergence trade": "{asset} · operação de convergência",
  "{long} bps on the long leg and {short} bps on the short, in and out":
    "{long} bps na perna long e {short} bps na short, entrada e saída",
  "{n}th percentile": "percentil {n}",
  "{venues} has no comparable {asset} book right now. Pick another exchange above.":
    "{venues} não tem um livro de {asset} comparável agora. Escolha outra corretora acima.",
  "~1h": "~1h",
  "~{n} days": "~{n} dias",
  "~{n}h": "~{n}h",
  "Price gap (bps)": "Diferença de preço (bps)",
  "Min resting size, thinner side": "Tamanho mínimo no livro, lado mais raso",
  "A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid":
    "Um mercado HIP-3: listado por um deployer terceiro e liquidado na Hyperliquid",
  "A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid, with its own book and its own risks.":
    "Um mercado HIP-3: listado por um deployer terceiro e liquidado na Hyperliquid, com livro próprio e riscos próprios.",
  "A row offers a trade only with a LONG and a SHORT leg. Everything else is context.":
    "Uma linha só oferece uma operação com uma perna LONG e uma SHORT. O resto é contexto.",
  Badges: "Selos",
  LONG: "LONG",
  "Left out of the gap: its price disagrees with the asset's deepest market by more than a real arbitrage ever does, so it is a different instrument. Hover it for how far out.":
    "Fora da diferença: o preço diverge do mercado mais profundo do ativo mais do que uma arbitragem real jamais diverge, então é outro instrumento. Passe o mouse para ver o quanto.",
  "NO LIQ": "SEM LIQ",
  "OFF-SYNC": "FORA DE SINC",
  OUTLIER: "OUTLIER",
  "Quoted more than a minute before the price it is compared with. Pairing the two would read the asset's own move in the meantime as a gap.":
    "Cotado mais de um minuto antes do preço com que é comparado. Parear os dois leria o próprio movimento do ativo nesse intervalo como uma diferença.",
  "Quoted {seconds}s before the price it is compared with":
    "Cotado {seconds}s antes do preço com que é comparado",
  SHORT: "SHORT",
  "The cheapest venue: the leg you buy.": "A corretora mais barata: a perna que você compra.",
  "The dearest venue: the leg you sell.": "A corretora mais cara: a perna que você vende.",
  "Under {volume} traded in 24 hours: a price with almost no trading behind it, which you may not be able to fill.":
    "Menos de {volume} negociado em 24 horas: um preço quase sem negociação por trás, que talvez você não consiga executar.",
  "VIA HL": "VIA HL",
  "What the badges mean": "O que os selos significam",
  "{volume} traded in 24 hours: a price with almost no trading behind it":
    "{volume} negociado em 24 horas: um preço quase sem negociação por trás",
  "Quarantined on {date}: {evidence}. Its numbers are still collected and shown here, but it is left out of the default Screener and Arbitrage rankings until the venue review clears it.":
    "Em quarentena desde {date}: {evidence}. Os números ainda são coletados e mostrados aqui, mas ela fica fora dos rankings padrão do Screener e da Arbitragem até a revisão de corretoras liberá-la.",
  quarantined: "em quarentena",
  "Quarantined exchanges are left out unless you tick them: their numbers are still collected, but not trusted to rank.":
    "Corretoras em quarentena ficam de fora a menos que você as marque: os números ainda são coletados, mas não são confiáveis para ranking.",
  "Default exchanges": "Corretoras padrão",
  "Crypto funding rate arbitrage across perp exchanges":
    "Arbitragem de taxa de financiamento cripto entre corretoras de perpétuos",
  "Live crypto funding rate spreads between perpetual futures exchanges, refreshed every minute: which exchange to long, which to short, and what the best pair paid over the last 7 days.":
    "Spreads de taxa de financiamento cripto entre corretoras de futuros perpétuos, atualizados a cada minuto: em qual corretora abrir long, em qual abrir short e quanto o melhor par rendeu nos últimos 7 dias.",
  "Find funding rate arbitrage: filter live cross-exchange funding spreads for every perpetual pair by open interest, volume, steadiness and exchange.":
    "Encontre arbitragem de taxa de financiamento: filtre os spreads de financiamento entre corretoras, ao vivo, para cada par perpétuo por open interest, volume, estabilidade e corretora.",
  "Live perpetual futures funding rates for every asset on every exchange in one grid, as APR now or averaged over 7, 30 or 60 days, with options gamma, macro and prediction market tabs.":
    "Taxas de financiamento de futuros perpétuos ao vivo para cada ativo em cada corretora, numa só tabela: APR agora ou média de 7, 30 ou 60 dias, com abas de gamma de opções, macro e mercados de previsão.",
  "Crypto arbitrage: price gaps across exchanges":
    "Arbitragem cripto: diferenças de preço entre corretoras",
  "Live crypto arbitrage across perpetual futures exchanges: where one exchange's bid sits above another's ask, by how much, and the basis between them.":
    "Arbitragem cripto ao vivo entre corretoras de futuros perpétuos: onde o bid de uma corretora fica acima do ask de outra, por quanto e qual a base entre elas.",
  "Funding rate arbitrage screener": "Screener de arbitragem de taxa de financiamento",
  "Crypto funding rates on every exchange": "Taxas de financiamento cripto em todas as corretoras",
};
