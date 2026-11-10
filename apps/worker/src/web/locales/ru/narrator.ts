import type { Catalog } from "../../i18n";

/**
 * The market narrator in the masthead and its two /settings rows (web/narrator.ts, web/settings.ts),
 * in Russian. Terms as on the Gamma Exposure tab (gamma.ts): the flip, the call and put walls.
 */
export const narrator: Catalog = {
  "Market narrator": "Комментатор рынка",
  "{n} entries": "записей: {n}",
  "Nothing to say yet: the narrator writes when the {book} option book moves.":
    "Пока нечего сказать: комментатор пишет, когда движется книга опционов {book}.",
  "The narrator could not be read just now.": "Не удалось загрузить комментатора.",
  "The running commentary between the header and the menu: where price sits against the gamma flip and the walls of the BTC and ETH option books, written as they move. Open, folded to one line, or off.":
    "Текущий комментарий между шапкой и меню: где цена относительно разворота гаммы и стен в книгах опционов BTC и ETH, по мере их движения. Развёрнут, свёрнут в одну строку или выключен.",
  expanded: "развёрнут",
  collapsed: "свёрнут",
  "Narrator typing": "Набор текста комментатора",
  "Each new line types itself out. Off shows it whole at once.":
    "Каждая новая строка печатается по буквам. Если выключить, строка появляется целиком.",
  on: "вкл.",
  "Price is now below the gamma flip at {flip}: dealers are short gamma here, so their hedging adds to moves.":
    "Цена ушла ниже разворота гаммы на {flip}: здесь дилеры в короткой гамме, и их хеджирование усиливает движения.",
  "Price is now below the gamma flip at {flip}.": "Цена ушла ниже разворота гаммы на {flip}.",
  "Price is now above the gamma flip at {flip}.": "Цена поднялась выше разворота гаммы на {flip}.",
  "Price is back above the gamma flip at {flip}: dealers are long gamma here, so their hedging damps moves.":
    "Цена вернулась выше разворота гаммы на {flip}: здесь дилеры в длинной гамме, и их хеджирование гасит движения.",
  "Price has slipped onto the gamma flip at {flip}: nothing resolves until it holds or gives.":
    "Цена сползла к развороту гаммы на {flip}: ничего не решится, пока он не устоит или не сдастся.",
  "Price has climbed back to the gamma flip at {flip} from below.":
    "Цена поднялась снизу обратно к развороту гаммы на {flip}.",
  "Price has broken below the put wall at {wall}: no floor left underneath.":
    "Цена пробила пут-стену на {wall} вниз: опоры снизу больше нет.",
  "Price has broken above the call wall at {wall}: no ceiling left overhead.":
    "Цена пробила колл-стену на {wall} вверх: потолка сверху больше нет.",
  "Price is testing the put wall at {wall} for the first time today.":
    "Цена впервые за день тестирует пут-стену на {wall}.",
  "Price is back at the put wall at {wall}: test {n} today.":
    "Цена снова у пут-стены на {wall}: тест {n} за день.",
  "Price is testing the call wall at {wall} for the first time today.":
    "Цена впервые за день тестирует колл-стену на {wall}.",
  "Price is back at the call wall at {wall}: test {n} today.":
    "Цена снова у колл-стены на {wall}: тест {n} за день.",
  "The put wall has moved up to {to} from {from}.": "Пут-стена поднялась с {from} до {to}.",
  "The put wall has moved down to {to} from {from}.": "Пут-стена опустилась с {from} до {to}.",
  "The call wall has moved up to {to} from {from}.": "Колл-стена поднялась с {from} до {to}.",
  "The call wall has come down to {to} from {from}.": "Колл-стена опустилась с {from} до {to}.",
  "The gamma flip has moved up to {to} from {from}.": "Разворот гаммы поднялся с {from} до {to}.",
  "The gamma flip has moved down to {to} from {from}.":
    "Разворот гаммы опустился с {from} до {to}.",
  "Dealers' gamma at this price has grown {pct} in the hour, to {net} per 1% move.":
    "Гамма дилеров на этой цене выросла за час на {pct}, до {net} на 1% движения.",
  "Dealers' gamma at this price has thinned {pct} in the hour, to {net} per 1% move.":
    "Гамма дилеров на этой цене истончилась за час на {pct}, до {net} на 1% движения.",
  "A new low for the UTC day at {price}.": "Новый минимум UTC-дня: {price}.",
  "A new high for the UTC day at {price}.": "Новый максимум UTC-дня: {price}.",
  "Quiet hour: price {spot}, with no gamma flip within 30% either way.":
    "Тихий час: цена {spot}, разворота гаммы нет в пределах 30% в обе стороны.",
  "Quiet hour: price {spot} sits right on the gamma flip at {flip}.":
    "Тихий час: цена {spot} стоит прямо на развороте гаммы на {flip}.",
  "Quiet hour: price {spot} holds {pct} above the gamma flip at {flip}.":
    "Тихий час: цена {spot} держится на {pct} выше разворота гаммы на {flip}.",
  "Quiet hour: price {spot} sits {pct} below the gamma flip at {flip}.":
    "Тихий час: цена {spot} на {pct} ниже разворота гаммы на {flip}.",
  "Levels: put wall {put} · flip {flip} · call wall {call}.":
    "Уровни: пут-стена {put} · разворот {flip} · колл-стена {call}.",
};
