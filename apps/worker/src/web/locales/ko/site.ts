/**
 * Korean for the site-wide pieces and the small pages: web/about.ts, web/legal.ts and web/tos.ts
 * (their notice only -- the bodies stay English), web/referral-links.ts, web/referral.ts,
 * web/install.ts, web/share.ts, web/await.ts and web/tabs.ts. Glossary and style: ./index.ts.
 *
 * Terms: referral link 추천 링크, referral code 추천 코드, commission 수수료, disclosure 고지,
 * release notes 릴리스 노트, back-link 백링크, post (on X) 게시글. The reader is addressed without
 * 당신, as Korean sites do.
 */

import type { Catalog } from "../../i18n";

export const site: Catalog = {
  // web/about.ts
  Jan: "1월",
  Feb: "2월",
  Mar: "3월",
  Apr: "4월",
  May: "5월",
  Jun: "6월",
  Jul: "7월",
  Aug: "8월",
  Sep: "9월",
  Oct: "10월",
  Nov: "11월",
  Dec: "12월",
  "{month} {day}, {year}": "{year}년 {month} {day}일",
  project: "프로젝트",
  commit: "커밋",
  "not recorded": "기록 없음",
  "This build did not record its commit. Deployed builds stamp the commit they were built from here.":
    "이 빌드는 커밋을 기록하지 않았습니다. 배포된 빌드는 빌드에 쓰인 커밋을 여기에 표시합니다.",
  committed: "커밋 시각",
  deployed: "배포 시각",
  "Release notes are written in English.": "릴리스 노트는 영어로 작성됩니다.",
  About: "소개",
  "What airrates is, which version is running, and what has changed recently.":
    "airrates 소개, 현재 실행 중인 버전, 최근 변경 사항.",
  "About airrates": "airrates 소개",
  "airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.":
    "airrates는 무기한 선물의 펀딩비 스크리너입니다. 매분 각 거래소의 공개 API에서 펀딩비를 읽어, 같은 자산을 한 거래소에서 롱, 다른 거래소에서 숏으로 보유해 두 요율의 차이를 받을 수 있는 곳과 그 포지션이 실제로 얼마를 벌었는지를 보여 줍니다.",
  "This version": "현재 버전",
  "Recent changes": "최근 변경 사항",

  // web/legal.ts, web/tos.ts
  "This page is available in English only. The English text is the binding version.":
    "이 페이지는 영어로만 제공됩니다. 영어 원문이 효력을 갖는 버전입니다.",

  // web/referral-links.ts
  "<b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. {link}":
    "<b>고지.</b> 이 페이지의 링크로 계정을 개설하면 airrates가 수수료를 받을 수 있으며, 이용자에게 추가 비용은 없습니다. 추천 링크는 어떤 종목이 표시되는지나 그 순위에 절대 영향을 주지 않습니다. 여기에 올라 있다고 해서 추천하는 것은 아닙니다: 가입 전에 해당 거래소가 거주 지역에서 서비스되는지 확인하고, 무기한 선물은 레버리지 상품이라 증거금보다 더 많이 잃을 수 있다는 점을 기억하세요. {link}",
  "How referral links work": "추천 링크 작동 방식",
  "No referral links yet.": "아직 추천 링크가 없습니다.",
  "Referral links are not shown in your location.":
    "현재 지역에서는 추천 링크가 표시되지 않습니다.",
  "None of these exchanges' referral links can be shown in your location.":
    "현재 지역에서는 이 거래소들의 추천 링크를 표시할 수 없습니다.",
  "The link applies the referral itself": "링크가 추천을 자동으로 적용합니다",
  Exchange: "거래소",
  Type: "유형",
  "Referral code": "추천 코드",
  "Sign up": "가입",
  "{count} more exchange's link is not available in your location.":
    "그 밖에 거래소 {count}곳의 링크는 현재 지역에서 이용할 수 없습니다.",
  "{count} more exchanges' links are not available in your location.":
    "그 밖에 거래소 {count}곳의 링크는 현재 지역에서 이용할 수 없습니다.",
  "Referral links": "추천 링크",
  "Referral links for the exchanges airrates tracks, for readers opening a new account.":
    "새 계정을 개설하려는 독자를 위한, airrates가 추적하는 거래소의 추천 링크.",
  "The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.":
    "airrates에 추천 링크가 있는 거래소입니다. 아직 계정이 없다면 링크로 개설할 수 있습니다.",

  // web/referral.ts
  "How this works": "작동 방식",
  "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "추천 링크: 코드 {code}. 이 링크로 가입하면 airrates가 수수료를 받을 수 있으며, 이용자에게 비용은 없습니다. {how}",
  "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "추천 링크: 이 링크로 가입하면 airrates가 수수료를 받을 수 있으며, 이용자에게 비용은 없습니다. {how}",
  "Open a {venue} account": "{venue} 계정 개설",

  // web/install.ts
  "Install the app": "앱 설치",
  "Install airrates": "airrates 설치",
  "Opens in its own window, from your home screen.": "홈 화면에서 별도 창으로 열립니다.",
  "Install app": "앱 설치",
  "Not now": "나중에",

  // web/share.ts
  "Share the chart in view as an image sized for X": "보이는 차트를 X에 맞는 크기의 이미지로 공유",
  chart: "차트",
  "Quote this page's best line, with a link back to it": "이 페이지의 핵심 문장을 링크와 함께 인용",
  cite: "인용",
  "No chart on this view": "이 화면에는 차트가 없습니다",
  close: "닫기",
  Copied: "복사됨",
  "Select + copy": "선택 후 복사",
  "Cite this page": "이 페이지 인용",
  "Pick the line · the page's own numbers, as they read now":
    "문장 선택 · 지금 표시된 이 페이지의 수치",
  "Your post · edit it freely": "게시글 · 자유롭게 수정",
  "Back-link · this exact page, venue and filters": "백링크 · 이 페이지와 거래소, 필터 그대로",
  Copy: "복사",
  "Post on X": "X에 게시",
  "Copy line + link": "문장 + 링크 복사",
  "Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: {stamp}. Not financial advice.":
    "수치를 인용하고, 그 수치를 읽은 곳으로 링크하세요. 펀딩비는 매분 바뀌므로 문장에 그 수치가 유효했던 시점을 적습니다: {stamp}. 투자 조언이 아닙니다.",
  "{count} characters left with the link": "링크 포함 {count}자 남음",
  "+{count} more": "+{count}개 더",
  "public venue APIs · not financial advice": "거래소 공개 API · 투자 조언이 아닙니다",
  "Share your line": "차트 공유",
  "chart image": "차트 이미지",
  "Image · 1600 × 900, X's own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.":
    "이미지 · 1600 × 900, X의 16:9 비율 — 타임라인에서 잘리지 않고 표시됩니다. 오른쪽 클릭하거나 길게 눌러 저장하세요.",
  "Copy image": "이미지 복사",
  "Download PNG": "PNG 다운로드",
  "Link · this exact view": "링크 · 이 화면 그대로",
  "Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues', the call is yours.":
    "이미지를 복사하고 ‘X에 게시’를 누른 뒤 게시글에 붙여 넣으세요. 이미지에는 출처 주소가 찍혀 있고, 링크는 같은 화면을 엽니다. 저희는 방향을 예측하지 않습니다 — 수치는 거래소의 것이고, 판단은 여러분의 몫입니다.",
  "the image could not be drawn in this browser": "이 브라우저에서는 이미지를 그릴 수 없습니다",
  "Copy blocked — download instead": "복사가 차단됨 — 대신 다운로드하세요",

  // web/await.ts
  "Building report": "보고서 생성 중",
  "Still building": "아직 생성 중",

  // web/tabs.ts
  Sections: "섹션",

  // web/glossary.ts (and its entry in the footer menu and the shortcut map)
  terminology: "용어",
  Terminology: "용어",
  "Order-flow and volume-profile terms in one line each: delta, CVD, imbalance, absorption, VPOC, value area, LVN and single prints.":
    "오더 플로우와 볼륨 프로파일 용어를 한 줄씩: 델타, CVD, 임밸런스, 흡수, VPOC, 밸류 에어리어, LVN, 싱글 프린트.",
  "The words traders use to read order flow and the volume profile, each in one line. Every term has its own link to share: /glossary#cvd opens this page at CVD.":
    "트레이더가 오더 플로우와 볼륨 프로파일을 읽을 때 쓰는 용어를 한 줄씩 설명합니다. 용어마다 공유할 수 있는 링크가 있습니다. /glossary#cvd는 이 페이지의 CVD를 엽니다.",
  "Order flow": "오더 플로우",
  "Aggressive buying minus aggressive selling.": "시장가 매수에서 시장가 매도를 뺀 값입니다.",
  "cumulative volume delta": "누적 거래량 델타",
  "Delta added up through the session.": "거래 시간 동안 델타를 누적한 값입니다.",
  'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.':
    '<a href="/chart">차트</a> 페이지에 표시됩니다. 현물과 선물을 따로 보며, 거래소 전체를 합산합니다.',
  Imbalance: "임밸런스",
  "One side trading 3x or more the other at a price.":
    "한 가격에서 한쪽이 다른 쪽보다 3배 이상 거래된 것입니다.",
  Absorption: "흡수",
  "Heavy aggression, no progress.": "시장가 주문이 몰리는데도 가격이 나아가지 못하는 것입니다.",
  'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.':
    '<a href="/liquidations#odds">청산</a> 페이지의 확률 탭에서 주도 매매 대 흡수로 읽습니다.',
  "Volume profile": "볼륨 프로파일",
  "volume point of control": "거래량 포인트 오브 컨트롤",
  "The price with the most volume.": "거래량이 가장 많은 가격입니다.",
  "Value area": "밸류 에어리어",
  "Where 70% of the volume traded.": "거래량의 70%가 체결된 구간입니다.",
  "low-volume node": "저거래량 노드",
  "A thin price the market moved through fast.": "거래가 얇아 시장이 빠르게 지나간 가격입니다.",
  "Single prints": "싱글 프린트",
  "A zone only one 30-minute period traded.": "30분 구간 하나에서만 거래된 영역입니다.",
};
