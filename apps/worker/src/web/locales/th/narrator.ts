import type { Catalog } from "../../i18n";

/**
 * The market narrator in the masthead and its two /settings rows (web/narrator.ts, web/settings.ts),
 * in Thai. Terms as on the Gamma Exposure tab (gamma.ts): the flip, the call and put walls.
 * Glossary and style: ./index.ts.
 */
export const narrator: Catalog = {
  "Market narrator": "ผู้บรรยายตลาด",
  "{n} entries": "{n} รายการ",
  "Nothing to say yet: the narrator writes when the {book} option book moves.":
    "ยังไม่มีอะไรให้บรรยาย: ผู้บรรยายจะเขียนเมื่อ Option Book ของ {book} ขยับ",
  "The narrator could not be read just now.": "ตอนนี้ยังอ่านข้อความของผู้บรรยายไม่ได้",
  "The running commentary between the header and the menu: where price sits against the gamma flip and the walls of the BTC and ETH option books, written as they move. Open, folded to one line, or off.":
    "คำบรรยายสดระหว่างหัวเว็บกับเมนู: ราคาอยู่ตรงไหนเมื่อเทียบกับ Gamma Flip และ Wall ของ Option Book ของ BTC และ ETH เขียนขึ้นทันทีที่มีการเคลื่อนไหว เลือกขยาย ย่อเหลือบรรทัดเดียว หรือปิด",
  expanded: "ขยาย",
  collapsed: "ย่อ",
  "Narrator typing": "ผู้บรรยายพิมพ์ทีละตัว",
  "Each new line types itself out. Off shows it whole at once.":
    "ทุกบรรทัดใหม่จะพิมพ์ออกมาทีละตัว ถ้าปิดจะแสดงทั้งบรรทัดทันที",
  on: "เปิด",
  "Price is now below the gamma flip at {flip}: dealers are short gamma here, so their hedging adds to moves.":
    "ราคาลงมาต่ำกว่า Gamma Flip ที่ {flip} แล้ว: ตรงนี้ดีลเลอร์ถือ Short Gamma การเฮดจ์จึงขยายการเคลื่อนไหวของราคา",
  "Price is now below the gamma flip at {flip}.": "ราคาลงมาต่ำกว่า Gamma Flip ที่ {flip} แล้ว",
  "Price is now above the gamma flip at {flip}.": "ราคาขึ้นมาเหนือ Gamma Flip ที่ {flip} แล้ว",
  "Price is back above the gamma flip at {flip}: dealers are long gamma here, so their hedging damps moves.":
    "ราคากลับขึ้นมาเหนือ Gamma Flip ที่ {flip}: ตรงนี้ดีลเลอร์ถือ Long Gamma การเฮดจ์จึงช่วยลดการเคลื่อนไหวของราคา",
  "Price has slipped onto the gamma flip at {flip}: nothing resolves until it holds or gives.":
    "ราคาไหลลงมาแตะ Gamma Flip ที่ {flip}: ยังไม่มีทิศทางชัดจนกว่าจะยืนได้หรือหลุดลงไป",
  "Price has climbed back to the gamma flip at {flip} from below.":
    "ราคาไต่กลับขึ้นมาถึง Gamma Flip ที่ {flip} จากด้านล่าง",
  "Price has broken below the put wall at {wall}: no floor left underneath.":
    "ราคาหลุด Put Wall ที่ {wall} แล้ว: ด้านล่างไม่เหลือพื้นรองรับ",
  "Price has broken above the call wall at {wall}: no ceiling left overhead.":
    "ราคาทะลุ Call Wall ที่ {wall} แล้ว: ด้านบนไม่เหลือเพดาน",
  "Price is testing the put wall at {wall} for the first time today.":
    "ราคากำลังทดสอบ Put Wall ที่ {wall} เป็นครั้งแรกของวันนี้",
  "Price is back at the put wall at {wall}: test {n} today.":
    "ราคากลับมาที่ Put Wall ที่ {wall}: ทดสอบครั้งที่ {n} ของวันนี้",
  "Price is testing the call wall at {wall} for the first time today.":
    "ราคากำลังทดสอบ Call Wall ที่ {wall} เป็นครั้งแรกของวันนี้",
  "Price is back at the call wall at {wall}: test {n} today.":
    "ราคากลับมาที่ Call Wall ที่ {wall}: ทดสอบครั้งที่ {n} ของวันนี้",
  "The put wall has moved up to {to} from {from}.": "Put Wall ขยับขึ้นจาก {from} ไปที่ {to}",
  "The put wall has moved down to {to} from {from}.": "Put Wall ขยับลงจาก {from} มาที่ {to}",
  "The call wall has moved up to {to} from {from}.": "Call Wall ขยับขึ้นจาก {from} ไปที่ {to}",
  "The call wall has come down to {to} from {from}.": "Call Wall ลดลงจาก {from} มาที่ {to}",
  "The gamma flip has moved up to {to} from {from}.": "Gamma Flip ขยับขึ้นจาก {from} ไปที่ {to}",
  "The gamma flip has moved down to {to} from {from}.": "Gamma Flip ขยับลงจาก {from} มาที่ {to}",
  "Dealers' gamma at this price has grown {pct} in the hour, to {net} per 1% move.":
    "Gamma ของดีลเลอร์ที่ราคานี้เพิ่มขึ้น {pct} ในชั่วโมงนี้ เป็น {net} ต่อการเคลื่อนไหว 1%",
  "Dealers' gamma at this price has thinned {pct} in the hour, to {net} per 1% move.":
    "Gamma ของดีลเลอร์ที่ราคานี้บางลง {pct} ในชั่วโมงนี้ เหลือ {net} ต่อการเคลื่อนไหว 1%",
  "A new low for the UTC day at {price}.": "ต่ำสุดใหม่ของวัน (UTC) ที่ {price}",
  "A new high for the UTC day at {price}.": "สูงสุดใหม่ของวัน (UTC) ที่ {price}",
  "Quiet hour: price {spot}, with no gamma flip within 30% either way.":
    "ชั่วโมงเงียบ: ราคา {spot} ไม่มี Gamma Flip ในระยะ 30% ทั้งขึ้นและลง",
  "Quiet hour: price {spot} sits right on the gamma flip at {flip}.":
    "ชั่วโมงเงียบ: ราคา {spot} อยู่ตรง Gamma Flip ที่ {flip} พอดี",
  "Quiet hour: price {spot} holds {pct} above the gamma flip at {flip}.":
    "ชั่วโมงเงียบ: ราคา {spot} ยืนเหนือ Gamma Flip ที่ {flip} อยู่ {pct}",
  "Quiet hour: price {spot} sits {pct} below the gamma flip at {flip}.":
    "ชั่วโมงเงียบ: ราคา {spot} อยู่ต่ำกว่า Gamma Flip ที่ {flip} อยู่ {pct}",
  "Levels: put wall {put} · flip {flip} · call wall {call}.":
    "ระดับสำคัญ: Put Wall {put} · Flip {flip} · Call Wall {call}",
};
