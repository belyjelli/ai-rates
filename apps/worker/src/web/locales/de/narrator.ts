import type { Catalog } from "../../i18n";

/**
 * The market narrator in the masthead and its two /settings rows (web/narrator.ts, web/settings.ts),
 * in German. Terms as on the Gamma Exposure tab (gamma.ts): the Gamma-Flip, the Call- and Put-Wand.
 */
export const narrator: Catalog = {
  "Market narrator": "Markt-Erzähler",
  "{n} entries": "Einträge: {n}",
  "Nothing to say yet: the narrator writes when the {book} option book moves.":
    "Noch nichts zu sagen: Der Erzähler schreibt, wenn sich das {book}-Optionsbuch bewegt.",
  "The narrator could not be read just now.": "Der Erzähler konnte gerade nicht geladen werden.",
  "The running commentary between the header and the menu: where price sits against the gamma flip and the walls of the BTC and ETH option books, written as they move. Open, folded to one line, or off.":
    "Der laufende Kommentar zwischen Kopfbereich und Menü: wo der Preis gegenüber dem Gamma-Flip und den Wänden der BTC- und ETH-Optionsbücher steht, geschrieben, während sie sich bewegen. Offen, auf eine Zeile eingeklappt oder aus.",
  expanded: "offen",
  collapsed: "eingeklappt",
  "Narrator typing": "Tippen des Erzählers",
  "Each new line types itself out. Off shows it whole at once.":
    "Jede neue Zeile tippt sich selbst. Aus zeigt sie sofort ganz.",
  on: "an",
  "Price is now below the gamma flip at {flip}: dealers are short gamma here, so their hedging adds to moves.":
    "Der Preis liegt jetzt unter dem Gamma-Flip bei {flip}: Dealer sind hier short Gamma, ihr Hedging verstärkt also Bewegungen.",
  "Price is now below the gamma flip at {flip}.":
    "Der Preis liegt jetzt unter dem Gamma-Flip bei {flip}.",
  "Price is now above the gamma flip at {flip}.":
    "Der Preis liegt jetzt über dem Gamma-Flip bei {flip}.",
  "Price is back above the gamma flip at {flip}: dealers are long gamma here, so their hedging damps moves.":
    "Der Preis ist zurück über dem Gamma-Flip bei {flip}: Dealer sind hier long Gamma, ihr Hedging dämpft also Bewegungen.",
  "Price has slipped onto the gamma flip at {flip}: nothing resolves until it holds or gives.":
    "Der Preis ist auf den Gamma-Flip bei {flip} gerutscht: Nichts entscheidet sich, bis er hält oder bricht.",
  "Price has climbed back to the gamma flip at {flip} from below.":
    "Der Preis ist von unten zurück zum Gamma-Flip bei {flip} gestiegen.",
  "Price has broken below the put wall at {wall}: no floor left underneath.":
    "Der Preis ist unter die Put-Wand bei {wall} gefallen: Darunter gibt es keinen Boden mehr.",
  "Price has broken above the call wall at {wall}: no ceiling left overhead.":
    "Der Preis ist über die Call-Wand bei {wall} gestiegen: Darüber gibt es keine Decke mehr.",
  "Price is testing the put wall at {wall} for the first time today.":
    "Der Preis testet heute zum ersten Mal die Put-Wand bei {wall}.",
  "Price is back at the put wall at {wall}: test {n} today.":
    "Der Preis ist zurück an der Put-Wand bei {wall}: Test Nr. {n} heute.",
  "Price is testing the call wall at {wall} for the first time today.":
    "Der Preis testet heute zum ersten Mal die Call-Wand bei {wall}.",
  "Price is back at the call wall at {wall}: test {n} today.":
    "Der Preis ist zurück an der Call-Wand bei {wall}: Test Nr. {n} heute.",
  "The put wall has moved up to {to} from {from}.":
    "Die Put-Wand ist von {from} auf {to} gestiegen.",
  "The put wall has moved down to {to} from {from}.":
    "Die Put-Wand ist von {from} auf {to} gefallen.",
  "The call wall has moved up to {to} from {from}.":
    "Die Call-Wand ist von {from} auf {to} gestiegen.",
  "The call wall has come down to {to} from {from}.":
    "Die Call-Wand ist von {from} auf {to} gefallen.",
  "The gamma flip has moved up to {to} from {from}.":
    "Der Gamma-Flip ist von {from} auf {to} gestiegen.",
  "The gamma flip has moved down to {to} from {from}.":
    "Der Gamma-Flip ist von {from} auf {to} gefallen.",
  "Dealers' gamma at this price has grown {pct} in the hour, to {net} per 1% move.":
    "Das Gamma der Dealer bei diesem Preis ist in der letzten Stunde um {pct} gewachsen, auf {net} pro 1 % Bewegung.",
  "Dealers' gamma at this price has thinned {pct} in the hour, to {net} per 1% move.":
    "Das Gamma der Dealer bei diesem Preis ist in der letzten Stunde um {pct} geschrumpft, auf {net} pro 1 % Bewegung.",
  "A new low for the UTC day at {price}.": "Neues Tagestief (UTC) bei {price}.",
  "A new high for the UTC day at {price}.": "Neues Tageshoch (UTC) bei {price}.",
  "Quiet hour: price {spot}, with no gamma flip within 30% either way.":
    "Ruhige Stunde: Preis {spot}, kein Gamma-Flip innerhalb von 30 % in beide Richtungen.",
  "Quiet hour: price {spot} sits right on the gamma flip at {flip}.":
    "Ruhige Stunde: Der Preis {spot} liegt genau auf dem Gamma-Flip bei {flip}.",
  "Quiet hour: price {spot} holds {pct} above the gamma flip at {flip}.":
    "Ruhige Stunde: Der Preis {spot} hält sich {pct} über dem Gamma-Flip bei {flip}.",
  "Quiet hour: price {spot} sits {pct} below the gamma flip at {flip}.":
    "Ruhige Stunde: Der Preis {spot} liegt {pct} unter dem Gamma-Flip bei {flip}.",
  "Levels: put wall {put} · flip {flip} · call wall {call}.":
    "Level: Put-Wand {put} · Flip {flip} · Call-Wand {call}.",
};
