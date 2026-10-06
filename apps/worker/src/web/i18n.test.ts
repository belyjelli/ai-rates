import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  acceptedLocale,
  type Catalog,
  currentLocale,
  htmlLang,
  LANG_COOKIE,
  LOCALES,
  languageSwitch,
  msg,
  parseLocale,
  requestLocale,
  scriptStrings,
  tr,
  trMsg,
  withLocale,
} from "./i18n";
import { parseShown } from "./live";
import { ZH_PARTS, zh } from "./locales/zh";

/** apps/worker/src: every file a page's text can come from. */
const SRC = join(import.meta.dir, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "locales" ? [] : sourceFiles(path);
    return entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      path !== join(import.meta.dir, "i18n.ts")
      ? [path]
      : [];
  });
}

/** A JS double-quoted literal's contents back to the string it means. */
const unquote = (raw: string): string => JSON.parse(`"${raw.replaceAll("\\'", "'")}"`) as string;

/** Every key the source asks for, and every call that does not pass a literal (which is a bug). */
function extract(): { keys: Map<string, string>; dynamic: string[] } {
  const keys = new Map<string, string>();
  const dynamic: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8");
    const where = (index: number) =>
      `${relative(SRC, file)}:${text.slice(0, index).split("\n").length}`;
    for (const call of text.matchAll(/\b(?:tr|msg)\(\s*/g)) {
      const start = call.index + call[0].length;
      // Double quotes as written, or single quotes where Biome prefers them (a key holding markup
      // with attribute quotes is printed that way).
      const literal =
        /^"((?:[^"\\\n]|\\.)*)"/.exec(text.slice(start)) ??
        /^'((?:[^'\\\n]|\\.)*)'/.exec(text.slice(start));
      if (!literal) {
        dynamic.push(where(call.index));
        continue;
      }
      const raw = literal[1] ?? "";
      const key = literal[0].startsWith("'") ? unquote(raw.replaceAll('"', '\\"')) : unquote(raw);
      if (!keys.has(key)) keys.set(key, where(call.index));
    }
  }
  return { keys, dynamic };
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
/** The tags in a string, in order of appearance sorted away: a translation may move them, not change them. */
const markup = (text: string) => [...text.matchAll(/<[^>]*>/g)].map((m) => m[0]).sort();
/** An "&" that does not start an entity, which an HTML parser would have to guess about. */
const bareAmpersand = (text: string) => /&(?!#?\w+;)/.test(text);

/** Languages whose catalog must cover every key. A language being translated stays out until done. */
const COMPLETE: Readonly<Record<string, Catalog>> = { zh };

describe("catalogs", () => {
  const { keys, dynamic } = extract();

  test("every tr() and msg() passes a string literal", () => {
    expect(dynamic).toEqual([]);
  });

  test("the source has keys to translate", () => {
    expect(keys.size).toBeGreaterThan(0);
  });

  for (const [locale, catalog] of Object.entries(COMPLETE)) {
    test(`${locale}: every key is translated`, () => {
      const missing = [...keys].filter(([key]) => !Object.hasOwn(catalog, key));
      expect(missing.map(([key, where]) => `${where}  ${key}`)).toEqual([]);
    });

    test(`${locale}: no translation is left over from a key the source no longer uses`, () => {
      expect(Object.keys(catalog).filter((key) => !keys.has(key))).toEqual([]);
    });

    test(`${locale}: placeholders and markup match the English`, () => {
      const wrong = Object.entries(catalog).filter(
        ([key, value]) =>
          placeholders(key).join() !== placeholders(value).join() ||
          markup(key).join() !== markup(value).join(),
      );
      expect(wrong).toEqual([]);
    });

    test(`${locale}: no double quote the English does not have, since many keys sit in attributes`, () => {
      const wrong = Object.entries(catalog).filter(
        ([key, value]) => !key.includes('"') && value.includes('"'),
      );
      expect(wrong).toEqual([]);
    });

    test(`${locale}: every "&" is an entity, as in the English`, () => {
      expect(Object.entries(catalog).filter(([, value]) => bareAmpersand(value))).toEqual([]);
    });
  }

  test("zh: no two parts translate one key differently", () => {
    const seen = new Map<string, { part: string; value: string }>();
    const clashes: string[] = [];
    for (const [part, catalog] of Object.entries(ZH_PARTS)) {
      for (const [key, value] of Object.entries(catalog)) {
        const before = seen.get(key);
        if (before && before.value !== value)
          clashes.push(`${key}: ${before.part} "${before.value}" vs ${part} "${value}"`);
        if (!before) seen.set(key, { part, value });
      }
    }
    expect(clashes).toEqual([]);
  });
});

test("live refresh reads every language's word for a flat momentum as zero", () => {
  for (const catalog of [{}, ...Object.values(COMPLETE)]) {
    expect(parseShown(catalog.flat ?? "flat")).toBe(0);
  }
});

describe("tr", () => {
  test("English outside any render, and the key itself", () => {
    expect(currentLocale()).toBe("en");
    expect(tr("Widest spreads")).toBe("Widest spreads");
  });

  test("fills placeholders, and leaves one with no value visible", () => {
    expect(tr("Long on {venue}", { venue: "OKX" })).toBe("Long on OKX");
    expect(trMsg("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });

  test("withLocale scopes the language to the call and restores it", () => {
    const inside = withLocale("zh", () => [currentLocale(), htmlLang()]);
    expect(inside).toEqual(["zh", "zh-Hans"]);
    expect(currentLocale()).toBe("en");
    expect(() =>
      withLocale("zh", () => {
        throw new Error("render failed");
      }),
    ).toThrow("render failed");
    expect(currentLocale()).toBe("en");
  });

  test("a key a catalog lacks falls back to English", () => {
    expect(withLocale("zh", () => trMsg("a sentence no catalog has"))).toBe(
      "a sentence no catalog has",
    );
  });

  test("msg marks without translating", () => {
    expect(withLocale("zh", () => msg("spreads"))).toBe("spreads");
  });
});

describe("choosing a language", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://airates.test/", { headers });

  test("parses tags and cookie values", () => {
    expect(parseLocale("zh")).toBe("zh");
    expect(parseLocale("zh-CN")).toBe("zh");
    expect(parseLocale("ZH_tw")).toBe("zh");
    expect(parseLocale("en-GB")).toBe("en");
    expect(parseLocale("fr")).toBeNull();
    expect(parseLocale("")).toBeNull();
  });

  test("Accept-Language: by quality, then order; English ranked first stays English", () => {
    expect(acceptedLocale("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(acceptedLocale("en-US,en;q=0.9,zh-CN;q=0.8")).toBe("en");
    expect(acceptedLocale("fr-FR,zh;q=0.5")).toBe("zh");
    expect(acceptedLocale("en;q=0.2,zh;q=0.7")).toBe("zh");
    expect(acceptedLocale("fr,de")).toBeNull();
    expect(acceptedLocale("zh;q=0")).toBeNull();
    expect(acceptedLocale(null)).toBeNull();
  });

  test("the cookie beats the browser, and English is the default", () => {
    expect(requestLocale(request({ "accept-language": "zh-CN" }))).toBe("zh");
    expect(
      requestLocale(request({ "accept-language": "zh-CN", cookie: `a=1; ${LANG_COOKIE}=en` })),
    ).toBe("en");
    expect(requestLocale(request({ cookie: `${LANG_COOKIE}=zh` }))).toBe("zh");
    expect(requestLocale(request({ cookie: `${LANG_COOKIE}=xx` }))).toBe("en");
    expect(requestLocale(request({}))).toBe("en");
  });

  test("every language is listed once and English comes first", () => {
    expect(LOCALES[0]).toBe("en");
    expect(new Set(LOCALES).size).toBe(LOCALES.length);
  });
});

describe("languageSwitch", () => {
  const go = (path: string) => languageSwitch(new Request(`https://airates.test${path}`));

  test("sets the cookie and returns to the page, query and all", () => {
    const res = go(`/lang/zh?back=${encodeURIComponent("/screener?min_oi=0&types=cex")}`);
    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe("/screener?min_oi=0&types=cex");
    expect(res?.headers.get("set-cookie")).toContain(`${LANG_COOKIE}=zh; Path=/`);
    expect(res?.headers.get("cache-control")).toBe("no-store");
  });

  test("never redirects off the site", () => {
    for (const back of ["//evil.example/x", "/\\evil.example", "https://evil.example", "x", ""]) {
      expect(go(`/lang/en?back=${encodeURIComponent(back)}`)?.headers.get("location")).toBe("/");
    }
  });

  test("an unknown language sets nothing; other paths are not the switch", () => {
    const res = go("/lang/xx?back=/rates");
    expect(res?.headers.get("location")).toBe("/rates");
    expect(res?.headers.get("set-cookie")).toBeNull();
    expect(go("/language")).toBeNull();
    expect(go("/rates")).toBeNull();
  });
});

describe("scriptStrings", () => {
  test("cannot close the script element it is inlined into", () => {
    const out = scriptStrings({ a: "</script><b>", b: "line break" });
    expect(out.toLowerCase()).not.toContain("</script");
    expect(out).not.toContain(" ");
    expect(new Function(`return ${out}`)()).toEqual({ a: "</script><b>", b: "line break" });
  });
});
