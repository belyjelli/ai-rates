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
};
