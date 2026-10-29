/**
 * Russian. One file per part of the site, so the catalog for a page sits in one place and
 * i18n.test.ts can tell two parts that translate the same English differently.
 *
 * GLOSSARY. One term, one translation, across every part. The words Russian-speaking crypto traders
 * and exchanges use (Binance and Bybit's Russian pages, trading chats), not dictionary Russian.
 *
 *   funding rate        ставка финансирования   perpetual (perp)  бессрочный фьючерс
 *   funding (payment)   фандинг                 spread            спред
 *   funding spread      спред фандинга          exchange / venue  биржа
 *   market              рынок                   long / short      лонг / шорт
 *   go long on X        лонг на X               leg (of a pair)   нога
 *   pair                пара                    open interest, OI открытый интерес (OI)
 *   24h volume          объём за 24 ч           APR / annualized  годовых (APR)
 *   settlement          выплата                 settled           выплачено
 *   interval            интервал                backtest          бэктест
 *   carry               керри                   arbitrage         арбитраж
 *   screener            скринер                 rates             ставки
 *   liquidations        ликвидации              taker / maker     тейкер / мейкер
 *   fees                комиссии                slippage          проскальзывание
 *   basis               базис                   mark price        цена маркировки
 *   index price         индексная цена          quote currency    котируемая валюта
 *   stability           стабильность            win rate          винрейт
 *   fear & greed        страх и жадность        bps               bps
 *   whale               кит                     order book        стакан
 *   wall (in the book)  плотность               CVD               CVD
 *   not financial advice  не является инвестиционной рекомендацией
 *
 * Style: address the reader as «вы» (lower case); short labels, since Russian runs about a third
 * longer than English and table heads, buttons and the nav must stay narrow (ч, мин, с, д are the
 * time units: "{h} ч {m} мин"). Guillemets «» for quotes, never an ASCII double quote (many keys sit
 * in attributes). A count never has to agree with its noun: write "рынков: {count}" or a form that
 * reads right for 1, 2 and 5, and avoid a verb or adjective that agrees with a placeholder's gender.
 * The site's " · " separators, figures, venue names, tickers, units ($, %, bps) and code-like labels
 * are left exactly as they are.
 */

import type { Catalog } from "../../i18n";
import { charts } from "./charts";
import { exchanges } from "./exchanges";
import { gamma } from "./gamma";
import { holdings } from "./holdings";
import { keyboard } from "./keyboard";
import { layout } from "./layout";
import { liquidations } from "./liquidations";
import { macro } from "./macro";
import { pages } from "./pages";
import { site } from "./site";
import { whales } from "./whales";

/** Each part on its own, for the test that checks two parts never disagree on one key. */
export const RU_PARTS: Readonly<Record<string, Catalog>> = {
  layout,
  pages,
  liquidations,
  charts,
  site,
  keyboard,
  whales,
  gamma,
  macro,
  exchanges,
  holdings,
};

export const ru: Catalog = Object.assign({}, ...Object.values(RU_PARTS));
