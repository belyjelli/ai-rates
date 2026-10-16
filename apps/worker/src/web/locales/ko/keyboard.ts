/**
 * Korean for the keyboard page (web/keyboard.ts) and the shortcut actions it maps (web/hotkeys.ts).
 * Glossary and style: ./index.ts. Keycap legends (Esc, Shift, Bloomberg's own row) stay as printed on
 * the keys.
 *
 * Terms: shortcut 단축키, keyboard map 키보드 맵, profile 프로필, remap 다시 지정, Bloomberg 블룸버그,
 * text field 입력란. A request to the reader ends in -세요; a statement in -ㅂ니다.
 */

import type { Catalog } from "../../i18n";

export const keyboard: Catalog = {
  // web/hotkeys.ts
  sentiment: "시장 심리",
  "API docs": "API 문서",
  "previous tab": "이전 탭",
  "next tab": "다음 탭",
  "back to top": "맨 위로",
  "leave field": "입력란 나가기",
  "keyboard map": "키보드 맵",

  // web/layout.ts
  "Keyboard shortcuts: change them on the keyboard page": "키보드 단축키: 키보드 페이지에서 변경",
  keyboard: "키보드",

  // web/keyboard.ts
  Keyboard: "키보드",
  "Every keyboard shortcut on airrates, on a Bloomberg terminal layout. Members remap them into their own profiles.":
    "airrates의 모든 키보드 단축키를 블룸버그 터미널 배열로 보여 줍니다. 회원은 단축키를 다시 지정해 자신의 프로필에 저장할 수 있습니다.",
  "Every shortcut on the site, drawn on the layout of a Bloomberg terminal keyboard. A lit key does something: green goes to a page, amber acts on the page you are on, red leaves a text field, blue opens this map. Press any key here to see what it does.":
    "사이트의 모든 단축키를 블룸버그 터미널 키보드 배열 위에 그렸습니다. 불이 켜진 키에는 기능이 있습니다: 초록색은 페이지로 이동, 주황색은 현재 페이지에서 동작, 빨간색은 입력란 나가기, 파란색은 이 맵 열기입니다. 여기서 아무 키나 누르면 그 기능을 볼 수 있습니다.",
  "Members can remap them: click a key to choose what it does, or press change beside an action and then the key you want. Profiles are kept on your account, so they follow you to every browser you log in on. Ctrl, Alt and Cmd combinations always stay the browser's, and a letter typed in a text field is always typing.":
    "회원은 단축키를 다시 지정할 수 있습니다: 키를 클릭해 기능을 고르거나, 동작 옆의 ‘변경’을 누른 뒤 원하는 키를 누르세요. 프로필은 계정에 저장되므로 로그인한 모든 브라우저에서 쓸 수 있습니다. Ctrl, Alt, Cmd 조합은 항상 브라우저용으로 남고, 입력란에서 누른 글자는 항상 입력됩니다.",
  "The dashed top row is Bloomberg's own keys, which a standard keyboard does not have.":
    "점선으로 된 맨 윗줄은 블룸버그 전용 키로, 일반 키보드에는 없습니다.",
  "A Bloomberg terminal key; a standard keyboard has none":
    "블룸버그 터미널 전용 키, 일반 키보드에는 없음",
  "Kept for the browser and for typing": "브라우저와 입력용으로 남겨 둠",
  "Go to a page": "페이지로 이동",
  "On the page": "현재 페이지",
  "In a text field": "입력란에서",
  "This map": "이 맵",
  "Your own keys need a login.": "나만의 키를 쓰려면 로그인이 필요합니다.",
  "Members remap any key and keep their profiles on their account. Everyone gets the keys below.":
    "회원은 어떤 키든 다시 지정하고 프로필을 계정에 저장할 수 있습니다. 아래 키는 누구나 쓸 수 있습니다.",
  "log in": "로그인",
  profile: "프로필",
  name: "이름",
  "for a new profile": "새 프로필용",
  "save as new": "새로 저장",
  rename: "이름 변경",
  "reset keys": "키 초기화",
  delete: "삭제",
  "Press a key, or click one, to see what it does.":
    "키를 누르거나 클릭하면 그 기능을 볼 수 있습니다.",
  "go to a page": "페이지로 이동",
  "act on the page": "현재 페이지에서 동작",
  "leave a text field": "입력란 나가기",
  "this map": "이 맵",
  "Bloomberg-only": "블룸버그 전용",
  'Layout after <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> by Swapnil1101, CC BY-SA 4.0. Not affiliated with Bloomberg.':
    '배열 출처: Swapnil1101의 <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a>(CC BY-SA 4.0). 블룸버그와 관련이 없습니다.',
  change: "변경",
  clear: "해제",
  Default: "기본",
  "My keys": "내 키",
  "Profile {n}": "프로필 {n}",
  "The default set is fixed, so your change started a new profile: {name}.":
    "기본 설정은 바꿀 수 없어서, 변경 내용으로 새 프로필 {name}을(를) 만들었습니다.",
  "{key} now: {action}.": "{key}: 이제 {action}.",
  "{key} now: {action}, taken from {other}.": "{key}: 이제 {action}({other}에서 가져옴).",
  "{action} has no key now.": "{action}: 이제 지정된 키가 없습니다.",
  "Press a key for {action}. Esc stops; or click a key above.":
    "{action}에 쓸 키를 누르세요. Esc를 누르면 멈추며, 위의 키를 클릭해도 됩니다.",
  "press a key": "키를 누르세요",
  "{key}: {action}": "{key}: {action}",
  "{key}: {action}, opens {href}": "{key}: {action}, {href} 열기",
  "{key} does nothing yet.": "{key}: 아직 기능이 없습니다.",
  "{key} stays with the browser.": "{key}: 브라우저용으로 남겨 둡니다.",
  "There is already a profile called {name}.": "{name}(이)라는 프로필이 이미 있습니다.",
  "That is as many profiles as an account keeps.": "계정에 저장할 수 있는 프로필 수의 한도입니다.",
  "Saved as {name}; it is the one in use.": "{name}(으)로 저장했으며, 지금 사용 중입니다.",
  "Renamed to {name}.": "이름을 {name}(으)로 바꿨습니다.",
  "Deleted {name}; back to the default set.": "{name}을(를) 삭제하고 기본 설정으로 돌아갔습니다.",
  "{name} is back to the default keys.": "{name}을(를) 기본 키로 되돌렸습니다.",
  "Using {name}.": "{name} 사용 중.",
  nothing: "없음",
  "with Shift": "Shift와 함께",
  "Key {key}": "{key} 키",
  "Log in to change what keys do.": "키 기능을 바꾸려면 로그인하세요.",
  "You were signed out, so that change was not saved. Log in again to keep editing.":
    "로그아웃되어 방금 변경한 내용이 저장되지 않았습니다. 계속 편집하려면 다시 로그인하세요.",
  "That change is not saved to your account yet: the member area did not answer. It still works in this browser.":
    "변경 내용이 아직 계정에 저장되지 않았습니다: 회원 영역이 응답하지 않았습니다. 이 브라우저에서는 계속 적용됩니다.",
  "The member area did not answer, so your profiles could not be loaded. The keys in use are this browser's last copy.":
    "회원 영역이 응답하지 않아 프로필을 불러오지 못했습니다. 지금 쓰는 키는 이 브라우저에 마지막으로 저장된 사본입니다.",
};
