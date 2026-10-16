/**
 * Russian for the keyboard page (web/keyboard.ts) and the shortcut actions it maps
 * (web/hotkeys.ts). Glossary and style: ./index.ts. Keycap legends (Esc, Shift, Bloomberg's own row)
 * stay as printed on the keys.
 *
 * Terms: shortcut горячая клавиша, keyboard map карта клавиш, member участник, member area личный
 * кабинет, profile профиль, sentiment сентимент. An action label quoted inside a sentence goes in
 * «», since its case cannot follow the sentence's grammar.
 */

import type { Catalog } from "../../i18n";

export const keyboard: Catalog = {
  // web/hotkeys.ts
  sentiment: "сентимент",
  "API docs": "документация API",
  "previous tab": "предыдущая вкладка",
  "next tab": "следующая вкладка",
  "back to top": "наверх",
  "leave field": "выйти из поля",
  "keyboard map": "карта клавиш",

  // web/layout.ts
  "Keyboard shortcuts: change them on the keyboard page":
    "Горячие клавиши: настраиваются на странице клавиатуры",
  keyboard: "клавиатура",

  // web/keyboard.ts
  Keyboard: "Клавиатура",
  "Every keyboard shortcut on airrates, on a Bloomberg terminal layout. Members remap them into their own profiles.":
    "Все горячие клавиши airrates на раскладке терминала Bloomberg. Участники переназначают их в своих профилях.",
  "Every shortcut on the site, drawn on the layout of a Bloomberg terminal keyboard. A lit key does something: green goes to a page, amber acts on the page you are on, red leaves a text field, blue opens this map. Press any key here to see what it does.":
    "Все горячие клавиши сайта на раскладке клавиатуры терминала Bloomberg. Подсвеченная клавиша что-то делает: зелёная открывает страницу, янтарная действует на текущей странице, красная выводит из текстового поля, синяя открывает эту карту. Нажмите здесь любую клавишу, чтобы узнать, что она делает.",
  "Members can remap them: click a key to choose what it does, or press change beside an action and then the key you want. Profiles are kept on your account, so they follow you to every browser you log in on. Ctrl, Alt and Cmd combinations always stay the browser's, and a letter typed in a text field is always typing.":
    "Участники могут их переназначать: нажмите на клавишу и выберите действие или нажмите «изменить» рядом с действием, а затем нужную клавишу. Профили хранятся в вашем аккаунте и работают в любом браузере, где вы вошли. Сочетания с Ctrl, Alt и Cmd всегда остаются за браузером, а буква, набранная в текстовом поле, — всегда ввод текста.",
  "The dashed top row is Bloomberg's own keys, which a standard keyboard does not have.":
    "Верхний пунктирный ряд — собственные клавиши Bloomberg, которых нет на обычной клавиатуре.",
  "A Bloomberg terminal key; a standard keyboard has none":
    "Клавиша терминала Bloomberg; на обычной клавиатуре её нет",
  "Kept for the browser and for typing": "Оставлено браузеру и для ввода текста",
  "Go to a page": "Открыть страницу",
  "On the page": "На странице",
  "In a text field": "В текстовом поле",
  "This map": "Эта карта",
  "Your own keys need a login.": "Для своих клавиш нужно войти.",
  "Members remap any key and keep their profiles on their account. Everyone gets the keys below.":
    "Участники переназначают любые клавиши и хранят профили в аккаунте. Клавиши ниже доступны всем.",
  "log in": "войти",
  profile: "профиль",
  name: "название",
  "for a new profile": "для нового профиля",
  "save as new": "сохранить как новый",
  rename: "переименовать",
  "reset keys": "сбросить клавиши",
  delete: "удалить",
  "Press a key, or click one, to see what it does.":
    "Нажмите клавишу или щёлкните по ней, чтобы узнать, что она делает.",
  "go to a page": "открыть страницу",
  "act on the page": "действие на странице",
  "leave a text field": "выйти из текстового поля",
  "this map": "эта карта",
  "Bloomberg-only": "только Bloomberg",
  'Layout after <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> by Swapnil1101, CC BY-SA 4.0. Not affiliated with Bloomberg.':
    'Раскладка по <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> от Swapnil1101, CC BY-SA 4.0. Не связано с Bloomberg.',
  change: "изменить",
  clear: "очистить",
  Default: "По умолчанию",
  "My keys": "Мои клавиши",
  "Profile {n}": "Профиль {n}",
  "The default set is fixed, so your change started a new profile: {name}.":
    "Набор по умолчанию не меняется, поэтому ваше изменение создало новый профиль: {name}.",
  "{key} now: {action}.": "{key} теперь: {action}.",
  "{key} now: {action}, taken from {other}.": "{key} теперь: {action} (раньше: {other}).",
  "{action} has no key now.": "У действия «{action}» теперь нет клавиши.",
  "Press a key for {action}. Esc stops; or click a key above.":
    "Нажмите клавишу для действия «{action}». Esc — отмена; или щёлкните клавишу выше.",
  "press a key": "нажмите клавишу",
  "{key}: {action}": "{key}: {action}",
  "{key}: {action}, opens {href}": "{key}: {action}, открывает {href}",
  "{key} does nothing yet.": "{key} пока ничего не делает.",
  "{key} stays with the browser.": "{key} остаётся за браузером.",
  "There is already a profile called {name}.": "Профиль с названием {name} уже есть.",
  "That is as many profiles as an account keeps.": "Это максимум профилей для одного аккаунта.",
  "Saved as {name}; it is the one in use.":
    "Сохранено как {name}; этот профиль сейчас используется.",
  "Renamed to {name}.": "Переименовано в {name}.",
  "Deleted {name}; back to the default set.": "Профиль {name} удалён; снова набор по умолчанию.",
  "{name} is back to the default keys.": "Профиль {name} сброшен на клавиши по умолчанию.",
  "Using {name}.": "Используется {name}.",
  nothing: "ничего",
  "with Shift": "с Shift",
  "Key {key}": "Клавиша {key}",
  "Log in to change what keys do.": "Войдите, чтобы менять действия клавиш.",
  "You were signed out, so that change was not saved. Log in again to keep editing.":
    "Вы вышли из аккаунта, поэтому изменение не сохранилось. Войдите снова, чтобы продолжить.",
  "That change is not saved to your account yet: the member area did not answer. It still works in this browser.":
    "Изменение ещё не сохранено в аккаунте: личный кабинет не ответил. В этом браузере оно уже работает.",
  "The member area did not answer, so your profiles could not be loaded. The keys in use are this browser's last copy.":
    "Личный кабинет не ответил, поэтому профили не загрузились. Сейчас используется последняя копия из этого браузера.",
};
