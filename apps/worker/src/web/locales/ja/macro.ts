import type { Catalog } from "../../i18n";

/**
 * The Rates page's macro tabs (web/macro.ts) and the macro charts' readout words (web/slot-chart.ts).
 * Glossary and style: ./index.ts.
 *
 * Terms: the Fed / Federal Reserve FRB (the regional banks ニューヨーク連銀, アトランタ連銀, シカゴ
 * 連銀), FOMC and the committee FOMC, fed funds rate FF 金利, target range 誘導目標レンジ, effective rate
 * 実効 FF 金利, interest on reserves 準備預金付利, the range's midpoint 中心値 (kept apart from median
 * 中央値), cut / hike / hold 利下げ / 利上げ / 据え置き, Summary of Economic Projections 経済見通し
 * （SEP）, dot plot ドットチャート, balance sheet バランスシート, Treasury (a US government bond) 米国債
 * and the Treasury (the department) 財務省, n-year yield n年債利回り, breakeven BEI (ブレークイーブン・
 * インフレ率 where it is first explained), inflation-protected Treasury 物価連動国債 (TIPS), real yield
 * 実質利回り, yield curve イールドカーブ, inverted 逆イールド, net liquidity ネット流動性, reverse repo
 * リバースレポ, year on year / on the month 前年比 / 前月比, annualized 年率, core コア, print (a
 * published figure) 発表値, payrolls 非農業部門雇用者数, unemployment rate 失業率, jobless claims
 * 失業保険申請件数 (initial 新規, continuing 継続受給者数), job openings 求人件数, Sahm rule サーム・
 * ルール, recession 景気後退, industrial production 鉱工業生産, retail sales 小売売上高, odds 確率 (as
 * on the liquidations page), the ladder's middle estimate 中央推定値, above / below a level {value}超 /
 * {value}未満. Positioning: Commitments of Traders 建玉明細報告（COT）, leveraged funds レバレッジド・
 * ファンド, asset managers アセットマネージャー, dealers ディーラー, managed money マネージド・マネー,
 * producers and merchants 生産者・商業筋, swap dealers スワップ・ディーラー, contracts 枚, the 3-year
 * rank 3年順位, stablecoin ステーブルコイン. Sources 出典. Percentage points and basis points are the
 * suffixes %pt and bp, set right after the figure. A quarter is {year}年第{q}四半期 and a month
 * {year}年{month}, the month names being the charts part's 1月 … 12月. CPI, PCE, GDP, SOFR, JOLTS, NFCI,
 * M2, CME, Kalshi, FRED, BLS, BEA, CFTC, DefiLlama, GDPNow, E-mini and VIX stay in Latin letters.
 */
export const macro: Catalog = {
  // The tab bar.
  "Inflation (CPI)": "インフレ（CPI）",
  CPI: "CPI",
  "Fed policy": "FRB の金融政策",
  Fed: "FRB",
  Employment: "雇用",
  Jobs: "雇用",
  Growth: "景気",
  "Policy signals": "政策シグナル",
  Signals: "シグナル",
  "Positioning and flows": "ポジションとフロー",
  Flows: "フロー",

  // Units, dates and the chart readout.
  "{n} pp": "{n}%pt",
  "{n} bp": "{n}bp",
  "{month} {year}": "{year}年{month}",
  "Q{q} {year}": "{year}年第{q}四半期",
  "week of {month} {day}, {year}": "{year}年{month}{day}日の週",
  "in {time}": "あと{time}",
  "hover or tap the chart to read any point":
    "チャートにカーソルを合わせるかタップすると各時点の値を表示",
  "{chart}; arrow keys read one point at a time": "{chart}。矢印キーで1点ずつ確認できます",

  // The release calendar.
  "PCE prices": "PCE 価格指数",
  "Jobs report": "雇用統計",
  "Jobless claims": "失業保険申請件数",
  "Job openings (JOLTS)": "求人件数（JOLTS）",
  GDP: "GDP",
  "Retail sales": "小売売上高",
  "Industrial production": "鉱工業生産",
  "FOMC decision": "FOMC 政策決定",
  "Coming up": "今後の発表",

  // Kalshi's ladders and the tabs' footnotes.
  "below {value}": "{value}未満",
  "above {value}": "{value}超",
  "middle estimate {value}": "中央推定値 {value}",
  "Not updated since {ago}: the latest reads of these sources failed, so the figures are that old.":
    "{ago}から更新されていません：これらのデータソースの最新の取得に失敗したため、数値はその時点のものです。",
  "{sources} Last read {ago}.": "{sources}最終取得：{ago}。",

  // Inflation.
  "No inflation figures have been read yet.": "インフレ指標はまだ取得されていません。",
  "CPI, year on year": "CPI（前年比）",
  "{month}: {mom} on the month · core {core}": "{month}：前月比 {mom} · コア {core}",
  "Core PCE, year on year": "コア PCE（前年比）",
  "{month} · the measure the Fed's 2% target is set in": "{month} · FRB の2%目標の対象となる指標",
  "Next CPI": "次回 CPI",
  "Kalshi: {headline} on the month, core {core}": "Kalshi：前月比 {headline}、コア {core}",
  "no date published yet": "日程未発表",
  "5-year breakeven": "5年 BEI",
  "the inflation Treasuries price in · 5y5y forward {fwd}":
    "米国債が織り込むインフレ率 · 5年先5年フォワード {fwd}",
  "Inflation, year on year": "インフレ率（前年比）",
  "Core CPI": "コア CPI",
  PCE: "PCE",
  "Core PCE": "コア PCE",
  "Fed's 2% target": "FRB の2%目標",
  "Inflation the bond market prices in": "債券市場が織り込むインフレ率",
  "10-year breakeven": "10年 BEI",
  "5y5y forward": "5年先5年フォワード",
  "Breakeven: the gap between a nominal Treasury's yield and an inflation-protected one's of the same term. Weekly, each week's last close.":
    "BEI：名目の米国債の利回りと、同じ年限の物価連動国債の利回りの差。週次で、各週の最後の終値です。",
  "Latest prints": "最新の発表値",
  Measure: "指標",
  Month: "対象月",
  "On the month": "前月比",
  "3 months, annualized": "3カ月（年率）",
  "6 months, annualized": "6カ月（年率）",
  "Year on year": "前年比",
  "A year earlier": "1年前",
  "CPI, on the month": "CPI（前月比）",
  "Core CPI, on the month": "コア CPI（前月比）",
  Inflation: "インフレ",
  "CPI is the Bureau of Labor Statistics' consumer price index, published monthly; core leaves out food and energy. PCE is the Bureau of Economic Analysis' price index for personal consumption, published about two weeks after CPI; the Fed's 2% target is set in it, and core PCE is the figure it watches most.":
    "CPI は米労働統計局（BLS）が毎月公表する消費者物価指数で、コアは食品とエネルギーを除いたものです。PCE は米経済分析局（BEA）による個人消費支出の価格指数で、CPI の約2週間後に公表されます。FRB の2%目標はこの指数で設定されており、FRB が最も注視するのはコア PCE です。",
  "The changes are worked out here from the seasonally adjusted indexes: on the month, over three and six months annualized (the recent pace, which the year-on-year figure is slow to show), and on the year.":
    "変化率は季節調整済みの指数からここで計算しています：前月比、3カ月と6カ月の年率（前年比にはなかなか表れない最近のペース）、そして前年比です。",
  "The breakevens are the inflation the Treasury market prices in, from the Fed's daily yields: 5-year and 10-year, and the 5-year rate starting five years from now (5y5y), which the Fed reads as long-run expectations.":
    "BEI（ブレークイーブン・インフレ率）は米国債市場が織り込むインフレ率で、FRB が公表する日次の利回りから求めます：5年と10年、そして5年後から始まる5年間の率（5y5y、5年先5年フォワード）です。FRB はこれを長期的なインフレ期待として見ています。",
  "Kalshi, a CFTC-regulated exchange, lists contracts that pay if the next print is above a level. Their prices read as the market's chances; the middle estimate is where the chance of above crosses one half.":
    "CFTC の規制下にある取引所 Kalshi は、次回の発表値がある水準を上回れば支払われる契約を上場しています。その価格は市場が見込む確率として読めます。中央推定値は、上回る確率が2分の1をまたぐ水準です。",
  "What Kalshi's traders expect": "Kalshi のトレーダーの予想",
  "Sources: BLS and BEA through FRED; breakevens from the Fed's Treasury yields; odds from Kalshi.":
    "出典：BLS と BEA（FRED 経由）、BEI は FRB の米国債利回り、確率は Kalshi。",

  // Fed policy.
  "cut more than 25 bp": "25bp超の利下げ",
  "cut 25 bp": "25bpの利下げ",
  hold: "据え置き",
  "hike 25 bp": "25bpの利上げ",
  "hike more than 25 bp": "25bp超の利上げ",
  "No Fed policy figures have been read yet.": "FRB の金融政策データはまだ取得されていません。",
  "Target range": "誘導目標レンジ",
  "effective {effr} · SOFR {sofr} · interest on reserves {iorb}":
    "実効 FF 金利 {effr} · SOFR {sofr} · 準備預金付利 {iorb}",
  "Next FOMC decision": "次回 FOMC 政策決定",
  "with projections": "経済見通しあり",
  "Kalshi: {outcome} {p}": "Kalshi：{outcome} {p}",
  "Rate path the market prices": "市場が織り込む金利パス",
  "midpoint after {meeting}: {move} from today's {mid}":
    "{meeting}の会合後の中心値：現在の {mid} から {move}",
  "no Kalshi odds read yet": "Kalshi の確率は未取得",
  "Fed balance sheet": "FRB のバランスシート",
  "{change} over four weeks · week of {date}": "4週間で {change} · {date}の週",
  "A meeting with a Summary of Economic Projections": "経済見通し（SEP）が公表される会合",
  SEP: "SEP",
  "Each meeting's odds, from Kalshi": "各会合の確率（Kalshi）",
  Meeting: "会合",
  "Cut &gt;25": "25bp超利下げ",
  "Cut 25": "25bp利下げ",
  Hold: "据え置き",
  "Hike 25": "25bp利上げ",
  "Hike &gt;25": "25bp超利上げ",
  "Each outcome's move times its chance, added up": "各結果の変化幅に確率を掛けて合計したもの",
  "Expected move": "予想変化幅",
  "Today's midpoint plus every expected move to this meeting":
    "現在の中心値に、この会合までのすべての予想変化幅を足したもの",
  "Implied midpoint": "織り込み中心値",
  "The Fed's own projections": "FRB 自身の経済見通し",
  "Median, end of year": "中央値（年末）",
  "Longer run": "長期",
  "Fed funds rate": "FF 金利",
  "PCE inflation": "PCE インフレ率",
  "Core PCE inflation": "コア PCE インフレ率",
  "Unemployment rate": "失業率",
  "Real GDP growth": "実質 GDP 成長率",
  "From the Summary of Economic Projections of {date}: the median of the committee's forecasts (the dot plot's middle dot for the rate). Inflation and growth are fourth quarter on fourth quarter; unemployment is the fourth quarter's average.":
    "経済見通し（SEP、{date}）より：FOMC 参加者の予測の中央値です（政策金利はドットチャートの真ん中のドット）。インフレ率と成長率は第4四半期の前年同期比、失業率は第4四半期の平均です。",
  "Policy rate": "政策金利",
  "Top of the range": "レンジ上限",
  "Bottom of the range": "レンジ下限",
  "Effective rate": "実効 FF 金利",
  "Fed balance sheet, total assets": "FRB のバランスシート（総資産）",
  "Total assets": "総資産",
  "The target range is the Federal Open Market Committee's range for the federal funds rate; the effective rate is where overnight fed funds actually trade, SOFR is the overnight Treasury repo rate, and interest on reserves is what the Fed pays banks, which holds the effective rate inside the range.":
    "誘導目標レンジは、米連邦公開市場委員会（FOMC）が定めるフェデラルファンド（FF）金利のレンジです。実効 FF 金利は翌日物の FF が実際に取引されている水準、SOFR は米国債を担保とする翌日物レポ金利、準備預金付利は FRB が銀行に支払う金利で、実効 FF 金利をレンジ内にとどめる役割を果たします。",
  "The odds are Kalshi's: for each meeting, contracts that pay on a cut of more than 25 basis points, a 25 bp cut, a hold, a 25 bp hike or a larger hike. Each meeting's prices are scaled to add up to 100%. The expected move is each outcome's size times its chance; the implied midpoint adds every expected move from today's midpoint, a path in the way CME's FedWatch draws one from fed funds futures.":
    "確率は Kalshi のものです：会合ごとに、25bp（ベーシスポイント）超の利下げ、25bpの利下げ、据え置き、25bpの利上げ、それより大きな利上げのそれぞれで支払われる契約があります。各会合の価格は合計が100%になるよう調整しています。予想変化幅は各結果の幅に確率を掛けたもの、織り込み中心値は現在の中心値にすべての予想変化幅を足したもので、CME の FedWatch が FF 金利先物から金利パスを描くのと同じ方法です。",
  "The projections are the committee's own, published four times a year with the meeting's statement; the dot plot is each member's view of where the rate should be at the end of each year.":
    "経済見通しは FOMC 自身によるもので、年4回、会合の声明とともに公表されます。ドットチャートは、各年末に政策金利がどこにあるべきかについての各参加者の見方です。",
  "The balance sheet is the Fed's total assets, weekly, as of Wednesday. It grows when the Fed buys bonds and shrinks as they run off.":
    "バランスシートは FRB の総資産で、毎週水曜日時点の週次データです。FRB が債券を買い入れると拡大し、保有債券が償還を迎えて減っていくと縮小します。",
  "Sources: the Federal Reserve and the New York Fed through FRED; the FOMC calendar from the Federal Reserve; odds from Kalshi.":
    "出典：FRB とニューヨーク連銀（FRED 経由）、FOMC の日程は FRB、確率は Kalshi。",

  // Employment.
  "No employment figures have been read yet.": "雇用指標はまだ取得されていません。",
  "Payrolls, {month}": "非農業部門雇用者数（{month}）",
  "jobs added on the month · three-month average {avg}": "前月比の雇用者増加数 · 3カ月平均 {avg}",
  "{month} · Sahm rule {sahm} (a recession signal from 0.50)":
    "{month} · サーム・ルール {sahm}（0.50以上で景気後退シグナル）",
  "Initial jobless claims": "新規失業保険申請件数",
  "week to {date} · four-week average {avg} · continuing {cont}":
    "{date}までの週 · 4週平均 {avg} · 継続受給者数 {cont}",
  "Next jobs report": "次回雇用統計",
  "Kalshi: payrolls {pay}, unemployment {u}": "Kalshi：非農業部門雇用者数 {pay}、失業率 {u}",
  "Jobs added each month": "毎月の雇用者増加数",
  "Payrolls, change on the month": "非農業部門雇用者数（前月比増減）",
  "Three-month average": "3カ月平均",
  "Nonfarm payrolls, thousands, seasonally adjusted. The latest two months are revised with each report.":
    "非農業部門雇用者数（千人、季節調整済み）。直近2カ月分は発表のたびに改定されます。",
  "The Sahm rule is the three-month average unemployment rate less its low of the past twelve months, in percentage points; every US recession since 1970 began with it at 0.50 or more. A gap is a month with no household survey.":
    "サーム・ルールは、失業率の3カ月平均から過去12カ月の最低値を引いた値（%ポイント）で、1970年以降の米国の景気後退はすべて、この値が0.50以上のときに始まっています。線が途切れている月は、家計調査が行われなかった月です。",
  "Initial claims": "新規申請件数",
  "Four-week average": "4週平均",
  "Latest figures": "最新の数値",
  Latest: "最新",
  Context: "補足",
  "Average hourly earnings": "平均時給",
  "{month}, year on year · {mom} on the month": "{month}、前年比 · 前月比 {mom}",
  "Job openings": "求人件数",
  "{month} · {before} a year earlier": "{month} · 1年前は {before}",
  "Continuing claims": "継続受給者数",
  "week to {date}": "{date}までの週",
  Payrolls: "非農業部門雇用者数",
  "Payrolls and the unemployment rate come from the Bureau of Labor Statistics' monthly jobs report, usually the first Friday of the month: payrolls from a survey of employers, unemployment from a survey of households. Jobless claims are the Labor Department's weekly count of new filings for unemployment insurance, the most timely read on layoffs.":
    "非農業部門雇用者数と失業率は、米労働統計局（BLS）が毎月、通常は第1金曜日に発表する雇用統計によるものです：雇用者数は事業所調査、失業率は家計調査から得られます。新規失業保険申請件数は、米労働省が毎週集計する失業保険の新規申請の件数で、レイオフを最も早く映す指標です。",
  "Job openings are from the JOLTS survey, a month behind the jobs report. Average hourly earnings are private employers' pay, a gauge of wage inflation.":
    "求人件数は JOLTS（求人労働異動調査）によるもので、雇用統計より1カ月遅れです。平均時給は民間企業の賃金で、賃金インフレの目安です。",
  "The odds are Kalshi's contracts on the next report's payrolls and unemployment rate; the middle estimate is where the chance of above crosses one half.":
    "確率は、次回の雇用統計の非農業部門雇用者数と失業率に関する Kalshi の契約によるものです。中央推定値は、上回る確率が2分の1をまたぐ水準です。",
  "Sources: BLS and the Labor Department through FRED; odds from Kalshi.":
    "出典：BLS と米労働省（FRED 経由）、確率は Kalshi。",

  // Growth.
  "No growth figures have been read yet.": "景気指標はまだ取得されていません。",
  "Real GDP, {quarter}": "実質 GDP（{quarter}）",
  "on the quarter, annualized · recession probability {p}": "前期比年率 · 景気後退確率 {p}",
  "GDPNow, {quarter}": "GDPNow（{quarter}）",
  "the Atlanta Fed's running estimate of the quarter not yet published":
    "未発表の四半期についてのアトランタ連銀の随時推計",
  "Next GDP estimate": "次回 GDP 推計値",
  "Kalshi: {value} for {quarter}": "Kalshi：{quarter}は {value}",
  "Real GDP growth, annualized": "実質 GDP 成長率（年率）",
  "Real GDP": "実質 GDP",
  "GDPNow estimate": "GDPNow 推計値",
  "Quarter on quarter at an annual rate, as the Bureau of Economic Analysis publishes it; the latest figure is revised twice.":
    "米経済分析局（BEA）の公表どおりの前期比年率です。最新の数値はその後2回改定されます。",
  "Activity, year on year": "経済活動（前年比）",
  "Retail sales are in dollars, so they include price rises; industrial production is a volume index.":
    "小売売上高はドル建てのため物価上昇分を含みます。鉱工業生産は数量指数です。",
  "Real GDP is the Bureau of Economic Analysis' measure of the economy's output after inflation, quarter on quarter at an annual rate. Each quarter is first estimated about a month after it ends and revised twice.":
    "実質 GDP は、米経済分析局（BEA）によるインフレ調整後の経済の産出量で、前期比年率で示します。各四半期は終了の約1カ月後に最初の推計値が出され、その後2回改定されます。",
  "GDPNow is the Atlanta Fed's model estimate of the quarter not yet published, updated as each month's data come in; it is a model, not a forecast by the Fed.":
    "GDPNow は、未発表の四半期についてのアトランタ連銀のモデル推計で、毎月のデータが出るたびに更新されます。あくまでモデルであり、FRB の予測ではありません。",
  "Industrial production (the Fed's index of factory, mining and utility output) and retail sales (the Census Bureau's) are monthly. The recession probability is the Chauvet and Piger model's, from four monthly indicators, as FRED publishes it.":
    "鉱工業生産（製造業・鉱業・公益事業の産出量を示す FRB の指数）と小売売上高（米国勢調査局）は月次です。景気後退確率は、4つの月次指標に基づく Chauvet と Piger のモデルによるもので、FRED が公表している値です。",
  "The odds are Kalshi's contracts on the next GDP estimate.":
    "確率は、次回の GDP 推計値に関する Kalshi の契約によるものです。",
  "Sources: BEA, the Federal Reserve, the Census Bureau and the Atlanta Fed through FRED; odds from Kalshi.":
    "出典：BEA、FRB、米国勢調査局、アトランタ連銀（FRED 経由）、確率は Kalshi。",

  // Policy signals.
  "No market signals have been read yet.": "市場シグナルはまだ取得されていません。",
  "2-year yield less fed funds": "2年債利回りと FF 金利の差",
  "2-year {two} above the effective rate: the market prices rates higher over two years":
    "2年債 {two} は実効 FF 金利を上回る：市場は今後2年の金利上昇を織り込み",
  "2-year {two} below the effective rate: the market prices cuts over two years":
    "2年債 {two} は実効 FF 金利を下回る：市場は今後2年の利下げを織り込み",
  "Yield curve, 10-year less 2-year": "イールドカーブ（10年債 − 2年債）",
  "10-year less 3-month {s} · below zero the curve is inverted":
    "10年債 − 3カ月債 {s} · ゼロ未満は逆イールド",
  "10-year real yield": "10年実質利回り",
  "inflation-protected Treasury · nominal 10-year {ten}": "物価連動国債 · 名目10年債 {ten}",
  "Net liquidity": "ネット流動性",
  "Fed assets less the Treasury's account and reverse repos":
    "FRB の資産から財務省口座とリバースレポを差し引いた額",
  "{change} over four weeks · Fed assets less the Treasury's account and reverse repos":
    "4週間で {change} · FRB の資産から財務省口座とリバースレポを差し引いた額",
  "Treasury yields": "米国債利回り",
  "3-month": "3カ月債",
  "2-year": "2年債",
  "10-year": "10年債",
  "30-year": "30年債",
  "Yield curve": "イールドカーブ",
  "10-year less 2-year": "10年債 − 2年債",
  "10-year less 3-month": "10年債 − 3カ月債",
  "An inverted curve, long yields below short ones, has come before every US recession since the 1970s, often by a year or more; the turn back above zero has often come closer to it.":
    "長期金利が短期金利を下回る逆イールドは、1970年代以降の米国のすべての景気後退に先行しており、その差は1年以上のことも多くあります。ゼロを上回る水準への戻りは、景気後退のより直前に起きることが多くありました。",
  "The Fed's total assets less the Treasury General Account and the overnight reverse repo facility: a rough count of the dollars the Fed's balance sheet leaves in the market, which many crypto traders watch against prices.":
    "FRB の総資産から財務省一般勘定（TGA）と翌日物リバースレポ・ファシリティを差し引いたもの：FRB のバランスシートが市場に残しているドルのおおまかな量で、多くの暗号資産トレーダーが価格と見比べています。",
  "Other signals": "その他のシグナル",
  "4 weeks": "4週間",
  "1 year": "1年",
  Reading: "解釈",
  "Dollar, broad index": "ドル広義指数",
  "the Fed's trade-weighted dollar; a rising dollar tightens conditions worldwide":
    "FRB の貿易加重ドル指数。ドル高は世界の金融環境を引き締める",
  "Financial conditions (NFCI)": "金融環境（NFCI）",
  "below zero: looser than average": "ゼロ未満：平均より緩和的",
  "above zero: tighter than average": "ゼロ超：平均より引き締め的",
  "Money supply (M2)": "マネーサプライ（M2）",
  "{month}, year on year": "{month}、前年比",
  "What the bond market says about policy before the Fed does. The 2-year Treasury yield tracks where traders expect the policy rate over the next two years: well above the effective rate, they expect it higher; well below, they expect cuts.":
    "FRB より先に、債券市場が金融政策について示していることです。米2年債利回りは、今後2年間の政策金利がどこにあるとトレーダーが予想しているかに連動します：実効 FF 金利を大きく上回っていれば利上げを、大きく下回っていれば利下げを予想しています。",
  "The yield curve is the 10-year yield less the 2-year, and less the 3-month bill. Real yields are inflation-protected Treasuries' (TIPS); a high real yield is a high cost of holding assets that pay nothing, crypto among them.":
    "イールドカーブは、10年債利回りから2年債利回りを、また3カ月物の短期国債利回りを引いたものです。実質利回りは物価連動国債（TIPS）の利回りで、実質利回りが高いことは、暗号資産のように利息を生まない資産を保有するコストが高いことを意味します。",
  "Net liquidity is the Fed's balance sheet less the Treasury's cash at the Fed and the reverse repo facility, worked out here from the weekly figures; it is a rule of thumb, not an official measure. The NFCI is the Chicago Fed's index of financial conditions, zero at its long-run average.":
    "ネット流動性は、FRB のバランスシートから FRB にある財務省の現金とリバースレポ・ファシリティを差し引いたもので、週次の数値からここで計算しています。経験則による目安であり、公式の指標ではありません。NFCI はシカゴ連銀の金融環境指数で、長期平均でゼロになります。",
  "Sources: Treasury yields, the Federal Reserve and the Chicago Fed through FRED.":
    "出典：米財務省の国債利回り、FRB、シカゴ連銀（FRED 経由）。",

  // Positioning and flows: the futures markets.
  "Bitcoin (CME)": "ビットコイン（CME）",
  "Ether (CME)": "イーサリアム（CME）",
  "S&P 500 E-mini": "S&P 500 E-mini",
  "Nasdaq-100 E-mini": "ナスダック100 E-mini",
  "Russell 2000 E-mini": "ラッセル2000 E-mini",
  "VIX futures": "VIX 先物",
  "2-year Treasury note": "米2年国債",
  "10-year Treasury note": "米10年国債",
  "Treasury bond": "米長期国債",
  "3-month SOFR": "3カ月 SOFR",
  "30-day fed funds": "30日 FF 金利",
  "US dollar index": "ドルインデックス",
  Euro: "ユーロ",
  "Japanese yen": "日本円",
  Gold: "金",
  Silver: "銀",
  "WTI crude oil": "WTI 原油",
  Copper: "銅",

  // Positioning and flows: the trader groups, tables and tiles.
  "Leveraged funds": "レバレッジド・ファンド",
  "Asset managers": "アセットマネージャー",
  Dealers: "ディーラー",
  "Managed money": "マネージド・マネー",
  "Producers and merchants": "生産者・商業筋",
  "Swap dealers": "スワップ・ディーラー",
  "Financial futures: who holds them": "金融先物：保有者の内訳",
  "Commodity futures: who holds them": "コモディティ先物：保有者の内訳",
  "{group}, net": "{group}（ネット）",
  Week: "前週比",
  "Where this week's net sits among the last three years' weeks: 0% the shortest, 100% the longest":
    "今週のネットが過去3年の各週の中でどこに位置するか：0%が最もショート、100%が最もロング",
  "3-year rank": "3年順位",
  "3 years": "3年間",
  "No positioning data has been read yet.": "ポジションデータはまだ取得されていません。",
  "contracts net, {share} of open interest · 3-year rank {rank} · {other} {otherNet}":
    "ネット枚数、建玉の {share} · 3年順位 {rank} · {other} {otherNet}",
  "Stablecoin supply": "ステーブルコイン供給量",
  "{d30} in 30 days · {d90} in 90 days": "30日で {d30} · 90日で {d90}",
  "CME Bitcoin, leveraged funds": "CME ビットコイン、レバレッジド・ファンド",
  "asset managers": "アセットマネージャー",
  "CME Ether, leveraged funds": "CME イーサリアム、レバレッジド・ファンド",
  "Gold, managed money": "金、マネージド・マネー",
  producers: "生産者・商業筋",
  "Who holds CME Bitcoin futures": "CME ビットコイン先物の保有者",
  "Net contracts (longs less shorts) of five bitcoin each, as of each Tuesday. Leveraged funds are hedge funds and trading firms; much of their short is the futures leg of a cash-and-carry trade against spot ETFs, not a bet on a fall.":
    "ネット枚数（ロング − ショート、1枚 = 5 BTC）、毎週火曜日時点。レバレッジド・ファンドはヘッジファンドや自己勘定取引業者で、そのショートの多くは現物 ETF に対するキャッシュ・アンド・キャリー取引の先物レッグであり、下落への賭けではありません。",
  "Dollar stablecoins in circulation": "流通しているドル建てステーブルコイン",
  "Every dollar-pegged stablecoin's supply, added up by DefiLlama: dollars already on-chain, the first money to reach crypto prices.":
    "ドルペッグの全ステーブルコインの供給量を DefiLlama が合計したもの：すでにオンチェーンにあるドルで、暗号資産の価格に最初に届く資金です。",
  "Who actually holds the futures, from the CFTC's weekly Commitments of Traders: positions as of Tuesday, published the Friday after. For financial futures the CFTC splits traders into dealers (the banks that make markets), asset managers (pension funds, insurers, mutual funds: slower, real money) and leveraged funds (hedge funds and trading firms: faster, speculative). For commodities it splits producers and merchants (hedgers), swap dealers and managed money (the speculators).":
    "実際に先物を誰が保有しているかを、CFTC が毎週公表する建玉明細報告（COT）から示します：火曜日時点のポジションが、その週の金曜日に公表されます。金融先物では、CFTC はトレーダーをディーラー（マーケットメイクを行う銀行）、アセットマネージャー（年金基金、保険会社、投資信託：動きが遅いリアルマネー）、レバレッジド・ファンド（ヘッジファンドや自己勘定取引業者：動きが速い投機筋）に分けています。コモディティでは、生産者・商業筋（ヘッジャー）、スワップ・ディーラー、マネージド・マネー（投機筋）に分けています。",
  "Net is longs less shorts, in contracts; its share is of the market's open interest. The 3-year rank says where this week's net sits among every week of the last three years: near 0% the speculators are as short as they have been, near 100% as long, which is when positioning tends to unwind.":
    "ネットはロングからショートを引いた枚数で、その比率は市場の建玉に対する割合です。3年順位は、今週のネットが過去3年のすべての週の中でどこに位置するかを示します：0%付近なら投機筋はこれまでで最もショートに、100%付近なら最もロングに傾いており、ポジションの巻き戻しが起きやすいのはそうした局面です。",
  "Stablecoin supply is the dollars already on-chain, from DefiLlama: when it grows, new money is arriving in crypto.":
    "ステーブルコイン供給量は、すでにオンチェーンにあるドルの量で、DefiLlama のデータです：増えているときは、新しい資金が暗号資産に流入しています。",
  "Sources: the CFTC's Commitments of Traders, futures only{date}; DefiLlama for stablecoins.":
    "出典：CFTC の建玉明細報告（先物のみ{date}）、ステーブルコインは DefiLlama。",
  ", report of {date}": "、報告日 {date}",
  "The macro data could not be read right now.": "現在マクロデータを読み込めません。",
  // The Rates page's prediction-market tabs (web/crowd.ts).
  "1d": "1日",
  "1d change": "1日変化",
  "7d": "7日",
  "Another Fed hike in 2026": "2026年にFRBが再利上げするか",
  "BTC odds": "BTC確率",
  "BTC: crowd vs options": "BTC：予測市場 vs オプション",
  "Bitcoin above, {when}": "ビットコインが上回る（{when}）",
  "Bitcoin now": "ビットコイン現在値",
  Chance: "確率",
  "Change in the expected move over the last day": "期待変化の過去1日の変化",
  "Deribit index at the option chain's read": "オプションチェーン取得時の Deribit 指数",
  "Deribit's option chain: Black-76 with the smile's slope, between the expiries either side":
    "Deribit のオプションチェーン：スマイルの傾きを含む Black-76、前後の満期の間で補間",
  "Each FOMC meeting, both venues": "各 FOMC 会合、両市場",
  "Each price is the chance the venue's traders give the outcome, its Yes price; a fed meeting's outcomes are scaled to add up to one. Changes are in percentage points against the price a day and a week before. Polymarket is read every 15 minutes and kept hourly for good; Kalshi's odds are the Fed, Jobs and Growth tabs' own.":
    "各価格はその市場のトレーダーが結果に与える確率（Yes価格）です。FRB会合の各結果は合計が1になるよう調整しています。変化は1日前・1週間前の価格に対するパーセントポイントです。Polymarket は15分ごとに取得し、1時間ごとに永久保存します。Kalshi の確率は Fed・雇用・成長タブと同じです。",
  "Fed cuts in 2026": "2026年のFRB利下げ回数",
  "Fed rate at the end of 2026": "2026年末の政策金利",
  "GDP growth, the quarter": "四半期GDP成長率",
  Gap: "差",
  "How high US unemployment goes in 2026": "2026年の米失業率の最高値",
  "How high inflation gets in 2026": "2026年のインフレ率の最高値",
  "How many Fed cuts in 2026": "2026年にFRBは何回利下げするか",
  "Kalshi median": "Kalshi 中央値",
  "Next settlement": "次の決済",
  "No Bitcoin ladder has been read yet. The collector reads Polymarket every 15 minutes.":
    "ビットコインのラダーはまだ取得していません。コレクターは15分ごとに Polymarket を取得します。",
  "No prediction market has been read yet. The collector reads Polymarket every 15 minutes.":
    "予測市場はまだ取得していません。コレクターは15分ごとに Polymarket を取得します。",
  "Percentage points over the last day": "過去1日のパーセントポイント変化",
  "Percentage points over the last week": "過去1週間のパーセントポイント変化",
  "Polymarket less options, in percentage points":
    "Polymarket からオプションを引いた値（パーセントポイント）",
  "Polymarket median": "Polymarket 中央値",
  "Polymarket's change over the last day, in percentage points":
    "Polymarket の過去1日の変化（パーセントポイント）",
  "Polymarket's ladders settle on Binance's BTC/USDT one-minute close at noon New York. The options column is what Deribit's latest BTC chain implies for the same price and moment: each strike's volatility from the smile, the chance of finishing above it with the smile's slope counted, the total variance read between the expiries either side. A positive gap means Polymarket's crowd gives the price better odds than the options do. Smart $ is what the smart wallets (the leaderboard's most profitable, as on the Prediction markets tab) hold on Yes less what they hold on No.":
    "Polymarket のラダーはニューヨーク正午のバイナンス BTC/USDT 1分足終値で決済されます。オプション列は Deribit の最新 BTC チェーンが同じ価格・時点について示す確率です：各行使価格のボラティリティはスマイルから、スマイルの傾きを含めて上回る確率を算出し、総分散は前後の満期の間で読み取ります。差がプラスなら Polymarket の参加者はオプションより高い確率を付けています。 スマートマネーは、スマートウォレット（予測市場タブと同じくリーダーボードで最も利益を上げた参加者）が Yes に持つ金額から No に持つ金額を引いたものです。",
  "Polymarket's median outcome": "Polymarket の中央値の結果",
  "Prediction markets": "予測市場",
  Predictions: "予測",
  Print: "指標",
  Settles: "決済",
  "The Fed rate at the end of 2026": "2026年末の政策金利",
  "The next prints, both venues": "次の指標発表、両市場",
  "The outcome bucket where Polymarket's chances, in order, pass one half":
    "Polymarket の確率を順に足して半分を超える結果区分",
  "The prediction markets could not be read right now.": "現在、予測市場を読み込めません。",
  "The year ahead, on Polymarket": "今後1年、Polymarket の見通し",
  "US GDP growth in 2026": "2026年の米GDP成長率",
  "US recession": "米国の景気後退",
  "Where Kalshi's ladder of above-X chances crosses one half":
    "Kalshi の「X以上」確率ラダーが半分を横切る点",
  "Widest gap": "最大の差",
  "above {price} on {date}: the crowd is {side} than the options":
    "{date} に {price} 超：参加者はオプションより{side}",
  bp: "bp",
  "by the end of each year": "各年末まで",
  "crowd median {crowd} · options median {options}":
    "参加者中央値 {crowd} · オプション中央値 {options}",
  "more bearish": "より弱気",
  "more bullish": "より強気",
  "no option chain read yet": "オプションチェーンは未取得",
  "noon New York": "ニューヨーク正午",
  "{change} pp over a week": "1週間で {change} pp",
  "{n} more outcomes under 1%": "ほか {n} 件の結果は1%未満",
  "Change in the smart share over the last day, in percentage points":
    "スマートマネー比率の過去1日の変化（パーセントポイント）",
  Crowd: "参加者",
  "Fed, {meeting}": "FRB、{meeting}",
  No: "いいえ",
  Question: "質問",
  "Share of smart $": "スマートマネー比率",
  "Smart $": "スマート$",
  "Smart money backs": "スマートマネーの支持",
  "Smart money is the {n} wallets with the most profit on Polymarket's own leaderboard in Economics and in Crypto, over the past month or all time. Each market's top 100 holders per outcome are read every hour; a smart wallet holding less than that is not seen. Where smart money and the crowd's price part, one side is wrong, and the smart side has the better record.":
    "スマートマネーとは、Polymarket 自身のリーダーボードで経済と暗号資産の各カテゴリーにおいて、過去1か月または全期間で最も利益を上げた {n} のウォレットです。各市場の結果ごとの上位100保有者を毎時取得するため、それ未満の保有は見えません。スマートマネーと参加者の価格が分かれるとき、どちらかが間違っており、実績が良いのはスマート側です。",
  "Smart money on Polymarket": "Polymarket のスマートマネー",
  "That outcome's share of the smart wallets' dollars on the question":
    "この質問に対するスマートウォレットの金額に占めるその結果の割合",
  "The crowd's price for that outcome": "その結果に対する参加者の価格",
  "The smart wallets' dollars on Yes less their dollars on No":
    "スマートウォレットの Yes の金額から No の金額を引いた値",
  Wallets: "ウォレット数",
  Yes: "はい",
  // World indexes tab (web/indexes.ts)
  "World indexes": "世界の株価指数",
  Indexes: "指数",
  India: "インド",
  Japan: "日本",
  Korea: "韓国",
  Singapore: "シンガポール",
  Australia: "オーストラリア",
  Americas: "南北アメリカ",
  "Middle East": "中東",
  Canada: "カナダ",
  Brazil: "ブラジル",
  Mexico: "メキシコ",
  Germany: "ドイツ",
  "United Kingdom": "英国",
  France: "フランス",
  "Euro area": "ユーロ圏",
  Netherlands: "オランダ",
  Spain: "スペイン",
  Italy: "イタリア",
  Switzerland: "スイス",
  Portugal: "ポルトガル",
  Belgium: "ベルギー",
  Austria: "オーストリア",
  Sweden: "スウェーデン",
  Denmark: "デンマーク",
  Poland: "ポーランド",
  Turkey: "トルコ",
  Israel: "イスラエル",
  "Saudi Arabia": "サウジアラビア",
  "Hong Kong": "香港",
  China: "中国",
  Taiwan: "台湾",
  Thailand: "タイ",
  Indonesia: "インドネシア",
  Philippines: "フィリピン",
  Malaysia: "マレーシア",
  Vietnam: "ベトナム",
  Other: "その他",
  "{n} daily closes, {change}%": "日次終値 {n} 本、{change}%",
  "Its option book on the Gamma Exposure tab": "ガンマエクスポージャータブのオプションブック",
  options: "オプション",
  live: "リアルタイム",
  closing: "終値",
  "The index levels could not be read right now.": "現在、指数の水準を読み込めません。",
  "No index level has been read yet. The collector reads them every five minutes.":
    "指数の水準はまだ読み込まれていません。コレクターは5分ごとに読み込みます。",
  "Stock index levels across the Americas, Europe, the Middle East and Asia-Pacific: the day's change against the previous close, the day's range, and a month of daily closes.":
    "南北アメリカ、欧州、中東、アジア太平洋の株価指数の水準：前日終値に対する当日の騰落、当日の値幅、1か月分の日次終値。",
  Index: "指数",
  Level: "水準",
  Change: "騰落率",
  "Day range": "当日の値幅",
  "India's Nifty indexes, Nifty Bank and India VIX are NSE's daily closing file, read once each evening. The rest are read every five minutes: KOSPI and KOSPI 200 from the Korea Exchange, the BSE Sensex, Nikkei 225, TOPIX, Straits Times and S&P/ASX 200 from Sina's quotes, and the other indexes from quotes delayed by up to 20 minutes; a market that has closed shows its close. BSE-100, BSE-200 and BSE-500 have no free source we can read.":
    "インドの Nifty 指数、Nifty Bank、India VIX は NSE の日次終値ファイルで、毎晩1回読み込みます。それ以外は5分ごとに読み込みます：KOSPI と KOSPI 200 は韓国取引所、BSE Sensex、日経225、TOPIX、ストレーツ・タイムズ指数、S&P/ASX 200 は Sina の気配値、その他の指数は最大20分遅れの気配値です。取引を終えた市場は終値を表示します。BSE-100、BSE-200、BSE-500 には読み込める無料のソースがありません。",
  // An index's page (web/index-page.ts)
  "No index {ticker}.": "指数 {ticker} はありません。",
  "the Korea Exchange's own index charts, every five minutes":
    "韓国取引所自身の指数チャート、5分ごと",
  "Sina's quote feed, every five minutes": "Sina の気配値、5分ごと",
  "NSE's daily closing file, read once each evening": "NSE の日次終値ファイル、毎晩1回読み込み",
  "TradingView's quotes, up to 20 minutes behind, every five minutes":
    "TradingView の気配値、最大20分遅れ、5分ごと",
  "Hover or tap the chart to read a point.":
    "チャートにカーソルを合わせるかタップすると、その点を読み取れます。",
  "from {prev}": "前回 {prev}",
  "Daily closes": "日次終値",
  "The last 36 hours": "直近36時間",
  "The collector has kept this index since {date}: {n} daily closes so far. The chart fills in a close a day.":
    "コレクターは {date} からこの指数を記録しています：これまでに日次終値 {n} 本。チャートは1日1本ずつ増えます。",
  "No close kept yet.": "まだ終値の記録はありません。",
  "Perpetuals on it: {base}": "この指数の無期限先物：{base}",
  "{n} markets, {oi} open interest": "{n} 市場、建玉 {oi}",
  "Its chart and order flow (CVD)": "チャートとオーダーフロー（CVD）",
  "Its liquidations": "清算",
  "Its option book: gamma exposure, Greeks and IV walls":
    "オプションブック：ガンマエクスポージャー、グリークス、IV ウォール",
  "Every index on the World indexes tab": "世界の株価指数タブのすべての指数",
  "{name} index level": "{name} の指数水準",
  "{name}: the level now, the day's change and range, and the daily closes kept since the site began reading it.":
    "{name}：現在の水準、当日の騰落と値幅、本サイトが読み込みを始めてからの日次終値。",
  "On this site": "本サイトでは",
  "The level is from {source}.": "水準の出所は{source}です。",
  "A close is the session's last level; a market that is shut shows its close until it opens again. Daily closes are each UTC day's last level.":
    "終値はその取引時間の最後の水準です。休場中の市場は再開まで終値を表示します。日次終値は各 UTC 日の最後の水準です。",
};
