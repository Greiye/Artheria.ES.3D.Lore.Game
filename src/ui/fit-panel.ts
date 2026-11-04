// B27 (Mike 2026-11-01): every station panel should show everything at once, with no scrolling.
//  1. Tabs: content split into <section><h4>…</h4> groups (directly in the panel, or inside a `.fp-group`) shows one
//     group at a time under a row of tabs, the open tab remembered per panel.
//  2. Fit: if a panel still runs past the bottom of the screen (a phone held sideways), it's scaled down to fit, to no
//     less than minZoom(); past that it scrolls. On a touch screen the text size
//     (--rd-body, UI 3) steps down first, so buttons keep their size. The panel keeps its on-screen width.
// Panels re-render with innerHTML, so this watches the page for that and re-applies.
const openTab = new Map<string, number>();
// Touch screens may zoom further (0.6) so the long shop and tailor still fit held sideways without scrolling.
const minZoom = () => (matchMedia('(pointer: coarse)').matches ? 0.6 : 0.7);
// Mike 2026-11-04 ("Shrink to fit"): on a phone a tall panel shrinks to fit rather than scroll, even with UI 3's larger
// text. It shrinks the text first (16px down to 11px), which keeps tap targets full size, and only then zooms.
const MIN_TEXT = 11;

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
  // On a phone the tabs are one row you swipe (readable.css): keep the open one in view.
  const onTab = nav.children[on] as HTMLElement | undefined;
  if (onTab && nav.scrollWidth > nav.clientWidth) {
    const l = onTab.offsetLeft - nav.offsetLeft, r = l + onTab.offsetWidth;
    if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = Math.max(0, l - 24);
  }
}

function zoomToFit(p: HTMLElement) {
  const s = p.style;
  s.zoom = ''; s.height = ''; s.width = ''; s.bottom = ''; s.removeProperty('--rd-body'); s.removeProperty('--fz');
  if (p.scrollHeight <= p.clientHeight + 1) return;
  if (matchMedia('(pointer: coarse)').matches) {
    let px = parseFloat(getComputedStyle(p).getPropertyValue('--rd-body')) || 16;
    while (p.scrollHeight > p.clientHeight + 1 && px > MIN_TEXT) s.setProperty('--rd-body', `${--px}px`);
    if (p.scrollHeight <= p.clientHeight + 1) return;
  }
  const H = p.clientHeight, W = p.getBoundingClientRect().width;
  let z = 1;
  for (let i = 0; i < 6 && p.scrollHeight > p.clientHeight + 1 && z > minZoom(); i++) {
    z = Math.max(minZoom(), z * (p.clientHeight / p.scrollHeight) - 0.005);
    s.zoom = z.toFixed(3); s.bottom = 'auto'; s.height = `${H / z}px`; s.width = `${W / z}px`;
    s.setProperty('--fz', z.toFixed(3));   // tap targets that must stay 44px on screen divide by this (readable.css)
  }
}

function fitPanel(p: HTMLElement): void {
  const key = keyOf(p);
  tabify(p, p, key);
  p.querySelectorAll<HTMLElement>('.fp-group').forEach((g, i) => tabify(p, g, `${key}#${i}`));
  zoomToFit(p);
}

/** Open a panel on a given tab next time it's drawn; `key` is its eyebrow text. */
export function setPanelTab(key: string, i: number): void { openTab.set(key, i); }


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
