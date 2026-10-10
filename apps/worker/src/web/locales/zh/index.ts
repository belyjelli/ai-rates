/**
 * Simplified Chinese. One file per part of the site, so the catalog for a page sits in one place and
 * i18n.test.ts can tell two parts that translate the same English differently.
 *
 * GLOSSARY. One term, one translation, across every part; a reader comparing two pages must not have
 * to wonder whether 多头 and 做多方 are different things. Mainland crypto-exchange usage throughout.
 *
 *   funding rate        资金费率          perpetual (perp)    永续合约
 *   funding spread      资金费率价差      spread (short)      价差
 *   exchange / venue    交易所            market              市场
 *   long / short        多头 / 空头       go long on X        在 X 做多
 *   leg (of a pair)     腿 (多头腿)       pair                配对
 *   open interest, OI   持仓量            24h volume          24 小时成交量
 *   APR                 年化              annualized          年化
 *   settlement          结算              settled             已结算
 *   interval            结算周期          backtest            回测
 *   carry               套利              funding carry       资金费率套利
 *   screener            筛选器            rates               费率
 *   arbitrage           套利              liquidations        爆仓
 *   taker / maker       吃单 / 挂单       fees                手续费
 *   slippage            滑点              basis               基差
 *   mark / index price  标记价格 / 指数价格  quote currency   计价货币
 *   stability           稳定性            win rate            胜率
 *   fear & greed        恐惧与贪婪        bps                 基点
 *   CVD                 CVD               not financial advice  不构成投资建议
 *
 * Style: full-width punctuation in prose (，。：；（）), a space between Chinese and Latin letters or
 * figures ("在 Binance 做多"), and the site's " · " separators and figures left exactly as they are.
 * Venue names, tickers, units ($, %, bps figures) and code-like labels are never translated.
 */

import type { Catalog } from "../../i18n";
import { charts } from "./charts";
import { keyboard } from "./keyboard";
import { layout } from "./layout";
import { liquidations } from "./liquidations";
import { pages } from "./pages";
import { site } from "./site";
import { whales } from "./whales";

/** Each part on its own, for the test that checks two parts never disagree on one key. */
export const ZH_PARTS: Readonly<Record<string, Catalog>> = {
  layout,
  pages,
  liquidations,
  charts,
  site,
  keyboard,
  whales,
};

export const zh: Catalog = Object.assign({}, ...Object.values(ZH_PARTS));
