/**
 * The installed app's icon, drawn as pixels: the site's rail on black. A long marker (blue) and a short
 * marker (red) on a rule, the bar between them running long-to-short, and the zero tick at the middle,
 * as every rail on the site draws a spread. No text, so it reads at 48px on a home screen.
 *
 * Drawn here and encoded once by scripts/icons.ts into app-icons.generated.ts, so the Worker serves bytes
 * and never spends its CPU budget drawing. A test decodes those bytes and compares them with this.
 *
 * `maskable` keeps everything inside the middle 80%, the circle a launcher may crop the icon to.
 */
const BG: Rgb = [0, 0, 0];
const RULE: Rgb = [0x49, 0x49, 0x49];
const LONG: Rgb = [0x5f, 0x87, 0xff];
const SHORT: Rgb = [0xff, 0x5f, 0x5f];
const ACCENT: Rgb = [0xc8, 0xf5, 0xa8];

type Rgb = readonly [number, number, number];

export function drawIcon(size: number, maskable: boolean): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const fill = (x0: number, y0: number, x1: number, y1: number, color: (x: number) => Rgb) => {
    const ax = Math.max(0, Math.round(x0));
    const ay = Math.max(0, Math.round(y0));
    const bx = Math.min(size, Math.round(x1));
    const by = Math.min(size, Math.round(y1));
    for (let y = ay; y < by; y++) {
      for (let x = ax; x < bx; x++) {
        const [r, g, b] = color(x);
        const i = (y * size + x) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = 255;
      }
    }
  };
  const solid = (c: Rgb) => () => c;

  fill(0, 0, size, size, solid(BG));
  // The drawing sits in a square box: most of the icon, or the launcher's safe circle for maskable.
  const box = size * (maskable ? 0.62 : 0.84);
  const left = (size - box) / 2;
  const unit = box / 100;
  const at = (v: number) => left + v * unit;
  // The drawing runs from 30 units above the rail to 14 below it: centre that span, not the rail.
  const mid = size / 2 + 8 * unit;

  // The accent line the site's cards open with, above the rail.
  fill(at(0), mid - 30 * unit, at(100), mid - 26 * unit, solid(ACCENT));
  // The rule, and the zero tick.
  fill(at(0), mid - 1 * unit, at(100), mid + 1 * unit, solid(RULE));
  fill(at(50) - 1.2 * unit, mid - 14 * unit, at(50) + 1.2 * unit, mid + 14 * unit, solid(RULE));
  // The bar, long to short.
  const x0 = at(14);
  const x1 = at(86);
  const blend = (x: number): Rgb => {
    const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
    return [0, 1, 2].map((k) =>
      Math.round((LONG[k] as number) * (1 - t) + (SHORT[k] as number) * t),
    ) as unknown as Rgb;
  };
  fill(x0, mid - 4 * unit, x1, mid + 4 * unit, blend);
  // The two markers, square as on the site.
  fill(at(6), mid - 9 * unit, at(22), mid + 9 * unit, solid(LONG));
  fill(at(78), mid - 9 * unit, at(94), mid + 9 * unit, solid(SHORT));
  return px;
}

/** The icons the manifest lists. */
export const APP_ICONS = [
  { name: "192", size: 192, maskable: false },
  { name: "512", size: 512, maskable: false },
  { name: "maskable-512", size: 512, maskable: true },
] as const;
