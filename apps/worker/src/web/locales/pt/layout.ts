/**
 * The frame every page shares -- web/layout.ts (masthead, nav, footer), the time and label helpers in
 * web/format.ts -- and the not-found messages app/app.ts builds, in Portuguese (Brazil).
 * Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const layout: Catalog = {
  // web/format.ts
  "{s}s": "{s}s",
  "{m}m": "{m}min",
  "{h}h {m}m": "{h}h {m}min",
  "{time} ago": "há {time}",
  settling: "pagando",
  never: "nunca",
  "extreme fear": "medo extremo",
  fear: "medo",
  neutral: "neutro",
  greed: "ganância",
  "extreme greed": "ganância extrema",

  // web/layout.ts
  spreads: "spreads",
  screener: "screener",
  rates: "taxas",
  arbitrage: "arbitragem",
  liquidations: "liquidações",
  exchanges: "corretoras",
  "{markets} markets · {venues} venues · updated {ago}":
    "mercados: {markets} · corretoras: {venues} · atualizado {ago}",
  "no venue has reported in five minutes": "nenhuma corretora enviou dados em cinco minutos",
  "Fear &amp; greed: click for the chart": "Medo e ganância: clique para ver o gráfico",
  "What settled. Not what might.": "O que foi pago. Não o que poderia ser.",
  "Your local time ({zone}). Click for UTC.": "Seu horário local ({zone}). Clique para UTC.",
  "UTC, the clock funding settles by. Click for your local time.":
    "UTC, o relógio pelo qual o financiamento é pago. Clique para seu horário local.",
  filter: "filtrar",
  login: "entrar",
  telegram: "telegram",
  "Join the airrates group on Telegram: @airratesnet":
    "Entre no grupo do airrates no Telegram: @airratesnet",
  status: "status",
  "geo-probe": "sonda geográfica",
  about: "sobre",
  "referral links": "links de indicação",
  "MCP &amp; agents": "MCP e agentes",
  "legal &amp; privacy": "legal e privacidade",
  terms: "termos",
  Language: "Idioma",
  menu: "menu",
  "Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.":
    "Não é recomendação de investimento. Os dados podem estar atrasados ou imprecisos. Sem vínculo com nenhuma corretora nem endosso de nenhuma delas.",

  // web/help.ts
  "What is this?": "O que é isto?",
  "About this page": "Sobre esta página",

  // app/app.ts
  "{asset} is not an asset address.": "{asset} não é um endereço de ativo.",
  "No live market for {asset}.": "Nenhum mercado ativo para {asset}.",
  "No live market for {asset}, so nothing to band against.":
    "Nenhum mercado ativo para {asset}, então não há como montar faixas.",
  "No exchange is quoting a {asset} book right now.":
    "Nenhuma corretora está cotando um livro de {asset} agora.",
  "There's no exchange with that name.": "Não há corretora com esse nome.",
  "No exchange has a live {asset} perpetual right now.":
    "Nenhuma corretora tem um perpétuo de {asset} ativo agora.",
  // web/command.ts: the site-wide search, and its key on /keys
  search: "buscar",
  "Search tickers, exchanges and indices": "Buscar tickers, corretoras e índices",
  Search: "Buscar",
  "Ticker, exchange or index": "Ticker, corretora ou índice",
  Results: "Resultados",
  move: "mover",
  open: "abrir",
  close: "fechar",
  "every exchange's rate and open interest": "a taxa e o open interest de cada corretora",
  "Funding spreads": "Spreads de financiamento",
  "backtest a long/short pair": "backtest de um par long/short",
  Screener: "Screener",
  "its spreads, ranked": "seus spreads, em ranking",
  Arbitrage: "Arbitragem",
  "price gaps between exchanges": "diferenças de preço entre corretoras",
  "large resting orders and trades": "grandes ordens no livro e negociações",
  Liquidations: "Liquidações",
  "where positions are liquidated": "onde as posições são liquidadas",
  "options gamma by strike": "gama das opções por strike",
  "1 exchange": "1 corretora",
  "{n} exchanges": "{n} corretoras",
  "OI {usd}": "OI {usd}",
  Tickers: "Tickers",
  "Other tickers": "Outros tickers",
  Exchanges: "Corretoras",
  "markets, costs and grade": "mercados, custos e nota",
  "Index levels": "Níveis de índices",
  "the level, its daily closes and what trades on it":
    "o nível, os fechamentos diários e o que é negociado nele",
  "Indices and option books": "Índices e livros de opções",
  Pages: "Páginas",
  Recent: "Recentes",
  "Loading tickers…": "Carregando tickers…",
  "The ticker list did not load. Exchanges and pages still match.":
    "A lista de tickers não carregou. Corretoras e páginas ainda aparecem.",
  "Nothing matches {q}.": "Nada corresponde a {q}.",
  "price, spot and futures CVD": "preço e CVD de spot e futuros",
  System: "Sistema",
  "Day or Night, as your device is set": "Dia ou Noite, conforme seu dispositivo",
  Settings: "Configurações",
  "Your settings on airrates: theme, clock, chart cursor, language and keyboard.":
    "Suas configurações no airrates: tema, relógio, cursor dos gráficos, idioma e teclado.",
  "Each choice is kept in this browser, not on an account: it needs no login, and another browser or device starts from the defaults. Clearing the site's data resets them.":
    "Cada escolha fica salva neste navegador, não em uma conta: não precisa entrar, e outro navegador ou dispositivo começa do padrão. Apagar os dados do site as redefine.",
  Theme: "Tema",
  "The colours of every page. Charts take the new colours from the next page you open.":
    "As cores de todas as páginas. Os gráficos usam as novas cores a partir da próxima página que você abrir.",
  Clock: "Relógio",
  "The clock in the header, and the times on charts and tables.":
    "O relógio do cabeçalho e os horários em gráficos e tabelas.",
  "Local time": "Horário local",
  "Chart cursor": "Cursor dos gráficos",
  "What follows the pointer on a chart: a crosshair with the value on each axis, or the whole bar lit.":
    "O que acompanha o ponteiro no gráfico: uma mira com o valor em cada eixo, ou a barra inteira destacada.",
  "The site's language, kept for this browser.": "O idioma do site, salvo para este navegador.",
  "Every shortcut on the site. Members remap them into profiles kept on their account.":
    "Todos os atalhos do site. Membros os remapeiam em perfis salvos na própria conta.",
  "keyboard shortcuts": "atalhos de teclado",
  Reset: "Redefinir",
  "Back to the defaults: Night, local time, the crosshair, the narrator open and typing, and every chart's own view.":
    "Volta ao padrão: Noite, horário local, a mira, o narrador aberto e digitando, e a visualização própria de cada gráfico.",
  "reset settings": "redefinir configurações",
  "Saved in this browser.": "Salvo neste navegador.",
  "Back to the defaults.": "De volta ao padrão.",
  settings: "configurações",
  Night: "Noite",
  "Black terminal, the default": "Terminal preto, o padrão",
  "Ink on white, for daylight": "Tinta sobre branco, para o dia",
  Solar: "Solar",
  "Solarized light: warm paper, soft contrast": "Solarized claro: papel quente, contraste suave",
  "Solar dark": "Solar escuro",
  "Solarized dark: deep teal": "Solarized escuro: azul-petróleo profundo",
  Dusk: "Crepúsculo",
  "Slate blue, easy on the eyes at night": "Azul-ardósia, confortável à noite",
  Sepia: "Sépia",
  "Old paper and brown ink": "Papel antigo e tinta marrom",
  Phosphor: "Fósforo",
  "Green screen, an old terminal": "Tela verde, um terminal antigo",
  "High contrast": "Alto contraste",
  "White on black, brightest lines": "Branco sobre preto, linhas mais brilhantes",
};
