import type { Catalog } from "../../i18n";

/**
 * The Exchanges page (web/exchanges.ts) and one exchange's trading-cost section on its own page, in
 * Thai. Glossary and style: ./index.ts.
 *
 * Terms: grade เกรด (the letters S/A/B/C/D stay as written), score คะแนน, execution การส่งคำสั่ง,
 * liquidity สภาพคล่อง, activity ความคึกคัก, order book / book Order Book, mid ราคากลาง, market order
 * Market Order, depth ความลึก, credited นับรวม, basket ตะกร้าสินทรัพย์, majors เหรียญหลัก, snapshot
 * สแนปช็อต, median ค่ามัธยฐาน, fill จับคู่, book reach ระยะของ Order Book, taker fee ค่าธรรมเนียม
 * Taker, bp bp, reserves เงินสำรอง, wallets กระเป๋า, own token โทเคนของตัวเอง, clean (without the
 * exchange's own token) สุทธิ / clean reserves เงินสำรองสุทธิ, collateral หลักประกัน (protocol
 * collateral หลักประกันของโปรโตคอล), pillar ด้าน, breadth ความกว้าง, points คะแนน, n/a ไม่มีข้อมูล,
 * breakdown รายละเอียด, the leader อันดับหนึ่ง, REAL score คะแนน REAL, "#{rank} of {of} CEXs"
 * อันดับ {rank} จาก {of} CEX, quarantined กักกัน. Sizes ($10k, $100k) and bands (±0.1%, ±1%) are left
 * exactly as written; markouts stays in Latin letters, as desks write it; CEX, DEX and DefiLlama too.
 */
export const exchanges: Catalog = {
  // the grade badge and the table
  "Grade {grade}, score {score}: the breakdown": "เกรด {grade} คะแนน {score}: รายละเอียด",
  "clean, of {total} in wallets": "สุทธิ จาก {total} ในกระเป๋า",
  collateral: "หลักประกัน",
  "fee {fee}{mark}": "ค่าธรรมเนียม {fee}{mark}",
  $10k: "$10k",
  $100k: "$100k",
  "$100k did not fill on {n} of the basket's books most of the time; each counts as {bps} bp":
    "$100k จับคู่ไม่ครบบน {n} Order Book ของตะกร้าเกือบตลอดเวลา แต่ละอันนับเป็น {bps} bp",
  "The grade credits {usd} of it: depth beyond a tenth of a market's open interest, 2% of the exchange's daily volume or 5% of its clean reserves is not counted":
    "เกรดนับรวมเพียง {usd} ความลึกที่เกินหนึ่งในสิบของ Open Interest ของตลาด 2% ของวอลุ่มรายวันของกระดานเทรด หรือ 5% ของเงินสำรองสุทธิ จะไม่ถูกนับ",
  "{n} of {total} assets": "{n} จาก {total} สินทรัพย์",
  "Not measured: its order book is not read yet": "ยังไม่ได้วัด: ยังไม่ได้อ่าน Order Book ของกระดานนี้",

  // the grade's breakdown card
  Reserves: "เงินสำรอง",
  Execution: "การส่งคำสั่ง",
  Activity: "ความคึกคัก",
  Liquidity: "สภาพคล่อง",
  "not measured": "ยังไม่ได้วัด",
  "no wallets published": "ไม่เปิดเผยกระเป๋า",
  "collateral not identified: the DEXes' median": "ระบุหลักประกันไม่ได้: ใช้ค่ามัธยฐานของ DEX",
  "{clean} clean of {total} in tracked wallets": "สุทธิ {clean} จาก {total} ในกระเป๋าที่ติดตาม",
  "{usd} protocol collateral": "หลักประกันของโปรโตคอล {usd}",
  "{cost} to trade $10k, {slip} slippage at $100k":
    "ต้นทุนเทรด $10k {cost} · Slippage ที่ $100k {slip}",
  "{volume} volume; no open interest published": "วอลุ่ม {volume} ไม่เปิดเผย Open Interest",
  "{oi} open interest, {volume} volume": "Open Interest {oi} · วอลุ่ม {volume}",
  "{usd} credited within 0.1%; {n} of {total} markets hold $100k":
    "นับรวม {usd} ในช่วง 0.1% · {n} จาก {total} ตลาดมีถึง $100k",
  "#{rank} of {of} CEXs": "อันดับ {rank} จาก {of} CEX",
  "#{rank} of {of} DEXs": "อันดับ {rank} จาก {of} DEX",
  "n/a": "ไม่มีข้อมูล",
  "Built from this site's own reading of the order books and DefiLlama's reserves. n/a never counts as zero; its weight goes to the others. S from 85, A 70, B 55, C 40, else D.":
    "คำนวณจาก Order Book ที่เว็บนี้อ่านเอง และเงินสำรองจาก DefiLlama “ไม่มีข้อมูล” ไม่เคยนับเป็นศูนย์ น้ำหนักของมันจะยกให้ด้านอื่น S ตั้งแต่ 85 A 70 B 55 C 40 นอกนั้น D",
  "How the grade is built": "วิธีคำนวณเกรด",

  // the tiles
  "across {n} exchanges reporting now": "รวม {n} กระดานเทรดที่รายงานอยู่ตอนนี้",
  "as each exchange reports it": "ตามที่แต่ละกระดานเทรดรายงาน",
  "Cheapest $10k": "$10k ถูกสุด",
  "{venue}: taker fee and slippage, the basket's mix":
    "{venue}: ค่าธรรมเนียม Taker และ Slippage ตามสัดส่วนตะกร้า",
  "no book measured yet": "ยังไม่มี Order Book ที่วัดแล้ว",
  "Deepest books": "Order Book ลึกสุด",
  "{venue}: credited within 0.1% of the mid, 12 majors":
    "{venue}: นับรวมในช่วง 0.1% จากราคากลาง 12 เหรียญหลัก",

  // column heads and their tooltips
  Grade: "เกรด",
  "This site's grade after DefiLlama's REAL score: reserves, execution, activity and liquidity. A grade opens its breakdown":
    "เกรดของเว็บนี้ตามแนวคะแนน REAL ของ DefiLlama: เงินสำรอง การส่งคำสั่ง ความคึกคัก และสภาพคล่อง คลิกเกรดเพื่อดูรายละเอียด",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain without its own token, a DEX's protocol collateral":
    "สิ่งที่กระดานเทรดถือไว้ จาก DefiLlama: สำหรับ CEX คือกระเป๋าที่ติดตามบนเชนโดยไม่รวมโทเคนของตัวเอง สำหรับ DEX คือหลักประกันของโปรโตคอล",
  "Cost to trade $10k": "ต้นทุนเทรด $10k",
  "A $10k market order all in: the published standard taker fee plus what the book makes it pay beyond the mid":
    "Market Order $10k แบบรวมทุกอย่าง: ค่าธรรมเนียม Taker มาตรฐานที่ประกาศ บวกส่วนที่ Order Book ทำให้ต้องจ่ายเกินราคากลาง",
  Slippage: "Slippage",
  "What a $10k and a $100k market order pay beyond the mid, from the book, before fees":
    "ส่วนที่ Market Order $10k และ $100k จ่ายเกินราคากลาง คิดจาก Order Book ก่อนหักค่าธรรมเนียม",
  "The gap between the best bid and ask, basis points of the mid":
    "ช่องว่างระหว่าง Bid และ Ask ที่ดีที่สุด เป็น bp ของราคากลาง",
  Depth: "ความลึก",
  "Dollars resting within 0.1% and within 1% of the mid on both sides, the basket's books added up, as each exchange's public book shows them":
    "ยอดดอลลาร์ที่ตั้งรอทั้งสองฝั่งในช่วง 0.1% และ 1% จากราคากลาง รวม Order Book ทั้งตะกร้า ตามที่ Order Book สาธารณะของแต่ละกระดานเทรดแสดง",
  "Summed over the exchange's perpetual markets, as it reports them":
    "รวมจากตลาด Perpetual ของกระดานเทรด ตามที่กระดานรายงาน",
  "Live perpetual markets": "ตลาด Perpetual ที่เปิดอยู่",

  // the help panel
  "Every perpetual exchange this site collects, ranked by what trading there costs. The costs come from each exchange's public order book, read every ten minutes for twelve majors (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC); each figure is the median over the last seven days.":
    "ทุกกระดานเทรด Perpetual ที่เว็บนี้เก็บข้อมูล จัดอันดับตามต้นทุนการเทรดที่นั่น ต้นทุนมาจาก Order Book สาธารณะของแต่ละกระดาน อ่านทุกสิบนาทีสำหรับสิบสองเหรียญหลัก (BTC, ETH, SOL, XRP, DOGE, BNB, HYPE, SUI, ADA, LINK, AVAX, LTC) ทุกตัวเลขเป็นค่ามัธยฐานของเจ็ดวันล่าสุด",
  "Cost to trade $10k is a $10k market order all in: the exchange's published standard taker fee (VIP tiers, fee tokens and rebates lower it) plus what the book makes the order pay beyond the mid, half the spread included. Slippage is that second part alone, at $10k and $100k. Each asset counts by its open interest across all exchanges, so every exchange is priced on the same mix.":
    "ต้นทุนเทรด $10k คือ Market Order $10k แบบรวมทุกอย่าง: ค่าธรรมเนียม Taker มาตรฐานที่กระดานประกาศ (ระดับ VIP โทเคนส่วนลดค่าธรรมเนียม และ Rebate ทำให้ต่ำลง) บวกส่วนที่ Order Book ทำให้ออเดอร์ต้องจ่ายเกินราคากลาง รวมครึ่งหนึ่งของสเปรด Slippage คือส่วนหลังนี้อย่างเดียว ที่ $10k และ $100k แต่ละสินทรัพย์ถ่วงน้ำหนักตาม Open Interest รวมทุกกระดานเทรด ทุกกระดานจึงคิดราคาด้วยสัดส่วนเดียวกัน",
  "Depth is the dollars resting within 0.1% and within 1% of the mid, as each exchange's public book shows them. Exchanges publish only so many levels (Binance's reach about 0.15% around BTC), so the 1% figure is a lower bound and the grade uses the 0.1% one, which every measured book reaches. A single level bigger than 5% of the market's open interest counts only up to that.":
    "ความลึกคือยอดดอลลาร์ที่ตั้งรอในช่วง 0.1% และ 1% จากราคากลาง ตามที่ Order Book สาธารณะของแต่ละกระดานแสดง กระดานเทรดเปิดเผยระดับราคาได้จำกัด (ของ Binance ไปถึงราว 0.15% รอบ BTC) ตัวเลข 1% จึงเป็นขั้นต่ำ และเกรดใช้ตัวเลข 0.1% ซึ่ง Order Book ทุกอันที่วัดไปถึง ระดับราคาเดียวที่ใหญ่กว่า 5% ของ Open Interest ของตลาดจะนับได้ไม่เกินนั้น",
  "These are the books' promises, not fills: no trade is measured, so markouts (where the price goes after a fill) are not shown. The grade follows DefiLlama's REAL score: reserves 30, execution 30, activity 20, liquidity 20. A grade opens its breakdown; how each pillar is built is under the table.":
    "นี่คือสิ่งที่ Order Book เสนอไว้ ไม่ใช่การจับคู่จริง ไม่มีการวัดการซื้อขายใด ๆ จึงไม่แสดง markouts (ราคาไปทางไหนหลังจับคู่) เกรดอิงคะแนน REAL ของ DefiLlama: เงินสำรอง 30 การส่งคำสั่ง 30 ความคึกคัก 20 สภาพคล่อง 20 คลิกเกรดเพื่อดูรายละเอียด วิธีคำนวณแต่ละด้านอยู่ใต้ตาราง",

  // how the grade is built
  "{n} points": "{n} คะแนน",
  "After DefiLlama's REAL score: a weighted mean of four pillars, each 0 to 100. Sizes are on a log scale, so an exchange a tenth the size of the leader still scores about 70. A pillar this site cannot measure for an exchange hands its weight to the others and never counts as zero. CEXes and DEXes are scored together and ranked within their own kind. Fixed bands, so a new exchange does not reshuffle the rest: S from 85, A from 70, B from 55, C from 40, D below.":
    "ตามแนวคะแนน REAL ของ DefiLlama: ค่าเฉลี่ยถ่วงน้ำหนักของสี่ด้าน ด้านละ 0 ถึง 100 ขนาดคิดแบบสเกลลอการิทึม กระดานที่ใหญ่เพียงหนึ่งในสิบของอันดับหนึ่งจึงยังได้ราว 70 คะแนน ด้านที่เว็บนี้วัดให้กระดานไหนไม่ได้จะยกน้ำหนักให้ด้านอื่น และไม่นับเป็นศูนย์ CEX และ DEX ให้คะแนนร่วมกัน แต่จัดอันดับแยกตามประเภท เกณฑ์คงที่ กระดานใหม่จึงไม่ทำให้อันดับที่เหลือสลับ: S ตั้งแต่ 85 A ตั้งแต่ 70 B ตั้งแต่ 55 C ตั้งแต่ 40 ต่ำกว่านั้น D",
  "What the exchange holds, from DefiLlama: a CEX's wallets tracked on-chain, without its own token; a DEX's protocol collateral, a floor, since market makers' money can sit elsewhere. Two thirds is size against the largest; one third is whether its open interest, a day's volume and the book it shows within 1% are sizes it could back, and how much of it is its own token. A CEX publishing no wallets scores 0; a DEX whose collateral is not identified scores the DEXes' median.":
    "สิ่งที่กระดานเทรดถือไว้ จาก DefiLlama: สำหรับ CEX คือกระเป๋าที่ติดตามบนเชน ไม่รวมโทเคนของตัวเอง สำหรับ DEX คือหลักประกันของโปรโตคอล ซึ่งเป็นแค่ขั้นต่ำ เพราะเงินของ Market Maker อาจอยู่ที่อื่น สองในสามคือขนาดเทียบกับรายใหญ่ที่สุด หนึ่งในสามคือ Open Interest วอลุ่มหนึ่งวัน และ Order Book ที่แสดงในช่วง 1% อยู่ในขนาดที่เงินสำรองรองรับได้หรือไม่ และมีโทเคนของตัวเองอยู่เท่าไร CEX ที่ไม่เปิดเผยกระเป๋าได้ 0 คะแนน DEX ที่ระบุหลักประกันไม่ได้ได้ค่ามัธยฐานของ DEX",
  "What a market order costs, from each exchange's book every ten minutes over seven days: $10k all in (the published standard taker fee and the walk through the book), and what $10k and $100k pay beyond the mid, each against the cheapest exchange. DefiLlama also scores markouts and fills against the quote; those need trades, which this site does not record, so their weight goes to cost and slippage.":
    "ต้นทุนของ Market Order จาก Order Book ของแต่ละกระดานทุกสิบนาทีตลอดเจ็ดวัน: $10k แบบรวมทุกอย่าง (ค่าธรรมเนียม Taker มาตรฐานที่ประกาศ และการกินไล่ไปตาม Order Book) และส่วนที่ $10k และ $100k จ่ายเกินราคากลาง แต่ละอย่างเทียบกับกระดานที่ถูกที่สุด DefiLlama ยังให้คะแนน markouts และการจับคู่เทียบกับราคาเสนอด้วย ซึ่งต้องใช้ข้อมูลการซื้อขาย ที่เว็บนี้ไม่ได้บันทึก น้ำหนักส่วนนั้นจึงไปอยู่ที่ต้นทุนและ Slippage",
  "Open interest, credited up to three times clean reserves, and a day's volume, credited up to five times open interest, each against the leader. An exchange that publishes no open interest is scored on volume alone, credited up to three times clean reserves.":
    "Open Interest นับได้ไม่เกินสามเท่าของเงินสำรองสุทธิ และวอลุ่มหนึ่งวัน นับได้ไม่เกินห้าเท่าของ Open Interest แต่ละอย่างเทียบกับอันดับหนึ่ง กระดานที่ไม่เปิดเผย Open Interest จะคิดคะแนนจากวอลุ่มอย่างเดียว นับได้ไม่เกินสามเท่าของเงินสำรองสุทธิ",
  "Depth within 0.1% of the mid across the twelve majors, credited up to a tenth of each market's open interest, 2% of the exchange's daily volume and 5% of its clean reserves; and breadth, how many of the twelve hold $100k within 0.1%. Halved for a CEX publishing no reserves.":
    "ความลึกในช่วง 0.1% จากราคากลางของสิบสองเหรียญหลัก นับได้ไม่เกินหนึ่งในสิบของ Open Interest ของแต่ละตลาด 2% ของวอลุ่มรายวันของกระดาน และ 5% ของเงินสำรองสุทธิ รวมกับความกว้าง คือมีกี่ตัวในสิบสองที่มีถึง $100k ในช่วง 0.1% ลดครึ่งสำหรับ CEX ที่ไม่เปิดเผยเงินสำรอง",
  "These are this site's grades by DefiLlama's method, not DefiLlama's scores. What exchanges report about themselves counts only as far as it can be checked: open interest up to three times reserves, volume up to five times open interest. Reputation, age, brand and listings count not at all.":
    "นี่คือเกรดของเว็บนี้ตามวิธีของ DefiLlama ไม่ใช่คะแนนของ DefiLlama เอง ข้อมูลที่กระดานเทรดรายงานเองนับเฉพาะส่วนที่ตรวจสอบได้: Open Interest ไม่เกินสามเท่าของเงินสำรอง วอลุ่มไม่เกินห้าเท่าของ Open Interest ชื่อเสียง อายุ แบรนด์ และจำนวนเหรียญที่ลิสต์ ไม่นับเลย",

  // the page description and notes
  "Every perpetual futures exchange tracked by airrates, graded on reserves, trading cost, activity and liquidity: taker fee and slippage at $10k and $100k, depth, open interest and volume.":
    "ทุกกระดานเทรด Perpetual Futures ที่ airrates ติดตาม ให้เกรดตามเงินสำรอง ต้นทุนการเทรด ความคึกคัก และสภาพคล่อง: ค่าธรรมเนียม Taker และ Slippage ที่ $10k และ $100k ความลึก Open Interest และวอลุ่ม",
  "Order books measured since {date}; figures are the medians of the last seven days.":
    "วัด Order Book ตั้งแต่ {date} ตัวเลขเป็นค่ามัธยฐานของเจ็ดวันล่าสุด",
  "Order books are not measured yet.": "ยังไม่ได้วัด Order Book",
  "Reserves: DefiLlama, read every six hours.": "เงินสำรอง: DefiLlama อ่านทุกหกชั่วโมง",
  "Reserves are not available right now; the grade goes on without them.":
    "ตอนนี้ไม่มีข้อมูลเงินสำรอง เกรดยังคำนวณต่อโดยไม่มีส่วนนี้",
  "* No published taker fee found for {venues}: the site's default of {bps} bp is used.":
    "* ไม่พบค่าธรรมเนียม Taker ที่ประกาศไว้ของ {venues}: ใช้ค่าเริ่มต้นของเว็บ {bps} bp",
  "Not graded yet: exchanges whose order book is not read. Not collected yet: {venues}.":
    "ยังไม่ให้เกรด: กระดานเทรดที่ยังไม่ได้อ่าน Order Book ยังไม่ได้เก็บข้อมูล: {venues}",

  // one exchange's trading cost
  "not listed": "ไม่ได้ลิสต์",
  "$100k did not fill in most snapshots": "$100k จับคู่ไม่ครบในสแนปช็อตส่วนใหญ่",
  "did not fill": "จับคู่ไม่ครบ",
  "{pct}%": "{pct}%",
  "Trading cost": "ต้นทุนการเทรด",
  "{value} to trade $10k": "ต้นทุนเทรด $10k {value}",
  "taker fee {fee}{mark}": "ค่าธรรมเนียม Taker {fee}{mark}",
  "{value} slippage at $100k": "Slippage ที่ $100k {value}",
  "{value} within 0.1%": "{value} ในช่วง 0.1%",
  "What a $10k market order pays beyond the mid, before fees":
    "ส่วนที่ Market Order $10k จ่ายเกินราคากลาง ก่อนหักค่าธรรมเนียม",
  "$10k slippage": "Slippage $10k",
  "What a $100k market order pays beyond the mid, before fees":
    "ส่วนที่ Market Order $100k จ่ายเกินราคากลาง ก่อนหักค่าธรรมเนียม",
  "$100k slippage": "Slippage $100k",
  "Depth ±0.1%": "ความลึก ±0.1%",
  "Depth ±1%": "ความลึก ±1%",
  "How far from the mid the published book reached": "Order Book ที่เปิดเผยไปไกลจากราคากลางแค่ไหน",
  "Book reach": "ระยะของ Order Book",
  "Snapshots in the last seven days": "จำนวนสแนปช็อตในเจ็ดวันล่าสุด",
  Samples: "ตัวอย่าง",
  "Medians of the last seven days of snapshots of {venue}'s public order book, every ten minutes; the costs are the book's, not fills. Reserves are DefiLlama's.":
    "ค่ามัธยฐานของสแนปช็อต Order Book สาธารณะของ {venue} ในเจ็ดวันล่าสุด ทุกสิบนาที ต้นทุนมาจาก Order Book ไม่ใช่การจับคู่จริง เงินสำรองมาจาก DefiLlama",
  "Quarantined: left out of the default rankings. {evidence}":
    "กักกัน: ไม่รวมในอันดับค่าเริ่มต้น {evidence}",
  Quarantined: "กักกัน",
  "Quarantined: {venues}. Their numbers failed the venue review's checks (funding copied from another exchange, or volume and open interest far beyond what their reserves could back), so they are still collected and shown here but left out of the default Screener and Arbitrage rankings; tick them in the exchange picker to rank them.":
    "กักกัน: {venues} ตัวเลขของกระดานเหล่านี้ไม่ผ่านการตรวจสอบกระดานเทรด (Funding ลอกมาจากกระดานอื่น หรือวอลุ่มและ Open Interest สูงเกินกว่าที่เงินสำรองจะรองรับได้มาก) จึงยังเก็บข้อมูลและแสดงที่นี่ แต่ไม่รวมในอันดับค่าเริ่มต้นของสกรีนเนอร์และอาร์บิทราจ ติ๊กเลือกในตัวเลือกกระดานเทรดเพื่อจัดอันดับด้วย",
};
