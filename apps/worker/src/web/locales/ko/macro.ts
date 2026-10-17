import type { Catalog } from "../../i18n";

/**
 * The Rates page's macro tabs (web/macro.ts) and the macro charts' readout words (web/slot-chart.ts).
 * Glossary and style: ./index.ts.
 *
 * Terms: Federal Reserve 연준 (Atlanta / Chicago / New York Fed 애틀랜타 / 시카고 / 뉴욕 연은),
 * inflation 인플레이션, core 근원, print 발표치, release 발표, year on year 전년 대비, on the month
 * 전월 대비, on the quarter 전분기 대비, annualized 연환산 (as the glossary), percentage points %p,
 * basis points bp, fed funds rate 연방기금금리, target range 목표 범위, effective rate 실효금리,
 * interest on reserves 지급준비금 이자율, policy rate 정책금리, cut / hold / hike 인하 / 동결 / 인상,
 * midpoint 중간값, median 중앙값, Summary of Economic Projections 경제전망요약(SEP), dot plot 점도표,
 * balance sheet 대차대조표, total assets 총자산, odds and chance 확률, middle estimate 중간 추정치,
 * breakeven 기대인플레이션(BEI), 5y5y forward 5y5y 선도, payrolls 비농업 고용, jobs report 고용보고서,
 * unemployment rate 실업률, Sahm rule 삼의 법칙, jobless claims 신규 실업수당 청구 건수, continuing
 * claims 계속 실업수당 청구 건수, job openings 구인 건수, real GDP 실질 GDP, recession 경기침체, yield
 * 금리 (but yield curve 수익률 곡선), 2-year / 10-year 2년물 / 10년물, Treasury 미 국채,
 * inflation-protected Treasury 물가연동국채(TIPS), real yield 실질 금리, inverted 역전, net liquidity
 * 순유동성, reverse repo 역레포, Treasury General Account 재무부 일반계정(TGA), financial conditions
 * 금융여건, money supply 통화량, Commitments of Traders 투자자별 포지션 보고서(COT), leveraged funds
 * 레버리지 펀드, asset managers 자산운용사, dealers 딜러, managed money 매니지드 머니, producers and
 * merchants 생산자·중개상, swap dealers 스왑 딜러, net (a group's contracts) 순포지션, 3-year rank 3년
 * 백분위, stablecoin supply 스테이블코인 공급량, Reading (a table column) 해석. "A less B" labels are
 * written "A − B" with the site's minus. The agencies' acronyms (BLS, BEA, CFTC, FRED, CME), the
 * series' (CPI, PCE, GDP, FOMC, SEP, SOFR, JOLTS, NFCI, M2, TIPS, VIX), Kalshi, DefiLlama, GDPNow and
 * E-mini stay in Latin letters, as Korean finance media write them. Dates read year first:
 * "{year}년 {month}", "{year}년 {q}분기".
 */
export const macro: Catalog = {
  // The tab bar.
  "Inflation (CPI)": "인플레이션(CPI)",
  CPI: "CPI",
  "Fed policy": "연준 정책",
  Fed: "연준",
  Employment: "고용",
  Jobs: "고용",
  Growth: "성장",
  "Policy signals": "정책 신호",
  Signals: "신호",
  "Positioning and flows": "포지셔닝과 자금 흐름",
  Flows: "자금 흐름",

  // Units, dates and the charts.
  "{n} pp": "{n}%p",
  "{n} bp": "{n}bp",
  "{month} {year}": "{year}년 {month}",
  "Q{q} {year}": "{year}년 {q}분기",
  "in {time}": "{time} 후",
  "hover or tap the chart to read any point": "차트에 마우스를 올리거나 탭하여 값 확인",
  "{chart}; arrow keys read one point at a time": "{chart}, 방향키로 하나씩 확인",
  "week of {month} {day}, {year}": "{year}년 {month} {day}일 주간",

  // The release calendar.
  "PCE prices": "PCE 물가",
  "Jobs report": "고용보고서",
  "Jobless claims": "신규 실업수당 청구 건수",
  "Job openings (JOLTS)": "구인 건수(JOLTS)",
  GDP: "GDP",
  "Retail sales": "소매판매",
  "Industrial production": "산업생산",
  "FOMC decision": "FOMC 금리 결정",
  "Coming up": "발표 예정",

  // Kalshi's ladders and the footnotes.
  "below {value}": "{value} 미만",
  "above {value}": "{value} 초과",
  "middle estimate {value}": "중간 추정치 {value}",
  "Not updated since {ago}: the latest reads of these sources failed, so the figures are that old.":
    "{ago} 이후 업데이트되지 않음: 이 출처들의 최근 읽기에 실패해 수치는 그 시점의 것입니다.",
  "{sources} Last read {ago}.": "{sources} 마지막 읽기: {ago}.",
  "What Kalshi's traders expect": "Kalshi 트레이더들의 예상",
  "The macro data could not be read right now.": "지금은 매크로 데이터를 읽을 수 없습니다.",

  // Inflation.
  "No inflation figures have been read yet.": "아직 읽어 온 인플레이션 수치가 없습니다.",
  "CPI, year on year": "CPI, 전년 대비",
  "{month}: {mom} on the month · core {core}": "{month}: 전월 대비 {mom} · 근원 {core}",
  "Core PCE, year on year": "근원 PCE, 전년 대비",
  "{month} · the measure the Fed's 2% target is set in": "{month} · 연준 2% 목표의 기준 지표",
  "Next CPI": "다음 CPI",
  "Kalshi: {headline} on the month, core {core}": "Kalshi: 전월 대비 {headline}, 근원 {core}",
  "no date published yet": "아직 발표일 미공개",
  "5-year breakeven": "5년 기대인플레이션",
  "the inflation Treasuries price in · 5y5y forward {fwd}":
    "미 국채 가격에 반영된 인플레이션 · 5y5y 선도 {fwd}",
  "Inflation, year on year": "인플레이션, 전년 대비",
  "Core CPI": "근원 CPI",
  PCE: "PCE",
  "Core PCE": "근원 PCE",
  "Fed's 2% target": "연준 2% 목표",
  "Inflation the bond market prices in": "채권시장에 반영된 인플레이션",
  "10-year breakeven": "10년 기대인플레이션",
  "5y5y forward": "5y5y 선도",
  "Breakeven: the gap between a nominal Treasury's yield and an inflation-protected one's of the same term. Weekly, each week's last close.":
    "기대인플레이션(BEI)은 같은 만기의 명목 국채 금리와 물가연동국채 금리의 차이입니다. 주간 기준이며, 각 주의 마지막 종가입니다.",
  "Latest prints": "최근 발표치",
  Measure: "지표",
  Month: "기준 월",
  "On the month": "전월 대비",
  "3 months, annualized": "3개월 연환산",
  "6 months, annualized": "6개월 연환산",
  "Year on year": "전년 대비",
  "A year earlier": "1년 전",
  "CPI, on the month": "CPI, 전월 대비",
  "Core CPI, on the month": "근원 CPI, 전월 대비",
  Inflation: "인플레이션",
  "CPI is the Bureau of Labor Statistics' consumer price index, published monthly; core leaves out food and energy. PCE is the Bureau of Economic Analysis' price index for personal consumption, published about two weeks after CPI; the Fed's 2% target is set in it, and core PCE is the figure it watches most.":
    "CPI는 노동통계국(BLS)이 매월 발표하는 소비자물가지수이며, 근원 CPI는 식품과 에너지를 제외합니다. PCE는 경제분석국(BEA)의 개인소비지출 물가지수로, CPI보다 약 2주 늦게 발표됩니다. 연준의 2% 목표는 PCE 기준이며, 연준이 가장 주시하는 수치는 근원 PCE입니다.",
  "The changes are worked out here from the seasonally adjusted indexes: on the month, over three and six months annualized (the recent pace, which the year-on-year figure is slow to show), and on the year.":
    "변화율은 계절조정 지수로 여기서 직접 계산합니다: 전월 대비, 3개월·6개월 연환산(전년 대비 수치에는 늦게 나타나는 최근의 속도), 그리고 전년 대비입니다.",
  "The breakevens are the inflation the Treasury market prices in, from the Fed's daily yields: 5-year and 10-year, and the 5-year rate starting five years from now (5y5y), which the Fed reads as long-run expectations.":
    "기대인플레이션(BEI)은 미 국채 시장에 반영된 인플레이션으로, 연준의 일별 금리에서 구합니다: 5년, 10년, 그리고 5년 뒤부터 시작하는 5년 금리(5y5y)이며, 연준은 5y5y를 장기 기대인플레이션으로 봅니다.",
  "Kalshi, a CFTC-regulated exchange, lists contracts that pay if the next print is above a level. Their prices read as the market's chances; the middle estimate is where the chance of above crosses one half.":
    "CFTC의 규제를 받는 거래소 Kalshi는 다음 발표치가 특정 수준을 넘으면 지급되는 계약을 상장합니다. 그 가격은 시장이 매기는 확률로 읽을 수 있으며, 중간 추정치는 ‘초과’ 확률이 절반을 지나는 지점입니다.",
  "Sources: BLS and BEA through FRED; breakevens from the Fed's Treasury yields; odds from Kalshi.":
    "출처: FRED를 통한 BLS·BEA 데이터, 연준의 미 국채 금리로 구한 기대인플레이션, Kalshi의 확률.",

  // Fed policy.
  "cut more than 25 bp": "25bp 초과 인하",
  "cut 25 bp": "25bp 인하",
  hold: "동결",
  "hike 25 bp": "25bp 인상",
  "hike more than 25 bp": "25bp 초과 인상",
  "No Fed policy figures have been read yet.": "아직 읽어 온 연준 정책 수치가 없습니다.",
  "Target range": "목표 범위",
  "effective {effr} · SOFR {sofr} · interest on reserves {iorb}":
    "실효금리 {effr} · SOFR {sofr} · 지급준비금 이자율 {iorb}",
  "Next FOMC decision": "다음 FOMC 금리 결정",
  "with projections": "경제전망(SEP) 포함",
  "Kalshi: {outcome} {p}": "Kalshi: {outcome} 확률 {p}",
  "Rate path the market prices": "시장이 반영한 금리 경로",
  "midpoint after {meeting}: {move} from today's {mid}":
    "{meeting} 회의 후 중간값: 현재 {mid} 대비 {move}",
  "no Kalshi odds read yet": "아직 읽어 온 Kalshi 확률 없음",
  "Fed balance sheet": "연준 대차대조표",
  "{change} over four weeks · week of {date}": "4주간 {change} · {date} 주간",
  "A meeting with a Summary of Economic Projections": "경제전망요약(SEP)이 발표되는 회의",
  SEP: "SEP",
  "Each meeting's odds, from Kalshi": "회의별 확률(Kalshi)",
  Meeting: "회의",
  "Cut &gt;25": "인하 &gt;25",
  "Cut 25": "인하 25",
  Hold: "동결",
  "Hike 25": "인상 25",
  "Hike &gt;25": "인상 &gt;25",
  "Each outcome's move times its chance, added up": "각 결과의 변동 폭에 확률을 곱해 합산",
  "Expected move": "기대 변동",
  "Today's midpoint plus every expected move to this meeting":
    "현재 중간값에 이 회의까지의 기대 변동을 모두 더한 값",
  "Implied midpoint": "내재 중간값",
  "The Fed's own projections": "연준 자체 전망",
  "Median, end of year": "중앙값, 연말 기준",
  "Longer run": "장기",
  "Fed funds rate": "연방기금금리",
  "PCE inflation": "PCE 인플레이션",
  "Core PCE inflation": "근원 PCE 인플레이션",
  "Unemployment rate": "실업률",
  "Real GDP growth": "실질 GDP 성장률",
  "From the Summary of Economic Projections of {date}: the median of the committee's forecasts (the dot plot's middle dot for the rate). Inflation and growth are fourth quarter on fourth quarter; unemployment is the fourth quarter's average.":
    "{date} 경제전망요약(SEP)에 따른 위원회 전망치의 중앙값입니다(금리는 점도표의 가운데 점). 인플레이션과 성장률은 전년 4분기 대비 4분기 기준이며, 실업률은 4분기 평균입니다.",
  "Policy rate": "정책금리",
  "Top of the range": "범위 상단",
  "Bottom of the range": "범위 하단",
  "Effective rate": "실효금리",
  "Fed balance sheet, total assets": "연준 대차대조표, 총자산",
  "Total assets": "총자산",
  "The target range is the Federal Open Market Committee's range for the federal funds rate; the effective rate is where overnight fed funds actually trade, SOFR is the overnight Treasury repo rate, and interest on reserves is what the Fed pays banks, which holds the effective rate inside the range.":
    "목표 범위는 연방공개시장위원회(FOMC)가 정하는 연방기금금리의 범위입니다. 실효금리는 익일물 연방기금이 실제로 거래되는 금리, SOFR는 익일물 미 국채 레포 금리이며, 지급준비금 이자율은 연준이 은행에 지급하는 이자로 실효금리를 범위 안에 묶어 둡니다.",
  "The odds are Kalshi's: for each meeting, contracts that pay on a cut of more than 25 basis points, a 25 bp cut, a hold, a 25 bp hike or a larger hike. Each meeting's prices are scaled to add up to 100%. The expected move is each outcome's size times its chance; the implied midpoint adds every expected move from today's midpoint, a path in the way CME's FedWatch draws one from fed funds futures.":
    "확률은 Kalshi의 것입니다: 회의마다 25bp 초과 인하, 25bp 인하, 동결, 25bp 인상, 그보다 큰 인상에 지급되는 계약이 있습니다. 회의별 가격은 합계가 100%가 되도록 조정합니다. 기대 변동은 각 결과의 크기에 확률을 곱한 값이며, 내재 중간값은 현재 중간값에 모든 기대 변동을 더한 것으로, CME FedWatch가 연방기금 선물에서 금리 경로를 그리는 방식과 같습니다.",
  "The projections are the committee's own, published four times a year with the meeting's statement; the dot plot is each member's view of where the rate should be at the end of each year.":
    "전망은 위원회 자체의 것으로, 연 4회 회의 성명과 함께 발표됩니다. 점도표는 각 위원이 매년 말 금리가 어디에 있어야 한다고 보는지를 나타냅니다.",
  "The balance sheet is the Fed's total assets, weekly, as of Wednesday. It grows when the Fed buys bonds and shrinks as they run off.":
    "대차대조표는 연준의 총자산으로, 매주 수요일 기준입니다. 연준이 채권을 사들이면 늘고, 보유 채권이 만기로 소진되면서 줄어듭니다.",
  "Sources: the Federal Reserve and the New York Fed through FRED; the FOMC calendar from the Federal Reserve; odds from Kalshi.":
    "출처: FRED를 통한 연준·뉴욕 연은 데이터, 연준의 FOMC 일정, Kalshi의 확률.",

  // Employment.
  "No employment figures have been read yet.": "아직 읽어 온 고용 수치가 없습니다.",
  "Payrolls, {month}": "{month} 비농업 고용",
  "jobs added on the month · three-month average {avg}":
    "전월 대비 비농업 고용 증감 · 3개월 평균 {avg}",
  "{month} · Sahm rule {sahm} (a recession signal from 0.50)":
    "{month} · 삼의 법칙 {sahm}(0.50 이상이면 경기침체 신호)",
  "Initial jobless claims": "신규 실업수당 청구 건수",
  "week to {date} · four-week average {avg} · continuing {cont}":
    "{date} 마감 주 · 4주 평균 {avg} · 계속 청구 {cont}",
  "Next jobs report": "다음 고용보고서",
  "Kalshi: payrolls {pay}, unemployment {u}": "Kalshi: 비농업 고용 {pay}, 실업률 {u}",
  "Jobs added each month": "월별 비농업 고용 증감",
  "Payrolls, change on the month": "비농업 고용, 전월 대비 증감",
  "Three-month average": "3개월 평균",
  "Nonfarm payrolls, thousands, seasonally adjusted. The latest two months are revised with each report.":
    "비농업 고용, 천 명 단위, 계절조정 기준입니다. 최근 두 달 수치는 보고서가 나올 때마다 수정됩니다.",
  "The Sahm rule is the three-month average unemployment rate less its low of the past twelve months, in percentage points; every US recession since 1970 began with it at 0.50 or more. A gap is a month with no household survey.":
    "삼의 법칙은 실업률 3개월 평균에서 지난 12개월 중 최저치를 뺀 값으로, 단위는 %p입니다. 1970년 이후 미국의 모든 경기침체는 이 값이 0.50 이상일 때 시작됐습니다. 빈 구간은 가계조사가 없었던 달입니다.",
  "Initial claims": "신규 청구",
  "Four-week average": "4주 평균",
  "Latest figures": "최근 수치",
  Latest: "최신",
  Context: "참고",
  "Average hourly earnings": "평균 시간당 임금",
  "{month}, year on year · {mom} on the month": "{month}, 전년 대비 · 전월 대비 {mom}",
  "Job openings": "구인 건수",
  "{month} · {before} a year earlier": "{month} · 1년 전 {before}",
  "Continuing claims": "계속 실업수당 청구 건수",
  "week to {date}": "{date} 마감 주",
  Payrolls: "비농업 고용",
  "Payrolls and the unemployment rate come from the Bureau of Labor Statistics' monthly jobs report, usually the first Friday of the month: payrolls from a survey of employers, unemployment from a survey of households. Jobless claims are the Labor Department's weekly count of new filings for unemployment insurance, the most timely read on layoffs.":
    "비농업 고용과 실업률은 노동통계국(BLS)의 월간 고용보고서에서 나오며, 보통 매월 첫째 금요일에 발표됩니다: 비농업 고용은 사업체 조사, 실업률은 가계조사에서 집계합니다. 신규 실업수당 청구 건수는 노동부가 매주 집계하는 실업보험 신규 신청 건수로, 해고 동향을 가장 빠르게 보여 줍니다.",
  "Job openings are from the JOLTS survey, a month behind the jobs report. Average hourly earnings are private employers' pay, a gauge of wage inflation.":
    "구인 건수는 JOLTS 조사에서 나오며, 고용보고서보다 한 달 늦습니다. 평균 시간당 임금은 민간 사업체의 임금으로, 임금 인플레이션을 가늠하는 지표입니다.",
  "The odds are Kalshi's contracts on the next report's payrolls and unemployment rate; the middle estimate is where the chance of above crosses one half.":
    "확률은 다음 보고서의 비농업 고용과 실업률에 대한 Kalshi 계약에서 나옵니다. 중간 추정치는 ‘초과’ 확률이 절반을 지나는 지점입니다.",
  "Sources: BLS and the Labor Department through FRED; odds from Kalshi.":
    "출처: FRED를 통한 BLS·노동부 데이터, Kalshi의 확률.",

  // Growth.
  "No growth figures have been read yet.": "아직 읽어 온 성장 수치가 없습니다.",
  "Real GDP, {quarter}": "{quarter} 실질 GDP",
  "on the quarter, annualized · recession probability {p}":
    "전분기 대비 연환산 · 경기침체 확률 {p}",
  "GDPNow, {quarter}": "{quarter} GDPNow",
  "the Atlanta Fed's running estimate of the quarter not yet published":
    "아직 발표되지 않은 분기에 대한 애틀랜타 연은의 실시간 추정치",
  "Next GDP estimate": "다음 GDP 추정치",
  "Kalshi: {value} for {quarter}": "Kalshi: {quarter} {value}",
  "Real GDP growth, annualized": "실질 GDP 성장률, 연환산",
  "Real GDP": "실질 GDP",
  "GDPNow estimate": "GDPNow 추정치",
  "Quarter on quarter at an annual rate, as the Bureau of Economic Analysis publishes it; the latest figure is revised twice.":
    "경제분석국(BEA)이 발표하는 대로 전분기 대비 연환산 기준입니다. 최신 수치는 두 차례 수정됩니다.",
  "Activity, year on year": "경제 활동, 전년 대비",
  "Retail sales are in dollars, so they include price rises; industrial production is a volume index.":
    "소매판매는 달러 금액 기준이라 가격 상승분이 포함되며, 산업생산은 물량 지수입니다.",
  "Real GDP is the Bureau of Economic Analysis' measure of the economy's output after inflation, quarter on quarter at an annual rate. Each quarter is first estimated about a month after it ends and revised twice.":
    "실질 GDP는 경제분석국(BEA)이 인플레이션을 제외하고 측정한 경제 산출량으로, 전분기 대비 연환산 기준입니다. 각 분기는 끝나고 약 한 달 뒤 첫 추정치가 나오며, 이후 두 차례 수정됩니다.",
  "GDPNow is the Atlanta Fed's model estimate of the quarter not yet published, updated as each month's data come in; it is a model, not a forecast by the Fed.":
    "GDPNow는 아직 발표되지 않은 분기에 대한 애틀랜타 연은의 모델 추정치로, 매달 데이터가 나올 때마다 갱신됩니다. 연준의 전망이 아니라 모델입니다.",
  "Industrial production (the Fed's index of factory, mining and utility output) and retail sales (the Census Bureau's) are monthly. The recession probability is the Chauvet and Piger model's, from four monthly indicators, as FRED publishes it.":
    "산업생산(제조업·광업·유틸리티 산출량에 대한 연준의 지수)과 소매판매(인구조사국 발표)는 월간 지표입니다. 경기침체 확률은 네 가지 월간 지표로 산출하는 Chauvet·Piger 모델의 값으로, FRED가 공개하는 수치입니다.",
  "The odds are Kalshi's contracts on the next GDP estimate.":
    "확률은 다음 GDP 추정치에 대한 Kalshi 계약에서 나옵니다.",
  "Sources: BEA, the Federal Reserve, the Census Bureau and the Atlanta Fed through FRED; odds from Kalshi.":
    "출처: FRED를 통한 BEA·연준·인구조사국·애틀랜타 연은 데이터, Kalshi의 확률.",

  // Policy signals.
  "No market signals have been read yet.": "아직 읽어 온 시장 신호가 없습니다.",
  "2-year yield less fed funds": "2년물 금리 − 연방기금금리",
  "2-year {two} above the effective rate: the market prices rates higher over two years":
    "2년물 {two}, 실효금리보다 높음: 시장은 2년간 금리 상승을 반영",
  "2-year {two} below the effective rate: the market prices cuts over two years":
    "2년물 {two}, 실효금리보다 낮음: 시장은 2년간 금리 인하를 반영",
  "Yield curve, 10-year less 2-year": "수익률 곡선, 10년물 − 2년물",
  "10-year less 3-month {s} · below zero the curve is inverted":
    "10년물 − 3개월물 {s} · 0 미만이면 수익률 곡선 역전",
  "10-year real yield": "10년물 실질 금리",
  "inflation-protected Treasury · nominal 10-year {ten}": "물가연동국채(TIPS) · 명목 10년물 {ten}",
  "Net liquidity": "순유동성",
  "Fed assets less the Treasury's account and reverse repos":
    "연준 자산 − 재무부 계좌(TGA) − 역레포",
  "{change} over four weeks · Fed assets less the Treasury's account and reverse repos":
    "4주간 {change} · 연준 자산 − 재무부 계좌(TGA) − 역레포",
  "Treasury yields": "미 국채 금리",
  "3-month": "3개월물",
  "2-year": "2년물",
  "10-year": "10년물",
  "30-year": "30년물",
  "Yield curve": "수익률 곡선",
  "10-year less 2-year": "10년물 − 2년물",
  "10-year less 3-month": "10년물 − 3개월물",
  "An inverted curve, long yields below short ones, has come before every US recession since the 1970s, often by a year or more; the turn back above zero has often come closer to it.":
    "장기 금리가 단기 금리보다 낮은 역전된 수익률 곡선은 1970년대 이후 미국의 모든 경기침체에 앞서 나타났으며, 흔히 1년 이상 먼저였습니다. 다시 0 위로 돌아서는 시점은 대개 경기침체에 더 가까웠습니다.",
  "The Fed's total assets less the Treasury General Account and the overnight reverse repo facility: a rough count of the dollars the Fed's balance sheet leaves in the market, which many crypto traders watch against prices.":
    "연준 총자산에서 재무부 일반계정(TGA)과 익일물 역레포 기구 잔액을 뺀 값입니다: 연준 대차대조표가 시장에 남겨 두는 달러의 대략적인 규모로, 많은 암호화폐 트레이더가 가격과 견주어 지켜봅니다.",
  "Other signals": "기타 신호",
  "4 weeks": "4주",
  "1 year": "1년",
  Reading: "해석",
  "Dollar, broad index": "광의 달러지수",
  "the Fed's trade-weighted dollar; a rising dollar tightens conditions worldwide":
    "연준의 무역가중 달러지수. 달러가 오르면 전 세계 금융여건이 긴축됩니다",
  "Financial conditions (NFCI)": "금융여건(NFCI)",
  "below zero: looser than average": "0 미만: 평균보다 완화적",
  "above zero: tighter than average": "0 초과: 평균보다 긴축적",
  "Money supply (M2)": "통화량(M2)",
  "{month}, year on year": "{month}, 전년 대비",
  "What the bond market says about policy before the Fed does. The 2-year Treasury yield tracks where traders expect the policy rate over the next two years: well above the effective rate, they expect it higher; well below, they expect cuts.":
    "연준보다 먼저 채권시장이 정책에 대해 말해 주는 신호들입니다. 2년물 미 국채 금리는 트레이더들이 향후 2년간 정책금리를 어디로 예상하는지를 따라갑니다: 실효금리보다 크게 높으면 금리 상승을, 크게 낮으면 인하를 예상한다는 뜻입니다.",
  "The yield curve is the 10-year yield less the 2-year, and less the 3-month bill. Real yields are inflation-protected Treasuries' (TIPS); a high real yield is a high cost of holding assets that pay nothing, crypto among them.":
    "수익률 곡선은 10년물 금리에서 2년물 금리를 뺀 값, 그리고 3개월물 국채 금리를 뺀 값입니다. 실질 금리는 물가연동국채(TIPS)의 금리이며, 실질 금리가 높다는 것은 이자를 주지 않는 자산(암호화폐 포함)을 보유하는 비용이 높다는 뜻입니다.",
  "Net liquidity is the Fed's balance sheet less the Treasury's cash at the Fed and the reverse repo facility, worked out here from the weekly figures; it is a rule of thumb, not an official measure. The NFCI is the Chicago Fed's index of financial conditions, zero at its long-run average.":
    "순유동성은 연준 대차대조표에서 연준에 예치된 재무부 현금과 역레포 기구 잔액을 뺀 값으로, 주간 수치로 여기서 직접 계산합니다. 공식 지표가 아니라 경험칙입니다. NFCI는 시카고 연은의 금융여건지수로, 장기 평균이 0입니다.",
  "Sources: Treasury yields, the Federal Reserve and the Chicago Fed through FRED.":
    "출처: FRED를 통한 미 국채 금리, 연준·시카고 연은 데이터.",

  // Positioning and flows: the futures markets.
  "Bitcoin (CME)": "비트코인(CME)",
  "Ether (CME)": "이더리움(CME)",
  "S&P 500 E-mini": "E-mini S&P 500",
  "Nasdaq-100 E-mini": "E-mini 나스닥 100",
  "Russell 2000 E-mini": "E-mini 러셀 2000",
  "VIX futures": "VIX 선물",
  "2-year Treasury note": "미 국채 2년물",
  "10-year Treasury note": "미 국채 10년물",
  "Treasury bond": "미 국채 장기물(T-Bond)",
  "3-month SOFR": "3개월 SOFR",
  "30-day fed funds": "30일 연방기금",
  "US dollar index": "달러인덱스",
  Euro: "유로",
  "Japanese yen": "엔화",
  Gold: "금",
  Silver: "은",
  "WTI crude oil": "WTI 원유",
  Copper: "구리",

  // Positioning and flows: the COT tables, tiles and charts.
  "Leveraged funds": "레버리지 펀드",
  "Asset managers": "자산운용사",
  Dealers: "딜러",
  "Managed money": "매니지드 머니",
  "Producers and merchants": "생산자·중개상",
  "Swap dealers": "스왑 딜러",
  "Financial futures: who holds them": "금융 선물: 누가 보유하나",
  "Commodity futures: who holds them": "상품 선물: 누가 보유하나",
  "{group}, net": "{group} 순포지션",
  Week: "주간 변화",
  "Where this week's net sits among the last three years' weeks: 0% the shortest, 100% the longest":
    "이번 주 순포지션이 최근 3년간의 주간 값 가운데 어디에 있는지: 0%는 가장 숏, 100%는 가장 롱",
  "3-year rank": "3년 백분위",
  "3 years": "3년",
  "No positioning data has been read yet.": "아직 읽어 온 포지셔닝 데이터가 없습니다.",
  "contracts net, {share} of open interest · 3-year rank {rank} · {other} {otherNet}":
    "계약 순포지션, 미결제약정의 {share} · 3년 백분위 {rank} · {other} {otherNet}",
  "Stablecoin supply": "스테이블코인 공급량",
  "{d30} in 30 days · {d90} in 90 days": "30일간 {d30} · 90일간 {d90}",
  "CME Bitcoin, leveraged funds": "CME 비트코인, 레버리지 펀드",
  "asset managers": "자산운용사",
  "CME Ether, leveraged funds": "CME 이더리움, 레버리지 펀드",
  "Gold, managed money": "금, 매니지드 머니",
  producers: "생산자",
  "Who holds CME Bitcoin futures": "CME 비트코인 선물은 누가 보유하나",
  "Net contracts (longs less shorts) of five bitcoin each, as of each Tuesday. Leveraged funds are hedge funds and trading firms; much of their short is the futures leg of a cash-and-carry trade against spot ETFs, not a bet on a fall.":
    "순계약 수(롱 − 숏)이며, 계약당 비트코인 5개, 매주 화요일 기준입니다. 레버리지 펀드는 헤지펀드와 트레이딩 회사로, 이들의 숏 상당 부분은 현물 ETF를 상대로 한 캐시 앤 캐리 거래의 선물 레그이지 하락에 거는 베팅이 아닙니다.",
  "Dollar stablecoins in circulation": "유통 중인 달러 스테이블코인",
  "Every dollar-pegged stablecoin's supply, added up by DefiLlama: dollars already on-chain, the first money to reach crypto prices.":
    "DefiLlama가 집계한 모든 달러 연동 스테이블코인의 공급량 합계입니다: 이미 온체인에 있는 달러로, 암호화폐 가격에 가장 먼저 닿는 돈입니다.",
  "Who actually holds the futures, from the CFTC's weekly Commitments of Traders: positions as of Tuesday, published the Friday after. For financial futures the CFTC splits traders into dealers (the banks that make markets), asset managers (pension funds, insurers, mutual funds: slower, real money) and leveraged funds (hedge funds and trading firms: faster, speculative). For commodities it splits producers and merchants (hedgers), swap dealers and managed money (the speculators).":
    "실제로 누가 선물을 보유하는지를 CFTC의 주간 투자자별 포지션 보고서(COT)로 보여 줍니다: 화요일 기준 포지션이 그 주 금요일에 발표됩니다. 금융 선물의 경우 CFTC는 트레이더를 딜러(시장을 조성하는 은행), 자산운용사(연기금, 보험사, 뮤추얼 펀드: 느리게 움직이는 리얼 머니), 레버리지 펀드(헤지펀드와 트레이딩 회사: 빠르고 투기적)로 나눕니다. 상품 선물은 생산자·중개상(헤저), 스왑 딜러, 매니지드 머니(투기 세력)로 나눕니다.",
  "Net is longs less shorts, in contracts; its share is of the market's open interest. The 3-year rank says where this week's net sits among every week of the last three years: near 0% the speculators are as short as they have been, near 100% as long, which is when positioning tends to unwind.":
    "순포지션은 롱에서 숏을 뺀 계약 수이며, 비중은 해당 시장 미결제약정 대비입니다. 3년 백분위는 이번 주 순포지션이 최근 3년간의 모든 주 가운데 어디에 있는지를 나타냅니다: 0%에 가까우면 투기 세력이 이 기간 중 가장 숏에 치우쳐 있고 100%에 가까우면 가장 롱에 치우쳐 있으며, 이럴 때 포지션이 해소되는 경향이 있습니다.",
  "Stablecoin supply is the dollars already on-chain, from DefiLlama: when it grows, new money is arriving in crypto.":
    "스테이블코인 공급량은 DefiLlama 기준 이미 온체인에 있는 달러입니다: 공급량이 늘면 새 자금이 암호화폐로 들어오고 있다는 뜻입니다.",
  "Sources: the CFTC's Commitments of Traders, futures only{date}; DefiLlama for stablecoins.":
    "출처: CFTC 투자자별 포지션 보고서(COT, 선물만{date}), 스테이블코인은 DefiLlama.",
  ", report of {date}": ", {date} 기준",
};
