/**
 * The keyboard page (web/keyboard.ts) and the shortcut actions it maps (web/hotkeys.ts), in Thai.
 * Keycap legends (Esc, Shift, Bloomberg's own row) stay as printed on the keys.
 * Glossary and style: ./index.ts.
 */

import type { Catalog } from "../../i18n";

export const keyboard: Catalog = {
  // web/hotkeys.ts
  sentiment: "อารมณ์ตลาด",
  "API docs": "เอกสาร API",
  "previous tab": "แท็บก่อนหน้า",
  "next tab": "แท็บถัดไป",
  "back to top": "กลับขึ้นด้านบน",
  "leave field": "ออกจากช่องพิมพ์",
  "keyboard map": "แผนผังคีย์บอร์ด",

  // web/layout.ts
  keyboard: "คีย์บอร์ด",

  // web/keyboard.ts
  Keyboard: "คีย์บอร์ด",
  "Every keyboard shortcut on airrates, on a Bloomberg terminal layout. Members remap them into their own profiles.":
    "คีย์ลัดทั้งหมดบน airrates บนเลย์เอาต์คีย์บอร์ดเทอร์มินัล Bloomberg สมาชิกตั้งปุ่มใหม่เป็นโปรไฟล์ของตัวเองได้",
  "Every shortcut on the site, drawn on the layout of a Bloomberg terminal keyboard. A lit key does something: green goes to a page, amber acts on the page you are on, red leaves a text field, blue opens this map. Press any key here to see what it does.":
    "คีย์ลัดทั้งหมดของเว็บไซต์ วาดบนเลย์เอาต์คีย์บอร์ดเทอร์มินัล Bloomberg ปุ่มที่สว่างคือปุ่มที่มีหน้าที่: สีเขียวไปยังหน้าหนึ่ง สีเหลืองอำพันทำงานกับหน้าที่คุณอยู่ สีแดงออกจากช่องพิมพ์ สีน้ำเงินเปิดแผนผังนี้ กดปุ่มใดก็ได้ที่นี่เพื่อดูว่าปุ่มนั้นทำอะไร",
  "Members can remap them: click a key to choose what it does, or press change beside an action and then the key you want. Profiles are kept on your account, so they follow you to every browser you log in on. Ctrl, Alt and Cmd combinations always stay the browser's, and a letter typed in a text field is always typing.":
    "สมาชิกตั้งปุ่มใหม่ได้: คลิกปุ่มเพื่อเลือกหน้าที่ หรือกด “เปลี่ยน” ข้างคำสั่งแล้วกดปุ่มที่ต้องการ โปรไฟล์เก็บไว้ในบัญชีของคุณ จึงตามไปทุกเบราว์เซอร์ที่คุณเข้าสู่ระบบ ปุ่มผสม Ctrl, Alt และ Cmd เป็นของเบราว์เซอร์เสมอ และตัวอักษรที่พิมพ์ในช่องพิมพ์ก็คือการพิมพ์เสมอ",
  "The dashed top row is Bloomberg's own keys, which a standard keyboard does not have.":
    "แถวบนสุดที่เป็นเส้นประคือปุ่มเฉพาะของ Bloomberg ซึ่งคีย์บอร์ดทั่วไปไม่มี",
  "A Bloomberg terminal key; a standard keyboard has none": "ปุ่มของเทอร์มินัล Bloomberg คีย์บอร์ดทั่วไปไม่มี",
  "Kept for the browser and for typing": "สงวนไว้สำหรับเบราว์เซอร์และการพิมพ์",
  "Go to a page": "ไปยังหน้า",
  "On the page": "บนหน้านี้",
  "In a text field": "ในช่องพิมพ์",
  "This map": "แผนผังนี้",
  "Your own keys need a login.": "ต้องเข้าสู่ระบบเพื่อใช้ปุ่มของคุณเอง",
  "Members remap any key and keep their profiles on their account. Everyone gets the keys below.":
    "สมาชิกตั้งปุ่มใดก็ได้ใหม่และเก็บโปรไฟล์ไว้ในบัญชี ทุกคนใช้ปุ่มด้านล่างได้",
  "log in": "เข้าสู่ระบบ",
  profile: "โปรไฟล์",
  name: "ชื่อ",
  "for a new profile": "สำหรับโปรไฟล์ใหม่",
  "save as new": "บันทึกเป็นโปรไฟล์ใหม่",
  rename: "เปลี่ยนชื่อ",
  "reset keys": "รีเซ็ตปุ่ม",
  delete: "ลบ",
  "Press a key, or click one, to see what it does.": "กดหรือคลิกปุ่มเพื่อดูว่าปุ่มนั้นทำอะไร",
  "go to a page": "ไปยังหน้า",
  "act on the page": "ทำงานกับหน้านี้",
  "leave a text field": "ออกจากช่องพิมพ์",
  "this map": "แผนผังนี้",
  "Bloomberg-only": "เฉพาะ Bloomberg",
  'Layout after <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> by Swapnil1101, CC BY-SA 4.0. Not affiliated with Bloomberg.':
    'เลย์เอาต์อ้างอิงจาก <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> โดย Swapnil1101 (CC BY-SA 4.0) ไม่มีส่วนเกี่ยวข้องกับ Bloomberg',
  change: "เปลี่ยน",
  clear: "ล้าง",
  Default: "ค่าเริ่มต้น",
  "My keys": "ปุ่มของฉัน",
  "Profile {n}": "โปรไฟล์ {n}",
  "The default set is fixed, so your change started a new profile: {name}.":
    "ชุดค่าเริ่มต้นแก้ไขไม่ได้ การเปลี่ยนของคุณจึงสร้างโปรไฟล์ใหม่: {name}",
  "{key} now: {action}.": "{key} ตอนนี้: {action}",
  "{key} now: {action}, taken from {other}.": "{key} ตอนนี้: {action} ย้ายมาจาก {other}",
  "{action} has no key now.": "{action} ตอนนี้ไม่มีปุ่ม",
  "Press a key for {action}. Esc stops; or click a key above.":
    "กดปุ่มสำหรับ {action} กด Esc เพื่อหยุด หรือคลิกปุ่มด้านบน",
  "press a key": "กดปุ่ม",
  "{key}: {action}": "{key}: {action}",
  "{key}: {action}, opens {href}": "{key}: {action} เปิด {href}",
  "{key} does nothing yet.": "{key} ยังไม่มีหน้าที่",
  "{key} stays with the browser.": "{key} สงวนไว้ให้เบราว์เซอร์",
  "There is already a profile called {name}.": "มีโปรไฟล์ชื่อ {name} อยู่แล้ว",
  "That is as many profiles as an account keeps.": "จำนวนโปรไฟล์เต็มขีดจำกัดของบัญชีแล้ว",
  "Saved as {name}; it is the one in use.": "บันทึกเป็น {name} และกำลังใช้งานอยู่",
  "Renamed to {name}.": "เปลี่ยนชื่อเป็น {name} แล้ว",
  "Deleted {name}; back to the default set.": "ลบ {name} แล้ว กลับไปใช้ชุดค่าเริ่มต้น",
  "{name} is back to the default keys.": "{name} กลับไปใช้ปุ่มค่าเริ่มต้นแล้ว",
  "Using {name}.": "กำลังใช้ {name}",
  nothing: "ไม่มี",
  "with Shift": "กับ Shift",
  "Key {key}": "ปุ่ม {key}",
  "Log in to change what keys do.": "เข้าสู่ระบบเพื่อเปลี่ยนหน้าที่ของปุ่ม",
  "You were signed out, so that change was not saved. Log in again to keep editing.":
    "คุณออกจากระบบแล้ว การเปลี่ยนนั้นจึงไม่ถูกบันทึก เข้าสู่ระบบอีกครั้งเพื่อแก้ไขต่อ",
  "That change is not saved to your account yet: the member area did not answer. It still works in this browser.":
    "การเปลี่ยนนั้นยังไม่ถูกบันทึกในบัญชีของคุณ: ส่วนสมาชิกไม่ตอบสนอง แต่ยังใช้ได้ในเบราว์เซอร์นี้",
  "The member area did not answer, so your profiles could not be loaded. The keys in use are this browser's last copy.":
    "ส่วนสมาชิกไม่ตอบสนอง จึงโหลดโปรไฟล์ของคุณไม่ได้ ปุ่มที่ใช้อยู่เป็นสำเนาล่าสุดของเบราว์เซอร์นี้",
};
