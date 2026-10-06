/**
 * The languages the site is read in, and the few functions every page's text goes through.
 *
 * HOW A STRING IS TRANSLATED. Templates keep their English inline, wrapped: `tr("Widest spreads")`,
 * `tr("Long on {venue}", { venue })`. The English IS the key: each language's catalog maps it to that
 * language, and a string a catalog lacks is shown in English rather than as a blank or a key name. So
 * a page reads in the template exactly as it reads to an English reader, and adding a language is one
 * catalog under `locales/` plus one line in LOCALES -- nothing in the templates changes.
 *
 * The cost of English-as-key is that editing an English string orphans its translations. i18n.test.ts
 * is what pays it: it reads every `tr("...")` and `msg("...")` in the source and fails on a key a
 * catalog is missing, a catalog entry nothing uses any more, and a translation whose placeholders or
 * markup differ from its English. Which is also why `tr` takes ONLY a string literal: a key built at
 * run time cannot be found by reading the source. A string that must live in a constant is marked
 * with `msg` where it is written and translated with `trMsg` where it is shown.
 *
 * Values are inserted as given, never escaped here: a template already decides what is markup (a
 * venue link) and what is text (`esc(symbol)`), and a translation is our own file, not input.
 *
 * WHY A SCOPE AND NOT A PARAMETER. The language would otherwise have to be threaded through every
 * render function and every helper beneath them -- `since`, the table builders, the chart readouts.
 * Instead `withLocale` sets it for one SYNCHRONOUS call, and every page render is one: the route reads
 * its data first and then builds a single string. JavaScript cannot interleave another request inside
 * a synchronous call, so two readers rendering in two languages at once can never see each other's.
 * The types keep it that way: app.ts's `page` takes `() => string`, so a render that became async
 * would fail to compile rather than quietly render half a page in English.
 *
 * HOW THE LANGUAGE IS CHOSEN, in order: the `lang` cookie the footer switch sets, so a choice sticks;
 * else the first language the browser's Accept-Language asks for that the site has; else English.
 * index.ts puts the result in the page cache's key, so one language's copy is never served to another.
 */

import { zh } from "./locales/zh";

/** Every language the site renders. The first is the default, and the source language of every key. */
export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/**
 * How each language names itself in the footer switch -- always in its own script, since a reader
 * looking for their language cannot be expected to read the current one -- and its `<html lang>`.
 * Chinese is Simplified, so the tag says so: a Traditional reader's browser picks fonts by it.
 */
export const LOCALE_INFO: Readonly<Record<Locale, { name: string; htmlLang: string }>> = {
  en: { name: "English", htmlLang: "en" },
  zh: { name: "中文", htmlLang: "zh-Hans" },
};

/** English text to its translation. English itself has an empty one: every key is its own English. */
export type Catalog = Readonly<Record<string, string>>;

const CATALOGS: Readonly<Record<Locale, Catalog>> = { en: {}, zh };

let active: Locale = DEFAULT_LOCALE;

/** Runs one synchronous render in `locale`, and puts the previous language back after it. */
export function withLocale<T>(locale: Locale, render: () => T): T {
  const previous = active;
  active = locale;
  try {
    return render();
  } finally {
    active = previous;
  }
}

/** The language the current render is in. English outside any render, which is what tests see. */
export const currentLocale = (): Locale => active;

/** `<html lang>` for the current render. */
export const htmlLang = (): string => LOCALE_INFO[active].htmlLang;

/**
 * Translates a string literal, filling `{name}` placeholders from `values`. A placeholder with no
 * value is left as written, so a missing argument shows up on the page instead of vanishing.
 */
export function tr(english: string, values?: Readonly<Record<string, string | number>>): string {
  return trMsg(english, values);
}

/**
 * Marks a string literal as a key without translating it, for text kept in a constant (the nav's
 * labels, a table of options) that is translated later, at render time, with `trMsg`.
 */
export const msg = (english: string): string => english;

/** Translates a key that was marked with `msg`. Only for keys that went through `msg` or `tr`. */
export function trMsg(english: string, values?: Readonly<Record<string, string | number>>): string {
  const text = CATALOGS[active][english] ?? english;
  return values ? fill(text, values) : text;
}

function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
}

/**
 * Strings for an inline browser script, as an object literal that is safe inside `<script>`: no
 * `</script>` can close the element early, and no line separator can break the statement.
 */
export function scriptStrings(strings: Readonly<Record<string, string>>): string {
  return JSON.stringify(strings)
    .replaceAll("<", "\\u003c")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");
}

/** The cookie the footer switch sets. A year: a language is not a choice anyone wants to remake. */
export const LANG_COOKIE = "lang";
const LANG_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** A language from a cookie value or a language tag ("zh", "zh-CN", "zh_TW"), or null if unsupported. */
export function parseLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const primary = value.trim().toLowerCase().split(/[-_]/)[0];
  return LOCALES.find((locale) => locale === primary) ?? null;
}

/** The language a request should be rendered in: the cookie, else Accept-Language, else English. */
export function requestLocale(request: Request): Locale {
  return (
    parseLocale(cookieValue(request.headers.get("cookie"), LANG_COOKIE)) ??
    acceptedLocale(request.headers.get("accept-language")) ??
    DEFAULT_LOCALE
  );
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.split("=");
    if (key?.trim() === name) return rest.join("=").trim();
  }
  return null;
}

/**
 * The first supported language in an Accept-Language header, by quality and then by order. English
 * ranked above Chinese stays English: "en-US,en;q=0.9,zh-CN;q=0.8" is a reader who chose English.
 */
export function acceptedLocale(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), quality: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.tag !== "" && Number.isFinite(entry.quality) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag } of ranked) {
    if (tag === "*") return null;
    const locale = parseLocale(tag);
    if (locale) return locale;
  }
  return null;
}

const SWITCH_PATH = /^\/lang\/([a-z]{2,3})\/?$/;

/**
 * The footer switch: `/lang/zh?back=/screener?min_oi=0` sets the cookie and returns the reader to the
 * page they were on. A plain link rather than a script, so it works with JavaScript off. Answered
 * ahead of the page cache and never stored: it sets a cookie, which no cached copy may do for another
 * reader. Null for every other path.
 */
export function languageSwitch(request: Request): Response | null {
  const url = new URL(request.url);
  const match = SWITCH_PATH.exec(url.pathname);
  if (!match) return null;
  const locale = parseLocale(match[1]);
  const headers = new Headers({
    location: safeBack(url.searchParams.get("back")),
    "cache-control": "no-store",
  });
  if (locale) {
    headers.set(
      "set-cookie",
      `${LANG_COOKIE}=${locale}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax; Secure`,
    );
  }
  return new Response(null, { status: 303, headers });
}

/**
 * Only a path on this site: "/x", never "//evil.example" or "/\evil.example", which browsers read as
 * another host. Anything else returns home, so the switch can never be used as an open redirect.
 */
function safeBack(back: string | null): string {
  return back && /^\/(?![/\\])[^\s]*$/.test(back) ? back : "/";
}

/** The `back` a switch link carries: the page being read. The page script adds its query string. */
export function switchHref(locale: Locale, path: string): string {
  return `/lang/${locale}?back=${encodeURIComponent(path)}`;
}
