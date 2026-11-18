/**
 * The chart pages and their readouts in Thai: web/cvd.ts, web/kchart.ts, web/sentiment.ts,
 * web/funding-chart.ts and web/slot-chart.ts (web/rail.ts has no words of its own).
 * Glossary and style: ./index.ts.
 *
 * Keys shared with the liquidations part (months, dates, "Window", the hover hints) carry the same
 * translation there, which i18n.test.ts holds.
 */

import type { Catalog } from "../../i18n";

export const charts: Catalog = {
  // Dates on the axes and in the hover readouts; the month names are marked in web/slot-chart.ts.
  Jan: "ม.ค.",
  Feb: "ก.พ.",
  Mar: "มี.ค.",
  Apr: "เม.ย.",
  May: "พ.ค.",
  Jun: "มิ.ย.",
  Jul: "ก.ค.",
  Aug: "ส.ค.",
  Sep: "ก.ย.",
  Oct: "ต.ค.",
  Nov: "พ.ย.",
  Dec: "ธ.ค.",
  "{month} {day}": "{day} {month}",
  "{month} {day} {time} {zone}": "{day} {month} {time} {zone}",

  // web/slot-chart.ts: the hover readouts of the CVD and longs-vs-shorts charts.
  "{low} – {high} ({pct} from the mark)": "{low} – {high} (ห่างจากราคา Mark {pct})",
  "longs liquidate here: {usd} ({n})": "Long ถูกล้างพอร์ตที่นี่: {usd} ({n})",
  "shorts liquidate here: {usd} ({n})": "Short ถูกล้างพอร์ตที่นี่: {usd} ({n})",
  "{n} position": "{n} โพซิชัน",
  "no whale liquidates here": "ไม่มีวาฬถูกล้างพอร์ตที่นี่",
  "{usd} of longs liquidate between here and the mark":
    "Long มูลค่า {usd} ถูกล้างพอร์ตระหว่างจุดนี้ถึงราคา Mark",
  "{usd} of shorts liquidate between the mark and here":
    "Short มูลค่า {usd} ถูกล้างพอร์ตระหว่างราคา Mark ถึงจุดนี้",
  Cursor: "เคอร์เซอร์",
  cursor: "เคอร์เซอร์",
  bar: "แท่ง",
  cross: "เส้นกากบาท",
  "Light up the bar under the pointer": "ไฮไลต์แท่งที่อยู่ใต้ตัวชี้",
  "Dashed crosshair at the pointer, with the value there on each axis":
    "เส้นกากบาทแบบประที่ตัวชี้ พร้อมค่าตรงจุดนั้นบนแต่ละแกน",
  "no flow recorded": "ไม่มีโฟลว์ที่บันทึกไว้",
  "close {price}": "ปิด {price}",
  "close {price} ({pct} since start)": "ปิด {price} ({pct} จากจุดเริ่ม)",
  "bought {usd}": "ซื้อ {usd}",
  "sold {usd}": "ขาย {usd}",
  "net {net}": "สุทธิ {net}",
  "net {net} ({pct} of volume)": "สุทธิ {net} ({pct} ของวอลุ่ม)",
  "nothing force-closed": "ไม่มีการบังคับปิด",
  "longs closed {usd}": "Long ถูกปิด {usd}",
  "shorts closed {usd}": "Short ถูกปิด {usd}",
  "longs − shorts {diff}": "Long − Short {diff}",
  even: "เท่ากัน",
  "longs heavier, {pct}%": "Long หนักกว่า {pct}%",
  "shorts heavier, {pct}%": "Short หนักกว่า {pct}%",
  "{n} liquidation": "ล้างพอร์ต {n} รายการ",
  "{n} liquidations": "ล้างพอร์ต {n} รายการ",
  "{when} (still filling)": "{when} (ยังสะสมอยู่)",

  // web/cvd.ts: the chart.
  "{asset} · cumulative volume delta · {n}-hour bars, {zone}":
    "{asset} · Cumulative Volume Delta · แท่งละ {n} ชม. {zone}",
  "{asset} · cumulative volume delta · {n}-minute bars, {zone}":
    "{asset} · Cumulative Volume Delta · แท่งละ {n} นาที {zone}",
  "{asset} futures taker CVD, last {window}: {cvd}. Market buyers {bought} vs sellers {sold}.":
    "CVD ฝั่ง Taker ของ Futures {asset} {window} ล่าสุด: {cvd} ผู้ซื้อแบบ Market {bought} เทียบผู้ขาย {sold}",
  "{asset}, last {window}: futures CVD {futures}, spot CVD {spot}, delta {delta}.":
    "{asset} {window} ล่าสุด: CVD Futures {futures} CVD Spot {spot} Delta {delta}",
  "Last {window}": "{window} ล่าสุด",
  "Loading {interval} bars…": "กำลังโหลดแท่ง {interval}…",
  "Loading {asset}…": "กำลังโหลด {asset}…",
  "Not available yet: there is not enough history for {interval} bars":
    "ยังไม่พร้อม: ข้อมูลย้อนหลังยังไม่พอสำหรับแท่ง {interval}",
  "Not available yet": "ยังไม่พร้อม",
  Price: "ราคา",
  "Net buy": "ซื้อสุทธิ",
  "Net sell": "ขายสุทธิ",
  "hover or tap a bar to read it": "ชี้หรือแตะแท่งเพื่ออ่านค่า",
  "{asset} bars; arrow keys read one at a time": "แท่งของ {asset} ใช้ปุ่มลูกศรอ่านทีละแท่ง",
  "{asset} price and cumulative volume delta over the last {window}":
    "ราคาและ Cumulative Volume Delta ของ {asset} ในช่วง {window} ล่าสุด",
  "{asset} net taker flow per bar": "โฟลว์ Taker สุทธิของ {asset} ต่อแท่ง",

  // web/cvd.ts: tiles, controls and the screener table.
  Volume: "วอลุ่ม",
  CVD: "CVD",
  "CVD / volume": "CVD / วอลุ่ม",
  Change: "การเปลี่ยนแปลง",
  "CVD breadth": "ความกว้างของ CVD",
  "of {n} assets with net taker buying": "จาก {n} สินทรัพย์ที่ Taker ซื้อสุทธิ",
  "Bullish divergences": "Bullish Divergence",
  "price down ≥{price}%, takers net buying ≥{flow}% of volume":
    "ราคาลง ≥{price}% Taker ซื้อสุทธิ ≥{flow}% ของวอลุ่ม",
  "Bearish divergences": "Bearish Divergence",
  "price up ≥{price}%, takers net selling ≥{flow}% of volume":
    "ราคาขึ้น ≥{price}% Taker ขายสุทธิ ≥{flow}% ของวอลุ่ม",
  "Top CVD flows": "โฟลว์ CVD สูงสุด",
  "largest net buy / net sell": "ซื้อสุทธิ / ขายสุทธิ มากที่สุด",
  Window: "ช่วงเวลา",
  "bullish div": "bullish div",
  "bearish div": "bearish div",
  "Search symbol": "ค้นหาสัญลักษณ์",
  Find: "ค้นหา",
  "Pick an asset to chart": "เลือกสินทรัพย์เพื่อดูกราฟ",
  "{n} assets": "{n} สินทรัพย์",
  "No asset matches.": "ไม่มีสินทรัพย์ที่ตรงกัน",
  "No taker flow has been collected in the last {window}. Collection polls each venue every five minutes; a new deployment backfills about a week within its first hour.":
    "ยังไม่ได้เก็บโฟลว์ Taker ในช่วง {window} ล่าสุด ระบบดึงข้อมูลจากแต่ละกระดานเทรดทุกห้านาที และการ Deploy ใหม่จะเติมข้อมูลย้อนหลังราวหนึ่งสัปดาห์ภายในชั่วโมงแรก",
  Asset: "สินทรัพย์",
  "Reference market's first close to last close in the window":
    "จากราคาปิดแรกถึงราคาปิดสุดท้ายในช่วงเวลา ของตลาดอ้างอิง",
  "Taker buys less taker sells, in dollars, summed over the polled venues":
    "แรงซื้อ Taker ลบแรงขาย Taker เป็นดอลลาร์ รวมทุกกระดานเทรดที่ดึงข้อมูล",
  "CVD as a share of the window's taker volume": "CVD เป็นสัดส่วนของวอลุ่ม Taker ในช่วงเวลา",
  "Taker buys plus taker sells, in dollars": "แรงซื้อ Taker บวกแรงขาย Taker เป็นดอลลาร์",
  "Polled venues with flow for this asset": "กระดานเทรดที่ดึงข้อมูลซึ่งมีโฟลว์ของสินทรัพย์นี้",
  Venues: "กระดานเทรด",
  "Price and flow disagreeing by more than the divergence thresholds in the tiles":
    "ราคากับโฟลว์ไปคนละทางเกินเกณฑ์ Divergence ในการ์ดด้านบน",
  Signal: "สัญญาณ",
  "No live market lists {asset}, so there is no flow to chart.":
    "ไม่มีตลาดที่เปิดอยู่ลิสต์ {asset} จึงไม่มีโฟลว์ให้แสดงกราฟ",
  "Newest bucket {age}.": "ช่วงล่าสุด {age}",
  "The venues that publish statistics release each 5-minute bucket after it closes, so the newest bar holds only the live tapes for a few minutes.":
    "กระดานเทรดที่เผยแพร่สถิติจะปล่อยข้อมูลแต่ละช่วง 5 นาทีหลังช่วงนั้นปิด แท่งล่าสุดจึงมีแค่ข้อมูลเทรดสดอยู่ไม่กี่นาที",

  // web/cvd.ts: the page.
  "taker buys": "แรงซื้อ Taker",
  "taker sells": "แรงขาย Taker",
  "The asset button beside the intervals opens the screener: every polled asset's taker flow over the window. Pick one to chart it, find a ticker in its box, or sort by a heading. Change is the busiest polled market's first to last close in the window. History is uneven by venue: Binance, Aster, Gate and Bitget publish weeks of it and OKX five days, while every other venue, spot books other than Binance's included, is counted from its live trades since 28 October 2026, so older bars sum fewer venues.":
    "ปุ่มสินทรัพย์ข้างช่วงแท่งจะเปิดสกรีนเนอร์: โฟลว์ Taker ของทุกสินทรัพย์ที่ดึงข้อมูลในช่วงเวลานั้น เลือกตัวหนึ่งเพื่อดูกราฟ ค้นหา Ticker ในช่องค้นหา หรือเรียงตามหัวคอลัมน์ การเปลี่ยนแปลงคือราคาปิดแรกถึงราคาปิดสุดท้ายในช่วงเวลา ของตลาดที่คึกคักที่สุดที่ดึงข้อมูล ข้อมูลย้อนหลังแต่ละกระดานเทรดยาวไม่เท่ากัน: Binance, Aster, Gate และ Bitget มีหลายสัปดาห์ OKX มีห้าวัน ส่วนกระดานเทรดอื่นทั้งหมด รวมถึงตลาด Spot ที่ไม่ใช่ของ Binance นับจากการเทรดสดตั้งแต่ 28 ตุลาคม 2026 แท่งที่เก่ากว่าจึงรวมกระดานเทรดน้อยกว่า",

  // web/funding-chart.ts
  "The funding chart is unavailable right now. The backtest below is unaffected.":
    "กราฟ Funding ใช้งานไม่ได้ในขณะนี้ Backtest ด้านล่างไม่ได้รับผลกระทบ",
  "No stored funding for this window yet.": "ยังไม่มีข้อมูล Funding ที่บันทึกไว้ในช่วงเวลานี้",
  Spread: "สเปรด",
  "Funding by exchange, annualized · hourly": "Funding แยกตามกระดานเทรด คิดเป็นรายปี · รายชั่วโมง",
  "Funding by exchange, annualized · daily": "Funding แยกตามกระดานเทรด คิดเป็นรายปี · รายวัน",
  "Funding APR by exchange over the window": "APR ของ Funding แยกตามกระดานเทรดในช่วงเวลานี้",
  "Hover the chart to read every visible line at one moment.":
    "ชี้ที่กราฟเพื่ออ่านค่าทุกเส้นที่มองเห็น ณ เวลาเดียวกัน",
  "Signed log scale, so ordinary rates keep room beside extreme ones. Each line holds a rate until that exchange's next settlement; a break is time with no recorded funding, not a zero.":
    "สเกลลอการิทึมแบบมีเครื่องหมาย อัตราปกติจึงยังมีที่ทางข้างอัตราสุดขั้ว แต่ละเส้นคงอัตราไว้จนถึงรอบจ่ายถัดไปของกระดานเทรดนั้น ช่วงที่เส้นขาดคือช่วงที่ไม่มี Funding บันทึกไว้ ไม่ใช่ศูนย์",

  // web/sentiment.ts
  "No readings yet in this window.": "ยังไม่มีค่าในช่วงเวลานี้",
  "Fear & greed: {score}, {label}": "ความกลัวและความโลภ: {score} {label}",
  "Fear and greed score reaches {score} ({label})": "คะแนนความกลัวและความโลภแตะ {score} ({label})",
  "{n} readings, every 30 minutes · {age} to now": "{n} ค่า ทุก 30 นาที · ตั้งแต่{age}ถึงตอนนี้",
  "no data in window": "ไม่มีข้อมูลในช่วงเวลานี้",
  "Fear &amp; greed · updated {ago}": "ความกลัวและความโลภ · อัปเดต{ago}",
  "Fear &amp; greed": "ความกลัวและความโลภ",
  component: "องค์ประกอบ",
  reading: "ค่า",
  "percentile (30d, greed direction)": "เปอร์เซ็นไทล์ (30 วัน ทิศทางโลภ)",
  "funding (OI-weighted APR)": "Funding (APR ถ่วงน้ำหนักด้วย OI)",
  "open interest": "Open Interest",
  "liquidation skew (24h)": "ความเอียงของการล้างพอร์ต (24 ชม.)",
  "{pct} long-heavy": "Long หนักกว่า {pct}",
  "taker flow (24h)": "โฟลว์ Taker (24 ชม.)",
  "{pct} net buy": "ซื้อสุทธิ {pct}",
  "Score is the mean of four components, each a percentile rank against this book's own trailing 30-day history — not a fixed scale, so the same raw number reads differently in a quiet stretch than a volatile one. <b>Funding</b> and <b>open interest</b> run high-is-greedy (crowded, levered longs paying to hold). <b>Liquidation skew</b> is inverted before averaging: a book where longs are being forced out is fear, however unusual that reading looks against its own history. <b>Taker flow</b> is net aggressive buying over aggressive selling, last 24h. Computed every 30 minutes by the collector (belyjelli/profitlock-worker, <code>collector rank-eval</code>'s sibling <code>market sentiment</code> job); coverage for liquidations and taker flow is not venue-complete, so this is a proxy, not a market-wide guarantee.":
    "คะแนนคือค่าเฉลี่ยขององค์ประกอบสี่ตัว แต่ละตัวเป็นอันดับเปอร์เซ็นไทล์เทียบกับประวัติย้อนหลัง 30 วันของตลาดนี้เอง — ไม่ใช่สเกลตายตัว ตัวเลขดิบเดียวกันจึงอ่านได้ต่างกันในช่วงตลาดเงียบกับช่วงผันผวน <b>Funding</b> และ <b>Open Interest</b> ยิ่งสูงยิ่งโลภ (Long ใช้เลเวอเรจแออัดและยอมจ่ายเพื่อถือ) <b>ความเอียงของการล้างพอร์ต</b> ถูกกลับทิศก่อนนำมาเฉลี่ย: ตลาดที่ Long กำลังถูกบังคับออกคือความกลัว ไม่ว่าค่านั้นจะดูผิดปกติแค่ไหนเมื่อเทียบกับประวัติของตัวเอง <b>โฟลว์ Taker</b> คือแรงซื้อเชิงรุกสุทธิเหนือแรงขายเชิงรุกใน 24 ชม. ล่าสุด คำนวณทุก 30 นาทีโดยตัวเก็บข้อมูล (belyjelli/profitlock-worker งาน <code>market sentiment</code> ที่อยู่คู่กับ <code>collector rank-eval</code>) ข้อมูลการล้างพอร์ตและโฟลว์ Taker ยังไม่ครบทุกกระดานเทรด นี่จึงเป็นตัวแทนโดยประมาณ ไม่ใช่การรับประกันทั้งตลาด",
  "Fear & Greed": "ความกลัวและความโลภ",
  "A funding-market fear and greed score: OI-weighted funding, open interest, liquidation skew and taker flow, each ranked against its own 30-day history.":
    "คะแนนความกลัวและความโลภของตลาด Funding: Funding ถ่วงน้ำหนักด้วย OI, Open Interest, ความเอียงของการล้างพอร์ต และโฟลว์ Taker แต่ละตัวจัดอันดับเทียบกับประวัติ 30 วันของตัวเอง",
  "{month} {day} {time}–{end} {zone}": "{day} {month} {time}–{end} {zone}",
  "close, {market}": "ราคาปิด {market}",
  "open {open} · high {high} · low {low} · close {close}":
    "เปิด {open} · สูง {high} · ต่ำ {low} · ปิด {close}",
  "volume {usd}": "วอลุ่ม {usd}",
  "large taker buys {usd} ({n})": "Taker ซื้อก้อนใหญ่ {usd} ({n})",
  "large taker sells {usd} ({n})": "Taker ขายก้อนใหญ่ {usd} ({n})",
  "no candle": "ไม่มีแท่งเทียน",
  "{month} {day} {hours} {zone}": "{day} {month} {hours} {zone}",
  "{hours} {zone}": "{hours} {zone}",

  // web/kchart.ts: the trading chart on /cvd.
  "Loading older bars…": "กำลังโหลดแท่งที่เก่ากว่า…",
  "Nothing older: taker flow is kept for {days} days.":
    "ไม่มีข้อมูลเก่ากว่านี้: โฟลว์ Taker เก็บไว้ {days} วัน",
  "Older bars did not load. Drag again to retry.": "โหลดแท่งที่เก่ากว่าไม่สำเร็จ ลากอีกครั้งเพื่อลองใหม่",
  "drag to look back · wheel or pinch to zoom · hover a candle to read it":
    "ลากเพื่อดูย้อนหลัง · หมุนล้อหรือถ่างนิ้วเพื่อซูม · ชี้ที่แท่งเทียนเพื่ออ่านค่า",
  "Futures CVD": "CVD Futures",
  "Spot CVD": "CVD Spot",
  "Delta buy": "Delta ซื้อ",
  "Delta sell": "Delta ขาย",
  "{asset} delta per bar, spot and futures net taker flow summed":
    "Delta ต่อแท่งของ {asset} คือผลรวมโฟลว์ Taker สุทธิของ Spot และ Futures",
  "No taker flow for {asset} in the last {window}. Only the ~500 assets deepest on {venues} are polled; pick one from the asset list above.":
    "ไม่มีโฟลว์ Taker ของ {asset} ในช่วง {window} ล่าสุด ระบบดึงข้อมูลเฉพาะ ~500 สินทรัพย์ที่ลึกที่สุดบน {venues} เลือกจากรายการสินทรัพย์ด้านบน",
  "Price with cumulative volume delta under it: spot and futures taker buying against taker selling, their combined delta per bar, and where price and order flow disagree.":
    "ราคาพร้อม Cumulative Volume Delta ด้านล่าง: แรงซื้อเทียบแรงขายของ Taker ทั้ง Spot และ Futures Delta รวมต่อแท่ง และจุดที่ราคากับ Order Flow ไปคนละทาง",
  "Price, with cumulative volume delta (CVD) under it: {buys} less {sells}, in dollars, summed over every exchange we collect that lists the asset, with its USDT, USDC and USD markets counted as one. Futures CVD adds up the perpetuals on <b>{futures}</b>; spot CVD the spot books on <b>{spot}</b>. It covers the ~500 assets deepest by open interest and every commodity, index and currency pair, in 5-minute buckets. A divergence marks a window where price and flow pointed opposite ways; it describes what happened, not what happens next.":
    "ราคา พร้อม Cumulative Volume Delta (CVD) ด้านล่าง: {buys} ลบ {sells} เป็นดอลลาร์ รวมทุกกระดานเทรดที่เราเก็บข้อมูลและลิสต์สินทรัพย์นี้ โดยนับตลาด USDT, USDC และ USD เป็นตลาดเดียว CVD Futures รวม Perpetual บน <b>{futures}</b> ส่วน CVD Spot รวมตลาด Spot บน <b>{spot}</b> ครอบคลุม ~500 สินทรัพย์ที่ Open Interest ลึกที่สุด และทุกสินค้าโภคภัณฑ์ ดัชนี และคู่สกุลเงิน เป็นช่วงละ 5 นาที Divergence บอกช่วงที่ราคากับโฟลว์ชี้ไปคนละทาง เป็นการบอกสิ่งที่เกิดขึ้นแล้ว ไม่ใช่สิ่งที่จะเกิดต่อไป",
  "Each key above the chart says how many venues its line sums for this asset; hover it for their names. Spot covers crypto and stocks: a stock's spot books are its tokenized shares (xStocks, Ondo and the like) on the collected exchanges, counted only while they trade at the stock's own price. Commodities and indices show futures only. Spot and futures each have a pane, because their sizes differ by an order of magnitude on most assets. The histogram under them is the delta: each bar's spot and futures net summed.":
    "คำอธิบายแต่ละตัวเหนือกราฟบอกว่าเส้นนั้นรวมกี่กระดานเทรดสำหรับสินทรัพย์นี้ ชี้ที่คำอธิบายเพื่อดูชื่อ Spot ครอบคลุมคริปโตและหุ้น: ตลาด Spot ของหุ้นคือหุ้นโทเคน (xStocks, Ondo และอื่น ๆ) บนกระดานเทรดที่เก็บข้อมูล นับเฉพาะตอนที่ซื้อขายที่ราคาเดียวกับตัวหุ้น สินค้าโภคภัณฑ์และดัชนีแสดงเฉพาะ Futures Spot และ Futures แยกกันคนละแผง เพราะขนาดต่างกันราวสิบเท่าในสินทรัพย์ส่วนใหญ่ ฮิสโตแกรมด้านล่างคือ Delta: ผลรวมสุทธิของ Spot และ Futures ในแต่ละแท่ง",
  "Price is the busiest polled market's own candle. Each pane has its own scale, so where lines cross means nothing. Drag to look back, wheel or pinch to zoom, and hover a candle to read it in the box beside it; on a phone, tap.":
    "ราคาคือแท่งเทียนของตลาดที่คึกคักที่สุดที่ดึงข้อมูล แต่ละแผงมีสเกลของตัวเอง จุดที่เส้นตัดกันจึงไม่มีความหมาย ลากเพื่อดูย้อนหลัง หมุนล้อหรือถ่างนิ้วเพื่อซูม และชี้ที่แท่งเทียนเพื่ออ่านค่าในกล่องข้าง ๆ บนมือถือให้แตะ",
  "futures net {net}": "Futures สุทธิ {net}",
  "spot net {net}": "Spot สุทธิ {net}",
  "delta {net}": "Delta {net}",
  "delta {net} ({pct} of volume)": "Delta {net} ({pct} ของวอลุ่ม)",
  "CVD futures {futures}, spot {spot}": "CVD Futures {futures} Spot {spot}",
  Open: "เปิด",
  High: "สูง",
  Low: "ต่ำ",
  Futures: "Futures",
  "Spot (Binance)": "Spot (Binance)",
  // The Chart page's fund-flow dropdown (web/fund-flow.ts).
  "No spot book for this asset on the collected exchanges.":
    "ไม่มีตลาด Spot ของสินทรัพย์นี้บนกระดานเทรดที่เก็บข้อมูล",
  "No futures flow for this asset yet.": "ยังไม่มีโฟลว์ Futures ของสินทรัพย์นี้",
  Time: "เวลา",
  "Taker buys in the window, in dollars": "แรงซื้อ Taker ในช่วงเวลา เป็นดอลลาร์",
  "Inflow ($)": "เงินไหลเข้า ($)",
  "Taker sells in the window, in dollars": "แรงขาย Taker ในช่วงเวลา เป็นดอลลาร์",
  "Outflow ($)": "เงินไหลออก ($)",
  "Inflow less outflow": "เงินไหลเข้าลบเงินไหลออก",
  "Net inflow ($)": "ไหลเข้าสุทธิ ($)",
  "Net inflow against the window of the same length before it": "ไหลเข้าสุทธิเทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน",
  "Net inflow change": "การเปลี่ยนแปลงไหลเข้าสุทธิ",
  "Net inflow as a share of the asset's market cap": "ไหลเข้าสุทธิเป็นสัดส่วนของมาร์เก็ตแคปสินทรัพย์",
  "F/M cap ratio": "อัตราส่วน F/M cap",
  "Spot fund": "เงินทุน Spot",
  "Spot books on {venues}": "ตลาด Spot บน {venues}",
  "{count} venues": "{count} กระดานเทรด",
  "Futures fund": "เงินทุน Futures",
  "Perpetuals on {venues}": "Perpetual บน {venues}",
  "Fund flow": "กระแสเงินทุน",
  "Inflow is taker buying and outflow taker selling, summed over each window back from the newest bucket every venue has published. Net inflow change compares the net with the window of the same length before it. F/M cap ratio is the net as a share of the asset's market cap (CoinGecko). A dash means the history does not reach back that far yet.":
    "เงินไหลเข้าคือแรงซื้อ Taker และเงินไหลออกคือแรงขาย Taker รวมแต่ละช่วงเวลาย้อนจากช่วงล่าสุดที่ทุกกระดานเทรดเผยแพร่แล้ว การเปลี่ยนแปลงไหลเข้าสุทธิเทียบยอดสุทธิกับช่วงก่อนหน้าที่ยาวเท่ากัน อัตราส่วน F/M cap คือยอดสุทธิเป็นสัดส่วนของมาร์เก็ตแคปสินทรัพย์ (CoinGecko) ขีดหมายถึงข้อมูลย้อนหลังยังไปไม่ถึง",
  "Up to": "ถึง",

  // web/cvd.ts: the Detail view, the charted asset's own figures in place of the chart.
  "{ratio} of {volume} taker volume, {venues}": "{ratio} ของวอลุ่ม Taker {volume} {venues}",
  "Bullish divergence": "Bullish Divergence",
  "Bearish divergence": "Bearish Divergence",
  "No divergence": "ไม่มี Divergence",
  "price {change}, futures flow {ratio} of volume; a flag needs both past {price}% and {flow}%":
    "ราคา {change} โฟลว์ Futures {ratio} ของวอลุ่ม จะติดธงได้ต้องเกิน {price}% และ {flow}% ทั้งคู่",
  "{venue} spot": "Spot {venue}",
  "largest net buy and net sell by exchange": "ซื้อสุทธิและขายสุทธิมากที่สุดแยกตามกระดานเทรด",
  "{n} markets, 24h volume {volume}": "{n} ตลาด วอลุ่ม 24 ชม. {volume}",
  "weighted by open interest; {low} to {high} across markets":
    "ถ่วงน้ำหนักด้วย Open Interest ช่วง {low} ถึง {high} ในแต่ละตลาด",
  "Market cap": "มาร์เก็ตแคป",
  "CoinGecko's, read hourly; crypto only": "จาก CoinGecko อ่านทุกชั่วโมง เฉพาะคริปโต",
  "{interval} bars": "แท่ง {interval}",
  "Signal by window": "สัญญาณตามช่วงเวลา",
  "More on {asset}:": "ดู {asset} เพิ่มเติม:",
  "By exchange": "แยกตามกระดานเทรด",
  "Back to the chart": "กลับไปที่กราฟ",
  "{asset}'s flow by window and by exchange, with its open interest and funding":
    "โฟลว์ของ {asset} ตามช่วงเวลาและตามกระดานเทรด พร้อม Open Interest และ Funding",
  Detail: "รายละเอียด",
  "Detail, beside Fund flow, puts the asset's own figures where the chart and the market's tiles are, over the same window: its futures and spot CVD, whether it diverged, the exchanges that bought and sold it most, its open interest, funding and market cap; then its signal over every interval's span, and its flow exchange by exchange. Chart brings the chart back.":
    "รายละเอียด ข้างกระแสเงินทุน จะแสดงตัวเลขของสินทรัพย์นี้แทนที่กราฟและการ์ดของตลาด ในช่วงเวลาเดียวกัน: CVD Futures และ Spot มี Divergence หรือไม่ กระดานเทรดที่ซื้อและขายมากที่สุด Open Interest, Funding และมาร์เก็ตแคป ต่อด้วยสัญญาณตลอดช่วงของทุกขนาดแท่ง และโฟลว์ทีละกระดานเทรด กด กราฟ เพื่อกลับไปที่กราฟ",
  // The Chart page's spot ETF flow pins (web/kchart.ts).
  "Spot ETF net inflow": "Spot ETF ไหลเข้าสุทธิ",
  "Spot ETF net outflow": "Spot ETF ไหลออกสุทธิ",
  "Counted: {funds}. Not read: {missing}, whose issuers block automated reads.":
    "นับแล้ว: {funds} ยังไม่ได้อ่าน: {missing} ซึ่งผู้ออกกองทุนบล็อกการอ่านอัตโนมัติ",
  "pins: spot ETF net flow per trade day, at the 4 pm New York NAV":
    "หมุด: กระแสสุทธิ Spot ETF ต่อวันทำการ ตาม NAV เวลา 16:00 นิวยอร์ก",
  "{date}, 4 pm New York close": "{date} ปิดตลาด 16:00 นิวยอร์ก",
  "Not reported yet: {funds}": "ยังไม่รายงาน: {funds}",
  "Spot ETF net inflow so far": "Spot ETF ไหลเข้าสุทธิถึงตอนนี้",
  "Spot ETF net outflow so far": "Spot ETF ไหลออกสุทธิถึงตอนนี้",
  "{n} of {total} funds reported": "รายงานแล้ว {n} จาก {total} กองทุน",
  "{asset} chart: price and CVD": "กราฟ {asset}: ราคาและ CVD",
  "{asset} price with cumulative volume delta under it: spot and futures taker buying against taker selling across exchanges, and where price and order flow disagree.":
    "ราคา {asset} พร้อม Cumulative Volume Delta ด้านล่าง: แรงซื้อเทียบแรงขายของ Taker ทั้ง Spot และ Futures จากหลายกระดานเทรด และจุดที่ราคากับ Order Flow ไปคนละทาง",
  "{asset} · interbank rate · {n}-hour bars, {zone}":
    "{asset} · อัตราระหว่างธนาคาร · แท่งละ {n} ชม. {zone}",
  "{asset} · interbank rate · {n}-minute bars, {zone}":
    "{asset} · อัตราระหว่างธนาคาร · แท่งละ {n} นาที {zone}",
  "Last {window}: {from} to {to}": "{window} ล่าสุด: {from} ถึง {to}",
  "No exchange trades {asset}, so it has no taker flow to sum: this is its interbank rate, quoted every five minutes. Last quote {age}.":
    "ไม่มีกระดานเทรดใดซื้อขาย {asset} จึงไม่มีโฟลว์เทคเกอร์ให้รวม นี่คืออัตราระหว่างธนาคาร อัปเดตราคาทุกห้านาที ราคาล่าสุด {age}",
  "interbank rate": "อัตราระหว่างธนาคาร",
  "{asset} interbank rate over the last {window}": "อัตราระหว่างธนาคารของ {asset} ใน {window} ล่าสุด",
  "No exchange trades it: its interbank rate, with no taker flow":
    "ไม่มีกระดานเทรดซื้อขาย: มีเพียงอัตราระหว่างธนาคาร ไม่มีโฟลว์เทคเกอร์",
  "rate only": "อัตราเท่านั้น",
  "{asset} chart: interbank rate": "กราฟ {asset}: อัตราระหว่างธนาคาร",
  "{asset} interbank rate, quoted every five minutes. No exchange trades it, so it has no taker flow or CVD.":
    "อัตราระหว่างธนาคารของ {asset} อัปเดตราคาทุกห้านาที ไม่มีกระดานเทรดซื้อขาย จึงไม่มีโฟลว์เทคเกอร์หรือ CVD",
  "A currency pair that no exchange trades, USD/CNY and USD/HKD among them, is listed with its interbank rate instead: quoted every five minutes, with no taker flow, so its row has no CVD and its chart is the rate alone.":
    "คู่สกุลเงินที่ไม่มีกระดานเทรดใดซื้อขาย เช่น USD/CNY และ USD/HKD จะแสดงด้วยอัตราระหว่างธนาคารแทน อัปเดตราคาทุกห้านาที ไม่มีโฟลว์เทคเกอร์ แถวของมันจึงไม่มี CVD และกราฟแสดงเฉพาะอัตรา",
  "its interbank rate, quoted every five minutes": "อัตราระหว่างธนาคาร อัปเดตราคาทุกห้านาที",
};
