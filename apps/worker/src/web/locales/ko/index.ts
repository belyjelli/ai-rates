/**
 * Korean. One file per part of the site, so the catalog for a page sits in one place and
 * i18n.test.ts can tell two parts that translate the same English differently.
 *
 * GLOSSARY. One term, one translation, across every part. The words Korean crypto exchanges and
 * traders use (Upbit, Bithumb, Binance and Bybit's Korean pages), not dictionary Korean.
 *
 *   funding rate        펀딩비              perpetual (perp)    무기한 선물
 *   funding spread      펀딩비 스프레드     spread              스프레드
 *   exchange / venue    거래소              market (a listed    종목
 *                                             contract)
 *   market (as a whole) 시장                long / short        롱 / 숏
 *   go long on X        X에서 롱            leg (of a pair)     레그
 *   pair                페어                open interest, OI   미결제약정
 *   24h volume          24시간 거래량       APR / annualized    연환산
 *   settlement          정산                settled             정산 완료
 *   interval            정산 주기           backtest            백테스트
 *   carry               캐리                arbitrage           차익거래
 *   screener            스크리너            rates               요율
 *   liquidations        청산                taker / maker       테이커 / 메이커
 *   fees                수수료              slippage            슬리피지
 *   basis               베이시스            mark / index price  마크 가격 / 인덱스 가격
 *   quote currency      견적 통화           stability           안정성
 *   win rate            승률                fear & greed        공포와 탐욕
 *   bps                 bps                 whale               고래
 *   order book          호가창              wall (in the book)  벽
 *   CVD                 CVD                 not financial advice  투자 조언이 아닙니다
 *
 * Style: 합니다체 in sentences, plain noun phrases in labels, buttons and column heads. Standard
 * Korean spacing and ASCII punctuation; never an ASCII double quote (many keys sit in attributes),
 * ‘ ’ or 「」 instead. A counter or unit joins its figure ("24시간", "{n}개", "{m}분"). After a
 * placeholder, use a particle that reads after any word ("{venue}에서", "{venue}의") or the paired
 * form ("{venue}을(를)"), since a placeholder's last sound is unknown. The site's " · " separators,
 * figures, venue names, tickers, units ($, %, bps) and code-like labels are left exactly as they are.
 */

import type { Catalog } from "../../i18n";
import { charts } from "./charts";
import { gamma } from "./gamma";
import { keyboard } from "./keyboard";
import { layout } from "./layout";
import { liquidations } from "./liquidations";
import { macro } from "./macro";
import { pages } from "./pages";
import { site } from "./site";
import { whales } from "./whales";

/** Each part on its own, for the test that checks two parts never disagree on one key. */
export const KO_PARTS: Readonly<Record<string, Catalog>> = {
  layout,
  pages,
  liquidations,
  charts,
  site,
  keyboard,
  whales,
  gamma,
  macro,
};

export const ko: Catalog = Object.assign({}, ...Object.values(KO_PARTS));
