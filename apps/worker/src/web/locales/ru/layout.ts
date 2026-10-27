/**
 * Russian for the frame every page shares -- web/layout.ts (masthead, nav, footer), the time and
 * label helpers in web/format.ts -- and the not-found messages app/app.ts builds.
 * Glossary and style: ./index.ts.
 *
 * Terms: the nav keeps one short word each; "settling" is the countdown's word at zero, выплата.
 */

import type { Catalog } from "../../i18n";

export const layout: Catalog = {
  // web/format.ts
  "{s}s": "{s} с",
  "{m}m": "{m} мин",
  "{h}h {m}m": "{h} ч {m} мин",
  "{time} ago": "{time} назад",
  settling: "выплата",
  never: "никогда",
  "extreme fear": "крайний страх",
  fear: "страх",
  neutral: "нейтрально",
  greed: "жадность",
  "extreme greed": "крайняя жадность",

  // web/layout.ts
  spreads: "спреды",
  screener: "скринер",
  rates: "ставки",
  arbitrage: "арбитраж",
  liquidations: "ликвидации",
  exchanges: "биржи",
  "{markets} markets · {venues} venues · updated {ago}":
    "рынков: {markets} · бирж: {venues} · обновлено {ago}",
  "no venue has reported in five minutes": "за пять минут нет данных ни от одной биржи",
  "Fear &amp; greed: click for the chart": "Страх и жадность: нажмите, чтобы открыть график",
  "What settled. Not what might.": "Что выплачено. Не что могло бы.",
  "Your local time ({zone}). Click for UTC.": "Ваше местное время ({zone}). Нажмите для UTC.",
  "UTC, the clock funding settles by. Click for your local time.":
    "UTC — по нему выплачивается фандинг. Нажмите для местного времени.",
  filter: "фильтр",
  login: "вход",
  telegram: "телеграм",
  "Join the airrates group on Telegram: @airratesnet":
    "Вступайте в группу airrates в Telegram: @airratesnet",
  status: "статус",
  "geo-probe": "гео-проверка",
  about: "о сайте",
  "referral links": "реферальные ссылки",
  "legal &amp; privacy": "право и приватность",
  terms: "условия",
  Language: "Язык",
  "language:": "язык:",
  "Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.":
    "Не является инвестиционной рекомендацией. Данные могут запаздывать или быть неточными. Сайт не связан ни с одной биржей и не одобрен ими.",

  // web/help.ts
  "What is this?": "Что это?",
  "About this page": "Об этой странице",

  // app/app.ts
  "{asset} is not an asset address.": "{asset} — не адрес актива.",
  "No live market for {asset}.": "Нет активного рынка {asset}.",
  "No live market for {asset}, so nothing to band against.":
    "Нет активного рынка {asset}, поэтому не к чему привязать ценовые диапазоны.",
  "No exchange is quoting a {asset} book right now.":
    "Сейчас ни одна биржа не котирует стакан {asset}.",
  "There's no exchange with that name.": "Биржи с таким названием нет.",
  "No exchange has a live {asset} perpetual right now.":
    "Сейчас ни у одной биржи нет активного бессрочного фьючерса {asset}.",
  // web/command.ts: the site-wide search, and its key on /keys
  search: "поиск",
  "Search tickers, exchanges and indices": "Поиск тикеров, бирж и индексов",
  Search: "Поиск",
  "Ticker, exchange or index": "Тикер, биржа или индекс",
  Results: "Результаты",
  move: "выбор",
  open: "открыть",
  close: "закрыть",
  "every exchange's rate and open interest": "ставка и открытый интерес на каждой бирже",
  "Funding spreads": "Спреды финансирования",
  "backtest a long/short pair": "бэктест пары лонг/шорт",
  Screener: "Скринер",
  "its spreads, ranked": "его спреды по рейтингу",
  Arbitrage: "Арбитраж",
  "price gaps between exchanges": "ценовые разрывы между биржами",
  "large resting orders and trades": "крупные заявки и сделки",
  Liquidations: "Ликвидации",
  "where positions are liquidated": "где ликвидируются позиции",
  "options gamma by strike": "гамма опционов по страйкам",
  "1 exchange": "1 биржа",
  "{n} exchanges": "бирж: {n}",
  "OI {usd}": "ОИ {usd}",
  Tickers: "Тикеры",
  "Other tickers": "Другие тикеры",
  Exchanges: "Биржи",
  "markets, costs and grade": "рынки, издержки и оценка",
  "Indices and option books": "Индексы и опционы",
  Pages: "Страницы",
  Recent: "Недавние",
  "Loading tickers…": "Загрузка тикеров…",
  "The ticker list did not load. Exchanges and pages still match.":
    "Список тикеров не загрузился. Биржи и страницы по-прежнему ищутся.",
  "Nothing matches {q}.": "Ничего не найдено по запросу {q}.",
  "price, spot and futures CVD": "цена, CVD спота и фьючерсов",
};
