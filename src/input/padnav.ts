// B40 (Mike 2026-11-03): every on-screen panel works with a controller. The D-pad (or a left-stick flick) moves the
// focus to the nearest control in that direction, A presses it, left / right change a slider or a list, and B backs
// out through the panel's own Close / Leave / Done button. Nothing here knows about a particular station: it works
// on whatever buttons, fields and lists the open panel shows, so a new station gets controller support for free.
export type PadDir = 'up' | 'down' | 'left' | 'right';

const SEL = 'button, input, select, textarea, summary, a[href], [tabindex="0"]';
const shown = (el: HTMLElement) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled && getComputedStyle(el).visibility !== 'hidden';

/** The controls a controller can reach inside root. */
export function focusables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(SEL)].filter((el) => shown(el) && !el.closest('#touch, .hidden'));
}

/** The panel on top: of the page's top-level blocks that show a control, the one with the highest z-index (the later one on a tie). */
export function topPanel(): HTMLElement | null {
  let best: HTMLElement | null = null, bestZ = -Infinity;
  for (const el of document.body.children) {
    if (!(el instanceof HTMLElement) || el.id === 'touch' || el.classList.contains('hidden') || !focusables(el).length) continue;
    const z = Number(getComputedStyle(el).zIndex) || 0;
    if (z >= bestZ) { best = el; bestZ = z; }
  }
  return best;
}

/** Is el a text box (where the system keyboard types)? */
export const isTextField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'submit', 'color'].includes(el.type));

/** The control the controller is on: the focused one, or the one it left with B (a text box it stepped out of). */
function current(all: HTMLElement[]): HTMLElement | null {
  const a = document.activeElement as HTMLElement | null;
  if (a && all.includes(a)) return a;
  const l = last;
  return l && all.includes(l) ? l : null;
}
// The control the controller last put the focus on. Kept here, not as a class on the element: some panels redraw a
// part when its HTML changes (src/ui/fit-panel.ts tabs), and a class would count as a change and drop the focus.
let last: HTMLElement | null = null;

function put(el: HTMLElement | undefined) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  last = el;
}

/** Move the focus one step in dir: the nearest control that way, or the next / previous one in reading order. */
export function padMove(root: ParentNode, dir: PadDir) {
  const all = focusables(root);
  if (!all.length) return;
  const cur = current(all);
  const at = cur ? all.indexOf(cur) : -1;
  if (at < 0) { put(all[0]); return; }
  const a = cur!.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | undefined, score = Infinity;
  for (const el of all) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const main = dir === 'down' ? y - ay : dir === 'up' ? ay - y : dir === 'right' ? x - ax : ax - x;
    const side = dir === 'up' || dir === 'down' ? Math.abs(x - ax) : Math.abs(y - ay);
    if (main < 4) continue;                       // not that way
    const s = main + side * 2;
    if (s < score) { score = s; best = el; }
  }
  // Nothing that way: up / down wrap through the list in reading order so every control stays reachable.
  if (!best && (dir === 'up' || dir === 'down')) best = all[(at + (dir === 'down' ? 1 : -1) + all.length) % all.length];
  put(best);
}

/** Left / right on a slider, tick box or list changes it; returns false for any other control. */
export function padNudge(el: Element | null, d: number): boolean {
  if (el instanceof HTMLInputElement && el.type === 'range') {
    const v = Math.min(Number(el.max || 100), Math.max(Number(el.min || 0), Number(el.value) + d * Number(el.step || 1)));
    el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (el instanceof HTMLSelectElement) {
    el.selectedIndex = (el.selectedIndex + d + el.options.length) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

/** A: press the focused control (or the first one). A text box gets the focus, so the system keyboard can type in it. */
export function padPress(root: ParentNode) {
  const all = focusables(root);
  const el = current(all);
  if (!el) { put(all[0]); return; }   // the first A only shows where the controller is
  if (isTextField(el)) { put(el); el.click(); return; }
  if (el instanceof HTMLSelectElement) { padNudge(el, 1); return; }
  put(el);
  el.click();
}

const CLOSE = /^\s*(⇠\s*)?(close|leave|done|back|cancel|exit)\b/i;
/** B: the panel's own way out (its Close / Leave / Done / Back button). Returns false if it has none. */
export function padBack(root: ParentNode): boolean {
  const a = document.activeElement;
  if (isTextField(a) && focusables(root).includes(a)) { a.blur(); return true; }   // first B puts the pen down
  const all = focusables(root).filter((el) => el instanceof HTMLButtonElement);
  const out = all.find((b) => b.dataset.act === 'cancel' || b.dataset.act === 'close') ?? all.find((b) => CLOSE.test(b.textContent ?? '') || CLOSE.test(b.getAttribute('aria-label') ?? ''));
  if (!out) return false;
  out.click();
  return true;
}
