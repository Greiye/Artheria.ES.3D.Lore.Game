// Natalie's idle lines per place, and the pet's sense for goblins and hidden things. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { QUEST } from '../quest/quest';
import type { BarksDeps } from '../main';

export function setupBarks(deps: BarksDeps) {
  // Natalie thinks out loud: one line per place, then the odd idle thought (25 s cooldown, mutable).
  let barkClock = 0, stillFor = 0;
  const lastPos = new THREE.Vector3();
  // Pets PR 3 (Mike 2026-11-04): the pet with you warns of goblins near you below, and sniffs out what's hidden: a
  // clue you haven't found up top, an unopened chest below. It trots over and sits by it until you take it.
  let senseClock = 0;
  const warnedFoe = new WeakMap<object, number>();
  const sniffed = new Set<string>();
  let lastWarn = -1e9;
  function petSense(dt: number) {
    senseClock += dt;
    if (senseClock < 0.4) return;
    senseClock = 0;
    const p = deps.pets.find((q) => q.following);
    if (!p || deps.state !== 'play') return;
    const me = deps.player.pos, now = performance.now(), who = deps.cap(p.label);
    let warned = false;
    if (deps.inDungeon) {
      let near: { root: THREE.Object3D } | null = null, best = 9;
      for (const f of deps.goblins.alive) { const d = f.root.position.distanceTo(me); if (d < best) { best = d; near = f; } }
      if (near && now - (warnedFoe.get(near) ?? -1e9) > 15000) {
        warnedFoe.set(near, now); warned = true; lastWarn = now;
        p.alert(near.root.position);
        deps.toast(p.sp.kind === 'cat' ? `${who} arches its back and hisses.` : p.sp.kind === 'owl' ? `${who} hoots a warning.` : p.sp.kind === 'hedgehog' ? `${who} rolls into a ball of spines, huffing.` : p.sp.kind === 'hamster' ? `${who} freezes and squeaks a warning.` : `${who} growls low at the dark ahead.`, 2400);
      }
    }
    // What's still hidden near you: an unopened chest below, an unfound clue up top.
    let lead: THREE.Vector3 | null = null, key = '';
    if (deps.inDungeon) {
      const seed = deps.dungeon.layout?.seed, chest = deps.dungeon.spots.find((sp) => sp.kind === 'chest');
      if (seed !== undefined && chest && !deps.delves[seed]?.chest && chest.hit.position.distanceTo(me) < 12) { lead = chest.hit.position; key = 'chest:' + seed; }
    } else {
      for (const c of QUEST.clues) {
        const hb = deps.questProps.hitboxes.get(c.id);
        if (!deps.quest.clues.includes(c.id) && hb && hb.position.distanceTo(me) < 8) { lead = hb.position; key = 'clue:' + c.id; break; }
      }
    }
    p.lead = lead;
    if (lead && !warned && now - lastWarn > 3000 && !sniffed.has(key)) {   // (a warning comes first; the find is said after)
      sniffed.add(key);
      deps.toast(p.sp.kind === 'cat' ? `${who} paws at something nearby.` : p.sp.kind === 'owl' ? `${who} circles something below.` : p.sp.kind === 'hedgehog' ? `${who} snuffles at something here.` : p.sp.kind === 'hamster' ? `${who} digs at something here.` : `${who} has its nose down: something's here.`, 2800);
    }
  }
  function barkTick(dt: number) {
    barkClock += dt;
    if (barkClock < 1 || !deps.companion.prefs.follow || deps.state !== 'play') return;
    stillFor = deps.player.pos.distanceTo(lastPos) < 0.2 ? stillFor + barkClock : 0;
    lastPos.copy(deps.player.pos); barkClock = 0;
    const b = QUEST.barks, p = deps.player.pos, any = (l: string[]) => l[Math.floor(Math.random() * l.length)];
    if (p.z < -18.6) deps.companion.say(any(b.library), { key: 'zone:library' }) || (Math.random() < 0.08 && deps.companion.say(any(b.library)));
    else if (Math.hypot(p.x + 9.2, p.z - 1) < 3) deps.companion.say(any(b.banner), { key: 'zone:banner' });
    else if (Math.hypot(p.x + 7.6, p.z - 0.5) < 4) deps.companion.say(any(b.camp), { key: 'zone:camp' });
    if (stillFor > 20) { deps.companion.say(any(b.idle)); stillFor = 0; }
  }
  return { barkTick, petSense };
}
