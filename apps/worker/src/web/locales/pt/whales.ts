import type { Catalog } from "../../i18n";

/**
 * /whales (web/whales.ts), its route's 404 (app/app.ts) and its nav and hotkey label, in Portuguese
 * (Brazil).
 *
 * Terms: whale orders ordens de baleia, wall muralha (bid wall muralha de compra, ask wall muralha de
 * venda), resting no livro, filled executada, pulled cancelada. A taker burst (the circles) is a
 * compra / venda taker, as Brazilian traders say it.
 */
export const whales: Catalog = {
  "{asset} is not one of the markets tracked on {venue}.":
    "{asset} não é um dos mercados acompanhados na {venue}.",
  whales: "baleias",
  bid: "compra",
  ask: "venda",
  resting: "no livro",
  filled: "executada",
  pulled: "cancelada",
  "lost track": "perdida de vista",
  "{n}m": "{n}min",
  "{d}d {h}h": "{d}d {h}h",
  "{side} wall {price} · {size} · {status} · {lived}":
    "muralha de {side} {price} · {size} · {status} · {lived}",
  "{asset} · {venue} perp · {n}-hour candles, {zone}":
    "{asset} · perpétuo {venue} · candles de {n} h, {zone}",
  "{asset} · {venue} perp · {n}-minute candles, {zone}":
    "{asset} · perpétuo {venue} · candles de {n} min, {zone}",
  "bid wall (buy orders)": "muralha de compra (ordens de compra)",
  "ask wall (sell orders)": "muralha de venda (ordens de venda)",
  "faded: filled or pulled": "apagada: executada ou cancelada",
  "last price": "último preço",
  Markets: "Mercados",
  "hide pulled walls": "ocultar muralhas canceladas",
  "show pulled walls": "mostrar muralhas canceladas",
  "Bid walls resting": "Muralhas de compra no livro",
  "{n} buy walls below the price": "{n} muralhas de compra abaixo do preço",
  "Ask walls resting": "Muralhas de venda no livro",
  "{n} sell walls above the price": "{n} muralhas de venda acima do preço",
  "Largest wall": "Maior muralha",
  "{side} at {price}": "{side} a {price}",
  "none resting": "nenhuma no livro",
  "Pulled in {window}": "Canceladas em {window}",
  "cancelled before the price reached them; {n} filled":
    "canceladas antes de o preço chegar nelas; {n} executadas",
  "No candles for {asset} yet. The collector backfills three days within a minute of a market joining the set.":
    "Ainda não há candles de {asset}. O coletor preenche três dias de histórico até um minuto depois de um mercado entrar no conjunto.",
  Side: "Lado",
  "From the last price": "A partir do último preço",
  Distance: "Distância",
  Size: "Tamanho",
  "The most it has held": "O máximo que já teve",
  Peak: "Pico",
  "Since the collector first saw it": "Desde que o coletor a viu pela primeira vez",
  "Resting since": "No livro desde",
  "No wall is resting in {asset}'s book right now.":
    "Nenhuma muralha no livro de ofertas de {asset} agora.",
  Lived: "Durou",
  Ended: "Terminou",
  How: "Como",
  "No wall ended in the last {window}.": "Nenhuma muralha terminou no período de {window}.",
  "Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.":
    "Grandes ordens limitadas paradas no livro USD-M da Binance para {asset}: um nível de preço com pelo menos {floor} por pelo menos um minuto. Uma {bid} são ordens de compra abaixo do preço, uma {ask} ordens de venda acima dele. Cada linha vai de quando o coletor viu a muralha pela primeira vez até quando ela sumiu, e é mais grossa quanto maior ela for.",
  "bid wall": "muralha de compra",
  "ask wall": "muralha de venda",
  "A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.":
    "Uma muralha que termina conta como executada se o preço chegou nela e como cancelada se foi retirada antes. As canceladas ficam ocultas por padrão: a maioria é spoofing ou cotações que andam com o preço. Muralhas são um retrato da liquidez visível, não um piso nem um teto, e não são previsão; qualquer uma pode sumir no momento em que o preço se aproxima.",
  "The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.":
    "Os quarenta mercados são os quarenta maiores em open interest somado em todas as corretoras que coletamos, lidos na Binance. O piso acompanha esse open interest. A cada reinício do coletor, o livro reaprende os níveis longe do preço conforme eles mudam, então as muralhas distantes mais antigas podem levar uma ou duas horas para reaparecer.",
  "Whale orders": "Ordens de baleia",
  "whale orders": "ordens de baleia",
  "Large resting limit orders and large market orders on Binance and Hyperliquid futures, drawn over the price: where the walls sit, how big, whether they were filled or pulled, and who hit them.":
    "Grandes ordens limitadas no livro e grandes ordens a mercado nos futuros da Binance e da Hyperliquid, desenhadas sobre o preço: onde estão as muralhas, de que tamanho, se foram executadas ou canceladas, e quem as atingiu.",
  "The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.":
    "O feed de ordens de baleia ainda não classificou seus mercados. Ele faz isso poucos minutos depois de iniciar.",
  "Resting now": "No livro agora",
  "Orders and trades": "Ordens e negócios",
  "{n} resting": "{n} no livro",
  "Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.":
    "Todas as muralhas no livro agora, da maior para a menor. A distância é a partir do último preço; tamanho é o que o nível tem agora, pico o máximo que já teve.",
  "Ended in the last {window}": "Terminadas em {window}",
  "taker buy": "compra taker",
  "taker sell": "venda taker",
  "one fill": "1 execução",
  "{n} fills": "{n} execuções",
  "{side} {size} at {price} · {fills} · {time}": "{side} {size} a {price} · {fills} · {time}",
  "large taker buy": "grande compra taker",
  "large taker sell": "grande venda taker",
  "Large buys in {window}": "Grandes compras em {window}",
  "Large sells in {window}": "Grandes vendas em {window}",
  "{n} taker bursts of {floor} or more": "{n} rajadas taker de {floor} ou mais",
  "Aggregate trades in the burst: roughly the price levels it took":
    "Negócios agregados na rajada: mais ou menos os níveis de preço que ela consumiu",
  Fills: "Execuções",
  When: "Quando",
  "No taker burst of {floor} or more in the last {window}.":
    "Nenhuma rajada taker de {floor} ou mais no período de {window}.",
  "Largest trades in the last {window}": "Maiores negócios em {window}",
  "taker {address}": "taker {address}",
  "{size} in {n} orders, one at least {proven}": "{size} em {n} ordens, uma de pelo menos {proven}",
  "no walls": "sem muralhas",
  "{bid} bid · {ask} ask": "{bid} compra · {ask} venda",
  "Pick a market": "Escolha um mercado",
  "{n} markets": "mercados: {n}",
  "Filter markets": "Filtrar mercados",
  "Walls resting, bid / ask": "Muralhas no livro, compra / venda",
  "Large taker buys minus sells, last 24 hours":
    "Grandes compras taker menos vendas, últimas 24 horas",
  "Whale flow 24h": "Fluxo de baleias 24h",
  "No market matches.": "Nenhum mercado encontrado.",
  "Orders in the bucket at the last look": "Ordens na faixa na última leitura",
  Orders: "Ordens",
  "The bucket's average order: its largest holds at least this":
    "A ordem média da faixa: a maior delas tem pelo menos isso",
  "Largest ≥": "Maior ≥",
  Taker: "Taker",
  "Proven whale orders in {venue}'s book for {asset}. {venue} publishes only its 20 nearest price buckets a side, here {step} wide, each with how many orders it holds. A wall is a bucket whose average order is at least {floor}, so at least one order in it is that big; a {bid} sits below the price, an {ask} above it. It stays a wall while the bucket still holds what that order was proven to. A whale order sharing a bucket with many small ones cannot be proven, and is not drawn.":
    "Ordens de baleia comprovadas no livro da {venue} para {asset}. A {venue} publica só as 20 faixas de preço mais próximas de cada lado, aqui com {step} de largura, cada uma com quantas ordens tem. Uma muralha é uma faixa cuja ordem média é de pelo menos {floor}, então pelo menos uma ordem nela é desse tamanho; uma {bid} fica abaixo do preço, uma {ask} acima. Ela continua sendo muralha enquanto a faixa ainda tiver o valor que comprovou aquela ordem. Uma ordem de baleia que divide a faixa com muitas pequenas não pode ser comprovada e não é desenhada.",
  "Each circle is one account's market order in one block, of at least the same {floor}; the table names the account. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the order. The chart draws the 200 largest in the window.":
    "Cada círculo é uma ordem a mercado de uma conta em um bloco, de pelo menos o mesmo {floor}; a tabela mostra a conta. Azul é um taker comprando, vermelho um taker vendendo; quanto maior o círculo, maior a ordem. O gráfico desenha as 200 maiores do período.",
  "The markets are the top forty by open interest summed across every exchange we collect, among those {venue} lists, its HIP-3 markets included (gold is xyz:GOLD). The floor scales with that open interest.":
    "Os mercados são os quarenta maiores em open interest somado em todas as corretoras que coletamos, entre os listados na {venue}, incluindo seus mercados HIP-3 (o ouro é xyz:GOLD). O piso acompanha esse open interest.",
  "Each circle is a large market order: every fill on one side in the same millisecond, counted as one burst, of at least the same {floor}. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the burst. The chart draws the 200 largest in the window.":
    "Cada círculo é uma grande ordem a mercado: todas as execuções de um lado no mesmo milissegundo, contadas como uma rajada, de pelo menos o mesmo {floor}. Azul é um taker comprando, vermelho um taker vendendo; quanto maior o círculo, maior a rajada. O gráfico desenha as 200 maiores do período.",
  "off the chart:": "fora do gráfico:",
  "last {price}": "último {price}",
  "hover or tap a candle to read it": "passe o mouse ou toque num candle para ver o valor",
  "{asset} candles; arrow keys read one at a time": "candles de {asset}; as setas leem um por vez",
  "{asset} volume per candle": "volume de {asset} por candle",
  // web/whales.ts: the GEX switch over the chart
  off: "desligado",
  "Hide the options book": "Ocultar o livro de opções",
  "Each strike's call and put gamma, as bars at the right edge":
    "A gama de calls e puts de cada strike, em barras na borda direita",
  "Strike {strike} · calls {calls} · puts {puts} · net {net} per 1% move":
    "Strike {strike} · calls {calls} · puts {puts} · líquido {net} por 1% de movimento",
  "call wall {price}": "muralha de calls {price}",
  "put wall {price}": "muralha de puts {price}",
  "call gamma": "gama de calls",
  "put gamma": "gama de puts",
  "flip {flip} · call wall {call} · put wall {put}":
    "flip {flip} · muralha de calls {call} · muralha de puts {put}",
  "{source} options, all expiries, {age}": "opções {source}, todos os vencimentos, {age}",
  "IV move": "Movimento IV",
  "The expected move a day ahead: one and two standard deviations either side of the price":
    "O movimento esperado para o próximo dia: um e dois desvios-padrão de cada lado do preço",
};
