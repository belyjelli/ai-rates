/**
 * Japanese. One file per part of the site, so the catalog for a page sits in one place and
 * i18n.test.ts can tell two parts that translate the same English differently.
 *
 * GLOSSARY. One term, one translation, across every part. The words Japanese crypto exchanges and
 * traders use (Bybit, Binance and bitFlyer's Japanese pages), not dictionary Japanese.
 *
 *   funding rate        資金調達率          perpetual (perp)    無期限先物
 *   funding (payment)   資金調達料          spread              スプレッド
 *   funding spread      資金調達率スプレッド exchange / venue   取引所
 *   market (a listed    銘柄                market (as a whole) 市場
 *     contract)
 *   long / short        ロング / ショート   go long on X        X でロング
 *   leg (of a pair)     レッグ              pair                ペア
 *   open interest, OI   建玉                24h volume          24時間出来高
 *   APR / annualized    年率                settlement          精算
 *   settled             精算済み            interval            精算間隔
 *   backtest            バックテスト        carry               キャリー
 *   arbitrage           アービトラージ      screener            スクリーナー
 *   rates               レート              liquidations        清算
 *   taker / maker       テイカー / メイカー fees                手数料
 *   slippage            スリッページ        basis               ベーシス
 *   mark / index price  マーク価格 / インデックス価格            quote currency  建て通貨
 *   stability           安定性              win rate            勝率
 *   fear & greed        恐怖と強欲          bps                 bps
 *   whale               クジラ              order book          板
 *   wall (in the book)  壁                  CVD                 CVD
 *   not financial advice  投資助言ではありません
 *
 * Style: です・ます in sentences, plain noun phrases in labels, buttons and column heads. Full-width
 * 、。（）「」 in prose; never an ASCII double quote (many keys sit in attributes), 「」 instead. One
 * half-width space between Japanese and a Latin word, ticker or placeholder ("Binance でロング"); none
 * between a figure and its counter or unit ("24時間", "{n}件", "{m}分"). The site's " · " separators,
 * figures, venue names, tickers, units ($, %, bps) and code-like labels are left exactly as they are.
 */

import type { Catalog } from "../../i18n";
import { charts } from "./charts";
import { exchanges } from "./exchanges";
import { gamma } from "./gamma";
import { keyboard } from "./keyboard";
import { layout } from "./layout";
import { liquidations } from "./liquidations";
import { macro } from "./macro";
import { pages } from "./pages";
import { site } from "./site";
import { whales } from "./whales";

/** Each part on its own, for the test that checks two parts never disagree on one key. */
export const JA_PARTS: Readonly<Record<string, Catalog>> = {
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
};

export const ja: Catalog = Object.assign({}, ...Object.values(JA_PARTS));
