import type { Catalog } from "../../i18n";

/**
 * /whales (web/whales.ts), its route's 404 (app/app.ts) and its nav and hotkey label, in Thai.
 * Glossary and style: ./index.ts.
 *
 * Terms: whale orders ออเดอร์วาฬ, wall กำแพง (bid wall กำแพงซื้อ, ask wall กำแพงขาย), resting
 * ตั้งรอ, filled จับคู่แล้ว, pulled ถูกถอน. bid / ask are ซื้อ / ขาย, so "กำแพง{side}" reads
 * กำแพงซื้อ. A taker burst (the circles) is Taker ซื้อ / Taker ขาย, as Thai traders say it.
 */
export const whales: Catalog = {
  "{asset} is not one of the markets tracked on {venue}.": "{asset} ไม่ได้อยู่ในตลาดที่ติดตามบน {venue}",
  whales: "ออเดอร์วาฬ",
  bid: "ซื้อ",
  ask: "ขาย",
  resting: "ตั้งรอ",
  filled: "จับคู่แล้ว",
  pulled: "ถูกถอน",
  "lost track": "หลุดการติดตาม",
  "{n}m": "{n} นาที",
  "{d}d {h}h": "{d} วัน {h} ชม.",
  "{side} wall {price} · {size} · {status} · {lived}":
    "กำแพง{side} {price} · {size} · {status} · {lived}",
  "{asset} · {venue} perp · {n}-hour candles, {zone}":
    "{asset} · {venue} Perp · แท่งเทียน {n} ชม. · {zone}",
  "{asset} · {venue} perp · {n}-minute candles, {zone}":
    "{asset} · {venue} Perp · แท่งเทียน {n} นาที · {zone}",
  "bid wall (buy orders)": "กำแพงซื้อ (ออเดอร์ซื้อ)",
  "ask wall (sell orders)": "กำแพงขาย (ออเดอร์ขาย)",
  "faded: filled or pulled": "สีจาง: จับคู่แล้วหรือถูกถอน",
  "last price": "ราคาล่าสุด",
  Markets: "ตลาด",
  "hide pulled walls": "ซ่อนกำแพงที่ถูกถอน",
  "show pulled walls": "แสดงกำแพงที่ถูกถอน",
  "Bid walls resting": "กำแพงซื้อที่ตั้งรอ",
  "{n} buy walls below the price": "กำแพงซื้อ {n} แห่งใต้ราคา",
  "Ask walls resting": "กำแพงขายที่ตั้งรอ",
  "{n} sell walls above the price": "กำแพงขาย {n} แห่งเหนือราคา",
  "Largest wall": "กำแพงใหญ่สุด",
  "{side} at {price}": "ฝั่ง{side} ที่ {price}",
  "none resting": "ไม่มีที่ตั้งรอ",
  "Pulled in {window}": "ถูกถอนใน {window}",
  "cancelled before the price reached them; {n} filled": "ถูกยกเลิกก่อนราคาจะไปถึง จับคู่แล้ว {n} แห่ง",
  "No candles for {asset} yet. The collector backfills three days within a minute of a market joining the set.":
    "ยังไม่มีแท่งเทียนของ {asset} ระบบเก็บข้อมูลจะเติมย้อนหลังสามวันภายในหนึ่งนาทีหลังตลาดถูกเพิ่มเข้าชุด",
  Side: "ฝั่ง",
  "From the last price": "ห่างจากราคาล่าสุด",
  Distance: "ระยะห่าง",
  Size: "ขนาด",
  "The most it has held": "ขนาดสูงสุดที่เคยมี",
  Peak: "สูงสุด",
  "Since the collector first saw it": "นับจากที่ระบบเก็บข้อมูลเห็นครั้งแรก",
  "Resting since": "ตั้งรอมานาน",
  "No wall is resting in {asset}'s book right now.": "ตอนนี้ไม่มีกำแพงตั้งรออยู่ใน Order Book ของ {asset}",
  Lived: "อยู่นาน",
  Ended: "จบเมื่อ",
  How: "จบแบบ",
  "No wall ended in the last {window}.": "ไม่มีกำแพงไหนจบลงใน {window} ที่ผ่านมา",
  "Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.":
    "Limit Order ก้อนใหญ่ที่ตั้งรอใน Order Book USD-M ของ Binance สำหรับ {asset}: ราคาเดียวที่มีออเดอร์อย่างน้อย {floor} นานอย่างน้อยหนึ่งนาที {bid} คือออเดอร์ซื้อใต้ราคา {ask} คือออเดอร์ขายเหนือราคา แต่ละเส้นลากจากตอนที่ระบบเก็บข้อมูลเห็นกำแพงครั้งแรกจนถึงตอนที่มันหายไป ยิ่งกำแพงใหญ่ เส้นยิ่งหนา",
  "bid wall": "กำแพงซื้อ",
  "ask wall": "กำแพงขาย",
  "A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.":
    "กำแพงที่จบลงจะนับว่าจับคู่แล้วถ้าราคาไปถึง และนับว่าถูกถอนถ้าถูกยกเลิกก่อน กำแพงที่ถูกถอนจะซ่อนไว้เป็นค่าเริ่มต้น เพราะส่วนใหญ่เป็นออเดอร์หลอก (Spoof) หรือราคาเสนอที่ขยับตามราคา กำแพงเป็นแค่ภาพสภาพคล่องที่มองเห็นได้ ณ ขณะหนึ่ง ไม่ใช่พื้นหรือเพดาน และไม่ใช่การคาดการณ์ กำแพงไหนก็หายไปได้ทันทีที่ราคาเข้าใกล้",
  "The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.":
    "สี่สิบตลาดนี้คือสี่สิบอันดับแรกตาม Open Interest รวมทุกกระดานเทรดที่เราเก็บข้อมูล อ่านจาก Binance เกณฑ์ขั้นต่ำปรับตาม Open Interest นั้น ทุกครั้งที่ระบบเก็บข้อมูลรีสตาร์ต Order Book จะเรียนรู้ระดับราคาที่ห่างจากราคาใหม่เมื่อมีการเปลี่ยนแปลง กำแพงไกล ๆ ที่เก่าที่สุดจึงอาจใช้เวลาหนึ่งถึงสองชั่วโมงกว่าจะกลับมา",
  "Whale orders": "ออเดอร์วาฬ",
  "whale orders": "ออเดอร์วาฬ",
  "Large resting limit orders and large market orders on Binance and Hyperliquid futures, drawn over the price: where the walls sit, how big, whether they were filled or pulled, and who hit them.":
    "Limit Order ก้อนใหญ่ที่ตั้งรอและ Market Order ก้อนใหญ่บน Binance Futures และ Hyperliquid วาดทับบนราคา: กำแพงอยู่ตรงไหน ใหญ่แค่ไหน จับคู่แล้วหรือถูกถอน และใครเป็นคนชน",
  "The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.":
    "ฟีดออเดอร์วาฬยังไม่ได้จัดอันดับตลาด จะจัดเสร็จภายในไม่กี่นาทีหลังเริ่มทำงาน",
  "Resting now": "ตั้งรออยู่ตอนนี้",
  "Orders and trades": "ออเดอร์และการซื้อขาย",
  "{n} resting": "ตั้งรอ {n} แห่ง",
  "Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.":
    "กำแพงทั้งหมดใน Order Book ตอนนี้ เรียงจากใหญ่สุด ระยะห่างวัดจากราคาล่าสุด ขนาดคือยอดที่ระดับราคานั้นมีอยู่ตอนนี้ สูงสุดคือยอดมากที่สุดที่เคยมี",
  "Ended in the last {window}": "จบลงใน {window} ที่ผ่านมา",
  "taker buy": "Taker ซื้อ",
  "taker sell": "Taker ขาย",
  "one fill": "1 การจับคู่",
  "{n} fills": "{n} การจับคู่",
  "{side} {size} at {price} · {fills} · {time}": "{side} {size} ที่ {price} · {fills} · {time}",
  "large taker buy": "Taker ซื้อก้อนใหญ่",
  "large taker sell": "Taker ขายก้อนใหญ่",
  "Large buys in {window}": "ซื้อก้อนใหญ่ใน {window}",
  "Large sells in {window}": "ขายก้อนใหญ่ใน {window}",
  "{n} taker bursts of {floor} or more": "แรง Taker {n} ครั้ง ครั้งละ {floor} ขึ้นไป",
  "Aggregate trades in the burst: roughly the price levels it took":
    "จำนวน Aggregate Trade ในแรงซื้อขายครั้งนั้น: ประมาณจำนวนระดับราคาที่มันกวาดไป",
  Fills: "การจับคู่",
  When: "เวลา",
  "No taker burst of {floor} or more in the last {window}.":
    "ไม่มีแรง Taker ตั้งแต่ {floor} ขึ้นไปใน {window} ที่ผ่านมา",
  "Largest trades in the last {window}": "การซื้อขายใหญ่สุดใน {window} ที่ผ่านมา",
  "taker {address}": "Taker {address}",
  "{size} in {n} orders, one at least {proven}": "{size} ใน {n} ออเดอร์ มีหนึ่งออเดอร์อย่างน้อย {proven}",
  "no walls": "ไม่มีกำแพง",
  "{bid} bid · {ask} ask": "ซื้อ {bid} · ขาย {ask}",
  "Pick a market": "เลือกตลาด",
  "{n} markets": "{n} ตลาด",
  "Filter markets": "กรองตลาด",
  "Walls resting, bid / ask": "กำแพงที่ตั้งรอ ซื้อ / ขาย",
  "Large taker buys minus sells, last 24 hours": "Taker ซื้อก้อนใหญ่ลบขาย 24 ชม. ล่าสุด",
  "Whale flow 24h": "กระแสวาฬ 24 ชม.",
  "No market matches.": "ไม่มีตลาดที่ตรงกัน",
  "Orders in the bucket at the last look": "จำนวนออเดอร์ในช่วงราคานี้ ณ การดูครั้งล่าสุด",
  Orders: "ออเดอร์",
  "The bucket's average order: its largest holds at least this":
    "ออเดอร์เฉลี่ยของช่วงราคานี้: ออเดอร์ใหญ่สุดในช่วงมีอย่างน้อยเท่านี้",
  "Largest ≥": "ใหญ่สุด ≥",
  Taker: "Taker",
  "Proven whale orders in {venue}'s book for {asset}. {venue} publishes only its 20 nearest price buckets a side, here {step} wide, each with how many orders it holds. A wall is a bucket whose average order is at least {floor}, so at least one order in it is that big; a {bid} sits below the price, an {ask} above it. It stays a wall while the bucket still holds what that order was proven to. A whale order sharing a bucket with many small ones cannot be proven, and is not drawn.":
    "ออเดอร์วาฬที่พิสูจน์ได้ใน Order Book ของ {venue} สำหรับ {asset} {venue} เปิดเผยเฉพาะ 20 ช่วงราคาที่ใกล้ที่สุดต่อฝั่ง ที่นี่กว้างช่วงละ {step} พร้อมจำนวนออเดอร์ในแต่ละช่วง กำแพงคือช่วงราคาที่ออเดอร์เฉลี่ยอย่างน้อย {floor} จึงมีอย่างน้อยหนึ่งออเดอร์ที่ใหญ่ขนาดนั้น {bid} อยู่ใต้ราคา {ask} อยู่เหนือราคา ช่วงราคานั้นยังเป็นกำแพงตราบที่ยังมียอดเท่ากับที่พิสูจน์ได้ของออเดอร์นั้น ออเดอร์วาฬที่อยู่ช่วงเดียวกับออเดอร์เล็กจำนวนมากพิสูจน์ไม่ได้ และจะไม่ถูกวาด",
  "Each circle is one account's market order in one block, of at least the same {floor}; the table names the account. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the order. The chart draws the 200 largest in the window.":
    "แต่ละวงกลมคือ Market Order ของหนึ่งบัญชีในหนึ่งบล็อก ขนาดอย่างน้อย {floor} เท่ากัน ตารางระบุชื่อบัญชีไว้ สีน้ำเงินคือ Taker ซื้อ สีแดงคือ Taker ขาย ยิ่งวงกลมใหญ่ ออเดอร์ยิ่งใหญ่ กราฟวาด 200 รายการที่ใหญ่ที่สุดในช่วงเวลานั้น",
  "The markets are the top forty by open interest summed across every exchange we collect, among those {venue} lists, its HIP-3 markets included (gold is xyz:GOLD). The floor scales with that open interest.":
    "ตลาดเหล่านี้คือสี่สิบอันดับแรกตาม Open Interest รวมทุกกระดานเทรดที่เราเก็บข้อมูล เฉพาะที่ {venue} ลิสต์ไว้ รวมตลาด HIP-3 ด้วย (ทองคำคือ xyz:GOLD) เกณฑ์ขั้นต่ำปรับตาม Open Interest นั้น",
  "Each circle is a large market order: every fill on one side in the same millisecond, counted as one burst, of at least the same {floor}. Blue is a taker buying, red a taker selling; the bigger the circle, the bigger the burst. The chart draws the 200 largest in the window.":
    "แต่ละวงกลมคือ Market Order ก้อนใหญ่: ทุกการจับคู่ฝั่งเดียวกันในมิลลิวินาทีเดียวกันนับเป็นหนึ่งครั้ง ขนาดอย่างน้อย {floor} เท่ากัน สีน้ำเงินคือ Taker ซื้อ สีแดงคือ Taker ขาย ยิ่งวงกลมใหญ่ แรงซื้อขายยิ่งใหญ่ กราฟวาด 200 รายการที่ใหญ่ที่สุดในช่วงเวลานั้น",
  "off the chart:": "นอกกราฟ:",
  "last {price}": "ล่าสุด {price}",
  "hover or tap a candle to read it": "ชี้หรือแตะแท่งเทียนเพื่ออ่านค่า",
  "{asset} candles; arrow keys read one at a time": "แท่งเทียนของ {asset} ใช้ปุ่มลูกศรอ่านทีละแท่ง",
  "{asset} volume per candle": "วอลุ่มต่อแท่งของ {asset}",
  // web/whales.ts: the GEX switch over the chart
  off: "ปิด",
  "Hide the options book": "ซ่อนข้อมูลออปชัน",
  "Each strike's call and put gamma, as bars at the right edge":
    "Gamma ของ Call และ Put แต่ละ Strike แสดงเป็นแท่งที่ขอบขวา",
  "Strike {strike} · calls {calls} · puts {puts} · net {net} per 1% move":
    "Strike {strike} · Call {calls} · Put {puts} · สุทธิ {net} ต่อการขยับ 1%",
  "call wall {price}": "Call Wall {price}",
  "put wall {price}": "Put Wall {price}",
  "call gamma": "Call Gamma",
  "put gamma": "Put Gamma",
  "flip {flip} · call wall {call} · put wall {put}":
    "Flip {flip} · Call Wall {call} · Put Wall {put}",
  "{source} options, all expiries, {age}": "ออปชัน {source} · ทุกวันหมดอายุ · {age}",
  "IV move": "IV Move",
  "The expected move a day ahead: one and two standard deviations either side of the price":
    "การขยับที่คาดไว้ล่วงหน้าหนึ่งวัน: หนึ่งและสองส่วนเบี่ยงเบนมาตรฐานทั้งสองฝั่งของราคา",
  "Whale orders: BTC order book walls and large trades":
    "ออเดอร์วาฬ: กำแพงใน Order Book ของ BTC และเทรดขนาดใหญ่",
};
