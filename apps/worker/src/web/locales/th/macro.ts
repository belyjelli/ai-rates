import type { Catalog } from "../../i18n";

/**
 * The Rates page's macro tabs (web/macro.ts) and the macro charts' readout words (web/slot-chart.ts),
 * in Thai. Glossary and style: ./index.ts.
 *
 * Terms, as Thai financial news writes them: Fed เฟด, FOMC, fed funds rate อัตรา Fed Funds, target
 * range กรอบเป้าหมาย, effective rate อัตราจริง (Effective), interest on reserves ดอกเบี้ยเงินสำรอง
 * (IORB), midpoint ค่ากลาง, cut / hold / hike ลด / คง / ขึ้น, policy rate อัตราดอกเบี้ยนโยบาย, balance
 * sheet งบดุล, SEP, Dot Plot, Treasuries พันธบัตรสหรัฐ, yield Yield, yield curve Yield Curve, inverted
 * หัวกลับ, real yield Real Yield, breakeven Breakeven, TIPS, Reverse Repo, net liquidity สภาพคล่องสุทธิ,
 * on the month เทียบเดือนก่อน, year on year เทียบปีก่อน, annualized คิดเป็นรายปี, core พื้นฐาน, print
 * ตัวเลขที่ประกาศ, payrolls Nonfarm Payrolls, unemployment rate อัตราการว่างงาน, jobless claims
 * ผู้ขอรับสวัสดิการว่างงาน (initial ครั้งแรก, continuing ต่อเนื่อง), job openings ตำแหน่งงานว่าง, average
 * hourly earnings ค่าจ้างเฉลี่ยรายชั่วโมง, Sahm Rule, retail sales ยอดค้าปลีก, industrial production
 * การผลิตภาคอุตสาหกรรม, recession ภาวะถดถอย, odds โอกาส, middle estimate ค่าประมาณกลาง, pp and bp stay
 * as units, Commitments of Traders (COT), dealers ดีลเลอร์, asset managers ผู้จัดการสินทรัพย์, leveraged
 * funds กองทุนเลเวอเรจ, Managed Money, producers and merchants ผู้ผลิตและผู้ค้า, Swap Dealer, net สุทธิ,
 * 3-year rank อันดับ 3 ปี, Stablecoin, supply อุปทาน, GDP, CPI (ดัชนีราคาผู้บริโภค in the prose that
 * introduces it), crowd ฝูงชน, Smart Money, prediction markets ตลาดทำนายผล, settlement วันตัดสินผล.
 * Agency names stay as written: BLS, BEA, FRED, CFTC, CME, Kalshi, DefiLlama, GDPNow, NFCI, M2, SOFR,
 * JOLTS, E-mini, VIX.
 */
export const macro: Catalog = {
  // The tab bar.
  "Inflation (CPI)": "เงินเฟ้อ (CPI)",
  CPI: "CPI",
  "Fed policy": "นโยบายเฟด",
  Fed: "เฟด",
  Employment: "การจ้างงาน",
  Jobs: "ตลาดแรงงาน",
  Growth: "การเติบโต",
  "Policy signals": "สัญญาณนโยบาย",
  Signals: "สัญญาณ",
  "Positioning and flows": "สถานะและเงินไหล",
  Flows: "เงินไหล",

  // Units, dates and the chart frame. "{n} pp" and "{n} bp" are suffixes after a signed figure.
  "{n} pp": "{n} pp",
  "{n} bp": "{n} bp",
  "{month} {year}": "{month} {year}",
  "Q{q} {year}": "Q{q} {year}",
  "in {time}": "ในอีก {time}",
  "hover or tap the chart to read any point": "ชี้หรือแตะกราฟเพื่ออ่านค่าแต่ละจุด",
  "{chart}; arrow keys read one point at a time": "{chart} ใช้ปุ่มลูกศรอ่านทีละจุด",

  // The release calendar.
  "PCE prices": "ดัชนีราคา PCE",
  "Jobs report": "รายงานการจ้างงาน",
  "Jobless claims": "ผู้ขอรับสวัสดิการว่างงาน",
  "Job openings (JOLTS)": "ตำแหน่งงานว่าง (JOLTS)",
  GDP: "GDP",
  "Retail sales": "ยอดค้าปลีก",
  "Industrial production": "การผลิตภาคอุตสาหกรรม",
  "FOMC decision": "มติ FOMC",
  "Coming up": "เร็ว ๆ นี้",

  // Kalshi's ladders and the footnotes.
  "below {value}": "ต่ำกว่า {value}",
  "above {value}": "สูงกว่า {value}",
  "middle estimate {value}": "ค่าประมาณกลาง {value}",
  "Not updated since {ago}: the latest reads of these sources failed, so the figures are that old.":
    "ไม่ได้อัปเดตตั้งแต่ {ago}: การอ่านแหล่งข้อมูลเหล่านี้ครั้งล่าสุดล้มเหลว ตัวเลขจึงเก่าเท่านั้น",
  "{sources} Last read {ago}.": "{sources} อ่านล่าสุด {ago}",

  // Inflation.
  "No inflation figures have been read yet.": "ยังไม่มีตัวเลขเงินเฟ้อ",
  "CPI, year on year": "CPI เทียบปีก่อน",
  "{month}: {mom} on the month · core {core}": "{month}: {mom} เทียบเดือนก่อน · พื้นฐาน {core}",
  "Core PCE, year on year": "PCE พื้นฐาน เทียบปีก่อน",
  "{month} · the measure the Fed's 2% target is set in": "{month} · ตัวชี้วัดที่เฟดใช้ตั้งเป้าหมาย 2%",
  "Next CPI": "CPI ครั้งถัดไป",
  "Kalshi: {headline} on the month, core {core}": "Kalshi: {headline} เทียบเดือนก่อน พื้นฐาน {core}",
  "no date published yet": "ยังไม่ประกาศวัน",
  "5-year breakeven": "Breakeven 5 ปี",
  "the inflation Treasuries price in · 5y5y forward {fwd}":
    "เงินเฟ้อที่พันธบัตรสหรัฐสะท้อนไว้ในราคา · 5y5y Forward {fwd}",
  "Inflation, year on year": "เงินเฟ้อ เทียบปีก่อน",
  "Core CPI": "CPI พื้นฐาน",
  PCE: "PCE",
  "Core PCE": "PCE พื้นฐาน",
  "Fed's 2% target": "เป้าหมาย 2% ของเฟด",
  "Inflation the bond market prices in": "เงินเฟ้อที่ตลาดพันธบัตรสะท้อนไว้ในราคา",
  "10-year breakeven": "Breakeven 10 ปี",
  "5y5y forward": "5y5y Forward",
  "Breakeven: the gap between a nominal Treasury's yield and an inflation-protected one's of the same term. Weekly, each week's last close.":
    "Breakeven: ส่วนต่างระหว่าง Yield ของพันธบัตรสหรัฐแบบปกติกับแบบป้องกันเงินเฟ้อที่อายุเท่ากัน รายสัปดาห์ ใช้ราคาปิดสุดท้ายของแต่ละสัปดาห์",
  "Latest prints": "ตัวเลขที่ประกาศล่าสุด",
  Measure: "ตัวชี้วัด",
  Month: "เดือน",
  "On the month": "เทียบเดือนก่อน",
  "3 months, annualized": "3 เดือน คิดเป็นรายปี",
  "6 months, annualized": "6 เดือน คิดเป็นรายปี",
  "Year on year": "เทียบปีก่อน",
  "A year earlier": "ปีก่อนหน้า",
  "CPI, on the month": "CPI เทียบเดือนก่อน",
  "Core CPI, on the month": "CPI พื้นฐาน เทียบเดือนก่อน",
  Inflation: "เงินเฟ้อ",
  "CPI is the Bureau of Labor Statistics' consumer price index, published monthly; core leaves out food and energy. PCE is the Bureau of Economic Analysis' price index for personal consumption, published about two weeks after CPI; the Fed's 2% target is set in it, and core PCE is the figure it watches most.":
    "CPI คือดัชนีราคาผู้บริโภคของสำนักงานสถิติแรงงานสหรัฐ (BLS) ประกาศทุกเดือน ตัวพื้นฐานไม่รวมอาหารและพลังงาน PCE คือดัชนีราคาการใช้จ่ายส่วนบุคคลของสำนักงานวิเคราะห์เศรษฐกิจสหรัฐ (BEA) ประกาศหลัง CPI ประมาณสองสัปดาห์ เฟดตั้งเป้าหมาย 2% ไว้ที่ตัวนี้ และ PCE พื้นฐานคือตัวเลขที่เฟดจับตามากที่สุด",
  "The changes are worked out here from the seasonally adjusted indexes: on the month, over three and six months annualized (the recent pace, which the year-on-year figure is slow to show), and on the year.":
    "การเปลี่ยนแปลงคำนวณที่นี่จากดัชนีที่ปรับฤดูกาลแล้ว: เทียบเดือนก่อน ช่วงสามและหกเดือนคิดเป็นรายปี (ความเร็วล่าสุด ซึ่งตัวเลขเทียบปีก่อนสะท้อนออกมาช้า) และเทียบปีก่อน",
  "The breakevens are the inflation the Treasury market prices in, from the Fed's daily yields: 5-year and 10-year, and the 5-year rate starting five years from now (5y5y), which the Fed reads as long-run expectations.":
    "Breakeven คือเงินเฟ้อที่ตลาดพันธบัตรสหรัฐสะท้อนไว้ในราคา จาก Yield รายวันของเฟด: 5 ปีและ 10 ปี และอัตรา 5 ปีที่เริ่มในอีกห้าปีข้างหน้า (5y5y) ซึ่งเฟดใช้อ่านเป็นการคาดการณ์ระยะยาว",
  "Kalshi, a CFTC-regulated exchange, lists contracts that pay if the next print is above a level. Their prices read as the market's chances; the middle estimate is where the chance of above crosses one half.":
    "Kalshi กระดานเทรดภายใต้การกำกับของ CFTC มีสัญญาที่จ่ายเงินหากตัวเลขครั้งถัดไปสูงกว่าระดับที่กำหนด ราคาของสัญญาอ่านได้เป็นโอกาสที่ตลาดให้ ค่าประมาณกลางคือจุดที่โอกาสของ “สูงกว่า” ข้ามครึ่งหนึ่ง",
  "What Kalshi's traders expect": "เทรดเดอร์บน Kalshi คาดอะไร",
  "Sources: BLS and BEA through FRED; breakevens from the Fed's Treasury yields; odds from Kalshi.":
    "แหล่งข้อมูล: BLS และ BEA ผ่าน FRED Breakeven จาก Yield พันธบัตรสหรัฐของเฟด โอกาสจาก Kalshi",

  // Fed policy.
  "cut more than 25 bp": "ลดมากกว่า 25 bp",
  "cut 25 bp": "ลด 25 bp",
  hold: "คงดอกเบี้ย",
  "hike 25 bp": "ขึ้น 25 bp",
  "hike more than 25 bp": "ขึ้นมากกว่า 25 bp",
  "No Fed policy figures have been read yet.": "ยังไม่มีตัวเลขนโยบายเฟด",
  "Target range": "กรอบเป้าหมาย",
  "effective {effr} · SOFR {sofr} · interest on reserves {iorb}":
    "อัตราจริง {effr} · SOFR {sofr} · ดอกเบี้ยเงินสำรอง {iorb}",
  "Next FOMC decision": "มติ FOMC ครั้งถัดไป",
  "with projections": "พร้อมประมาณการ",
  "Kalshi: {outcome} {p}": "Kalshi: {outcome} {p}",
  "Rate path the market prices": "เส้นทางดอกเบี้ยที่ตลาดคาด",
  "midpoint after {meeting}: {move} from today's {mid}":
    "ค่ากลางหลัง {meeting}: {move} จาก {mid} ในวันนี้",
  "no Kalshi odds read yet": "ยังไม่มีโอกาสจาก Kalshi",
  "Fed balance sheet": "งบดุลเฟด",
  "{change} over four weeks · week of {date}": "{change} ในสี่สัปดาห์ · สัปดาห์วันที่ {date}",
  "A meeting with a Summary of Economic Projections": "การประชุมที่มีการเผยแพร่ประมาณการเศรษฐกิจ (SEP)",
  SEP: "SEP",
  "Each meeting's odds, from Kalshi": "โอกาสของแต่ละการประชุม จาก Kalshi",
  Meeting: "การประชุม",
  "Cut &gt;25": "ลด &gt;25",
  "Cut 25": "ลด 25",
  Hold: "คง",
  "Hike 25": "ขึ้น 25",
  "Hike &gt;25": "ขึ้น &gt;25",
  "Each outcome's move times its chance, added up": "ขนาดการขยับของแต่ละผลลัพธ์คูณโอกาส แล้วรวมกัน",
  "Expected move": "การขยับที่คาด",
  "Today's midpoint plus every expected move to this meeting":
    "ค่ากลางวันนี้บวกการขยับที่คาดทั้งหมดจนถึงการประชุมนี้",
  "Implied midpoint": "ค่ากลางโดยนัย",
  "The Fed's own projections": "ประมาณการของเฟดเอง",
  "Median, end of year": "มัธยฐาน สิ้นปี",
  "Longer run": "ระยะยาว",
  "Fed funds rate": "อัตรา Fed Funds",
  "PCE inflation": "เงินเฟ้อ PCE",
  "Core PCE inflation": "เงินเฟ้อ PCE พื้นฐาน",
  "Unemployment rate": "อัตราการว่างงาน",
  "Real GDP growth": "การเติบโตของ GDP ที่แท้จริง",
  "From the Summary of Economic Projections of {date}: the median of the committee's forecasts (the dot plot's middle dot for the rate). Inflation and growth are fourth quarter on fourth quarter; unemployment is the fourth quarter's average.":
    "จากประมาณการเศรษฐกิจ (SEP) วันที่ {date}: มัธยฐานของการคาดการณ์ของคณะกรรมการ (สำหรับดอกเบี้ยคือจุดกลางของ Dot Plot) เงินเฟ้อและการเติบโตเทียบไตรมาสสี่กับไตรมาสสี่ อัตราการว่างงานเป็นค่าเฉลี่ยของไตรมาสสี่",
  "Policy rate": "อัตราดอกเบี้ยนโยบาย",
  "Top of the range": "ขอบบนของกรอบ",
  "Bottom of the range": "ขอบล่างของกรอบ",
  "Effective rate": "อัตราจริง (Effective)",
  "Fed balance sheet, total assets": "งบดุลเฟด สินทรัพย์รวม",
  "Total assets": "สินทรัพย์รวม",
  "The target range is the Federal Open Market Committee's range for the federal funds rate; the effective rate is where overnight fed funds actually trade, SOFR is the overnight Treasury repo rate, and interest on reserves is what the Fed pays banks, which holds the effective rate inside the range.":
    "กรอบเป้าหมายคือกรอบอัตรา Fed Funds ที่คณะกรรมการนโยบายการเงินสหรัฐ (FOMC) กำหนด อัตราจริงคือระดับที่ Fed Funds ข้ามคืนซื้อขายกันจริง SOFR คืออัตรา Repo ข้ามคืนที่ใช้พันธบัตรสหรัฐค้ำ และดอกเบี้ยเงินสำรองคือดอกเบี้ยที่เฟดจ่ายให้ธนาคาร ซึ่งช่วยตรึงอัตราจริงให้อยู่ในกรอบ",
  "The odds are Kalshi's: for each meeting, contracts that pay on a cut of more than 25 basis points, a 25 bp cut, a hold, a 25 bp hike or a larger hike. Each meeting's prices are scaled to add up to 100%. The expected move is each outcome's size times its chance; the implied midpoint adds every expected move from today's midpoint, a path in the way CME's FedWatch draws one from fed funds futures.":
    "โอกาสมาจาก Kalshi: แต่ละการประชุมมีสัญญาที่จ่ายเงินเมื่อลดมากกว่า 25 bp ลด 25 bp คงดอกเบี้ย ขึ้น 25 bp หรือขึ้นมากกว่านั้น ราคาของแต่ละการประชุมถูกปรับสเกลให้รวมกันได้ 100% การขยับที่คาดคือขนาดของแต่ละผลลัพธ์คูณโอกาส ค่ากลางโดยนัยบวกการขยับที่คาดทั้งหมดเข้ากับค่ากลางวันนี้ เป็นเส้นทางแบบเดียวกับที่ FedWatch ของ CME วาดจาก Fed Funds Futures",
  "The projections are the committee's own, published four times a year with the meeting's statement; the dot plot is each member's view of where the rate should be at the end of each year.":
    "ประมาณการเป็นของคณะกรรมการเอง เผยแพร่ปีละสี่ครั้งพร้อมแถลงการณ์ของการประชุม Dot Plot คือมุมมองของกรรมการแต่ละคนว่าดอกเบี้ยควรอยู่ที่เท่าไรเมื่อสิ้นแต่ละปี",
  "The balance sheet is the Fed's total assets, weekly, as of Wednesday. It grows when the Fed buys bonds and shrinks as they run off.":
    "งบดุลคือสินทรัพย์รวมของเฟด รายสัปดาห์ ณ วันพุธ จะขยายเมื่อเฟดซื้อพันธบัตร และหดตัวเมื่อพันธบัตรครบอายุ",
  "Sources: the Federal Reserve and the New York Fed through FRED; the FOMC calendar from the Federal Reserve; odds from Kalshi.":
    "แหล่งข้อมูล: ธนาคารกลางสหรัฐและเฟดนิวยอร์กผ่าน FRED ปฏิทิน FOMC จากธนาคารกลางสหรัฐ โอกาสจาก Kalshi",

  // Employment.
  "No employment figures have been read yet.": "ยังไม่มีตัวเลขการจ้างงาน",
  "Payrolls, {month}": "Nonfarm Payrolls {month}",
  "jobs added on the month · three-month average {avg}":
    "ตำแหน่งงานเพิ่มในเดือนนี้ · ค่าเฉลี่ยสามเดือน {avg}",
  "{month} · Sahm rule {sahm} (a recession signal from 0.50)":
    "{month} · Sahm Rule {sahm} (สัญญาณภาวะถดถอยตั้งแต่ 0.50)",
  "Initial jobless claims": "ผู้ขอรับสวัสดิการว่างงานครั้งแรก",
  "week to {date} · four-week average {avg} · continuing {cont}":
    "สัปดาห์ถึง {date} · ค่าเฉลี่ยสี่สัปดาห์ {avg} · ต่อเนื่อง {cont}",
  "Next jobs report": "รายงานการจ้างงานครั้งถัดไป",
  "Kalshi: payrolls {pay}, unemployment {u}": "Kalshi: Payrolls {pay} อัตราการว่างงาน {u}",
  "Jobs added each month": "ตำแหน่งงานที่เพิ่มขึ้นแต่ละเดือน",
  "Payrolls, change on the month": "Payrolls เปลี่ยนแปลงเทียบเดือนก่อน",
  "Three-month average": "ค่าเฉลี่ยสามเดือน",
  "Nonfarm payrolls, thousands, seasonally adjusted. The latest two months are revised with each report.":
    "Nonfarm Payrolls หน่วยพันตำแหน่ง ปรับฤดูกาลแล้ว สองเดือนล่าสุดจะถูกปรับแก้ทุกครั้งที่ออกรายงาน",
  "The Sahm rule is the three-month average unemployment rate less its low of the past twelve months, in percentage points; every US recession since 1970 began with it at 0.50 or more. A gap is a month with no household survey.":
    "Sahm Rule คืออัตราการว่างงานเฉลี่ยสามเดือนลบด้วยจุดต่ำสุดในสิบสองเดือนที่ผ่านมา หน่วยเป็นจุดเปอร์เซ็นต์ ภาวะถดถอยของสหรัฐทุกครั้งตั้งแต่ปี 1970 เริ่มขึ้นเมื่อค่านี้อยู่ที่ 0.50 ขึ้นไป ช่วงที่ขาดหายคือเดือนที่ไม่มีการสำรวจครัวเรือน",
  "Initial claims": "ขอรับครั้งแรก",
  "Four-week average": "ค่าเฉลี่ยสี่สัปดาห์",
  "Latest figures": "ตัวเลขล่าสุด",
  Latest: "ล่าสุด",
  Context: "บริบท",
  "Average hourly earnings": "ค่าจ้างเฉลี่ยรายชั่วโมง",
  "{month}, year on year · {mom} on the month": "{month} เทียบปีก่อน · {mom} เทียบเดือนก่อน",
  "Job openings": "ตำแหน่งงานว่าง",
  "{month} · {before} a year earlier": "{month} · ปีก่อนหน้า {before}",
  "Continuing claims": "ขอรับต่อเนื่อง",
  "week to {date}": "สัปดาห์ถึง {date}",
  Payrolls: "Nonfarm Payrolls",
  "Payrolls and the unemployment rate come from the Bureau of Labor Statistics' monthly jobs report, usually the first Friday of the month: payrolls from a survey of employers, unemployment from a survey of households. Jobless claims are the Labor Department's weekly count of new filings for unemployment insurance, the most timely read on layoffs.":
    "Nonfarm Payrolls และอัตราการว่างงานมาจากรายงานการจ้างงานรายเดือนของสำนักงานสถิติแรงงานสหรัฐ (BLS) ซึ่งมักออกวันศุกร์แรกของเดือน: Payrolls จากการสำรวจนายจ้าง อัตราการว่างงานจากการสำรวจครัวเรือน ผู้ขอรับสวัสดิการว่างงานคือยอดยื่นขอประกันการว่างงานรายใหม่รายสัปดาห์ของกระทรวงแรงงาน ซึ่งเป็นตัวเลขที่สะท้อนการเลิกจ้างได้เร็วที่สุด",
  "Job openings are from the JOLTS survey, a month behind the jobs report. Average hourly earnings are private employers' pay, a gauge of wage inflation.":
    "ตำแหน่งงานว่างมาจากการสำรวจ JOLTS ซึ่งช้ากว่ารายงานการจ้างงานหนึ่งเดือน ค่าจ้างเฉลี่ยรายชั่วโมงคือค่าจ้างของนายจ้างภาคเอกชน ใช้วัดเงินเฟ้อด้านค่าจ้าง",
  "The odds are Kalshi's contracts on the next report's payrolls and unemployment rate; the middle estimate is where the chance of above crosses one half.":
    "โอกาสมาจากสัญญาของ Kalshi บน Payrolls และอัตราการว่างงานของรายงานครั้งถัดไป ค่าประมาณกลางคือจุดที่โอกาสของ “สูงกว่า” ข้ามครึ่งหนึ่ง",
  "Sources: BLS and the Labor Department through FRED; odds from Kalshi.":
    "แหล่งข้อมูล: BLS และกระทรวงแรงงานสหรัฐผ่าน FRED โอกาสจาก Kalshi",

  // Growth.
  "No growth figures have been read yet.": "ยังไม่มีตัวเลขการเติบโต",
  "Real GDP, {quarter}": "GDP ที่แท้จริง {quarter}",
  "on the quarter, annualized · recession probability {p}":
    "เทียบไตรมาสก่อน คิดเป็นรายปี · โอกาสเกิดภาวะถดถอย {p}",
  "GDPNow, {quarter}": "GDPNow {quarter}",
  "the Atlanta Fed's running estimate of the quarter not yet published":
    "ค่าประมาณต่อเนื่องของเฟดแอตแลนตาสำหรับไตรมาสที่ยังไม่ประกาศ",
  "Next GDP estimate": "ตัวเลข GDP ครั้งถัดไป",
  "Kalshi: {value} for {quarter}": "Kalshi: {value} สำหรับ {quarter}",
  "Real GDP growth, annualized": "การเติบโตของ GDP ที่แท้จริง คิดเป็นรายปี",
  "Real GDP": "GDP ที่แท้จริง",
  "GDPNow estimate": "ค่าประมาณ GDPNow",
  "Quarter on quarter at an annual rate, as the Bureau of Economic Analysis publishes it; the latest figure is revised twice.":
    "เทียบไตรมาสก่อนแบบคิดเป็นอัตรารายปี ตามที่สำนักงานวิเคราะห์เศรษฐกิจสหรัฐประกาศ ตัวเลขล่าสุดจะถูกปรับแก้สองครั้ง",
  "Activity, year on year": "กิจกรรมเศรษฐกิจ เทียบปีก่อน",
  "Retail sales are in dollars, so they include price rises; industrial production is a volume index.":
    "ยอดค้าปลีกเป็นหน่วยดอลลาร์ จึงรวมการขึ้นของราคา ส่วนการผลิตภาคอุตสาหกรรมเป็นดัชนีปริมาณ",
  "Real GDP is the Bureau of Economic Analysis' measure of the economy's output after inflation, quarter on quarter at an annual rate. Each quarter is first estimated about a month after it ends and revised twice.":
    "GDP ที่แท้จริงคือผลผลิตทางเศรษฐกิจหลังหักเงินเฟ้อที่สำนักงานวิเคราะห์เศรษฐกิจสหรัฐ (BEA) วัด เทียบไตรมาสก่อนแบบคิดเป็นอัตรารายปี แต่ละไตรมาสมีการประมาณครั้งแรกราวหนึ่งเดือนหลังสิ้นไตรมาส และปรับแก้อีกสองครั้ง",
  "GDPNow is the Atlanta Fed's model estimate of the quarter not yet published, updated as each month's data come in; it is a model, not a forecast by the Fed.":
    "GDPNow คือค่าประมาณจากแบบจำลองของเฟดแอตแลนตาสำหรับไตรมาสที่ยังไม่ประกาศ อัปเดตเมื่อข้อมูลแต่ละเดือนเข้ามา เป็นแบบจำลอง ไม่ใช่การคาดการณ์ของเฟด",
  "Industrial production (the Fed's index of factory, mining and utility output) and retail sales (the Census Bureau's) are monthly. The recession probability is the Chauvet and Piger model's, from four monthly indicators, as FRED publishes it.":
    "การผลิตภาคอุตสาหกรรม (ดัชนีผลผลิตโรงงาน เหมืองแร่ และสาธารณูปโภคของเฟด) และยอดค้าปลีก (ของสำนักงานสำมะโนประชากรสหรัฐ) เป็นตัวเลขรายเดือน โอกาสเกิดภาวะถดถอยมาจากแบบจำลองของ Chauvet และ Piger ซึ่งใช้ตัวชี้วัดรายเดือนสี่ตัว ตามที่ FRED เผยแพร่",
  "The odds are Kalshi's contracts on the next GDP estimate.":
    "โอกาสมาจากสัญญาของ Kalshi บนตัวเลข GDP ครั้งถัดไป",
  "Sources: BEA, the Federal Reserve, the Census Bureau and the Atlanta Fed through FRED; odds from Kalshi.":
    "แหล่งข้อมูล: BEA ธนาคารกลางสหรัฐ สำนักงานสำมะโนประชากรสหรัฐ และเฟดแอตแลนตาผ่าน FRED โอกาสจาก Kalshi",

  // Policy signals.
  "No market signals have been read yet.": "ยังไม่มีสัญญาณตลาด",
  "2-year yield less fed funds": "Yield 2 ปี ลบ Fed Funds",
  "2-year {two} above the effective rate: the market prices rates higher over two years":
    "2 ปี {two} สูงกว่าอัตราจริง: ตลาดคาดว่าดอกเบี้ยจะสูงขึ้นในสองปี",
  "2-year {two} below the effective rate: the market prices cuts over two years":
    "2 ปี {two} ต่ำกว่าอัตราจริง: ตลาดคาดว่าจะมีการลดดอกเบี้ยในสองปี",
  "Yield curve, 10-year less 2-year": "Yield Curve 10 ปี ลบ 2 ปี",
  "10-year less 3-month {s} · below zero the curve is inverted":
    "10 ปี ลบ 3 เดือน {s} · ต่ำกว่าศูนย์คือ Yield Curve หัวกลับ",
  "10-year real yield": "Real Yield 10 ปี",
  "inflation-protected Treasury · nominal 10-year {ten}":
    "พันธบัตรสหรัฐป้องกันเงินเฟ้อ · Yield ปกติ 10 ปี {ten}",
  "Net liquidity": "สภาพคล่องสุทธิ",
  "Fed assets less the Treasury's account and reverse repos":
    "สินทรัพย์เฟด ลบบัญชีกระทรวงการคลังและ Reverse Repo",
  "{change} over four weeks · Fed assets less the Treasury's account and reverse repos":
    "{change} ในสี่สัปดาห์ · สินทรัพย์เฟด ลบบัญชีกระทรวงการคลังและ Reverse Repo",
  "Treasury yields": "Yield พันธบัตรสหรัฐ",
  "3-month": "3 เดือน",
  "2-year": "2 ปี",
  "10-year": "10 ปี",
  "30-year": "30 ปี",
  "Yield curve": "Yield Curve",
  "10-year less 2-year": "10 ปี ลบ 2 ปี",
  "10-year less 3-month": "10 ปี ลบ 3 เดือน",
  "An inverted curve, long yields below short ones, has come before every US recession since the 1970s, often by a year or more; the turn back above zero has often come closer to it.":
    "Yield Curve หัวกลับ ซึ่ง Yield ระยะยาวต่ำกว่าระยะสั้น เกิดขึ้นก่อนภาวะถดถอยของสหรัฐทุกครั้งตั้งแต่ทศวรรษ 1970 มักล่วงหน้าหนึ่งปีหรือมากกว่า และการกลับขึ้นเหนือศูนย์มักเกิดใกล้ภาวะถดถอยมากกว่า",
  "The Fed's total assets less the Treasury General Account and the overnight reverse repo facility: a rough count of the dollars the Fed's balance sheet leaves in the market, which many crypto traders watch against prices.":
    "สินทรัพย์รวมของเฟดลบด้วยบัญชี Treasury General Account และ Reverse Repo ข้ามคืน: ตัวเลขคร่าว ๆ ของดอลลาร์ที่งบดุลเฟดปล่อยไว้ในตลาด ซึ่งเทรดเดอร์คริปโตจำนวนมากจับตาเทียบกับราคา",
  "Other signals": "สัญญาณอื่น ๆ",
  "4 weeks": "4 สัปดาห์",
  "1 year": "1 ปี",
  Reading: "ความหมาย",
  "Dollar, broad index": "ดอลลาร์ ดัชนีกว้าง",
  "the Fed's trade-weighted dollar; a rising dollar tightens conditions worldwide":
    "ดอลลาร์ถ่วงน้ำหนักตามการค้าของเฟด ดอลลาร์ที่แข็งขึ้นทำให้ภาวะการเงินทั่วโลกตึงตัว",
  "Financial conditions (NFCI)": "ภาวะการเงิน (NFCI)",
  "below zero: looser than average": "ต่ำกว่าศูนย์: ผ่อนคลายกว่าค่าเฉลี่ย",
  "above zero: tighter than average": "สูงกว่าศูนย์: ตึงตัวกว่าค่าเฉลี่ย",
  "Money supply (M2)": "ปริมาณเงิน (M2)",
  "{month}, year on year": "{month} เทียบปีก่อน",
  "What the bond market says about policy before the Fed does. The 2-year Treasury yield tracks where traders expect the policy rate over the next two years: well above the effective rate, they expect it higher; well below, they expect cuts.":
    "สิ่งที่ตลาดพันธบัตรบอกเกี่ยวกับนโยบายก่อนเฟดจะพูด Yield พันธบัตรสหรัฐ 2 ปีสะท้อนระดับดอกเบี้ยนโยบายที่เทรดเดอร์คาดไว้ในสองปีข้างหน้า: หากสูงกว่าอัตราจริงมาก แปลว่าคาดว่าจะขึ้น หากต่ำกว่ามาก แปลว่าคาดว่าจะลด",
  "The yield curve is the 10-year yield less the 2-year, and less the 3-month bill. Real yields are inflation-protected Treasuries' (TIPS); a high real yield is a high cost of holding assets that pay nothing, crypto among them.":
    "Yield Curve คือ Yield 10 ปีลบด้วย Yield 2 ปี และลบด้วยตั๋วเงินคลัง 3 เดือน Real Yield มาจากพันธบัตรสหรัฐป้องกันเงินเฟ้อ (TIPS) Real Yield ที่สูงหมายถึงต้นทุนสูงในการถือสินทรัพย์ที่ไม่ให้ผลตอบแทน ซึ่งรวมถึงคริปโต",
  "Net liquidity is the Fed's balance sheet less the Treasury's cash at the Fed and the reverse repo facility, worked out here from the weekly figures; it is a rule of thumb, not an official measure. The NFCI is the Chicago Fed's index of financial conditions, zero at its long-run average.":
    "สภาพคล่องสุทธิคืองบดุลเฟดลบด้วยเงินสดของกระทรวงการคลังที่ฝากไว้กับเฟดและ Reverse Repo คำนวณที่นี่จากตัวเลขรายสัปดาห์ เป็นหลักคิดคร่าว ๆ ไม่ใช่ตัวชี้วัดทางการ NFCI คือดัชนีภาวะการเงินของเฟดชิคาโก มีค่าศูนย์ที่ค่าเฉลี่ยระยะยาว",
  "Sources: Treasury yields, the Federal Reserve and the Chicago Fed through FRED.":
    "แหล่งข้อมูล: Yield พันธบัตรสหรัฐ ธนาคารกลางสหรัฐ และเฟดชิคาโกผ่าน FRED",

  // Positioning and flows: the futures markets.
  "Bitcoin (CME)": "Bitcoin (CME)",
  "Ether (CME)": "Ether (CME)",
  "S&P 500 E-mini": "S&P 500 E-mini",
  "Nasdaq-100 E-mini": "Nasdaq-100 E-mini",
  "Russell 2000 E-mini": "Russell 2000 E-mini",
  "VIX futures": "VIX Futures",
  "2-year Treasury note": "พันธบัตรสหรัฐ 2 ปี",
  "10-year Treasury note": "พันธบัตรสหรัฐ 10 ปี",
  "Treasury bond": "พันธบัตรสหรัฐระยะยาว",
  "3-month SOFR": "SOFR 3 เดือน",
  "30-day fed funds": "Fed Funds 30 วัน",
  "US dollar index": "ดัชนีดอลลาร์สหรัฐ (DXY)",
  Euro: "ยูโร",
  "Japanese yen": "เยนญี่ปุ่น",
  Gold: "ทองคำ",
  Silver: "เงิน",
  "WTI crude oil": "น้ำมันดิบ WTI",
  Copper: "ทองแดง",

  // Positioning and flows: the tables, tiles and charts.
  "Leveraged funds": "กองทุนเลเวอเรจ",
  "Asset managers": "ผู้จัดการสินทรัพย์",
  Dealers: "ดีลเลอร์",
  "Managed money": "Managed Money",
  "Producers and merchants": "ผู้ผลิตและผู้ค้า",
  "Swap dealers": "Swap Dealer",
  "Financial futures: who holds them": "Futures การเงิน: ใครถืออยู่",
  "Commodity futures: who holds them": "Futures สินค้าโภคภัณฑ์: ใครถืออยู่",
  "{group}, net": "{group} สุทธิ",
  Week: "สัปดาห์",
  "Where this week's net sits among the last three years' weeks: 0% the shortest, 100% the longest":
    "สถานะสุทธิสัปดาห์นี้อยู่ตรงไหนเมื่อเทียบกับทุกสัปดาห์ในสามปีที่ผ่านมา: 0% Short มากที่สุด 100% Long มากที่สุด",
  "3-year rank": "อันดับ 3 ปี",
  "3 years": "3 ปี",
  "No positioning data has been read yet.": "ยังไม่มีข้อมูลสถานะ",
  "contracts net, {share} of open interest · 3-year rank {rank} · {other} {otherNet}":
    "สัญญาสุทธิ {share} ของ Open Interest · อันดับ 3 ปี {rank} · {other} {otherNet}",
  "Stablecoin supply": "อุปทาน Stablecoin",
  "{d30} in 30 days · {d90} in 90 days": "{d30} ใน 30 วัน · {d90} ใน 90 วัน",
  "CME Bitcoin, leveraged funds": "Bitcoin CME กองทุนเลเวอเรจ",
  "asset managers": "ผู้จัดการสินทรัพย์",
  "CME Ether, leveraged funds": "Ether CME กองทุนเลเวอเรจ",
  "Gold, managed money": "ทองคำ Managed Money",
  producers: "ผู้ผลิต",
  "Who holds CME Bitcoin futures": "ใครถือ Bitcoin Futures ของ CME",
  "Net contracts (longs less shorts) of five bitcoin each, as of each Tuesday. Leveraged funds are hedge funds and trading firms; much of their short is the futures leg of a cash-and-carry trade against spot ETFs, not a bet on a fall.":
    "สัญญาสุทธิ (Long ลบ Short) สัญญาละห้าบิตคอยน์ ณ ทุกวันอังคาร กองทุนเลเวอเรจคือเฮดจ์ฟันด์และบริษัทเทรด Short ส่วนใหญ่ของพวกเขาคือขา Futures ของการเทรด Cash-and-Carry ที่จับคู่กับ Spot ETF ไม่ใช่การเดิมพันว่าราคาจะลง",
  "Dollar stablecoins in circulation": "Stablecoin ดอลลาร์ที่หมุนเวียน",
  "Every dollar-pegged stablecoin's supply, added up by DefiLlama: dollars already on-chain, the first money to reach crypto prices.":
    "อุปทานของ Stablecoin ที่ผูกกับดอลลาร์ทุกตัว รวมโดย DefiLlama: ดอลลาร์ที่อยู่บนเชนแล้ว ซึ่งเป็นเงินก้อนแรกที่ไปถึงราคาคริปโต",
  "Who actually holds the futures, from the CFTC's weekly Commitments of Traders: positions as of Tuesday, published the Friday after. For financial futures the CFTC splits traders into dealers (the banks that make markets), asset managers (pension funds, insurers, mutual funds: slower, real money) and leveraged funds (hedge funds and trading firms: faster, speculative). For commodities it splits producers and merchants (hedgers), swap dealers and managed money (the speculators).":
    "ใครถือ Futures อยู่จริง จากรายงาน Commitments of Traders (COT) รายสัปดาห์ของ CFTC: สถานะ ณ วันอังคาร เผยแพร่วันศุกร์ถัดมา สำหรับ Futures การเงิน CFTC แบ่งเทรดเดอร์เป็นดีลเลอร์ (ธนาคารที่ทำตลาด) ผู้จัดการสินทรัพย์ (กองทุนบำนาญ บริษัทประกัน กองทุนรวม: ช้ากว่า เป็นเงินจริง) และกองทุนเลเวอเรจ (เฮดจ์ฟันด์และบริษัทเทรด: เร็วกว่า เก็งกำไร) สำหรับสินค้าโภคภัณฑ์แบ่งเป็นผู้ผลิตและผู้ค้า (ผู้ป้องกันความเสี่ยง) Swap Dealer และ Managed Money (นักเก็งกำไร)",
  "Net is longs less shorts, in contracts; its share is of the market's open interest. The 3-year rank says where this week's net sits among every week of the last three years: near 0% the speculators are as short as they have been, near 100% as long, which is when positioning tends to unwind.":
    "สุทธิคือ Long ลบ Short หน่วยเป็นสัญญา สัดส่วนคิดจาก Open Interest ของตลาด อันดับ 3 ปีบอกว่าสถานะสุทธิสัปดาห์นี้อยู่ตรงไหนเมื่อเทียบกับทุกสัปดาห์ในสามปีที่ผ่านมา: ใกล้ 0% นักเก็งกำไร Short มากที่สุดเท่าที่เคย ใกล้ 100% Long มากที่สุด ซึ่งเป็นช่วงที่สถานะมักถูกคลายออก",
  "Stablecoin supply is the dollars already on-chain, from DefiLlama: when it grows, new money is arriving in crypto.":
    "อุปทาน Stablecoin คือดอลลาร์ที่อยู่บนเชนแล้ว จาก DefiLlama: เมื่อเพิ่มขึ้น แปลว่ามีเงินใหม่ไหลเข้าคริปโต",
  "Sources: the CFTC's Commitments of Traders, futures only{date}; DefiLlama for stablecoins.":
    "แหล่งข้อมูล: Commitments of Traders ของ CFTC เฉพาะ Futures{date} DefiLlama สำหรับ Stablecoin",
  ", report of {date}": " รายงานวันที่ {date}",
  "The macro data could not be read right now.": "ตอนนี้อ่านข้อมูลเศรษฐกิจมหภาคไม่ได้",

  // Chart readout (slot-chart.ts).
  "week of {month} {day}, {year}": "สัปดาห์วันที่ {day} {month} {year}",
  // The Rates page's prediction-market tabs (web/crowd.ts).
  "1d": "1 วัน",
  "1d change": "เปลี่ยน 1 วัน",
  "7d": "7 วัน",
  "Another Fed hike in 2026": "เฟดขึ้นดอกเบี้ยอีกครั้งในปี 2026",
  "BTC odds": "โอกาส BTC",
  "BTC: crowd vs options": "BTC: ฝูงชน vs ออปชัน",
  "Bitcoin above, {when}": "Bitcoin สูงกว่า {when}",
  "Bitcoin now": "Bitcoin ตอนนี้",
  Chance: "โอกาส",
  "Change in the expected move over the last day": "การเปลี่ยนแปลงของการขยับที่คาดในวันที่ผ่านมา",
  "Deribit index at the option chain's read": "ดัชนี Deribit ณ เวลาที่อ่าน Option Chain",
  "Deribit's option chain: Black-76 with the smile's slope, between the expiries either side":
    "Option Chain ของ Deribit: Black-76 พร้อมความชันของ Smile ระหว่างวันหมดอายุสองฝั่ง",
  "Each FOMC meeting, both venues": "การประชุม FOMC แต่ละครั้ง ทั้งสองแพลตฟอร์ม",
  "Each price is the chance the venue's traders give the outcome, its Yes price; a fed meeting's outcomes are scaled to add up to one. Changes are in percentage points against the price a day and a week before. Polymarket is read every 15 minutes and kept hourly for good; Kalshi's odds are the Fed, Jobs and Growth tabs' own.":
    "แต่ละราคาคือโอกาสที่เทรดเดอร์ของแพลตฟอร์มให้กับผลลัพธ์นั้น ซึ่งก็คือราคาฝั่ง “ใช่” ผลลัพธ์ของการประชุมเฟดถูกปรับสเกลให้รวมกันได้หนึ่ง การเปลี่ยนแปลงเป็นจุดเปอร์เซ็นต์เทียบกับราคาเมื่อหนึ่งวันและหนึ่งสัปดาห์ก่อน Polymarket อ่านทุก 15 นาทีและเก็บรายชั่วโมงไว้ถาวร โอกาสของ Kalshi เป็นชุดเดียวกับในแท็บเฟด ตลาดแรงงาน และการเติบโต",
  "Fed cuts in 2026": "เฟดลดดอกเบี้ยในปี 2026",
  "Fed rate at the end of 2026": "ดอกเบี้ยเฟด ณ สิ้นปี 2026",
  "GDP growth, the quarter": "การเติบโตของ GDP ไตรมาสนี้",
  Gap: "ส่วนต่าง",
  "How high US unemployment goes in 2026": "อัตราการว่างงานสหรัฐจะขึ้นสูงแค่ไหนในปี 2026",
  "How high inflation gets in 2026": "เงินเฟ้อจะขึ้นสูงแค่ไหนในปี 2026",
  "How many Fed cuts in 2026": "เฟดจะลดดอกเบี้ยกี่ครั้งในปี 2026",
  "Kalshi median": "มัธยฐาน Kalshi",
  "Next settlement": "ตัดสินผลครั้งถัดไป",
  "No Bitcoin ladder has been read yet. The collector reads Polymarket every 15 minutes.":
    "ยังไม่มีชุดราคา Bitcoin ระบบอ่าน Polymarket ทุก 15 นาที",
  "No prediction market has been read yet. The collector reads Polymarket every 15 minutes.":
    "ยังไม่มีข้อมูลตลาดทำนายผล ระบบอ่าน Polymarket ทุก 15 นาที",
  "Percentage points over the last day": "จุดเปอร์เซ็นต์ในวันที่ผ่านมา",
  "Percentage points over the last week": "จุดเปอร์เซ็นต์ในสัปดาห์ที่ผ่านมา",
  "Polymarket less options, in percentage points": "Polymarket ลบออปชัน หน่วยจุดเปอร์เซ็นต์",
  "Polymarket median": "มัธยฐาน Polymarket",
  "Polymarket's change over the last day, in percentage points":
    "การเปลี่ยนแปลงของ Polymarket ในวันที่ผ่านมา หน่วยจุดเปอร์เซ็นต์",
  "Polymarket's ladders settle on Binance's BTC/USDT one-minute close at noon New York. The options column is what Deribit's latest BTC chain implies for the same price and moment: each strike's volatility from the smile, the chance of finishing above it with the smile's slope counted, the total variance read between the expiries either side. A positive gap means Polymarket's crowd gives the price better odds than the options do. Smart $ is what the smart wallets (the leaderboard's most profitable, as on the Prediction markets tab) hold on Yes less what they hold on No.":
    "ชุดราคาของ Polymarket ตัดสินผลด้วยราคาปิดแท่ง 1 นาทีของ BTC/USDT บน Binance ตอนเที่ยงตามเวลานิวยอร์ก คอลัมน์ออปชันคือสิ่งที่ Option Chain BTC ล่าสุดของ Deribit บ่งชี้สำหรับราคาและเวลาเดียวกัน: ความผันผวนของแต่ละ Strike จาก Smile โอกาสที่จะปิดเหนือ Strike โดยนับความชันของ Smile และความแปรปรวนรวมที่อ่านระหว่างวันหมดอายุสองฝั่ง ส่วนต่างที่เป็นบวกแปลว่าฝูงชนบน Polymarket ให้โอกาสกับราคานั้นมากกว่าออปชัน Smart $ คือเงินที่ Smart Wallet (ผู้ทำกำไรสูงสุดในกระดานผู้นำ เหมือนในแท็บตลาดทำนายผล) ถือฝั่ง “ใช่” ลบด้วยที่ถือฝั่ง “ไม่ใช่”",
  "Polymarket's median outcome": "ผลลัพธ์มัธยฐานของ Polymarket",
  "Prediction markets": "ตลาดทำนายผล",
  Predictions: "การทำนาย",
  Print: "ตัวเลขที่ประกาศ",
  Settles: "ตัดสินผล",
  "The Fed rate at the end of 2026": "ดอกเบี้ยเฟด ณ สิ้นปี 2026",
  "The next prints, both venues": "ตัวเลขครั้งถัดไป ทั้งสองแพลตฟอร์ม",
  "The outcome bucket where Polymarket's chances, in order, pass one half":
    "ช่วงผลลัพธ์ที่โอกาสสะสมของ Polymarket ตามลำดับเกินครึ่งหนึ่ง",
  "The prediction markets could not be read right now.": "ตอนนี้อ่านข้อมูลตลาดทำนายผลไม่ได้",
  "The year ahead, on Polymarket": "ปีข้างหน้าบน Polymarket",
  "US GDP growth in 2026": "การเติบโตของ GDP สหรัฐในปี 2026",
  "US recession": "ภาวะถดถอยของสหรัฐ",
  "Where Kalshi's ladder of above-X chances crosses one half":
    "จุดที่ชุดโอกาส “สูงกว่า X” ของ Kalshi ข้ามครึ่งหนึ่ง",
  "Widest gap": "ส่วนต่างกว้างสุด",
  "above {price} on {date}: the crowd is {side} than the options":
    "สูงกว่า {price} วันที่ {date}: ฝูงชน{side}กว่าออปชัน",
  bp: "bp",
  "by the end of each year": "ภายในสิ้นแต่ละปี",
  "crowd median {crowd} · options median {options}": "มัธยฐานฝูงชน {crowd} · มัธยฐานออปชัน {options}",
  "more bearish": "มองลงมาก",
  "more bullish": "มองขึ้นมาก",
  "no option chain read yet": "ยังไม่มี Option Chain",
  "noon New York": "เที่ยงเวลานิวยอร์ก",
  "{change} pp over a week": "{change} pp ในหนึ่งสัปดาห์",
  "{n} more outcomes under 1%": "อีก {n} ผลลัพธ์ที่ต่ำกว่า 1%",
  "Change in the smart share over the last day, in percentage points":
    "การเปลี่ยนแปลงของสัดส่วน Smart ในวันที่ผ่านมา หน่วยจุดเปอร์เซ็นต์",
  Crowd: "ฝูงชน",
  "Fed, {meeting}": "เฟด {meeting}",
  No: "ไม่ใช่",
  Question: "คำถาม",
  "Share of smart $": "สัดส่วน Smart $",
  "Smart $": "Smart $",
  "Smart money backs": "Smart Money เลือก",
  "Smart money is the {n} wallets with the most profit on Polymarket's own leaderboard in Economics and in Crypto, over the past month or all time. Each market's top 100 holders per outcome are read every hour; a smart wallet holding less than that is not seen. Where smart money and the crowd's price part, one side is wrong, and the smart side has the better record.":
    "Smart Money คือ {n} วอลเล็ตที่ทำกำไรสูงสุดบนกระดานผู้นำของ Polymarket เองในหมวดเศรษฐกิจและคริปโต ในเดือนที่ผ่านมาหรือตลอดกาล ผู้ถือ 100 อันดับแรกต่อผลลัพธ์ของแต่ละตลาดถูกอ่านทุกชั่วโมง Smart Wallet ที่ถือน้อยกว่านั้นจะมองไม่เห็น เมื่อ Smart Money กับราคาของฝูงชนแยกทางกัน ฝั่งหนึ่งต้องผิด และฝั่ง Smart มีสถิติดีกว่า",
  "Smart money on Polymarket": "Smart Money บน Polymarket",
  "That outcome's share of the smart wallets' dollars on the question":
    "สัดส่วนของผลลัพธ์นั้นในเงินดอลลาร์ของ Smart Wallet บนคำถามนี้",
  "The crowd's price for that outcome": "ราคาของฝูงชนสำหรับผลลัพธ์นั้น",
  "The smart wallets' dollars on Yes less their dollars on No":
    "เงินดอลลาร์ของ Smart Wallet ฝั่ง “ใช่” ลบด้วยฝั่ง “ไม่ใช่”",
  Wallets: "วอลเล็ต",
  Yes: "ใช่",
  // World indexes tab (web/indexes.ts)
  Country: "ประเทศ",
  "World indexes": "ดัชนีโลก",
  Indexes: "ดัชนี",
  India: "อินเดีย",
  Japan: "ญี่ปุ่น",
  Korea: "เกาหลีใต้",
  Singapore: "สิงคโปร์",
  Australia: "ออสเตรเลีย",
  Americas: "ทวีปอเมริกา",
  "Middle East": "ตะวันออกกลาง",
  Canada: "แคนาดา",
  Brazil: "บราซิล",
  Mexico: "เม็กซิโก",
  Germany: "เยอรมนี",
  "United Kingdom": "สหราชอาณาจักร",
  France: "ฝรั่งเศส",
  "Euro area": "ยูโรโซน",
  Netherlands: "เนเธอร์แลนด์",
  Spain: "สเปน",
  Italy: "อิตาลี",
  Switzerland: "สวิตเซอร์แลนด์",
  Portugal: "โปรตุเกส",
  Belgium: "เบลเยียม",
  Austria: "ออสเตรีย",
  Sweden: "สวีเดน",
  Denmark: "เดนมาร์ก",
  Poland: "โปแลนด์",
  Turkey: "ตุรกี",
  Israel: "อิสราเอล",
  "Saudi Arabia": "ซาอุดีอาระเบีย",
  "Hong Kong": "ฮ่องกง",
  China: "จีน",
  Taiwan: "ไต้หวัน",
  Thailand: "ไทย",
  Indonesia: "อินโดนีเซีย",
  Philippines: "ฟิลิปปินส์",
  Malaysia: "มาเลเซีย",
  Vietnam: "เวียดนาม",
  Other: "อื่น ๆ",
  "{n} daily closes, {change}%": "ราคาปิดรายวัน {n} วัน {change}%",
  "Its option book on the Gamma Exposure tab": "Option Book ของดัชนีนี้ในแท็บ Gamma Exposure",
  live: "สด",
  closing: "ปิดตลาด",
  "The index levels could not be read right now.": "ตอนนี้อ่านระดับดัชนีไม่ได้",
  "No index level has been read yet. The collector reads them every five minutes.":
    "ยังไม่มีระดับดัชนี ระบบอ่านทุกห้านาที",
  "Stock index levels across the Americas, Europe, the Middle East and Asia-Pacific: the day's change against the previous close, the day's range, and a month of daily closes.":
    "ระดับดัชนีหุ้นทั่วทวีปอเมริกา ยุโรป ตะวันออกกลาง และเอเชียแปซิฟิก: การเปลี่ยนแปลงของวันเทียบราคาปิดก่อนหน้า ช่วงราคาของวัน และราคาปิดรายวันหนึ่งเดือน",
  Index: "ดัชนี",
  Level: "ระดับ",
  Change: "การเปลี่ยนแปลง",
  "Day range": "ช่วงราคาของวัน",
  "India's Nifty indexes, Nifty Bank and India VIX are NSE's daily closing file, read once each evening. The rest are read every five minutes: KOSPI and KOSPI 200 from the Korea Exchange, the Nikkei 225, TOPIX, Straits Times and S&P/ASX 200 from Sina's quotes, and the other indexes from quotes delayed by up to 20 minutes; a market that has closed shows its close.":
    "ดัชนี Nifty ของอินเดีย Nifty Bank และ India VIX มาจากไฟล์ราคาปิดรายวันของ NSE อ่านวันละครั้งทุกเย็น ที่เหลืออ่านทุกห้านาที: KOSPI และ KOSPI 200 จาก Korea Exchange ส่วน Nikkei 225 TOPIX Straits Times และ S&P/ASX 200 จากราคาของ Sina และดัชนีอื่น ๆ จากราคาที่ล่าช้าสูงสุด 20 นาที ตลาดที่ปิดแล้วแสดงราคาปิด",
  // An index's page (web/index-page.ts)
  "No index {ticker}.": "ไม่พบดัชนี {ticker}",
  "the Korea Exchange's own index charts, every five minutes":
    "กราฟดัชนีของ Korea Exchange เอง ทุกห้านาที",
  "Sina's quote feed, every five minutes": "ฟีดราคาของ Sina ทุกห้านาที",
  "NSE's daily closing file, read once each evening": "ไฟล์ราคาปิดรายวันของ NSE อ่านวันละครั้งทุกเย็น",
  "TradingView's quotes, up to 20 minutes behind, every five minutes":
    "ราคาของ TradingView ล่าช้าสูงสุด 20 นาที ทุกห้านาที",
  "Yahoo Finance's quotes, every five minutes": "ราคาของ Yahoo Finance ทุกห้านาที",
  "Hover or tap the chart to read a point.": "ชี้หรือแตะกราฟเพื่ออ่านค่าแต่ละจุด",
  "from {prev}": "จาก {prev}",
  "Daily closes": "ราคาปิดรายวัน",
  "The last 36 hours": "36 ชั่วโมงล่าสุด",
  "The collector has kept this index since {date}: {n} daily closes so far. The chart fills in a close a day.":
    "ระบบเก็บดัชนีนี้ตั้งแต่ {date}: ตอนนี้มีราคาปิดรายวัน {n} วัน กราฟจะเพิ่มวันละหนึ่งราคาปิด",
  "No close kept yet.": "ยังไม่มีราคาปิดที่เก็บไว้",
  "Perpetuals on it: {base}": "สัญญา Perpetual บนดัชนีนี้: {base}",
  "{n} markets, {oi} open interest": "{n} ตลาด Open Interest {oi}",
  "Its chart and order flow (CVD)": "กราฟและ Order Flow (CVD) ของดัชนีนี้",
  "Its liquidations": "การล้างพอร์ตของดัชนีนี้",
  "Its option book: gamma exposure, Greeks and IV walls":
    "Option Book ของดัชนีนี้: Gamma Exposure, Greeks และกำแพง IV",
  "Every index on the World indexes tab": "ทุกดัชนีในแท็บดัชนีโลก",
  "{name} index level": "ระดับดัชนี {name}",
  "{name}: the level now, the day's change and range, and the daily closes kept since the site began reading it.":
    "{name}: ระดับตอนนี้ การเปลี่ยนแปลงและช่วงราคาของวัน และราคาปิดรายวันที่เก็บไว้ตั้งแต่เว็บไซต์เริ่มอ่าน",
  "On this site": "ในเว็บไซต์นี้",
  "The level is from {source}.": "ระดับดัชนีมาจาก{source}",
  "A close is the session's last level; a market that is shut shows its close until it opens again. Daily closes are each UTC day's last level.":
    "ราคาปิดคือระดับสุดท้ายของรอบการซื้อขาย ตลาดที่ปิดอยู่จะแสดงราคาปิดจนกว่าจะเปิดอีกครั้ง ราคาปิดรายวันคือระดับสุดท้ายของแต่ละวันตามเวลา UTC",
  Table: "ตาราง",
  "Return map": "แผนที่ผลตอบแทน",
  "By country": "ตามประเทศ",
  View: "มุมมอง",
  "5 days": "5 วัน",
  "the last 5 sessions": "5 รอบการซื้อขายล่าสุด",
  "the last 21 sessions": "21 รอบการซื้อขายล่าสุด",
  "Europe and the Middle East": "ยุโรปและตะวันออกกลาง",
  "Markets with too little history for this window yet, left out: {n}.":
    "ไม่แสดง {n} ตลาดที่ยังมีประวัติไม่พอสำหรับช่วงเวลานี้",
  "Too little history for this window yet.": "ยังมีประวัติไม่พอสำหรับช่วงเวลานี้",
  "{market} · {name}: {ret} over {span}, {day} in the latest session, {swing} on a typical day":
    "{market} · {name}: {ret} ในช่วง {span} {day} ในรอบล่าสุด {swing} ในวันปกติ",
  "{n} markets, {up} up over {span} · hover or tap a bubble to read it":
    "{n} ตลาด {up} ตลาดขึ้นในช่วง {span} · ชี้หรือแตะวงกลมเพื่ออ่านค่า",
  "Return over {span} against the latest session, one index per market":
    "ผลตอบแทนในช่วง {span} เทียบกับรอบล่าสุด หนึ่งดัชนีต่อตลาด",
  "bubble size: the typical daily move": "ขนาดวงกลม: การขยับรายวันตามปกติ",
  "Markets by return over {span} and the latest session":
    "ตลาดเรียงตามผลตอบแทนในช่วง {span} และรอบล่าสุด",
  "Return over {span}": "ผลตอบแทนในช่วง {span}",
  "Change in the latest session": "การเปลี่ยนแปลงในรอบล่าสุด",
  "{market} over {span}: {list}": "{market} ในช่วง {span}: {list}",
  "{n} markets · hover or tap a row to read it": "{n} ตลาด · ชี้หรือแตะแถวเพื่ออ่านค่า",
  "Each market's indexes by return over {span}: the bar is its first index in the table, a dot each of its others":
    "ดัชนีของแต่ละตลาดเรียงตามผลตอบแทนในช่วง {span}: แท่งคือดัชนีแรกของตลาดนั้นในตาราง จุดคือดัชนีอื่น ๆ แต่ละตัว",
  "other indexes": "ดัชนีอื่น ๆ",
  "Volatility indexes (VIX, India VIX) are left out of the charts: their moves are not returns.":
    "ไม่รวมดัชนีความผันผวน (VIX, India VIX) ในกราฟ: การขยับของดัชนีเหล่านี้ไม่ใช่ผลตอบแทน",
  // The homepage's prediction-market section (web/bets.ts).
  "What the crowd is betting on": "ฝูงชนกำลังเดิมพันอะไร",
  "Prediction markets on Polymarket and Kalshi: the question we pinned, the one with the most money traded over the last 24 hours on either venue, and the next ones, at least three from each venue. Sports are left out, and so are the short questions that repeat every day or week (today's Bitcoin range, tomorrow's weather, a week of tweets).":
    "ตลาดทำนายผลบน Polymarket และ Kalshi: คำถามที่เราปักหมุด คำถามที่มีเงินซื้อขายมากที่สุดใน 24 ชั่วโมงที่ผ่านมาบนทั้งสองแพลตฟอร์ม และคำถามถัดไป อย่างน้อยแพลตฟอร์มละสามคำถาม ไม่รวมกีฬา และไม่รวมคำถามสั้นที่วนซ้ำทุกวันหรือทุกสัปดาห์ (ช่วงราคา Bitcoin วันนี้ อากาศพรุ่งนี้ จำนวนทวีตในหนึ่งสัปดาห์)",
  "A price is the crowd's chance: a Yes share at 9¢ pays $1 if it happens, so the crowd puts it at 9%. Kalshi counts its volume in contracts that pay $1; here it is contracts times their price, the dollars paid, as Polymarket counts it. The charts are each venue's own price history. Read every five minutes.":
    "ราคาคือโอกาสในสายตาฝูงชน: ส่วนแบ่ง Yes ที่ราคา 9¢ จ่าย $1 หากเกิดขึ้นจริง ฝูงชนจึงให้โอกาส 9% Kalshi นับวอลุ่มเป็นจำนวนสัญญาที่จ่าย $1 ในที่นี้คิดเป็นจำนวนสัญญาคูณราคา คือเงินดอลลาร์ที่จ่ายจริง แบบเดียวกับที่ Polymarket นับ กราฟคือประวัติราคาของแต่ละแพลตฟอร์มเอง อ่านทุกห้านาที",
  "The prediction markets could not be read just now.": "ตอนนี้ยังอ่านตลาดทำนายผลไม่ได้",
  "Chance of Yes since {date}": "โอกาสของ Yes ตั้งแต่ {date}",
  "{question}: the chance of each answer over time": "{question}: โอกาสของแต่ละคำตอบตามเวลา",
  "pts in 24h": "จุดใน 24 ชม.",
  "Traded since {date}": "ซื้อขายตั้งแต่ {date}",
  Traded: "ซื้อขายแล้ว",
  "{venue} has {n} more": "อีก {n} คำตอบบน {venue}",
  "The likeliest answer; for a question asked by date, the nearest date; for levels that can all come true, the one closest to even odds":
    "คำตอบที่น่าจะเป็นที่สุด สำหรับคำถามแบบถามวันที่ คือวันที่ใกล้ที่สุด สำหรับระดับที่อาจเป็นจริงพร้อมกันได้ คือระดับที่ใกล้ห้าสิบห้าสิบที่สุด",
  "Leading answer": "คำตอบนำ",
  "Change in the chance over the last 24 hours, in percentage points":
    "การเปลี่ยนแปลงของโอกาสใน 24 ชั่วโมงที่ผ่านมา หน่วยจุดเปอร์เซ็นต์",
  "Pinned until {date}": "ปักหมุดถึง {date}",
  "Most traded in the last 24 hours": "ซื้อขายมากที่สุดใน 24 ชั่วโมงที่ผ่านมา",
  "No open question on Polymarket or Kalshi right now.":
    "ตอนนี้ไม่มีคำถามที่เปิดอยู่บน Polymarket หรือ Kalshi",
  "Prices and volumes from Polymarket and Kalshi, read {time}. A chance is the price of a Yes share; it is what the crowd is paying, not a forecast of ours.":
    "ราคาและวอลุ่มจาก Polymarket และ Kalshi อ่านเมื่อ {time} โอกาสคือราคาของส่วนแบ่ง Yes เป็นสิ่งที่ฝูงชนกำลังจ่าย ไม่ใช่การคาดการณ์ของเรา",
};
