/**
 * The site-wide pieces and the small pages, in Portuguese (Brazil): web/about.ts, web/legal.ts and
 * web/tos.ts (their notice only -- the bodies stay English), web/referral-links.ts, web/referral.ts,
 * web/install.ts, web/share.ts, web/await.ts, web/tabs.ts and web/glossary.ts. Glossary and style:
 * ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const site: Catalog = {
  // web/about.ts
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
  "{month} {day}, {year}": "{day} {month} {year}",
  project: "projeto",
  commit: "commit",
  "not recorded": "não registrado",
  "This build did not record its commit. Deployed builds stamp the commit they were built from here.":
    "Esta build não registrou seu commit. As builds publicadas registram aqui o commit de que foram geradas.",
  committed: "commit em",
  deployed: "publicado em",
  "Release notes are written in English.": "As notas de versão são escritas em inglês.",
  About: "Sobre",
  "What airrates is, which version is running, and what has changed recently.":
    "O que é o airrates, qual versão está no ar e o que mudou recentemente.",
  "About airrates": "Sobre o airrates",
  "airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.":
    "O airrates é um screener de taxas de financiamento para futuros perpétuos. Ele lê o financiamento da API pública de cada corretora a cada minuto e mostra onde ficar long em um ativo numa corretora e short no mesmo ativo em outra captura a diferença entre as taxas, e quanto isso realmente pagou.",
  "This version": "Esta versão",
  "Recent changes": "Mudanças recentes",

  // web/legal.ts, web/tos.ts
  "This page is available in English only. The English text is the binding version.":
    "Esta página está disponível apenas em inglês. O texto em inglês é a versão que vale.",

  // web/referral-links.ts
  "<b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. {link}":
    "<b>Aviso.</b> O airrates pode receber uma comissão se você abrir uma conta por um link desta página, sem custo extra para você. Links de indicação nunca afetam quais mercados aparecem nem como são classificados. Estar listada aqui não é uma recomendação: confirme que a corretora atende onde você mora antes de se cadastrar e lembre-se de que futuros perpétuos são alavancados e podem perder mais do que a sua margem. {link}",
  "How referral links work": "Como funcionam os links de indicação",
  "No referral links yet.": "Ainda não há links de indicação.",
  "Referral links are not shown in your location.":
    "Links de indicação não são exibidos na sua localização.",
  "None of these exchanges' referral links can be shown in your location.":
    "Nenhum link de indicação destas corretoras pode ser exibido na sua localização.",
  "The link applies the referral itself": "O link já aplica a indicação",
  Exchange: "Corretora",
  Type: "Tipo",
  "Referral code": "Código de indicação",
  "Sign up": "Cadastrar",
  "{count} more exchange's link is not available in your location.":
    "Mais corretoras sem link disponível na sua localização: {count}.",
  "{count} more exchanges' links are not available in your location.":
    "Mais corretoras sem link disponível na sua localização: {count}.",
  "Referral links": "Links de indicação",
  "Referral links for the exchanges airrates tracks, for readers opening a new account.":
    "Links de indicação das corretoras que o airrates acompanha, para quem vai abrir uma conta nova.",
  "The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.":
    "As corretoras para as quais o airrates tem um link de indicação. Se você ainda não tem conta em alguma delas, pode abrir pelo link.",

  // web/referral.ts
  "How this works": "Como funciona",
  "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "Link de indicação: código {code}. O airrates pode receber uma comissão se você se cadastrar por ele, sem custo para você. {how}",
  "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "Link de indicação: o airrates pode receber uma comissão se você se cadastrar por ele, sem custo para você. {how}",
  "Open a {venue} account": "Abrir conta na {venue}",

  // web/install.ts
  "Install the app": "Instalar o app",
  "Install airrates": "Instalar o airrates",
  "Opens in its own window, from your home screen.": "Abre em janela própria, pela tela inicial.",
  "Install app": "Instalar app",
  "Not now": "Agora não",

  // web/share.ts
  "Share the chart in view as an image sized for X":
    "Compartilhar o gráfico em exibição como imagem no tamanho do X",
  chart: "gráfico",
  "Quote this page's best line, with a link back to it":
    "Citar a melhor frase desta página, com um link de volta para ela",
  cite: "citar",
  "No chart on this view": "Não há gráfico nesta visão",
  close: "fechar",
  Copied: "Copiado",
  "Select + copy": "Selecione e copie",
  "Cite this page": "Citar esta página",
  "Pick the line · the page's own numbers, as they read now":
    "Escolha a frase · os números da própria página, como estão agora",
  "Your post · edit it freely": "Seu post · edite à vontade",
  "Back-link · this exact page, venue and filters":
    "Link de volta · esta página, corretora e filtros exatos",
  Copy: "Copiar",
  "Post on X": "Postar no X",
  "Copy line + link": "Copiar frase + link",
  "Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: {stamp}. Not financial advice.":
    "Cite o número e coloque um link para onde ele foi lido. O financiamento muda a cada minuto, então a frase diz quando era verdade: {stamp}. Não é recomendação de investimento.",
  "{count} characters left with the link": "Caracteres restantes com o link: {count}",
  "+{count} more": "+{count}",
  "public venue APIs · not financial advice":
    "APIs públicas das corretoras · não é recomendação de investimento",
  "Share your line": "Compartilhe sua frase",
  "chart image": "imagem do gráfico",
  "Image · 1600 × 900, X's own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.":
    "Imagem · 1600 × 900, o 16:9 do próprio X — aparece sem corte na timeline. Clique com o botão direito ou toque e segure para salvar.",
  "Copy image": "Copiar imagem",
  "Download PNG": "Baixar PNG",
  "Link · this exact view": "Link · esta visão exata",
  "Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues', the call is yours.":
    "Copie a imagem, toque em Postar no X e cole no post. A imagem traz o endereço de onde veio; o link abre a mesma visão. Nunca indicamos direção — os números são das corretoras, a decisão é sua.",
  "the image could not be drawn in this browser":
    "não foi possível desenhar a imagem neste navegador",
  "Copy blocked — download instead": "Cópia bloqueada — baixe a imagem",

  // web/await.ts
  "Building report": "Gerando relatório",
  "Still building": "Ainda gerando",

  // web/tabs.ts
  Sections: "Seções",

  // web/glossary.ts (and its entry in the footer menu and the shortcut map)
  terminology: "terminologia",
  Terminology: "Terminologia",
  "Order flow": "Fluxo de ordens",
  "Aggressive buying minus aggressive selling.": "Compra agressiva menos venda agressiva.",
  "cumulative volume delta": "delta de volume acumulado",
  "Delta added up through the session.": "Delta somado ao longo da sessão.",
  'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.':
    'Na página <a href="/chart">Gráfico</a>, spot e futuros separados, somados entre as corretoras.',
  Imbalance: "Desequilíbrio",
  "One side trading 3x or more the other at a price.":
    "Um lado negociando 3x ou mais que o outro em um preço.",
  Absorption: "Absorção",
  "Heavy aggression, no progress.": "Muita agressão, nenhum avanço.",
  'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.':
    'Na aba Probabilidades da página <a href="/liquidations#odds">Liquidações</a>, como iniciativa vs absorção.',
  "Volume profile": "Perfil de volume",
  "volume point of control": "ponto de controle de volume",
  "The price with the most volume.": "O preço com mais volume.",
  "Value area": "Área de valor",
  "Where 70% of the volume traded.": "Onde 70% do volume foi negociado.",
  "low-volume node": "nó de baixo volume",
  "A thin price the market moved through fast.":
    "Um preço com pouca negociação que o mercado atravessou rápido.",
  "Single prints": "Single prints",
  "A zone only one 30-minute period traded.":
    "Uma zona negociada em apenas um período de 30 minutos.",
  // web/glossary.ts: the terms added 2026-11-10 beside the owner's first eight
  "Delta (order flow)": "Delta (fluxo de ordens)",
  Initiative: "Iniciativa",
  "Aggression that moves price; the opposite of absorption.":
    "Agressão que move o preço; o oposto da absorção.",
  "Taker flow": "Fluxo taker",
  "The trades CVD is added up from, buys against sells.":
    "Os negócios de que o CVD é somado, compras contra vendas.",
  "Options and gamma": "Opções e gama",
  "gamma exposure": "exposição gama",
  "How much dealers must buy or sell for each 1% move.":
    "Quanto os dealers precisam comprar ou vender a cada movimento de 1%.",
  'Shown on the <a href="/rates#gamma">Rates</a> page’s Gamma Exposure tab, and told as it moves by the market narrator at the top of every page.':
    'Na aba Exposição gama da página <a href="/rates#gamma">Taxas</a>, e narrado conforme se move pelo narrador de mercado no topo de cada página.',
  "The price where dealers' net gamma changes sign.":
    "O preço em que a gama líquida dos dealers muda de sinal.",
  'Marked on the <a href="/rates#gamma">Gamma Exposure</a> tab, and the line the market narrator reads every price against.':
    'Marcado na aba <a href="/rates#gamma">Exposição gama</a>, e a linha com que o narrador de mercado compara cada preço.',
  "Long / short gamma": "Gama long / short",
  "Long: dealers' hedging sells rises and buys dips, damping moves. Short: it chases price, adding to moves.":
    "Long: o hedge dos dealers vende nas altas e compra nas quedas, amortecendo os movimentos. Short: ele persegue o preço, ampliando os movimentos.",
  'Shaded in the zones view of the <a href="/rates#gamma">Gamma Exposure</a> tab.':
    'Sombreado na visão de zonas da aba <a href="/rates#gamma">Exposição gama</a>.',
  "The strike holding the most call or put gamma; it tends to cap or floor price.":
    "O strike com mais gama de calls ou de puts; tende a servir de teto ou de piso para o preço.",
  'Shown on the <a href="/rates#gamma">Gamma Exposure</a> tab and in every market narrator line.':
    'Na aba <a href="/rates#gamma">Exposição gama</a> e em cada frase do narrador de mercado.',
  "Delta (options)": "Delta (opções)",
  "How much an option's price moves per point of the underlying.":
    "Quanto o preço de uma opção se move por ponto do ativo-objeto.",
  'By strike on the <a href="/rates#delta">Rates</a> page’s Delta tab.':
    'Por strike na aba Delta da página <a href="/rates#delta">Taxas</a>.',
  "How much an option's price moves per point of implied volatility.":
    "Quanto o preço de uma opção se move por ponto de volatilidade implícita.",
  'By strike on the <a href="/rates#vega">Rates</a> page’s Vega tab.':
    'Por strike na aba Vega da página <a href="/rates#vega">Taxas</a>.',
  "What an option loses in value each day as expiry nears.":
    "O valor que uma opção perde a cada dia conforme o vencimento se aproxima.",
  'By strike on the <a href="/rates#theta">Rates</a> page’s Theta tab.':
    'Por strike na aba Theta da página <a href="/rates#theta">Taxas</a>.',
  "implied volatility": "volatilidade implícita",
  "The size of move the option prices expect, per year.":
    "O tamanho do movimento que os preços das opções esperam, por ano.",
  'Drawn as walls on the <a href="/rates#ivwalls">Rates</a> page’s IV Walls tab.':
    'Desenhada como muralhas na aba Muralhas de IV da página <a href="/rates#ivwalls">Taxas</a>.',
  "1σ move": "Movimento de 1σ",
  "The day's expected move from the options: one standard deviation either side.":
    "O movimento esperado do dia pelas opções: um desvio-padrão para cada lado.",
  'The IV walls on the <a href="/rates#ivwalls">Rates</a> page, and the IV move on <a href="/whales">Whales</a>.':
    'As muralhas de IV na página <a href="/rates#ivwalls">Taxas</a>, e o movimento de IV em <a href="/whales">Baleias</a>.',
  "The strike where option buyers lose the most at expiry.":
    "O strike em que os compradores de opções mais perdem no vencimento.",
  'Marked on the <a href="/rates#levels">Rates</a> page’s Ceiling &amp; Floor tab.':
    'Marcado na aba Teto &amp; piso da página <a href="/rates#levels">Taxas</a>.',
  "Reaction zone": "Zona de reação",
  "Where an IV wall and a gamma wall line up.":
    "Onde uma muralha de IV e uma muralha de gama se alinham.",
  'In full on the <a href="/rates#ivwalls">IV Walls</a> and <a href="/rates#levels">Ceiling &amp; Floor</a> tabs, folded on the other option tabs.':
    'Completa nas abas <a href="/rates#ivwalls">Muralhas de IV</a> e <a href="/rates#levels">Teto &amp; piso</a>, recolhida nas outras abas de opções.',
  "Funding and perps": "Financiamento e perpétuos",
  "Funding rate": "Taxa de financiamento",
  "What longs pay shorts, or shorts pay longs, to keep a perp near spot.":
    "O que os longs pagam aos shorts, ou os shorts aos longs, para manter um perpétuo perto do spot.",
  'Every exchange side by side on the <a href="/rates">Rates</a> page.':
    'Todas as corretoras lado a lado na página <a href="/rates">Taxas</a>.',
  "annual percentage rate": "taxa percentual anual",
  "A funding rate scaled to a year, so different settlement intervals compare.":
    "Uma taxa de financiamento levada para um ano, para comparar intervalos de pagamento diferentes.",
  'The unit the <a href="/screener">Screener</a> shows by default.':
    'A unidade que o <a href="/screener">Screener</a> mostra por padrão.',
  "Settlement interval": "Intervalo de pagamento",
  "How often funding is paid: every 1, 4 or 8 hours.":
    "Com que frequência o financiamento é pago: a cada 1, 4 ou 8 horas.",
  'In each leg of a <a href="/screener">Screener</a> row.':
    'Em cada perna de uma linha do <a href="/screener">Screener</a>.',
  "Funding spread / carry": "Spread de financiamento / carry",
  "Long where funding is cheap, short where it is rich, and collect the gap.":
    "Long onde o financiamento é barato, short onde é caro, e embolse a diferença.",
  'The pairs the <a href="/">home page</a> and the <a href="/screener">Screener</a> rank.':
    'Os pares que a <a href="/">página inicial</a> e o <a href="/screener">Screener</a> classificam.',
  "Contracts still open: money in the market, not traded volume.":
    "Contratos ainda abertos: dinheiro no mercado, não volume negociado.",
  'In each leg of a <a href="/screener">Screener</a> row, and per asset on the <a href="/chart">Chart</a> page.':
    'Em cada perna de uma linha do <a href="/screener">Screener</a>, e por ativo na página <a href="/chart">Gráfico</a>.',
  "A perp or future's price minus spot.": "O preço de um perpétuo ou futuro menos o spot.",
  "Mark / index price": "Preço de marcação / do índice",
  "Mark is the price used for liquidations; index is the spot average it tracks.":
    "A marcação é o preço usado nas liquidações; o índice é a média spot que ela acompanha.",
  'Each pair’s page, opened from a row on <a href="/arbitrage">Arbitrage</a>, charts the mark prices hourly.':
    'A página de cada par, aberta a partir de uma linha em <a href="/arbitrage">Arbitragem</a>, traça os preços de marcação a cada hora.',
  "Taker / maker": "Taker / maker",
  "A taker crosses the spread and pays the higher fee; a maker rests an order and waits.":
    "O taker cruza o spread e paga a tarifa mais alta; o maker deixa uma ordem no livro e espera.",
  'The <a href="/markets">Exchanges</a> page prices a $10k market order with each exchange’s taker fee.':
    'A página <a href="/markets">Corretoras</a> calcula o custo de uma ordem a mercado de $10k com a tarifa taker de cada corretora.',
  "Liquidations and whales": "Liquidações e baleias",
  Liquidation: "Liquidação",
  "A position the exchange closes because its margin ran out.":
    "Uma posição que a corretora fecha porque a margem acabou.",
  'Every exchange’s, live, on the <a href="/liquidations">Liquidations</a> page.':
    'As de todas as corretoras, ao vivo, na página <a href="/liquidations">Liquidações</a>.',
  "Whale order": "Ordem de baleia",
  "A resting order big enough to show on the depth chart.":
    "Uma ordem parada no livro grande o bastante para aparecer no gráfico de profundidade.",
  'Binance walls and Hyperliquid whale orders on the <a href="/whales">Whales</a> page.':
    'Muralhas da Binance e ordens de baleia da Hyperliquid na página <a href="/whales">Baleias</a>.',
  "The site's terms in one line each: order flow, the volume profile, options and gamma, funding and perps, liquidations and whales.":
    "Os termos do site em uma linha cada: fluxo de ordens, perfil de volume, opções e gama, financiamento e perpétuos, liquidações e baleias.",
  "The words the site uses, each in one line: order flow, the volume profile, options and gamma, funding, liquidations. Every term has its own link to share: /glossary#cvd opens this page at CVD.":
    "As palavras que o site usa, cada uma em uma linha: fluxo de ordens, perfil de volume, opções e gama, financiamento, liquidações. Cada termo tem seu próprio link para compartilhar: /glossary#cvd abre esta página em CVD.",
};
