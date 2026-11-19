/**
 * web/liquidations.ts in Portuguese (Brazil): the /liquidations map, the priced grid, the
 * longs-vs-shorts chart, the whale map, Largest, Cascades, the member tabs (History, vs OI, All
 * cascades, Top traders) and the summary sentences. Glossary and style: ./index.ts.
 *
 * Window codes ("24h", "7d") are left as written, as interval figures are elsewhere on the site: they
 * are units in a control strip and in its URLs, not words. Because a window can be hours or days,
 * sentences around one say "no período de {window}", which needs no gender.
 */

import type { Catalog } from "../../i18n";

export const liquidations: Catalog = {
  // Axis dates.
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

  // Controls and legend.
  Window: "Janela",
  Venue: "Corretora",
  all: "todas",
  Cell: "Célula",
  "longs closed": "longs liquidados",
  "shorts closed": "shorts liquidados",
  "Band width": "Largura da faixa",
  Asset: "Ativo",
  fit: "ajustar",

  // The map tab.
  "{usd} across {count} liquidation — {long} long, {short} short":
    "{usd} em {count} liquidação — {long} long, {short} short",
  "{usd} across {count} liquidations — {long} long, {short} short":
    "{usd} em {count} liquidações — {long} long, {short} short",
  "This column is still filling": "Esta coluna ainda está se completando",
  "<b>{usd}</b> · {events} liquidations · {markets} markets":
    "<b>{usd}</b> · {events} liquidações · {markets} mercados",
  "no liquidations in this window": "nenhuma liquidação nesta janela",
  "other markets": "outros mercados",
  total: "total",
  "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.":
    "Nenhuma liquidação registrada no período de {window}. Só aparecem aqui as corretoras que publicam um feed lido pelo coletor, então uma janela calma não quer dizer um mercado calmo.",
  "Columns are {hours}-hour buckets in {zone}, newest on the right; the last one is still filling.":
    "As colunas são blocos de {hours} h em {zone}, o mais recente à direita; o último ainda está se completando.",
  "Newest liquidation {age}.": "Liquidação mais recente {age}.",
  "Rows are the {count} busiest assets by notional across every feed, and the rest are summed into “other markets”, so the totals below the grid are real totals and add up.":
    "As linhas são os {count} ativos com mais valor nocional em todos os feeds, e o resto é somado em “outros mercados”, então os totais abaixo da grade são totais de verdade e batem.",
  "Any row opens that asset at the price it died at.":
    "Qualquer linha abre esse ativo pelo preço em que as posições foram liquidadas.",

  // The priced tab.
  "<b>{usd}</b> · {events} liquidations · {long} long / {short} short":
    "<b>{usd}</b> · {events} liquidações · {long} long / {short} short",
  "nothing force-closed here in this window": "nada liquidado aqui nesta janela",
  "Fill price": "Preço de execução",
  "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.":
    "Nenhum mercado ativo de {asset} está publicando preço de marcação, então não há preço para agrupar as liquidações em faixas.",
  "No liquidations recorded for {asset} in the last {window}. Only the venues publishing a feed the collector reads appear here.":
    "Nenhuma liquidação de {asset} registrada no período de {window}. Só aparecem aqui as corretoras que publicam um feed lido pelo coletor.",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark; the outer rows hold everything further out.":
    "Mostrando <b>{asset}</b>, em faixas de {pct}% em torno do preço de marcação; as linhas das pontas reúnem tudo o que está mais longe.",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark, fitted to where this asset's closes actually landed; the outer rows hold everything further out.":
    "Mostrando <b>{asset}</b>, em faixas de {pct}% em torno do preço de marcação, ajustadas a onde as liquidações deste ativo realmente caíram; as linhas das pontas reúnem tudo o que está mais longe.",
  "Banded from <b>{mark}</b>, the deepest market's mark — the same anchor the arbitrage guard uses, so both venues share rows.":
    "Faixas a partir de <b>{mark}</b>, o preço de marcação do mercado mais profundo — a mesma âncora que a proteção de arbitragem usa, então as duas corretoras compartilham as linhas.",

  // The longs-vs-shorts tab and its chart.
  "Last {window}": "Últimos {window}",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Longs took the beating.":
    "Liquidações de {asset}, últ. {window}: {long} em longs e {short} em shorts liquidados, {events} eventos. Os longs apanharam mais.",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Shorts took the beating.":
    "Liquidações de {asset}, últ. {window}: {long} em longs e {short} em shorts liquidados, {events} eventos. Os shorts apanharam mais.",
  "{asset} longs vs shorts over time · {hours}-hour bars, {zone}":
    "{asset} longs vs shorts no tempo · barras de {hours} h, {zone}",
  "{asset} longs vs shorts over time · {minutes}-minute bars, {zone}":
    "{asset} longs vs shorts no tempo · barras de {minutes} min, {zone}",
  "Longs closed": "Longs liquidados",
  "Shorts closed": "Shorts liquidados",
  "Longs at risk, modeled · price falls <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "Longs em risco, modelado · o preço cai <b>{pct}</b> até {range} · cerca de <b>{usd}</b> seria liquidado",
  "Shorts at risk, modeled · price rises <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "Shorts em risco, modelado · o preço sobe <b>{pct}</b> até {range} · cerca de <b>{usd}</b> seria liquidado",
  "Shorts at risk above": "Shorts em risco acima",
  "Longs at risk below": "Longs em risco abaixo",
  "Modeled pending liquidations between {low} and {high}, around {mark}: about {shorts} of shorts above and {longs} of longs below":
    "Liquidações pendentes modeladas entre {low} e {high}, em torno de {mark}: cerca de {shorts} em shorts acima e {longs} em longs abaixo",
  "Pending range": "Faixa pendente",
  "Zoom in": "Aproximar",
  "Columns are time, in your time zone ({zone}; click the clock at the top for UTC). Each is a {hours}-hour block named by its start hour. Where the day changes, the column shows date/hour (7/00 = the 7th at 00:00). The yellow column is the block in progress and still filling.":
    "As colunas são o tempo, no seu fuso horário ({zone}; clique no relógio no topo para ver em UTC). Cada uma é um bloco de {hours} h com o nome da hora de início. Onde o dia muda, a coluna mostra dia/hora (7/00 = dia 7 às 00:00). A coluna amarela é o bloco em andamento, que ainda está se completando.",
  "'All' is that price row's total over the whole window.":
    "“Tudo” é o total dessa linha de preço na janela inteira.",
  "{range}, still filling": "{range}, ainda se completando",
  "This tab did not load.": "Esta aba não carregou.",
  "Try again": "Tentar de novo",
  "Loading…": "Carregando…",
  "Open this tab": "Abrir esta aba",
  "This tab has nothing to show right now.": "Esta aba não tem nada para mostrar agora.",
  "Zoom out": "Afastar",
  "shorts liquidate if price rises": "shorts são liquidados se o preço subir",
  "longs liquidate if price falls": "longs são liquidados se o preço cair",
  "pending is modeled": "o pendente é modelado",
  "pending by price band": "pendente por faixa de preço",
  "axis squeezed above {usd}": "eixo comprimido acima de {usd}",
  "Modeled from 30 days of open interest and price on each market and its leverage limits, not reported by venues.":
    "Modelado a partir de 30 dias de open interest e preço de cada mercado e dos seus limites de alavancagem, não reportado pelas corretoras.",
  Pending: "Pendente",
  "Pending on": "Pendente ligado",
  "Pending off": "Pendente desligado",
  "hover or tap a bar to read it": "passe o mouse ou toque numa barra para ver o valor",
  "{asset} bars; arrow keys read one at a time": "barras de {asset}; as setas leem uma de cada vez",
  "{asset} longs closed above zero and shorts closed below, over the last {window}":
    "{asset}: longs liquidados acima do zero e shorts liquidados abaixo, no período de {window}",
  "Longs closed above the line, shorts closed below, on the same linear scale. Hover a bar to read it beside the cursor; on a phone, tap and it reads in the line above the chart. The last bar is still filling.":
    "Longs liquidados acima da linha, shorts liquidados abaixo, na mesma escala linear. Passe o mouse numa barra para ler ao lado do cursor; no celular, toque e o valor aparece na linha acima do gráfico. A última barra ainda está se completando.",
  "{usd} of longs closed between {band}": "{usd} em longs liquidados entre {band}",
  "{usd} of shorts closed between {band}": "{usd} em shorts liquidados entre {band}",
  "Longs closed <b>{usd}</b> · {share}%": "Longs liquidados <b>{usd}</b> · {share}%",
  "Shorts closed <b>{usd}</b> · {share}%": "Shorts liquidados <b>{usd}</b> · {share}%",
  All: "Tudo",
  "Nothing was force-closed in {asset} in the last {window}, on either side.":
    "Nada foi liquidado em {asset} no período de {window}, em nenhum dos lados.",
  "Showing <b>{asset}</b>, every exchange added together — the split by exchange is one tab along. Rows are the same {pct}% price bands, banded from <b>{mark}</b>. A long close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran against. Any asset outside this list opens from a row on the map tab.":
    "Mostrando <b>{asset}</b>, com todas as corretoras somadas — a divisão por corretora fica na aba ao lado. As linhas são as mesmas faixas de preço de {pct}%, a partir de <b>{mark}</b>. A liquidação de um long é uma VENDA forçada e a de um short uma COMPRA forçada, então o lado mais pesado é aquele contra o qual o movimento foi. Qualquer ativo fora desta lista abre a partir de uma linha na aba do mapa.",

  // The page.
  "Nothing has been force-closed in this window, so there is no asset to price.":
    "Nada foi liquidado nesta janela, então não há ativo para mostrar por preço.",
  "Nothing has been force-closed in this window, so there is no asset to split.":
    "Nada foi liquidado nesta janela, então não há ativo para dividir entre longs e shorts.",
  "{first} and {last}": "{first} e {last}",
  ", ": ", ",
  Liquidations: "Liquidações",
  "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.":
    "Onde as posições foram liquidadas: por corretora, ativo e hora, e pelo nível de preço em que caíram.",
  "Where positions were force-closed, by exchange. Colour is the side that was closed — {longs}, {shorts} — and intensity is the money, on a log scale.":
    "Onde as posições foram liquidadas, por corretora. A cor é o lado liquidado — {longs}, {shorts} — e a intensidade é o dinheiro, em escala logarítmica.",
  "blue for longs": "azul para longs",
  "red for shorts": "vermelho para shorts",
  "No venue has reported a liquidation in this window.":
    "Nenhuma corretora reportou liquidação nesta janela.",
  "This is {venues}, the one venue whose liquidation feed the collector reads — not the whole market.":
    "Isto é a {venues}, a única corretora cujo feed de liquidações o coletor lê — não o mercado inteiro.",
  "This is {venues}, the {count} venues whose liquidation feed the collector reads — not the whole market.":
    "Isto é {venues}, as {count} corretoras cujo feed de liquidações o coletor lê — não o mercado inteiro.",
  "Asset Timeline": "Linha do tempo por ativo",
  Timeline: "Linha do tempo",
  Assets: "Ativos",
  "Longs vs shorts": "Longs vs shorts",
  "{asset} longs vs shorts": "{asset} longs vs shorts",
  Sides: "Lados",
  "By price level": "Por nível de preço",
  "{asset} price levels": "{asset} níveis de preço",
  Prices: "Preços",
  "Updated {ago}.": "Atualizado {ago}.",

  // The odds tab.
  Odds: "Probabilidades",
  "{asset} odds": "{asset} probabilidades",
  "Nothing has been force-closed in this window, so there is no asset to size.":
    "Nada foi liquidado nesta janela, então não há ativo para medir.",
  "4 hours": "4 horas",
  "6 hours": "6 horas",
  "1 day": "1 dia",
  "1 week": "1 semana",
  Within: "Em até",
  "Typical move (1 sigma)": "Movimento típico (1 sigma)",
  "Closes higher than now": "Fecha acima do preço atual",
  "Reaches the heaviest forced-close level": "Chega ao nível com mais liquidações",
  "Whichever of those two it reaches first": "O que ele alcançar primeiro dos dois",
  "The upper one first": "O de cima primeiro",
  "The lower one first": "O de baixo primeiro",
  Neither: "Nenhum",
  "Reaches a move of": "Chega a um movimento de",
  "{price} ({where}) · {usd} closed, {share} of the window":
    "{price} ({where}) · {usd} liquidados, {share} da janela",
  Theory: "Teoria",
  "Reading now": "Leitura atual",
  Leans: "Inclinação",
  "Moves the odds?": "Muda as probabilidades?",
  up: "alta",
  down: "baixa",
  "Forced-close burst fades": "Onda de liquidações perde força",
  "Funding crowding fades": "Aglomeração no financiamento perde força",
  "Stretch from the 50-hour average fades": "Desvio da média de 50 horas volta",
  "Initiative vs absorption": "Iniciativa vs absorção",
  "Fear and greed": "Medo e ganância",
  "Liquidation magnet": "Ímã de liquidações",
  "Needs open positions by price level. The collector keeps closed ones only, so this cannot be read yet.":
    "Precisa de posições abertas por nível de preço. O coletor só guarda as liquidadas, então isto ainda não pode ser lido.",
  "Fewer than 5 forced closes in the last 4 hours: too thin to call a burst.":
    "Menos de 5 liquidações nas últimas 4 horas: pouco demais para chamar de onda.",
  "Not enough data.": "Dados insuficientes.",
  "{longs} of the last 4 hours' forced closes were longs ({usd} in all)":
    "{longs} das liquidações das últimas 4 horas foram longs ({usd} no total)",
  "{apr} a year funding, weighted by open interest":
    "financiamento de {apr} ao ano, ponderado pelo open interest",
  "{sigma} bar-sigmas above its 50-hour average":
    "{sigma} sigmas de barra acima da média de 50 horas",
  "{sigma} bar-sigmas below its 50-hour average":
    "{sigma} sigmas de barra abaixo da média de 50 horas",
  "takers net buying {pct} of volume": "takers comprando líquido {pct} do volume",
  "takers net selling {pct} of volume": "takers vendendo líquido {pct} do volume",
  "{flow}, price {change} over 4 hours": "{flow}, preço {change} em 4 horas",
  "{score} out of 100": "{score} de 100",
  "No. Not yet tested, so it carries no weight.": "Não. Ainda não foi testada, então não tem peso.",
  "No. Context only: its claim never leans.": "Não. Só contexto: ela nunca aponta um lado.",
  "No. Cannot be computed.": "Não. Não pode ser calculada.",
  "There is not yet enough price history for {asset} to size its moves, or no live market is publishing a mark. The odds need at least 12 hours of closes.":
    "Ainda não há histórico de preço suficiente de {asset} para medir os movimentos, ou nenhum mercado ativo está publicando preço de marcação. As probabilidades precisam de pelo menos 12 horas de fechamentos.",
  "These are the odds that <b>{asset}</b> reaches a price within each horizon, worked out from how far it has actually been moving: about {hourly} an hour over the last {hours} hours. They are not a forecast of direction.":
    "Estas são as probabilidades de <b>{asset}</b> chegar a um preço em cada horizonte, calculadas a partir de quanto ele de fato vem se movendo: cerca de {hourly} por hora nas últimas {hours} horas. Não são uma previsão de direção.",
  "The levels are where the most dollars were force-closed in the last {window}. Those positions are gone, so a heavy level is somewhere price has been, not fuel waiting for it. The collector does not keep open positions by price, so the resting map a liquidation magnet needs cannot be built yet.":
    "Os níveis são onde mais dólares foram liquidados no período de {window}. Essas posições já se foram, então um nível pesado é um lugar por onde o preço já passou, não combustível esperando por ele. O coletor não guarda posições abertas por preço, então o mapa de posições paradas que um ímã de liquidações precisa ainda não pode ser montado.",
  "Real prices have fatter tails than this model assumes, so the far levels are reached more often than shown. Volatility is measured over the recent past and held constant.":
    "Preços reais têm caudas mais grossas do que este modelo supõe, então os níveis distantes são alcançados com mais frequência do que o mostrado. A volatilidade é medida no passado recente e mantida constante.",
  "Odds of reaching a level, from {asset}'s own volatility. They say how far it can go, not which way. The chance of closing higher stays at 50% until a theory below passes a test set in advance, after costs.":
    "Probabilidades de chegar a um nível, a partir da própria volatilidade de {asset}. Dizem até onde ele pode ir, não para que lado. A chance de fechar acima fica em 50% até que uma teoria abaixo passe num teste definido de antemão, já descontados os custos.",
  "Levels closer than the 4-hour typical move ({pct}) are left out, because price is already standing in them.":
    "Níveis mais próximos que o movimento típico de 4 horas ({pct}) ficam de fora, porque o preço já está neles.",
  "No forced-close level lies beyond the 4-hour typical move":
    "Nenhum nível de liquidação fica além do movimento típico de 4 horas",
  "What the liquidation theories read now": "O que as teorias de liquidação leem agora",
  "A reading that leans one way is a hypothesis, not a signal: none of these has been shown to beat the base rate. The first three are measured against a fade, the way their test was written down in advance, and a flat reading leans nowhere.":
    "Uma leitura que aponta um lado é uma hipótese, não um sinal: nenhuma delas provou superar a taxa base. As três primeiras são medidas contra uma reversão, do jeito que o teste delas foi escrito de antemão, e uma leitura lateral não aponta para lado nenhum.",
  // web/liquidations.ts: the whale map tab.
  "Nothing has been force-closed in this window, so there is no asset to map.":
    "Nada foi liquidado nesta janela, então não há ativo para mapear.",
  "Position size": "Tamanho da posição",
  "Price range": "Faixa de preço",
  "Whale map": "Mapa de baleias",
  "{asset} whale map": "{asset} mapa de baleias",
  Whales: "Baleias",

  // web/whale-map.ts
  "mark {price}": "marcação {price}",
  "{n} positions of {floor} or more · {longs} of longs, {shorts} of shorts · hover or tap a bar to read it":
    "{n} posições de {floor} ou mais · {longs} em longs, {shorts} em shorts · passe o mouse ou toque numa barra para ver o valor",
  "Beyond ±{pct} of the mark, off the chart: {longs} of longs and {shorts} of shorts.":
    "Além de ±{pct} da marcação, fora do gráfico: {longs} em longs e {shorts} em shorts.",
  "{asset} · whale positions by liquidation price · {venues}":
    "{asset} · posições de baleias por preço de liquidação · {venues}",
  "Longs liquidate": "Longs liquidados",
  "Shorts liquidate": "Shorts liquidados",
  "Total to the mark": "Total até a marcação",
  "{asset} price bands; arrow keys read one at a time":
    "faixas de preço de {asset}; as setas leem uma por vez",
  "{asset} whale positions by the price they liquidate at":
    "posições de baleias em {asset} pelo preço em que são liquidadas",
  "Every position here is one an exchange publishes for a named account: reported, not modeled. Only Hyperliquid, Lighter and dYdX publish every account's positions, and together they hold about a tenth of the open interest; Binance, OKX and the other centralized exchanges publish none, so they are not in this map.":
    "Cada posição aqui é uma que a corretora publica para uma conta identificada: reportada, não modelada. Só Hyperliquid, Lighter e dYdX publicam as posições de todas as contas, e juntas têm cerca de um décimo do open interest; Binance, OKX e as outras corretoras centralizadas não publicam nenhuma, então não estão neste mapa.",
  "Hyperliquid and Lighter report each position's liquidation price. dYdX does not, so its are computed from the account's own balance and positions with dYdX's maintenance margins, holding its other prices where they are; they are marked * in the table.":
    "Hyperliquid e Lighter informam o preço de liquidação de cada posição. A dYdX não, então os dela são calculados a partir do saldo e das posições da própria conta com as margens de manutenção da dYdX, mantendo os outros preços onde estão; aparecem marcados com * na tabela.",
  "On Hyperliquid the collector watches the leaderboard's accounts worth $100k or more and any account it sees in a large trade, re-reading each every few minutes while it holds $1M or more and hourly while it holds $100k. On Lighter it follows the leaderboard's owners with $100k in the account or a $100k position, whose changes arrive as they happen. On dYdX it reads every account on the chain every five minutes. So the map covers the largest traders, not every account.":
    "Na Hyperliquid, o coletor acompanha as contas do ranking com $100k ou mais e qualquer conta que aparece num negócio grande, relendo cada uma a cada poucos minutos enquanto tiver $1M ou mais e a cada hora enquanto tiver $100k. Na Lighter, segue os donos do ranking com $100k na conta ou uma posição de $100k, cujas mudanças chegam na hora. Na dYdX, lê todas as contas da rede a cada cinco minutos. Então o mapa cobre os maiores traders, não todas as contas.",
  "A cross-margin position's liquidation price moves with the rest of its account: its other positions' profit and loss, deposits and withdrawals. Each one is as of its account's last read, shown in the table. Bars are the money that liquidates in each price band, longs below the mark and shorts above; the lines add up everything between the mark and that price.":
    "O preço de liquidação de uma posição em margem cruzada se move com o resto da conta: o lucro e prejuízo das outras posições, depósitos e saques. Cada uma vale pela última leitura da conta, mostrada na tabela. As barras são o dinheiro liquidado em cada faixa de preço, longs abaixo da marcação e shorts acima; as linhas somam tudo entre a marcação e aquele preço.",
  "The whale positions could not be read right now.":
    "Não foi possível ler as posições de baleias agora.",
  "No position of {floor} or more in {asset} among the accounts watched.":
    "Nenhuma posição de {floor} ou mais em {asset} entre as contas acompanhadas.",
  "There are {n} of $100k or more: switch to $100k+.": "Há {n} de $100k ou mais: mude para $100k+.",
  "nearest at {price} ({pct})": "mais próxima em {price} ({pct})",
  "none with a liquidation price": "nenhuma com preço de liquidação",
  "Whale longs": "Longs de baleias",
  "{n} positions": "posições: {n}",
  "Whale shorts": "Shorts de baleias",
  "Within 5% of the mark": "Até 5% da marcação",
  "longs below / shorts above": "longs abaixo / shorts acima",
  Accounts: "Contas",
  "read a median {age}": "lidas há uma mediana de {age}",
  "No live mark for {asset}, so the positions cannot be placed on a price axis.":
    "Sem preço de marcação ativo para {asset}, então as posições não podem ser colocadas num eixo de preço.",
  long: "long",
  short: "short",
  "No liquidation price: the account's margin covers any move":
    "Sem preço de liquidação: a margem da conta cobre qualquer movimento",
  "dYdX publishes no liquidation price: computed from the account's balance and positions with dYdX's maintenance margins":
    "A dYdX não publica preço de liquidação: calculado a partir do saldo e das posições da conta com as margens de manutenção da dYdX",
  "By venue:": "Por corretora:",
  none: "nenhum",
  "{leverage}× isolated": "{leverage}× isolada",
  // Cross margin, not the chart cursor's crosshair (charts.ts's "cross").
  "{leverage}× cross": "{leverage}× cruzada",
  "The {n} nearest to liquidation of {total}.": "As {n} mais próximas da liquidação, de {total}.",
  Trader: "Trader",
  Value: "Valor",
  Entry: "Entrada",
  "Liquidates at": "Liquida em",
  "From the market's mark to the liquidation price":
    "Da marcação do mercado até o preço de liquidação",
  Leverage: "Alavancagem",
  Unrealized: "Não realizado",
  "The whole account's value on its venue": "O valor da conta inteira na corretora",
  Account: "Conta",
  Read: "Lida",
  // Before a link to the member login, inside the sentence below.
  "Log in": "Entrar",
  "Refreshes every 30 s. {login} to refresh every 10 s, with the nearest accounts re-read about every minute.":
    "Atualiza a cada 30 s. {login} para atualizar a cada 10 s, com as contas mais próximas relidas mais ou menos a cada minuto.",
  "Live for members: refreshes every 10 s, and the nearest accounts are re-read about every minute.":
    "Ao vivo para membros: atualiza a cada 10 s, e as contas mais próximas são relidas mais ou menos a cada minuto.",
  Indexes: "Índices",
  "Other stocks": "Outras ações",
  "Energy and other commodities": "Energia e outras commodities",
  FX: "Câmbio",
  "{long} long · {short} short": "{long} long · {short} short",
  "Pick an asset": "Escolha um ativo",
  "Filter assets": "Filtrar ativos",
  Liquidated: "Liquidado",
  "Longs / shorts": "Longs / shorts",
  Events: "Eventos",
  "{asset} liquidations across exchanges: longs against shorts by the hour, the price levels positions were closed at, and where large open positions would be liquidated.":
    "Liquidações de {asset} nas corretoras: longs contra shorts por hora, os níveis de preço em que as posições foram liquidadas e onde grandes posições abertas seriam liquidadas.",
  "All assets": "Todos os ativos",
  "{n} exchange": "{n} corretora",
  "{n} asset": "{n} ativo",
  "In the last 7 days": "Nos últimos 7 dias",
  "In the last 48 hours": "Nas últimas 48 horas",
  "In the last 24 hours": "Nas últimas 24 horas",
  "{share} of it longs": "{share} em longs",
  "{share} of it shorts": "{share} em shorts",
  "{window}, no {asset} position was force-closed on the exchanges whose liquidation feeds the collector reads.":
    "{window}, nenhuma posição de {asset} foi liquidada nas corretoras cujos feeds de liquidação o coletor lê.",
  "{window}, {total} of {asset} positions were force-closed in {events} on {venues}, {sides}.":
    "{window}, {total} em posições de {asset} foram liquidados em {events}, em {venues}, {sides}.",
  "The largest single one was a {usd} long on {venue} at {price}, {ago}.":
    "A maior delas foi um long de {usd} na {venue} a {price}, {ago}.",
  "The largest single one was a {usd} short on {venue} at {price}, {ago}.":
    "A maior delas foi um short de {usd} na {venue} a {price}, {ago}.",
  "Of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX, {longs} of longs would be liquidated within 5% below the price and {shorts} of shorts within 5% above.":
    "Das posições de baleias de $1M ou mais acompanhadas na Hyperliquid, Lighter e dYdX, {longs} em longs seriam liquidados até 5% abaixo do preço e {shorts} em shorts até 5% acima.",
  "{window}, {total} of positions were force-closed across {assets} on {venues}, {sides}.":
    "{window}, {total} em posições foram liquidados em {assets}, em {venues}, {sides}.",
  "The most liquidated: {list}.": "Os mais liquidados: {list}.",
  "The largest single liquidation was a {usd} {asset} long on {venue} at {price} ({when} UTC).":
    "A maior liquidação individual foi um long de {usd} em {asset} na {venue} a {price} ({when} UTC).",
  "The largest single liquidation was a {usd} {asset} short on {venue} at {price} ({when} UTC).":
    "A maior liquidação individual foi um short de {usd} em {asset} na {venue} a {price} ({when} UTC).",
  Order: "Ordem",
  "Largest first": "Maiores primeiro",
  "Newest first": "Mais recentes primeiro",
  "Smallest close": "Menor liquidação",
  "The largest liquidations could not be read right now.":
    "Não foi possível ler as maiores liquidações agora.",
  "No single liquidation of {floor} or more in this window.":
    "Nenhuma liquidação individual de {floor} ou mais nesta janela.",
  "Nothing has been force-closed in this window.": "Nada foi liquidado nesta janela.",
  "The {n} newest liquidations of {floor} or more in this window.":
    "As {n} liquidações mais recentes de {floor} ou mais nesta janela.",
  "Every liquidation of {floor} or more in this window.":
    "Todas as liquidações de {floor} ou mais nesta janela.",
  "The {n} largest single liquidations in this window.":
    "As {n} maiores liquidações individuais nesta janela.",
  "Every liquidation in this window, largest first.":
    "Todas as liquidações nesta janela, das maiores para as menores.",
  "The position's value at the fill price": "O valor da posição ao preço de execução",
  "Each row is one forced close as its exchange reported it: the side is the position that was closed, the size its value at the fill price. Times are in {zone}.":
    "Cada linha é uma liquidação como a corretora reportou: o lado é a posição liquidada, o tamanho é o valor dela ao preço de execução. Horários em {zone}.",
  "{asset} largest liquidations": "Maiores liquidações de {asset}",
  "Largest liquidations": "Maiores liquidações",
  Largest: "Maiores",
  "None of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX would be liquidated within 5% of the price.":
    "Nenhuma das posições de baleias de $1M ou mais acompanhadas na Hyperliquid, Lighter e dYdX seria liquidada a até 5% do preço.",
  later: "depois",
  "A cascade is a burst in which one asset's liquidations piled up within minutes: consecutive minutes each running at {pace} times its 7-day average pace or more, with no more than {gap} quiet minutes between them, and at least an hour's worth of that average pace, and {floor}, in all. Every exchange whose liquidation feed the collector reads is counted; the venue choices on the other tabs do not narrow it.":
    "Uma cascata é uma onda em que as liquidações de um ativo se acumularam em minutos: minutos seguidos, cada um a {pace} vezes o ritmo médio de 7 dias ou mais, com no máximo {gap} minutos calmos entre eles, e no total pelo menos uma hora daquele ritmo médio e {floor}. Todas as corretoras cujo feed de liquidações o coletor lê entram na conta; as escolhas de corretora nas outras abas não a restringem.",
  "Prices are the asset's busiest market in 5-minute candles. Into it is the move from the last close before the cascade to the furthest the price went inside it: the low when mostly longs were closed, the high when mostly shorts were. 1h and 4h after run from the close at its end to the close an hour and four hours later, and say later until that candle has closed.":
    "Os preços são do mercado mais negociado do ativo em candles de 5 minutos. Durante é o movimento do último fechamento antes da cascata até o ponto mais distante a que o preço chegou dentro dela: a mínima quando foram liquidados principalmente longs, a máxima quando foram principalmente shorts. 1 h e 4 h depois vão do fechamento no fim dela até o fechamento uma hora e quatro horas mais tarde, e mostram depois até esse candle fechar.",
  "The cascades could not be read right now.": "Não foi possível ler as cascatas agora.",
  "No cascade in {asset} in this window: no burst reached {pace} times its usual pace with an hour's worth of it. Its usual pace is {usd} a minute, the 7-day average.":
    "Nenhuma cascata em {asset} nesta janela: nenhuma onda chegou a {pace} vezes o ritmo habitual com o equivalente a uma hora dele. O ritmo habitual é de {usd} por minuto, a média de 7 dias.",
  "none in this window": "nenhuma nesta janela",
  "none an hour old yet": "nenhuma com uma hora ainda",
  "higher in {up} of {n}": "acima em {up} de {n}",
  Cascades: "Cascatas",
  "{usd} longs": "{usd} em longs",
  "{usd} shorts": "{usd} em shorts",
  "An hour after long cascades": "Uma hora após cascatas de longs",
  "An hour after short cascades": "Uma hora após cascatas de shorts",
  "Usual pace": "Ritmo habitual",
  "a minute, the 7-day average": "por minuto, a média de 7 dias",
  "{n} min": "{n} min",
  "longs {share}": "longs {share}",
  "shorts {share}": "shorts {share}",
  "Prices: {market} on {venue}, in 5-minute candles.":
    "Preços: {market} na {venue}, em candles de 5 minutos.",
  "No price history for {asset}, so the moves are blank.":
    "Sem histórico de preço de {asset}, então os movimentos ficam em branco.",
  Start: "Início",
  Length: "Duração",
  "Exchanges with a liquidation in it": "Corretoras com liquidação nela",
  "The last close before the cascade began": "O último fechamento antes do início da cascata",
  "Price before": "Preço antes",
  "From the price before to the furthest it went inside the cascade":
    "Do preço antes até o ponto mais distante a que chegou dentro da cascata",
  "Into it": "Durante",
  "From the close at its end to the close an hour later":
    "Do fechamento no fim até o fechamento uma hora depois",
  "1h after": "1 h depois",
  "From the close at its end to the close four hours later":
    "Do fechamento no fim até o fechamento quatro horas depois",
  "4h after": "4 h depois",
  "Newest first.": "Mais recentes primeiro.",
  "Times are in {zone}.": "Horários em {zone}.",
  "Nothing has been force-closed in this window, so there is no asset to read.":
    "Nada foi liquidado nesta janela, então não há ativo para ler.",
  "{asset} cascades": "Cascatas de {asset}",
  "{asset} longs vs shorts by day · UTC days": "{asset} longs vs shorts por dia · dias UTC",
  "30- and 90-day history": "Histórico de 30 e 90 dias",
  "{asset} over 30 and 90 days": "{asset} em 30 e 90 dias",
  "Every day's longs and shorts liquidated over the last 30 or 90 days, each day as a share of the open interest on the same exchanges, and the heaviest days ranked.":
    "Os longs e shorts liquidados em cada dia dos últimos 30 ou 90 dias, cada dia como fatia do open interest nas mesmas corretoras, e os dias mais pesados em ranking.",
  "Liquidations against open interest": "Liquidações contra open interest",
  "Which markets were really flushed rather than just big: every asset's liquidations in the window as a share of its open interest, and the same for crypto, stocks, commodities and indices.":
    "Quais mercados foram realmente lavados, e não só grandes: as liquidações de cada ativo na janela como fatia do seu open interest, e o mesmo para cripto, ações, commodities e índices.",
  "For members": "Para membros",
  "Create a free account": "Crie uma conta grátis",
  "Loading the member view…": "Carregando a visão de membro…",
  "The history could not be read right now.": "Não foi possível ler o histórico agora.",
  "Nothing was force-closed in {asset} over this span.":
    "Nada foi liquidado em {asset} neste período.",
  "Liquidated over {span} days": "Liquidado em {span} dias",
  "A typical day": "Um dia típico",
  "of open interest, on average": "do open interest, em média",
  "The heaviest day": "O dia mais pesado",
  "Days with data": "Dias com dados",
  "from {date}": "desde {date}",
  "The heaviest days, as a share of open interest":
    "Os dias mais pesados, como fatia do open interest",
  "Day (UTC)": "Dia (UTC)",
  "Exchanges that reported a liquidation that day":
    "Corretoras que reportaram liquidação naquele dia",
  "Open interest is the day's average on the exchanges whose liquidation feeds reported {asset}, so the share compares like with like.":
    "O open interest é a média do dia nas corretoras cujos feeds de liquidação reportaram {asset}, então a fatia compara coisas equivalentes.",
  "Liquidation feeds were added over time: from {least} to {most} exchanges a day here, so early days undercount.":
    "Os feeds de liquidação foram adicionados com o tempo: de {least} a {most} corretoras por dia aqui, então os primeiros dias contam a menos.",
  Commodities: "Commodities",
  Indices: "Índices",
  "The open interest could not be read right now.": "Não foi possível ler o open interest agora.",
  "{liq} of {oi} open": "{liq} de {oi} em aberto",
  "The markets most flushed for their size": "Os mercados mais lavados para o seu tamanho",
  "No market with $1M of open interest had a liquidation in this window.":
    "Nenhum mercado com $1M de open interest teve liquidação nesta janela.",
  Class: "Classe",
  "Liquidations over the last {window} against the open interest now, both on the {feeds} exchanges whose liquidation feeds reported closes in that window. Markets under $1M of open interest are left out of the ranking.":
    "Liquidações no período de {window} contra o open interest atual, ambos nas {feeds} corretoras cujos feeds de liquidação reportaram liquidações nessa janela. Mercados com menos de $1M de open interest ficam fora do ranking.",
  Span: "Período",
  History: "Histórico",
  "{asset} history": "Histórico de {asset}",
  "Liquidations vs open interest": "Liquidações vs open interest",
  "vs OI": "vs OI",
  "Every cascade, in every asset": "Todas as cascatas, em todos os ativos",
  "Every liquidation cascade in every asset, found each minute as it happens, with the price an hour and four hours after. Members can also have them sent to Telegram the moment they start.":
    "Todas as cascatas de liquidação em todos os ativos, encontradas a cada minuto enquanto acontecem, com o preço uma hora e quatro horas depois. Membros também podem recebê-las no Telegram assim que começam.",
  "No cascade in any asset in the last {window}.":
    "Nenhuma cascata em nenhum ativo no período de {window}.",
  "in {n} assets": "em {n} ativos",
  "Longs and shorts": "Longs e shorts",
  "{longs} long cascades, {shorts} short": "{longs} cascatas de longs, {shorts} de shorts",
  "The deepest market's mark when the watch first saw it, a minute or two in":
    "A marcação do mercado mais profundo quando o monitor a viu pela primeira vez, um ou dois minutos depois do início",
  "Price when seen": "Preço ao ser vista",
  "From the price when seen to the mark an hour after the cascade ended":
    "Do preço ao ser vista até a marcação uma hora depois do fim da cascata",
  "From the price when seen to the mark four hours after the cascade ended":
    "Do preço ao ser vista até a marcação quatro horas depois do fim da cascata",
  "Every asset, found each minute as it happens, by the rule of each asset's Cascades tab. Prices are the asset's deepest market's mark when the watch saw it and an hour and four hours after it ended. Members can have them sent to Telegram from {alerts}.":
    "Todos os ativos, encontrados a cada minuto enquanto acontece, pela regra da aba Cascatas de cada ativo. Os preços são a marcação do mercado mais profundo do ativo quando o monitor a viu e uma hora e quatro horas depois do fim. Membros podem recebê-las no Telegram pela {alerts}.",
  "the alerts page": "página de alertas",
  "All cascades": "Todas as cascatas",
  // The member Top traders tab (web/trader.ts), 2026-11-15.
  "24h": "24h",
  "30d": "30d",
  "All time": "Todo o período",
  "over the last day": "no último dia",
  "over the last week": "na última semana",
  "over the last month": "no último mês",
  "over all time": "em todo o período",
  "Long {coin}": "Long {coin}",
  "Short {coin}": "Short {coin}",
  "Rank by profit over": "Ranking por lucro em",
  "Hyperliquid's leaderboard could not be read right now. Try again in a minute.":
    "Não foi possível ler o ranking da Hyperliquid agora. Tente de novo em um minuto.",
  "+{n} more": "+{n} mais",
  "nothing over $100k": "nada acima de $100k",
  Profit: "Lucro",
  "Profit over the account's value, as Hyperliquid's leaderboard computes it":
    "Lucro sobre o valor da conta, como o ranking da Hyperliquid calcula",
  Return: "Retorno",
  "Account value": "Valor da conta",
  "Holding now": "Posições agora",
  "Hyperliquid's own leaderboard, every one of its {ranked} accounts ranked by profit {window}, read {ago}. Hyperliquid is the large perp exchange where every account is public, so any of them opens on its positions, fills and orders. Holdings are the whale tracker's: positions of $100k and up, read within three hours.":
    "O próprio ranking da Hyperliquid, com todas as suas {ranked} contas classificadas por lucro {window}, lido {ago}. A Hyperliquid é a grande corretora de perpétuos em que toda conta é pública, então qualquer uma abre com suas posições, execuções e ordens. As posições atuais vêm do rastreador de baleias: posições de $100k para cima, lidas nas últimas três horas.",
  "Too little history in this window to draw.":
    "Histórico curto demais nesta janela para desenhar.",
  "Open long": "Abrir long",
  "Close long": "Fechar long",
  "Open short": "Abrir short",
  "Close short": "Fechar short",
  "Long to short": "Long para short",
  "Short to long": "Short para long",
  Buy: "Compra",
  Sell: "Venda",
  Limit: "Limite",
  "Stop market": "Stop a mercado",
  "Stop limit": "Stop limite",
  "Take profit market": "Take profit a mercado",
  "Take profit limit": "Take profit limite",
  "reduce only": "só reduzir",
  "position TP/SL": "TP/SL da posição",
  Filled: "Executada",
  Canceled: "Cancelada",
  Triggered: "Acionada",
  Rejected: "Rejeitada",
  "Canceled: margin": "Cancelada: margem",
  "All top traders": "Todos os top traders",
  "#{place} on Hyperliquid's leaderboard by profit {window}.":
    "#{place} no ranking da Hyperliquid por lucro {window}.",
  "Hyperliquid is answering too many requests right now. Try again in a minute.":
    "A Hyperliquid está recebendo pedidos demais agora. Tente de novo em um minuto.",
  "Hyperliquid did not answer for this account right now. Try again in a minute.":
    "A Hyperliquid não respondeu por esta conta agora. Tente de novo em um minuto.",
  "{usd} free to withdraw": "{usd} livres para saque",
  "Profit {window}": "Lucro {window}",
  "{usd} traded": "{usd} negociados",
  "Open positions": "Posições abertas",
  "{lev}x the account's value": "{lev}x o valor da conta",
  "on the open positions": "nas posições abertas",
  "Profit chart window": "Janela do gráfico de lucro",
  "Profit and loss {window}": "Lucro e prejuízo {window}",
  "The profit history could not be read right now.":
    "Não foi possível ler o histórico de lucro agora.",
  "No open positions.": "Nenhuma posição aberta.",
  Coin: "Moeda",
  "Unrealized profit over the margin the position holds":
    "Lucro não realizado sobre a margem que a posição usa",
  ROE: "ROE",
  "Liq. price": "Preço de liq.",
  "Funding the position has paid since it opened; a minus is funding received":
    "Financiamento que a posição pagou desde a abertura; um sinal de menos é financiamento recebido",
  isolated: "isolada",
  "The positions could not be read right now.": "Não foi possível ler as posições agora.",
  "Resting orders": "Ordens no livro",
  Placed: "Enviada",
  Trigger: "Gatilho",
  "The fills could not be read right now.": "Não foi possível ler as execuções agora.",
  "No fills on record.": "Nenhuma execução registrada.",
  "This account was liquidated in this fill": "Esta conta foi liquidada nesta execução",
  liquidated: "liquidada",
  "Results by coin": "Resultados por moeda",
  "Orders that filled": "Ordens executadas",
  Trades: "Negócios",
  "Profit realized by closing, before fees": "Lucro realizado ao fechar, antes das tarifas",
  "Closed P&amp;L": "P&amp;L realizado",
  Fees: "Tarifas",
  Direction: "Direção",
  "Size-weighted over the order's fills": "Ponderado pelo tamanho das execuções da ordem",
  Fee: "Tarifa",
  "Fills the order took": "Execuções que a ordem teve",
  "No trades in {coin} among these fills.": "Nenhum negócio em {coin} entre estas execuções.",
  "Hyperliquid answers an account's last {n} fills, here from {date}; results by coin are over those fills only. Each trade is one order's fills taken together.":
    "A Hyperliquid responde as últimas {n} execuções de uma conta, aqui desde {date}; os resultados por moeda são só sobre essas execuções. Cada negócio é o conjunto das execuções de uma ordem.",
  "The order history could not be read right now.":
    "Não foi possível ler o histórico de ordens agora.",
  market: "mercado",
  "No orders on record.": "Nenhuma ordem registrada.",
  "Hyperliquid answers an account's last {n} orders, each shown once at its latest status.":
    "A Hyperliquid responde as últimas {n} ordens de uma conta, cada uma mostrada uma vez no status mais recente.",
  "Hyperliquid throttled part of this read; what is missing says so. Try again in a minute.":
    "A Hyperliquid limitou parte desta leitura; o que falta está indicado. Tente de novo em um minuto.",
  Positions: "Posições",
  "Order history": "Histórico de ordens",
  "Read from Hyperliquid {ago}.": "Lido da Hyperliquid {ago}.",
  "Top traders, and every order they place": "Top traders, e cada ordem que eles enviam",
  "Hyperliquid's biggest winners over a day, a week, a month or all time, with what they hold now. Open any of them for their positions and liquidation prices, profit over time, and their recent trades and orders, coin by coin.":
    "Os maiores vencedores da Hyperliquid em um dia, uma semana, um mês ou em todo o período, com o que têm agora. Abra qualquer um para ver posições e preços de liquidação, lucro ao longo do tempo e negócios e ordens recentes, moeda por moeda.",
  "Top traders": "Top traders",
  Winners: "Vencedores",
  "Longs near liquidation": "Longs perto da liquidação",
  "Longs closest to their liquidation price": "Longs mais perto do preço de liquidação",
  "Closest first: how far the price has to fall to liquidate each one.":
    "Mais perto primeiro: quanto o preço precisa cair para liquidar cada uma.",
  "Shorts near liquidation": "Shorts perto da liquidação",
  "Shorts closest to their liquidation price": "Shorts mais perto do preço de liquidação",
  "Closest first: how far the price has to rise to liquidate each one.":
    "Mais perto primeiro: quanto o preço precisa subir para liquidar cada uma.",
  "Largest longs": "Maiores longs",
  "Largest longs that can be liquidated": "Maiores longs que podem ser liquidados",
  "Biggest first, each with the price that would liquidate it.":
    "Maiores primeiro, cada um com o preço que o liquidaria.",
  "Largest shorts": "Maiores shorts",
  "Largest shorts that can be liquidated": "Maiores shorts que podem ser liquidados",
  "The {n} largest of {total}.": "As {n} maiores, de {total}.",
  "Position list": "Lista de posições",
  "No long position here has a liquidation price.":
    "Nenhuma posição long aqui tem preço de liquidação.",
  "No short position here has a liquidation price.":
    "Nenhuma posição short aqui tem preço de liquidação.",
  "The odds of reaching each price": "As chances de chegar a cada preço",
  "{asset}: the odds of reaching each price": "{asset}: as chances de chegar a cada preço",
  "How far the price can plausibly get in 4 hours, 6 hours, a day and a week: the chance it touches each level, sized from its own measured volatility, beside the levels where positions were liquidated and what each liquidation theory reads.":
    "Até onde o preço pode plausivelmente ir em 4 horas, 6 horas, um dia e uma semana: a chance de tocar cada nível, calculada pela sua própria volatilidade medida, ao lado dos níveis onde posições foram liquidadas e do que cada teoria de liquidação indica.",
  "Clicked bar": "Barra clicada",
  "Positions that liquidate in a bar": "Posições que liquidam numa barra",
  "Every position in the bar you clicked, longs and shorts, largest first.":
    "Todas as posições da barra clicada, longs e shorts, das maiores às menores.",
  "No tracked position liquidates in this bar.": "Nenhuma posição acompanhada liquida nesta barra.",
  "Click a bar on the map above to list every position that liquidates in it.":
    "Clique numa barra do mapa acima para listar todas as posições que liquidam nela.",
  "Positions that liquidate between {low} and {high}": "Posições que liquidam entre {low} e {high}",
  "click one to list its positions below": "clique numa barra para listar as posições abaixo",
  // The Longs vs shorts tab's positioning strip.
  "{low}% to {high}%": "{low}% a {high}%",
  "{venue}: share of all accounts net long":
    "{venue}: parcela de todas as contas com saldo líquido long",
  "{venue}: share of the top traders' position size held long":
    "{venue}: parcela do tamanho das posições dos top traders que está long",
  "{venue}: share of the top traders' accounts net long":
    "{venue}: parcela das contas dos top traders com saldo líquido long",
  "{venue}: share of the last hour's taker volume that bought, on average":
    "{venue}: parcela média do volume taker da última hora que comprou",
  "{asset} positioning": "Posicionamento de {asset}",
  "{asset} positioning: the share long on each exchange":
    "Posicionamento de {asset}: a parcela long em cada corretora",
  "newest {time}": "mais recente {time}",
  "All accounts": "Todas as contas",
  "Top traders' positions": "Posições dos top traders",
  "Top traders' accounts": "Contas dos top traders",
  "Taker buys": "Compras taker",
  "all accounts": "todas as contas",
  "top positions": "top posições",
  "Each exchange's own published statistics, read every 15 minutes. All accounts counts every account once, so it reads the crowd. Top traders are each exchange's own group (Binance: the top 20% by margin), by position size and by accounts. Taker buys is the share of taker volume that bought, averaged over the last hour. A dash is a figure the exchange does not publish.":
    "Estatísticas publicadas por cada corretora, lidas a cada 15 minutos. Todas as contas conta cada conta uma vez, então mostra a multidão. Top traders é o grupo definido por cada corretora (Binance: os 20% maiores por margem), por tamanho de posição e por contas. Compras taker é a parcela média do volume taker da última hora que comprou. Um traço é um número que a corretora não publica.",
  "{asset} liquidation map and live liquidations":
    "Mapa de liquidações de {asset} e liquidações ao vivo",
  "Crypto liquidations: live liquidation map and whale positions":
    "Liquidações cripto: mapa de liquidações ao vivo e posições de baleias",
};
