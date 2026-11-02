// B27 (Mike 2026-11-01): every station panel should show everything at once, with no scrolling.
//  1. Tabs: content split into <section><h4>…</h4> groups (directly in the panel, or inside a `.fp-group`) shows one
//     group at a time under a row of tabs, the open tab remembered per panel.
//  2. Fit: if a panel still runs past the bottom of the screen (a phone held sideways), it's scaled down to fit, to no
//     less than MIN_ZOOM; past that it scrolls. The panel keeps its on-screen width.
// Panels re-render with innerHTML, so this watches the page for that and re-applies.
const openTab = new Map<string, number>();
const MIN_ZOOM = 0.7;

function keyOf(p: HTMLElement): string {
  return (p.querySelector('.eyebrow')?.textContent ?? p.className).trim();
}

function tabify(p: HTMLElement, box: HTMLElement, key: string) {
  const secs = [...box.querySelectorAll<HTMLElement>(':scope > section')].filter((s) => s.querySelector(':scope > h4'));
  let nav = box.querySelector<HTMLElement>(':scope > .fp-tabs');
  if (secs.length < 2) { nav?.remove(); if (box.classList.contains('fp-tabbed')) box.classList.remove('fp-tabbed'); return; }
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'fp-tabs';
    nav.setAttribute('role', 'tablist');
    nav.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-fp]');
      if (!b) return;
      openTab.set(key, Number(b.dataset.fp));
      fitPanel(p);
    });
    box.insertBefore(nav, secs[0]);
  }
  const on = Math.min(openTab.get(key) ?? 0, secs.length - 1);
  const labels = secs.map((s) => s.querySelector(':scope > h4')!.textContent ?? '');
  const html = labels.map((l, i) => `<button type="button" role="tab" class="fp-tab${i === on ? ' on' : ''}" aria-selected="${i === on}" data-fp="${i}">${l}</button>`).join('');
  if (nav.innerHTML !== html) nav.innerHTML = html;
  // (classList.add/remove always write the attribute, which the observer would see: only write on a change)
  secs.forEach((s, i) => { if (s.classList.contains('fp-hide') !== (i !== on)) s.classList.toggle('fp-hide', i !== on); });
  if (!box.classList.contains('fp-tabbed')) box.classList.add('fp-tabbed');
}

function zoomToFit(p: HTMLElement) {
  const s = p.style;
  s.zoom = ''; s.height = ''; s.width = ''; s.bottom = '';
  if (p.scrollHeight <= p.clientHeight + 1) return;
  const H = p.clientHeight, W = p.getBoundingClientRect().width;
  let z = 1;
  for (let i = 0; i < 4 && p.scrollHeight > p.clientHeight + 1 && z > MIN_ZOOM; i++) {
    z = Math.max(MIN_ZOOM, z * (p.clientHeight / p.scrollHeight) - 0.005);
    s.zoom = z.toFixed(3); s.bottom = 'auto'; s.height = `${H / z}px`; s.width = `${W / z}px`;
  }
}

export function fitPanel(p: HTMLElement): void {
  const key = keyOf(p);
  tabify(p, p, key);
  p.querySelectorAll<HTMLElement>('.fp-group').forEach((g, i) => tabify(p, g, `${key}#${i}`));
  zoomToFit(p);
}

/** Which tab a panel shows (tests). */
export function panelTab(p: HTMLElement): number { return openTab.get(keyOf(p)) ?? 0; }

let queued = false;
function sweep() {
  queued = false;
  document.querySelectorAll<HTMLElement>('.forge-panel').forEach((p) => { if (p.getClientRects().length) fitPanel(p); });
}
const later = () => { if (!queued) { queued = true; queueMicrotask(sweep); } };
/** Watch the page for station panels being drawn, redrawn or typed into, and the screen changing size. */
export function watchPanels(): void {
  new MutationObserver((recs) => {
    if (queued) return;
    for (const r of recs) {
      const t = r.target as HTMLElement;
      if (t.nodeType === 1 && (t.classList.contains('forge') || t.closest?.('.forge'))) { later(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', later);
}
