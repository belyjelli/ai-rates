import type { LiquidationLevel, Outlook, TheoryReading } from "../app/outlook";
import { esc, formatApr, formatPrice, formatUsd } from "./format";
import { helpButton, helpPanel } from "./help";
import { tr } from "./i18n";

/**
 * The "Odds" tab: how far an asset can plausibly get in 4 hours, 6 hours, a day and a week, and
 * which liquidation theories are reading what.
 *
 * WHAT THE NUMBERS ARE. Every percentage in the first table is arithmetic on the asset's measured
 * volatility: the chance a driftless walk touches a level inside the horizon. The row that would be
 * a direction call, "closes higher", reads 50% because no theory has passed its test
 * and the weights that would let one move it are all zero (app/outlook.ts). The page says that where
 * the reader looks, rather than leaving a round number to be taken for a forecast.
 *
 * THE LEVELS ARE WHERE FORCED CLOSES HAPPENED. Those positions are gone: the collector keeps no open
 * interest by price, so the resting map the magnet theory needs does not exist, and its row says so.
 */

const MINUS = "−";

/** "<0.1%", "3.4%", "27%", ">99%": small odds keep a decimal, large ones do not pretend to one. */
export function oddsText(probability: number | null): string {
  if (probability === null || !Number.isFinite(probability)) return "–";
  if (probability < 0.001) return "<0.1%";
  if (probability > 0.995) return ">99%";
  const percent = probability * 100;
  return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

const percentText = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;

const signedPercent = (fraction: number, digits = 1) =>
  `${fraction < 0 ? MINUS : "+"}${(Math.abs(fraction) * 100).toFixed(digits)}%`;

function horizonName(id: string): string {
  switch (id) {
    case "4h":
      return tr("4 hours");
    case "6h":
      return tr("6 hours");
    case "1d":
      return tr("1 day");
    default:
      return tr("1 week");
  }
}

function levelLabel(level: LiquidationLevel): string {
  const where = `${level.side === "below" ? MINUS : "+"}${percentText(level.distance)}`;
  const price = `${level.open ? "≥ " : ""}${formatPrice(level.price)}`;
  return tr("{price} ({where}) · {usd} closed, {share} of the window", {
    price,
    where,
    usd: formatUsd(level.usd),
    share: percentText(level.share, 0),
  });
}

function readingName(id: TheoryReading["id"]): string {
  switch (id) {
    case "burst":
      return tr("Forced-close burst fades");
    case "crowding":
      return tr("Funding crowding fades");
    case "stretch":
      return tr("Stretch from the 50-hour average fades");
    case "absorption":
      return tr("Initiative vs absorption");
    case "sentiment":
      return tr("Fear and greed");
    default:
      return tr("Liquidation magnet");
  }
}

function readingText(reading: TheoryReading): string {
  const { id, value, detail } = reading;
  if (id === "magnet") {
    return tr(
      "Needs open positions by price level. The collector keeps closed ones only, so this cannot be read yet.",
    );
  }
  if (value === null) {
    return id === "burst"
      ? tr("Fewer than 5 forced closes in the last 4 hours: too thin to call a burst.")
      : tr("Not enough data.");
  }
  switch (id) {
    case "burst": {
      const longs = (value + 1) / 2;
      return tr("{longs} of the last 4 hours' forced closes were longs ({usd} in all)", {
        longs: percentText(longs, 0),
        usd: formatUsd(detail),
      });
    }
    case "crowding":
      return tr("{apr} a year funding, weighted by open interest", { apr: formatApr(value) });
    case "stretch":
      return value >= 0
        ? tr("{sigma} bar-sigmas above its 50-hour average", { sigma: value.toFixed(1) })
        : tr("{sigma} bar-sigmas below its 50-hour average", {
            sigma: Math.abs(value).toFixed(1),
          });
    case "absorption": {
      const flow =
        value >= 0
          ? tr("takers net buying {pct} of volume", { pct: percentText(value, 0) })
          : tr("takers net selling {pct} of volume", { pct: percentText(-value, 0) });
      return detail === null
        ? flow
        : tr("{flow}, price {change} over 4 hours", { flow, change: signedPercent(detail, 2) });
    }
    default:
      return tr("{score} out of 100", { score: Math.round(value) });
  }
}

function leanText(reading: TheoryReading): string {
  if (reading.score === null) return "–";
  if (Math.abs(reading.score) < 0.1) return tr("flat");
  return reading.score > 0 ? `↑ ${tr("up")}` : `↓ ${tr("down")}`;
}

function statusText(reading: TheoryReading): string {
  switch (reading.status) {
    case "unvalidated":
      return tr("No. Not yet tested, so it carries no weight.");
    case "context":
      return tr("No. Context only: its claim never leans.");
    default:
      return tr("No. Cannot be computed.");
  }
}

export function outlookPanel(data: {
  label: string;
  outlook: Outlook | null;
  window: string;
  picker: string;
}): string {
  const { label, outlook, window, picker } = data;
  const shown = esc(label);
  if (outlook === null) {
    return `<div class="lq-controls">${picker}</div>
<p class="empty">${tr(
      "There is not yet enough price history for {asset} to size its moves, or no live market is publishing a mark. The odds need at least 12 hours of closes.",
      { asset: shown },
    )}</p>`;
  }

  const { horizons, levels, readings, volatility } = outlook;
  const heading = horizons
    .map((horizon) => `<th class="num" scope="col">${horizonName(horizon.id)}</th>`)
    .join("");
  const row = (name: string, cells: string[], className = "") =>
    `<tr${className ? ` class="${className}"` : ""}><th class="asset" scope="row">${name}</th>${cells
      .map((cell) => `<td class="num">${cell}</td>`)
      .join("")}</tr>`;
  const section = (name: string) =>
    `<tr class="lq-grp"><th class="asset" scope="colgroup" colspan="${horizons.length + 1}">${name}</th></tr>`;

  const rows: string[] = [];
  rows.push(
    row(
      tr("Typical move (1 sigma)"),
      horizons.map((horizon) => `±${percentText(horizon.sigma, horizon.sigma < 0.1 ? 1 : 0)}`),
    ),
  );
  rows.push(
    row(
      tr("Closes higher than now"),
      horizons.map((horizon) => oddsText(horizon.up)),
      "lq-mark",
    ),
  );

  if (levels.below || levels.above) {
    rows.push(section(tr("Reaches the heaviest forced-close level")));
    if (levels.above) {
      rows.push(
        row(
          `↑ ${levelLabel(levels.above)}`,
          horizons.map((horizon) => oddsText(horizon.touchAbove)),
        ),
      );
    }
    if (levels.below) {
      rows.push(
        row(
          `↓ ${levelLabel(levels.below)}`,
          horizons.map((horizon) => oddsText(horizon.touchBelow)),
        ),
      );
    }
  }
  if (levels.above && levels.below) {
    rows.push(section(tr("Whichever of those two it reaches first")));
    rows.push(
      row(
        tr("The upper one first"),
        horizons.map((horizon) => oddsText(horizon.first?.above ?? null)),
      ),
    );
    rows.push(
      row(
        tr("The lower one first"),
        horizons.map((horizon) => oddsText(horizon.first?.below ?? null)),
      ),
    );
    rows.push(
      row(
        tr("Neither"),
        horizons.map((horizon) => oddsText(horizon.first?.neither ?? null)),
      ),
    );
  }
  rows.push(section(tr("Reaches a move of")));
  const moves = horizons[0]?.moves ?? [];
  moves.forEach((move, index) => {
    rows.push(
      row(
        `±${move.pct}%`,
        horizons.map((horizon) => {
          const at = horizon.moves[index];
          return at ? `↑ ${oddsText(at.above)} · ↓ ${oddsText(at.below)}` : "–";
        }),
      ),
    );
  });

  const table = `<div class="heat-wrap lq-box"><table class="heat lq lq-odds">
<thead><tr><th class="asset" scope="col">${tr("Within")}</th>${heading}</tr></thead>
<tbody>${rows.join("\n")}</tbody>
</table></div>`;

  const theories = readings
    .map(
      (reading) =>
        `<tr><th class="asset" scope="row">${readingName(reading.id)}</th><td>${readingText(
          reading,
        )}</td><td class="num">${leanText(reading)}</td><td>${statusText(reading)}</td></tr>`,
    )
    .join("\n");
  const theoryTable = `<div class="heat-wrap lq-box"><table class="heat lq lq-theories">
<thead><tr><th class="asset" scope="col">${tr("Theory")}</th><th scope="col">${tr("Reading now")}</th><th class="num" scope="col">${tr("Leans")}</th><th scope="col">${tr("Moves the odds?")}</th></tr></thead>
<tbody>${theories}</tbody>
</table></div>`;

  const hours = Math.round(volatility.spanHours);
  return `<div class="lq-controls">${picker}${helpButton("liq-odds")}</div>
${helpPanel(
  "liq-odds",
  `<p>${tr(
    "These are the odds that <b>{asset}</b> reaches a price within each horizon, worked out from how far it has actually been moving: about {hourly} an hour over the last {hours} hours. They are not a forecast of direction.",
    { asset: shown, hourly: percentText(volatility.perSqrtHour, 2), hours },
  )}</p><p>${tr(
    "The levels are where the most dollars were force-closed in the last {window}. Those positions are gone, so a heavy level is somewhere price has been, not fuel waiting for it. The collector does not keep open positions by price, so the resting map a liquidation magnet needs cannot be built yet.",
    { window: esc(window) },
  )}</p><p>${tr(
    "Real prices have fatter tails than this model assumes, so the far levels are reached more often than shown. Volatility is measured over the recent past and held constant.",
  )}</p>`,
)}
<p class="notes">${tr(
    "Odds of reaching a level, from {asset}'s own volatility. They say how far it can go, not which way. The chance of closing higher stays at 50% until a theory below passes a test set in advance, after costs.",
    { asset: shown },
  )}</p>
${table}
<h3>${tr("What the liquidation theories read now")}</h3>
${theoryTable}
<p class="notes">${tr(
    "A reading that leans one way is a hypothesis, not a signal: none of these has been shown to beat the base rate. The first three are measured against a fade, the way their test was written down in advance, and a flat reading leans nowhere.",
  )}</p>`;
}
