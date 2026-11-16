/**
 * The site-wide pieces and the small pages, in Thai: web/about.ts, web/legal.ts and web/tos.ts
 * (their notice only -- the bodies stay English), web/referral-links.ts, web/referral.ts,
 * web/install.ts, web/share.ts, web/await.ts, web/tabs.ts and web/glossary.ts. Glossary and style:
 * ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const site: Catalog = {
  // web/about.ts
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
  "{month} {day}, {year}": "{day} {month} {year}",
  project: "โปรเจกต์",
  commit: "Commit",
  "not recorded": "ไม่ได้บันทึก",
  "This build did not record its commit. Deployed builds stamp the commit they were built from here.":
    "บิลด์นี้ไม่ได้บันทึก Commit ของตัวเอง บิลด์ที่เผยแพร่แล้วจะระบุ Commit ที่ใช้สร้างไว้ตรงนี้",
  committed: "Commit เมื่อ",
  deployed: "เผยแพร่เมื่อ",
  "Release notes are written in English.": "บันทึกการอัปเดตเขียนเป็นภาษาอังกฤษ",
  About: "เกี่ยวกับ",
  "What airrates is, which version is running, and what has changed recently.":
    "airrates คืออะไร ตอนนี้ใช้เวอร์ชันไหน และมีอะไรเปลี่ยนไปบ้างล่าสุด",
  "About airrates": "เกี่ยวกับ airrates",
  "airrates is a funding-rate screener for perpetual futures. It reads funding from each exchange's public API every minute and shows where holding the same asset long on one exchange and short on another collects the gap between their rates, and what that has actually paid.":
    "airrates คือสกรีนเนอร์ Funding Rate สำหรับสัญญา Perpetual Futures ดึงข้อมูล Funding จาก API สาธารณะของแต่ละกระดานเทรดทุกนาที แล้วแสดงว่าการถือสินทรัพย์ตัวเดียวกันแบบ Long ที่กระดานเทรดหนึ่งและ Short ที่อีกกระดานเทรดหนึ่งจะเก็บส่วนต่างของอัตราได้ที่ไหน และที่ผ่านมาจ่ายจริงเท่าไร",
  "This version": "เวอร์ชันนี้",
  "Recent changes": "การเปลี่ยนแปลงล่าสุด",

  // web/legal.ts, web/tos.ts
  "This page is available in English only. The English text is the binding version.":
    "หน้านี้มีเฉพาะภาษาอังกฤษ ข้อความภาษาอังกฤษคือฉบับที่มีผลบังคับใช้",

  // web/referral-links.ts
  "<b>Disclosure.</b> airrates may earn a commission if you open an account through a link on this page, at no extra cost to you. Referral links never affect which markets appear or how they are ranked. A listing here is not a recommendation: check that an exchange serves where you live before signing up, and remember that perpetual futures are leveraged and can lose more than your margin. {link}":
    "<b>การเปิดเผยข้อมูล</b> airrates อาจได้รับค่าคอมมิชชันหากคุณเปิดบัญชีผ่านลิงก์ในหน้านี้ โดยคุณไม่ต้องเสียค่าใช้จ่ายเพิ่ม ลิงก์แนะนำไม่มีผลต่อการแสดงตลาดหรือการจัดอันดับ การอยู่ในรายการนี้ไม่ใช่คำแนะนำ: ตรวจสอบก่อนสมัครว่ากระดานเทรดให้บริการในประเทศของคุณ และอย่าลืมว่าสัญญา Perpetual Futures ใช้เลเวอเรจ จึงอาจขาดทุนเกินมาร์จิ้นของคุณ {link}",
  "How referral links work": "ลิงก์แนะนำทำงานอย่างไร",
  "No referral links yet.": "ยังไม่มีลิงก์แนะนำ",
  "Referral links are not shown in your location.": "ลิงก์แนะนำไม่แสดงในพื้นที่ของคุณ",
  "None of these exchanges' referral links can be shown in your location.":
    "ไม่มีลิงก์แนะนำของกระดานเทรดเหล่านี้ที่แสดงได้ในพื้นที่ของคุณ",
  "The link applies the referral itself": "ลิงก์นี้ใส่รหัสแนะนำให้อัตโนมัติ",
  Exchange: "กระดานเทรด",
  Type: "ประเภท",
  "Referral code": "รหัสแนะนำ",
  "Sign up": "สมัครสมาชิก",
  "{count} more exchange's link is not available in your location.":
    "อีก {count} กระดานเทรดไม่มีลิงก์ในพื้นที่ของคุณ",
  "{count} more exchanges' links are not available in your location.":
    "อีก {count} กระดานเทรดไม่มีลิงก์ในพื้นที่ของคุณ",
  "Referral links": "ลิงก์แนะนำ",
  "Referral links for the exchanges airrates tracks, for readers opening a new account.":
    "ลิงก์แนะนำของกระดานเทรดที่ airrates ติดตาม สำหรับผู้ที่จะเปิดบัญชีใหม่",
  "The exchanges airrates has a referral link for. If you don't have an account on one yet, you can open it through the link.":
    "กระดานเทรดที่ airrates มีลิงก์แนะนำ หากยังไม่มีบัญชีที่กระดานเทรดไหน เปิดบัญชีผ่านลิงก์ได้เลย",

  // web/referral.ts
  "How this works": "ทำงานอย่างไร",
  "Referral link: Code {code}. airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "ลิงก์แนะนำ: รหัส {code} airrates อาจได้รับค่าคอมมิชชันหากคุณสมัครผ่านลิงก์นี้ โดยคุณไม่เสียค่าใช้จ่าย {how}",
  "Referral link: airrates may earn a commission if you sign up through it, at no cost to you. {how}":
    "ลิงก์แนะนำ: airrates อาจได้รับค่าคอมมิชชันหากคุณสมัครผ่านลิงก์นี้ โดยคุณไม่เสียค่าใช้จ่าย {how}",
  "Open a {venue} account": "เปิดบัญชี {venue}",

  // web/install.ts
  "Install the app": "ติดตั้งแอป",
  "Install airrates": "ติดตั้ง airrates",
  "Opens in its own window, from your home screen.": "เปิดในหน้าต่างของตัวเองจากหน้าจอหลัก",
  "Install app": "ติดตั้งแอป",
  "Not now": "ไว้ทีหลัง",

  // web/share.ts
  "Share the chart in view as an image sized for X": "แชร์กราฟที่แสดงอยู่เป็นภาพขนาดสำหรับ X",
  chart: "กราฟ",
  "Quote this page's best line, with a link back to it": "อ้างอิงบรรทัดเด่นของหน้านี้ พร้อมลิงก์กลับมา",
  cite: "อ้างอิง",
  "No chart on this view": "มุมมองนี้ไม่มีกราฟ",
  close: "ปิด",
  Copied: "คัดลอกแล้ว",
  "Select + copy": "เลือก + คัดลอก",
  "Cite this page": "อ้างอิงหน้านี้",
  "Pick the line · the page's own numbers, as they read now":
    "เลือกบรรทัด · ตัวเลขของหน้านี้ตามที่แสดงอยู่ตอนนี้",
  "Your post · edit it freely": "โพสต์ของคุณ · แก้ไขได้ตามใจ",
  "Back-link · this exact page, venue and filters": "ลิงก์กลับ · หน้านี้ กระดานเทรดและตัวกรองเดียวกันทุกอย่าง",
  Copy: "คัดลอก",
  "Post on X": "โพสต์บน X",
  "Copy line + link": "คัดลอกบรรทัด + ลิงก์",
  "Quote the number, link back to where it was read. Funding moves every minute, so the line says when it was true: {stamp}. Not financial advice.":
    "อ้างอิงตัวเลขพร้อมลิงก์กลับไปยังที่มา Funding เปลี่ยนทุกนาที บรรทัดนี้จึงบอกว่าเป็นจริง ณ เวลาใด: {stamp} ไม่ใช่คำแนะนำทางการเงิน",
  "{count} characters left with the link": "เหลือ {count} ตัวอักษรเมื่อรวมลิงก์",
  "+{count} more": "+{count}",
  "public venue APIs · not financial advice": "API สาธารณะของกระดานเทรด · ไม่ใช่คำแนะนำทางการเงิน",
  "Share your line": "แชร์บรรทัดของคุณ",
  "chart image": "ภาพกราฟ",
  "Image · 1600 × 900, X's own 16:9 — shows uncropped in the timeline. Right-click or long-press to save.":
    "ภาพ · 1600 × 900 อัตราส่วน 16:9 ของ X เอง — แสดงเต็มไม่ถูกครอปในไทม์ไลน์ คลิกขวาหรือกดค้างเพื่อบันทึก",
  "Copy image": "คัดลอกภาพ",
  "Download PNG": "ดาวน์โหลด PNG",
  "Link · this exact view": "ลิงก์ · มุมมองเดียวกันนี้",
  "Copy the image, press Post on X, paste it into the post. The card carries the address it came from; the link opens the same view. We never call direction — the numbers are the venues', the call is yours.":
    "คัดลอกภาพ กด “โพสต์บน X” แล้ววางลงในโพสต์ การ์ดมีที่อยู่ของหน้าที่มา ลิงก์เปิดมุมมองเดียวกัน เราไม่เคยชี้ทิศทาง — ตัวเลขมาจากกระดานเทรด การตัดสินใจเป็นของคุณ",
  "the image could not be drawn in this browser": "เบราว์เซอร์นี้วาดภาพไม่ได้",
  "Copy blocked — download instead": "คัดลอกไม่ได้ — ดาวน์โหลดแทน",

  // web/await.ts
  "Building report": "กำลังสร้างรายงาน",
  "Still building": "ยังสร้างอยู่",

  // web/tabs.ts
  Sections: "หมวด",

  // web/glossary.ts (and its entry in the footer menu and the shortcut map)
  terminology: "คำศัพท์",
  Terminology: "คำศัพท์",
  "Order flow": "Order Flow",
  "Aggressive buying minus aggressive selling.": "แรงซื้อเชิงรุกลบด้วยแรงขายเชิงรุก",
  "cumulative volume delta": "ผลต่างวอลุ่มสะสม",
  "Delta added up through the session.": "Delta ที่บวกสะสมตลอดเซสชัน",
  'Shown on the <a href="/chart">Chart</a> page, spot and futures apart, summed across exchanges.':
    'แสดงในหน้า <a href="/chart">กราฟ</a> แยก Spot กับ Futures และรวมทุกกระดานเทรด',
  Imbalance: "ความไม่สมดุล (Imbalance)",
  "One side trading 3x or more the other at a price.": "ฝั่งหนึ่งซื้อขายมากกว่าอีกฝั่ง 3 เท่าขึ้นไปที่ราคาเดียวกัน",
  Absorption: "การดูดซับ (Absorption)",
  "Heavy aggression, no progress.": "แรงเข้าหนักแต่ราคาไม่ไปไหน",
  'Read on the <a href="/liquidations#odds">Liquidations</a> page’s Odds tab, as initiative vs absorption.':
    'ดูได้ในแท็บโอกาสของหน้า <a href="/liquidations#odds">การล้างพอร์ต</a> ในรูปแรงผลักเทียบกับการดูดซับ',
  "Volume profile": "Volume Profile",
  "volume point of control": "Volume Point of Control",
  "The price with the most volume.": "ราคาที่มีวอลุ่มมากที่สุด",
  "Value area": "Value Area",
  "Where 70% of the volume traded.": "ช่วงราคาที่มีการซื้อขาย 70% ของวอลุ่ม",
  "low-volume node": "Low-Volume Node",
  "A thin price the market moved through fast.": "ราคาที่ซื้อขายบางและตลาดวิ่งผ่านไปอย่างรวดเร็ว",
  "Single prints": "Single Prints",
  "A zone only one 30-minute period traded.": "โซนที่มีการซื้อขายเพียงช่วง 30 นาทีเดียว",
  // web/glossary.ts: the terms added 2026-11-10 beside the owner's first eight
  "Delta (order flow)": "Delta (Order Flow)",
  Initiative: "แรงผลัก (Initiative)",
  "Aggression that moves price; the opposite of absorption.": "แรงเข้าที่ทำให้ราคาขยับ ตรงข้ามกับการดูดซับ",
  "Taker flow": "Taker Flow",
  "The trades CVD is added up from, buys against sells.":
    "การซื้อขายที่นำมาบวกสะสมเป็น CVD ฝั่งซื้อเทียบกับฝั่งขาย",
  "Options and gamma": "ออปชันและ Gamma",
  "gamma exposure": "Gamma Exposure",
  "How much dealers must buy or sell for each 1% move.": "ปริมาณที่ดีลเลอร์ต้องซื้อหรือขายทุกครั้งที่ราคาขยับ 1%",
  'Shown on the <a href="/rates#gamma">Rates</a> page’s Gamma Exposure tab, and told as it moves by the market narrator at the top of every page.':
    'แสดงในแท็บ Gamma Exposure ของหน้า <a href="/rates#gamma">อัตรา</a> และผู้บรรยายตลาดด้านบนของทุกหน้าจะเล่าเมื่อค่าขยับ',
  "The price where dealers' net gamma changes sign.": "ราคาที่ Gamma สุทธิของดีลเลอร์เปลี่ยนเครื่องหมาย",
  'Marked on the <a href="/rates#gamma">Gamma Exposure</a> tab, and the line the market narrator reads every price against.':
    'ทำเครื่องหมายไว้ในแท็บ <a href="/rates#gamma">Gamma Exposure</a> และเป็นเส้นที่ผู้บรรยายตลาดใช้เทียบทุกราคา',
  "Long / short gamma": "Long / Short Gamma",
  "Long: dealers' hedging sells rises and buys dips, damping moves. Short: it chases price, adding to moves.":
    "Long: การเฮดจ์ของดีลเลอร์ขายตอนราคาขึ้นและซื้อตอนราคาย่อ ทำให้การเคลื่อนไหวเบาลง Short: การเฮดจ์ไล่ตามราคา ทำให้การเคลื่อนไหวแรงขึ้น",
  'Shaded in the zones view of the <a href="/rates#gamma">Gamma Exposure</a> tab.':
    'แรเงาไว้ในมุมมองโซนของแท็บ <a href="/rates#gamma">Gamma Exposure</a>',
  "The strike holding the most call or put gamma; it tends to cap or floor price.":
    "Strike ที่มี Gamma ฝั่ง Call หรือ Put มากที่สุด มักทำหน้าที่เป็นเพดานหรือพื้นของราคา",
  'Shown on the <a href="/rates#gamma">Gamma Exposure</a> tab and in every market narrator line.':
    'แสดงในแท็บ <a href="/rates#gamma">Gamma Exposure</a> และในทุกบรรทัดของผู้บรรยายตลาด',
  "Delta (options)": "Delta (ออปชัน)",
  "How much an option's price moves per point of the underlying.":
    "ราคาออปชันขยับเท่าไรต่อการขยับ 1 จุดของสินทรัพย์อ้างอิง",
  'By strike on the <a href="/rates#delta">Rates</a> page’s Delta tab.':
    'แยกตาม Strike ในแท็บ Delta ของหน้า <a href="/rates#delta">อัตรา</a>',
  "How much an option's price moves per point of implied volatility.":
    "ราคาออปชันขยับเท่าไรต่อ 1 จุดของความผันผวนแฝง",
  'By strike on the <a href="/rates#vega">Rates</a> page’s Vega tab.':
    'แยกตาม Strike ในแท็บ Vega ของหน้า <a href="/rates#vega">อัตรา</a>',
  "What an option loses in value each day as expiry nears.":
    "มูลค่าที่ออปชันเสียไปในแต่ละวันเมื่อใกล้วันหมดอายุ",
  'By strike on the <a href="/rates#theta">Rates</a> page’s Theta tab.':
    'แยกตาม Strike ในแท็บ Theta ของหน้า <a href="/rates#theta">อัตรา</a>',
  "implied volatility": "ความผันผวนแฝง",
  "The size of move the option prices expect, per year.": "ขนาดการเคลื่อนไหวที่ราคาออปชันคาดไว้ ต่อปี",
  'Drawn as walls on the <a href="/rates#ivwalls">Rates</a> page’s IV Walls tab.':
    'วาดเป็นกำแพงในแท็บกำแพง IV ของหน้า <a href="/rates#ivwalls">อัตรา</a>',
  "1σ move": "การขยับ 1σ",
  "The day's expected move from the options: one standard deviation either side.":
    "การขยับของวันที่ออปชันคาดไว้: หนึ่งส่วนเบี่ยงเบนมาตรฐานทั้งสองฝั่ง",
  'The IV walls on the <a href="/rates#ivwalls">Rates</a> page, and the IV move on <a href="/whales">Whales</a>.':
    'กำแพง IV ในหน้า <a href="/rates#ivwalls">อัตรา</a> และการขยับตาม IV ในหน้า <a href="/whales">วาฬ</a>',
  "The strike where option buyers lose the most at expiry.": "Strike ที่ผู้ซื้อออปชันขาดทุนมากที่สุดเมื่อหมดอายุ",
  'Marked on the <a href="/rates#levels">Rates</a> page’s Ceiling &amp; Floor tab.':
    'ทำเครื่องหมายไว้ในแท็บเพดานและพื้นของหน้า <a href="/rates#levels">อัตรา</a>',
  "Reaction zone": "โซนตอบสนอง",
  "Where an IV wall and a gamma wall line up.": "จุดที่กำแพง IV กับกำแพง Gamma ซ้อนกัน",
  'In full on the <a href="/rates#ivwalls">IV Walls</a> and <a href="/rates#levels">Ceiling &amp; Floor</a> tabs, folded on the other option tabs.':
    'แสดงเต็มในแท็บ <a href="/rates#ivwalls">กำแพง IV</a> และ <a href="/rates#levels">เพดานและพื้น</a> และพับเก็บไว้ในแท็บออปชันอื่น ๆ',
  "Funding and perps": "Funding และ Perp",
  "Funding rate": "Funding Rate",
  "What longs pay shorts, or shorts pay longs, to keep a perp near spot.":
    "เงินที่ฝั่ง Long จ่ายให้ฝั่ง Short หรือฝั่ง Short จ่ายให้ฝั่ง Long เพื่อให้ราคา Perp อยู่ใกล้ Spot",
  'Every exchange side by side on the <a href="/rates">Rates</a> page.':
    'ทุกกระดานเทรดเทียบกันในหน้า <a href="/rates">อัตรา</a>',
  "annual percentage rate": "อัตราร้อยละต่อปี",
  "A funding rate scaled to a year, so different settlement intervals compare.":
    "Funding Rate ที่คิดเป็นรายปี เพื่อให้เทียบรอบจ่ายที่ต่างกันได้",
  'The unit the <a href="/screener">Screener</a> shows by default.':
    'หน่วยที่ <a href="/screener">สกรีนเนอร์</a> แสดงเป็นค่าเริ่มต้น',
  "Settlement interval": "ความถี่รอบจ่าย",
  "How often funding is paid: every 1, 4 or 8 hours.": "Funding จ่ายบ่อยแค่ไหน: ทุก 1, 4 หรือ 8 ชั่วโมง",
  'In each leg of a <a href="/screener">Screener</a> row.':
    'ในแต่ละขาของแถวใน <a href="/screener">สกรีนเนอร์</a>',
  "Funding spread / carry": "สเปรด Funding / Carry",
  "Long where funding is cheap, short where it is rich, and collect the gap.":
    "Long ที่ที่ Funding ถูก Short ที่ที่ Funding แพง แล้วเก็บส่วนต่าง",
  'The pairs the <a href="/">home page</a> and the <a href="/screener">Screener</a> rank.':
    'คู่ที่ <a href="/">หน้าแรก</a> และ <a href="/screener">สกรีนเนอร์</a> จัดอันดับ',
  "Contracts still open: money in the market, not traded volume.":
    "สัญญาที่ยังเปิดอยู่: เงินที่อยู่ในตลาด ไม่ใช่วอลุ่มการซื้อขาย",
  'In each leg of a <a href="/screener">Screener</a> row, and per asset on the <a href="/chart">Chart</a> page.':
    'ในแต่ละขาของแถวใน <a href="/screener">สกรีนเนอร์</a> และรายสินทรัพย์ในหน้า <a href="/chart">กราฟ</a>',
  "A perp or future's price minus spot.": "ราคา Perp หรือ Futures ลบด้วยราคา Spot",
  "Mark / index price": "ราคา Mark / ราคาดัชนี",
  "Mark is the price used for liquidations; index is the spot average it tracks.":
    "ราคา Mark คือราคาที่ใช้ตัดสินการล้างพอร์ต ส่วนราคาดัชนีคือค่าเฉลี่ย Spot ที่ราคา Mark อ้างอิง",
  'Each pair’s page, opened from a row on <a href="/arbitrage">Arbitrage</a>, charts the mark prices hourly.':
    'หน้าของแต่ละคู่ ซึ่งเปิดจากแถวในหน้า <a href="/arbitrage">อาร์บิทราจ</a> แสดงกราฟราคา Mark รายชั่วโมง',
  "Taker / maker": "Taker / Maker",
  "A taker crosses the spread and pays the higher fee; a maker rests an order and waits.":
    "Taker ข้ามสเปรดและจ่ายค่าธรรมเนียมสูงกว่า ส่วน Maker วางคำสั่งไว้แล้วรอ",
  'The <a href="/markets">Exchanges</a> page prices a $10k market order with each exchange’s taker fee.':
    'หน้า <a href="/markets">กระดานเทรด</a> คำนวณคำสั่ง Market ขนาด $10k ด้วยค่าธรรมเนียม Taker ของแต่ละกระดานเทรด',
  "Liquidations and whales": "การล้างพอร์ตและวาฬ",
  Liquidation: "การล้างพอร์ต",
  "A position the exchange closes because its margin ran out.":
    "โพซิชันที่กระดานเทรดบังคับปิดเพราะมาร์จิ้นหมด",
  'Every exchange’s, live, on the <a href="/liquidations">Liquidations</a> page.':
    'ของทุกกระดานเทรดแบบเรียลไทม์ในหน้า <a href="/liquidations">การล้างพอร์ต</a>',
  "Whale order": "คำสั่งวาฬ",
  "A resting order big enough to show on the depth chart.": "คำสั่งที่วางรอไว้และใหญ่พอจะเห็นบนกราฟความลึก",
  'Binance walls and Hyperliquid whale orders on the <a href="/whales">Whales</a> page.':
    'กำแพงของ Binance และคำสั่งวาฬของ Hyperliquid ในหน้า <a href="/whales">วาฬ</a>',
  "The site's terms in one line each: order flow, the volume profile, options and gamma, funding and perps, liquidations and whales.":
    "คำศัพท์ของเว็บไซต์ คำละหนึ่งบรรทัด: Order Flow, Volume Profile, ออปชันและ Gamma, Funding และ Perp, การล้างพอร์ตและวาฬ",
  "The words the site uses, each in one line: order flow, the volume profile, options and gamma, funding, liquidations. Every term has its own link to share: /glossary#cvd opens this page at CVD.":
    "คำที่เว็บไซต์ใช้ คำละหนึ่งบรรทัด: Order Flow, Volume Profile, ออปชันและ Gamma, Funding, การล้างพอร์ต ทุกคำมีลิงก์ของตัวเองไว้แชร์: /glossary#cvd เปิดหน้านี้ที่ CVD",
};
