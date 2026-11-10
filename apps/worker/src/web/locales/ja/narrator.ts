import type { Catalog } from "../../i18n";

/**
 * The market narrator in the masthead and its two /settings rows (web/narrator.ts, web/settings.ts),
 * in Japanese. Terms as on the Gamma Exposure tab (gamma.ts): the flip, the call and put walls.
 */
export const narrator: Catalog = {
  "Market narrator": "マーケット実況",
  "{n} entries": "{n} 件",
  "Nothing to say yet: the narrator writes when the {book} option book moves.":
    "まだ実況はありません：{book} のオプションに動きがあると書き込まれます。",
  "The narrator could not be read just now.": "実況をいま読み込めませんでした。",
  "The running commentary between the header and the menu: where price sits against the gamma flip and the walls of the BTC and ETH option books, written as they move. Open, folded to one line, or off.":
    "ヘッダーとメニューの間に流れる実況：BTC と ETH のオプションについて、価格がガンマフリップやウォールに対してどこにあるかを、動きに合わせて書きます。展開、1 行に折りたたみ、オフから選べます。",
  expanded: "展開",
  collapsed: "折りたたみ",
  "Narrator typing": "実況のタイピング",
  "Each new line types itself out. Off shows it whole at once.":
    "新しい行が 1 文字ずつ打ち出されます。オフにすると一度に全文を表示します。",
  on: "オン",
  "Price is now below the gamma flip at {flip}: dealers are short gamma here, so their hedging adds to moves.":
    "価格は {flip} のガンマフリップを下回りました：ここではディーラーがショートガンマで、ヘッジが値動きを増幅します。",
  "Price is now below the gamma flip at {flip}.": "価格は {flip} のガンマフリップを下回りました。",
  "Price is now above the gamma flip at {flip}.": "価格は {flip} のガンマフリップを上回りました。",
  "Price is back above the gamma flip at {flip}: dealers are long gamma here, so their hedging damps moves.":
    "価格は {flip} のガンマフリップの上に戻りました：ここではディーラーがロングガンマで、ヘッジが値動きを抑えます。",
  "Price has slipped onto the gamma flip at {flip}: nothing resolves until it holds or gives.":
    "価格は {flip} のガンマフリップまで下がってきました：持ちこたえるか割れるまで、決着はつきません。",
  "Price has climbed back to the gamma flip at {flip} from below.":
    "価格は下から {flip} のガンマフリップまで戻ってきました。",
  "Price has broken below the put wall at {wall}: no floor left underneath.":
    "価格は {wall} のプットウォールを割り込みました：下に支えはもうありません。",
  "Price has broken above the call wall at {wall}: no ceiling left overhead.":
    "価格は {wall} のコールウォールを上抜けました：上に天井はもうありません。",
  "Price is testing the put wall at {wall} for the first time today.":
    "価格は今日初めて {wall} のプットウォールを試しています。",
  "Price is back at the put wall at {wall}: test {n} today.":
    "価格は再び {wall} のプットウォールに来ています：今日 {n} 回目の試し。",
  "Price is testing the call wall at {wall} for the first time today.":
    "価格は今日初めて {wall} のコールウォールを試しています。",
  "Price is back at the call wall at {wall}: test {n} today.":
    "価格は再び {wall} のコールウォールに来ています：今日 {n} 回目の試し。",
  "The put wall has moved up to {to} from {from}.":
    "プットウォールが {from} から {to} に上がりました。",
  "The put wall has moved down to {to} from {from}.":
    "プットウォールが {from} から {to} に下がりました。",
  "The call wall has moved up to {to} from {from}.":
    "コールウォールが {from} から {to} に上がりました。",
  "The call wall has come down to {to} from {from}.":
    "コールウォールが {from} から {to} に下がりました。",
  "The gamma flip has moved up to {to} from {from}.":
    "ガンマフリップが {from} から {to} に上がりました。",
  "The gamma flip has moved down to {to} from {from}.":
    "ガンマフリップが {from} から {to} に下がりました。",
  "Dealers' gamma at this price has grown {pct} in the hour, to {net} per 1% move.":
    "この価格でのディーラーのガンマは 1 時間で {pct} 増え、1% の変動あたり {net} になりました。",
  "Dealers' gamma at this price has thinned {pct} in the hour, to {net} per 1% move.":
    "この価格でのディーラーのガンマは 1 時間で {pct} 減り、1% の変動あたり {net} になりました。",
  "A new low for the UTC day at {price}.": "UTC の日中安値を更新：{price}。",
  "A new high for the UTC day at {price}.": "UTC の日中高値を更新：{price}。",
  "Quiet hour: price {spot}, with no gamma flip within 30% either way.":
    "静かな 1 時間：価格 {spot}、上下 30% 以内にガンマフリップはありません。",
  "Quiet hour: price {spot} sits right on the gamma flip at {flip}.":
    "静かな 1 時間：価格 {spot} は {flip} のガンマフリップちょうどにあります。",
  "Quiet hour: price {spot} holds {pct} above the gamma flip at {flip}.":
    "静かな 1 時間：価格 {spot} は {flip} のガンマフリップの {pct} 上で推移しています。",
  "Quiet hour: price {spot} sits {pct} below the gamma flip at {flip}.":
    "静かな 1 時間：価格 {spot} は {flip} のガンマフリップの {pct} 下にあります。",
  "Levels: put wall {put} · flip {flip} · call wall {call}.":
    "水準：プットウォール {put} · フリップ {flip} · コールウォール {call}。",
};
