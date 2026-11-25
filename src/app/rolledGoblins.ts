// Trait roll tables: rolled goblins (docs/trait-roll-tables.md). Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { lore } from '../lore';
import { audio } from '../audio';
import { ITEMS } from '../inventory';
import { Goblins, type FoeWorld } from '../foes/goblins';
import { rollGoblin } from '../traits/goblin';
import { seedOf } from '../traits/roll';
import { haptics } from '../input/haptics';
import { CROWN } from '../shop';
import { FLOORS, budgetFor, countFor, saveRecord, GUARDIAN_NAMES, gearNear, type LostGear } from '../delve/descent';
import type { RolledGoblinsDeps } from '../main';

export function setupRolledGoblins(deps: RolledGoblinsDeps) {
  // New goblins every run; `?seed=N` forces the first one (debug), `?bestiary` lines up 12 on the green (dev only).
  const urlFlags = new URLSearchParams(location.search);
  const forcedGoblin = Number(urlFlags.get('seed')) || 0;
  deps.quick.forcedGoblin = forcedGoblin;
  const DELVE_HP = 10;
  let delveHp = DELVE_HP, slowT = 0, hurtFlash = 0;
  const goblinWorld: FoeWorld = {
    walkable: (x, z) => deps.dungeon.walkable(x, z),
    colliders: deps.world.colliders,   // B42: goblins lean at the same wall edges
    player: deps.player.pos,
    aiming: () => deps.crossbow.ads,
    hurt: (dmg, by, slow, from) => {
      if (!deps.inDungeon || delveHp <= 0) return;
      const bl = deps.blockBlow(dmg, from);
      if (bl.blocked && deps.imbued('thorns') && from) goblins.wound(by, 2);   // F1 thorns
      if (bl.blocked) { audio.swordHit(true); haptics.play('hit'); if (bl.dmg <= 0) { deps.toast(`You turn ${by.v.display}'s blow.`, 1400); return; } dmg = bl.dmg; slow = 0; }
      if (deps.imbued('witchfire')) dmg += 1;   // F1 witchfire's curse
      if (deps.sturdy) dmg = Math.max(1, dmg - 1);   // B18: well fed
      if (deps.fighterKit.temp > 0) { dmg = deps.fighterKit.absorb(dmg); if (dmg <= 0) { haptics.play('tap'); hurtFlash = 0.12; return; } }   // Mike 2026-11-06: the breath's temporary health goes first
      delveHp = Math.max(0, delveHp - dmg); hurtFlash = 0.35; haptics.play('hurt'); deps.gesture('hit');
      if (slow) slowT = Math.max(slowT, slow);
      if (delveHp <= 0) {
        if (deps.descent?.tutorial) { deps.tutorialSaved(`${by.v.display} knocks you flat.`); return; }   // B51
        if (deps.descent) { deps.heroFalls(by.v.display); return; }
        deps.exitDungeon();
        deps.toast(`${by.v.display} knocks you flat. Natalie hauls you back up the stairs.`, 4500);
        deps.companion.say('Up you get. We go back when you\'re ready.', { force: true });
      }
    },
    steal: () => { const n = Math.min(2, deps.inventory.count('bolt')); if (n) deps.inventory.take('bolt', n); return n; },
    loot: (f, crowns, bolts) => {
      deps.countKill();   // B49
      if (f.role === 'guardian' && deps.descent && !deps.record.ropes.includes(deps.descent.floor)) {
        deps.record.ropes.push(deps.descent.floor); deps.record.ropes.sort((a, b) => a - b); saveRecord(deps.record);
        setTimeout(() => deps.toast(`${f.v.display} is down. Natalie will tie a rope here: next time you can start the descent at floor ${deps.descent?.floor ?? ''}.`, 6000), 2700);
      }
      deps.inventory.give(CROWN, crowns); if (bolts) deps.inventory.give('bolt', bolts); haptics.play('pickup');
      deps.toast(`${f.v.display} drops ${crowns} crown${crowns > 1 ? 's' : ''}${bolts ? ` and ${bolts} bolt${bolts > 1 ? 's' : ''}` : ''}.`, 2600);
    },
    say: (t) => deps.toast(t, 2600),
    stealBook: () => {
      if (!deps.descent?.books.length) return null;
      const id = deps.descent.books.pop()!, title = lore.entries.find((e) => e.id === id)?.title ?? 'a lore book';
      deps.stolenBooks.set(title, id);
      return title;
    },
    reclaim: (f, item) => {
      const g = carried.get(f); carried.delete(f);
      if (g) { const i = deps.record.lostGear.indexOf(g); if (i >= 0) deps.record.lostGear.splice(i, 1); saveRecord(deps.record); }
      deps.inventory.give(item, 1); haptics.play('pickup');
      deps.toast(g ? `You take ${g.owner}'s ${ITEMS[item]?.name.toLowerCase() ?? item} back from the goblin. It's yours now.` : `You take the ${ITEMS[item]?.name.toLowerCase() ?? item} off the goblin.`, 3600);
    },
    recover: (_f, title) => { const id = deps.stolenBooks.get(title); deps.stolenBooks.delete(title); if (id && deps.descent) { deps.descent.books.push(id); deps.toast(`You take “${title}” back.`, 2600); } },
    douse: () => { if (deps.hands.held.left === 'torch' || deps.hands.held.right === 'torch') { deps.toggleTorch(); deps.toast('A wet blow, and your torch gutters out.', 2400); } },
    hex: (kind) => {
      if (kind === 'slow') { slowT = Math.max(slowT, 2.5); return; }
      const fog = deps.world.scene.fog as THREE.Fog, far = fog.far, near = fog.near;
      fog.far = Math.max(8, far * 0.45); fog.near = 1.5;
      setTimeout(() => { if (deps.inDungeon) { fog.far = far; fog.near = near; } }, 4000);
    },
  };
  // Round D4 (leader): a goblin's blow on a friend goes to their screen, which takes it as its own goblin's blow.
  goblinWorld.hurtFriend = (id, dmg, by) => deps.friends.room?.send('ouch', [goblins.list.indexOf(by), dmg], id);
  const goblins = new Goblins(deps.world.scene, goblinWorld);
  for (const s of [deps.sword, deps.sword2]) {
    s.foes = () => goblins.alive.map((f) => f.root.position);
    s.slash = (c) => {
      const n = goblins.slash(c.from, c.fwd, c.reach, c.arc, c.damage + (deps.imbued('hunger') ? 1 : 0), c.heavy).length;
      if (n && deps.descent) deps.descent.swordHits += n;
      if (n && deps.imbued('drink')) delveHp = Math.min(DELVE_HP, delveHp + 1);   // F1 the drinking edge
      return n;
    };
  }
  deps.crossbow.targets = deps.crossbow2.targets = (from, dir, len) => {
    const h = goblins.list.length ? goblins.hitTest(from, dir, len) : null;
    return h && { dist: h.dist, hit: (dmg, d) => {
      haptics.play('hit'); if (deps.descent) deps.descent.boltHits++;
      if (deps.imbued('frost')) goblins.chill(h.foe, 3);
      return goblins.shoot(h.foe, dmg + (deps.imbued('witchfire') ? 1 / 3 : 0), d);
    } };
  };
  /** Rocks hit like bolts but carry no bolt scrolls. */
  const rockTargets: typeof deps.crossbow.targets = (from, dir, len) => {
    const h = goblins.list.length ? goblins.hitTest(from, dir, len) : null;
    return h && { dist: h.dist, hit: (dmg, d) => { haptics.play('hit'); return goblins.shoot(h.foe, dmg, d); } };
  };
  function spawnGoblins(keepHp = false) {
    goblins.clear(); if (!keepHp) delveHp = DELVE_HP + (deps.cook.consume('hearty') ? 3 : 0); slowT = 0;   // B18: a hearty meal (your wounds carry down the stairs)
    const L = deps.dungeon.layout!, run = (Math.random() * 2 ** 31) | 0, fl = goblins.floor;
    // One per room by depth, two in the nest (its first with a bigger budget); deeper floors, more and tougher.
    const rooms = L.rooms.filter((r) => r.tag !== 'entrance').sort((a, b) => (a.tag === 'nest' ? -1 : b.tag === 'nest' ? 1 : a.depth - b.depth));
    let i = 0;
    for (const r of rooms) for (let k = 0, n = fl ? countFor(fl, r.tag) : r.tag === 'nest' ? 2 : 1; k < n && goblins.alive.length < goblins.maxFoes; k++, i++) {
      const seed = i === 0 && forcedGoblin ? forcedGoblin : seedOf(run, i);
      const budget = fl ? budgetFor(fl) + (r.tag === 'nest' && k === 0 ? 4 : 0) : r.tag === 'nest' && k === 0 ? 8 : undefined;
      goblins.spawn(rollGoblin(seed, budget), deps.dungeon.roomAt(r, k, 0), Math.PI, false, fl === FLOORS && r.tag === 'nest' ? 'keeper' : undefined);
    }
    // E2: a guardian floor's boss waits in the deepest room.
    const gi = fl ? deps.record.guardians.indexOf(fl) : -1, nest = L.rooms.find((r) => r.tag === 'nest');
    if (gi >= 0 && nest) goblins.spawn(rollGoblin(seedOf(run, 99), budgetFor(fl) + 6), deps.dungeon.roomAt(nest, 0, 1), Math.PI, true, 'guardian', GUARDIAN_NAMES[gi % GUARDIAN_NAMES.length]);
    // F2: a fallen hero's gear, carried by the goblins near where they fell.
    carried.clear();
    if (fl) {
      const free = goblins.alive.filter((f) => f.role !== 'guardian' && f.role !== 'keeper');
      for (const g of gearNear(deps.record.lostGear, fl)) {
        const f = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        if (!f) break;
        goblins.arm(f, g.item, `${g.owner}'s ${ITEMS[g.item]?.name.toLowerCase() ?? g.item}`); carried.set(f, g);
      }
      if (carried.size) setTimeout(() => { const g = [...carried.values()][0]; if (deps.inDungeon && g) deps.toast(`Something down here carries ${g.owner}'s gear.`, 3600); }, 5600);
    }
  }
  /** F2: which goblin carries which fallen hero's piece, this floor. */
  const carried = new Map<object, LostGear>();
  const delveHpEl = document.getElementById('delveHp')!;
  return { rockTargets, carried, goblins, spawnGoblins, get delveHp() { return delveHp; }, set delveHp(v) { delveHp = v; }, DELVE_HP, get hurtFlash() { return hurtFlash; }, set hurtFlash(v) { hurtFlash = v; }, get slowT() { return slowT; }, set slowT(v) { slowT = v; }, delveHpEl, urlFlags, forcedGoblin, goblinWorld };
}
