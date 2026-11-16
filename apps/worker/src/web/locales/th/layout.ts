/**
 * The frame every page shares -- web/layout.ts (masthead, nav, footer), the time and label helpers in
 * web/format.ts -- and the not-found messages app/app.ts builds, in Thai.
 * Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const layout: Catalog = {
  // web/format.ts
  "{s}s": "{s} วิ",
  "{m}m": "{m} นาที",
  "{h}h {m}m": "{h} ชม. {m} นาที",
  "{time} ago": "{time}ที่แล้ว",
  settling: "กำลังจ่าย",
  never: "ไม่เคย",
  "extreme fear": "กลัวสุดขีด",
  fear: "กลัว",
  neutral: "เป็นกลาง",
  greed: "โลภ",
  "extreme greed": "โลภสุดขีด",

  // web/layout.ts
  spreads: "สเปรด",
  screener: "สกรีนเนอร์",
  rates: "อัตรา",
  arbitrage: "อาร์บิทราจ",
  liquidations: "ล้างพอร์ต",
  exchanges: "กระดานเทรด",
  "{markets} markets · {venues} venues · updated {ago}":
    "{markets} ตลาด · {venues} กระดานเทรด · อัปเดต {ago}",
  "no venue has reported in five minutes": "ไม่มีกระดานเทรดใดส่งข้อมูลมาใน 5 นาที",
  "Fear &amp; greed: click for the chart": "ความกลัวและความโลภ: คลิกเพื่อดูกราฟ",
  "What settled. Not what might.": "สิ่งที่จ่ายจริง ไม่ใช่สิ่งที่อาจจะเกิด",
  "Your local time ({zone}). Click for UTC.": "เวลาท้องถิ่นของคุณ ({zone}) คลิกเพื่อดู UTC",
  "UTC, the clock funding settles by. Click for your local time.":
    "UTC เวลาที่ใช้ในรอบจ่าย Funding คลิกเพื่อดูเวลาท้องถิ่น",
  filter: "กรอง",
  login: "เข้าสู่ระบบ",
  telegram: "telegram",
  "Join the airrates group on Telegram: @airratesnet": "เข้ากลุ่ม airrates บน Telegram: @airratesnet",
  status: "สถานะ",
  "geo-probe": "ตรวจภูมิภาค",
  about: "เกี่ยวกับ",
  "referral links": "ลิงก์แนะนำ",
  "MCP &amp; agents": "MCP และเอเจนต์",
  "legal &amp; privacy": "กฎหมายและความเป็นส่วนตัว",
  terms: "ข้อกำหนด",
  Language: "ภาษา",
  menu: "เมนู",
  "Not financial advice. Data may be delayed or inaccurate. Not affiliated with or endorsed by any exchange.":
    "ไม่ใช่คำแนะนำทางการเงิน ข้อมูลอาจล่าช้าหรือคลาดเคลื่อน ไม่มีส่วนเกี่ยวข้องและไม่ได้รับการรับรองจากกระดานเทรดใด",

  // web/help.ts
  "What is this?": "นี่คืออะไร?",
  "About this page": "เกี่ยวกับหน้านี้",

  // app/app.ts
  "{asset} is not an asset address.": "{asset} ไม่ใช่ที่อยู่ของสินทรัพย์",
  "No live market for {asset}.": "ไม่มีตลาดที่เปิดอยู่สำหรับ {asset}",
  "No live market for {asset}, so nothing to band against.":
    "ไม่มีตลาดที่เปิดอยู่สำหรับ {asset} จึงไม่มีราคาให้ตีกรอบ",
  "No exchange is quoting a {asset} book right now.":
    "ตอนนี้ไม่มีกระดานเทรดใดแสดง Order Book ของ {asset}",
  "There's no exchange with that name.": "ไม่มีกระดานเทรดชื่อนี้",
  "No exchange has a live {asset} perpetual right now.":
    "ตอนนี้ไม่มีกระดานเทรดใดเปิดสัญญา Perpetual ของ {asset}",
  // web/command.ts: the site-wide search, and its key on /keys
  search: "ค้นหา",
  "Search tickers, exchanges and indices": "ค้นหา Ticker กระดานเทรด และดัชนี",
  Search: "ค้นหา",
  "Ticker, exchange or index": "Ticker กระดานเทรด หรือดัชนี",
  Results: "ผลลัพธ์",
  move: "เลื่อน",
  open: "เปิด",
  close: "ปิด",
  "every exchange's rate and open interest": "อัตราและ Open Interest ของทุกกระดานเทรด",
  "Funding spreads": "สเปรด Funding",
  "backtest a long/short pair": "Backtest คู่ Long/Short",
  Screener: "สกรีนเนอร์",
  "its spreads, ranked": "จัดอันดับสเปรดของสินทรัพย์นี้",
  Arbitrage: "อาร์บิทราจ",
  "price gaps between exchanges": "ส่วนต่างราคาระหว่างกระดานเทรด",
  "large resting orders and trades": "ออร์เดอร์ใหญ่ที่ค้างอยู่และการเทรด",
  Liquidations: "การล้างพอร์ต",
  "where positions are liquidated": "ราคาที่โพซิชันโดนล้างพอร์ต",
  "options gamma by strike": "Gamma ของออปชันตาม Strike",
  "1 exchange": "1 กระดานเทรด",
  "{n} exchanges": "{n} กระดานเทรด",
  "OI {usd}": "OI {usd}",
  Tickers: "Ticker",
  "Other tickers": "Ticker อื่น ๆ",
  Exchanges: "กระดานเทรด",
  "markets, costs and grade": "ตลาด ต้นทุน และเกรด",
  "Index levels": "ระดับดัชนี",
  "the level, its daily closes and what trades on it": "ระดับดัชนี ราคาปิดรายวัน และสิ่งที่เทรดอ้างอิงดัชนีนี้",
  "Indices and option books": "ดัชนีและ Option Book",
  Pages: "หน้า",
  Recent: "ล่าสุด",
  "Loading tickers…": "กำลังโหลด Ticker…",
  "The ticker list did not load. Exchanges and pages still match.":
    "โหลดรายการ Ticker ไม่สำเร็จ แต่ยังค้นหากระดานเทรดและหน้าได้",
  "Nothing matches {q}.": "ไม่พบผลลัพธ์สำหรับ {q}",
  "price, spot and futures CVD": "ราคา และ CVD ของ Spot และ Futures",
  System: "ตามระบบ",
  "Day or Night, as your device is set": "กลางวันหรือกลางคืน ตามการตั้งค่าของอุปกรณ์",
  Settings: "การตั้งค่า",
  "Your settings on airrates: theme, clock, chart cursor, language and keyboard.":
    "การตั้งค่าของคุณบน airrates: ธีม นาฬิกา เคอร์เซอร์กราฟ ภาษา และคีย์บอร์ด",
  "Each choice is kept in this browser, not on an account: it needs no login, and another browser or device starts from the defaults. Clearing the site's data resets them.":
    "ทุกตัวเลือกเก็บไว้ในเบราว์เซอร์นี้ ไม่ได้เก็บในบัญชี: ไม่ต้องเข้าสู่ระบบ และเบราว์เซอร์หรืออุปกรณ์อื่นจะเริ่มจากค่าเริ่มต้น การล้างข้อมูลของเว็บไซต์จะรีเซ็ตทุกค่า",
  Theme: "ธีม",
  "The colours of every page. Charts take the new colours from the next page you open.":
    "สีของทุกหน้า กราฟจะใช้สีใหม่ตั้งแต่หน้าถัดไปที่คุณเปิด",
  Clock: "นาฬิกา",
  "The clock in the header, and the times on charts and tables.":
    "นาฬิกาที่หัวเว็บ และเวลาบนกราฟและตาราง",
  "Local time": "เวลาท้องถิ่น",
  "Chart cursor": "เคอร์เซอร์กราฟ",
  "What follows the pointer on a chart: a crosshair with the value on each axis, or the whole bar lit.":
    "สิ่งที่ตามเมาส์บนกราฟ: เส้นกากบาทพร้อมค่าบนแต่ละแกน หรือไฮไลต์ทั้งแท่ง",
  "The site's language, kept for this browser.": "ภาษาของเว็บไซต์ เก็บไว้สำหรับเบราว์เซอร์นี้",
  "Every shortcut on the site. Members remap them into profiles kept on their account.":
    "คีย์ลัดทั้งหมดของเว็บไซต์ สมาชิกตั้งปุ่มใหม่และเก็บเป็นโปรไฟล์ในบัญชีได้",
  "keyboard shortcuts": "คีย์ลัด",
  Reset: "รีเซ็ต",
  "Back to the defaults: Night, local time, the crosshair, the narrator open and typing, and every chart's own view.":
    "กลับไปค่าเริ่มต้น: ธีมกลางคืน เวลาท้องถิ่น เส้นกากบาท ผู้บรรยายตลาดแบบขยายและพิมพ์ทีละตัว และมุมมองเดิมของทุกกราฟ",
  "reset settings": "รีเซ็ตการตั้งค่า",
  "Saved in this browser.": "บันทึกในเบราว์เซอร์นี้แล้ว",
  "Back to the defaults.": "กลับไปค่าเริ่มต้นแล้ว",
  settings: "ตั้งค่า",
  Night: "กลางคืน",
  "Black terminal, the default": "เทอร์มินัลสีดำ ค่าเริ่มต้น",
  "Ink on white, for daylight": "ตัวอักษรเข้มบนพื้นขาว สำหรับกลางวัน",
  Solar: "โซลาร์",
  "Solarized light: warm paper, soft contrast": "Solarized สว่าง: กระดาษโทนอุ่น คอนทราสต์นุ่ม",
  "Solar dark": "โซลาร์มืด",
  "Solarized dark: deep teal": "Solarized มืด: เขียวอมฟ้าเข้ม",
  Dusk: "พลบค่ำ",
  "Slate blue, easy on the eyes at night": "ฟ้าอมเทา สบายตาตอนกลางคืน",
  Sepia: "ซีเปีย",
  "Old paper and brown ink": "กระดาษเก่าและหมึกสีน้ำตาล",
  Phosphor: "ฟอสฟอร์",
  "Green screen, an old terminal": "จอเขียว แบบเทอร์มินัลรุ่นเก่า",
  "High contrast": "คอนทราสต์สูง",
  "White on black, brightest lines": "ขาวบนดำ เส้นสว่างที่สุด",
};
