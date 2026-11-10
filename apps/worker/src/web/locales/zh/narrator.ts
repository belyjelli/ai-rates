import type { Catalog } from "../../i18n";

/**
 * The market narrator in the masthead and its two /settings rows (web/narrator.ts, web/settings.ts),
 * in Simplified Chinese. Terms as on the Gamma Exposure tab (gamma.ts): the flip, the call and put walls.
 */
export const narrator: Catalog = {
  "Market narrator": "行情解说",
  "{n} entries": "{n} 条",
  "Nothing to say yet: the narrator writes when the {book} option book moves.":
    "暂无内容：{book} 期权簿有变动时，解说会写下来。",
  "The narrator could not be read just now.": "解说暂时无法读取。",
  "The running commentary between the header and the menu: where price sits against the gamma flip and the walls of the BTC and ETH option books, written as they move. Open, folded to one line, or off.":
    "页眉与菜单之间的实时解说：价格相对 BTC 和 ETH 期权簿的 gamma 翻转点与看涨墙、看跌墙的位置，随行情变动写出。可展开、折叠为一行或关闭。",
  expanded: "展开",
  collapsed: "折叠",
  "Narrator typing": "解说打字效果",
  "Each new line types itself out. Off shows it whole at once.":
    "每条新解说逐字打出。关闭后整条直接显示。",
  on: "开",
  "Price is now below the gamma flip at {flip}: dealers are short gamma here, so their hedging adds to moves.":
    "价格已跌破 {flip} 的 gamma 翻转点：此处做市商为负 Gamma，对冲会放大波动。",
  "Price is now below the gamma flip at {flip}.": "价格已跌破 {flip} 的 gamma 翻转点。",
  "Price is now above the gamma flip at {flip}.": "价格已升至 {flip} 的 gamma 翻转点上方。",
  "Price is back above the gamma flip at {flip}: dealers are long gamma here, so their hedging damps moves.":
    "价格已回到 {flip} 的 gamma 翻转点上方：此处做市商为正 Gamma，对冲会抑制波动。",
  "Price has slipped onto the gamma flip at {flip}: nothing resolves until it holds or gives.":
    "价格已滑落至 {flip} 的 gamma 翻转点：守住或失守之前，局面不会明朗。",
  "Price has climbed back to the gamma flip at {flip} from below.":
    "价格已从下方回升至 {flip} 的 gamma 翻转点。",
  "Price has broken below the put wall at {wall}: no floor left underneath.":
    "价格已跌破 {wall} 的看跌墙：下方已无支撑。",
  "Price has broken above the call wall at {wall}: no ceiling left overhead.":
    "价格已突破 {wall} 的看涨墙：上方已无阻力。",
  "Price is testing the put wall at {wall} for the first time today.":
    "价格今天首次测试 {wall} 的看跌墙。",
  "Price is back at the put wall at {wall}: test {n} today.":
    "价格再次回到 {wall} 的看跌墙：今天第 {n} 次测试。",
  "Price is testing the call wall at {wall} for the first time today.":
    "价格今天首次测试 {wall} 的看涨墙。",
  "Price is back at the call wall at {wall}: test {n} today.":
    "价格再次回到 {wall} 的看涨墙：今天第 {n} 次测试。",
  "The put wall has moved up to {to} from {from}.": "看跌墙已从 {from} 上移至 {to}。",
  "The put wall has moved down to {to} from {from}.": "看跌墙已从 {from} 下移至 {to}。",
  "The call wall has moved up to {to} from {from}.": "看涨墙已从 {from} 上移至 {to}。",
  "The call wall has come down to {to} from {from}.": "看涨墙已从 {from} 下移至 {to}。",
  "The gamma flip has moved up to {to} from {from}.": "gamma 翻转点已从 {from} 上移至 {to}。",
  "The gamma flip has moved down to {to} from {from}.": "gamma 翻转点已从 {from} 下移至 {to}。",
  "Dealers' gamma at this price has grown {pct} in the hour, to {net} per 1% move.":
    "此价位做市商的 Gamma 一小时内增加了 {pct}，达到每 1% 波动 {net}。",
  "Dealers' gamma at this price has thinned {pct} in the hour, to {net} per 1% move.":
    "此价位做市商的 Gamma 一小时内减少了 {pct}，降至每 1% 波动 {net}。",
  "A new low for the UTC day at {price}.": "UTC 日内新低：{price}。",
  "A new high for the UTC day at {price}.": "UTC 日内新高：{price}。",
  "Quiet hour: price {spot}, with no gamma flip within 30% either way.":
    "平静的一小时：价格 {spot}，上下 30% 内没有 gamma 翻转点。",
  "Quiet hour: price {spot} sits right on the gamma flip at {flip}.":
    "平静的一小时：价格 {spot} 正处于 {flip} 的 gamma 翻转点上。",
  "Quiet hour: price {spot} holds {pct} above the gamma flip at {flip}.":
    "平静的一小时：价格 {spot} 稳在 {flip} 的 gamma 翻转点上方 {pct}。",
  "Quiet hour: price {spot} sits {pct} below the gamma flip at {flip}.":
    "平静的一小时：价格 {spot} 位于 {flip} 的 gamma 翻转点下方 {pct}。",
  "Levels: put wall {put} · flip {flip} · call wall {call}.":
    "关键价位：看跌墙 {put} · 翻转点 {flip} · 看涨墙 {call}。",
};
