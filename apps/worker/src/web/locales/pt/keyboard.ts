/**
 * The keyboard page (web/keyboard.ts) and the shortcut actions it maps (web/hotkeys.ts), in
 * Portuguese (Brazil). Glossary and style: ./index.ts. Keycap legends (Esc, Shift, Bloomberg's own
 * row) stay as printed on the keys.
 */

import type { Catalog } from "../../i18n";

export const keyboard: Catalog = {
  // web/hotkeys.ts
  sentiment: "sentimento",
  "API docs": "docs da API",
  "previous tab": "aba anterior",
  "next tab": "próxima aba",
  "back to top": "voltar ao topo",
  "leave field": "sair do campo",
  "keyboard map": "mapa do teclado",

  // web/layout.ts
  keyboard: "teclado",

  // web/keyboard.ts
  Keyboard: "Teclado",
  "Every keyboard shortcut on airrates, on a Bloomberg terminal layout. Members remap them into their own profiles.":
    "Todos os atalhos de teclado do airrates, no layout de um terminal Bloomberg. Membros os remapeiam em perfis próprios.",
  "Every shortcut on the site, drawn on the layout of a Bloomberg terminal keyboard. A lit key does something: green goes to a page, amber acts on the page you are on, red leaves a text field, blue opens this map. Press any key here to see what it does.":
    "Todos os atalhos do site, desenhados no layout de um teclado de terminal Bloomberg. Uma tecla acesa faz algo: verde abre uma página, âmbar age na página em que você está, vermelho sai de um campo de texto, azul abre este mapa. Pressione qualquer tecla aqui para ver o que ela faz.",
  "Members can remap them: click a key to choose what it does, or press change beside an action and then the key you want. Profiles are kept on your account, so they follow you to every browser you log in on. Ctrl, Alt and Cmd combinations always stay the browser's, and a letter typed in a text field is always typing.":
    "Membros podem remapeá-los: clique em uma tecla para escolher o que ela faz, ou clique em alterar ao lado de uma ação e depois na tecla desejada. Os perfis ficam salvos na sua conta, então acompanham você em todo navegador em que entrar. As combinações com Ctrl, Alt e Cmd continuam sendo do navegador, e uma letra digitada em um campo de texto é sempre digitação.",
  "The dashed top row is Bloomberg's own keys, which a standard keyboard does not have.":
    "A fileira tracejada de cima são as teclas próprias da Bloomberg, que um teclado comum não tem.",
  "A Bloomberg terminal key; a standard keyboard has none":
    "Uma tecla do terminal Bloomberg; um teclado comum não tem",
  "Kept for the browser and for typing": "Reservada ao navegador e à digitação",
  "Go to a page": "Abrir uma página",
  "On the page": "Na página",
  "In a text field": "Em um campo de texto",
  "This map": "Este mapa",
  "Your own keys need a login.": "Suas próprias teclas exigem entrar na conta.",
  "Members remap any key and keep their profiles on their account. Everyone gets the keys below.":
    "Membros remapeiam qualquer tecla e guardam os perfis na própria conta. Todos têm as teclas abaixo.",
  "log in": "entrar",
  profile: "perfil",
  name: "nome",
  "for a new profile": "para um novo perfil",
  "save as new": "salvar como novo",
  rename: "renomear",
  "reset keys": "redefinir teclas",
  delete: "excluir",
  "Press a key, or click one, to see what it does.":
    "Pressione ou clique em uma tecla para ver o que ela faz.",
  "go to a page": "abrir uma página",
  "act on the page": "agir na página",
  "leave a text field": "sair de um campo de texto",
  "this map": "este mapa",
  "Bloomberg-only": "só Bloomberg",
  'Layout after <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a> by Swapnil1101, CC BY-SA 4.0. Not affiliated with Bloomberg.':
    'Layout baseado em <a href="https://commons.wikimedia.org/wiki/File:Bloomberg_Terminal_Keyboard.svg" rel="noopener">Bloomberg Terminal Keyboard</a>, de Swapnil1101, CC BY-SA 4.0. Sem vínculo com a Bloomberg.',
  change: "alterar",
  clear: "limpar",
  Default: "Padrão",
  "My keys": "Minhas teclas",
  "Profile {n}": "Perfil {n}",
  "The default set is fixed, so your change started a new profile: {name}.":
    "O conjunto padrão é fixo, então sua alteração criou um novo perfil: {name}.",
  "{key} now: {action}.": "{key} agora: {action}.",
  "{key} now: {action}, taken from {other}.": "{key} agora: {action}, tirada de {other}.",
  "{action} has no key now.": "{action} está sem tecla agora.",
  "Press a key for {action}. Esc stops; or click a key above.":
    "Pressione uma tecla para {action}. Esc cancela; ou clique em uma tecla acima.",
  "press a key": "pressione uma tecla",
  "{key}: {action}": "{key}: {action}",
  "{key}: {action}, opens {href}": "{key}: {action}, abre {href}",
  "{key} does nothing yet.": "{key} ainda não faz nada.",
  "{key} stays with the browser.": "{key} fica com o navegador.",
  "There is already a profile called {name}.": "Já existe um perfil chamado {name}.",
  "That is as many profiles as an account keeps.": "Esse é o limite de perfis de uma conta.",
  "Saved as {name}; it is the one in use.": "Salvo como {name}; é o que está em uso.",
  "Renamed to {name}.": "Renomeado para {name}.",
  "Deleted {name}; back to the default set.": "{name} excluído; de volta ao conjunto padrão.",
  "{name} is back to the default keys.": "{name} voltou às teclas padrão.",
  "Using {name}.": "Usando {name}.",
  nothing: "nada",
  "with Shift": "com Shift",
  "Key {key}": "Tecla {key}",
  "Log in to change what keys do.": "Entre na conta para mudar o que as teclas fazem.",
  "You were signed out, so that change was not saved. Log in again to keep editing.":
    "Você saiu da conta, então essa alteração não foi salva. Entre de novo para continuar editando.",
  "That change is not saved to your account yet: the member area did not answer. It still works in this browser.":
    "Essa alteração ainda não foi salva na sua conta: a área de membros não respondeu. Ela continua valendo neste navegador.",
  "The member area did not answer, so your profiles could not be loaded. The keys in use are this browser's last copy.":
    "A área de membros não respondeu, então seus perfis não puderam ser carregados. As teclas em uso são a última cópia deste navegador.",
};
