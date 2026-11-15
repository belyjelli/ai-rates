/**
 * The keyboard page (web/keyboard.ts) and the shortcut actions it maps (web/hotkeys.ts), in German.
 * Glossary and style: ./index.ts. Keycap legends (Esc, Shift, Bloomberg's own row) stay as printed on
 * the keys.
 */

import type { Catalog } from "../../i18n";

export const keyboard: Catalog = {
  // web/hotkeys.ts
  sentiment: "Stimmung",
  "API docs": "API-Doku",
  "previous tab": "vorheriger Tab",
  "next tab": "nächster Tab",
  "back to top": "nach oben",
  "leave field": "Feld verlassen",
  "keyboard map": "Tastaturbelegung",

  // web/layout.ts
  keyboard: "Tastatur",

  // web/keyboard.ts
  Keyboard: "Tastatur",
  "Every keyboard shortcut on airrates, on a Bloomberg terminal layout. Members remap them into their own profiles.":
    "Alle Tastenkürzel von airrates auf dem Layout eines Bloomberg-Terminals. Mitglieder belegen sie in eigenen Profilen neu.",
  "Every shortcut on the site, drawn on the layout of a Bloomberg terminal keyboard. A lit key does something: green goes to a page, amber acts on the page you are on, red leaves a text field, blue opens this map. Press any key here to see what it does.":
    "Alle Tastenkürzel der Seite, gezeichnet auf dem Layout einer Bloomberg-Terminal-Tastatur. Eine leuchtende Taste macht etwas: Grün öffnet eine Seite, Bernstein wirkt auf die aktuelle Seite, Rot verlässt ein Textfeld, Blau öffnet diese Übersicht. Drück hier eine beliebige Taste, um zu sehen, was sie tut.",
  "Members can remap them: click a key to choose what it does, or press change beside an action and then the key you want. Profiles are kept on your account, so they follow you to every browser you log in on. Ctrl, Alt and Cmd combinations always stay the browser's, and a letter typed in a text field is always typing.":
    "Mitglieder können sie neu belegen: Klick auf eine Taste, um zu wählen, was sie tut, oder klick neben einer Aktion auf ändern und dann auf die gewünschte Taste. Profile werden in deinem Konto gespeichert und folgen dir in jeden Browser, in dem du dich anmeldest. Kombinationen mit Strg, Alt und Cmd bleiben immer beim Browser, und ein Buchstabe in einem Textfeld ist immer Eingabe.",
  "The dashed top row is Bloomberg's own keys, which a standard keyboard does not have.":
    "Die gestrichelte obere Reihe sind Bloombergs eigene Tasten, die eine normale Tastatur nicht hat.",
  "A Bloomberg terminal key; a standard keyboard has none":
    "Eine Bloomberg-Terminal-Taste; eine normale Tastatur hat sie nicht",
  "Kept for the browser and for typing": "Für den Browser und die Eingabe reserviert",
  "Go to a page": "Seite öffnen",
  "On the page": "Auf der Seite",
  "In a text field": "In einem Textfeld",
  "This map": "Diese Übersicht",
  "Your own keys need a login.": "Für eigene Tasten musst du dich anmelden.",
  "Members remap any key and keep their profiles on their account. Everyone gets the keys below.":
    "Mitglieder belegen jede Taste neu und speichern ihre Profile im Konto. Die Tasten unten gelten für alle.",
  "log in": "anmelden",
  profile: "Profil",
  name: "Name",
  "for a new profile": "für ein neues Profil",
  "save as new": "als neu speichern",
  rename: "umbenennen",
  "reset keys": "Tasten zurücksetzen",
  delete: "löschen",
  "Press a key, or click one, to see what it does.":
    "Drück oder klick eine Taste, um zu sehen, was sie tut.",
  "go to a page": "Seite öffnen",
  "act on the page": "auf der Seite handeln",
  "leave a text field": "Textfeld verlassen",
  "this map": "diese Übersicht",
  "Bloomberg-only": "nur Bloomberg",
  'Layout after <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> by Swapnil1101, CC BY-SA 4.0. Not affiliated with Bloomberg.':
    'Layout nach <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> von Swapnil1101, CC BY-SA 4.0. Nicht mit Bloomberg verbunden.',
  change: "ändern",
  clear: "leeren",
  Default: "Standard",
  "My keys": "Meine Tasten",
  "Profile {n}": "Profil {n}",
  "The default set is fixed, so your change started a new profile: {name}.":
    "Der Standardsatz ist fest, daher hat deine Änderung ein neues Profil angelegt: {name}.",
  "{key} now: {action}.": "{key} jetzt: {action}.",
  "{key} now: {action}, taken from {other}.": "{key} jetzt: {action}, übernommen von {other}.",
  "{action} has no key now.": "{action} hat jetzt keine Taste.",
  "Press a key for {action}. Esc stops; or click a key above.":
    "Drück eine Taste für {action}. Esc bricht ab; oder klick oben auf eine Taste.",
  "press a key": "Taste drücken",
  "{key}: {action}": "{key}: {action}",
  "{key}: {action}, opens {href}": "{key}: {action}, öffnet {href}",
  "{key} does nothing yet.": "{key} macht noch nichts.",
  "{key} stays with the browser.": "{key} bleibt beim Browser.",
  "There is already a profile called {name}.": "Es gibt schon ein Profil namens {name}.",
  "That is as many profiles as an account keeps.": "Mehr Profile kann ein Konto nicht speichern.",
  "Saved as {name}; it is the one in use.": "Als {name} gespeichert; es ist jetzt aktiv.",
  "Renamed to {name}.": "In {name} umbenannt.",
  "Deleted {name}; back to the default set.": "{name} gelöscht; zurück zum Standardsatz.",
  "{name} is back to the default keys.": "{name} hat wieder die Standardtasten.",
  "Using {name}.": "{name} ist aktiv.",
  nothing: "nichts",
  "with Shift": "mit Shift",
  "Key {key}": "Taste {key}",
  "Log in to change what keys do.": "Melde dich an, um Tasten neu zu belegen.",
  "You were signed out, so that change was not saved. Log in again to keep editing.":
    "Du wurdest abgemeldet, daher wurde die Änderung nicht gespeichert. Melde dich erneut an, um weiter zu bearbeiten.",
  "That change is not saved to your account yet: the member area did not answer. It still works in this browser.":
    "Diese Änderung ist noch nicht in deinem Konto gespeichert: Der Mitgliederbereich hat nicht geantwortet. In diesem Browser gilt sie trotzdem.",
  "The member area did not answer, so your profiles could not be loaded. The keys in use are this browser's last copy.":
    "Der Mitgliederbereich hat nicht geantwortet, daher konnten deine Profile nicht geladen werden. Aktiv ist die letzte Kopie dieses Browsers.",
};
