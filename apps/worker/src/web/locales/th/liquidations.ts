/**
 * Thai for web/liquidations.ts: the /liquidations map, the priced grid and the longs-vs-shorts chart,
 * the whale map, the cascades and the member Top traders tab. Glossary and style: ./index.ts.
 *
 * Terms: position โพซิชัน, force-closed ถูกบังคับปิด, longs / shorts closed Long / Short ถูกล้าง,
 * pending (modeled) ที่รออยู่, band ช่วงราคา, fill จับคู่, cross / isolated margin Cross / Isolated,
 * leaderboard Leaderboard (never กระดาน, which is an exchange here), "Into it" ระหว่างนั้น, later รอผล.
 *
 * Window codes ("24h", "7d") are left as written, as interval figures are elsewhere on the site: they
 * are units in a control strip and in its URLs, not words.
 */

import type { Catalog } from "../../i18n";

export const liquidations: Catalog = {
  // Axis dates.
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

  // Controls and legend.
  Window: "ช่วงเวลา",
  Venue: "กระดานเทรด",
  all: "ทั้งหมด",
  Cell: "ช่อง",
  "longs closed": "Long ถูกล้าง",
  "shorts closed": "Short ถูกล้าง",
  "Band width": "ความกว้างช่วง",
  Asset: "สินทรัพย์",
  fit: "พอดี",

  // The map tab.
  "{usd} across {count} liquidation — {long} long, {short} short":
    "{usd} จากการล้างพอร์ต {count} ครั้ง — Long {long} Short {short}",
  "{usd} across {count} liquidations — {long} long, {short} short":
    "{usd} จากการล้างพอร์ต {count} ครั้ง — Long {long} Short {short}",
  "This column is still filling": "คอลัมน์นี้ยังสะสมอยู่",
  "<b>{usd}</b> · {events} liquidations · {markets} markets":
    "<b>{usd}</b> · ล้างพอร์ต {events} ครั้ง · {markets} ตลาด",
  "no liquidations in this window": "ไม่มีการล้างพอร์ตในช่วงเวลานี้",
  "other markets": "ตลาดอื่น",
  total: "รวม",
  "No liquidations recorded in the last {window}. Only the venues that publish a feed the collector reads appear here, so a quiet window is not a quiet market.":
    "ไม่มีการล้างพอร์ตที่บันทึกไว้ใน {window} ที่ผ่านมา ที่นี่แสดงเฉพาะกระดานเทรดที่เปิดฟีดให้ระบบเก็บข้อมูลอ่าน ช่วงที่เงียบจึงไม่ได้แปลว่าตลาดเงียบ",
  "Columns are {hours}-hour buckets in {zone}, newest on the right; the last one is still filling.":
    "คอลัมน์คือช่วงละ {hours} ชม. ตามเวลา {zone} ใหม่สุดอยู่ขวา คอลัมน์สุดท้ายยังสะสมอยู่",
  "Newest liquidation {age}.": "การล้างพอร์ตล่าสุด {age}",
  "Rows are the {count} busiest assets by notional across every feed, and the rest are summed into “other markets”, so the totals below the grid are real totals and add up.":
    "แถวคือ {count} สินทรัพย์ที่คึกคักที่สุดตามมูลค่า Notional จากทุกฟีด ที่เหลือรวมไว้ใน “ตลาดอื่น” ยอดรวมใต้ตารางจึงเป็นยอดจริงและบวกกันได้ลงตัว",
  "Any row opens that asset at the price it died at.":
    "คลิกแถวไหนก็ได้เพื่อเปิดสินทรัพย์นั้นตามราคาที่ถูกล้างพอร์ต",

  // The priced tab.
  "<b>{usd}</b> · {events} liquidations · {long} long / {short} short":
    "<b>{usd}</b> · ล้างพอร์ต {events} ครั้ง · Long {long} / Short {short}",
  "nothing force-closed here in this window": "ไม่มีอะไรถูกบังคับปิดตรงนี้ในช่วงเวลานี้",
  "Fill price": "ราคาที่จับคู่",
  "No live market for {asset} is publishing a mark, so there is no price to band liquidations against.":
    "ไม่มีตลาด {asset} ที่เปิดอยู่ประกาศราคา Mark จึงไม่มีราคาให้แบ่งช่วงการล้างพอร์ต",
  "No liquidations recorded for {asset} in the last {window}. Only the venues publishing a feed the collector reads appear here.":
    "ไม่มีการล้างพอร์ต {asset} ที่บันทึกไว้ใน {window} ที่ผ่านมา ที่นี่แสดงเฉพาะกระดานเทรดที่เปิดฟีดให้ระบบเก็บข้อมูลอ่าน",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark; the outer rows hold everything further out.":
    "แสดง <b>{asset}</b> แบ่งเป็นช่วงราคาละ {pct}% รอบราคา Mark แถวนอกสุดรวมทุกอย่างที่ไกลออกไป",
  "Showing <b>{asset}</b>, priced in bands of {pct}% around the mark, fitted to where this asset's closes actually landed; the outer rows hold everything further out.":
    "แสดง <b>{asset}</b> แบ่งเป็นช่วงราคาละ {pct}% รอบราคา Mark ปรับให้พอดีกับจุดที่สินทรัพย์นี้ถูกปิดจริง แถวนอกสุดรวมทุกอย่างที่ไกลออกไป",
  "Banded from <b>{mark}</b>, the deepest market's mark — the same anchor the arbitrage guard uses, so both venues share rows.":
    "แบ่งช่วงจาก <b>{mark}</b> ซึ่งเป็นราคา Mark ของตลาดที่ลึกที่สุด — จุดอ้างอิงเดียวกับที่ตัวป้องกันอาร์บิทราจใช้ ทั้งสองกระดานจึงใช้แถวร่วมกัน",

  // The longs-vs-shorts tab and its chart.
  "Last {window}": "{window} ล่าสุด",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Longs took the beating.":
    "การล้างพอร์ต {asset} {window} ล่าสุด: Long ถูกบังคับปิด {long} Short ถูกบังคับปิด {short} รวม {events} ครั้ง ฝั่ง Long เจ็บหนักกว่า",
  "{asset} liquidations, last {window}: {long} of longs and {short} of shorts force-closed, {events} events. Shorts took the beating.":
    "การล้างพอร์ต {asset} {window} ล่าสุด: Long ถูกบังคับปิด {long} Short ถูกบังคับปิด {short} รวม {events} ครั้ง ฝั่ง Short เจ็บหนักกว่า",
  "{asset} longs vs shorts over time · {hours}-hour bars, {zone}":
    "{asset} Long เทียบ Short ตามเวลา · แท่งละ {hours} ชม. · {zone}",
  "{asset} longs vs shorts over time · {minutes}-minute bars, {zone}":
    "{asset} Long เทียบ Short ตามเวลา · แท่งละ {minutes} นาที · {zone}",
  "Longs closed": "Long ถูกล้าง",
  "Shorts closed": "Short ถูกล้าง",
  "Longs at risk, modeled · price falls <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "Long ที่เสี่ยง (จากโมเดล) · ราคาลง <b>{pct}</b> ไปที่ {range} · ราว <b>{usd}</b> จะถูกล้างพอร์ต",
  "Shorts at risk, modeled · price rises <b>{pct}</b> to {range} · about <b>{usd}</b> would be liquidated":
    "Short ที่เสี่ยง (จากโมเดล) · ราคาขึ้น <b>{pct}</b> ไปที่ {range} · ราว <b>{usd}</b> จะถูกล้างพอร์ต",
  "Shorts at risk above": "Short ที่เสี่ยงด้านบน",
  "Longs at risk below": "Long ที่เสี่ยงด้านล่าง",
  "Modeled pending liquidations between {low} and {high}, around {mark}: about {shorts} of shorts above and {longs} of longs below":
    "การล้างพอร์ตที่รออยู่ (จากโมเดล) ระหว่าง {low} ถึง {high} รอบ {mark}: Short ด้านบนราว {shorts} และ Long ด้านล่างราว {longs}",
  "Pending range": "ช่วงที่รออยู่",
  "Zoom in": "ซูมเข้า",
  "Columns are time, in your time zone ({zone}; click the clock at the top for UTC). Each is a {hours}-hour block named by its start hour. Where the day changes, the column shows date/hour (7/00 = the 7th at 00:00). The yellow column is the block in progress and still filling.":
    "คอลัมน์คือเวลาตามเขตเวลาของคุณ ({zone} คลิกนาฬิกาด้านบนเพื่อดู UTC) แต่ละคอลัมน์คือช่วง {hours} ชม. ตั้งชื่อตามชั่วโมงที่เริ่ม ตรงที่ขึ้นวันใหม่ คอลัมน์จะแสดง วันที่/ชั่วโมง (7/00 = วันที่ 7 เวลา 00:00) คอลัมน์สีเหลืองคือช่วงที่กำลังดำเนินอยู่และยังสะสมอยู่",
  "'All' is that price row's total over the whole window.":
    "“ทั้งหมด” คือยอดรวมของแถวราคานั้นตลอดช่วงเวลา",
  "{range}, still filling": "{range} ยังสะสมอยู่",
  "This tab did not load.": "แท็บนี้โหลดไม่สำเร็จ",
  "Try again": "ลองอีกครั้ง",
  "Loading…": "กำลังโหลด…",
  "Open this tab": "เปิดแท็บนี้",
  "This tab has nothing to show right now.": "ตอนนี้แท็บนี้ยังไม่มีอะไรให้แสดง",
  "Zoom out": "ซูมออก",
  "shorts liquidate if price rises": "Short ถูกล้างถ้าราคาขึ้น",
  "longs liquidate if price falls": "Long ถูกล้างถ้าราคาลง",
  "pending is modeled": "ส่วนที่รออยู่มาจากโมเดล",
  "pending by price band": "ที่รออยู่ตามช่วงราคา",
  "axis squeezed above {usd}": "แกนถูกบีบเหนือ {usd}",
  "Modeled from 30 days of open interest and price on each market and its leverage limits, not reported by venues.":
    "ประมาณจาก Open Interest และราคา 30 วันของแต่ละตลาด และเพดานเลเวอเรจของตลาดนั้น ไม่ใช่ข้อมูลที่กระดานเทรดรายงาน",
  Pending: "ที่รออยู่",
  "Pending on": "แสดงที่รออยู่",
  "Pending off": "ซ่อนที่รออยู่",
  "hover or tap a bar to read it": "ชี้หรือแตะแท่งเพื่ออ่านค่า",
  "{asset} bars; arrow keys read one at a time": "แท่งของ {asset} ใช้ปุ่มลูกศรอ่านทีละแท่ง",
  "{asset} longs closed above zero and shorts closed below, over the last {window}":
    "{asset} Long ที่ถูกล้างอยู่เหนือศูนย์ Short ที่ถูกล้างอยู่ใต้ศูนย์ ใน {window} ที่ผ่านมา",
  "Longs closed above the line, shorts closed below, on the same linear scale. Hover a bar to read it beside the cursor; on a phone, tap and it reads in the line above the chart. The last bar is still filling.":
    "Long ที่ถูกล้างอยู่เหนือเส้น Short อยู่ใต้เส้น ใช้สเกลเชิงเส้นเดียวกัน ชี้ที่แท่งเพื่ออ่านค่าข้างเคอร์เซอร์ บนมือถือให้แตะ แล้วค่าจะขึ้นในบรรทัดเหนือกราฟ แท่งสุดท้ายยังสะสมอยู่",
  "{usd} of longs closed between {band}": "Long ถูกล้าง {usd} ในช่วง {band}",
  "{usd} of shorts closed between {band}": "Short ถูกล้าง {usd} ในช่วง {band}",
  "Longs closed <b>{usd}</b> · {share}%": "Long ถูกล้าง <b>{usd}</b> · {share}%",
  "Shorts closed <b>{usd}</b> · {share}%": "Short ถูกล้าง <b>{usd}</b> · {share}%",
  All: "ทั้งหมด",
  "Nothing was force-closed in {asset} in the last {window}, on either side.":
    "ไม่มีโพซิชัน {asset} ถูกบังคับปิดเลยทั้งสองฝั่งใน {window} ที่ผ่านมา",
  "Showing <b>{asset}</b>, every exchange added together — the split by exchange is one tab along. Rows are the same {pct}% price bands, banded from <b>{mark}</b>. A long close is a forced SELL and a short close a forced BUY, so the heavier side is the one the move ran against. Any asset outside this list opens from a row on the map tab.":
    "แสดง <b>{asset}</b> รวมทุกกระดานเทรด — แบบแยกตามกระดานอยู่ในแท็บถัดไป แถวคือช่วงราคา {pct}% ชุดเดียวกัน แบ่งจาก <b>{mark}</b> Long ที่ถูกล้างคือการถูกบังคับขาย Short ที่ถูกล้างคือการถูกบังคับซื้อ ฝั่งที่หนักกว่าจึงเป็นฝั่งที่ราคาวิ่งสวน สินทรัพย์ที่อยู่นอกรายการนี้เปิดได้จากแถวในแท็บแผนที่",

  // The page.
  "Nothing has been force-closed in this window, so there is no asset to price.":
    "ไม่มีโพซิชันถูกบังคับปิดในช่วงเวลานี้ จึงไม่มีสินทรัพย์ให้แบ่งตามราคา",
  "Nothing has been force-closed in this window, so there is no asset to split.":
    "ไม่มีโพซิชันถูกบังคับปิดในช่วงเวลานี้ จึงไม่มีสินทรัพย์ให้แยก Long กับ Short",
  "{first} and {last}": "{first} และ {last}",
  ", ": ", ",
  Liquidations: "การล้างพอร์ต",
  "Where positions were force-closed: by venue, asset and hour, and by the price level they died at.":
    "โพซิชันถูกบังคับปิดที่ไหนบ้าง: แยกตามกระดานเทรด สินทรัพย์ และชั่วโมง และตามระดับราคาที่ถูกล้าง",
  "Where positions were force-closed, by exchange. Colour is the side that was closed — {longs}, {shorts} — and intensity is the money, on a log scale.":
    "โพซิชันถูกบังคับปิดที่ไหน แยกตามกระดานเทรด สีบอกฝั่งที่ถูกปิด — {longs} {shorts} — ความเข้มบอกจำนวนเงิน ในสเกลลอการิทึม",
  "blue for longs": "สีน้ำเงินคือ Long",
  "red for shorts": "สีแดงคือ Short",
  "No venue has reported a liquidation in this window.":
    "ไม่มีกระดานเทรดไหนรายงานการล้างพอร์ตในช่วงเวลานี้",
  "This is {venues}, the one venue whose liquidation feed the collector reads — not the whole market.":
    "ข้อมูลนี้มาจาก {venues} กระดานเทรดเดียวที่ระบบเก็บข้อมูลอ่านฟีดการล้างพอร์ต — ไม่ใช่ทั้งตลาด",
  "This is {venues}, the {count} venues whose liquidation feed the collector reads — not the whole market.":
    "ข้อมูลนี้มาจาก {venues} ซึ่งเป็น {count} กระดานเทรดที่ระบบเก็บข้อมูลอ่านฟีดการล้างพอร์ต — ไม่ใช่ทั้งตลาด",
  "Asset Timeline": "ไทม์ไลน์สินทรัพย์",
  Timeline: "ไทม์ไลน์",
  Assets: "สินทรัพย์",
  "Longs vs shorts": "Long เทียบ Short",
  "{asset} longs vs shorts": "{asset} Long เทียบ Short",
  Sides: "Long/Short",
  "By price level": "ตามระดับราคา",
  "{asset} price levels": "ระดับราคา {asset}",
  Prices: "ราคา",
  "Updated {ago}.": "อัปเดต {ago}",

  // The odds tab.
  Odds: "โอกาส",
  "{asset} odds": "โอกาสของ {asset}",
  "Nothing has been force-closed in this window, so there is no asset to size.":
    "ไม่มีโพซิชันถูกบังคับปิดในช่วงเวลานี้ จึงไม่มีสินทรัพย์ให้ประเมินการขยับ",
  "4 hours": "4 ชม.",
  "6 hours": "6 ชม.",
  "1 day": "1 วัน",
  "1 week": "1 สัปดาห์",
  Within: "ภายใน",
  "Typical move (1 sigma)": "การขยับปกติ (1 sigma)",
  "Closes higher than now": "ปิดสูงกว่าตอนนี้",
  "Reaches the heaviest forced-close level": "แตะระดับที่ถูกบังคับปิดหนักที่สุด",
  "Whichever of those two it reaches first": "ระดับไหนในสองระดับนั้นที่แตะก่อน",
  "The upper one first": "แตะระดับบนก่อน",
  "The lower one first": "แตะระดับล่างก่อน",
  Neither: "ไม่แตะเลย",
  "Reaches a move of": "ขยับถึง",
  "{price} ({where}) · {usd} closed, {share} of the window":
    "{price} ({where}) · ถูกปิด {usd} คิดเป็น {share} ของช่วงเวลา",
  Theory: "ทฤษฎี",
  "Reading now": "ค่าตอนนี้",
  Leans: "เอียงไปทาง",
  "Moves the odds?": "เปลี่ยนโอกาสไหม?",
  up: "ขึ้น",
  down: "ลง",
  "Forced-close burst fades": "หลังล้างพอร์ตรัว ราคากลับตัว",
  "Funding crowding fades": "หลัง Funding แออัด ราคากลับตัว",
  "Stretch from the 50-hour average fades": "ราคาที่ยืดห่างจากค่าเฉลี่ย 50 ชม. จะกลับตัว",
  "Initiative vs absorption": "แรงรุกเทียบแรงรับ",
  "Fear and greed": "ความกลัวและความโลภ",
  "Liquidation magnet": "แม่เหล็กล้างพอร์ต",
  "Needs open positions by price level. The collector keeps closed ones only, so this cannot be read yet.":
    "ต้องใช้โพซิชันที่เปิดอยู่แยกตามระดับราคา ระบบเก็บข้อมูลเก็บเฉพาะที่ปิดแล้ว จึงยังอ่านค่านี้ไม่ได้",
  "Fewer than 5 forced closes in the last 4 hours: too thin to call a burst.":
    "ถูกบังคับปิดน้อยกว่า 5 ครั้งใน 4 ชม. ที่ผ่านมา: น้อยเกินกว่าจะเรียกว่ารัว",
  "Not enough data.": "ข้อมูลไม่พอ",
  "{longs} of the last 4 hours' forced closes were longs ({usd} in all)":
    "{longs} ของการบังคับปิดใน 4 ชม. ที่ผ่านมาเป็น Long (รวม {usd})",
  "{apr} a year funding, weighted by open interest": "Funding {apr} ต่อปี ถ่วงน้ำหนักตาม Open Interest",
  "{sigma} bar-sigmas above its 50-hour average": "สูงกว่าค่าเฉลี่ย 50 ชม. {sigma} sigma ต่อแท่ง",
  "{sigma} bar-sigmas below its 50-hour average": "ต่ำกว่าค่าเฉลี่ย 50 ชม. {sigma} sigma ต่อแท่ง",
  "takers net buying {pct} of volume": "Taker ซื้อสุทธิ {pct} ของวอลุ่ม",
  "takers net selling {pct} of volume": "Taker ขายสุทธิ {pct} ของวอลุ่ม",
  "{flow}, price {change} over 4 hours": "{flow} ราคา {change} ใน 4 ชม.",
  "{score} out of 100": "{score} จาก 100",
  "No. Not yet tested, so it carries no weight.": "ไม่ ยังไม่ผ่านการทดสอบ จึงไม่มีน้ำหนัก",
  "No. Context only: its claim never leans.": "ไม่ ใช้เป็นบริบทเท่านั้น: ทฤษฎีนี้ไม่ชี้ทิศทาง",
  "No. Cannot be computed.": "ไม่ คำนวณไม่ได้",
  "There is not yet enough price history for {asset} to size its moves, or no live market is publishing a mark. The odds need at least 12 hours of closes.":
    "ประวัติราคาของ {asset} ยังไม่พอจะประเมินการขยับ หรือไม่มีตลาดที่เปิดอยู่ประกาศราคา Mark การคำนวณโอกาสต้องใช้ราคาปิดอย่างน้อย 12 ชม.",
  "These are the odds that <b>{asset}</b> reaches a price within each horizon, worked out from how far it has actually been moving: about {hourly} an hour over the last {hours} hours. They are not a forecast of direction.":
    "นี่คือโอกาสที่ <b>{asset}</b> จะแตะราคาหนึ่งภายในแต่ละกรอบเวลา คำนวณจากระยะที่มันขยับจริง: ราว {hourly} ต่อชั่วโมงใน {hours} ชม. ที่ผ่านมา ไม่ใช่การคาดการณ์ทิศทาง",
  "The levels are where the most dollars were force-closed in the last {window}. Those positions are gone, so a heavy level is somewhere price has been, not fuel waiting for it. The collector does not keep open positions by price, so the resting map a liquidation magnet needs cannot be built yet.":
    "ระดับเหล่านี้คือจุดที่เงินถูกบังคับปิดมากที่สุดใน {window} ที่ผ่านมา โพซิชันเหล่านั้นหายไปแล้ว ระดับที่หนักจึงเป็นที่ที่ราคาเคยไปมา ไม่ใช่เชื้อเพลิงที่รอราคาอยู่ ระบบเก็บข้อมูลไม่ได้เก็บโพซิชันที่เปิดอยู่แยกตามราคา จึงยังสร้างแผนที่ที่แม่เหล็กล้างพอร์ตต้องใช้ไม่ได้",
  "Real prices have fatter tails than this model assumes, so the far levels are reached more often than shown. Volatility is measured over the recent past and held constant.":
    "ราคาจริงมีหาง (Tail) หนากว่าที่โมเดลนี้สมมติ ระดับที่ไกลจึงถูกแตะบ่อยกว่าที่แสดง ความผันผวนวัดจากช่วงที่ผ่านมาไม่นาน และถือว่าคงที่",
  "Odds of reaching a level, from {asset}'s own volatility. They say how far it can go, not which way. The chance of closing higher stays at 50% until a theory below passes a test set in advance, after costs.":
    "โอกาสที่จะแตะแต่ละระดับ จากความผันผวนของ {asset} เอง บอกว่าไปได้ไกลแค่ไหน ไม่ใช่ไปทางไหน โอกาสที่จะปิดสูงกว่าคงอยู่ที่ 50% จนกว่าทฤษฎีด้านล่างจะผ่านการทดสอบที่ตั้งไว้ล่วงหน้า หลังหักต้นทุน",
  "Levels closer than the 4-hour typical move ({pct}) are left out, because price is already standing in them.":
    "ระดับที่ใกล้กว่าการขยับปกติ 4 ชม. ({pct}) ไม่ได้นำมาแสดง เพราะราคาอยู่ในช่วงนั้นอยู่แล้ว",
  "No forced-close level lies beyond the 4-hour typical move":
    "ไม่มีระดับบังคับปิดที่อยู่ไกลกว่าการขยับปกติ 4 ชม.",
  "What the liquidation theories read now": "ทฤษฎีการล้างพอร์ตอ่านค่าได้อะไรตอนนี้",
  "A reading that leans one way is a hypothesis, not a signal: none of these has been shown to beat the base rate. The first three are measured against a fade, the way their test was written down in advance, and a flat reading leans nowhere.":
    "ค่าที่เอียงไปทางใดทางหนึ่งเป็นแค่สมมติฐาน ไม่ใช่สัญญาณ: ยังไม่มีข้อไหนพิสูจน์ได้ว่าชนะอัตราฐาน สามข้อแรกวัดแบบกลับตัว ตามที่เขียนการทดสอบไว้ล่วงหน้า และค่าที่ทรงตัวไม่เอียงไปทางไหน",
  // web/liquidations.ts: the whale map tab.
  "Nothing has been force-closed in this window, so there is no asset to map.":
    "ไม่มีโพซิชันถูกบังคับปิดในช่วงเวลานี้ จึงไม่มีสินทรัพย์ให้ทำแผนที่",
  "Position size": "ขนาดโพซิชัน",
  "Price range": "ช่วงราคา",
  "Whale map": "แผนที่วาฬ",
  "{asset} whale map": "แผนที่วาฬ {asset}",
  Whales: "วาฬ",

  // web/whale-map.ts
  "mark {price}": "Mark {price}",
  "{n} positions of {floor} or more · {longs} of longs, {shorts} of shorts · hover or tap a bar to read it":
    "{n} โพซิชันขนาด {floor} ขึ้นไป · Long {longs} · Short {shorts} · ชี้หรือแตะแท่งเพื่ออ่านค่า",
  "Beyond ±{pct} of the mark, off the chart: {longs} of longs and {shorts} of shorts.":
    "เกิน ±{pct} จากราคา Mark นอกกราฟ: Long {longs} และ Short {shorts}",
  "{asset} · whale positions by liquidation price · {venues}":
    "{asset} · โพซิชันวาฬตามราคาล้างพอร์ต · {venues}",
  "Longs liquidate": "Long จะถูกล้าง",
  "Shorts liquidate": "Short จะถูกล้าง",
  "Total to the mark": "ยอดสะสมถึงราคา Mark",
  "{asset} price bands; arrow keys read one at a time": "ช่วงราคา {asset} ใช้ปุ่มลูกศรอ่านทีละช่วง",
  "{asset} whale positions by the price they liquidate at": "โพซิชันวาฬ {asset} ตามราคาที่จะถูกล้าง",
  "Every position here is one an exchange publishes for a named account: reported, not modeled. Only Hyperliquid, Lighter and dYdX publish every account's positions, and together they hold about a tenth of the open interest; Binance, OKX and the other centralized exchanges publish none, so they are not in this map.":
    "ทุกโพซิชันที่นี่เป็นโพซิชันที่กระดานเทรดเปิดเผยของบัญชีที่ระบุได้: เป็นข้อมูลที่รายงานจริง ไม่ใช่โมเดล มีแค่ Hyperliquid, Lighter และ dYdX ที่เปิดเผยโพซิชันของทุกบัญชี และรวมกันถือ Open Interest ราวหนึ่งในสิบ Binance, OKX และกระดานเทรดแบบรวมศูนย์อื่น ๆ ไม่เปิดเผยเลย จึงไม่อยู่ในแผนที่นี้",
  "Hyperliquid and Lighter report each position's liquidation price. dYdX does not, so its are computed from the account's own balance and positions with dYdX's maintenance margins, holding its other prices where they are; they are marked * in the table.":
    "Hyperliquid และ Lighter รายงานราคาล้างพอร์ตของแต่ละโพซิชัน dYdX ไม่รายงาน จึงคำนวณจากยอดคงเหลือและโพซิชันของบัญชีเอง ด้วย Maintenance Margin ของ dYdX โดยถือว่าราคาอื่นของบัญชีคงที่ ในตารางมีเครื่องหมาย * กำกับไว้",
  "On Hyperliquid the collector watches the leaderboard's accounts worth $100k or more and any account it sees in a large trade, re-reading each every few minutes while it holds $1M or more and hourly while it holds $100k. On Lighter it follows the leaderboard's owners with $100k in the account or a $100k position, whose changes arrive as they happen. On dYdX it reads every account on the chain every five minutes. So the map covers the largest traders, not every account.":
    "บน Hyperliquid ระบบเก็บข้อมูลเฝ้าดูบัญชีใน Leaderboard ที่มีมูลค่า $100k ขึ้นไป และบัญชีไหนก็ตามที่เห็นในการซื้อขายก้อนใหญ่ อ่านซ้ำทุกไม่กี่นาทีขณะที่ถือ $1M ขึ้นไป และทุกชั่วโมงขณะที่ถือ $100k บน Lighter จะติดตามเจ้าของบัญชีใน Leaderboard ที่มี $100k ในบัญชีหรือมีโพซิชัน $100k ซึ่งการเปลี่ยนแปลงส่งมาทันทีที่เกิด บน dYdX จะอ่านทุกบัญชีบนเชนทุกห้านาที แผนที่จึงครอบคลุมเทรดเดอร์รายใหญ่ที่สุด ไม่ใช่ทุกบัญชี",
  "A cross-margin position's liquidation price moves with the rest of its account: its other positions' profit and loss, deposits and withdrawals. Each one is as of its account's last read, shown in the table. Bars are the money that liquidates in each price band, longs below the mark and shorts above; the lines add up everything between the mark and that price.":
    "ราคาล้างพอร์ตของโพซิชัน Cross Margin ขยับตามส่วนอื่นของบัญชี: กำไรขาดทุนของโพซิชันอื่น การฝาก และการถอน แต่ละโพซิชันเป็นข้อมูล ณ การอ่านบัญชีครั้งล่าสุด ซึ่งแสดงไว้ในตาราง แท่งคือเงินที่จะถูกล้างในแต่ละช่วงราคา Long อยู่ใต้ราคา Mark และ Short อยู่เหนือ เส้นคือยอดสะสมทั้งหมดตั้งแต่ราคา Mark ถึงราคานั้น",
  "The whale positions could not be read right now.": "ตอนนี้อ่านโพซิชันวาฬไม่ได้",
  "No position of {floor} or more in {asset} among the accounts watched.":
    "ไม่มีโพซิชัน {asset} ขนาด {floor} ขึ้นไปในบัญชีที่เฝ้าดู",
  "There are {n} of $100k or more: switch to $100k+.": "มี {n} โพซิชันขนาด $100k ขึ้นไป: สลับเป็น $100k+",
  "nearest at {price} ({pct})": "ใกล้สุดที่ {price} ({pct})",
  "none with a liquidation price": "ไม่มีโพซิชันที่มีราคาล้างพอร์ต",
  "Whale longs": "Long ของวาฬ",
  "{n} positions": "{n} โพซิชัน",
  "Whale shorts": "Short ของวาฬ",
  "Within 5% of the mark": "ภายใน 5% จากราคา Mark",
  "longs below / shorts above": "Long ด้านล่าง / Short ด้านบน",
  Accounts: "บัญชี",
  "read a median {age}": "อ่านเมื่อ (มัธยฐาน) {age}",
  "No live mark for {asset}, so the positions cannot be placed on a price axis.":
    "ไม่มีราคา Mark ของ {asset} ที่เปิดอยู่ จึงวางโพซิชันบนแกนราคาไม่ได้",
  long: "Long",
  short: "Short",
  "No liquidation price: the account's margin covers any move":
    "ไม่มีราคาล้างพอร์ต: Margin ของบัญชีรองรับการขยับได้ทุกระดับ",
  "dYdX publishes no liquidation price: computed from the account's balance and positions with dYdX's maintenance margins":
    "dYdX ไม่เปิดเผยราคาล้างพอร์ต: คำนวณจากยอดคงเหลือและโพซิชันของบัญชี ด้วย Maintenance Margin ของ dYdX",
  "By venue:": "ตามกระดานเทรด:",
  none: "ไม่มี",
  "{leverage}× isolated": "{leverage}× Isolated",
  // Cross margin, not the chart cursor's crosshair (charts.ts's "cross").
  "{leverage}× cross": "{leverage}× Cross",
  "The {n} nearest to liquidation of {total}.": "{n} โพซิชันที่ใกล้ถูกล้างที่สุดจาก {total}",
  "Positions by distance to liquidation": "โพซิชันเรียงตามระยะห่างจากจุดล้าง",
  Trader: "เทรดเดอร์",
  Value: "มูลค่า",
  Entry: "ราคาเข้า",
  "Liquidates at": "ล้างที่",
  "From the market's mark to the liquidation price": "จากราคา Mark ของตลาดถึงราคาล้างพอร์ต",
  Leverage: "เลเวอเรจ",
  Unrealized: "PnL ยังไม่รับรู้",
  "The whole account's value on its venue": "มูลค่าทั้งบัญชีบนกระดานเทรดนั้น",
  Account: "บัญชี",
  Read: "อ่านเมื่อ",
  // Before a link to the member login, inside the sentence below.
  "Log in": "เข้าสู่ระบบ",
  "Refreshes every 30 s. {login} to refresh every 10 s, with the nearest accounts re-read about every minute.":
    "รีเฟรชทุก 30 วิ {login}เพื่อรีเฟรชทุก 10 วิ และอ่านบัญชีที่ใกล้ที่สุดซ้ำราวทุกนาที",
  "Live for members: refreshes every 10 s, and the nearest accounts are re-read about every minute.":
    "สดสำหรับสมาชิก: รีเฟรชทุก 10 วิ และอ่านบัญชีที่ใกล้ที่สุดซ้ำราวทุกนาที",
  Indexes: "ดัชนี",
  "Other stocks": "หุ้นอื่น ๆ",
  "Energy and other commodities": "พลังงานและโภคภัณฑ์อื่น ๆ",
  FX: "FX",
  "{long} long · {short} short": "Long {long} · Short {short}",
  "Pick an asset": "เลือกสินทรัพย์",
  "Filter assets": "กรองสินทรัพย์",
  Liquidated: "ถูกล้าง",
  "Longs / shorts": "Long / Short",
  Events: "ครั้ง",
  "{asset} liquidations": "การล้างพอร์ต {asset}",
  "{asset} liquidations across exchanges: longs against shorts by the hour, the price levels positions were closed at, and where large open positions would be liquidated.":
    "การล้างพอร์ต {asset} ทุกกระดานเทรด: Long เทียบ Short รายชั่วโมง ระดับราคาที่โพซิชันถูกปิด และจุดที่โพซิชันใหญ่ที่เปิดอยู่จะถูกล้าง",
  "All assets": "ทุกสินทรัพย์",
  "{n} exchange": "{n} กระดานเทรด",
  "{n} asset": "{n} สินทรัพย์",
  "In the last 7 days": "ใน 7 วันที่ผ่านมา",
  "In the last 48 hours": "ใน 48 ชม. ที่ผ่านมา",
  "In the last 24 hours": "ใน 24 ชม. ที่ผ่านมา",
  "{share} of it longs": "เป็น Long {share}",
  "{share} of it shorts": "เป็น Short {share}",
  "{window}, no {asset} position was force-closed on the exchanges whose liquidation feeds the collector reads.":
    "{window} ไม่มีโพซิชัน {asset} ถูกบังคับปิดบนกระดานเทรดที่ระบบเก็บข้อมูลอ่านฟีดการล้างพอร์ต",
  "{window}, {total} of {asset} positions were force-closed in {events} on {venues}, {sides}.":
    "{window} โพซิชัน {asset} ถูกบังคับปิดรวม {total} ({events}) บน {venues} {sides}",
  "The largest single one was a {usd} long on {venue} at {price}, {ago}.":
    "รายการเดียวที่ใหญ่สุดคือ Long {usd} บน {venue} ที่ {price} เมื่อ {ago}",
  "The largest single one was a {usd} short on {venue} at {price}, {ago}.":
    "รายการเดียวที่ใหญ่สุดคือ Short {usd} บน {venue} ที่ {price} เมื่อ {ago}",
  "Of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX, {longs} of longs would be liquidated within 5% below the price and {shorts} of shorts within 5% above.":
    "ในโพซิชันวาฬขนาด $1M ขึ้นไปที่เฝ้าดูบน Hyperliquid, Lighter และ dYdX มี Long {longs} ที่จะถูกล้างภายใน 5% ใต้ราคา และ Short {shorts} ภายใน 5% เหนือราคา",
  "{window}, {total} of positions were force-closed across {assets} on {venues}, {sides}.":
    "{window} โพซิชันถูกบังคับปิดรวม {total} ใน {assets} บน {venues} {sides}",
  "The most liquidated: {list}.": "ถูกล้างมากที่สุด: {list}",
  "The largest single liquidation was a {usd} {asset} long on {venue} at {price} ({when} UTC).":
    "การล้างพอร์ตรายการเดียวที่ใหญ่สุดคือ Long {asset} {usd} บน {venue} ที่ {price} ({when} UTC)",
  "The largest single liquidation was a {usd} {asset} short on {venue} at {price} ({when} UTC).":
    "การล้างพอร์ตรายการเดียวที่ใหญ่สุดคือ Short {asset} {usd} บน {venue} ที่ {price} ({when} UTC)",
  Order: "เรียง",
  "Largest first": "ใหญ่สุดก่อน",
  "Newest first": "ใหม่สุดก่อน",
  "Smallest close": "ขนาดขั้นต่ำ",
  "The largest liquidations could not be read right now.": "ตอนนี้อ่านการล้างพอร์ตที่ใหญ่สุดไม่ได้",
  "No single liquidation of {floor} or more in this window.":
    "ไม่มีการล้างพอร์ตรายการเดียวขนาด {floor} ขึ้นไปในช่วงเวลานี้",
  "Nothing has been force-closed in this window.": "ไม่มีโพซิชันถูกบังคับปิดในช่วงเวลานี้",
  "The {n} newest liquidations of {floor} or more in this window.":
    "การล้างพอร์ตขนาด {floor} ขึ้นไป {n} รายการล่าสุดในช่วงเวลานี้",
  "Every liquidation of {floor} or more in this window.":
    "การล้างพอร์ตขนาด {floor} ขึ้นไปทั้งหมดในช่วงเวลานี้",
  "The {n} largest single liquidations in this window.":
    "การล้างพอร์ตรายการเดียวที่ใหญ่สุด {n} รายการในช่วงเวลานี้",
  "Every liquidation in this window, largest first.": "การล้างพอร์ตทั้งหมดในช่วงเวลานี้ เรียงจากใหญ่สุด",
  "The position's value at the fill price": "มูลค่าโพซิชันที่ราคาจับคู่",
  "Each row is one forced close as its exchange reported it: the side is the position that was closed, the size its value at the fill price. Times are in {zone}.":
    "แต่ละแถวคือการบังคับปิดหนึ่งครั้งตามที่กระดานเทรดรายงาน: ฝั่งคือโพซิชันที่ถูกปิด ขนาดคือมูลค่าที่ราคาจับคู่ เวลาเป็น {zone}",
  "{asset} largest liquidations": "การล้างพอร์ตใหญ่สุดของ {asset}",
  "Largest liquidations": "การล้างพอร์ตใหญ่สุด",
  Largest: "ใหญ่สุด",
  "None of the whale positions of $1M or more watched on Hyperliquid, Lighter and dYdX would be liquidated within 5% of the price.":
    "ไม่มีโพซิชันวาฬขนาด $1M ขึ้นไปที่เฝ้าดูบน Hyperliquid, Lighter และ dYdX ที่จะถูกล้างภายใน 5% จากราคา",
  later: "รอผล",
  "A cascade is a burst in which one asset's liquidations piled up within minutes: consecutive minutes each running at {pace} times its 7-day average pace or more, with no more than {gap} quiet minutes between them, and at least an hour's worth of that average pace, and {floor}, in all. Every exchange whose liquidation feed the collector reads is counted; the venue choices on the other tabs do not narrow it.":
    "ล้างพอร์ตลูกโซ่คือช่วงที่การล้างพอร์ตของสินทรัพย์หนึ่งกองพะเนินภายในไม่กี่นาที: นาทีต่อเนื่องที่แต่ละนาทีเร็วถึง {pace} เท่าของความเร็วเฉลี่ย 7 วันขึ้นไป มีช่วงเงียบคั่นไม่เกิน {gap} นาที และรวมแล้วได้อย่างน้อยเท่ากับความเร็วเฉลี่ยนั้นหนึ่งชั่วโมง และไม่น้อยกว่า {floor} นับทุกกระดานเทรดที่ระบบเก็บข้อมูลอ่านฟีดการล้างพอร์ต ตัวเลือกกระดานเทรดในแท็บอื่นไม่ได้ทำให้ขอบเขตแคบลง",
  "Prices are the asset's busiest market in 5-minute candles. Into it is the move from the last close before the cascade to the furthest the price went inside it: the low when mostly longs were closed, the high when mostly shorts were. 1h and 4h after run from the close at its end to the close an hour and four hours later, and say later until that candle has closed.":
    "ราคามาจากตลาดที่คึกคักที่สุดของสินทรัพย์ เป็นแท่งเทียน 5 นาที “ระหว่างนั้น” คือการขยับจากราคาปิดสุดท้ายก่อนเกิดลูกโซ่ ไปจนถึงจุดที่ราคาไปไกลที่สุดระหว่างนั้น: จุดต่ำสุดเมื่อส่วนใหญ่เป็น Long ที่ถูกปิด จุดสูงสุดเมื่อส่วนใหญ่เป็น Short “1 ชม. หลัง” และ “4 ชม. หลัง” วัดจากราคาปิดตอนจบถึงราคาปิดหนึ่งและสี่ชั่วโมงต่อมา และแสดง “รอผล” จนกว่าแท่งนั้นจะปิด",
  "The cascades could not be read right now.": "ตอนนี้อ่านข้อมูลล้างพอร์ตลูกโซ่ไม่ได้",
  "No cascade in {asset} in this window: no burst reached {pace} times its usual pace with an hour's worth of it. Its usual pace is {usd} a minute, the 7-day average.":
    "ไม่มีล้างพอร์ตลูกโซ่ใน {asset} ช่วงเวลานี้: ไม่มีช่วงไหนเร็วถึง {pace} เท่าของความเร็วปกติและสะสมได้เท่ากับหนึ่งชั่วโมง ความเร็วปกติคือ {usd} ต่อนาที ค่าเฉลี่ย 7 วัน",
  "none in this window": "ไม่มีในช่วงเวลานี้",
  "none an hour old yet": "ยังไม่มีอันที่ครบหนึ่งชั่วโมง",
  "higher in {up} of {n}": "สูงขึ้น {up} จาก {n} ครั้ง",
  Cascades: "ล้างพอร์ตลูกโซ่",
  "{usd} longs": "Long {usd}",
  "{usd} shorts": "Short {usd}",
  "An hour after long cascades": "หนึ่งชั่วโมงหลังลูกโซ่ฝั่ง Long",
  "An hour after short cascades": "หนึ่งชั่วโมงหลังลูกโซ่ฝั่ง Short",
  "Usual pace": "ความเร็วปกติ",
  "a minute, the 7-day average": "ต่อนาที ค่าเฉลี่ย 7 วัน",
  "{n} min": "{n} นาที",
  "longs {share}": "Long {share}",
  "shorts {share}": "Short {share}",
  "Prices: {market} on {venue}, in 5-minute candles.": "ราคา: {market} บน {venue} แท่งเทียน 5 นาที",
  "No price history for {asset}, so the moves are blank.": "ไม่มีประวัติราคาของ {asset} ช่องการขยับจึงว่าง",
  Start: "เริ่ม",
  Length: "ความยาว",
  "Exchanges with a liquidation in it": "กระดานเทรดที่มีการล้างพอร์ตในช่วงนั้น",
  "The last close before the cascade began": "ราคาปิดสุดท้ายก่อนลูกโซ่เริ่ม",
  "Price before": "ราคาก่อน",
  "From the price before to the furthest it went inside the cascade":
    "จากราคาก่อนถึงจุดที่ไปไกลที่สุดในช่วงลูกโซ่",
  "Into it": "ระหว่างนั้น",
  "From the close at its end to the close an hour later": "จากราคาปิดตอนจบถึงราคาปิดหนึ่งชั่วโมงต่อมา",
  "1h after": "1 ชม. หลัง",
  "From the close at its end to the close four hours later": "จากราคาปิดตอนจบถึงราคาปิดสี่ชั่วโมงต่อมา",
  "4h after": "4 ชม. หลัง",
  "Newest first.": "ใหม่สุดก่อน",
  "Times are in {zone}.": "เวลาเป็น {zone}",
  "Nothing has been force-closed in this window, so there is no asset to read.":
    "ไม่มีโพซิชันถูกบังคับปิดในช่วงเวลานี้ จึงไม่มีสินทรัพย์ให้อ่าน",
  "{asset} cascades": "ล้างพอร์ตลูกโซ่ {asset}",
  "{asset} longs vs shorts by day · UTC days": "{asset} Long เทียบ Short รายวัน · วันตาม UTC",
  "30- and 90-day history": "ประวัติ 30 และ 90 วัน",
  "{asset} over 30 and 90 days": "{asset} ใน 30 และ 90 วัน",
  "Every day's longs and shorts liquidated over the last 30 or 90 days, each day as a share of the open interest on the same exchanges, and the heaviest days ranked.":
    "Long และ Short ที่ถูกล้างในแต่ละวันตลอด 30 หรือ 90 วันที่ผ่านมา แต่ละวันคิดเป็นสัดส่วนของ Open Interest บนกระดานเทรดชุดเดียวกัน พร้อมจัดอันดับวันที่หนักที่สุด",
  "Liquidations against open interest": "การล้างพอร์ตเทียบ Open Interest",
  "Which markets were really flushed rather than just big: every asset's liquidations in the window as a share of its open interest, and the same for crypto, stocks, commodities and indices.":
    "ตลาดไหนถูกล้างจริง ๆ ไม่ใช่แค่ใหญ่: การล้างพอร์ตของทุกสินทรัพย์ในช่วงเวลานี้คิดเป็นสัดส่วนของ Open Interest และแบบเดียวกันสำหรับคริปโต หุ้น โภคภัณฑ์ และดัชนี",
  "For members": "สำหรับสมาชิก",
  "Create a free account": "สมัครสมาชิกฟรี",
  "Loading the member view…": "กำลังโหลดมุมมองสมาชิก…",
  "The history could not be read right now.": "ตอนนี้อ่านประวัติไม่ได้",
  "Nothing was force-closed in {asset} over this span.": "ไม่มีโพซิชัน {asset} ถูกบังคับปิดในช่วงนี้",
  "Liquidated over {span} days": "ถูกล้างใน {span} วัน",
  "A typical day": "วันปกติ",
  "of open interest, on average": "ของ Open Interest โดยเฉลี่ย",
  "The heaviest day": "วันที่หนักที่สุด",
  "Days with data": "วันที่มีข้อมูล",
  "from {date}": "ตั้งแต่ {date}",
  "The heaviest days, as a share of open interest": "วันที่หนักที่สุด คิดเป็นสัดส่วนของ Open Interest",
  "Day (UTC)": "วัน (UTC)",
  "Exchanges that reported a liquidation that day": "กระดานเทรดที่รายงานการล้างพอร์ตในวันนั้น",
  "Open interest is the day's average on the exchanges whose liquidation feeds reported {asset}, so the share compares like with like.":
    "Open Interest คือค่าเฉลี่ยของวันบนกระดานเทรดที่ฟีดการล้างพอร์ตรายงาน {asset} สัดส่วนจึงเทียบกันบนฐานเดียวกัน",
  "Liquidation feeds were added over time: from {least} to {most} exchanges a day here, so early days undercount.":
    "ฟีดการล้างพอร์ตถูกเพิ่มเข้ามาเรื่อย ๆ: ที่นี่มีวันละ {least} ถึง {most} กระดานเทรด วันแรก ๆ จึงนับได้น้อยกว่าจริง",
  Commodities: "โภคภัณฑ์",
  Indices: "ดัชนี",
  "The open interest could not be read right now.": "ตอนนี้อ่าน Open Interest ไม่ได้",
  "{liq} of {oi} open": "{liq} จาก {oi} ที่เปิดอยู่",
  "The markets most flushed for their size": "ตลาดที่ถูกล้างมากที่สุดเมื่อเทียบกับขนาด",
  "No market with $1M of open interest had a liquidation in this window.":
    "ไม่มีตลาดที่มี Open Interest $1M ที่มีการล้างพอร์ตในช่วงเวลานี้",
  Class: "กลุ่ม",
  "Liquidations over the last {window} against the open interest now, both on the {feeds} exchanges whose liquidation feeds reported closes in that window. Markets under $1M of open interest are left out of the ranking.":
    "การล้างพอร์ตใน {window} ที่ผ่านมาเทียบกับ Open Interest ตอนนี้ ทั้งสองอย่างจาก {feeds} กระดานเทรดที่ฟีดการล้างพอร์ตรายงานการปิดในช่วงนั้น ตลาดที่มี Open Interest ต่ำกว่า $1M ไม่ถูกนำมาจัดอันดับ",
  Span: "ช่วง",
  History: "ประวัติ",
  "{asset} history": "ประวัติ {asset}",
  "Liquidations vs open interest": "การล้างพอร์ตเทียบ Open Interest",
  "vs OI": "เทียบ OI",
  "Every cascade, in every asset": "ล้างพอร์ตลูกโซ่ทุกครั้ง ทุกสินทรัพย์",
  "Every liquidation cascade in every asset, found each minute as it happens, with the price an hour and four hours after. Members can also have them sent to Telegram the moment they start.":
    "ล้างพอร์ตลูกโซ่ทุกครั้งในทุกสินทรัพย์ ตรวจพบทุกนาทีขณะเกิดขึ้น พร้อมราคาหนึ่งและสี่ชั่วโมงหลังจากนั้น สมาชิกยังรับแจ้งเตือนทาง Telegram ได้ทันทีที่เริ่ม",
  "No cascade in any asset in the last {window}.": "ไม่มีล้างพอร์ตลูกโซ่ในสินทรัพย์ไหนเลยใน {window} ที่ผ่านมา",
  "in {n} assets": "ใน {n} สินทรัพย์",
  "Longs and shorts": "Long และ Short",
  "{longs} long cascades, {shorts} short": "ลูกโซ่ฝั่ง Long {longs} ครั้ง ฝั่ง Short {shorts}",
  "The deepest market's mark when the watch first saw it, a minute or two in":
    "ราคา Mark ของตลาดที่ลึกที่สุดตอนที่ระบบเฝ้าดูเห็นครั้งแรก ราวหนึ่งถึงสองนาทีหลังเริ่ม",
  "Price when seen": "ราคาตอนพบ",
  "From the price when seen to the mark an hour after the cascade ended":
    "จากราคาตอนพบถึงราคา Mark หนึ่งชั่วโมงหลังลูกโซ่จบ",
  "From the price when seen to the mark four hours after the cascade ended":
    "จากราคาตอนพบถึงราคา Mark สี่ชั่วโมงหลังลูกโซ่จบ",
  "Every asset, found each minute as it happens, by the rule of each asset's Cascades tab. Prices are the asset's deepest market's mark when the watch saw it and an hour and four hours after it ended. Members can have them sent to Telegram from {alerts}.":
    "ทุกสินทรัพย์ ตรวจพบทุกนาทีขณะเกิดขึ้น ตามกฎเดียวกับแท็บล้างพอร์ตลูกโซ่ของแต่ละสินทรัพย์ ราคาคือราคา Mark ของตลาดที่ลึกที่สุดของสินทรัพย์ตอนที่ระบบเฝ้าดูเห็น และหนึ่งและสี่ชั่วโมงหลังจบ สมาชิกตั้งให้ส่งเข้า Telegram ได้จาก{alerts}",
  "the alerts page": "หน้าแจ้งเตือน",
  "All cascades": "ล้างพอร์ตลูกโซ่ทั้งหมด",
  // The member Top traders tab (web/trader.ts), 2026-11-15.
  "24h": "24 ชม.",
  "30d": "30 วัน",
  "All time": "ตลอดกาล",
  "over the last day": "ในหนึ่งวันที่ผ่านมา",
  "over the last week": "ในหนึ่งสัปดาห์ที่ผ่านมา",
  "over the last month": "ในหนึ่งเดือนที่ผ่านมา",
  "over all time": "ตลอดกาล",
  "Long {coin}": "Long {coin}",
  "Short {coin}": "Short {coin}",
  "Rank by profit over": "จัดอันดับตามกำไรช่วง",
  "Hyperliquid's leaderboard could not be read right now. Try again in a minute.":
    "ตอนนี้อ่าน Leaderboard ของ Hyperliquid ไม่ได้ ลองใหม่ในอีกหนึ่งนาที",
  "+{n} more": "+อีก {n}",
  "nothing over $100k": "ไม่มีที่เกิน $100k",
  Profit: "กำไร",
  "Profit over the account's value, as Hyperliquid's leaderboard computes it":
    "กำไรหารด้วยมูลค่าบัญชี ตามวิธีคำนวณของ Leaderboard ของ Hyperliquid",
  Return: "ผลตอบแทน",
  "Account value": "มูลค่าบัญชี",
  "Holding now": "ถืออยู่ตอนนี้",
  "Hyperliquid's own leaderboard, every one of its {ranked} accounts ranked by profit {window}, read {ago}. Hyperliquid is the large perp exchange where every account is public, so any of them opens on its positions, fills and orders. Holdings are the whale tracker's: positions of $100k and up, read within three hours.":
    "Leaderboard ของ Hyperliquid เอง ทั้ง {ranked} บัญชีจัดอันดับตามกำไร{window} อ่านเมื่อ {ago} Hyperliquid เป็นกระดานเทรด Perp ขนาดใหญ่ที่ทุกบัญชีเป็นสาธารณะ จึงเปิดดูโพซิชัน การจับคู่ และออเดอร์ของบัญชีไหนก็ได้ ข้อมูลการถือครองมาจากระบบติดตามวาฬ: โพซิชันตั้งแต่ $100k ขึ้นไป อ่านภายในสามชั่วโมง",
  "Too little history in this window to draw.": "ประวัติในช่วงนี้น้อยเกินกว่าจะวาดได้",
  "Open long": "เปิด Long",
  "Close long": "ปิด Long",
  "Open short": "เปิด Short",
  "Close short": "ปิด Short",
  "Long to short": "Long เป็น Short",
  "Short to long": "Short เป็น Long",
  Buy: "ซื้อ",
  Sell: "ขาย",
  Limit: "Limit",
  "Stop market": "Stop Market",
  "Stop limit": "Stop Limit",
  "Take profit market": "Take Profit Market",
  "Take profit limit": "Take Profit Limit",
  "reduce only": "Reduce Only",
  "position TP/SL": "TP/SL ของโพซิชัน",
  Filled: "จับคู่แล้ว",
  Canceled: "ยกเลิกแล้ว",
  Triggered: "ทริกเกอร์แล้ว",
  Rejected: "ถูกปฏิเสธ",
  "Canceled: margin": "ยกเลิก: Margin ไม่พอ",
  "All top traders": "เทรดเดอร์ท็อปทั้งหมด",
  "#{place} on Hyperliquid's leaderboard by profit {window}.":
    "อันดับ {place} ใน Leaderboard ของ Hyperliquid ตามกำไร{window}",
  "Hyperliquid is answering too many requests right now. Try again in a minute.":
    "ตอนนี้ Hyperliquid มีคำขอมากเกินไป ลองใหม่ในอีกหนึ่งนาที",
  "Hyperliquid did not answer for this account right now. Try again in a minute.":
    "ตอนนี้ Hyperliquid ไม่ตอบกลับสำหรับบัญชีนี้ ลองใหม่ในอีกหนึ่งนาที",
  "{usd} free to withdraw": "ถอนได้ {usd}",
  "Profit {window}": "กำไร{window}",
  "{usd} traded": "เทรดไป {usd}",
  "Open positions": "โพซิชันที่เปิดอยู่",
  "{lev}x the account's value": "{lev}x ของมูลค่าบัญชี",
  "on the open positions": "จากโพซิชันที่เปิดอยู่",
  "Profit chart window": "ช่วงเวลากราฟกำไร",
  "Profit and loss {window}": "กำไรขาดทุน{window}",
  "The profit history could not be read right now.": "ตอนนี้อ่านประวัติกำไรไม่ได้",
  "No open positions.": "ไม่มีโพซิชันที่เปิดอยู่",
  Coin: "เหรียญ",
  "Unrealized profit over the margin the position holds": "กำไรที่ยังไม่รับรู้หารด้วย Margin ที่โพซิชันใช้อยู่",
  ROE: "ROE",
  "Liq. price": "ราคาล้าง",
  "Funding the position has paid since it opened; a minus is funding received":
    "Funding ที่โพซิชันจ่ายไปตั้งแต่เปิด ค่าติดลบคือ Funding ที่ได้รับ",
  isolated: "Isolated",
  "The positions could not be read right now.": "ตอนนี้อ่านโพซิชันไม่ได้",
  "Resting orders": "ออเดอร์ที่ตั้งรอ",
  Placed: "วางเมื่อ",
  Trigger: "ราคาทริกเกอร์",
  "The fills could not be read right now.": "ตอนนี้อ่านการจับคู่ไม่ได้",
  "No fills on record.": "ไม่มีบันทึกการจับคู่",
  "This account was liquidated in this fill": "บัญชีนี้ถูกล้างพอร์ตในการจับคู่ครั้งนี้",
  liquidated: "ถูกล้างพอร์ต",
  "Results by coin": "ผลลัพธ์รายเหรียญ",
  "Orders that filled": "ออเดอร์ที่จับคู่แล้ว",
  Trades: "เทรด",
  "Profit realized by closing, before fees": "กำไรที่รับรู้จากการปิด ก่อนหักค่าธรรมเนียม",
  "Closed P&amp;L": "P&amp;L ที่ปิดแล้ว",
  Fees: "ค่าธรรมเนียม",
  Direction: "ทิศทาง",
  "Size-weighted over the order's fills": "ถ่วงน้ำหนักตามขนาดจากการจับคู่ของออเดอร์",
  Fee: "ค่าธรรมเนียม",
  "Fills the order took": "จำนวนการจับคู่ของออเดอร์",
  "No trades in {coin} among these fills.": "ไม่มีการเทรด {coin} ในการจับคู่เหล่านี้",
  "Hyperliquid answers an account's last {n} fills, here from {date}; results by coin are over those fills only. Each trade is one order's fills taken together.":
    "Hyperliquid ให้ข้อมูลการจับคู่ล่าสุด {n} รายการของบัญชี ที่นี่เริ่มจาก {date} ผลลัพธ์รายเหรียญคิดจากการจับคู่เหล่านี้เท่านั้น แต่ละเทรดคือการจับคู่ทั้งหมดของออเดอร์หนึ่งรวมกัน",
  "The order history could not be read right now.": "ตอนนี้อ่านประวัติออเดอร์ไม่ได้",
  market: "Market",
  "No orders on record.": "ไม่มีบันทึกออเดอร์",
  "Hyperliquid answers an account's last {n} orders, each shown once at its latest status.":
    "Hyperliquid ให้ข้อมูลออเดอร์ล่าสุด {n} รายการของบัญชี แต่ละออเดอร์แสดงครั้งเดียวตามสถานะล่าสุด",
  "Hyperliquid throttled part of this read; what is missing says so. Try again in a minute.":
    "Hyperliquid จำกัดการอ่านบางส่วนครั้งนี้ ส่วนที่ขาดหายมีระบุไว้ ลองใหม่ในอีกหนึ่งนาที",
  Positions: "โพซิชัน",
  "Order history": "ประวัติออเดอร์",
  "Read from Hyperliquid {ago}.": "อ่านจาก Hyperliquid เมื่อ {ago}",
  "Top traders, and every order they place": "เทรดเดอร์ท็อป และทุกออเดอร์ที่พวกเขาวาง",
  "Hyperliquid's biggest winners over a day, a week, a month or all time, with what they hold now. Open any of them for their positions and liquidation prices, profit over time, and their recent trades and orders, coin by coin.":
    "ผู้ชนะรายใหญ่ที่สุดของ Hyperliquid ในหนึ่งวัน หนึ่งสัปดาห์ หนึ่งเดือน หรือตลอดกาล พร้อมสิ่งที่ถืออยู่ตอนนี้ เปิดดูใครก็ได้เพื่อดูโพซิชันและราคาล้างพอร์ต กำไรตามเวลา และการเทรดกับออเดอร์ล่าสุด แยกรายเหรียญ",
  "Top traders": "เทรดเดอร์ท็อป",
  Winners: "ผู้ชนะ",
};
