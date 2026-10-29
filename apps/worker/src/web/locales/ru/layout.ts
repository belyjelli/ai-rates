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
  "MCP &amp; agents": "MCP и агенты",
  "legal &amp; privacy": "право и приватность",
  terms: "условия",
  Language: "Язык",
  menu: "меню",
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
  "Index levels": "Уровни индексов",
  "the level, its daily closes and what trades on it":
    "уровень, дневные закрытия и что на нём торгуется",
  "Indices and option books": "Индексы и опционы",
  Pages: "Страницы",
  Recent: "Недавние",
  "Loading tickers…": "Загрузка тикеров…",
  "The ticker list did not load. Exchanges and pages still match.":
    "Список тикеров не загрузился. Биржи и страницы по-прежнему ищутся.",
  "Nothing matches {q}.": "Ничего не найдено по запросу {q}.",
  "price, spot and futures CVD": "цена, CVD спота и фьючерсов",
  System: "Как в системе",
  "Day or Night, as your device is set": "День или ночь, как настроено устройство",
  Settings: "Настройки",
  "Your settings on airrates: theme, clock, chart cursor, language and keyboard.":
    "Ваши настройки airrates: тема, часы, курсор графика, язык и клавиатура.",
  "Each choice is kept in this browser, not on an account: it needs no login, and another browser or device starts from the defaults. Clearing the site's data resets them.":
    "Каждый выбор хранится в этом браузере, а не в аккаунте: вход не нужен, а другой браузер или устройство начинает с настроек по умолчанию. Очистка данных сайта их сбрасывает.",
  Theme: "Тема",
  "The colours of every page. Charts take the new colours from the next page you open.":
    "Цвета всех страниц. Графики примут новые цвета на следующей открытой странице.",
  Clock: "Часы",
  "The clock in the header, and the times on charts and tables.":
    "Часы в шапке и время на графиках и в таблицах.",
  "Local time": "Местное время",
  "Chart cursor": "Курсор графика",
  "What follows the pointer on a chart: a crosshair with the value on each axis, or the whole bar lit.":
    "Что следует за указателем на графике: перекрестие со значением на каждой оси или подсветка всего бара.",
  "The site's language, kept for this browser.": "Язык сайта, сохраняется для этого браузера.",
  "Every shortcut on the site. Members remap them into profiles kept on their account.":
    "Все горячие клавиши сайта. Участники переназначают их и хранят профили в своём аккаунте.",
  "keyboard shortcuts": "горячие клавиши",
  Reset: "Сброс",
  "Back to the defaults: Night, local time, the crosshair, and every chart's own view.":
    "Вернуть настройки по умолчанию: ночь, местное время, перекрестие и вид каждого графика.",
  "reset settings": "сбросить настройки",
  "Saved in this browser.": "Сохранено в этом браузере.",
  "Back to the defaults.": "Настройки по умолчанию восстановлены.",
  settings: "настройки",
  Night: "Ночь",
  "Black terminal, the default": "Чёрный терминал, по умолчанию",
  "Ink on white, for daylight": "Тёмный текст на белом, для дня",
  Solar: "Солар",
  "Solarized light: warm paper, soft contrast": "Solarized светлая: тёплая бумага, мягкий контраст",
  "Solar dark": "Солар тёмная",
  "Solarized dark: deep teal": "Solarized тёмная: глубокий бирюзовый",
  Dusk: "Сумерки",
  "Slate blue, easy on the eyes at night": "Сланцево-синяя, бережёт глаза ночью",
  Sepia: "Сепия",
  "Old paper and brown ink": "Старая бумага и коричневые чернила",
  Phosphor: "Фосфор",
  "Green screen, an old terminal": "Зелёный экран, старый терминал",
  "High contrast": "Высокий контраст",
  "White on black, brightest lines": "Белое на чёрном, самые яркие линии",
};
