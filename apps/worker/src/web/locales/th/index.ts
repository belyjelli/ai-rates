/**
 * Thai (owner, 2026-11-17). One file per part of the site, so the catalog for a page sits in one
 * place and i18n.test.ts can tell two parts that translate the same English differently. Any `th`
 * browser language lands here.
 *
 * GLOSSARY. One term, one translation, across every part. The words Thai crypto traders and Thai
 * crypto media use (Siam Blockchain, Thai trading groups, the exchanges' Thai pages), not dictionary
 * Thai; much of the jargon stays English, as it does there. English terms keep their capitals.
 *
 *   funding rate        Funding Rate             perpetual (perp)  สัญญา Perpetual (Perp)
 *   funding (payment)   Funding                  spread            สเปรด
 *   funding spread      สเปรด Funding            exchange / venue  กระดานเทรด
 *   market              ตลาด                     long / short      Long / Short
 *   go long on X        Long ที่ X               leg (of a pair)   ขา
 *   pair                คู่                       open interest, OI Open Interest (OI)
 *   24h volume          วอลุ่ม 24 ชม.             APR / annualized  APR (คิดเป็นรายปี)
 *   settlement          รอบจ่าย                  settled           จ่ายแล้ว
 *   interval            รอบ                      backtest          Backtest
 *   carry               Carry                    arbitrage         อาร์บิทราจ
 *   screener            สกรีนเนอร์                 rates             อัตรา
 *   liquidations        การล้างพอร์ต              taker / maker     Taker / Maker
 *   fees                ค่าธรรมเนียม               slippage          Slippage
 *   basis               Basis                    mark price        ราคา Mark
 *   index price         ราคาดัชนี                 quote currency    สกุลเงินอ้างอิง
 *   stability           ความเสถียร               win rate          อัตราชนะ
 *   fear & greed        ความกลัวและความโลภ        bps               bps
 *   whale               วาฬ                      order book        Order Book
 *   wall (in the book)  กำแพง                    CVD               CVD
 *   gamma flip          Gamma Flip               call / put wall   Call Wall / Put Wall
 *   gamma exposure      Gamma Exposure (GEX)     option book       Option Book
 *   options             ออปชัน                   expiry            วันหมดอายุ
 *   strike              Strike                   volatility        ความผันผวน
 *   implied volatility  ความผันผวนแฝง (IV)
 *   cascade             ล้างพอร์ตลูกโซ่            member            สมาชิก
 *   flat (momentum)     ทรงตัว                   sign up / log in  สมัครสมาชิก / เข้าสู่ระบบ
 *   price / chart       ราคา / กราฟ               candle            แท่งเทียน
 *   asset               สินทรัพย์                  liquidity         สภาพคล่อง
 *   crypto / stock      คริปโต / หุ้น               index             ดัชนี
 *   not financial advice  ไม่ใช่คำแนะนำทางการเงิน
 *
 * SHARED KEYS. These English keys sit in more than one part; every part uses exactly this Thai.
 *   Months Jan…Dec      ม.ค., ก.พ., มี.ค., เม.ย., พ.ค., มิ.ย., ก.ค., ส.ค., ก.ย., ต.ค., พ.ย., ธ.ค.
 *   {month} {day}       {day} {month}
 *   Asset / asset       สินทรัพย์                  Window            ช่วงเวลา
 *   Venues, Exchanges   กระดานเทรด               Exchange          กระดานเทรด
 *   Liquidations        การล้างพอร์ต              Indexes           ดัชนี
 *   Try again           ลองอีกครั้ง                close             ปิด
 *   Type                ประเภท                   Change            การเปลี่ยนแปลง
 *   View                มุมมอง                   Other             อื่น ๆ
 *   Level               ระดับ                    Spread / spread   สเปรด
 *   open interest       Open Interest            Last {window}     {window} ล่าสุด
 *   hover or tap a bar to read it               ชี้หรือแตะแท่งเพื่ออ่านค่า
 *   {asset} bars; arrow keys read one at a time แท่งของ {asset} ใช้ปุ่มลูกศรอ่านทีละแท่ง
 *
 * Style: a neutral, polite register with no gendered particles (no ครับ / ค่ะ); "คุณ" for the reader
 * only where a sentence needs a subject, since Thai usually leaves it out. Thai ends a sentence with
 * no full stop: where the English has several sentences, drop the "." and part them with one space,
 * and a space also does the work of most English commas. A space goes before and after a Latin word or
 * a figure inside Thai text ("Funding Rate ของ {venue}", "{count} ตลาด"), never before punctuation.
 * Thai has no plural, so a count always comes first and reads right for 1 and many ("{markets} ตลาด");
 * on a phone the masthead is cut after a few characters, so the number must lead. Time units: วิ, นาที,
 * ชม., วัน ("{h} ชม. {m} นาที"; "{time}ที่แล้ว" for "{time} ago"). Arabic digits only, never Thai
 * digits; the Gregorian year, never the Buddhist one. “ ” for quotes, never an ASCII double quote
 * (many keys sit in attributes); "อื่น ๆ" with a space before ๆ. No zero-width spaces: the browser
 * breaks Thai lines by dictionary. The site's " · " separators, figures, venue names, tickers, units
 * ($, %, bps) and code-like labels are left exactly as they are, and so are the English product names
 * (airrates, Telegram, MCP).
 */

import type { Catalog } from "../../i18n";
import { charts } from "./charts";
import { exchanges } from "./exchanges";
import { gamma } from "./gamma";
import { holdings } from "./holdings";
import { keyboard } from "./keyboard";
import { layout } from "./layout";
import { liquidations } from "./liquidations";
import { macro } from "./macro";
import { narrator } from "./narrator";
import { pages } from "./pages";
import { site } from "./site";
import { whales } from "./whales";

/** Each part on its own, for the test that checks two parts never disagree on one key. */
export const TH_PARTS: Readonly<Record<string, Catalog>> = {
  layout,
  pages,
  liquidations,
  charts,
  site,
  keyboard,
  whales,
  gamma,
  macro,
  exchanges,
  holdings,
  narrator,
};

export const th: Catalog = Object.assign({}, ...Object.values(TH_PARTS));
