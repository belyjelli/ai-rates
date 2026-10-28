import { msg } from "./i18n";

/**
 * Colour themes (owner, 2026-10-28: "theme color, day, night, solar, and a few more"). Every colour the
 * site draws comes from the custom properties on :root (layout.ts), so a theme is only a set of them,
 * applied as html[data-theme=...]. Night is the site as it was, and the default: a reader who never
 * chooses sees no change.
 *
 * The choice lives in localStorage ("theme") and is applied by THEME_HEAD_SCRIPT in the head, before
 * the body paints, so a page never flashes black before turning light. Charts read the properties when
 * they draw (kchart.ts, share.ts), so they follow the theme the page loaded with.
 */
export interface Theme {
  id: string;
  /** Marked for translation; shown through trMsg. */
  name: string;
  note: string;
  /** Light themes tell the browser so, for its scrollbars and form controls. */
  light: boolean;
  vars: Record<string, string>;
}

const NIGHT = {
  "--bg": "#000",
  "--band": "#0e0e0e",
  "--panel": "#0a0a0a",
  "--ink": "#d8d8d8",
  "--muted": "#7a7a7a",
  "--dim": "#494949",
  "--rule": "#242424",
  "--long": "#5f87ff",
  "--short": "#ff5f5f",
  "--zero": "#494949",
  "--accent": "#c8f5a8",
  "--warn": "#e5e500",
  "--em": "#b69cff",
  "--orange": "#ff9f43",
  "--cyan": "#5fd7ff",
  "--up": "#00ff88",
};

export const THEMES: readonly Theme[] = [
  {
    id: "night",
    name: msg("Night"),
    note: msg("Black terminal, the default"),
    light: false,
    vars: NIGHT,
  },
  {
    id: "day",
    name: msg("Day"),
    note: msg("Ink on white, for daylight"),
    light: true,
    vars: {
      "--bg": "#fbfbf8",
      "--band": "#efefea",
      "--panel": "#f5f5f1",
      "--ink": "#1c1c1e",
      "--muted": "#5f5f5f",
      "--dim": "#8c8c8c",
      "--rule": "#d9d9d2",
      "--long": "#2453d6",
      "--short": "#d02f2f",
      "--zero": "#9a9a9a",
      "--accent": "#1d7a35",
      "--warn": "#9a7300",
      "--em": "#6a46d4",
      "--orange": "#c25400",
      "--cyan": "#0a7ea4",
      "--up": "#13843c",
    },
  },
  {
    id: "solar",
    name: msg("Solar"),
    note: msg("Solarized light: warm paper, soft contrast"),
    light: true,
    vars: {
      "--bg": "#fdf6e3",
      "--band": "#eee8d5",
      "--panel": "#f6efdc",
      "--ink": "#073642",
      "--muted": "#586e75",
      "--dim": "#93a1a1",
      "--rule": "#e2dbc6",
      "--long": "#268bd2",
      "--short": "#dc322f",
      "--zero": "#93a1a1",
      "--accent": "#859900",
      "--warn": "#b58900",
      "--em": "#6c71c4",
      "--orange": "#cb4b16",
      "--cyan": "#2aa198",
      "--up": "#5f7a00",
    },
  },
  {
    id: "solar-dark",
    name: msg("Solar dark"),
    note: msg("Solarized dark: deep teal"),
    light: false,
    vars: {
      "--bg": "#002b36",
      "--band": "#073642",
      "--panel": "#03313c",
      "--ink": "#93a1a1",
      "--muted": "#839496",
      "--dim": "#586e75",
      "--rule": "#0e4351",
      "--long": "#268bd2",
      "--short": "#dc322f",
      "--zero": "#586e75",
      "--accent": "#2aa198",
      "--warn": "#b58900",
      "--em": "#6c71c4",
      "--orange": "#cb4b16",
      "--cyan": "#2aa198",
      "--up": "#859900",
    },
  },
  {
    id: "dusk",
    name: msg("Dusk"),
    note: msg("Slate blue, easy on the eyes at night"),
    light: false,
    vars: {
      "--bg": "#1b1f2a",
      "--band": "#232938",
      "--panel": "#1f2430",
      "--ink": "#d8dee9",
      "--muted": "#8a93a6",
      "--dim": "#5a6274",
      "--rule": "#2e3547",
      "--long": "#81a1c1",
      "--short": "#d36d76",
      "--zero": "#5a6274",
      "--accent": "#a3be8c",
      "--warn": "#ebcb8b",
      "--em": "#b48ead",
      "--orange": "#d08770",
      "--cyan": "#88c0d0",
      "--up": "#a3be8c",
    },
  },
  {
    id: "sepia",
    name: msg("Sepia"),
    note: msg("Old paper and brown ink"),
    light: true,
    vars: {
      "--bg": "#f4ecd8",
      "--band": "#eae0c6",
      "--panel": "#efe6cf",
      "--ink": "#3b2f20",
      "--muted": "#6b5b43",
      "--dim": "#9b8a6e",
      "--rule": "#d9ccae",
      "--long": "#2a5db0",
      "--short": "#b03a2e",
      "--zero": "#9b8a6e",
      "--accent": "#567619",
      "--warn": "#966800",
      "--em": "#7a4fa0",
      "--orange": "#a8550f",
      "--cyan": "#1f7a8c",
      "--up": "#4a7a12",
    },
  },
  {
    id: "phosphor",
    name: msg("Phosphor"),
    note: msg("Green screen, an old terminal"),
    light: false,
    vars: {
      "--bg": "#000",
      "--band": "#031103",
      "--panel": "#020b02",
      "--ink": "#3dff6e",
      "--muted": "#22b04a",
      "--dim": "#16702f",
      "--rule": "#0c3a17",
      "--long": "#62c8ff",
      "--short": "#ff6b6b",
      "--zero": "#16702f",
      "--accent": "#b4ffb4",
      "--warn": "#e5e500",
      "--em": "#7affd4",
      "--orange": "#ffb000",
      "--cyan": "#5fd7ff",
      "--up": "#3dff6e",
    },
  },
  {
    id: "contrast",
    name: msg("High contrast"),
    note: msg("White on black, brightest lines"),
    light: false,
    vars: {
      "--bg": "#000",
      "--band": "#101010",
      "--panel": "#080808",
      "--ink": "#fff",
      "--muted": "#d0d0d0",
      "--dim": "#9c9c9c",
      "--rule": "#5c5c5c",
      "--long": "#7ea6ff",
      "--short": "#ff7474",
      "--zero": "#9c9c9c",
      "--accent": "#baff80",
      "--warn": "#ffff3d",
      "--em": "#d4b4ff",
      "--orange": "#ffa64d",
      "--cyan": "#6fe3ff",
      "--up": "#3dff9e",
    },
  },
];

/** "system" follows the device: Day where it asks for light, Night otherwise. */
export const SYSTEM_THEME = "system";

/** "#abc" or "#aabbcc" as [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** `share` of `top` laid over `ground`, as a solid colour. */
function mix(top: string, ground: string, share: number): string {
  const a = rgb(top);
  const b = rgb(ground);
  return `#${a
    .map((v, i) =>
      Math.round(v * share + (b[i] ?? 0) * (1 - share))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * The colours the stylesheet works out from a theme's own: a row's hover, a raised panel's top, the solid grounds of long,
 * short, warning and ok badges, and the r,g,b of the colours its tints lay over the page at an alpha
 * (rgba(var(--long-rgb),.3)). Night's are written out on :root (layout.ts), as they were before themes;
 * every other theme's are mixed here, so a light theme's tints are light.
 */
function derived(vars: Record<string, string>): Record<string, string> {
  const v = (k: string) => vars[k] ?? (NIGHT as Record<string, string>)[k] ?? "#000";
  return {
    "--hover": mix(v("--ink"), v("--bg"), 0.1),
    "--raise": mix(v("--ink"), v("--bg"), 0.05),
    "--tint-long": mix(v("--long"), v("--bg"), 0.12),
    "--tint-short": mix(v("--short"), v("--bg"), 0.12),
    "--tint-warn": mix(v("--warn"), v("--bg"), 0.1),
    "--tint-ok": mix(v("--accent"), v("--bg"), 0.08),
    ...Object.fromEntries(
      ["--ink", "--long", "--short", "--accent", "--em"].map((k) => [
        `${k}-rgb`,
        rgb(v(k)).join(","),
      ]),
    ),
  };
}

/** The CSS for every theme but Night, which is :root's own (layout.ts). */
export const THEME_CSS = THEMES.filter((t) => t.id !== "night")
  .map(
    (t) =>
      `:root[data-theme="${t.id}"]{${Object.entries({ ...t.vars, ...derived(t.vars) })
        .map(([k, v]) => `${k}:${v}`)
        .join(";")}${t.light ? ";color-scheme:light" : ""}}`,
  )
  .join("\n");

/** Each theme's background, for the browser chrome's theme-color as the choice changes. */
const BACKGROUNDS = Object.fromEntries(THEMES.map((t) => [t.id, t.vars["--bg"] ?? "#000"]));

/**
 * In the head, before the body: the stored theme on <html>, and the browser chrome's colour. Unknown
 * or absent is Night, the stylesheet's own; a storage error (private mode, blocked) is Night too.
 * Exposed as window.airratesTheme so the settings page applies a choice the same way.
 */
export const THEME_HEAD_SCRIPT = `(()=>{const B=${JSON.stringify(BACKGROUNDS)};const apply=c=>{let t=c;if(t==="${SYSTEM_THEME}")t=matchMedia("(prefers-color-scheme: light)").matches?"day":"night";if(!B[t])t="night";const d=document.documentElement;if(t==="night")delete d.dataset.theme;else d.dataset.theme=t;const m=document.querySelector('meta[name="theme-color"]');m&&m.setAttribute("content",B[t]);return t};let c=null;try{c=localStorage.getItem("theme")}catch{}apply(c);window.airratesTheme=apply;if(c==="${SYSTEM_THEME}")try{matchMedia("(prefers-color-scheme: light)").addEventListener("change",()=>apply("${SYSTEM_THEME}"))}catch{}})();`;
