/**
 * Russian for the site-wide pieces and the small pages: web/about.ts, web/legal.ts and web/tos.ts
 * (their notice only -- the bodies stay English), web/referral-links.ts, web/referral.ts,
 * web/install.ts, web/share.ts, web/await.ts and web/tabs.ts. Glossary and style: ./index.ts.
 *
 * Terms: referral link реферальная ссылка, referral code реферальный код, account счёт, sign up
 * регистрация, commit коммит, build сборка, deploy развёртывание, post (on X) пост. Dates put the day
 * first ("16 окт 2026"), with the same short month names as the charts part.
 */

import type { Catalog } from "../../i18n";

export const site: Catalog = {
  // web/about.ts
  Jan: "янв",
  Feb: "фев",
  Mar: "мар",
  Apr: "апр",
  May: "мая",
  Jun: "июн",
  Jul: "июл",
  Aug: "авг",
  Sep: "сен",
  Oct: "окт",
  Nov: "ноя",
  Dec: "дек",
  "{month} {day}, {year}": "{day} {month} {year}",
  project: "проект",
  commit: "коммит",
  "not recorded": "не записан",
  "This build did not record its commit. Deployed builds stamp the commit they were built from here.":
    "Эта сборка не записала свой коммит. Развёрнутые сборки указывают здесь коммит, из которого собраны.",
  committed: "закоммичено",
  deployed: "развёрнуто",
  "Release notes are written in English.": "Список изменений ведётся на английском.",
  About: "О сайте",
  "What airrates is, which version is running, and what has changed recently.":
    "Что такое airrates, какая версия сейчас работает и что изменилось за последнее время.",
  "About airrates": "Об airrates",
  "airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.":
    "airrates — скринер ставок финансирования бессрочных фьючерсов. Каждую минуту он читает фандинг из публичного API каждой биржи и показывает, где лонг по активу на одной бирже и шорт по тому же активу на другой собирают разницу их ставок, — и сколько это реально принесло.",
  "This version": "Текущая версия",
  "Recent changes": "Последние изменения",

  // web/legal.ts, web/tos.ts
  "This page is available in English only. The English text is the binding version.":
    "Эта страница доступна только на английском. Юридическую силу имеет английский текст.",

  // web/referral-links.ts
  "<b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. {link}":
    "<b>Раскрытие информации.</b> airrates может получить комиссию, если вы откроете счёт по ссылке на этой странице, — без дополнительных затрат для вас. Реферальные ссылки никогда не влияют на то, какие рынки показаны и как они ранжированы. Наличие биржи в списке — не рекомендация: перед регистрацией убедитесь, что биржа обслуживает вашу страну, и помните, что бессрочные фьючерсы торгуются с плечом и убыток может превысить вашу маржу. {link}",
  "How referral links work": "Как работают реферальные ссылки",
  "No referral links yet.": "Реферальных ссылок пока нет.",
  "Referral links are not shown in your location.":
    "В вашем регионе реферальные ссылки не показываются.",
  "None of these exchanges' referral links can be shown in your location.":
    "Ни одну из реферальных ссылок этих бирж нельзя показать в вашем регионе.",
  "The link applies the referral itself": "Ссылка сама применяет реферальный код",
  Exchange: "Биржа",
  Type: "Тип",
  "Referral code": "Реферальный код",
  "Sign up": "Регистрация",
  "{count} more exchange's link is not available in your location.":
    "Ещё у {count} биржи ссылка недоступна в вашем регионе.",
  "{count} more exchanges' links are not available in your location.":
    "Ещё бирж, чьи ссылки недоступны в вашем регионе: {count}.",
  "Referral links": "Реферальные ссылки",
  "Referral links for the exchanges airrates tracks, for readers opening a new account.":
    "Реферальные ссылки бирж, которые отслеживает airrates, — для тех, кто открывает новый счёт.",
  "The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.":
    "Биржи, для которых у airrates есть реферальная ссылка. Если у вас ещё нет счёта на какой-то из них, его можно открыть по ссылке.",

  // web/referral.ts
  "How this works": "Как это работает",
  "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "Реферальная ссылка: код {code}. airrates может получить комиссию, если вы зарегистрируетесь по ней, — для вас бесплатно. {how}",
  "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "Реферальная ссылка: airrates может получить комиссию, если вы зарегистрируетесь по ней, — для вас бесплатно. {how}",
  "Open a {venue} account": "Открыть счёт на {venue}",

  // web/install.ts
  "Install the app": "Установить приложение",
  "Install airrates": "Установить airrates",
  "Opens in its own window, from your home screen.":
    "Открывается в отдельном окне с главного экрана.",
  "Install app": "Установить",
  "Not now": "Не сейчас",

  // web/share.ts
  "Share the chart in view as an image sized for X":
    "Поделиться видимым графиком как картинкой под размер X",
  chart: "график",
  "Quote this page's best line, with a link back to it":
    "Процитировать главную строку страницы со ссылкой на неё",
  cite: "цитата",
  "No chart on this view": "На этом экране нет графика",
  close: "закрыть",
  Copied: "Скопировано",
  "Select + copy": "Выделите и скопируйте",
  "Cite this page": "Цитировать страницу",
  "Pick the line · the page's own numbers, as they read now":
    "Выберите строку · цифры самой страницы, как они выглядят сейчас",
  "Your post · edit it freely": "Ваш пост · редактируйте как угодно",
  "Back-link · this exact page, venue and filters":
    "Обратная ссылка · эта страница, биржа и фильтры",
  Copy: "Копировать",
  "Post on X": "Опубликовать в X",
  "Copy line + link": "Копировать строку и ссылку",
  "Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: {stamp}. Not financial advice.":
    "Цитируйте число и ссылайтесь на источник. Фандинг меняется каждую минуту, поэтому в строке указано, когда это было верно: {stamp}. Не является инвестиционной рекомендацией.",
  "{count} characters left with the link": "Осталось символов с учётом ссылки: {count}",
  "+{count} more": "ещё +{count}",
  "public venue APIs · not financial advice":
    "публичные API бирж · не является инвестиционной рекомендацией",
  "Share your line": "Поделиться графиком",
  "chart image": "изображение графика",
  "Image · 1600 × 900, X's own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.":
    "Изображение · 1600 × 900, родной формат X 16:9 — в ленте показывается без обрезки. Чтобы сохранить, щёлкните правой кнопкой или нажмите и удерживайте.",
  "Copy image": "Копировать картинку",
  "Download PNG": "Скачать PNG",
  "Link · this exact view": "Ссылка · именно этот вид",
  "Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues', the call is yours.":
    "Скопируйте картинку, нажмите «Опубликовать в X» и вставьте её в пост. На карточке указан адрес, откуда она взята; ссылка открывает тот же вид. Мы никогда не прогнозируем направление — цифры от бирж, решение за вами.",
  "the image could not be drawn in this browser":
    "в этом браузере не удалось нарисовать изображение",
  "Copy blocked — download instead": "Копирование заблокировано — скачайте файл",

  // web/await.ts
  "Building report": "Отчёт формируется",
  "Still building": "Ещё формируется",

  // web/tabs.ts
  Sections: "Разделы",

  // web/glossary.ts (and its entry in the footer menu and the shortcut map)
  terminology: "термины",
  Terminology: "Термины",
  "Order flow": "Поток ордеров",
  "Aggressive buying minus aggressive selling.": "Агрессивные покупки минус агрессивные продажи.",
  "cumulative volume delta": "кумулятивная дельта объёма",
  "Delta added up through the session.": "Дельта, накопленная за сессию.",
  'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.':
    'Есть на странице <a href="/chart">График</a>: спот и фьючерсы отдельно, сумма по биржам.',
  Imbalance: "Дисбаланс",
  "One side trading 3x or more the other at a price.":
    "Объём одной стороны на цене в 3 раза и более превышает объём другой.",
  Absorption: "Поглощение",
  "Heavy aggression, no progress.": "Сильная агрессия, а цена стоит на месте.",
  'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.':
    'Читается на вкладке «Шансы» страницы <a href="/liquidations#odds">Ликвидации</a> как инициатива против поглощения.',
  "Volume profile": "Профиль объёма",
  "volume point of control": "точка контроля объёма",
  "The price with the most volume.": "Цена с наибольшим объёмом.",
  "Value area": "Зона стоимости",
  "Where 70% of the volume traded.": "Где прошло 70% объёма.",
  "low-volume node": "узел низкого объёма",
  "A thin price the market moved through fast.": "Тонкая цена, которую рынок прошёл быстро.",
  "Single prints": "Одиночные принты",
  "A zone only one 30-minute period traded.": "Зона, где торговал только один 30-минутный период.",
  // web/glossary.ts: the terms added 2026-11-10 beside the owner's first eight
  "Delta (order flow)": "Дельта (поток ордеров)",
  Initiative: "Инициатива",
  "Aggression that moves price; the opposite of absorption.":
    "Агрессия, которая двигает цену; противоположность поглощения.",
  "Taker flow": "Поток тейкеров",
  "The trades CVD is added up from, buys against sells.":
    "Сделки, из которых складывается CVD: агрессивные покупки против продаж.",
  "Options and gamma": "Опционы и гамма",
  "gamma exposure": "гамма-экспозиция",
  "How much dealers must buy or sell for each 1% move.":
    "Сколько дилерам нужно купить или продать на каждый 1% движения.",
  'Shown on the <a href="/rates#gamma">Rates</a> page’s Gamma Exposure tab, and told as it moves by the market narrator at the top of every page.':
    'На вкладке «Гамма-экспозиция» страницы <a href="/rates#gamma">Ставки</a>; комментатор рынка вверху каждой страницы рассказывает, как она меняется.',
  "The price where dealers' net gamma changes sign.":
    "Цена, на которой чистая гамма дилеров меняет знак.",
  'Marked on the <a href="/rates#gamma">Gamma Exposure</a> tab, and the line the market narrator reads every price against.':
    'Отмечен на вкладке <a href="/rates#gamma">Гамма-экспозиция</a>; с этой линией комментатор рынка сравнивает каждую цену.',
  "Long / short gamma": "Длинная / короткая гамма",
  "Long: dealers' hedging sells rises and buys dips, damping moves. Short: it chases price, adding to moves.":
    "Длинная: хеджируясь, дилеры продают на росте и покупают на падении и гасят движения. Короткая: хеджирование гонится за ценой и усиливает движения.",
  'Shaded in the zones view of the <a href="/rates#gamma">Gamma Exposure</a> tab.':
    'Закрашена в режиме зон на вкладке <a href="/rates#gamma">Гамма-экспозиция</a>.',
  "The strike holding the most call or put gamma; it tends to cap or floor price.":
    "Страйк с наибольшей гаммой коллов или путов; цена часто упирается в него сверху или снизу.",
  'Shown on the <a href="/rates#gamma">Gamma Exposure</a> tab and in every market narrator line.':
    'На вкладке <a href="/rates#gamma">Гамма-экспозиция</a> и в каждой строке комментатора рынка.',
  "Delta (options)": "Дельта (опционы)",
  "How much an option's price moves per point of the underlying.":
    "На сколько меняется цена опциона при движении базового актива на один пункт.",
  'By strike on the <a href="/rates#delta">Rates</a> page’s Delta tab.':
    'По страйкам на вкладке «Дельта» страницы <a href="/rates#delta">Ставки</a>.',
  "How much an option's price moves per point of implied volatility.":
    "На сколько меняется цена опциона при изменении подразумеваемой волатильности на один пункт.",
  'By strike on the <a href="/rates#vega">Rates</a> page’s Vega tab.':
    'По страйкам на вкладке «Вега» страницы <a href="/rates#vega">Ставки</a>.',
  "What an option loses in value each day as expiry nears.":
    "Сколько опцион теряет в цене каждый день по мере приближения экспирации.",
  'By strike on the <a href="/rates#theta">Rates</a> page’s Theta tab.':
    'По страйкам на вкладке «Тета» страницы <a href="/rates#theta">Ставки</a>.',
  "implied volatility": "подразумеваемая волатильность",
  "The size of move the option prices expect, per year.":
    "Размер движения, который закладывают цены опционов, в годовом выражении.",
  'Drawn as walls on the <a href="/rates#ivwalls">Rates</a> page’s IV Walls tab.':
    'Нарисована стенами на вкладке «IV-стены» страницы <a href="/rates#ivwalls">Ставки</a>.',
  "1σ move": "Движение 1σ",
  "The day's expected move from the options: one standard deviation either side.":
    "Ожидаемое движение за день по опционам: одно стандартное отклонение в каждую сторону.",
  'The IV walls on the <a href="/rates#ivwalls">Rates</a> page, and the IV move on <a href="/whales">Whales</a>.':
    'IV-стены на странице <a href="/rates#ivwalls">Ставки</a> и IV-движение на странице <a href="/whales">Киты</a>.',
  "The strike where option buyers lose the most at expiry.":
    "Страйк, на котором покупатели опционов теряют больше всего при экспирации.",
  'Marked on the <a href="/rates#levels">Rates</a> page’s Ceiling &amp; Floor tab.':
    'Отмечен на вкладке «Потолок и пол» страницы <a href="/rates#levels">Ставки</a>.',
  "Reaction zone": "Зона реакции",
  "Where an IV wall and a gamma wall line up.": "Место, где IV-стена и гамма-стена совпадают.",
  'In full on the <a href="/rates#ivwalls">IV Walls</a> and <a href="/rates#levels">Ceiling &amp; Floor</a> tabs, folded on the other option tabs.':
    'Полностью на вкладках <a href="/rates#ivwalls">IV-стены</a> и <a href="/rates#levels">Потолок и пол</a>, свёрнута на остальных опционных вкладках.',
  "Funding and perps": "Фандинг и перпетуалы",
  "Funding rate": "Ставка финансирования",
  "What longs pay shorts, or shorts pay longs, to keep a perp near spot.":
    "Что лонги платят шортам или шорты лонгам, чтобы перпетуал держался у спота.",
  'Every exchange side by side on the <a href="/rates">Rates</a> page.':
    'Все биржи рядом на странице <a href="/rates">Ставки</a>.',
  "annual percentage rate": "годовая процентная ставка",
  "A funding rate scaled to a year, so different settlement intervals compare.":
    "Ставка финансирования в пересчёте на год, чтобы сравнивать разные интервалы расчёта.",
  'The unit the <a href="/screener">Screener</a> shows by default.':
    'Единица, которую <a href="/screener">Скринер</a> показывает по умолчанию.',
  "Settlement interval": "Интервал расчёта",
  "How often funding is paid: every 1, 4 or 8 hours.":
    "Как часто платится фандинг: каждые 1, 4 или 8 часов.",
  'In each leg of a <a href="/screener">Screener</a> row.':
    'В каждой ноге строки <a href="/screener">Скринера</a>.',
  "Funding spread / carry": "Спред фандинга / кэрри",
  "Long where funding is cheap, short where it is rich, and collect the gap.":
    "Лонг там, где фандинг дешёвый, шорт там, где дорогой, и забрать разницу.",
  'The pairs the <a href="/">home page</a> and the <a href="/screener">Screener</a> rank.':
    'Пары, которые ранжируют <a href="/">главная страница</a> и <a href="/screener">Скринер</a>.',
  "Contracts still open: money in the market, not traded volume.":
    "Ещё не закрытые контракты: деньги в рынке, а не объём торгов.",
  'In each leg of a <a href="/screener">Screener</a> row, and per asset on the <a href="/chart">Chart</a> page.':
    'В каждой ноге строки <a href="/screener">Скринера</a> и по каждому активу на странице <a href="/chart">График</a>.',
  "A perp or future's price minus spot.": "Цена перпетуала или фьючерса минус спот.",
  "Mark / index price": "Цена маркировки / индексная цена",
  "Mark is the price used for liquidations; index is the spot average it tracks.":
    "Цена маркировки используется для ликвидаций; индексная — среднее по споту, за которым она следует.",
  'Each pair’s page, opened from a row on <a href="/arbitrage">Arbitrage</a>, charts the mark prices hourly.':
    'Страница каждой пары, открытая из строки на странице <a href="/arbitrage">Арбитраж</a>, показывает цены маркировки по часам.',
  "Taker / maker": "Тейкер / мейкер",
  "A taker crosses the spread and pays the higher fee; a maker rests an order and waits.":
    "Тейкер пересекает спред и платит более высокую комиссию; мейкер выставляет заявку и ждёт.",
  'The <a href="/markets">Exchanges</a> page prices a $10k market order with each exchange’s taker fee.':
    'Страница <a href="/markets">Биржи</a> считает рыночную заявку на $10k по тейкер-комиссии каждой биржи.',
  "Liquidations and whales": "Ликвидации и киты",
  Liquidation: "Ликвидация",
  "A position the exchange closes because its margin ran out.":
    "Позиция, которую биржа закрывает, потому что кончилась маржа.",
  'Every exchange’s, live, on the <a href="/liquidations">Liquidations</a> page.':
    'Ликвидации всех бирж в реальном времени на странице <a href="/liquidations">Ликвидации</a>.',
  "Whale order": "Заявка кита",
  "A resting order big enough to show on the depth chart.":
    "Лимитная заявка, настолько крупная, что видна на графике глубины.",
  'Binance walls and Hyperliquid whale orders on the <a href="/whales">Whales</a> page.':
    'Стены Binance и заявки китов Hyperliquid на странице <a href="/whales">Киты</a>.',
  "The site's terms in one line each: order flow, the volume profile, options and gamma, funding and perps, liquidations and whales.":
    "Термины сайта, по одной строке: поток ордеров, профиль объёма, опционы и гамма, фандинг и перпетуалы, ликвидации и киты.",
  "The words the site uses, each in one line: order flow, the volume profile, options and gamma, funding, liquidations. Every term has its own link to share: /glossary#cvd opens this page at CVD.":
    "Слова, которыми пользуется сайт, по одной строке: поток ордеров, профиль объёма, опционы и гамма, фандинг, ликвидации. У каждого термина своя ссылка: /glossary#cvd открывает эту страницу на CVD.",
};
