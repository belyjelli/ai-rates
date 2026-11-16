import type { Catalog } from "../../i18n";

/**
 * The Rates page's Gamma Exposure tab (web/gamma.ts), its chart readout (web/slot-chart.ts), the
 * IV Walls, Ceiling & Floor and Greek tabs and the page's two tab labels, in Thai.
 * Glossary and style: ./index.ts.
 *
 * Terms: gamma exposure Gamma Exposure (GEX), option ออปชัน, call / put stay Call / Put, strike
 * Strike, expiry วันหมดอายุ, spot Spot (ราคา Spot in a sentence), dealer ดีลเลอร์, flip Flip, gamma
 * flip Gamma Flip, call wall / put wall Call Wall / Put Wall, any other wall กำแพง (IV wall กำแพง IV),
 * hedging การเฮดจ์, implied volatility ความผันผวนแฝง (IV), max pain Max Pain, premium พรีเมียม,
 * ceiling / floor เพดาน / พื้น, reaction zone โซนตอบสนอง, session รอบซื้อขาย. Delta, Vega, Theta and
 * Gamma keep their names, and so do Black-76, company, fund and index names.
 */
export const gamma: Catalog = {
  "Funding rates": "Funding Rate",
  Funding: "Funding",
  "Gamma Exposure": "Gamma Exposure",
  Gamma: "Gamma",
  "Next: {date}": "ถัดไป: {date}",
  "Next expiry": "หมดอายุถัดไป",
  "7 days": "7 วัน",
  "30 days": "30 วัน",
  "All expiries": "ทุกวันหมดอายุ",
  "Option book": "Option Book",
  Expiries: "วันหมดอายุ",
  "spot {price}": "Spot {price}",
  "net {net} per 1% move at spot {spot} · {bars} · hover or tap a strike to read it":
    "สุทธิ {net} ต่อการขยับ 1% ที่ Spot {spot} · {bars} · ชี้หรือแตะ Strike เพื่ออ่านค่า",
  "bars are each strike's calls and puts": "แท่งคือ Call และ Put ของแต่ละ Strike",
  "bars are each strike's calls and puts added": "แท่งคือ Call บวก Put ของแต่ละ Strike",
  "Net long": "Long สุทธิ",
  "Net short": "Short สุทธิ",
  "short gamma": "Short Gamma",
  "long gamma": "Long Gamma",
  View: "มุมมอง",
  view: "มุมมอง",
  "calls/puts": "Call/Put",
  "Each strike's calls above zero and its puts below":
    "Call ของแต่ละ Strike อยู่เหนือศูนย์ และ Put อยู่ใต้ศูนย์",
  net: "สุทธิ",
  "One bar per strike: its calls and puts added": "หนึ่งแท่งต่อ Strike: Call บวก Put",
  zones: "โซน",
  "Net bars, with the prices shaded where dealers would be short gamma or long it":
    "แท่งสุทธิ พร้อมแรเงาช่วงราคาที่ดีลเลอร์จะ Short Gamma หรือ Long Gamma",
  "The view switch beside the cursor draws the bars three ways: calls/puts, each strike's calls above zero and its puts below; net, the two added into one bar; and zones, the net bars with the prices shaded where the line is below zero (dealers short gamma, red) or above it (long gamma, blue).":
    "ปุ่มสลับมุมมองข้างเคอร์เซอร์วาดแท่งได้สามแบบ: Call/Put คือ Call ของแต่ละ Strike อยู่เหนือศูนย์และ Put อยู่ใต้ศูนย์ สุทธิ คือรวมทั้งสองเป็นแท่งเดียว และโซน คือแท่งสุทธิพร้อมแรเงาช่วงราคาที่เส้นอยู่ใต้ศูนย์ (ดีลเลอร์ Short Gamma สีแดง) หรือเหนือศูนย์ (Long Gamma สีน้ำเงิน)",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of exposure, either sign.":
    "Strike ที่ห่างจาก Spot เกิน ±{pct} อยู่นอกกราฟ: Exposure {usd} นับทั้งบวกและลบ",
  "flip {price}": "Flip {price}",
  "{currency} · {source} options · gamma exposure by strike · {scope}":
    "{currency} · ออปชัน {source} · Gamma Exposure ตาม Strike · {scope}",
  Calls: "Call",
  Puts: "Put",
  "Net if the spot moved there": "สุทธิหาก Spot ขยับไปที่นั่น",
  Spot: "Spot",
  "{currency} strike bands; arrow keys read one at a time":
    "ช่วง Strike ของ {currency} ใช้ปุ่มลูกศรอ่านทีละช่วง",
  "{currency} options gamma exposure by strike": "Gamma Exposure ของออปชัน {currency} ตาม Strike",
  "net gamma keeps one sign within ±30% of the spot":
    "Net Gamma ไม่เปลี่ยนเครื่องหมายภายใน ±30% ของ Spot",
  "{pct} from spot; net gamma changes sign here": "ห่างจาก Spot {pct} Net Gamma เปลี่ยนเครื่องหมายที่นี่",
  "Net gamma exposure": "Net Gamma Exposure",
  "per 1% move · dealers long gamma: their hedging damps moves":
    "ต่อการขยับ 1% · ดีลเลอร์ Long Gamma: การเฮดจ์ของพวกเขาช่วยหน่วงการเคลื่อนไหว",
  "per 1% move · dealers short gamma: their hedging adds to moves":
    "ต่อการขยับ 1% · ดีลเลอร์ Short Gamma: การเฮดจ์ของพวกเขาเร่งการเคลื่อนไหว",
  "Gamma flip": "Gamma Flip",
  "Call wall / put wall": "Call Wall / Put Wall",
  "the strikes holding the most call and put gamma": "Strike ที่มี Gamma ของ Call และ Put มากที่สุด",
  "calls / puts at the spot · put/call {ratio} · {options} options, {expiries} expiries":
    "Call / Put ที่ Spot · Put/Call {ratio} · {options} ออปชัน {expiries} วันหมดอายุ",
  "calls / puts at the spot · put/call {ratio} · {options} options, one expiry":
    "Call / Put ที่ Spot · Put/Call {ratio} · {options} ออปชัน หนึ่งวันหมดอายุ",
  "By expiry": "ตามวันหมดอายุ",
  Expiry: "วันหมดอายุ",
  Left: "เหลือ",
  Options: "ออปชัน",
  "Call OI ({unit})": "Call OI ({unit})",
  "Put OI ({unit})": "Put OI ({unit})",
  Net: "สุทธิ",
  "Of the chain's exposure, either sign counted": "สัดส่วนของ Exposure ทั้งหมด นับทั้งบวกและลบ",
  Share: "สัดส่วน",
  "Exposure in dollars per 1% move. Expiries outside the chosen range are dimmed. Every Deribit option expires at 08:00 UTC; one in its last hour is left out.":
    "Exposure เป็นดอลลาร์ต่อการขยับ 1% วันหมดอายุนอกช่วงที่เลือกจะแสดงจางลง ออปชันของ Deribit ทุกตัวหมดอายุเวลา 08:00 UTC ตัวที่อยู่ในชั่วโมงสุดท้ายจะไม่นับ",
  "Gamma exposure is how much of the underlying the holders of its options would have to buy or sell to stay hedged for a 1% move in price: each option's gamma times its open interest, per 1% move in the currency the contract pays, added up by strike.":
    "Gamma Exposure คือปริมาณสินทรัพย์อ้างอิงที่ผู้ถือออปชันต้องซื้อหรือขายเพื่อคงการเฮดจ์ไว้เมื่อราคาขยับ 1%: Gamma ของแต่ละออปชันคูณ Open Interest ต่อการขยับ 1% ในสกุลเงินที่สัญญาจ่าย แล้วรวมตาม Strike",
  "Calls count positive and puts negative. That is the standard reading, and an assumption: it takes dealers to be long the calls customers sold them and short the puts customers bought. No exchange publishes who holds which side, so every signed figure here rests on it; where open interest and gamma sit does not.":
    "Call นับเป็นบวกและ Put นับเป็นลบ นี่คือการอ่านมาตรฐานและเป็นสมมติฐาน: ถือว่าดีลเลอร์ Long Call ที่ลูกค้าขายให้ และ Short Put ที่ลูกค้าซื้อไป ไม่มีกระดานเทรดไหนเปิดเผยว่าใครถือฝั่งไหน ตัวเลขที่มีเครื่องหมายทั้งหมดที่นี่จึงอิงสมมติฐานนี้ ส่วนตำแหน่งของ Open Interest และ Gamma ไม่ได้อิง",
  "Positive net exposure means dealers sell into rises and buy into falls, which tends to damp moves; negative means they chase the price, which tends to add to them. The flip is where the net would change sign were the spot to move there, and the line shows the net at every such price. The walls are the strikes holding the most call and put gamma.":
    "Net Exposure เป็นบวกหมายถึงดีลเลอร์ขายตอนราคาขึ้นและซื้อตอนราคาลง ซึ่งมักหน่วงการเคลื่อนไหว ถ้าเป็นลบหมายถึงพวกเขาไล่ตามราคา ซึ่งมักเร่งการเคลื่อนไหว Flip คือจุดที่ยอดสุทธิจะเปลี่ยนเครื่องหมายหาก Spot ขยับไปถึง และเส้นแสดงยอดสุทธิที่ทุกระดับราคา กำแพงคือ Strike ที่มี Gamma ของ Call และ Put มากที่สุด",
  "Crypto: Deribit's BTC and ETH books, which hold most listed crypto options; Bybit, OKX and Binance list far fewer and are not included. Open interest, mark volatility and each expiry's forward are Deribit's own; gamma is computed from them with Black-76, which reproduces Deribit's own delta and vega. Read every five minutes.":
    "คริปโต: Book ของ BTC และ ETH บน Deribit ซึ่งมีออปชันคริปโตที่ลิสต์อยู่ส่วนใหญ่ Bybit, OKX และ Binance ลิสต์น้อยกว่ามากจึงไม่ได้นับ Open Interest, Mark Volatility และราคา Forward ของแต่ละวันหมดอายุเป็นของ Deribit เอง Gamma คำนวณจากข้อมูลเหล่านี้ด้วย Black-76 ซึ่งได้ Delta และ Vega ตรงกับของ Deribit อ่านทุกห้านาที",
  "United States: Cboe's 15-minute delayed chains for the S&amp;P 500, Nasdaq-100 and Russell 2000 indexes and the most traded ETFs and stocks, with Cboe's own volatility and open interest, the spot taken as the forward. Read every 15 minutes through the US session; outside it the figures are the last session's.":
    "สหรัฐฯ: Option Chain ของ Cboe ที่ล่าช้า 15 นาที สำหรับดัชนี S&amp;P 500, Nasdaq-100 และ Russell 2000 รวมถึง ETF และหุ้นที่ซื้อขายมากที่สุด ใช้ความผันผวนและ Open Interest ของ Cboe เอง โดยใช้ Spot เป็นราคา Forward อ่านทุก 15 นาทีตลอดรอบซื้อขายสหรัฐฯ นอกรอบนั้นตัวเลขเป็นของรอบล่าสุด",
  "Chips and memory: the same Cboe chains for the chip, memory and hardware stocks and ETFs the perps trade most. SK hynix is its Nasdaq ADR (SKHY), the price the SKHY perps follow; the SKHYNIX perps quote one Seoul share instead. Samsung's options trade only on the Korea Exchange and are not read yet, and neither Deribit nor Binance lists options on stocks.":
    "ชิปและหน่วยความจำ: Option Chain ชุดเดียวกันของ Cboe สำหรับหุ้นและ ETF กลุ่มชิป หน่วยความจำ และฮาร์ดแวร์ที่ Perp ซื้อขายมากที่สุด SK hynix ใช้ ADR บน Nasdaq (SKHY) ซึ่งเป็นราคาที่ Perp ของ SKHY อ้างอิง ส่วน Perp ของ SKHYNIX อ้างอิงหุ้นหนึ่งหุ้นในโซลแทน ออปชันของ Samsung ซื้อขายเฉพาะบน Korea Exchange และยังไม่ได้อ่าน และทั้ง Deribit และ Binance ไม่มีออปชันหุ้น",
  "Biotech and health, and Metals and mining: the same Cboe chains for the drug makers, health care and biotech funds, and for the gold, silver and copper miners, their funds, gold and silver themselves (GLD, SLV), and the lithium, nickel and rare-earth producers batteries need. The perps trade few of them; a book is kept when its open interest is about $0.5B or more, which leaves out the small lithium names.":
    "ไบโอเทคและสุขภาพ และโลหะและเหมืองแร่: Option Chain ชุดเดียวกันของ Cboe สำหรับบริษัทยา กองทุนสุขภาพและไบโอเทค บริษัทเหมืองทองคำ เงิน และทองแดง กองทุนของกลุ่มนี้ ตัวทองคำและเงินเอง (GLD, SLV) และผู้ผลิตลิเทียม นิกเกิล และแร่หายากที่แบตเตอรี่ต้องใช้ Perp ซื้อขายเพียงไม่กี่ตัว Book จะถูกเก็บไว้เมื่อ Open Interest ราว $0.5B ขึ้นไป หุ้นลิเทียมรายเล็กจึงไม่ได้นับ",
  "Asia-Pacific and Europe: each exchange's end-of-day file, read once after it is published -- HKEX (Hang Seng indexes), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225, its three nearest months), ASX (S&amp;P/ASX 200), NSE and BSE (Nifty, Sensex) and Eurex (Euro Stoxx 50, DAX, SMI). They publish settlement prices and open interest but no volatility, so each strike's is backed out of its out-of-the-money settlement (for ASX, its closing theoretical price) with Black-76, against the forward that put-call parity or the exchange's own future gives. Their figures are in the currency the contract pays, and as of that day's close.":
    "เอเชียแปซิฟิกและยุโรป: ไฟล์สิ้นวันของแต่ละตลาด อ่านหนึ่งครั้งหลังเผยแพร่ — HKEX (ดัชนี Hang Seng), CFFEX (CSI 300, SSE 50, CSI 1000), TAIFEX (TAIEX), JPX (Nikkei 225 สามเดือนที่ใกล้ที่สุด), ASX (S&amp;P/ASX 200), NSE และ BSE (Nifty, Sensex) และ Eurex (Euro Stoxx 50, DAX, SMI) ตลาดเหล่านี้เผยแพร่ราคาชำระและ Open Interest แต่ไม่มีความผันผวน ความผันผวนของแต่ละ Strike จึงคำนวณย้อนจากราคาชำระฝั่ง Out-of-the-Money (สำหรับ ASX ใช้ราคาทฤษฎีตอนปิด) ด้วย Black-76 เทียบกับราคา Forward จาก Put-Call Parity หรือ Futures ของตลาดเอง ตัวเลขเป็นสกุลเงินที่สัญญาจ่าย ณ ราคาปิดของวันนั้น",
  "Indonesia: the IDX lists no options on the Jakarta Composite and no exchange lists a perp on it, so Indonesia's book is Cboe's chain for the iShares MSCI Indonesia ETF (EIDO), in dollars, shown under Asia-Pacific. It follows MSCI's Indonesia index, not the Jakarta Composite, and it is thin: about eleven thousand contracts open in four expiries.":
    "อินโดนีเซีย: IDX ไม่มีออปชันบนดัชนี Jakarta Composite และไม่มีกระดานเทรดไหนลิสต์ Perp ของดัชนีนี้ Book ของอินโดนีเซียจึงเป็น Option Chain ของ Cboe สำหรับ iShares MSCI Indonesia ETF (EIDO) เป็นดอลลาร์ แสดงในกลุ่มเอเชียแปซิฟิก กองทุนนี้อิงดัชนี MSCI Indonesia ไม่ใช่ Jakarta Composite และสภาพคล่องบาง: ราวหนึ่งหมื่นหนึ่งพันสัญญาที่เปิดอยู่ในสี่วันหมดอายุ",
  "The options data could not be read right now.": "อ่านข้อมูลออปชันไม่ได้ในขณะนี้",
  "No gamma exposure has been computed for {currency} yet.":
    "ยังไม่ได้คำนวณ Gamma Exposure ของ {currency}",
  "{source}'s {currency} options were last read {ago}, too long ago to show as current positioning.":
    "ออปชัน {currency} ของ {source} อ่านล่าสุด{ago} นานเกินกว่าจะแสดงเป็นสถานะปัจจุบัน",
  "Not updated since {ago}: the latest read of {source} failed, so these figures are that old.":
    "ไม่ได้อัปเดตตั้งแต่{ago}: การอ่าน {source} ครั้งล่าสุดล้มเหลว ตัวเลขเหล่านี้จึงเก่าเท่านั้น",
  "Not updated since {ago}: nothing newer has been read from {source}, a holiday or a failed read, so these figures are that old.":
    "ไม่ได้อัปเดตตั้งแต่{ago}: ไม่มีข้อมูลใหม่จาก {source} อาจเป็นวันหยุดหรืออ่านไม่สำเร็จ ตัวเลขเหล่านี้จึงเก่าเท่านั้น",
  "No expiry in this range": "ไม่มีวันหมดอายุในช่วงนี้",
  "No {currency} option expires in this range; the nearest expires {date}.":
    "ไม่มีออปชัน {currency} หมดอายุในช่วงนี้ ตัวที่ใกล้ที่สุดหมดอายุ {date}",
  "No strike has open interest in this range.": "ไม่มี Strike ที่มี Open Interest ในช่วงนี้",
  "Calls positive, puts negative: dealers assumed long calls and short puts, since no exchange publishes who holds which side. {source} options, {asof}.":
    "Call เป็นบวก Put เป็นลบ: สมมติว่าดีลเลอร์ Long Call และ Short Put เพราะไม่มีกระดานเทรดไหนเปิดเผยว่าใครถือฝั่งไหน ออปชัน {source} {asof}",
  "read {ago}": "อ่าน{ago}",
  "15-minute delayed, read {ago}": "ล่าช้า 15 นาที อ่าน{ago}",
  "from the end-of-day file for {date}": "จากไฟล์สิ้นวันของ {date}",
  expired: "หมดอายุแล้ว",
  "Call OI": "Call OI",
  "Put OI": "Put OI",
  "Exposure in {unit} per 1% move; open interest at its value at the spot. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Exposure เป็น {unit} ต่อการขยับ 1% Open Interest คิดมูลค่าที่ Spot วันหมดอายุนอกช่วงที่เลือกจะแสดงจางลง ออปชันที่อยู่ในชั่วโมงสุดท้ายจะไม่นับ",
  // The book picker.
  "Pick an option book": "เลือก Option Book",
  "{n} books": "{n} Book",
  "Filter books": "กรอง Book",
  Book: "Book",
  "Net gamma": "Net Gamma",
  "Every expiry, per 1% move, in the currency the contract pays":
    "ทุกวันหมดอายุ ต่อการขยับ 1% ในสกุลเงินที่สัญญาจ่าย",
  "Calls / puts": "Call / Put",
  Flip: "Flip",
  "Where net gamma changes sign, from the spot": "จุดที่ Net Gamma เปลี่ยนเครื่องหมาย วัดจาก Spot",
  "As of": "ณ",
  "No book matches.": "ไม่มี Book ที่ตรงกัน",
  "calls {calls} · puts {puts}": "Call {calls} · Put {puts}",
  "close {date}": "ปิด {date}",
  Crypto: "คริปโต",
  "United States": "สหรัฐฯ",
  "Chips and memory": "ชิปและหน่วยความจำ",
  "Biotech and health": "ไบโอเทคและสุขภาพ",
  "Metals and mining": "โลหะและเหมืองแร่",
  "Asia-Pacific": "เอเชียแปซิฟิก",
  Europe: "ยุโรป",
  Other: "อื่น ๆ",
  Bitcoin: "บิตคอยน์",
  Ether: "อีเธอร์",
  "S&P 500": "S&P 500",
  "Nasdaq-100": "Nasdaq-100",
  "Russell 2000": "Russell 2000",
  "SPDR S&P 500 ETF": "SPDR S&P 500 ETF",
  "Invesco QQQ": "Invesco QQQ",
  "iShares Russell 2000 ETF": "iShares Russell 2000 ETF",
  "SPDR Gold Shares": "SPDR Gold Shares",
  "iShares Silver Trust": "iShares Silver Trust",
  "United States Oil Fund": "United States Oil Fund",
  "iShares Bitcoin Trust": "iShares Bitcoin Trust",
  "iShares Ethereum Trust": "iShares Ethereum Trust",
  Strategy: "Strategy",
  Coinbase: "Coinbase",
  NVIDIA: "NVIDIA",
  Tesla: "Tesla",
  Micron: "Micron",
  "SK hynix (ADR)": "SK hynix (ADR)",
  Sandisk: "Sandisk",
  "Western Digital": "Western Digital",
  Seagate: "Seagate",
  "Roundhill Memory ETF": "Roundhill Memory ETF",
  AMD: "AMD",
  Broadcom: "Broadcom",
  "TSMC (ADR)": "TSMC (ADR)",
  Intel: "Intel",
  Marvell: "Marvell",
  Arm: "Arm",
  Qualcomm: "Qualcomm",
  ASML: "ASML",
  "Applied Materials": "Applied Materials",
  "Lam Research": "Lam Research",
  KLA: "KLA",
  Dell: "Dell",
  Supermicro: "Supermicro",
  Lumentum: "Lumentum",
  Coherent: "Coherent",
  "Applied Optoelectronics": "Applied Optoelectronics",
  Corning: "Corning",
  "VanEck Semiconductor ETF": "VanEck Semiconductor ETF",
  "iShares Semiconductor ETF": "iShares Semiconductor ETF",
  "Direxion Semiconductor Bull 3X": "Direxion Semiconductor Bull 3X",
  "iShares MSCI South Korea ETF": "iShares MSCI South Korea ETF",
  "iShares MSCI Indonesia ETF": "iShares MSCI Indonesia ETF",
  "Direxion Semiconductor Bear 3X": "Direxion Semiconductor Bear 3X",
  "Direxion Micron Bull 2X": "Direxion Micron Bull 2X",
  "Direxion South Korea Bull 3X": "Direxion South Korea Bull 3X",
  "Eli Lilly": "Eli Lilly",
  UnitedHealth: "UnitedHealth",
  Moderna: "Moderna",
  "Health Care Select Sector SPDR": "Health Care Select Sector SPDR",
  "Johnson & Johnson": "Johnson & Johnson",
  "SPDR S&P Biotech ETF": "SPDR S&P Biotech ETF",
  AbbVie: "AbbVie",
  Merck: "Merck",
  Pfizer: "Pfizer",
  "Novo Nordisk (ADR)": "Novo Nordisk (ADR)",
  "Intuitive Surgical": "Intuitive Surgical",
  Amgen: "Amgen",
  "Thermo Fisher": "Thermo Fisher",
  Regeneron: "Regeneron",
  Gilead: "Gilead",
  "Tempus AI": "Tempus AI",
  Vertex: "Vertex",
  "AstraZeneca (ADR)": "AstraZeneca (ADR)",
  "Hims & Hers": "Hims & Hers",
  Biogen: "Biogen",
  "iShares Biotechnology ETF": "iShares Biotechnology ETF",
  "Viking Therapeutics": "Viking Therapeutics",
  "VanEck Gold Miners ETF": "VanEck Gold Miners ETF",
  Newmont: "Newmont",
  Barrick: "Barrick",
  "Agnico Eagle": "Agnico Eagle",
  "VanEck Junior Gold Miners ETF": "VanEck Junior Gold Miners ETF",
  "Wheaton Precious Metals": "Wheaton Precious Metals",
  "Kinross Gold": "Kinross Gold",
  "First Majestic Silver": "First Majestic Silver",
  "Amplify Junior Silver Miners ETF": "Amplify Junior Silver Miners ETF",
  "Hecla Mining": "Hecla Mining",
  "Pan American Silver": "Pan American Silver",
  "Global X Silver Miners ETF": "Global X Silver Miners ETF",
  "Coeur Mining": "Coeur Mining",
  "Freeport-McMoRan": "Freeport-McMoRan",
  "Global X Copper Miners ETF": "Global X Copper Miners ETF",
  "BHP (ADR)": "BHP (ADR)",
  "Rio Tinto (ADR)": "Rio Tinto (ADR)",
  "Southern Copper": "Southern Copper",
  "Vale (ADR)": "Vale (ADR)",
  Albemarle: "Albemarle",
  "MP Materials": "MP Materials",
  "USA Rare Earth": "USA Rare Earth",
  "Hang Seng": "Hang Seng",
  "Hang Seng China Enterprises": "Hang Seng China Enterprises",
  "Hang Seng TECH": "Hang Seng TECH",
  "CSI 300": "CSI 300",
  "SSE 50": "SSE 50",
  "CSI 1000": "CSI 1000",
  TAIEX: "TAIEX",
  "Nikkei 225": "Nikkei 225",
  "S&P/ASX 200": "S&P/ASX 200",
  "Nifty 50": "Nifty 50",
  "Nifty Bank": "Nifty Bank",
  "BSE Sensex": "BSE Sensex",
  "Euro Stoxx 50": "Euro Stoxx 50",
  DAX: "DAX",
  "Swiss Market Index": "Swiss Market Index",
  // Chart readout (slot-chart.ts).
  "strike {strikes} ({pct} from spot)": "Strike {strikes} (ห่างจาก Spot {pct})",
  "{low} – {high} ({pct} from spot)": "{low} – {high} (ห่างจาก Spot {pct})",
  "no open interest here": "ไม่มี Open Interest ที่นี่",
  "calls {usd} ({oi} open)": "Call {usd} (เปิดอยู่ {oi})",
  "puts {usd} ({oi} open)": "Put {usd} (เปิดอยู่ {oi})",
  "net {usd}": "สุทธิ {usd}",
  "if the spot were here: net {usd}": "หาก Spot อยู่ที่นี่: สุทธิ {usd}",
  "Expected price move": "การเคลื่อนไหวราคาที่คาดไว้",
  "1 day ahead": "1 วันข้างหน้า",
  "1 week ahead": "1 สัปดาห์ข้างหน้า",
  "30 days ahead": "30 วันข้างหน้า",
  "to the {date} expiry": "ถึงวันหมดอายุ {date}",
  "IV {iv}": "IV {iv}",
  "ATM IV": "ATM IV",
  "Implied volatility at the expiry's forward, a year": "ความผันผวนแฝงที่ราคา Forward ของวันหมดอายุ ต่อปี",
  "closed inside 1σ on {one} and 2σ on {two} of days since {year}":
    "ตั้งแต่ปี {year} ปิดภายใน 1σ {one} ของวัน และภายใน 2σ {two} ของวัน",
  "expected move, 1σ and 2σ, {horizon}": "การเคลื่อนไหวที่คาดไว้ 1σ และ 2σ {horizon}",
  "spot · {source} IV": "Spot · IV ของ {source}",
  "One standard deviation is the price × IV × √(days/365), from each expiry's at-the-money implied volatility (between two expiries, their total variance interpolated). The walls are one and two deviations either side of the spot. A normal distribution ends inside them 68% and 95% of the time; real prices have fatter tails, and options usually price in more movement than follows.":
    "หนึ่งส่วนเบี่ยงเบนมาตรฐาน = ราคา × IV × √(วัน/365) จากความผันผวนแฝง At-the-Money ของแต่ละวันหมดอายุ (ระหว่างสองวันหมดอายุใช้การประมาณค่าความแปรปรวนรวม) กำแพงอยู่ห่างจาก Spot หนึ่งและสองส่วนเบี่ยงเบนทั้งสองฝั่ง การแจกแจงปกติจะจบภายในกำแพง 68% และ 95% ของเวลา ราคาจริงมีหางหนากว่า และออปชันมักตั้งราคาการเคลื่อนไหวไว้มากกว่าที่เกิดจริง",
  "The last line of a branch is how often it really did, from Deribit's 30-day volatility index (DVOL) and the perpetual's daily settlement: one 30-day IV for every horizon, and overlapping windows, so frequencies rather than independent trials.":
    "บรรทัดสุดท้ายของแต่ละกิ่งคือความถี่ที่เกิดขึ้นจริง จากดัชนีความผันผวน 30 วันของ Deribit (DVOL) และราคาชำระรายวันของ Perpetual: ใช้ IV 30 วันค่าเดียวกับทุกระยะ และช่วงเวลาทับซ้อนกัน จึงเป็นความถี่ ไม่ใช่การทดลองที่เป็นอิสระต่อกัน",
  "The expected move is the range the options have priced in: one standard deviation is the price times the at-the-money implied volatility times the square root of the days ahead over 365, and the walls sit one and two deviations either side of the spot. The chart draws them for the chosen expiries (30 days ahead for all of them); the mind map under it gives every horizon. They are not support or resistance, only the market's own estimate of how far price may travel.":
    "การเคลื่อนไหวที่คาดไว้คือกรอบที่ออปชันตั้งราคาไว้แล้ว: หนึ่งส่วนเบี่ยงเบนมาตรฐานคือราคาคูณความผันผวนแฝง At-the-Money คูณรากที่สองของจำนวนวันข้างหน้าหารด้วย 365 และกำแพงอยู่ห่างจาก Spot หนึ่งและสองส่วนเบี่ยงเบนทั้งสองฝั่ง กราฟวาดตามวันหมดอายุที่เลือก (30 วันข้างหน้าเมื่อเลือกทั้งหมด) ส่วน Mind Map ด้านล่างแสดงทุกระยะ สิ่งเหล่านี้ไม่ใช่แนวรับหรือแนวต้าน เป็นเพียงการประเมินของตลาดเองว่าราคาอาจไปได้ไกลแค่ไหน",
  reference: "ราคาอ้างอิง",
  Level: "ระดับ",
  "From the reference": "จากราคาอ้างอิง",
  "the next session": "รอบซื้อขายถัดไป",
  "{date}, from 08:00 UTC": "{date} ตั้งแต่ 08:00 UTC",
  "{date} session": "รอบซื้อขาย {date}",
  "no trade yet today": "วันนี้ยังไม่มีการซื้อขาย",
  "above it now": "ตอนนี้อยู่เหนือกำแพง",
  "below it now": "ตอนนี้อยู่ใต้กำแพง",
  "reached it today and back inside": "วันนี้แตะแล้วกลับเข้ามาในกรอบ",
  "inside all day so far": "อยู่ในกรอบทั้งวันจนถึงตอนนี้",
  "No history is kept for this book's walls yet, so its 90% wall is the normal distribution's 1.645 standard deviations of the options' own IV, not a measured one. Its record starts with its first day below.":
    "ยังไม่มีประวัติกำแพงของ Book นี้ กำแพง 90% จึงใช้ 1.645 ส่วนเบี่ยงเบนมาตรฐานของการแจกแจงปกติจาก IV ของออปชันเอง ไม่ใช่ค่าที่วัดได้ สถิติของมันเริ่มจากวันแรกด้านล่าง",
  "Measured on {days} sessions since {since} {year}, against Cboe's 1-day VIX: the S&amp;P 500 closed inside one standard deviation on {inside1}, and within {k90} of them on 90%, so that is where the 90% wall sits. Cboe's free history has the index's closes only, so touches of a wall during the day are not counted here; this book's own record below counts them.":
    "วัดจาก {days} รอบซื้อขายตั้งแต่ {since} {year} เทียบกับ VIX 1 วันของ Cboe: S&amp;P 500 ปิดภายในหนึ่งส่วนเบี่ยงเบนมาตรฐาน {inside1} และภายใน {k90} ส่วนเบี่ยงเบน 90% กำแพง 90% จึงอยู่ตรงนั้น ประวัติฟรีของ Cboe มีเฉพาะราคาปิดของดัชนี การแตะกำแพงระหว่างวันจึงไม่ได้นับที่นี่ สถิติของ Book นี้เองด้านล่างนับให้",
  "Measured on {days} Deribit days since {since} {year}, against the 30-day volatility index (DVOL) as each day began: the whole day stayed within {k90} standard deviations on 90% of days, so that is where the 90% wall sits. Within one, the whole day stayed on {inside1} and the close on {close1}. A touch of the 1σ wall closed back inside {rev1} of {touch1} times; a touch of the 90% wall, {rev90} of {touch90} times.":
    "วัดจาก {days} วันของ Deribit ตั้งแต่ {since} {year} เทียบกับดัชนีความผันผวน 30 วัน (DVOL) ตอนเริ่มแต่ละวัน: 90% ของวันทั้งวันอยู่ภายใน {k90} ส่วนเบี่ยงเบนมาตรฐาน กำแพง 90% จึงอยู่ตรงนั้น ภายในหนึ่งส่วนเบี่ยงเบน ทั้งวันอยู่ได้ {inside1} และราคาปิดอยู่ได้ {close1} การแตะกำแพง 1σ แล้วปิดกลับเข้ากรอบ {rev1} จาก {touch1} ครั้ง การแตะกำแพง 90% {rev90} จาก {touch90} ครั้ง",
  "not reached": "ยังไม่แตะ",
  "reached, closed back inside": "แตะแล้ว ปิดกลับเข้ากรอบ",
  "closed beyond": "ปิดนอกกำแพง",
  "above: {what}": "ด้านบน: {what}",
  "below: {what}": "ด้านล่าง: {what}",
  "The IV wall is the move the options price for the day: the reference close plus and minus one standard deviation, the close times the options' implied volatility a day ahead times the square root of 1/365. The levels are fixed when the day begins (Deribit's day at 08:00 UTC, a US session at its first read) so they do not drift through the day.":
    "กำแพง IV คือการเคลื่อนไหวที่ออปชันตั้งราคาไว้สำหรับวันนั้น: ราคาปิดอ้างอิงบวกและลบหนึ่งส่วนเบี่ยงเบนมาตรฐาน คือราคาปิดคูณความผันผวนแฝงของออปชันหนึ่งวันข้างหน้าคูณรากที่สองของ 1/365 ระดับเหล่านี้ถูกกำหนดตอนเริ่มวัน (วันของ Deribit เริ่ม 08:00 UTC รอบซื้อขายสหรัฐฯ ใช้การอ่านครั้งแรก) จึงไม่เลื่อนไปมาระหว่างวัน",
  "The 90% wall is where history says price stayed: the multiple of a day's standard deviation that held on 90% of past days. BTC and ETH are measured on every Deribit day since 2021 against DVOL, their whole day's range; the S&amp;P 500 on every session since 2022 against Cboe's 1-day VIX, closes only. A book with no history uses the normal distribution's 1.645.":
    "กำแพง 90% คือกรอบที่ประวัติบอกว่าราคาอยู่ภายใน: จำนวนเท่าของส่วนเบี่ยงเบนมาตรฐานรายวันที่ยืนได้ใน 90% ของวันที่ผ่านมา BTC และ ETH วัดจากทุกวันของ Deribit ตั้งแต่ 2021 เทียบกับ DVOL ใช้กรอบราคาทั้งวัน S&amp;P 500 วัดจากทุกรอบซื้อขายตั้งแต่ 2022 เทียบกับ VIX 1 วันของ Cboe ใช้เฉพาะราคาปิด Book ที่ไม่มีประวัติใช้ 1.645 ของการแจกแจงปกติ",
  "A wall is a probability, not a promise: a touch of the IV wall has closed back inside a little over half the time, not nine times in ten. The record under the ladder shows each day's outcome for this book.":
    "กำแพงคือความน่าจะเป็น ไม่ใช่คำสัญญา: การแตะกำแพง IV ปิดกลับเข้ากรอบได้มากกว่าครึ่งเพียงเล็กน้อย ไม่ใช่เก้าในสิบครั้ง สถิติใต้บันไดระดับแสดงผลของแต่ละวันสำหรับ Book นี้",
  "{currency}'s options carry no implied volatility to draw walls from yet.":
    "ออปชันของ {currency} ยังไม่มีความผันผวนแฝงให้ใช้วาดกำแพง",
  "1.645 standard deviations of the options' IV (normal distribution)":
    "1.645 ส่วนเบี่ยงเบนมาตรฐานของ IV ออปชัน (การแจกแจงปกติ)",
  "{k90} standard deviations of {method} {sigma}, measured":
    "{k90} ส่วนเบี่ยงเบนมาตรฐานของ {method} {sigma} จากการวัด",
  "IV wall, 1σ": "กำแพง IV 1σ",
  "±{move} (±{pct}) from IV {iv} a day ahead": "±{move} (±{pct}) จาก IV {iv} หนึ่งวันข้างหน้า",
  "90% wall": "กำแพง 90%",
  "The day so far": "วันนี้จนถึงตอนนี้",
  Reference: "ราคาอ้างอิง",
  "high {high} · low {low}": "สูง {high} · ต่ำ {low}",
  "IV wall: {status}": "กำแพง IV: {status}",
  "the latest close, for the next session": "ราคาปิดล่าสุด สำหรับรอบซื้อขายถัดไป",
  "Reference close": "ราคาปิดอ้างอิง",
  "{currency} · {source} options · IV walls · {day}":
    "{currency} · ออปชัน {source} · กำแพง IV · {day}",
  "The day's range": "กรอบราคาของวัน",
  "IV wall": "กำแพง IV",
  "90% wall, above": "กำแพง 90% ด้านบน",
  "IV wall, above": "กำแพง IV ด้านบน",
  "1σ of the options' IV": "1σ ของ IV ออปชัน",
  "IV wall, below": "กำแพง IV ด้านล่าง",
  "90% wall, below": "กำแพง 90% ด้านล่าง",
  "{currency} comes from an end-of-day file, so its walls are for the next session and are not kept day by day.":
    "{currency} มาจากไฟล์สิ้นวัน กำแพงจึงเป็นของรอบซื้อขายถัดไป และไม่ได้เก็บไว้รายวัน",
  "{currency}'s own record starts with today; each finished day is added here.":
    "สถิติของ {currency} เองเริ่มวันนี้ แต่ละวันที่จบแล้วจะถูกเพิ่มที่นี่",
  "{currency}'s own record, {days} finished days since {since}. IV wall: touched {reached}, closed back inside {held}. 90% wall: touched {reached90}, closed back inside {held90}.":
    "สถิติของ {currency} เอง {days} วันที่จบแล้วตั้งแต่ {since} กำแพง IV: แตะ {reached} ปิดกลับเข้ากรอบ {held} กำแพง 90%: แตะ {reached90} ปิดกลับเข้ากรอบ {held90}",
  "High / low": "สูง / ต่ำ",
  Close: "ปิด",
  "At the IV wall": "ที่กำแพง IV",
  "At the 90% wall": "ที่กำแพง 90%",
  "How price has behaved at the walls": "ราคาแสดงพฤติกรรมอย่างไรที่กำแพง",
  "Prices in {unit}. {source} options, read {ago}.": "ราคาเป็น {unit} ออปชัน {source} อ่าน{ago}",
  "Two readings of where the market makers stand, side by side, for the nearest expiry. The gamma ceiling is the strike above the spot holding the most call gamma, and the gamma floor the strike below it holding the most put gamma: where hedging flows are largest.":
    "สองมุมมองว่า Market Maker ยืนอยู่ตรงไหน วางเทียบกัน สำหรับวันหมดอายุที่ใกล้ที่สุด เพดาน Gamma คือ Strike เหนือ Spot ที่มี Gamma ของ Call มากที่สุด และพื้น Gamma คือ Strike ใต้ Spot ที่มี Gamma ของ Put มากที่สุด: จุดที่โฟลว์การเฮดจ์ใหญ่ที่สุด",
  "The dealer range reads every option as sold by dealers who keep the premium, as max pain does: at expiry they pay out what the options are worth, so they earn most at the max pain strike and start losing beyond the break-evens either side, the dealer ceiling and floor. No exchange publishes who sold what, so this rests on that assumption, and the Gamma Exposure tab's sign assumes the opposite for calls.":
    "กรอบดีลเลอร์มองว่าออปชันทุกตัวถูกขายโดยดีลเลอร์ที่เก็บพรีเมียมไว้ แบบเดียวกับ Max Pain: เมื่อหมดอายุพวกเขาจ่ายตามมูลค่าออปชัน จึงได้กำไรสูงสุดที่ Strike ของ Max Pain และเริ่มขาดทุนเมื่อเลยจุดคุ้มทุนทั้งสองฝั่ง คือเพดานและพื้นของดีลเลอร์ ไม่มีกระดานเทรดไหนเปิดเผยว่าใครขายอะไร ส่วนนี้จึงอิงสมมติฐานดังกล่าว และเครื่องหมายในแท็บ Gamma Exposure สมมติตรงกันข้ามสำหรับ Call",
  "A ceiling or floor within a quarter of the day's move of an IV wall is marked as lined up with it. Whether price turns there more often than elsewhere is what the record under the ladder is for: it starts with this tab and grows a day at a time.":
    "เพดานหรือพื้นที่อยู่ห่างจากกำแพง IV ไม่เกินหนึ่งในสี่ของการเคลื่อนไหวรายวัน จะถูกทำเครื่องหมายว่าตรงกับกำแพง ราคากลับตัวที่นั่นบ่อยกว่าที่อื่นหรือไม่ คือสิ่งที่สถิติใต้บันไดระดับตอบ: สถิติเริ่มพร้อมแท็บนี้และเพิ่มขึ้นทีละวัน",
  "gamma ceiling": "เพดาน Gamma",
  "dealer ceiling": "เพดานดีลเลอร์",
  "gamma floor": "พื้น Gamma",
  "dealer floor": "พื้นดีลเลอร์",
  "Gamma ceiling / floor": "เพดาน / พื้น Gamma",
  "the strikes holding the most call gamma above the spot and put gamma below it, expiring {expiry}":
    "Strike ที่มี Gamma ของ Call มากที่สุดเหนือ Spot และ Gamma ของ Put มากที่สุดใต้ Spot หมดอายุ {expiry}",
  "Dealer ceiling / floor": "เพดาน / พื้นดีลเลอร์",
  "where dealers who sold every option of that expiry break even; max pain {pain}":
    "จุดคุ้มทุนของดีลเลอร์ที่ขายออปชันทุกตัวของวันหมดอายุนั้น Max Pain {pain}",
  "max pain": "Max Pain",
  "{currency} · {source} options · ceiling and floor · expiring {expiry}":
    "{currency} · ออปชัน {source} · เพดานและพื้น · หมดอายุ {expiry}",
  "dealer ceiling and floor": "เพดานและพื้นดีลเลอร์",
  "lined up with a wall": "ตรงกับกำแพง",
  "Dealer range by expiry": "กรอบดีลเลอร์ตามวันหมดอายุ",
  Premium: "พรีเมียม",
  "Dealer floor": "พื้นดีลเลอร์",
  "Max pain": "Max Pain",
  "Dealer ceiling": "เพดานดีลเลอร์",
  "From the spot": "จาก Spot",
  "Lined up with a wall": "ตรงกับกำแพง",
  "{currency} comes from an end-of-day file, so its levels are for the next session and are not kept day by day.":
    "{currency} มาจากไฟล์สิ้นวัน ระดับจึงเป็นของรอบซื้อขายถัดไป และไม่ได้เก็บไว้รายวัน",
  Days: "วัน",
  Reached: "แตะ",
  "Closed back inside": "ปิดกลับเข้ากรอบ",
  "Over {days} finished days since {since}, both sides counted; a level is reached when the day's high (or low) touches it, and held when the day closes back inside it.":
    "ตลอด {days} วันที่จบแล้วตั้งแต่ {since} นับทั้งสองฝั่ง ระดับถือว่าถูกแตะเมื่อราคาสูงสุด (หรือต่ำสุด) ของวันแตะถึง และถือว่ายืนได้เมื่อวันนั้นปิดกลับเข้ากรอบ",
  "How price has behaved at these levels": "ราคาแสดงพฤติกรรมอย่างไรที่ระดับเหล่านี้",
  "IV Walls": "กำแพง IV",
  "IV walls": "กำแพง IV",
  "Ceiling & Floor": "เพดานและพื้น",
  Ceiling: "เพดาน",
  "the spot now": "Spot ตอนนี้",
  "week from {date}": "สัปดาห์ตั้งแต่ {date}",
  "Levels for": "ระดับสำหรับ",
  "The Day and Week switch reads the same levels for the nearest expiry or for the week's: Deribit's Friday 08:00 UTC weekly, or a US book's last expiry of the week. The week's levels are fixed by its first read, its IV walls span the time to that expiry, and its 90% wall is measured on whole past weeks where there is history.":
    "ปุ่มสลับวันและสัปดาห์อ่านระดับชุดเดียวกันสำหรับวันหมดอายุที่ใกล้ที่สุดหรือของสัปดาห์: รายสัปดาห์วันศุกร์ 08:00 UTC ของ Deribit หรือวันหมดอายุสุดท้ายของสัปดาห์ของ Book สหรัฐฯ ระดับของสัปดาห์ถูกกำหนดจากการอ่านครั้งแรก กำแพง IV ครอบคลุมเวลาจนถึงวันหมดอายุนั้น และกำแพง 90% วัดจากสัปดาห์เต็มที่ผ่านมาเมื่อมีประวัติ",
  "the strikes holding the most call gamma above the spot and put gamma below it, in everything expiring by {expiry}":
    "Strike ที่มี Gamma ของ Call มากที่สุดเหนือ Spot และ Gamma ของ Put มากที่สุดใต้ Spot ในทุกตัวที่หมดอายุภายใน {expiry}",
  "The week so far": "สัปดาห์นี้จนถึงตอนนี้",
  "the spot now; this week's levels are fixed by its first read":
    "Spot ตอนนี้ ระดับของสัปดาห์นี้ถูกกำหนดจากการอ่านครั้งแรก",
  "{currency}'s weekly record starts with this week; each finished week is added here.":
    "สถิติรายสัปดาห์ของ {currency} เริ่มสัปดาห์นี้ แต่ละสัปดาห์ที่จบแล้วจะถูกเพิ่มที่นี่",
  Weeks: "สัปดาห์",
  "Over {weeks} finished weeks since {since}, both sides counted; a level is reached when the week's high (or low) touches it, and held when the week closes back inside it.":
    "ตลอด {weeks} สัปดาห์ที่จบแล้วตั้งแต่ {since} นับทั้งสองฝั่ง ระดับถือว่าถูกแตะเมื่อราคาสูงสุด (หรือต่ำสุด) ของสัปดาห์แตะถึง และถือว่ายืนได้เมื่อสัปดาห์นั้นปิดกลับเข้ากรอบ",
  "{currency} · {source} options · IV walls day by day":
    "{currency} · ออปชัน {source} · กำแพง IV รายวัน",
  "{currency} · {source} options · ceiling and floor day by day":
    "{currency} · ออปชัน {source} · เพดานและพื้นรายวัน",
  "daily candle": "แท่งเทียนรายวัน",
  "week's expiry": "วันหมดอายุของสัปดาห์",
  "Each day's candle under the walls it opened with. The walls are fixed by the day's first read, so they move only from one day to the next.":
    "แท่งเทียนของแต่ละวันวางใต้กำแพงที่มีตอนเปิดวัน กำแพงถูกกำหนดจากการอ่านครั้งแรกของวัน จึงขยับเฉพาะตอนเปลี่ยนวัน",
  "Each day's candle under the levels it opened with. They are fixed by the day's first read, so they move only from one day to the next; the dotted rule marks each week's expiry.":
    "แท่งเทียนของแต่ละวันวางใต้ระดับที่มีตอนเปิดวัน ระดับถูกกำหนดจากการอ่านครั้งแรกของวัน จึงขยับเฉพาะตอนเปลี่ยนวัน เส้นประบอกวันหมดอายุของแต่ละสัปดาห์",
  "Each day's candle under its week's levels. They are fixed by the week's first read, so they move only at a week's expiry, the dotted rule.":
    "แท่งเทียนของแต่ละวันวางใต้ระดับของสัปดาห์นั้น ระดับถูกกำหนดจากการอ่านครั้งแรกของสัปดาห์ จึงขยับเฉพาะตอนหมดอายุรายสัปดาห์ คือเส้นประ",
  // The Delta, Vega and Theta tabs (web/greeks.ts).
  Delta: "Delta",
  "{currency} · {source} options · delta by strike · {scope}":
    "{currency} · ออปชัน {source} · Delta ตาม Strike · {scope}",
  "{currency} · {source} options · vega by strike · {scope}":
    "{currency} · ออปชัน {source} · Vega ตาม Strike · {scope}",
  "{currency} · {source} options · theta by strike · {scope}":
    "{currency} · ออปชัน {source} · Theta ตาม Strike · {scope}",
  "net {net} at spot {spot} · calls above zero, puts below · hover or tap a strike to read it":
    "สุทธิ {net} ที่ Spot {spot} · Call อยู่เหนือศูนย์ Put อยู่ใต้ศูนย์ · ชี้หรือแตะ Strike เพื่ออ่านค่า",
  "{total} per IV point at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "{total} ต่อ 1 จุด IV ที่ Spot {spot} · Call และ Put ของแต่ละ Strike ซ้อนกัน · ชี้หรือแตะ Strike เพื่ออ่านค่า",
  "{total} a day at spot {spot} · each strike's calls and puts stacked · hover or tap a strike to read it":
    "{total} ต่อวันที่ Spot {spot} · Call และ Put ของแต่ละ Strike ซ้อนกัน · ชี้หรือแตะ Strike เพื่ออ่านค่า",
  "Strikes beyond ±{pct} of the spot are off the chart: {usd} of the total.":
    "Strike ที่ห่างจาก Spot เกิน ±{pct} อยู่นอกกราฟ: {usd} ของยอดรวม",
  "total {usd}": "รวม {usd}",
  "{share} of it in that expiry, {left} left": "{share} อยู่ในวันหมดอายุนั้น เหลือ {left}",
  "≈ {coins} at the spot; what the open options move like, as their buyers hold them":
    "≈ {coins} ที่ Spot ออปชันที่เปิดอยู่เคลื่อนไหวเทียบเท่าเท่านี้ ในมุมของผู้ซื้อ",
  "what the open options move like, as their buyers hold them":
    "ออปชันที่เปิดอยู่เคลื่อนไหวเทียบเท่าเท่านี้ ในมุมของผู้ซื้อ",
  "Net delta": "Net Delta",
  "calls' delta is positive, puts' negative": "Delta ของ Call เป็นบวก ของ Put เป็นลบ",
  "Most delta": "Delta มากที่สุด",
  Vega: "Vega",
  "per IV point: what the open options gain if implied volatility rises one point, and their writers lose":
    "ต่อ 1 จุด IV: สิ่งที่ออปชันที่เปิดอยู่ได้เพิ่มหากความผันผวนแฝงขึ้นหนึ่งจุด และผู้ขายเสียไป",
  "every option gains as implied volatility rises": "ออปชันทุกตัวได้ประโยชน์เมื่อความผันผวนแฝงสูงขึ้น",
  "Most vega": "Vega มากที่สุด",
  "of the options' value a day, {premium} in all": "ของมูลค่าออปชันต่อวัน รวมทั้งหมด {premium}",
  Theta: "Theta",
  "a day: what the open options lose to time with price and IV unchanged, paid by their buyers to their writers":
    "ต่อวัน: มูลค่าที่ออปชันที่เปิดอยู่เสียไปตามเวลาเมื่อราคาและ IV ไม่เปลี่ยน ผู้ซื้อจ่ายให้ผู้ขาย",
  "every option loses value as expiry nears, faster the closer it is":
    "ออปชันทุกตัวเสียมูลค่าเมื่อใกล้หมดอายุ ยิ่งใกล้ยิ่งเร็ว",
  "Most theta": "Theta มากที่สุด",
  "Decay rate": "อัตราการเสื่อมค่า",
  "Delta in {unit}: the value of the underlying each expiry's open options move like. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Delta เป็น {unit}: มูลค่าสินทรัพย์อ้างอิงที่ออปชันที่เปิดอยู่ของแต่ละวันหมดอายุเคลื่อนไหวเทียบเท่า วันหมดอายุนอกช่วงที่เลือกจะแสดงจางลง ออปชันที่อยู่ในชั่วโมงสุดท้ายจะไม่นับ",
  "Vega in {unit} per IV point. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Vega เป็น {unit} ต่อ 1 จุด IV วันหมดอายุนอกช่วงที่เลือกจะแสดงจางลง ออปชันที่อยู่ในชั่วโมงสุดท้ายจะไม่นับ",
  "Theta in {unit} a day. Expiries outside the chosen range are dimmed; an option in its last hour is left out.":
    "Theta เป็น {unit} ต่อวัน วันหมดอายุนอกช่วงที่เลือกจะแสดงจางลง ออปชันที่อยู่ในชั่วโมงสุดท้ายจะไม่นับ",
  "Of the chain's total, either side counted": "สัดส่วนของยอดรวมทั้ง Chain นับทั้งสองฝั่ง",
  Total: "รวม",
  "Delta is how much an option's value moves with the underlying: about a half at the money, near 1 deep in the money and near 0 far out of it, negative for puts. Times open interest and the forward, it is the value of the underlying the open options move like, added up by strike.":
    "Delta คือมูลค่าออปชันขยับตามสินทรัพย์อ้างอิงมากแค่ไหน: ราวครึ่งหนึ่งเมื่อ At the Money ใกล้ 1 เมื่อ In the Money ลึก และใกล้ 0 เมื่อ Out of the Money ไกล เป็นลบสำหรับ Put เมื่อคูณ Open Interest และราคา Forward จะได้มูลค่าสินทรัพย์อ้างอิงที่ออปชันที่เปิดอยู่เคลื่อนไหวเทียบเท่า รวมตาม Strike",
  "It is read from the side of whoever bought the options: calls positive, puts negative. Whoever wrote them holds exactly the opposite, so were every writer hedged, their hedges would hold this much of the underlying. Nothing here assumes who is on which side, unlike gamma exposure.":
    "อ่านจากมุมของผู้ซื้อออปชัน: Call เป็นบวก Put เป็นลบ ผู้ขายถือฝั่งตรงข้ามพอดี หากผู้ขายทุกคนเฮดจ์ไว้ สถานะเฮดจ์ของพวกเขาจะถือสินทรัพย์อ้างอิงเท่านี้ ส่วนนี้ไม่ได้สมมติว่าใครอยู่ฝั่งไหน ต่างจาก Gamma Exposure",
  "Most delta sits in options already in the money, away from the spot, so this chart often reaches wider than the gamma chart.":
    "Delta ส่วนใหญ่อยู่ในออปชันที่ In the Money แล้ว ห่างจาก Spot กราฟนี้จึงมักกว้างกว่ากราฟ Gamma",
  "Vega is how much an option's value moves when implied volatility moves one point, say from 40% to 41%: largest at the money and for options with long to run. Times open interest, it is what the open options gain if IV rises a point, added up by strike.":
    "Vega คือมูลค่าออปชันขยับมากแค่ไหนเมื่อความผันผวนแฝงขยับหนึ่งจุด เช่นจาก 40% เป็น 41%: สูงสุดเมื่อ At the Money และสำหรับออปชันที่ยังเหลืออายุนาน เมื่อคูณ Open Interest คือสิ่งที่ออปชันที่เปิดอยู่ได้เพิ่มหาก IV ขึ้นหนึ่งจุด รวมตาม Strike",
  "Every option carries positive vega for whoever bought it and the same amount negative for whoever wrote it, so the total is what option writers stand to lose if IV rises a point, and gain if it falls one.":
    "ออปชันทุกตัวมี Vega เป็นบวกสำหรับผู้ซื้อ และเป็นลบเท่ากันสำหรับผู้ขาย ยอดรวมจึงเป็นสิ่งที่ผู้ขายออปชันจะเสียหาก IV ขึ้นหนึ่งจุด และได้หาก IV ลงหนึ่งจุด",
  "Theta is how much an option's value falls in a day with price and implied volatility unchanged: largest at the money and in an option's last days. Times open interest, it is what the open options lose in a day, added up by strike.":
    "Theta คือมูลค่าออปชันลดลงเท่าไรในหนึ่งวันเมื่อราคาและความผันผวนแฝงไม่เปลี่ยน: สูงสุดเมื่อ At the Money และในวันท้าย ๆ ก่อนหมดอายุ เมื่อคูณ Open Interest คือสิ่งที่ออปชันที่เปิดอยู่เสียไปในหนึ่งวัน รวมตาม Strike",
  "Buyers pay it and writers collect it: the total is roughly what option writers earn in a quiet day, the carry they are paid for taking on gamma. The decay rate divides it by what the options in range are worth.":
    "ผู้ซื้อจ่ายและผู้ขายเก็บ: ยอดรวมคือราวรายได้ของผู้ขายออปชันในวันที่ตลาดเงียบ คือ Carry ที่ได้รับจากการแบก Gamma อัตราการเสื่อมค่าคือยอดนี้หารด้วยมูลค่าของออปชันในช่วงที่เลือก",
  "The same books and reads as Gamma Exposure: Deribit's BTC and ETH every five minutes, Cboe's US chains every 15 minutes through the session, and the exchanges' end-of-day files for Asia-Pacific and Europe. Each option's Greeks are Black-76 at a zero rate on its own open interest, implied volatility and forward, in the currency the contract pays; they reproduce Deribit's own to within 0.03%.":
    "Book และการอ่านชุดเดียวกับ Gamma Exposure: BTC และ ETH ของ Deribit ทุกห้านาที Option Chain สหรัฐฯ ของ Cboe ทุก 15 นาทีตลอดรอบซื้อขาย และไฟล์สิ้นวันของตลาดในเอเชียแปซิฟิกและยุโรป Greeks ของแต่ละออปชันคำนวณด้วย Black-76 ที่อัตราดอกเบี้ยศูนย์ จาก Open Interest ความผันผวนแฝง และราคา Forward ของตัวเอง ในสกุลเงินที่สัญญาจ่าย ได้ค่าตรงกับของ Deribit ภายใน 0.03%",
  "Delta as the options' buyers hold it: calls positive, puts negative; whoever wrote them holds the opposite. {source} options, {asof}.":
    "Delta ในมุมของผู้ซื้อออปชัน: Call เป็นบวก Put เป็นลบ ผู้ขายถือฝั่งตรงข้าม ออปชัน {source} {asof}",
  "Vega as the options' buyers hold it, per point of implied volatility; whoever wrote them holds the opposite. {source} options, {asof}.":
    "Vega ในมุมของผู้ซื้อออปชัน ต่อ 1 จุดความผันผวนแฝง ผู้ขายถือฝั่งตรงข้าม ออปชัน {source} {asof}",
  "Theta as the options' buyers hold it, per day; whoever wrote them collects it. {source} options, {asof}.":
    "Theta ในมุมของผู้ซื้อออปชัน ต่อวัน ผู้ขายเป็นผู้เก็บ ออปชัน {source} {asof}",
  "Delta, vega and theta have not been computed for {currency} yet; they arrive with its next read.":
    "ยังไม่ได้คำนวณ Delta, Vega และ Theta ของ {currency} จะมาพร้อมการอ่านครั้งถัดไป",
  // The Gamma Exposure tab's By expiry chart (web/gamma.ts) and its readout (web/slot-chart.ts).
  "Each expiry's calls above zero and its puts below, at their value at the spot":
    "Call ของแต่ละวันหมดอายุอยู่เหนือศูนย์และ Put อยู่ใต้ศูนย์ คิดมูลค่าที่ Spot",
  "Each expiry's gamma exposure: calls above zero, puts below":
    "Gamma Exposure ของแต่ละวันหมดอายุ: Call อยู่เหนือศูนย์ Put อยู่ใต้ศูนย์",
  gamma: "Gamma",
  "Each expiry's at-the-money implied volatility: the term structure":
    "ความผันผวนแฝง At-the-Money ของแต่ละวันหมดอายุ: Term Structure",
  show: "แสดง",
  "{n} expiries · open interest {calls} in calls, {puts} in puts · hover or tap an expiry to read it":
    "{n} วันหมดอายุ · Open Interest ฝั่ง Call {calls} ฝั่ง Put {puts} · ชี้หรือแตะวันหมดอายุเพื่ออ่านค่า",
  "{currency} · {source} options · by expiry": "{currency} · ออปชัน {source} · ตามวันหมดอายุ",
  "{currency} expiries; arrow keys read one at a time": "วันหมดอายุของ {currency} ใช้ปุ่มลูกศรอ่านทีละวัน",
  "One bar per expiry in date order, so the gaps between them are not to scale; expiries outside the chosen range are dimmed.":
    "หนึ่งแท่งต่อวันหมดอายุเรียงตามวันที่ ระยะห่างระหว่างแท่งจึงไม่ได้เป็นสัดส่วนตามเวลา วันหมดอายุนอกช่วงที่เลือกจะแสดงจางลง",
  "{date}, {left} left": "{date} เหลือ {left}",
  "{n} options": "{n} ออปชัน",
  "calls {oi} open": "Call เปิดอยู่ {oi}",
  "puts {oi} open": "Put เปิดอยู่ {oi}",
  "put/call {ratio}": "Put/Call {ratio}",
  "gamma {calls} / {puts}, net {net}": "Gamma {calls} / {puts} สุทธิ {net}",
  "ATM IV {iv}": "ATM IV {iv}",
  "max pain {price}": "Max Pain {price}",
  "dealer range {low} – {high}": "กรอบดีลเลอร์ {low} – {high}",
  "premium {usd}": "พรีเมียม {usd}",
  // Reaction zones (web/confluence.ts).
  "reaction zone, today": "โซนตอบสนอง วันนี้",
  "gamma wall": "กำแพง Gamma",
  "dealer break-even": "จุดคุ้มทุนดีลเลอร์",
  "gamma flip": "Gamma Flip",
  "the spot is inside it now": "ตอนนี้ Spot อยู่ในโซน",
  "{points} ({pct}) away, {sigmas} of the day's move":
    "ห่าง {points} ({pct}) เท่ากับ {sigmas} ของการเคลื่อนไหวรายวัน",
  "No zone above": "ไม่มีโซนด้านบน",
  "No zone below": "ไม่มีโซนด้านล่าง",
  "no IV wall lines up with a ceiling": "ไม่มีกำแพง IV ที่ตรงกับเพดาน",
  "no IV wall lines up with a floor": "ไม่มีกำแพง IV ที่ตรงกับพื้น",
  "Above the spot": "เหนือ Spot",
  "Below the spot": "ใต้ Spot",
  zone: "โซน",
  "Dealers long gamma ({net} per 1% move, every expiry): their hedging sells rises and buys dips, which is what lets a wall hold.":
    "ดีลเลอร์ Long Gamma ({net} ต่อการขยับ 1% ทุกวันหมดอายุ): การเฮดจ์ของพวกเขาขายตอนขึ้นและซื้อตอนย่อ ซึ่งทำให้กำแพงยืนได้",
  "Dealers short gamma ({net} per 1% move, every expiry): their hedging chases the price, so walls give way more easily and fading them is riskier.":
    "ดีลเลอร์ Short Gamma ({net} ต่อการขยับ 1% ทุกวันหมดอายุ): การเฮดจ์ของพวกเขาไล่ตามราคา กำแพงจึงแตกง่ายขึ้น และการเทรดสวนที่กำแพงเสี่ยงกว่า",
  "Flip {price}, {pct} ({sigmas}).": "Flip {price} {pct} ({sigmas})",
  "Since {year}, a touch of this book's 1σ wall closed back inside {rev1} of {touch1} times, of its 90% wall {rev90} of {touch90}: better than a coin toss, not nine in ten.":
    "ตั้งแต่ปี {year} การแตะกำแพง 1σ ของ Book นี้ปิดกลับเข้ากรอบ {rev1} จาก {touch1} ครั้ง กำแพง 90% {rev90} จาก {touch90} ครั้ง: ดีกว่าโยนเหรียญ แต่ไม่ใช่เก้าในสิบ",
  "A zone is where an IV wall and a market maker's level fall within a quarter of the day's 1σ move of each other: a place to wait for a rejection, not a trade on its own, and least reliable when dealers are short gamma.":
    "โซนคือจุดที่กำแพง IV กับระดับของ Market Maker อยู่ห่างกันไม่เกินหนึ่งในสี่ของการเคลื่อนไหว 1σ รายวัน: เป็นจุดรอดูการปฏิเสธราคา ไม่ใช่สัญญาณเทรดในตัวเอง และเชื่อถือได้น้อยที่สุดเมื่อดีลเลอร์ Short Gamma",
  "the week's 1σ move": "การเคลื่อนไหว 1σ รายสัปดาห์",
  "the day's 1σ move": "การเคลื่อนไหว 1σ รายวัน",
  "Reaction zones": "โซนตอบสนอง",
  "σ is {unit}, {move}": "σ คือ{unit} {move}",
  "between the IV walls": "ระหว่างกำแพง IV",
  "between the 90% walls": "ระหว่างกำแพง 90%",
  "each line's mark is beside its name below": "สัญลักษณ์ของแต่ละเส้นอยู่ข้างชื่อด้านล่าง",
  "Each expiry's delta: calls above zero, puts below":
    "Delta ของแต่ละวันหมดอายุ: Call อยู่เหนือศูนย์ Put อยู่ใต้ศูนย์",
  "Each expiry's theta a day, its calls and puts stacked down from the top":
    "Theta ต่อวันของแต่ละวันหมดอายุ Call และ Put ซ้อนลงมาจากด้านบน",
  "Each expiry's vega, its calls and puts stacked": "Vega ของแต่ละวันหมดอายุ Call และ Put ซ้อนกัน",
  "Its own zone record, {days} finished days since {since}: {zones} zones, price reached {reached} and closed back on the near side of {held}; its IV walls on those days were reached {wallReached} times and held {wallHeld}.":
    "สถิติโซนของตัวเอง {days} วันที่จบแล้วตั้งแต่ {since}: {zones} โซน ราคาแตะ {reached} และปิดกลับฝั่งใกล้ {held} ส่วนกำแพง IV ในวันเหล่านั้นถูกแตะ {wallReached} ครั้งและยืนได้ {wallHeld}",
  "This book's zone record starts with today: each finished day adds whether price reached a zone and turned there.":
    "สถิติโซนของ Book นี้เริ่มวันนี้: แต่ละวันที่จบแล้วจะบันทึกว่าราคาแตะโซนและกลับตัวที่นั่นหรือไม่",
  "Zone record": "สถิติโซน",
  "dealers long gamma": "ดีลเลอร์ Long Gamma",
  "dealers short gamma": "ดีลเลอร์ Short Gamma",
  delta: "Delta",
  "delta {calls} / {puts}, net {net}": "Delta {calls} / {puts} สุทธิ {net}",
  "each finished day adds whether price reached a zone and closed back on its near side":
    "แต่ละวันที่จบแล้วจะบันทึกว่าราคาแตะโซนและปิดกลับฝั่งใกล้หรือไม่",
  "no zone above": "ไม่มีโซนด้านบน",
  "no zone below": "ไม่มีโซนด้านล่าง",
  "starts this week": "เริ่มสัปดาห์นี้",
  "starts today": "เริ่มวันนี้",
  "the spot is in the zone {range}": "Spot อยู่ในโซน {range}",
  theta: "Theta",
  "theta {calls} / {puts} a day, total {net}": "Theta {calls} / {puts} ต่อวัน รวม {net}",
  "this book's days are not kept, so its zones have no record":
    "ไม่ได้เก็บข้อมูลรายวันของ Book นี้ โซนจึงไม่มีสถิติ",
  vega: "Vega",
  "vega {calls} / {puts}, total {net}": "Vega {calls} / {puts} รวม {net}",
  "zone above {range}, {sigmas} away": "โซนด้านบน {range} ห่าง {sigmas}",
  "zone below {range}, {sigmas} away": "โซนด้านล่าง {range} ห่าง {sigmas}",
  "zones reached and held over {days} finished days; the IV walls alone: {wallHeld} / {wallReached}":
    "โซนที่ถูกแตะและยืนได้ใน {days} วันที่จบแล้ว เฉพาะกำแพง IV: {wallHeld} / {wallReached}",
  "zones reached and held over {days} finished weeks; the IV walls alone: {wallHeld} / {wallReached}":
    "โซนที่ถูกแตะและยืนได้ใน {days} สัปดาห์ที่จบแล้ว เฉพาะกำแพง IV: {wallHeld} / {wallReached}",
};
