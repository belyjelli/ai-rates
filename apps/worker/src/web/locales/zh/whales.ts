import type { Catalog } from "../../i18n";

/**
 * /whales (web/whales.ts), its route's 404 (app/app.ts) and its nav and hotkey label.
 *
 * Terms: whale orders 巨鲸挂单, wall 挂单墙 (bid wall 买单墙, ask wall 卖单墙), resting 挂单中,
 * filled 已成交, pulled 已撤单. 挂单 is the glossary's maker, which is what a resting order is.
 */
export const whales: Catalog = {
  "{asset} is not one of the forty markets tracked.": "{asset} 不在追踪的四十个市场之内。",
  whales: "巨鲸挂单",
  bid: "买单",
  ask: "卖单",
  resting: "挂单中",
  filled: "已成交",
  pulled: "已撤单",
  "lost track": "跟踪中断",
  "{n}m": "{n}分",
  "{d}d {h}h": "{d}天{h}小时",
  "{side} wall {price} · {size} · {status} · {lived}":
    "{side}墙 {price} · {size} · {status} · {lived}",
  "{asset} · Binance perp · {n}-hour bars, UTC": "{asset} · Binance 永续合约 · {n} 小时 K 线，UTC",
  "{asset} · Binance perp · {n}-minute bars, UTC":
    "{asset} · Binance 永续合约 · {n} 分钟 K 线，UTC",
  "bid wall (buy orders)": "买单墙（买入挂单）",
  "ask wall (sell orders)": "卖单墙（卖出挂单）",
  "faded: filled or pulled": "变淡：已成交或已撤单",
  "last price": "最新价",
  Markets: "市场",
  "hide pulled walls": "隐藏已撤单的挂单墙",
  "show pulled walls": "显示已撤单的挂单墙",
  "Bid walls resting": "挂单中的买单墙",
  "{n} buy walls below the price": "价格下方 {n} 道买单墙",
  "Ask walls resting": "挂单中的卖单墙",
  "{n} sell walls above the price": "价格上方 {n} 道卖单墙",
  "Largest wall": "最大挂单墙",
  "{side} at {price}": "{side}，价格 {price}",
  "none resting": "暂无挂单",
  "Pulled in {window}": "{window} 内撤单",
  "cancelled before the price reached them; {n} filled": "在价格触及前撤销；{n} 道已成交",
  "No candles for {asset} yet. The collector backfills three days within a minute of a market joining the set.":
    "{asset} 暂无 K 线。市场加入追踪后，采集器会在一分钟内补齐三天数据。",
  Side: "方向",
  "From the last price": "相对最新价",
  Distance: "距离",
  Size: "规模",
  "The most it has held": "曾达到的最大规模",
  Peak: "峰值",
  "Since the collector first saw it": "自采集器首次看到起",
  "Resting since": "挂单时长",
  "No wall is resting in {asset}'s book right now.": "{asset} 的订单簿中目前没有挂单墙。",
  Lived: "存续",
  Ended: "结束于",
  How: "结局",
  "No wall ended in the last {window}.": "过去 {window} 内没有挂单墙结束。",
  "Large resting limit orders in Binance's USD-M book for {asset}: one price level holding at least {floor} for at least a minute. A {bid} is buy orders below the price, an {ask} sell orders above it. Each line runs from when the collector first saw the wall to when it went, and is thicker the bigger it is.":
    "{asset} 在 Binance U 本位合约订单簿中的大额挂单：单一价位至少挂有 {floor}，且持续至少一分钟。{bid}是价格下方的买入挂单，{ask}是价格上方的卖出挂单。每条线从采集器首次看到该挂单墙开始，到其消失为止；挂单墙越大，线越粗。",
  "bid wall": "买单墙",
  "ask wall": "卖单墙",
  "A wall that ends is filled if the price reached it and pulled if it was cancelled first. Pulled walls are hidden by default: most are spoofs or quotes moving with the price. Walls are a snapshot of visible liquidity, not a floor or a ceiling, and not a forecast; any of them can be gone the moment the price gets near.":
    "挂单墙消失时，若价格已触及则记为已成交，若在此之前被撤销则记为已撤单。已撤单的挂单墙默认隐藏：其中多数是虚假挂单或随价格移动的报价。挂单墙只是可见流动性的快照，不是底部或顶部，也不是预测；价格一旦接近，任何挂单墙都可能瞬间消失。",
  "The forty markets are the top forty by open interest summed across every exchange we collect, read on Binance. The floor scales with that open interest. After every collector restart the book relearns levels far from the price as they change, so the oldest far walls can take an hour or two to reappear.":
    "这四十个市场是按我们采集的所有交易所合计持仓量排名前四十的资产，在 Binance 上读取。门槛随持仓量缩放。采集器每次重启后，订单簿会在远离价格的价位发生变化时重新学习它们，因此最早的远端挂单墙可能需要一两个小时才会重新出现。",
  "Whale orders": "巨鲸挂单",
  "whale orders": "巨鲸挂单",
  "Large resting limit orders in Binance futures order books, drawn over the price: where they sit, how big, and whether they were filled or pulled.":
    "Binance 合约订单簿中的大额挂单，叠加在价格之上：位置、规模，以及是否已成交或已撤单。",
  "The whale-order feed has not ranked its markets yet. It does so within a few minutes of starting.":
    "巨鲸挂单数据源尚未完成市场排名，通常在启动后几分钟内完成。",
  "Resting now": "当前挂单",
  "Every wall in the book right now, largest first. Distance is from the last price; size is what the level holds now, peak the most it has held.":
    "订单簿中当前的全部挂单墙，按规模从大到小排列。距离相对最新价；规模是该价位当前的挂单量，峰值是曾达到的最大值。",
  "Ended in the last {window}": "过去 {window} 内结束",
};
