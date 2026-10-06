import { describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";
import { handleApp } from "../app/app";
import type { DataSource } from "../app/data";
import { about } from "./about";
import { APP_ICONS, drawIcon } from "./app-icon";
import { DISMISS_DAYS, INSTALL_BLOCK, INSTALL_HEAD, installAsset, MANIFEST } from "./install";

const NOW = Date.parse("2026-10-06T10:00:00Z");
const overview = {
  markets: 100,
  venues: 10,
  assets: 50,
  open_interest_usd: 1e9,
  updated_at: new Date(NOW),
  sentiment_score: 30,
  sentiment_label: "fear",
};

/** Width, height and RGBA pixels of a PNG this site encodes: 8-bit RGBA, filter 0 on every row. */
function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let at = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (at < bytes.length) {
    const length = view.getUint32(at);
    const type = new TextDecoder().decode(bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      expect([...data.subarray(8, 10)]).toEqual([8, 6]);
    }
    if (type === "IDAT") idat.push(data);
    at += 12 + length;
  }
  const raw = new Uint8Array(inflateSync(Buffer.concat(idat)));
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (width * 4 + 1)]).toBe(0);
    rgba.set(raw.subarray(y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1)), y * width * 4);
  }
  return { width, height, rgba };
}

describe("installing the site as an app", () => {
  test("the manifest has what Chrome needs to offer an install", () => {
    expect(MANIFEST.name.length).toBeGreaterThan(0);
    expect(MANIFEST.short_name).toBe("airrates");
    expect(MANIFEST.display).toBe("standalone");
    expect(MANIFEST.start_url.startsWith("/")).toBe(true);
    const sizes = MANIFEST.icons.filter((i) => i.purpose === "any").map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(MANIFEST.icons.some((i) => i.purpose === "maskable")).toBe(true);
    // A launch from the installed app counts under its own source.
    expect(new URL(MANIFEST.start_url, "https://x.test").searchParams.get("ref")).toBe("app");
  });

  test("the manifest and every icon it lists are served, and need no data", async () => {
    const nothing = new Proxy({} as DataSource, {
      get: () => () => {
        throw new Error("the manifest and icons must not read the database");
      },
    });
    const get = (path: string) =>
      handleApp(new Request(`https://airates.test${path}`), { data: nothing, now: () => NOW });

    const manifest = await get("/manifest.webmanifest");
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("content-type")).toContain("application/manifest+json");
    expect(await manifest.json()).toEqual(JSON.parse(JSON.stringify(MANIFEST)));

    for (const icon of MANIFEST.icons) {
      const res = await get(icon.src);
      expect(res.status, icon.src).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      const png = decodePng(new Uint8Array(await res.arrayBuffer()));
      expect(`${png.width}x${png.height}`).toBe(icon.sizes);
    }
  });

  test("the served icons are the drawing: run scripts/icons.ts after changing app-icon.ts", async () => {
    for (const { name, size, maskable } of APP_ICONS) {
      const res = installAsset(`/icons/${name}.png`);
      expect(res, name).not.toBeNull();
      const png = decodePng(new Uint8Array(await (res as Response).arrayBuffer()));
      expect(png.width, name).toBe(size);
      expect(png.height, name).toBe(size);
      expect(Buffer.from(png.rgba).equals(Buffer.from(drawIcon(size, maskable))), name).toBe(true);
    }
  });

  test("a maskable icon keeps its drawing inside the middle 80%, the circle a launcher may crop to", () => {
    const size = 512;
    const px = drawIcon(size, true);
    const r = size * 0.4;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const drawn = (px[i] ?? 0) + (px[i + 1] ?? 0) + (px[i + 2] ?? 0) > 0;
        if (drawn) expect(Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2)).toBeLessThan(r);
      }
    }
    // And it is opaque everywhere, as a maskable icon must be.
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) throw new Error("transparent pixel");
  });

  test("an unknown icon or any other address is not an install asset", () => {
    expect(installAsset("/icons/1024.png")).toBeNull();
    expect(installAsset("/icons/../manifest.webmanifest")).toBeNull();
    expect(installAsset("/about")).toBeNull();
  });

  test("every page links the manifest", () => {
    expect(INSTALL_HEAD).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    const html = about({ overview, now: NOW });
    expect(html).toContain(INSTALL_HEAD);
  });
});

describe("the about page's install offer", () => {
  const html = about({ overview, now: NOW });

  test("sits on top of the title, and is hidden until the browser offers an install", () => {
    const block = html.indexOf('<div class="install" data-install hidden>');
    expect(block).toBeGreaterThan(-1);
    expect(block).toBeLessThan(html.indexOf("<h1>About airrates</h1>"));
  });

  test("carries the button, and on a phone a line of explanation and a way to dismiss it", () => {
    expect(INSTALL_BLOCK).toContain("data-install-go>Install app</button>");
    expect(INSTALL_BLOCK).toContain('data-install-dismiss aria-label="Not now"');
    expect(html).toContain(".install-text,.install-x{display:none}");
    expect(html).toContain("@media (max-width:640px){\n.install{margin:-12px -10px 12px}");
  });

  test("its script parses, waits for beforeinstallprompt, and never shows in an installed app", () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(INSTALL_BLOCK)?.[1] ?? "";
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('addEventListener("beforeinstallprompt"');
    expect(script).toContain("e.preventDefault()");
    expect(script).toContain("(display-mode: standalone)");
    expect(script).toContain('addEventListener("appinstalled"');
    expect(script).toContain(`${DISMISS_DAYS} * 864e5`);
    // The page never claims an install it cannot make: nothing shows unless the event arrived.
    expect(script).not.toMatch(
      /box\.hidden = false;[\s\S]*addEventListener\("beforeinstallprompt"/,
    );
  });
});
