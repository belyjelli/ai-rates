/**
 * The dropdown picker the whales and CVD pages share: a <details> whose summary is what is shown now
 * and whose panel lists every choice as a plain link, so it works without the script. PICK_SCRIPT
 * adds the filter box (a whales picker hides it until then; a CVD one is a search form that also
 * works without it), arrow keys, Escape and click-away.
 *
 * Markup: details.wh-pick > summary.wh-pick-btn, and in .wh-pick-panel an input.wh-pick-q, the
 * a.wh-pick-row links (each with the words it is found by in data-q) and a p.wh-pick-none. Rows may
 * sit under p.wh-pick-group headings (the Gamma tab's regions), each hidden while a filter leaves it
 * no row.
 *
 * Delegated from the document rather than bound to one picker: CVD swaps its <main> in place when
 * an asset is picked, and live.ts replaces the CVD rows every 30 seconds, so a picker or a row can
 * arrive after this ran. A details whose markup is `open` with `data-searched` keeps its box's text
 * on that first opening: the address asked for that search (CVD's ?q=).
 */
export const PICK_SCRIPT = `(() => {
  const rows = (pick) => [...pick.querySelectorAll(".wh-pick-row")];
  const shown = (pick) => rows(pick).filter((r) => !r.hidden);
  const filter = (pick) => {
    const words = pick.querySelector(".wh-pick-q").value.trim().toLowerCase().split(/\\s+/).filter(Boolean);
    for (const r of rows(pick)) r.hidden = !words.every((w) => r.dataset.q.includes(w));
    for (const g of pick.querySelectorAll(".wh-pick-group")) {
      let any = false;
      for (let el = g.nextElementSibling; el && !el.matches(".wh-pick-group"); el = el.nextElementSibling) if (!el.hidden) any = true;
      g.hidden = !any;
    }
    pick.querySelector(".wh-pick-none").hidden = shown(pick).length > 0;
  };
  // Enter, or a search form's button: the first row still shown, as a click, so a page that takes
  // its rows in place (CVD) gets it like any other.
  const first = (pick) => {
    const row = shown(pick)[0];
    if (row) row.click();
  };
  const of = (el) => (el && el.closest ? el.closest(".wh-pick") : null);

  document.addEventListener("input", (e) => {
    const pick = of(e.target);
    if (pick && e.target.matches(".wh-pick-q")) filter(pick);
  });
  document.addEventListener("submit", (e) => {
    const pick = of(e.target);
    if (!pick) return;
    e.preventDefault();
    first(pick);
  });
  document.addEventListener("keydown", (e) => {
    const pick = of(e.target);
    if (!pick) return;
    if (e.key === "Escape") { pick.open = false; pick.querySelector("summary").focus(); return; }
    const box = pick.querySelector(".wh-pick-q");
    if (e.target === box) {
      if (e.key === "Enter") { e.preventDefault(); first(pick); }
      else if (e.key === "ArrowDown") {
        const row = shown(pick)[0];
        if (row) { e.preventDefault(); row.focus(); }
      }
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const list = shown(pick);
    const at = list.indexOf(document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    const next = at + (e.key === "ArrowDown" ? 1 : -1);
    if (next < 0) box.focus();
    else if (list[next]) list[next].focus();
  });
  // toggle does not bubble, so it is caught on the way down.
  document.addEventListener("toggle", (e) => {
    const pick = e.target;
    if (!pick.matches || !pick.matches(".wh-pick") || !pick.open) return;
    const box = pick.querySelector(".wh-pick-q");
    box.hidden = false;
    if ("searched" in pick.dataset) delete pick.dataset.searched;
    else box.value = "";
    filter(pick);
    if (matchMedia("(hover: hover)").matches) box.focus();
    const on = pick.querySelector(".wh-pick-row.on");
    if (on) on.scrollIntoView({ block: "nearest" });
  }, true);
  document.addEventListener("click", (e) => {
    for (const pick of document.querySelectorAll(".wh-pick[open]")) if (!pick.contains(e.target)) pick.open = false;
  });
  // live.ts replaces a live list's rows wholesale; what the box says still applies to the new ones.
  new MutationObserver(() => {
    for (const pick of document.querySelectorAll(".wh-pick[open]")) if (pick.querySelector(".wh-pick-q").value.trim()) filter(pick);
  }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
})();`;
