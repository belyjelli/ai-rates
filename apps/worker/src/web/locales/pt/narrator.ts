import type { Catalog } from "../../i18n";

/**
 * The market narrator in the masthead and its two /settings rows (web/narrator.ts, web/settings.ts),
 * in Portuguese (Brazil). Terms as on the Gamma Exposure tab (gamma.ts): the gamma flip, the call and
 * put walls.
 */
export const narrator: Catalog = {
  "Market narrator": "Narrador do mercado",
  "{n} entries": "entradas: {n}",
  "Nothing to say yet: the narrator writes when the {book} option book moves.":
    "Nada a dizer ainda: o narrador escreve quando o livro de opções de {book} se move.",
  "The narrator could not be read just now.": "Não foi possível carregar o narrador agora.",
  "The running commentary between the header and the menu: where price sits against the gamma flip and the walls of the BTC and ETH option books, written as they move. Open, folded to one line, or off.":
    "O comentário contínuo entre o cabeçalho e o menu: onde o preço está em relação ao gamma flip e às muralhas dos livros de opções de BTC e ETH, escrito conforme se movem. Aberto, recolhido em uma linha ou desligado.",
  expanded: "aberto",
  collapsed: "recolhido",
  "Narrator typing": "Digitação do narrador",
  "Each new line types itself out. Off shows it whole at once.":
    "Cada nova linha é digitada letra por letra. Desligado, ela aparece inteira de uma vez.",
  on: "ligado",
  "Price is now below the gamma flip at {flip}: dealers are short gamma here, so their hedging adds to moves.":
    "O preço está agora abaixo do gamma flip em {flip}: aqui os dealers estão vendidos em gama, então o hedge deles amplia os movimentos.",
  "Price is now below the gamma flip at {flip}.":
    "O preço está agora abaixo do gamma flip em {flip}.",
  "Price is now above the gamma flip at {flip}.":
    "O preço está agora acima do gamma flip em {flip}.",
  "Price is back above the gamma flip at {flip}: dealers are long gamma here, so their hedging damps moves.":
    "O preço voltou para cima do gamma flip em {flip}: aqui os dealers estão comprados em gama, então o hedge deles amortece os movimentos.",
  "Price has slipped onto the gamma flip at {flip}: nothing resolves until it holds or gives.":
    "O preço escorregou até o gamma flip em {flip}: nada se define até ele segurar ou ceder.",
  "Price has climbed back to the gamma flip at {flip} from below.":
    "O preço subiu de volta até o gamma flip em {flip}, vindo de baixo.",
  "Price has broken below the put wall at {wall}: no floor left underneath.":
    "O preço rompeu para baixo a muralha de puts em {wall}: não resta piso embaixo.",
  "Price has broken above the call wall at {wall}: no ceiling left overhead.":
    "O preço rompeu para cima a muralha de calls em {wall}: não resta teto acima.",
  "Price is testing the put wall at {wall} for the first time today.":
    "O preço está testando a muralha de puts em {wall} pela primeira vez hoje.",
  "Price is back at the put wall at {wall}: test {n} today.":
    "O preço voltou à muralha de puts em {wall}: teste nº {n} hoje.",
  "Price is testing the call wall at {wall} for the first time today.":
    "O preço está testando a muralha de calls em {wall} pela primeira vez hoje.",
  "Price is back at the call wall at {wall}: test {n} today.":
    "O preço voltou à muralha de calls em {wall}: teste nº {n} hoje.",
  "The put wall has moved up to {to} from {from}.": "A muralha de puts subiu de {from} para {to}.",
  "The put wall has moved down to {to} from {from}.":
    "A muralha de puts desceu de {from} para {to}.",
  "The call wall has moved up to {to} from {from}.":
    "A muralha de calls subiu de {from} para {to}.",
  "The call wall has come down to {to} from {from}.":
    "A muralha de calls desceu de {from} para {to}.",
  "The gamma flip has moved up to {to} from {from}.": "O gamma flip subiu de {from} para {to}.",
  "The gamma flip has moved down to {to} from {from}.": "O gamma flip desceu de {from} para {to}.",
  "Dealers' gamma at this price has grown {pct} in the hour, to {net} per 1% move.":
    "A gama dos dealers neste preço cresceu {pct} na última hora, para {net} por movimento de 1%.",
  "Dealers' gamma at this price has thinned {pct} in the hour, to {net} per 1% move.":
    "A gama dos dealers neste preço encolheu {pct} na última hora, para {net} por movimento de 1%.",
  "A new low for the UTC day at {price}.": "Nova mínima do dia UTC em {price}.",
  "A new high for the UTC day at {price}.": "Nova máxima do dia UTC em {price}.",
  "Quiet hour: price {spot}, with no gamma flip within 30% either way.":
    "Hora calma: preço {spot}, sem gamma flip a menos de 30% para qualquer lado.",
  "Quiet hour: price {spot} sits right on the gamma flip at {flip}.":
    "Hora calma: o preço {spot} está bem em cima do gamma flip em {flip}.",
  "Quiet hour: price {spot} holds {pct} above the gamma flip at {flip}.":
    "Hora calma: o preço {spot} se mantém {pct} acima do gamma flip em {flip}.",
  "Quiet hour: price {spot} sits {pct} below the gamma flip at {flip}.":
    "Hora calma: o preço {spot} está {pct} abaixo do gamma flip em {flip}.",
  "Levels: put wall {put} · flip {flip} · call wall {call}.":
    "Níveis: muralha de puts {put} · flip {flip} · muralha de calls {call}.",
};
