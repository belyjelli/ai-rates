import type { Catalog } from "../../i18n";

/**
 * The Exchanges page (web/exchanges.ts) and one exchange's trading-cost section on its own page, in
 * Portuguese (Brazil). Glossary and style: ./index.ts.
 *
 * Terms: grade nota (the letters S/A/B/C/D stay as written), score pontuação, execution execução,
 * liquidity liquidez, activity atividade, order book / book livro de ofertas / livro, mid preço médio,
 * market order ordem a mercado, depth profundidade, credited contado, basket cesta, majors principais
 * moedas, snapshot leitura, median mediana, fill execução, book reach alcance do livro, taker fee
 * tarifa taker, bp bp, reserves reservas, wallets carteiras, own token token próprio, clean (without
 * the exchange's own token) limpas, collateral colateral, pillar pilar, breadth amplitude, points
 * pontos, n/a s/d, breakdown detalhamento, the leader a líder. Sizes ($10k, $100k) and bands (±0.1%,
 * ±1%) stay exactly as written; markouts, CEX, DEX and DefiLlama too.
 */
export const exchanges: Catalog = {
  // the grade badge and the table
  "Grade {grade}, score {score}: the breakdown": "Nota {grade}, pontuação {score}: o detalhamento",
  "clean, of {total} in wallets": "limpas, de {total} em carteiras",
  collateral: "colateral",
  "fee {fee}{mark}": "tarifa {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "$100k não foi executado em {n} dos livros da cesta na maior parte do tempo; cada um conta como {bps} bp",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, 2% of the exchange's daily volume or 5% of its clean reserves is not counted":
    "A nota conta {usd} disso: profundidade além de um décimo do open interest de um mercado, 2% do volume diário da corretora ou 5% das suas reservas limpas não é contada",
  "{n} of {total} assets": "{n} de {total} ativos",
  "Not measured: its order book is not read yet":
    "Não medida: o livro de ofertas dela ainda não é lido",

  // the grade's breakdown card
  Reserves: "Reservas",
  Execution: "Execução",
  Activity: "Atividade",
  Liquidity: "Liquidez",
  "not measured": "não medido",
  "no wallets published": "nenhuma carteira publicada",
  "collateral not identified: the DEXes' median": "colateral não identificado: a mediana das DEXs",
  "{clean} clean of {total} in tracked wallets":
    "{clean} limpas de {total} em carteiras acompanhadas",
  "{usd} protocol collateral": "{usd} de colateral do protocolo",
  "{cost} to trade $10k, {slip} slippage at $100k":
    "{cost} para negociar $10k, {slip} de slippage em $100k",
  "{volume} volume; no open interest published": "{volume} de volume; sem open interest publicado",
  "{oi} open interest, {volume} volume": "{oi} de open interest, {volume} de volume",
  "{usd} credited within 0.1%; {n} of {total} markets hold $100k":
    "{usd} contados dentro de 0.1%; {n} de {total} mercados têm $100k",
  "#{rank} of {of} CEXs": "#{rank} de {of} CEXs",
  "#{rank} of {of} DEXs": "#{rank} de {of} DEXs",
  "n/a": "s/d",
  "Built from this site's own reading of the order books and DefiLlama's reserves. n/a never counts as zero; its weight goes to the others. S from 85, A 70, B 55, C 40, else D.":
    "Calculada a partir da leitura dos livros de ofertas feita por este site e das reservas da DefiLlama. s/d nunca conta como zero; o peso vai para os outros. S a partir de 85, A 70, B 55, C 40, senão D.",
  "How the grade is built": "Como a nota é calculada",

  // the tiles
  "across {n} exchanges reporting now": "somando {n} corretoras que reportam agora",
  "as each exchange reports it": "como cada corretora reporta",
  "Cheapest $10k": "$10k mais barato",
  "{venue}: taker fee and slippage, the basket's mix":
    "{venue}: tarifa taker e slippage, no mix da cesta",
  "no book measured yet": "nenhum livro medido ainda",
  "Deepest books": "Livros mais profundos",
  "{venue}: credited within 0.1% of the mid, 12 majors":
    "{venue}: contado dentro de 0.1% do preço médio, 12 principais moedas",

  // column heads and their tooltips
  Grade: "Nota",
  "This site's grade after DefiLlama's REAL score: reserves, execution, activity and liquidity. A grade opens its breakdown":
    "A nota deste site seguindo a pontuação REAL da DefiLlama: reservas, execução, atividade e liquidez. Clicar numa nota abre o detalhamento",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain without its own token, a DEX's protocol collateral":
    "O que a corretora tem, segundo a DefiLlama: as carteiras de uma CEX acompanhadas on-chain, sem o token próprio; o colateral do protocolo de uma DEX",
  "Cost to trade $10k": "Custo para negociar $10k",
  "A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid":
    "Uma ordem a mercado de $10k com tudo incluído: a tarifa taker padrão publicada mais o que o livro a faz pagar além do preço médio",
  Slippage: "Slippage",
  "What a $10k and a $100k market order pay beyond the mid, from the book, before fees":
    "O que uma ordem a mercado de $10k e uma de $100k pagam além do preço médio, pelo livro, antes das tarifas",
  "The gap between the best bid and ask, basis points of the mid":
    "A diferença entre a melhor compra e a melhor venda, em pontos-base do preço médio",
  Depth: "Profundidade",
  "Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them":
    "Dólares parados dentro de 0.1% e de 1% do preço médio dos dois lados, somando os livros da cesta, como o livro público de cada corretora mostra",
  "Summed over the exchange's perpetual markets, as it reports them":
    "Somado nos mercados perpétuos da corretora, como ela reporta",
  "Live perpetual markets": "Mercados perpétuos ativos",

  // the help panel
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "Todas as corretoras de perpétuos que este site coleta, classificadas pelo custo de negociar nelas. Os custos vêm do livro de ofertas público de cada corretora, lido a cada dez minutos para doze principais moedas (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); cada número é a mediana dos últimos sete dias.",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "O custo para negociar $10k é uma ordem a mercado de $10k com tudo incluído: a tarifa taker padrão publicada pela corretora (níveis VIP, tokens de tarifa e rebates a reduzem) mais o que o livro faz a ordem pagar além do preço médio, incluindo metade do spread. O slippage é só essa segunda parte, em $10k e $100k. Cada ativo pesa pelo seu open interest em todas as corretoras, então todas são precificadas com o mesmo mix.",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that.":
    "A profundidade é o valor em dólares parado dentro de 0.1% e de 1% do preço médio, como o livro público de cada corretora mostra. As corretoras publicam só alguns níveis (os da Binance alcançam cerca de 0.15% em torno do BTC), então o número de 1% é um piso e a nota usa o de 0.1%, que todo livro medido alcança. Um único nível maior que 5% do open interest do mercado só conta até esse limite.",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade follows DefiLlama's REAL score: reserves 30, execution 30, activity 20, liquidity 20. A grade opens its breakdown; how each pillar is built is under the table.":
    "Isto é o que os livros prometem, não execuções: nenhum negócio é medido, então markouts (para onde o preço vai depois de uma execução) não aparecem. A nota segue a pontuação REAL da DefiLlama: reservas 30, execução 30, atividade 20, liquidez 20. Clicar numa nota abre o detalhamento; como cada pilar é calculado está abaixo da tabela.",

  // how the grade is built
  "{n} points": "{n} pontos",
  "After DefiLlama's REAL score: a weighted mean of four pillars, each 0 to 100. Sizes are on a log scale, so an exchange a tenth the size of the leader still scores about 70. A pillar this site cannot measure for an exchange hands its weight to the others and never counts as zero. CEXes and DEXes are scored together and ranked within their own kind. Fixed bands, so a new exchange does not reshuffle the rest: S from 85, A from 70, B from 55, C from 40, D below.":
    "Segue a pontuação REAL da DefiLlama: uma média ponderada de quatro pilares, cada um de 0 a 100. Os tamanhos ficam em escala logarítmica, então uma corretora com um décimo do tamanho da líder ainda faz cerca de 70. Um pilar que este site não consegue medir para uma corretora passa o peso para os outros e nunca conta como zero. CEXs e DEXs são pontuadas juntas e classificadas dentro do próprio tipo. Faixas fixas, então uma corretora nova não embaralha as outras: S a partir de 85, A a partir de 70, B a partir de 55, C a partir de 40, D abaixo disso.",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain, without its own token; a DEX's protocol collateral, a floor, since market makers' money can sit elsewhere. Two thirds is size against the largest; one third is whether its open interest, a day's volume and the book it shows within 1% are sizes it could back, and how much of it is its own token. A CEX publishing no wallets scores 0; a DEX whose collateral is not identified scores the DEXes' median.":
    "O que a corretora tem, segundo a DefiLlama: as carteiras de uma CEX acompanhadas on-chain, sem o token próprio; o colateral do protocolo de uma DEX, que é um piso, já que o dinheiro dos market makers pode estar em outro lugar. Dois terços são o tamanho em relação à maior; um terço é se o open interest, o volume de um dia e o livro que mostra dentro de 1% são tamanhos que ela conseguiria cobrir, e quanto disso é token próprio. Uma CEX que não publica carteiras faz 0; uma DEX cujo colateral não é identificado fica com a mediana das DEXs.",
  "What a market order costs, from each exchange's book every ten minutes over seven days: $10k all in (the published standard taker fee and the walk through the book), and what $10k and $100k pay beyond the mid, each against the cheapest exchange. DefiLlama also scores markouts and fills against the quote; those need trades, which this site does not record, so their weight goes to cost and slippage.":
    "Quanto custa uma ordem a mercado, pelo livro de cada corretora a cada dez minutos ao longo de sete dias: $10k com tudo incluído (a tarifa taker padrão publicada e o caminho pelo livro), e o que $10k e $100k pagam além do preço médio, cada um em relação à corretora mais barata. A DefiLlama também pontua markouts e execuções contra a cotação; isso exige negócios, que este site não registra, então o peso vai para custo e slippage.",
  "Open interest, credited up to three times clean reserves, and a day's volume, credited up to five times open interest, each against the leader. An exchange that publishes no open interest is scored on volume alone, credited up to three times clean reserves.":
    "O open interest, contado até três vezes as reservas limpas, e o volume de um dia, contado até cinco vezes o open interest, cada um em relação à líder. Uma corretora que não publica open interest é pontuada só pelo volume, contado até três vezes as reservas limpas.",
  "Depth within 0.1% of the mid across the twelve majors, credited up to a tenth of each market's open interest, 2% of the exchange's daily volume and 5% of its clean reserves; and breadth, how many of the twelve hold $100k within 0.1%. Halved for a CEX publishing no reserves.":
    "A profundidade dentro de 0.1% do preço médio nas doze principais moedas, contada até um décimo do open interest de cada mercado, 2% do volume diário da corretora e 5% das suas reservas limpas; e a amplitude, quantas das doze têm $100k dentro de 0.1%. Cortada pela metade para uma CEX que não publica reservas.",
  "These are this site's grades by DefiLlama's method, not DefiLlama's scores. What exchanges report about themselves counts only as far as it can be checked: open interest up to three times reserves, volume up to five times open interest. Reputation, age, brand and listings count not at all.":
    "Estas são notas deste site pelo método da DefiLlama, não as pontuações da DefiLlama. O que as corretoras reportam sobre si mesmas só conta até onde pode ser verificado: open interest até três vezes as reservas, volume até cinco vezes o open interest. Reputação, idade, marca e listagens não contam nada.",

  // the page description and notes
  "Every perpetual futures exchange tracked by airrates, graded on reserves, trading cost, activity and liquidity: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "Todas as corretoras de futuros perpétuos acompanhadas pelo airrates, com nota por reservas, custo de negociação, atividade e liquidez: tarifa taker e slippage em $10k e $100k, profundidade, open interest e volume.",
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "Livros de ofertas medidos desde {date}; os números são as medianas dos últimos sete dias.",
  "Order books are not measured yet.": "Os livros de ofertas ainda não são medidos.",
  "Reserves: DefiLlama, read every six hours.": "Reservas: DefiLlama, lidas a cada seis horas.",
  "Reserves are not available right now; the grade goes on without them.":
    "As reservas não estão disponíveis agora; a nota segue sem elas.",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* Nenhuma tarifa taker publicada encontrada para {venues}: é usado o padrão do site de {bps} bp.",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "Ainda sem nota: corretoras cujo livro de ofertas não é lido. Ainda não coletadas: {venues}.",

  // one exchange's trading cost
  "not listed": "não listado",
  "$100k did not fill in most snapshots": "$100k não foi executado na maioria das leituras",
  "did not fill": "não executado",
  "{pct}%": "{pct}%",
  "Trading cost": "Custo de negociação",
  "{value} to trade $10k": "{value} para negociar $10k",
  "taker fee {fee}{mark}": "tarifa taker {fee}{mark}",
  "{value} slippage at $100k": "{value} de slippage em $100k",
  "{value} within 0.1%": "{value} dentro de 0.1%",
  "What a $10k market order pays beyond the mid, before fees":
    "O que uma ordem a mercado de $10k paga além do preço médio, antes das tarifas",
  "$10k slippage": "Slippage de $10k",
  "What a $100k market order pays beyond the mid, before fees":
    "O que uma ordem a mercado de $100k paga além do preço médio, antes das tarifas",
  "$100k slippage": "Slippage de $100k",
  "Depth ±0.1%": "Profundidade ±0.1%",
  "Depth ±1%": "Profundidade ±1%",
  "How far from the mid the published book reached":
    "Até onde o livro publicado chegou a partir do preço médio",
  "Book reach": "Alcance do livro",
  "Snapshots in the last seven days": "Leituras nos últimos sete dias",
  Samples: "Amostras",
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. Reserves are DefiLlama's.":
    "Medianas dos últimos sete dias de leituras do livro de ofertas público da {venue}, a cada dez minutos; os custos são os do livro, não execuções. As reservas são da DefiLlama.",
  "Quarantined: left out of the default rankings. {evidence}":
    "Em quarentena: fora dos rankings padrão. {evidence}",
  Quarantined: "Em quarentena",
  "Quarantined: {venues}. Their numbers failed the venue review's checks (funding copied from another exchange, or volume and open interest far beyond what their reserves could back), so they are still collected and shown here but left out of the default Screener and Arbitrage rankings; tick them in the exchange picker to rank them.":
    "Em quarentena: {venues}. Os números delas falharam nas verificações da revisão de corretoras (financiamento copiado de outra corretora, ou volume e open interest muito acima do que as reservas conseguiriam cobrir), então continuam sendo coletadas e mostradas aqui, mas ficam fora dos rankings padrão do Screener e de Arbitragem; marque-as no seletor de corretoras para classificá-las.",
};
