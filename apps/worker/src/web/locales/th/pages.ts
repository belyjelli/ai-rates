/**
 * web/pages.ts (every page but the /status body, which stays English) and web/venues.ts, in Thai.
 * Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const pages: Catalog = {
  // shared helpers
  flat: "ทรงตัว",
  crypto: "คริปโต",
  equity: "หุ้น",
  commodity: "โภคภัณฑ์",
  fx: "ค่าเงิน",
  index: "ดัชนี",
  "{days} charging days in the last 30": "{days} วันที่มีการเก็บ Funding ใน 30 วันล่าสุด",
  Asset: "สินทรัพย์",
  "7d settled": "จ่ายแล้ว 7 วัน",
  Stability: "ความเสถียร",
  "Long on {venue}": "Long ที่ {venue}",
  "Short on {venue}": "Short ที่ {venue}",
  day: "1 วัน",
  "{n} days": "{n} วัน",
  Any: "ทั้งหมด",

  // home: verified ranking and hero
  "No replay yet: the nightly run needs a week of settled funding on both legs of a pair.":
    "ยังไม่มีผลจำลองย้อนหลัง: การรันทุกคืนต้องมี Funding ที่จ่ายแล้ว 1 สัปดาห์ทั้งสองขาของคู่",
  "Replayed, not forecast: {asset} long {long} / short {short} settled {net} on {size} a leg over 7 days. {apr} annualized, {win}% of days positive.":
    "จำลองย้อนหลัง ไม่ใช่การคาดการณ์: {asset} Long {long} / Short {short} จ่ายจริง {net} ด้วยขาละ {size} ใน 7 วัน คิดเป็นรายปี {apr} และ {win}% ของวันเป็นบวก",
  "Open interest on the thinner of the two legs. A big figure earned on a shallow market is not a trade you can size into":
    "Open Interest ของขาที่บางกว่า ตัวเลขสูงจากตลาดที่ตื้นไม่ใช่เทรดที่คุณจะใส่ไซส์ใหญ่ได้",
  "The more extreme leg's funding, absolute. Rates past a few hundred percent usually mean a delisting or a distressed listing rather than carry":
    "Funding ของขาที่สุดโต่งกว่า (ค่าสัมบูรณ์) อัตราที่เกินหลายร้อยเปอร์เซ็นต์มักหมายถึงเหรียญที่กำลังถูกถอดหรือมีปัญหา มากกว่าจะเป็น Carry",
  "Funding both legs actually settled over the last 7 days, per $10,000 of notional on each leg":
    "Funding ที่ทั้งสองขาจ่ายจริงใน 7 วันล่าสุด ต่อมูลค่า $10,000 ต่อขา",
  Annualized: "คิดเป็นรายปี",
  "Long leg": "ขา Long",
  "Short leg": "ขา Short",
  "Days the pair was net positive, as a share of days that settled at all":
    "สัดส่วนวันที่คู่นี้ได้สุทธิเป็นบวก จากวันที่มีการจ่ายทั้งหมด",
  "Win rate": "อัตราชนะ",
  "Thinner leg OI": "OI ขาที่บางกว่า",
  "Worst leg APR": "APR ขาที่แย่กว่า",
  "How often the weaker leg held its funding direction over 30 days":
    "ความถี่ที่ขาที่อ่อนกว่ารักษาทิศทาง Funding ไว้ได้ใน 30 วัน",
  "Widest funding spread right now": "สเปรด Funding ที่กว้างที่สุดตอนนี้",
  "No venue has reported in the last five minutes, so there's nothing to pair. Check again in a minute.":
    "ไม่มีกระดานเทรดใดส่งข้อมูลใน 5 นาทีที่ผ่านมา จึงยังจับคู่ไม่ได้ ลองดูอีกครั้งในอีกสักนาที",
  "Funding spreads across perp exchanges": "สเปรด Funding ข้ามกระดานเทรด Perp",
  "Live funding rate spreads between perpetual futures exchanges, refreshed every minute.":
    "สเปรด Funding Rate สดระหว่างกระดานเทรดสัญญา Perpetual อัปเดตทุกนาที",
  "Widest spreads": "สเปรดกว้างที่สุด",
  "Open the screener": "เปิดสกรีนเนอร์",
  "No pairs yet: an asset needs live markets on at least two venues.":
    "ยังไม่มีคู่: สินทรัพย์ต้องมีตลาดที่เปิดอยู่อย่างน้อย 2 กระดานเทรด",
  "What actually paid, last 7 days": "สิ่งที่จ่ายจริงใน 7 วันล่าสุด",
  "replayed {date}": "จำลองย้อนหลังเมื่อ {date}",
  "Not a forecast: both legs replayed at their own settlement times from stored funding, on $10,000 per leg. Ranked by what settled, with nothing filtered out — so check the thinner leg's depth and the worse leg's rate before reading a big number as a trade.":
    "ไม่ใช่การคาดการณ์: ทั้งสองขาจำลองย้อนหลังตามเวลารอบจ่ายของตัวเองจาก Funding ที่บันทึกไว้ ด้วยขาละ $10,000 เรียงตามยอดที่จ่ายจริงโดยไม่กรองอะไรออก ดังนั้นให้ดูความลึกของขาที่บางกว่าและอัตราของขาที่แย่กว่าก่อน แล้วค่อยมองตัวเลขสูงว่าเป็นเทรด",
  "{asset} carry, long {long} / short {short}: {funding} of funding settled on {size} a leg over the last {span}. {net} after retail fees. Price risk hedged, not guessed.":
    "Carry {asset} Long {long} / Short {short}: Funding จ่ายแล้ว {funding} ด้วยขาละ {size} ใน {span} ล่าสุด หลังหักค่าธรรมเนียมรายย่อยเหลือ {net} ความเสี่ยงด้านราคาถูกเฮดจ์ ไม่ได้เดา",
  "Best verified carry, last {span}": "Carry ที่ยืนยันแล้วดีที่สุด {span} ล่าสุด",
  "funding settled on {size} per leg": "Funding ที่จ่ายแล้วด้วยขาละ {size}",
  "after retail fees {value}": "หลังหักค่าธรรมเนียมรายย่อย {value}",
  "annualized {value} before fees": "คิดเป็นรายปี {value} ก่อนหักค่าธรรมเนียม",
  "win rate {value} of days": "อัตราชนะ {value} ของวัน",
  "thinner leg {value} open interest": "Open Interest ขาที่บางกว่า {value}",
  "stability {value}": "ความเสถียร {value}",
  "Open this backtest": "เปิด Backtest นี้",
  "Settled, not forecast: both legs replayed at their own settlement times. This is the best pair in the newest nightly run with at least {oi} of open interest on its thinner leg, neither leg past {apr}% a year, stability of {stability} or better and no missed settlements. Retail fees are {bps} bps on each of {fills} fills, opening and closing both legs. Last week's funding is not a promise about next week's.":
    "จ่ายจริง ไม่ใช่การคาดการณ์: ทั้งสองขาจำลองย้อนหลังตามเวลารอบจ่ายของตัวเอง นี่คือคู่ที่ดีที่สุดในการรันรอบคืนล่าสุดที่ขาที่บางกว่ามี Open Interest อย่างน้อย {oi} ไม่มีขาไหนเกิน {apr}% ต่อปี ความเสถียร {stability} ขึ้นไป และไม่มีรอบจ่ายที่ขาดหาย ค่าธรรมเนียมรายย่อยคิด {bps} bps ต่อการ Fill แต่ละครั้ง รวม {fills} ครั้ง ทั้งเปิดและปิดทั้งสองขา Funding ของสัปดาห์ที่แล้วไม่ใช่คำสัญญาของสัปดาห์หน้า",
  "Widest funding spread across perp exchanges right now: {asset} at {spread} a year. Long {long} at {longApr}, short {short} at {shortApr}.":
    "สเปรด Funding ที่กว้างที่สุดข้ามกระดานเทรด Perp ตอนนี้: {asset} ที่ {spread} ต่อปี Long {long} ที่ {longApr} Short {short} ที่ {shortApr}",
  "funding spread, per year": "สเปรด Funding ต่อปี",
  "{symbol} at {apr}": "{symbol} ที่ {apr}",
  "Holding equal size on both legs cancels the price exposure; the gap between the two funding rates is what the pair collects over a year, before trading fees and before either rate moves.":
    "ถือไซส์เท่ากันทั้งสองขาจะหักล้างความเสี่ยงด้านราคา ส่วนต่างระหว่าง Funding Rate สองตัวคือสิ่งที่คู่นี้เก็บได้ในหนึ่งปี ก่อนหักค่าธรรมเนียมเทรด และก่อนที่อัตราใดจะเปลี่ยน",

  // screener
  "Funding spread screener": "สกรีนเนอร์สเปรด Funding",
  "Filter live cross-exchange funding spreads by open interest, volume and exchange type.":
    "กรองสเปรด Funding สดข้ามกระดานเทรดตาม Open Interest วอลุ่ม และประเภทกระดานเทรด",
  "For each asset, the cheapest market to hold long and the richest to hold short, on different exchanges. Each leg must pass the filters.":
    "สำหรับแต่ละสินทรัพย์ คือตลาดที่ถือ Long ได้ถูกที่สุดและตลาดที่ถือ Short ได้มากที่สุด บนกระดานเทรดที่ต่างกัน ทุกขาต้องผ่านตัวกรอง",
  "No pairs match these filters. Lower the minimum open interest or include more exchange types.":
    "ไม่มีคู่ที่ตรงกับตัวกรองนี้ ลองลด Open Interest ขั้นต่ำ หรือรวมประเภทกระดานเทรดเพิ่ม",
  "Min open interest, each leg": "Open Interest ขั้นต่ำ ต่อขา",
  "Min 24h volume, each leg": "วอลุ่ม 24 ชม. ขั้นต่ำ ต่อขา",
  "A USDT leg against a USDC leg carries the basis between the two stablecoins and needs collateral in both. Ticked, each asset is paired only within one quote currency":
    "ขา USDT คู่กับขา USDC จะมี Basis ระหว่าง Stablecoin สองตัว และต้องมีหลักประกันทั้งสองสกุล ถ้าติ๊กไว้ แต่ละสินทรัพย์จะจับคู่เฉพาะในสกุลเงินอ้างอิงเดียวกัน",
  "Same quote currency on both legs": "สกุลเงินอ้างอิงเดียวกันทั้งสองขา",
  "Delisting and distressed listings can pay beyond ±2000% APR and crowd out tradeable spreads":
    "เหรียญที่กำลังถูกถอดหรือมีปัญหาอาจจ่ายเกิน ±2000% APR และเบียดสเปรดที่เทรดได้จริงออกไป",
  "Include beyond ±1000% APR": "รวมที่เกิน ±1000% APR",
  Rows: "จำนวนแถว",
  Spread: "สเปรด",
  Venues: "กระดานเทรด",
  "Neither leg has settled funding to score yet": "ทั้งสองขายังไม่มี Funding ที่จ่ายแล้วสำหรับให้คะแนน",
  "The long leg has no settled funding to score yet": "ขา Long ยังไม่มี Funding ที่จ่ายแล้วสำหรับให้คะแนน",
  "The short leg has no settled funding to score yet": "ขา Short ยังไม่มี Funding ที่จ่ายแล้วสำหรับให้คะแนน",
  "Weaker leg held its direction on {days} of its charging days in the last 30":
    "ขาที่อ่อนกว่ารักษาทิศทางได้ {days} ของวันที่มีการเก็บ Funding ใน 30 วันล่าสุด",
  "This exchange does not say what the leg settles in, so it cannot be shown to match the other leg":
    "กระดานเทรดนี้ไม่ได้ระบุว่าขานี้ชำระด้วยสกุลอะไร จึงยืนยันไม่ได้ว่าตรงกับอีกขา",
  "Settles in {quote} while the other leg settles in {other}: the pair carries the basis between them":
    "ชำระด้วย {quote} ขณะที่อีกขาชำระด้วย {other}: คู่นี้จึงมี Basis ระหว่างสองสกุล",
  "an undeclared currency": "สกุลที่ไม่ได้ระบุ",
  "quote ?": "สกุล ?",
  OI: "OI",
  "{asset} pays {spread} a year to hold both sides: long {long} at {longApr}, short {short} at {shortApr}. Same coin, two exchanges, price exposure cancelled.":
    "ถือ {asset} ทั้งสองฝั่งได้ {spread} ต่อปี: Long {long} ที่ {longApr} Short {short} ที่ {shortApr} เหรียญเดียวกัน สองกระดานเทรด ความเสี่ยงด้านราคาหักล้างกัน",
  "Signed log scale, so ordinary rates keep room next to extreme ones":
    "สเกลล็อกแบบมีเครื่องหมาย ให้อัตราปกติยังมีที่แสดงข้างอัตราสุดโต่ง",
  "Long − short, log scale": "Long − Short สเกลล็อก",
  "Exchanges with a live market for this asset": "กระดานเทรดที่มีตลาดเปิดอยู่สำหรับสินทรัพย์นี้",
  "How often the weaker leg held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "ความถี่ที่ขาที่อ่อนกว่ารักษาทิศทาง Funding ไว้ได้ใน 30 วัน 0.50 คือโยนเหรียญ 0.88 คือคะแนนสูงสุดที่เดือนเต็มทำได้",

  // exchanges and one exchange
  Exchanges: "กระดานเทรด",
  "No exchange has reported in the last five minutes.": "ไม่มีกระดานเทรดใดส่งข้อมูลใน 5 นาทีที่ผ่านมา",
  Exchange: "กระดานเทรด",
  Type: "ประเภท",
  "Open interest": "Open Interest",
  "24h volume": "วอลุ่ม 24 ชม.",
  Updated: "อัปเดต",
  "{venue}: {count} live perp markets, {oi} open interest. Richest funding {richest} at {richestApr} a year; cheapest {cheapest} at {cheapestApr}.":
    "{venue}: {count} ตลาด Perp ที่เปิดอยู่ Open Interest {oi} Funding สูงสุด {richest} ที่ {richestApr} ต่อปี ต่ำสุด {cheapest} ที่ {cheapestApr}",
  "{venue} funding rates": "Funding Rate ของ {venue}",
  "Live funding rates, open interest and volume for every {venue} perpetual market.":
    "Funding Rate, Open Interest และวอลุ่มสดของทุกตลาด Perpetual บน {venue}",
  "No live markets from {venue}: it isn't collected yet, or its last update is more than five minutes old.":
    "ไม่มีตลาดที่เปิดอยู่จาก {venue}: ยังไม่ได้เก็บข้อมูล หรืออัปเดตล่าสุดเกิน 5 นาทีแล้ว",
  "{count} live markets": "{count} ตลาดที่เปิดอยู่",
  "{value} open interest": "Open Interest {value}",
  "updated {value}": "อัปเดต {value}",
  Market: "ตลาด",
  "Funding APR": "Funding APR",
  "Rate, log scale": "อัตรา สเกลล็อก",
  Interval: "รอบ",
  "Next funding": "Funding รอบถัดไป",
  "Mark price": "ราคา Mark",
  "Centralized exchange": "กระดานเทรดแบบรวมศูนย์",
  "Onchain perp exchange": "กระดานเทรด Perp บนเชน",
  "Hyperliquid HIP-3 dex": "DEX HIP-3 ของ Hyperliquid",

  // rates
  now: "ตอนนี้",
  asset: "สินทรัพย์",
  "open interest": "Open Interest",
  spread: "สเปรด",
  "{asset} funding runs from {low} on {lowVenue} to {high} on {highVenue}: {gap} a year apart across {count} exchanges.":
    "Funding ของ {asset} อยู่ระหว่าง {low} บน {lowVenue} ถึง {high} บน {highVenue}: ห่างกัน {gap} ต่อปี ใน {count} กระดานเทรด",
  previous: "ก่อนหน้า",
  "assets {from}–{to}": "สินทรัพย์ {from}–{to}",
  next: "ถัดไป",
  "No asset has live markets on two or more venues right now.":
    "ตอนนี้ไม่มีสินทรัพย์ใดมีตลาดเปิดอยู่ตั้งแต่ 2 กระดานเทรดขึ้นไป",
  Rates: "อัตรา",
  "Funding APR for every asset across every perpetual exchange, in one grid.":
    "Funding APR ของทุกสินทรัพย์บนทุกกระดานเทรด Perpetual ในตารางเดียว",
  "Every exchange's funding for the deepest assets at once. Positive means longs pay, so a short collects; an empty cell means that exchange has no market for the asset, not that funding is flat.":
    "Funding ของทุกกระดานเทรดสำหรับสินทรัพย์ที่ลึกที่สุดในคราวเดียว ค่าบวกหมายถึงฝั่ง Long จ่าย ฝั่ง Short จึงได้รับ ช่องว่างหมายถึงกระดานเทรดนั้นไม่มีตลาดของสินทรัพย์นี้ ไม่ใช่ว่า Funding ทรงตัว",

  // price gaps
  "{asset}: buy on {buyVenue} at {buyPrice}, sell on {sellVenue} at {sellPrice}. A {gap} bps gap at the top of the book.":
    "{asset}: ซื้อบน {buyVenue} ที่ {buyPrice} ขายบน {sellVenue} ที่ {sellPrice} ส่วนต่าง {gap} bps ที่ราคาดีที่สุดของ Order Book",
  "Quotes seen {quoted}; the older leg's funding row fetched {fetched}":
    "เห็นราคาเสนอ {quoted} ข้อมูล Funding ของขาที่เก่ากว่าดึงมา {fetched}",
  "No asset quotes a gap this wide right now. The median comparable asset sits near 1.6 bps, so try a lower floor.":
    "ตอนนี้ไม่มีสินทรัพย์ใดมีส่วนต่างกว้างขนาดนี้ ค่ามัธยฐานของสินทรัพย์ที่เทียบกันได้อยู่ราว 1.6 bps ลองลดเกณฑ์ขั้นต่ำลง",
  "Highest bid against lowest ask, across two different exchanges":
    "Bid สูงสุดเทียบกับ Ask ต่ำสุด ข้ามสองกระดานเทรดที่ต่างกัน",
  "Gap, bps": "ส่วนต่าง bps",
  "The sell price less the buy price, in the asset's own price units":
    "ราคาขายลบราคาซื้อ ในหน่วยราคาของสินทรัพย์เอง",
  Basis: "Basis",
  "The smaller of the two resting sizes: what the gap is actually good for":
    "ไซส์ที่ค้างอยู่ฝั่งที่น้อยกว่า: ปริมาณที่ส่วนต่างนี้รองรับได้จริง",
  "Good for": "รองรับได้",
  "Buy price": "ราคาซื้อ",
  "Buy at": "ซื้อที่",
  "Ask size": "ไซส์ Ask",
  "Sell price": "ราคาขาย",
  "Sell at": "ขายที่",
  "Bid size": "ไซส์ Bid",
  "Exchanges quoting this asset that survived the mark-agreement check":
    "กระดานเทรดที่เสนอราคาสินทรัพย์นี้และผ่านการตรวจว่าราคา Mark ตรงกัน",
  Quoted: "เวลาเสนอราคา",
  "Price gaps across exchanges": "ส่วนต่างราคาข้ามกระดานเทรด",
  "Where one exchange's bid sits above another's ask.":
    "จุดที่ Bid ของกระดานเทรดหนึ่งสูงกว่า Ask ของอีกกระดานเทรด",
  "Price gaps": "ส่วนต่างราคา",
  "For each asset, the cheapest exchange to buy and the dearest to sell, at the top of each book. These are <b>quotable gaps</b>, not fillable trades: nothing here reflects the book below level 1, the taker fees, or the two transfers a real position needs. The widest gaps sit on the thinnest books — when this was measured, 395 of 721 assets showed any gap at a median of 1.6 bps, while the leaders were good for as little as $3 of resting size.":
    "สำหรับแต่ละสินทรัพย์ คือกระดานเทรดที่ซื้อได้ถูกที่สุดและขายได้แพงที่สุด ที่ราคาดีที่สุดของแต่ละ Order Book นี่คือ<b>ส่วนต่างที่เสนอราคาได้</b> ไม่ใช่เทรดที่ Fill ได้จริง: ไม่ได้สะท้อน Order Book ใต้ระดับแรก ค่าธรรมเนียม Taker หรือการโอนเงินสองครั้งที่โพซิชันจริงต้องใช้ ส่วนต่างที่กว้างที่สุดอยู่บน Order Book ที่บางที่สุด ตอนที่วัด สินทรัพย์ 395 จาก 721 ตัวมีส่วนต่างโดยมีค่ามัธยฐาน 1.6 bps ขณะที่อันดับต้น ๆ รองรับไซส์ที่ค้างอยู่ได้เพียง $3",
  Apply: "ใช้",
  "This venue's mark disagrees with the rest, so it is excluded from the gap":
    "ราคา Mark ของกระดานเทรดนี้ไม่ตรงกับที่อื่น จึงไม่นับรวมในส่วนต่าง",
  "Marked {ratio}× above this asset's deepest market, so it is a different instrument, not a price gap":
    "ราคา Mark สูงกว่าตลาดที่ลึกที่สุดของสินทรัพย์นี้ {ratio}× จึงเป็นคนละสัญญา ไม่ใช่ส่วนต่างราคา",
  "Marked {ratio}× below this asset's deepest market, so it is a different instrument, not a price gap":
    "ราคา Mark ต่ำกว่าตลาดที่ลึกที่สุดของสินทรัพย์นี้ {ratio}× จึงเป็นคนละสัญญา ไม่ใช่ส่วนต่างราคา",
  best: "ดีที่สุด",
  "This venue's own bid-ask spread, which a taker crosses on entry and again on exit":
    "สเปรด Bid-Ask ของกระดานเทรดนี้เอง ซึ่ง Taker ต้องข้ามตอนเข้าและอีกครั้งตอนออก",
  "This venue's funding row has not been refreshed within the freshness window, so its mark is withheld rather than shown stale — the quote beside it is live":
    "ข้อมูล Funding ของกระดานเทรดนี้ไม่ได้อัปเดตภายในช่วงเวลาที่กำหนด จึงงดแสดงราคา Mark แทนที่จะแสดงค่าเก่า ส่วนราคาเสนอข้าง ๆ ยังเป็นข้อมูลสด",
  "Quote seen {quoted}; funding row fetched {fetched}":
    "เห็นราคาเสนอ {quoted} ข้อมูล Funding ดึงมา {fetched}",
  "Every pair": "ทุกคู่",
  "One row per direction: buy at the first exchange, sell at the second. The widest gap is often not the one to take — a narrower pair can rest far more size behind it, and most directions lose outright.":
    "หนึ่งแถวต่อหนึ่งทิศทาง: ซื้อที่กระดานเทรดแรก ขายที่กระดานเทรดที่สอง ส่วนต่างที่กว้างที่สุดมักไม่ใช่ตัวที่ควรเข้า คู่ที่แคบกว่าอาจมีไซส์ค้างอยู่มากกว่าหลายเท่า และทิศทางส่วนใหญ่ขาดทุนทันที",
  "The smaller of the buying side's ask size and the selling side's bid size — what this direction is good for":
    "ค่าที่น้อยกว่าระหว่างไซส์ Ask ฝั่งซื้อกับไซส์ Bid ฝั่งขาย คือปริมาณที่ทิศทางนี้รองรับได้",
  "No two exchanges quote {asset} in a way that can be compared right now.":
    "ตอนนี้ไม่มีสองกระดานเทรดใดที่เสนอราคา {asset} ในแบบที่เทียบกันได้",
  "Buying on {buy} and selling on {sell} quotes {gap}, though one side's resting size is unknown.":
    "ซื้อบน {buy} และขายบน {sell} ได้ส่วนต่าง {gap} แต่ไม่ทราบไซส์ที่ค้างอยู่ของฝั่งหนึ่ง",
  "Buying on {buy} and selling on {sell} quotes {gap}, good for about {size}.":
    "ซื้อบน {buy} และขายบน {sell} ได้ส่วนต่าง {gap} รองรับได้ราว {size}",
  "That is a quote at the size shown, not a fillable trade: it is before fees, before the book below level 1, and before the transfer between two exchanges.":
    "นี่คือราคาเสนอที่ไซส์ตามที่แสดง ไม่ใช่เทรดที่ Fill ได้จริง: ยังไม่หักค่าธรรมเนียม ยังไม่รวม Order Book ใต้ระดับแรก และยังไม่รวมการโอนระหว่างสองกระดานเทรด",
  Status: "สถานะ",
  "{count} venue is shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "{count} กระดานเทรดแสดงเป็นสีจางและไม่นับในส่วนต่าง: {venues} ราคา Mark ของกระดานเทรดนี้ต่างจากตลาดที่ลึกที่สุดของสินทรัพย์นี้ (ตาม Open Interest) เกิน 10% ซึ่งหมายถึงสัญญาที่ขนาดหรือชื่อต่างกัน ไม่ใช่ส่วนต่างราคา การตรวจนี้คือสิ่งที่กันไม่ให้ความไม่ตรงกัน 1375× ถูกเผยแพร่เป็นโอกาส 13,660,780 bps ดูเหตุผลของแต่ละแห่งได้ที่ {status}",
  "{count} venues are shown dimmed and left out of the gap: {venues}. Their marks disagree by more than 10% with this asset's deepest market by open interest, which means a differently-sized or differently-named instrument rather than a price difference — the check that stops a 1375× mismatch being published as a 13,660,780 bps opportunity. {status} names the reason for each one.":
    "{count} กระดานเทรดแสดงเป็นสีจางและไม่นับในส่วนต่าง: {venues} ราคา Mark ของกระดานเทรดเหล่านี้ต่างจากตลาดที่ลึกที่สุดของสินทรัพย์นี้ (ตาม Open Interest) เกิน 10% ซึ่งหมายถึงสัญญาที่ขนาดหรือชื่อต่างกัน ไม่ใช่ส่วนต่างราคา การตรวจนี้คือสิ่งที่กันไม่ให้ความไม่ตรงกัน 1375× ถูกเผยแพร่เป็นโอกาส 13,660,780 bps ดูเหตุผลของแต่ละแห่งได้ที่ {status}",
  "{asset} price gaps by exchange": "ส่วนต่างราคา {asset} แยกตามกระดานเทรด",
  "{asset} best bid and ask on every exchange that quotes it, with the size resting at each.":
    "Bid และ Ask ที่ดีที่สุดของ {asset} บนทุกกระดานเทรดที่เสนอราคา พร้อมไซส์ที่ค้างอยู่แต่ละแห่ง",
  "Every exchange": "ทุกกระดานเทรด",
  "Best bid": "Bid ดีที่สุด",
  "Best ask": "Ask ดีที่สุด",
  "The venue's own bid-ask spread in basis points": "สเปรด Bid-Ask ของกระดานเทรดนี้เอง หน่วย bps",
  "Own spread": "สเปรดของตัวเอง",
  Mark: "Mark",
  "Sizes are the money resting at the very top of each book, converted to USD because the three venues that publish depth count it differently — Gate in contracts, OKX in contracts against <code>ctVal</code>, Bybit in base coin. Reading those raw, side by side, is a 10,000× error.":
    "ไซส์คือเงินที่ค้างอยู่ที่ระดับบนสุดของแต่ละ Order Book แปลงเป็น USD เพราะสามกระดานเทรดที่เผยแพร่ความลึกนับต่างกัน Gate นับเป็นสัญญา OKX นับเป็นสัญญาคูณ <code>ctVal</code> Bybit นับเป็นเหรียญหลัก ถ้าอ่านค่าดิบเทียบกันตรง ๆ จะผิดพลาดถึง 10,000×",

  // one asset
  "Best pair: long on {long} at {longApr}, short on {short} at {shortApr}, a {spread} spread per year.":
    "คู่ที่ดีที่สุด: Long ที่ {long} อัตรา {longApr} Short ที่ {short} อัตรา {shortApr} สเปรด {spread} ต่อปี",
  "Only markets with at least {minOi} open interest are paired.":
    "จับคู่เฉพาะตลาดที่มี Open Interest อย่างน้อย {minOi}",
  "Funding only, before trading fees: none were entered.":
    "เฉพาะ Funding ก่อนหักค่าธรรมเนียมเทรด: ยังไม่ได้ใส่ค่าธรรมเนียม",
  "Only one exchange lists it right now, so there's no cross-exchange pair.":
    "ตอนนี้มีกระดานเทรดเดียวที่ลิสต์ จึงไม่มีคู่ข้ามกระดานเทรด",
  "No two exchanges have at least {minOi} open interest in it, so there's no pair to show.":
    "ไม่มีสองกระดานเทรดที่มี Open Interest อย่างน้อย {minOi} จึงไม่มีคู่ให้แสดง",
  "{asset} funding rates by exchange": "Funding Rate ของ {asset} แยกตามกระดานเทรด",
  "{asset} perpetual funding rates across {count} exchanges, with the widest long/short spread.":
    "Funding Rate สัญญา Perpetual ของ {asset} ใน {count} กระดานเทรด พร้อมสเปรด Long/Short ที่กว้างที่สุด",
  "Funding by exchange": "Funding แยกตามกระดานเทรด",
  "{markets} live markets on {venues} exchanges.": "{markets} ตลาดที่เปิดอยู่ใน {venues} กระดานเทรด",
  "{asset} funding across {count} exchanges: long {long} at {longApr}, short {short} at {shortApr}. A {spread} spread a year on one coin.":
    "Funding ของ {asset} ใน {count} กระดานเทรด: Long {long} ที่ {longApr} Short {short} ที่ {shortApr} สเปรด {spread} ต่อปีบนเหรียญเดียว",
  "Backtest this pair": "Backtest คู่นี้",
  "long {long} · short {short} · {spread} a year, replayed on settled funding":
    "Long {long} · Short {short} · {spread} ต่อปี จำลองย้อนหลังจาก Funding ที่จ่ายแล้ว",
  "24h settled": "จ่ายแล้ว 24 ชม.",
  "How often this market held its funding direction over 30 days. 0.50 is a coin flip; 0.88 is the most a full month can score":
    "ความถี่ที่ตลาดนี้รักษาทิศทาง Funding ไว้ได้ใน 30 วัน 0.50 คือโยนเหรียญ 0.88 คือคะแนนสูงสุดที่เดือนเต็มทำได้",
  "Last 7 charging days against the days before them, in APR points. Up means funding is widening in the direction it already had":
    "7 วันล่าสุดที่มีการเก็บ Funding เทียบกับวันก่อนหน้า หน่วยเป็นจุด APR ขึ้นหมายถึง Funding กำลังกว้างขึ้นในทิศทางเดิม",
  "30d trend": "เทรนด์ 30 วัน",

  // pair backtest
  "capital {amount} — {venue} will not open a position above {max} on {symbol}":
    "เงินทุน {amount} — {venue} ไม่ให้เปิดโพซิชันเกิน {max} บน {symbol}",
  "capital {amount} across both legs at {leverage}": "เงินทุน {amount} รวมสองขา ที่เลเวอเรจ {leverage}",
  "capital {amount} across both legs, unleveraged": "เงินทุน {amount} รวมสองขา ไม่ใช้เลเวอเรจ",
  "capital at least {amount} across both legs — {leverage} is the small-size maximum":
    "เงินทุนอย่างน้อย {amount} รวมสองขา — {leverage} คือเลเวอเรจสูงสุดสำหรับไซส์เล็ก",
  "capital {amount} across both legs at {leverage} (small size)":
    "เงินทุน {amount} รวมสองขา ที่เลเวอเรจ {leverage} (ไซส์เล็ก)",
  "Cumulative funding reaches {amount} after {days} days":
    "Funding สะสมถึง {amount} หลังจาก {days} วัน",
  "Cumulative funding on {size} per leg · {from} to {to}":
    "Funding สะสมด้วยขาละ {size} · {from} ถึง {to}",
  "Taker fee in basis points, per fill. Both legs must be filled in before costs are charged.":
    "ค่าธรรมเนียม Taker หน่วย bps ต่อการ Fill แต่ละครั้ง ต้องใส่ทั้งสองขาก่อนจึงจะคิดต้นทุน",
  "blank = ignore": "เว้นว่าง = ไม่คิด",
  Window: "ช่วงเวลา",
  "Long on": "Long ที่",
  "Short on": "Short ที่",
  "Size per leg": "ไซส์ต่อขา",
  "Long taker fee": "ค่าธรรมเนียม Taker ขา Long",
  "Short taker fee": "ค่าธรรมเนียม Taker ขา Short",
  "Run backtest": "รัน Backtest",
  "swap legs": "สลับขา",
  "What entering and exiting would cost at each exchange's top of book":
    "ต้นทุนการเข้าและออกที่ราคาดีที่สุดของ Order Book แต่ละกระดานเทรด",
  "price gap": "ส่วนต่างราคา",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, before fees. Replayed from settled funding:":
    "Funding Carry {asset} Long {long} / Short {short}: {net} ด้วยขาละ {size} ใน {span} ล่าสุด ก่อนหักค่าธรรมเนียม จำลองย้อนหลังจาก Funding ที่จ่ายแล้ว:",
  "{asset} funding carry, long {long} / short {short}: {net} on {size} per leg over the last {span}, after fees. Replayed from settled funding:":
    "Funding Carry {asset} Long {long} / Short {short}: {net} ด้วยขาละ {size} ใน {span} ล่าสุด หลังหักค่าธรรมเนียม จำลองย้อนหลังจาก Funding ที่จ่ายแล้ว:",
  "Share on X": "แชร์บน X",
  "opens a post with this result and a link back to it": "เปิดโพสต์พร้อมผลลัพธ์นี้และลิงก์กลับมา",
  "after costs {net} on {fees} of fees": "หลังหักต้นทุน {net} จากค่าธรรมเนียม {fees}",
  "never repays the fees at this rate": "ที่อัตรานี้ไม่มีวันคืนทุนค่าธรรมเนียม",
  "fees repay in {days}": "คืนทุนค่าธรรมเนียมใน {days}",
  "under a day": "ไม่ถึง 1 วัน",
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
  "best day {amount} {date}": "วันที่ดีที่สุด {amount} {date}",
  "worst day {amount} {date}": "วันที่แย่ที่สุด {amount} {date}",
  "The largest fall in cumulative funding from a previous high, before costs":
    "การลดลงมากที่สุดของ Funding สะสมจากจุดสูงสุดก่อนหน้า ก่อนหักต้นทุน",
  "max drawdown {amount}": "Drawdown สูงสุด {amount}",
  "{days}d avg {apr}": "เฉลี่ย {days} วัน {apr}",
  "now {apr}, {average}, every {interval}": "ตอนนี้ {apr} · {average} · จ่ายทุก {interval}",
  "now {apr}, every {interval}": "ตอนนี้ {apr} · จ่ายทุก {interval}",
  "net funding over the last {span} · {apr} annualized":
    "Funding สุทธิใน {span} ล่าสุด · คิดเป็นรายปี {apr}",
  "Long {venue}": "Long {venue}",
  "{n} settlements": "{n} รอบจ่าย",
  "Short {venue}": "Short {venue}",
  "win rate {value} of {days} days": "อัตราชนะ {value} จาก {days} วัน",
  "average {value} a day": "เฉลี่ย {value} ต่อวัน",
  "Missed settlements: {long} on {longVenue}, {short} on {shortVenue}. A gap is reported rather than counted as zero, so this total covers only the settlements actually recorded.":
    "รอบจ่ายที่ขาดหาย: {long} บน {longVenue} และ {short} บน {shortVenue} ช่องว่างจะถูกรายงานแทนที่จะนับเป็นศูนย์ ยอดรวมนี้จึงครอบคลุมเฉพาะรอบจ่ายที่บันทึกได้จริง",
  "Only {have} of the {asked} days asked for have stored settlements. The annualized figure still divides by the whole window, so it reads low. The daily rollup keeps 70 days, and history is still filling on some venues.":
    "มีเพียง {have} จาก {asked} วันที่ขอที่มีรอบจ่ายบันทึกไว้ ตัวเลขรายปียังหารด้วยช่วงเวลาทั้งหมด จึงดูต่ำกว่าจริง ข้อมูลสรุปรายวันเก็บไว้ 70 วัน และบางกระดานเทรดยังเติมประวัติไม่ครบ",
  "Funding only, on a position kept at {size} per leg. Trading fees are excluded because none were given: taker fees depend on your own volume tier and discounts, so fill in both legs' fees above to see this net of costs. Price moves between settlements aren't modelled either, because venue funding history gives a rate and a time, and almost never a mark price.":
    "เฉพาะ Funding บนโพซิชันที่คงไว้ขาละ {size} ไม่รวมค่าธรรมเนียมเทรดเพราะไม่ได้ใส่ไว้: ค่าธรรมเนียม Taker ขึ้นกับระดับวอลุ่มและส่วนลดของคุณเอง ใส่ค่าธรรมเนียมทั้งสองขาด้านบนเพื่อดูผลหลังหักต้นทุน การเคลื่อนไหวของราคาระหว่างรอบจ่ายก็ไม่ได้จำลองเช่นกัน เพราะประวัติ Funding ของกระดานเทรดให้แค่อัตราและเวลา แทบไม่เคยให้ราคา Mark",
  "Net of the fees you entered, on a position kept at {size} per leg: {long} bps long and {short} bps short, charged on four fills — entry and exit on both legs. Opening and closing once is assumed; rolling the position would cost this again each time. Price moves between settlements still aren't modelled, because venue funding history gives a rate and a time, and almost never a mark price.":
    "หักค่าธรรมเนียมที่คุณใส่แล้ว บนโพซิชันที่คงไว้ขาละ {size}: Long {long} bps และ Short {short} bps คิดจากการ Fill 4 ครั้ง คือเข้าและออกทั้งสองขา สมมติว่าเปิดและปิดเพียงครั้งเดียว ถ้าโรลโพซิชันจะเสียต้นทุนนี้ซ้ำทุกครั้ง การเคลื่อนไหวของราคาระหว่างรอบจ่ายยังไม่ได้จำลอง เพราะประวัติ Funding ของกระดานเทรดให้แค่อัตราและเวลา แทบไม่เคยให้ราคา Mark",
  "Only one exchange lists {asset} right now, so there's no pair to hold.":
    "ตอนนี้มีกระดานเทรดเดียวที่ลิสต์ {asset} จึงไม่มีคู่ให้ถือ",
  "Pick two exchanges to hold against each other.": "เลือกสองกระดานเทรดเพื่อถือสวนกัน",
  "{asset} funding carry backtest": "Backtest Funding Carry ของ {asset}",
  "What holding {asset} long on one exchange and short on another would have paid in funding.":
    "ถ้าถือ {asset} Long บนกระดานเทรดหนึ่งและ Short บนอีกกระดานเทรด จะได้ Funding เท่าไร",
  backtest: "Backtest",
  "{asset} carry": "Carry {asset}",
  "Every exchange's funding over one window, and what the two legs you pick actually settled, summed per UTC day. Windows are whole calendar days ending today, and the figures refresh hourly.":
    "Funding ของทุกกระดานเทรดในช่วงเวลาหนึ่ง และยอดที่สองขาที่คุณเลือกจ่ายจริง รวมตามวัน UTC ช่วงเวลาเป็นวันเต็มตามปฏิทินจนถึงวันนี้ และตัวเลขอัปเดตทุกชั่วโมง",

  // errors
  "Too many requests": "คำขอมากเกินไป",
  "Too many backtests from this address.": "Backtest จากที่อยู่นี้มากเกินไป",
  "That is more backtests than one address may run in a minute. Wait a moment and try again. Results already computed are served from the cache and are never limited, so a combination someone has run before still loads immediately.":
    "เกินจำนวน Backtest ที่หนึ่งที่อยู่รันได้ในหนึ่งนาที รอสักครู่แล้วลองใหม่ ผลที่คำนวณไว้แล้วมาจากแคชและไม่ถูกจำกัด ชุดที่มีคนเคยรันจึงยังโหลดได้ทันที",
  "Back to the screener": "กลับไปสกรีนเนอร์",
  "Not found": "ไม่พบ",
  "Page not found.": "ไม่พบหน้านี้",
  "Nothing lives at {path}.": "ไม่มีอะไรอยู่ที่ {path}",
  "See today's widest spreads": "ดูสเปรดที่กว้างที่สุดวันนี้",
  "A runner sprinting": "นักวิ่งกำลังวิ่งสุดแรง",
  "Data center busy": "ศูนย์ข้อมูลยุ่งอยู่",
  "The data center is too busy and a runner is on it. Try again later.":
    "ศูนย์ข้อมูลยุ่งเกินไป มีนักวิ่งกำลังจัดการอยู่ ลองใหม่ภายหลัง",
  "The data center is getting too busy and is currently sprinting in circles":
    "ศูนย์ข้อมูลเริ่มยุ่งเกินไป และกำลังวิ่งวนไปมา",
  "Every server is screaming, the funding rates are on fire, and one intern is running the whole thing on foot. Go touch grass and try again later.":
    "ทุกเซิร์ฟเวอร์กำลังกรีดร้อง Funding Rate กำลังลุกเป็นไฟ และมีเด็กฝึกงานคนเดียววิ่งแบกทั้งระบบด้วยสองขา ออกไปสูดอากาศก่อนแล้วค่อยลองใหม่",
  "Try again": "ลองอีกครั้ง",
  // pages.ts invertedMark: an FX leg quoted the other way round (migration 041).
  "short this contract": "Short สัญญานี้",
  "long this contract": "Long สัญญานี้",
  "sell this contract": "ขายสัญญานี้",
  "buy this contract": "ซื้อสัญญานี้",
  "{symbol} quotes this pair the other way round, so this side of the pair is the opposite side of that contract. Its price is shown inverted and its funding with the sign flipped, in the pair's terms.":
    "{symbol} เสนอราคาคู่นี้กลับด้าน ฝั่งนี้ของคู่จึงเป็นฝั่งตรงข้ามของสัญญานั้น ราคาจึงแสดงแบบกลับค่า และ Funding กลับเครื่องหมาย ตามมุมมองของคู่",
  Now: "ตอนนี้",
  "Payback, days": "วันคืนทุน",
  Long: "Long",
  Short: "Short",
  "7d {apr}": "7 วัน {apr}",
  "Where to hold the long side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "ที่ถือฝั่ง Long: กระดานเทรดและ Funding ตอนนี้ ด้านล่างคือสัญญา รอบ Open Interest และ Funding 7 วัน",
  "Where to hold the short side: exchange and its funding now; contract, interval, open interest and 7-day funding below":
    "ที่ถือฝั่ง Short: กระดานเทรดและ Funding ตอนนี้ ด้านล่างคือสัญญา รอบ Open Interest และ Funding 7 วัน",
  "Days of the {days}-day spread it takes to repay {bps} bps of fees: a taker fill in and out of both legs, at public retail rates":
    "จำนวนวันของสเปรด {days} วันที่ต้องใช้เพื่อคืนทุนค่าธรรมเนียม {bps} bps: Taker เข้าและออกทั้งสองขา ที่อัตรารายย่อยสาธารณะ",
  "No {days} days of settlements yet, so this is from the spread now: days to repay {bps} bps of fees, a taker fill in and out of both legs, at public retail rates":
    "ยังไม่มีรอบจ่ายครบ {days} วัน จึงคำนวณจากสเปรดตอนนี้: จำนวนวันเพื่อคืนทุนค่าธรรมเนียม {bps} bps โดย Taker เข้าและออกทั้งสองขา ที่อัตรารายย่อยสาธารณะ",
  "per {unit}": "ต่อ {unit}",
  "Days of funding it takes to repay the fees of opening and closing both legs, at public retail taker rates. From the {days}-day spread; dimmed where there is only the spread now":
    "จำนวนวันของ Funding ที่ต้องใช้เพื่อคืนทุนค่าธรรมเนียมเปิดและปิดทั้งสองขา ที่อัตรา Taker รายย่อยสาธารณะ คำนวณจากสเปรด {days} วัน แสดงเป็นสีจางเมื่อมีแค่สเปรดตอนนี้",
  "The funding spread now: short leg's rate minus long leg's":
    "สเปรด Funding ตอนนี้: อัตราขา Short ลบอัตราขา Long",
  "The same two markets' spread, averaged over the settlements of the last {days} days":
    "สเปรดของสองตลาดเดียวกัน เฉลี่ยจากรอบจ่ายใน {days} วันล่าสุด",
  "dollars, or 250k, 1.5m": "ดอลลาร์ หรือ 250k, 1.5m",
  "Delete preset": "ลบพรีเซ็ต",
  "No presets yet.": "ยังไม่มีพรีเซ็ต",
  Presets: "พรีเซ็ต",
  "Preset name": "ชื่อพรีเซ็ต",
  "Preset name…": "ชื่อพรีเซ็ต…",
  Save: "บันทึก",
  "Clear all": "ล้างทั้งหมด",
  "Select all": "เลือกทั้งหมด",
  "{n} selected": "เลือกแล้ว {n}",
  Filters: "ตัวกรอง",
  "Asset class": "ประเภทสินทรัพย์",
  TradFi: "TradFi",
  "Spread now (APR %)": "สเปรดตอนนี้ (APR %)",
  "Both legs settle at this interval": "ทั้งสองขาจ่ายตามรอบนี้",
  "Funding interval": "รอบ Funding",
  "No USDT leg against a USDC one": "ไม่จับคู่ขา USDT กับขา USDC",
  "Distressed and delisting markets": "ตลาดที่มีปัญหาหรือกำลังถูกถอด",
  "Reset all": "รีเซ็ตทั้งหมด",
  Steadiness: "ความสม่ำเสมอ",
  "Funding steadiness": "ความสม่ำเสมอของ Funding",
  "How often a leg's funding kept its direction over the last 30 days: the dot beside each exchange in the Long and Short columns. The Stability column is the weaker leg's score.":
    "ความถี่ที่ Funding ของขาหนึ่งรักษาทิศทางไว้ได้ใน 30 วันล่าสุด: คือจุดข้างแต่ละกระดานเทรดในคอลัมน์ Long และ Short ส่วนคอลัมน์ความเสถียรคือคะแนนของขาที่อ่อนกว่า",
  "Holds its direction almost every day. Income you can plan on.":
    "รักษาทิศทางได้แทบทุกวัน เป็นรายได้ที่วางแผนได้",
  "Flips now and then. Usable for a carry, but size for the days it pays the other way.":
    "กลับทิศเป็นครั้งคราว ใช้ทำ Carry ได้ แต่ต้องตั้งไซส์เผื่อวันที่จ่ายกลับด้าน",
  "Flips often. Today's rate says little about next week's, and a backtest of it says less.":
    "กลับทิศบ่อย อัตราวันนี้บอกอะไรเกี่ยวกับสัปดาห์หน้าได้น้อย และ Backtest ของมันบอกได้น้อยกว่านั้น",
  "Scored by direction, not by the coefficient of variation: that explodes whenever the average rate sits near zero. 0.50 is a coin flip; 0.88 is the most a full month can score.":
    "ให้คะแนนตามทิศทาง ไม่ใช่สัมประสิทธิ์การแปรผัน ซึ่งพุ่งสูงทุกครั้งที่อัตราเฉลี่ยใกล้ศูนย์ 0.50 คือโยนเหรียญ 0.88 คือคะแนนสูงสุดที่เดือนเต็มทำได้",
  "Search asset": "ค้นหาสินทรัพย์",
  "Search asset…": "ค้นหาสินทรัพย์…",
  Period: "ช่วง",
  "Rate unit": "หน่วยอัตรา",
  Day: "วัน",
  "No settled funding to score yet": "ยังไม่มี Funding ที่จ่ายแล้วสำหรับให้คะแนน",
  "Funding held its direction on {days} of its charging days in the last 30: {band}":
    "Funding รักษาทิศทางได้ {days} ของวันที่มีการเก็บ Funding ใน 30 วันล่าสุด: {band}",
  erratic: "ไม่แน่นอน",
  mixed: "ปานกลาง",
  steady: "สม่ำเสมอ",
  Chart: "กราฟ",
  "Running the backtest…": "กำลังรัน Backtest…",
  "pick one": "เลือกหนึ่ง",
  "A price-convergence pair across two exchanges.": "คู่ราคาลู่เข้าหากันข้ามสองกระดานเทรด",
  "All quotes": "ราคาเสนอทั้งหมด",
  Average: "เฉลี่ย",
  "Best bid / ask": "Bid / Ask ดีที่สุด",
  "Bid-ask, both books": "Bid-Ask ทั้งสอง Order Book",
  "Breakeven move {pct}": "ต้องขยับ {pct} เพื่อคุ้มทุน",
  "Dollars resting at the best bid and the best ask": "ดอลลาร์ที่ค้างอยู่ที่ Bid และ Ask ที่ดีที่สุด",
  "Each hour's average mark on the two exchanges. Where a venue publishes no mark, its index stands in.":
    "ราคา Mark เฉลี่ยรายชั่วโมงบนสองกระดานเทรด ถ้ากระดานเทรดไม่เผยแพร่ราคา Mark จะใช้ราคาดัชนีแทน",
  "Entry at the top of the book": "เข้าที่ราคาดีที่สุดของ Order Book",
  "Every time in the window the spread rose to at least today's width, the hours until it next fell to the window's median. Hourly averages, so nothing shorter than an hour is seen, and the past is not a promise.":
    "ทุกครั้งในช่วงเวลานี้ที่สเปรดขึ้นไปกว้างอย่างน้อยเท่าวันนี้ นับชั่วโมงจนกว่าจะลดลงถึงค่ามัธยฐานของช่วงเวลา ใช้ค่าเฉลี่ยรายชั่วโมง จึงไม่เห็นอะไรที่สั้นกว่าหนึ่งชั่วโมง และอดีตไม่ใช่คำสัญญา",
  "Exit target: the window's median spread, {median}. Full convergence to zero is rare, and waiting for it usually makes no sense.":
    "เป้าออก: สเปรดมัธยฐานของช่วงเวลา {median} การลู่เข้าจนเป็นศูนย์เกิดขึ้นได้ยาก และการรอให้ถึงจุดนั้นมักไม่คุ้ม",
  "Fees, four taker fills": "ค่าธรรมเนียม Taker 4 ครั้ง",
  "From {n} comparable episodes in the last {window}; {open} had not closed by the end.":
    "จาก {n} ครั้งที่เทียบกันได้ใน {window} ล่าสุด {open} ครั้งยังไม่ปิดจนถึงท้ายช่วง",
  "Funding, est. {hold} hold": "Funding ประมาณการ ถือ {hold}",
  Gross: "ขั้นต้น",
  "Hold time, from history": "เวลาถือ จากประวัติ",
  "Hover the chart to read every line at one hour.": "ชี้ที่กราฟเพื่ออ่านทุกเส้นในชั่วโมงเดียวกัน",
  "If the spread closes from where it is now to each target. Fees are four taker fills, in and out of both legs. The books are each exchange's own bid-ask, crossed half on the way in and half on the way out, at the top of the book only. Funding is the short leg's rate less the long leg's over the hold, which can pay or cost.":
    "ถ้าสเปรดปิดจากจุดตอนนี้ไปถึงแต่ละเป้า ค่าธรรมเนียมคือ Taker 4 ครั้ง เข้าและออกทั้งสองขา ต้นทุน Order Book คือสเปรด Bid-Ask ของแต่ละกระดานเทรดเอง ข้ามครึ่งหนึ่งตอนเข้าและครึ่งหนึ่งตอนออก เฉพาะราคาดีที่สุดของ Order Book ส่วน Funding คืออัตราขา Short ลบอัตราขา Long ตลอดช่วงที่ถือ ซึ่งอาจได้หรือเสีย",
  "If the spread closes to": "ถ้าสเปรดปิดถึง",
  "Long leg · {venue}": "ขา Long · {venue}",
  "Long the exchange where the asset is cheaper, short the one where it is dearer, and close when the two prices meet. Price moves cancel between the legs; what is left is the gap closing, less fees, the books and funding. Marks are the exchanges' own fair prices, not fills, and the history is hourly averages.":
    "Long บนกระดานเทรดที่สินทรัพย์ถูกกว่า Short บนกระดานเทรดที่แพงกว่า แล้วปิดเมื่อสองราคามาบรรจบกัน การเคลื่อนไหวของราคาหักล้างกันระหว่างสองขา ที่เหลือคือส่วนต่างที่ปิดลง หักค่าธรรมเนียม ต้นทุน Order Book และ Funding ราคา Mark คือราคายุติธรรมของแต่ละกระดานเทรดเอง ไม่ใช่ราคาที่ Fill และประวัติเป็นค่าเฉลี่ยรายชั่วโมง",
  "Mark prices, hourly": "ราคา Mark รายชั่วโมง",
  Median: "มัธยฐาน",
  "Not verified for this exchange: the site's retail assumption of {bps} bps":
    "ยังไม่ได้ยืนยันสำหรับกระดานเทรดนี้: ใช้สมมติฐานรายย่อยของเว็บไซต์ {bps} bps",
  "Off the market median": "ห่างจากมัธยฐานตลาด",
  "One leg was listed recently or reported unevenly. The spread now is more trustworthy than the window's statistics.":
    "ขาหนึ่งเพิ่งลิสต์หรือรายงานข้อมูลไม่สม่ำเสมอ สเปรดตอนนี้น่าเชื่อถือกว่าสถิติของช่วงเวลา",
  "Over the window's hours in which both legs reported a price, from each hour's average mark.":
    "จากชั่วโมงในช่วงเวลาที่ทั้งสองขามีราคา ใช้ราคา Mark เฉลี่ยของแต่ละชั่วโมง",
  "Own bid-ask": "Bid-Ask ของตัวเอง",
  "Price history is unavailable right now. The live figures below are unaffected.":
    "ตอนนี้ยังไม่มีประวัติราคา ตัวเลขสดด้านล่างไม่ได้รับผลกระทบ",
  "Price spread, hourly": "สเปรดราคา รายชั่วโมง",
  "Profit calculator": "เครื่องคำนวณกำไร",
  Range: "พิสัย",
  "Seen {age}": "เห็นเมื่อ {age}",
  "Short leg · {venue}": "ขา Short · {venue}",
  "Sparse history ({share}% of expected samples): statistics may be unreliable.":
    "ประวัติเบาบาง ({share}% ของตัวอย่างที่ควรมี): สถิติอาจไม่น่าเชื่อถือ",
  "Spread now (mark)": "สเปรดตอนนี้ (Mark)",
  "Spread statistics": "สถิติสเปรด",
  "Std dev": "SD",
  "Swap legs": "สลับขา",
  "Taker fee": "ค่าธรรมเนียม Taker",
  "The exchange's published standard taker fee": "ค่าธรรมเนียม Taker มาตรฐานที่กระดานเทรดประกาศ",
  "The price gap between {long} and {short} for {asset}: now, after costs, and over its history.":
    "ส่วนต่างราคา {asset} ระหว่าง {long} และ {short}: ตอนนี้ หลังหักต้นทุน และตลอดประวัติ",
  "The short leg is not the dearer one right now, so there is no gap to close in this direction.":
    "ตอนนี้ขา Short ไม่ใช่ฝั่งที่แพงกว่า จึงไม่มีส่วนต่างให้ปิดในทิศทางนี้",
  "The short leg's hourly mark less the long leg's, as a share of the long leg's. The dashed lines are the spread now and the window's median.":
    "ราคา Mark รายชั่วโมงของขา Short ลบขา Long คิดเป็นสัดส่วนของขา Long เส้นประคือสเปรดตอนนี้และมัธยฐานของช่วงเวลา",
  "The short leg's mark less the long leg's, as a share of the long leg's. Marks are each exchange's fair price, not a price anyone traded at; the entry below is what the books offer.":
    "ราคา Mark ของขา Short ลบขา Long คิดเป็นสัดส่วนของขา Long ราคา Mark คือราคายุติธรรมของแต่ละกระดานเทรด ไม่ใช่ราคาที่มีคนเทรดจริง จุดเข้าด้านล่างคือสิ่งที่ Order Book เสนอ",
  "The spread is already at or below its median for the window ({median}): nothing to wait for.":
    "สเปรดอยู่ที่หรือต่ำกว่ามัธยฐานของช่วงเวลา ({median}) แล้ว: ไม่มีอะไรต้องรอ",
  "This leg's mark against the median mark of every exchange quoting the asset":
    "ราคา Mark ของขานี้เทียบกับมัธยฐานราคา Mark ของทุกกระดานเทรดที่เสนอราคาสินทรัพย์นี้",
  "This pair: long {long}, short {short}": "คู่นี้: Long {long} Short {short}",
  Ticker: "Ticker",
  "Too few comparable episodes in the last {window} to estimate how long this takes. Try a longer window.":
    "ครั้งที่เทียบกันได้ใน {window} ล่าสุดมีน้อยเกินไปที่จะประมาณเวลาได้ ลองช่วงเวลาที่ยาวขึ้น",
  "Top of book": "ราคาดีที่สุด",
  "Trade long · {venue}": "เทรด Long · {venue}",
  "Trade short · {venue}": "เทรด Short · {venue}",
  "Window {window} · {n} hours of {expected}": "ช่วงเวลา {window} · {n} จาก {expected} ชั่วโมง",
  "buying {venue}'s ask, selling {other}'s bid": "ซื้อ Ask ของ {venue} ขาย Bid ของ {other}",
  details: "รายละเอียด",
  "full convergence pays {times}× the round trip": "ถ้าลู่เข้าเต็มที่ได้ {times}× ของต้นทุนไป-กลับ",
  "long {long} · short {short}": "Long {long} · Short {short}",
  "long {long} · short {short}, good for {size}; deeper fills cost more and are not shown":
    "Long {long} · Short {short} รองรับได้ {size} การ Fill ที่ลึกกว่านี้แพงกว่าและไม่ได้แสดง",
  "market median {price} · long {long} · short {short}":
    "มัธยฐานตลาด {price} · Long {long} · Short {short}",
  median: "มัธยฐาน",
  pair: "คู่",
  "seen {long} / {short}": "เห็นเมื่อ {long} / {short}",
  "sized at {size} a leg": "ไซส์ขาละ {size}",
  "the book is thinner than this size": "Order Book บางกว่าไซส์นี้",
  "thin book: only {size} rests at those prices": "Order Book บาง: มีค้างอยู่แค่ {size} ที่ราคาเหล่านั้น",
  "typical time to close (middle half {from} to {to})": "เวลาปิดโดยทั่วไป (ครึ่งกลาง {from} ถึง {to})",
  "wider than {share}% of the last {window}'s hours": "กว้างกว่า {share}% ของชั่วโมงใน {window} ล่าสุด",
  "{asset} convergence trade": "เทรดลู่เข้า {asset}",
  "{asset} convergence trade: long {long}, short {short}":
    "เทรดลู่เข้า {asset}: Long {long} Short {short}",
  "{asset} · convergence trade": "{asset} · เทรดลู่เข้า",
  "{long} bps on the long leg and {short} bps on the short, in and out":
    "ขา Long {long} bps และขา Short {short} bps ทั้งเข้าและออก",
  "{n}th percentile": "เปอร์เซ็นไทล์ที่ {n}",
  "{venues} has no comparable {asset} book right now. Pick another exchange above.":
    "ตอนนี้ {venues} ไม่มี Order Book {asset} ที่เทียบกันได้ เลือกกระดานเทรดอื่นด้านบน",
  "~1h": "~1 ชม.",
  "~{n} days": "~{n} วัน",
  "~{n}h": "~{n} ชม.",
  "Price gap (bps)": "ส่วนต่างราคา (bps)",
  "Min resting size, thinner side": "ไซส์ค้างขั้นต่ำ ฝั่งที่บางกว่า",
  "A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid":
    "ตลาด HIP-3: ลิสต์โดยผู้ deploy ภายนอก และชำระบน Hyperliquid",
  "A HIP-3 market: listed by a third-party deployer and settled on Hyperliquid, with its own book and its own risks.":
    "ตลาด HIP-3: ลิสต์โดยผู้ deploy ภายนอก และชำระบน Hyperliquid มี Order Book และความเสี่ยงของตัวเอง",
  "A row offers a trade only with a LONG and a SHORT leg. Everything else is context.":
    "แถวหนึ่งจะเป็นเทรดได้ก็ต่อเมื่อมีขา LONG และขา SHORT ที่เหลือเป็นข้อมูลประกอบ",
  Badges: "ป้าย",
  LONG: "LONG",
  "Left out of the gap: its price disagrees with the asset's deepest market by more than a real arbitrage ever does, so it is a different instrument. Hover it for how far out.":
    "ไม่นับในส่วนต่าง: ราคาต่างจากตลาดที่ลึกที่สุดของสินทรัพย์มากกว่าที่อาร์บิทราจจริงจะเป็นได้ จึงเป็นคนละสัญญา ชี้เพื่อดูว่าห่างเท่าไร",
  "NO LIQ": "สภาพคล่องต่ำ",
  "OFF-SYNC": "ไม่ซิงก์",
  OUTLIER: "ผิดปกติ",
  "Quoted more than a minute before the price it is compared with. Pairing the two would read the asset's own move in the meantime as a gap.":
    "เสนอราคาก่อนราคาที่เทียบด้วยมากกว่าหนึ่งนาที ถ้าจับคู่สองราคานี้ จะอ่านการเคลื่อนไหวของสินทรัพย์เองในช่วงนั้นเป็นส่วนต่าง",
  "Quoted {seconds}s before the price it is compared with":
    "เสนอราคาก่อนราคาที่เทียบด้วย {seconds} วินาที",
  SHORT: "SHORT",
  "The cheapest venue: the leg you buy.": "กระดานเทรดที่ถูกที่สุด: ขาที่คุณซื้อ",
  "The dearest venue: the leg you sell.": "กระดานเทรดที่แพงที่สุด: ขาที่คุณขาย",
  "Under {volume} traded in 24 hours: a price with almost no trading behind it, which you may not be able to fill.":
    "เทรดใน 24 ชม. ไม่ถึง {volume}: เป็นราคาที่แทบไม่มีการซื้อขายรองรับ ซึ่งคุณอาจ Fill ไม่ได้",
  "VIA HL": "ผ่าน HL",
  "What the badges mean": "ความหมายของป้าย",
  "{volume} traded in 24 hours: a price with almost no trading behind it":
    "เทรดใน 24 ชม. {volume}: เป็นราคาที่แทบไม่มีการซื้อขายรองรับ",
  "Quarantined on {date}: {evidence}. Its numbers are still collected and shown here, but it is left out of the default Screener and Arbitrage rankings until the venue review clears it.":
    "ถูกกักไว้เมื่อ {date}: {evidence} ยังเก็บและแสดงตัวเลขที่นี่ แต่ไม่นับในอันดับเริ่มต้นของสกรีนเนอร์และอาร์บิทราจ จนกว่าการตรวจสอบกระดานเทรดจะปล่อยออก",
  quarantined: "ถูกกัก",
  "Quarantined exchanges are left out unless you tick them: their numbers are still collected, but not trusted to rank.":
    "กระดานเทรดที่ถูกกักจะไม่นับรวม เว้นแต่คุณติ๊กเลือก: ยังเก็บตัวเลขอยู่ แต่ไม่น่าเชื่อถือพอจะใช้จัดอันดับ",
  "Default exchanges": "กระดานเทรดเริ่มต้น",
};
