/**
 * Simplified Chinese for the keyboard page (web/keyboard.ts) and the shortcut actions it maps
 * (web/hotkeys.ts). Glossary and style: ./index.ts. Keycap legends (Esc, Shift, Bloomberg's own row)
 * stay as printed on the keys.
 */

import type { Catalog } from "../../i18n";

export const keyboard: Catalog = {
  // web/hotkeys.ts
  sentiment: "市场情绪",
  "API docs": "API 文档",
  "previous tab": "上一个标签页",
  "next tab": "下一个标签页",
  "back to top": "回到顶部",
  "leave field": "离开输入框",
  "keyboard map": "键盘图",

  // web/layout.ts
  "Keyboard shortcuts: change them on the keyboard page": "键盘快捷键：在键盘页修改",
  keyboard: "键盘",

  // web/keyboard.ts
  Keyboard: "键盘",
  "Every keyboard shortcut on airrates, on a Bloomberg terminal layout. Members remap them into their own profiles.":
    "airrates 的全部键盘快捷键，按彭博终端键盘布局排列。会员可重新映射，保存为自己的配置。",
  "Every shortcut on the site, drawn on the layout of a Bloomberg terminal keyboard. A lit key does something: green goes to a page, amber acts on the page you are on, red leaves a text field, blue opens this map. Press any key here to see what it does.":
    "本站的全部快捷键，画在彭博终端键盘的布局上。亮起的键有功能：绿色打开页面，琥珀色作用于当前页面，红色离开输入框，蓝色打开这张键盘图。在这里按任意键，即可查看它的作用。",
  "Members can remap them: click a key to choose what it does, or press change beside an action and then the key you want. Profiles are kept on your account, so they follow you to every browser you log in on. Ctrl, Alt and Cmd combinations always stay the browser's, and a letter typed in a text field is always typing.":
    "会员可以重新映射：点击一个键选择它的功能，或点击某个操作旁的「修改」再按下想要的键。配置保存在你的账户中，在任何登录的浏览器上都能使用。Ctrl、Alt 和 Cmd 组合键始终归浏览器所有，在输入框中输入的字母始终是输入。",
  "The dashed top row is Bloomberg's own keys, which a standard keyboard does not have.":
    "虚线的顶行是彭博专用键，标准键盘上没有。",
  "A Bloomberg terminal key; a standard keyboard has none": "彭博终端专用键，标准键盘上没有",
  "Kept for the browser and for typing": "保留给浏览器和输入使用",
  "Go to a page": "打开页面",
  "On the page": "当前页面",
  "In a text field": "在输入框中",
  "This map": "键盘图",
  "Your own keys need a login.": "自定义按键需要登录。",
  "Members remap any key and keep their profiles on their account. Everyone gets the keys below.":
    "会员可以重新映射任意键，并把配置保存在账户中。所有人都可以使用下面的默认按键。",
  "log in": "登录",
  profile: "配置",
  name: "名称",
  "for a new profile": "用于新配置",
  "save as new": "另存为新配置",
  rename: "重命名",
  "reset keys": "恢复默认按键",
  delete: "删除",
  "Press a key, or click one, to see what it does.": "按下或点击一个键，查看它的作用。",
  "go to a page": "打开页面",
  "act on the page": "作用于当前页面",
  "leave a text field": "离开输入框",
  "this map": "键盘图",
  "Bloomberg-only": "彭博专用",
  'Layout after <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> by Swapnil1101, CC BY-SA 4.0. Not affiliated with Bloomberg.':
    '布局参照 Swapnil1101 的 <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a>（CC BY-SA 4.0）。与彭博无关联。',
  change: "修改",
  clear: "清除",
  Default: "默认",
  "My keys": "我的按键",
  "Profile {n}": "配置 {n}",
  "The default set is fixed, so your change started a new profile: {name}.":
    "默认按键不可修改，因此你的改动新建了一个配置：{name}。",
  "{key} now: {action}.": "{key} 现在：{action}。",
  "{key} now: {action}, taken from {other}.": "{key} 现在：{action}，原属于{other}。",
  "{action} has no key now.": "{action}现在没有按键。",
  "Press a key for {action}. Esc stops; or click a key above.":
    "请为{action}按下一个键。按 Esc 取消，或点击上方的键。",
  "press a key": "请按键",
  "{key}: {action}": "{key}：{action}",
  "{key}: {action}, opens {href}": "{key}：{action}，打开 {href}",
  "{key} does nothing yet.": "{key} 暂无功能。",
  "{key} stays with the browser.": "{key} 保留给浏览器。",
  "There is already a profile called {name}.": "已有名为 {name} 的配置。",
  "That is as many profiles as an account keeps.": "配置数量已达账户上限。",
  "Saved as {name}; it is the one in use.": "已保存为 {name}，并正在使用。",
  "Renamed to {name}.": "已重命名为 {name}。",
  "Deleted {name}; back to the default set.": "已删除 {name}，恢复为默认按键。",
  "{name} is back to the default keys.": "{name} 已恢复为默认按键。",
  "Using {name}.": "正在使用 {name}。",
  nothing: "无",
  "with Shift": "按住 Shift",
  "Key {key}": "按键 {key}",
  "Log in to change what keys do.": "登录后才能修改按键功能。",
  "You were signed out, so that change was not saved. Log in again to keep editing.":
    "你已退出登录，刚才的改动没有保存。请重新登录后继续编辑。",
  "That change is not saved to your account yet: the member area did not answer. It still works in this browser.":
    "改动尚未保存到你的账户：会员区没有响应。它在这个浏览器中仍然有效。",
  "The member area did not answer, so your profiles could not be loaded. The keys in use are this browser's last copy.":
    "会员区没有响应，无法载入你的配置。当前使用的是这个浏览器上次保存的副本。",
};
