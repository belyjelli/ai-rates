/**
 * Japanese for the keyboard page (web/keyboard.ts) and the shortcut actions it maps
 * (web/hotkeys.ts). Glossary and style: ./index.ts. Keycap legends (Esc, Shift, Bloomberg's own row)
 * stay as printed on the keys.
 *
 * Terms: Bloomberg ブルームバーグ, profile プロファイル, member 会員, remap 割り当て, text field
 * 入力欄, keyboard map キーボードマップ.
 */

import type { Catalog } from "../../i18n";

export const keyboard: Catalog = {
  // web/hotkeys.ts
  sentiment: "センチメント",
  "API docs": "API ドキュメント",
  "previous tab": "前のタブ",
  "next tab": "次のタブ",
  "back to top": "ページ先頭へ",
  "leave field": "入力欄を離れる",
  "keyboard map": "キーボードマップ",

  // web/layout.ts
  "Keyboard shortcuts: change them on the keyboard page":
    "キーボードショートカット：キーボードページで変更できます",
  keyboard: "キーボード",

  // web/keyboard.ts
  Keyboard: "キーボード",
  "Every keyboard shortcut on airrates, on a Bloomberg terminal layout. Members remap them into their own profiles.":
    "airrates のすべてのキーボードショートカットを、ブルームバーグ端末のキー配列で表示します。会員は自分のプロファイルに割り当てを変更できます。",
  "Every shortcut on the site, drawn on the layout of a Bloomberg terminal keyboard. A lit key does something: green goes to a page, amber acts on the page you are on, red leaves a text field, blue opens this map. Press any key here to see what it does.":
    "サイト内のすべてのショートカットを、ブルームバーグ端末キーボードの配列上に描いています。点灯しているキーには機能があります。緑はページを開き、琥珀色は表示中のページを操作し、赤は入力欄を離れ、青はこのマップを開きます。ここで任意のキーを押すと、その機能を確認できます。",
  "Members can remap them: click a key to choose what it does, or press change beside an action and then the key you want. Profiles are kept on your account, so they follow you to every browser you log in on. Ctrl, Alt and Cmd combinations always stay the browser's, and a letter typed in a text field is always typing.":
    "会員は割り当てを変更できます。キーをクリックして機能を選ぶか、操作の横の「変更」を押してから使いたいキーを押してください。プロファイルはアカウントに保存されるため、ログインしたどのブラウザでも使えます。Ctrl、Alt、Cmd の組み合わせは常にブラウザのもので、入力欄で打った文字は常に文字入力になります。",
  "The dashed top row is Bloomberg's own keys, which a standard keyboard does not have.":
    "破線の最上段はブルームバーグ専用キーで、標準のキーボードにはありません。",
  "A Bloomberg terminal key; a standard keyboard has none":
    "ブルームバーグ端末のキー。標準のキーボードにはありません",
  "Kept for the browser and for typing": "ブラウザと文字入力用に予約",
  "Go to a page": "ページを開く",
  "On the page": "ページ上の操作",
  "In a text field": "入力欄の中",
  "This map": "このマップ",
  "Your own keys need a login.": "自分のキー設定にはログインが必要です。",
  "Members remap any key and keep their profiles on their account. Everyone gets the keys below.":
    "会員はどのキーでも割り当てを変更でき、プロファイルをアカウントに保存できます。下のキーは誰でも使えます。",
  "log in": "ログイン",
  profile: "プロファイル",
  name: "名前",
  "for a new profile": "新しいプロファイル用",
  "save as new": "新規保存",
  rename: "名前を変更",
  "reset keys": "キーを初期化",
  delete: "削除",
  "Press a key, or click one, to see what it does.":
    "キーを押すかクリックすると、その機能を確認できます。",
  "go to a page": "ページを開く",
  "act on the page": "ページを操作",
  "leave a text field": "入力欄を離れる",
  "this map": "このマップ",
  "Bloomberg-only": "ブルームバーグ専用",
  'Layout after <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> by Swapnil1101, CC BY-SA 4.0. Not affiliated with Bloomberg.':
    '配列は Swapnil1101 の <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a>（CC BY-SA 4.0）に基づきます。ブルームバーグとは無関係です。',
  change: "変更",
  clear: "解除",
  Default: "デフォルト",
  "My keys": "マイキー",
  "Profile {n}": "プロファイル {n}",
  "The default set is fixed, so your change started a new profile: {name}.":
    "デフォルトの設定は変更できないため、新しいプロファイル {name} を作成しました。",
  "{key} now: {action}.": "{key} の割り当て：{action}。",
  "{key} now: {action}, taken from {other}.": "{key} の割り当て：{action}（{other} から移動）。",
  "{action} has no key now.": "{action} にはキーが割り当てられていません。",
  "Press a key for {action}. Esc stops; or click a key above.":
    "{action} に使うキーを押してください。Esc で中止、または上のキーをクリックしてください。",
  "press a key": "キーを押してください",
  "{key}: {action}": "{key}：{action}",
  "{key}: {action}, opens {href}": "{key}：{action}、{href} を開きます",
  "{key} does nothing yet.": "{key} にはまだ機能がありません。",
  "{key} stays with the browser.": "{key} はブラウザ用に予約されています。",
  "There is already a profile called {name}.": "{name} という名前のプロファイルはすでにあります。",
  "That is as many profiles as an account keeps.":
    "1 つのアカウントに保存できるプロファイル数の上限です。",
  "Saved as {name}; it is the one in use.": "{name} として保存し、使用中にしました。",
  "Renamed to {name}.": "{name} に名前を変更しました。",
  "Deleted {name}; back to the default set.": "{name} を削除し、デフォルトの設定に戻しました。",
  "{name} is back to the default keys.": "{name} をデフォルトのキーに戻しました。",
  "Using {name}.": "{name} を使用中です。",
  nothing: "なし",
  "with Shift": "Shift 併用",
  "Key {key}": "キー {key}",
  "Log in to change what keys do.": "キーの機能を変更するにはログインしてください。",
  "You were signed out, so that change was not saved. Log in again to keep editing.":
    "ログアウトされたため、その変更は保存されませんでした。編集を続けるには再度ログインしてください。",
  "That change is not saved to your account yet: the member area did not answer. It still works in this browser.":
    "会員エリアが応答しなかったため、その変更はまだアカウントに保存されていません。このブラウザでは引き続き有効です。",
  "The member area did not answer, so your profiles could not be loaded. The keys in use are this browser's last copy.":
    "会員エリアが応答しなかったため、プロファイルを読み込めませんでした。現在のキー設定は、このブラウザに最後に保存されたものです。",
};
