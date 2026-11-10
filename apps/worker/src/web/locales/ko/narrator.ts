import type { Catalog } from "../../i18n";

/**
 * The market narrator in the masthead and its two /settings rows (web/narrator.ts, web/settings.ts),
 * in Korean. Terms as on the Gamma Exposure tab (gamma.ts): the flip, the call and put walls.
 */
export const narrator: Catalog = {
  "Market narrator": "마켓 내레이터",
  "{n} entries": "{n}개 항목",
  "Nothing to say yet: the narrator writes when the {book} option book moves.":
    "아직 할 말이 없습니다: {book} 옵션 북이 움직이면 내레이터가 씁니다.",
  "The narrator could not be read just now.": "지금은 내레이터를 불러올 수 없습니다.",
  "The running commentary between the header and the menu: where price sits against the gamma flip and the walls of the BTC and ETH option books, written as they move. Open, folded to one line, or off.":
    "헤더와 메뉴 사이의 실시간 해설: BTC와 ETH 옵션 북에서 가격이 감마 플립과 월 대비 어디에 있는지, 움직일 때마다 씁니다. 펼침, 한 줄로 접기, 끄기 중에서 고릅니다.",
  expanded: "펼침",
  collapsed: "접힘",
  "Narrator typing": "내레이터 타이핑",
  "Each new line types itself out. Off shows it whole at once.":
    "새 줄이 한 글자씩 타이핑됩니다. 끄면 한 번에 전부 보여 줍니다.",
  on: "켜기",
  "Price is now below the gamma flip at {flip}: dealers are short gamma here, so their hedging adds to moves.":
    "가격이 {flip}의 감마 플립 아래로 내려왔습니다: 여기서는 딜러가 숏 감마라 헤지가 움직임을 키웁니다.",
  "Price is now below the gamma flip at {flip}.": "가격이 {flip}의 감마 플립 아래로 내려왔습니다.",
  "Price is now above the gamma flip at {flip}.": "가격이 {flip}의 감마 플립 위로 올라왔습니다.",
  "Price is back above the gamma flip at {flip}: dealers are long gamma here, so their hedging damps moves.":
    "가격이 {flip}의 감마 플립 위로 돌아왔습니다: 여기서는 딜러가 롱 감마라 헤지가 움직임을 줄입니다.",
  "Price has slipped onto the gamma flip at {flip}: nothing resolves until it holds or gives.":
    "가격이 {flip}의 감마 플립까지 밀려 내려왔습니다: 버티거나 무너질 때까지 결론이 나지 않습니다.",
  "Price has climbed back to the gamma flip at {flip} from below.":
    "가격이 아래에서 {flip}의 감마 플립까지 다시 올라왔습니다.",
  "Price has broken below the put wall at {wall}: no floor left underneath.":
    "가격이 {wall}의 풋 월을 깨고 내려갔습니다: 아래에 남은 바닥이 없습니다.",
  "Price has broken above the call wall at {wall}: no ceiling left overhead.":
    "가격이 {wall}의 콜 월을 뚫고 올라갔습니다: 위에 남은 천장이 없습니다.",
  "Price is testing the put wall at {wall} for the first time today.":
    "가격이 오늘 처음으로 {wall}의 풋 월을 시험하고 있습니다.",
  "Price is back at the put wall at {wall}: test {n} today.":
    "가격이 다시 {wall}의 풋 월에 왔습니다: 오늘 {n}번째 시험.",
  "Price is testing the call wall at {wall} for the first time today.":
    "가격이 오늘 처음으로 {wall}의 콜 월을 시험하고 있습니다.",
  "Price is back at the call wall at {wall}: test {n} today.":
    "가격이 다시 {wall}의 콜 월에 왔습니다: 오늘 {n}번째 시험.",
  "The put wall has moved up to {to} from {from}.": "풋 월이 {from}에서 {to}(으)로 올라갔습니다.",
  "The put wall has moved down to {to} from {from}.": "풋 월이 {from}에서 {to}(으)로 내려갔습니다.",
  "The call wall has moved up to {to} from {from}.": "콜 월이 {from}에서 {to}(으)로 올라갔습니다.",
  "The call wall has come down to {to} from {from}.": "콜 월이 {from}에서 {to}(으)로 내려왔습니다.",
  "The gamma flip has moved up to {to} from {from}.":
    "감마 플립이 {from}에서 {to}(으)로 올라갔습니다.",
  "The gamma flip has moved down to {to} from {from}.":
    "감마 플립이 {from}에서 {to}(으)로 내려갔습니다.",
  "Dealers' gamma at this price has grown {pct} in the hour, to {net} per 1% move.":
    "이 가격에서 딜러의 감마가 한 시간 동안 {pct} 늘어 1% 변동당 {net} 규모가 되었습니다.",
  "Dealers' gamma at this price has thinned {pct} in the hour, to {net} per 1% move.":
    "이 가격에서 딜러의 감마가 한 시간 동안 {pct} 줄어 1% 변동당 {net} 규모가 되었습니다.",
  "A new low for the UTC day at {price}.": "UTC 기준 오늘의 신저가: {price}.",
  "A new high for the UTC day at {price}.": "UTC 기준 오늘의 신고가: {price}.",
  "Quiet hour: price {spot}, with no gamma flip within 30% either way.":
    "조용한 한 시간: 가격 {spot}, 위아래 30% 안에 감마 플립이 없습니다.",
  "Quiet hour: price {spot} sits right on the gamma flip at {flip}.":
    "조용한 한 시간: 가격 {spot}, {flip}의 감마 플립에 딱 걸쳐 있습니다.",
  "Quiet hour: price {spot} holds {pct} above the gamma flip at {flip}.":
    "조용한 한 시간: 가격 {spot}, {flip}의 감마 플립보다 {pct} 위에서 버티고 있습니다.",
  "Quiet hour: price {spot} sits {pct} below the gamma flip at {flip}.":
    "조용한 한 시간: 가격 {spot}, {flip}의 감마 플립보다 {pct} 아래에 있습니다.",
  "Levels: put wall {put} · flip {flip} · call wall {call}.":
    "레벨: 풋 월 {put} · 플립 {flip} · 콜 월 {call}.",
};
