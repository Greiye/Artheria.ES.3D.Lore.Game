// B51: after the tutorial run, each floor gives you 8 minutes to reach a stair. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { audio } from '../audio';
import { rollGoblin } from '../traits/goblin';
import { seedOf } from '../traits/roll';
import { haptics } from '../input/haptics';
import { scrollById } from '../delve/scrolls';
import type { StairsTimerDeps } from '../main';

export function setupStairsTimer(deps: StairsTimerDeps) {
  // Down in the deepest room, or back up where you came in. It counts only while you play (not in menus or the stair
  // ride); warnings at a minute and at 15 seconds; at zero the dark takes you, the same fall as a knock-out.
  const STAIRS_TIME = 8 * 60;
  const stairsEl = document.getElementById('stairsTimer')!;
  let stairsWarned = 0;
  function tutorialOn() { try { return !navigator.webdriver || localStorage.getItem('gametool.tutorialtest') === 'on'; } catch { return !navigator.webdriver; } }
  function tutorialSaved(what: string) {
    deps.exitDungeon();
    deps.toast(`${what} Natalie hauls you back up the stairs: on your first descent, she doesn't let you fall.`, 5200);
    deps.companion.say("Up you get. That's what it's like down there. Next time I can't pull you out.", { force: true });
  }
  function stairsTick(dt: number) {
    const d = deps.descent;
    if (!d || d.stairsLeft === undefined) { stairsEl.classList.add('hidden'); return; }
    if (deps.state === 'play' && !deps.descendCine.active && deps.delveHp > 0) d.stairsLeft = Math.max(0, d.stairsLeft - dt);
    const left = d.stairsLeft, m = Math.floor(Math.ceil(left) / 60), sec = Math.ceil(left) % 60;
    const t = `⏳ ${m}:${String(sec).padStart(2, '0')} to the stairs`;
    stairsEl.classList.remove('hidden');
    stairsEl.classList.toggle('warn', left <= 60 && left > 15); stairsEl.classList.toggle('urgent', left <= 15);
    if (stairsEl.textContent !== t) stairsEl.textContent = t;
    if (left <= 60 && stairsWarned < 1) { stairsWarned = 1; deps.toast('A minute left on this floor. Find the stairs, down or back up.', 3600); haptics.play('hurt'); }
    if (left <= 15 && stairsWarned < 2) { stairsWarned = 2; deps.toast('Fifteen seconds. The torches are guttering.', 2600); haptics.play('hurt'); }
    if (left <= 0) { stairsEl.classList.add('hidden'); deps.delveHp = 0; deps.heroFalls('The dark'); }
  }
  // UX pass (Mike 2026-10-31): your health shows on you, not as a counter. Below half, the edges of your sight redden
  // and you breathe hard; below 40% you limp. The old line stays for screen readers (and tests), off screen.
  let breathT = 0;
  function updateDelve(dt: number) {
    if (!deps.inDungeon) { deps.delveHpEl.classList.add('hidden'); stairsEl.classList.add('hidden'); document.body.style.setProperty('--hurt', '0'); if (deps.wear.level) deps.wear.set(0); return; }
    if (deps.state === 'play' && !deps.descendCine.active) { if (deps.hitStop > 0) deps.hitStop -= dt; else deps.goblins.update(dt); }   // v0.08: a beat's pause on a sword hit
    const frac = Math.min(1, deps.delveHp / deps.DELVE_HP);
    deps.wear.set(1 - frac);
    deps.slowT = Math.max(0, deps.slowT - dt); deps.player.speedMul = (deps.slowT > 0 ? 0.55 : 1) * (frac <= 0.4 ? 0.75 : 1) * (deps.isBlocking() ? 0.6 : 1) * (deps.fluxNow === 'flooded' ? 0.72 : 1) * (deps.imbued('swift') ? 1.12 : 1);
    deps.goblins.reveal = deps.imbued('seeing') && (deps.hands.held.left === 'torch' || deps.hands.held.right === 'torch');
    deps.fluxTick(dt);
    stairsTick(dt);   // B51
    deps.hurtFlash = Math.max(0, deps.hurtFlash - dt);
    document.body.style.setProperty('--hurt', (Math.max(0, 1 - frac * 1.6) * 0.85 + deps.hurtFlash * 1.4).toFixed(2));
    if (frac <= 0.5 && deps.state === 'play' && (breathT -= dt) <= 0) { audio.breath(); breathT = 1.2 + frac * 2.4; }
    deps.delveHpEl.classList.remove('hidden');
    deps.delveHpEl.classList.toggle('hit', deps.hurtFlash > 0);
    const t = `${deps.descent ? `Floor ${deps.descent.floor} · ` : ''}♥ ${deps.delveHp}/${deps.DELVE_HP}${deps.fighterKit.temp > 0 ? ` +${deps.fighterKit.temp}` : ''}${deps.slowT > 0 ? ' · slowed' : ''} · goblins ${deps.goblins.alive.length}${deps.descent?.books.length ? ` · ${deps.descent.books.length} book${deps.descent.books.length > 1 ? 's' : ''} carried` : ''}${deps.descent?.scrolls?.length ? ` · ✦ ${deps.descent.scrolls.map((id) => scrollById(id)?.name.replace(/^Scroll of (the )?/, '')).join(', ')}` : ''}`;
    if (deps.delveHpEl.textContent !== t) deps.delveHpEl.textContent = t;
  }
  // Dev: a lineup of 12 rolled goblins on the green, frozen, with their name tags.
  const bestiary = deps.urlFlags.has('bestiary') ? (() => {
    const run = (Math.random() * 2 ** 31) | 0, out: THREE.Group[] = [];
    for (let i = 0; i < 12; i++) {
      const v = rollGoblin(i === 0 && deps.forcedGoblin ? deps.forcedGoblin : seedOf(run, i));
      const f = deps.goblins.spawn(v, new THREE.Vector3(2 + (i - 5.5) * 0.75, 0, 19.5), 0, true)!;
      out.push(f.root);
    }
    return out;
  })() : null;
  return { tutorialOn, STAIRS_TIME, get stairsWarned() { return stairsWarned; }, set stairsWarned(v) { stairsWarned = v; }, tutorialSaved, bestiary, updateDelve };
}
