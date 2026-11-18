/**
 * A page's brief for AI assistants: its figures in plain sentences and labelled tables, in English,
 * shown only in the page's Markdown copy (web/markdown.ts unwraps `<template data-agent>`; a browser
 * renders nothing inside a template, so the page a person sees is unchanged).
 *
 * WHY (owner, 2026-11-18: let AI use the site's data points). The visible pages carry their figures in
 * picker rows, heat grids and charts: right for a reader, unlabelled numbers for a model. The brief
 * gives a model what it would quote, with units, the window, the exchanges covered and where the full
 * list is as JSON. English, whatever the reader's language: it is for the model, and figures quoted
 * from it read the same in any answer.
 */

import { esc } from "./format";
import { withLocale } from "./i18n";

/** The brief's markup, rendered in English. `render` builds the inner HTML. */
export function agentBrief(render: () => string): string {
  const inner = withLocale("en", render).trim();
  return inner ? `<template data-agent>${inner}</template>` : "";
}

/** A labelled table: `head` is plain text, `rows` are cells of ready HTML. */
export function agentTable(head: readonly string[], rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return "";
  const th = head.map((cell) => `<th>${esc(cell)}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`);
  return `<table><thead><tr>${th}</tr></thead><tbody>${body.join("")}</tbody></table>`;
}

/** "2026-11-18 04:21 UTC": a moment as a model should quote it, never "3m ago". */
export const utcMinute = (when: Date | string | null): string => {
  if (when === null) return "";
  const time = new Date(when).getTime();
  return Number.isFinite(time)
    ? `${new Date(time).toISOString().slice(0, 16).replace("T", " ")} UTC`
    : "";
};

/** "71%": one part of a whole, rounded; empty when the whole is nothing. */
export const share = (part: number, whole: number): string =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "";
