/**
 * Korean for the frame every page shares -- web/layout.ts (masthead, nav, footer), the time and
 * label helpers in web/format.ts -- and the not-found messages app/app.ts builds.
 * Glossary and style: ./index.ts.
 *
 * Terms: Telegram group 텔레그램, geo-probe 지역 점검, referral links 추천 링크.
 */

import type { Catalog } from "../../i18n";

export const layout: Catalog = {
  // web/format.ts
  "{s}s": "{s}초",
  "{m}m": "{m}분",
  "{h}h {m}m": "{h}시간 {m}분",
  "{time} ago": "{time} 전",
  settling: "정산 중",
  never: "없음",
  "extreme fear": "극단적 공포",
  fear: "공포",
  neutral: "중립",
  greed: "탐욕",
  "extreme greed": "극단적 탐욕",

  // web/layout.ts
  spreads: "스프레드",
  screener: "스크리너",
  rates: "요율",
  arbitrage: "차익거래",
  liquidations: "청산",
  exchanges: "거래소",
  "{markets} markets · {venues} venues · updated {ago}":
    "종목 {markets}개 · 거래소 {venues}곳 · {ago} 업데이트",
  "no venue has reported in five minutes": "5분 동안 데이터를 보낸 거래소가 없습니다",
  "Fear &amp; greed: click for the chart": "공포와 탐욕: 클릭하면 차트를 봅니다",
  "What settled. Not what might.": "정산된 것만. 예상이 아니라.",
  "Your local time ({zone}). Click for UTC.": "현지 시간({zone})입니다. 클릭하면 UTC로 바뀝니다.",
  "UTC, the clock funding settles by. Click for your local time.":
    "UTC, 펀딩비 정산의 기준 시간입니다. 클릭하면 현지 시간으로 바뀝니다.",
  filter: "필터",
  login: "로그인",
  telegram: "텔레그램",
  "Join the airrates group on Telegram: @airratesnet":
    "텔레그램 airrates 그룹에 참여하세요: @airratesnet",
  status: "상태",
  "geo-probe": "지역 점검",
  about: "소개",
  "referral links": "추천 링크",
  "legal &amp; privacy": "법적 고지 및 개인정보",
  terms: "이용약관",
  Language: "언어",
  "language:": "언어:",
  "Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.":
    "투자 조언이 아닙니다. 데이터는 지연되거나 부정확할 수 있습니다. 어떤 거래소와도 제휴하거나 보증받지 않았습니다.",

  // web/help.ts
  "What is this?": "이게 뭔가요?",
  "About this page": "이 페이지 설명",

  // app/app.ts
  "{asset} is not an asset address.": "{asset}은(는) 자산 주소가 아닙니다.",
  "No live market for {asset}.": "{asset}의 활성 종목이 없습니다.",
  "No live market for {asset}, so nothing to band against.":
    "{asset}의 활성 종목이 없어 가격 구간을 나눌 수 없습니다.",
  "No exchange is quoting a {asset} book right now.":
    "지금 {asset} 호가창을 제공하는 거래소가 없습니다.",
  "There's no exchange with that name.": "그 이름의 거래소가 없습니다.",
  "No exchange has a live {asset} perpetual right now.":
    "지금 {asset} 무기한 선물이 활성 상태인 거래소가 없습니다.",
  // web/command.ts: the site-wide search, and its key on /keys
  search: "검색",
  "Search tickers, exchanges and indices": "티커, 거래소, 지수 검색",
  Search: "검색",
  "Ticker, exchange or index": "티커, 거래소 또는 지수",
  Results: "결과",
  move: "이동",
  open: "열기",
  close: "닫기",
  "every exchange's rate and open interest": "거래소별 요율과 미결제약정",
  "Funding spreads": "펀딩비 스프레드",
  "backtest a long/short pair": "롱/숏 페어 백테스트",
  Screener: "스크리너",
  "its spreads, ranked": "스프레드 순위",
  Arbitrage: "차익거래",
  "price gaps between exchanges": "거래소 간 가격 차이",
  "large resting orders and trades": "대형 대기 주문과 체결",
  Liquidations: "청산",
  "where positions are liquidated": "포지션이 청산되는 가격",
  "options gamma by strike": "행사가별 옵션 감마",
  "1 exchange": "거래소 1곳",
  "{n} exchanges": "거래소 {n}곳",
  "OI {usd}": "미결제약정 {usd}",
  Tickers: "티커",
  "Other tickers": "다른 티커",
  Exchanges: "거래소",
  "markets, costs and grade": "시장, 비용, 등급",
  "Indices and option books": "지수와 옵션",
  Pages: "페이지",
  Recent: "최근",
  "Loading tickers…": "티커 불러오는 중…",
  "The ticker list did not load. Exchanges and pages still match.":
    "티커 목록을 불러오지 못했습니다. 거래소와 페이지는 계속 검색됩니다.",
  "Nothing matches {q}.": "{q}와(과) 일치하는 결과가 없습니다.",
  "price, spot and futures CVD": "가격, 현물 및 선물 CVD",
};
