// Candor the archer teaches archery at his range. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { type DialogueScript } from '../dialogue';
import { RANGE } from '../world/archery';
import { haptics } from '../input/haptics';
import { storeSet } from '../store';
import type { CandorDeps } from '../main';

export function setupCandor(deps: CandorDeps) {
  // Talk to him and ask for a lesson: he lends the Archer's spare if you have no crossbow, then calls three straw butts
  // (7, 10 and 13 m out). Put one bolt in each; he calls each hit by its ring. The first full lesson pays 15 crowns;
  // after that he keeps your best (fewest bolts for all three). Walk off the range and the lesson ends.
  const ARCHERY_KEY = 'gametool.archery';
  const archery: { lessons: number; best: number } = (() => { try { const v = JSON.parse(localStorage.getItem(ARCHERY_KEY) ?? 'null'); return { lessons: Number(v?.lessons) || 0, best: Number(v?.best) || 0 }; } catch { return { lessons: 0, best: 0 }; } })();
  let lesson: { hit: boolean[]; seen: Set<object>; shots: number } | null = null;
  const candorHit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  candorHit.position.copy(deps.world.standees.candor.position).setY(0.95); candorHit.name = 'candor-hit';
  deps.world.scene.add(candorHit);
  deps.interactables.push({ obj: candorHit, verb: () => lesson ? 'Talk to Candor (lesson on)' : 'Talk to Candor (archery)', act: () => deps.talkTo('candor', candorHit.position, candorScript()), when: () => !deps.inDungeon });
  function candorScript(): DialogueScript {
    const ranger = deps.character.profession === 'ranger', none = deps.inventory.count('crossbow') === 0;
    const hi = lesson ? `${lesson.hit.filter(Boolean).length} of three so far. Breathe, then loose.`
      : archery.lessons ? `Back on the line. Your best is all three butts in ${archery.best} bolt${archery.best === 1 ? '' : 's'}. Beat it.`
      : ranger ? "I'm Candor. I teach archery. A Ranger, by the look of your eyes. Let's see if your hands agree."
      : "I'm Candor. I teach archery, out here where a miss only hurts the hay. Bow, crossbow, it's the same lesson: still feet, slow breath, then loose.";
    return { speaker: 'Candor', start: 'hi', nodes: {
      hi: { text: hi, choices: [
        ...(lesson ? [{ text: 'I give up for now.', next: 'stop' }] : [{ text: 'Teach me archery.', next: none ? 'lend' : 'lesson' }]),
        { text: 'How do I aim?', next: 'aim' },
        { text: 'Not now.', next: 'bye' },
      ] },
      lend: { text: "No bow? Take this crossbow for the lesson, and keep it after. Ten bolts. Pick them up when you're done; hay is soft.", actions: ['lend:crossbow'], next: 'lesson' },
      lesson: { text: 'Three butts: seven, ten and thirteen paces out, each a step further left. One bolt in each. Take your time; I count bolts, not seconds.', actions: ['archery:start'], end: true },
      aim: { text: ranger ? 'Rangers see the mark without sights; let the crosshair close, then loose. Everyone else: raise the bow (right mouse, LT) and set the brass bead in the notch. Hold still and the wobble settles.'
        : 'Raise it to your eye (right mouse, LT). Set the brass bead on the front post down in the notch of the rear sight, on the gold. Stand still; breathe out; the wobble settles. Then loose (left mouse, RT).', next: 'hi' },
      stop: { text: 'Fair. The butts will wait.', actions: ['archery:stop'], end: true },
      bye: { text: 'Mind the line when others are shooting.', end: true },
    } };
  }
  function startLesson() {
    deps.groups.mark('station', 'archery');   // B52/B53
    const seen = new Set<object>([...deps.crossbow.bolts, ...deps.crossbow2.bolts]);
    lesson = { hit: deps.world.archery.map(() => false), seen, shots: 0 };
    deps.toast('Candor: "Three butts. Crossbow in hand, raise it (right mouse / LT), steady, loose. One bolt in each."', 5000);
  }
  function updateLesson() {
    if (!lesson) return;
    if (deps.inDungeon || Math.hypot(deps.player.pos.x - RANGE.x, deps.player.pos.z - RANGE.z) > 30) { lesson = null; deps.toast('Candor: "Lesson over. Come back when you have time."', 3000); return; }
    for (const b of [...deps.crossbow.bolts, ...deps.crossbow2.bolts]) {
      if (!lesson.seen.has(b)) { lesson.seen.add(b); lesson.shots++; }
      if (!b.stuck || (b as { scored?: boolean }).scored) continue;
      (b as { scored?: boolean }).scored = true;
      const i = deps.world.archery.findIndex((t) => Math.abs(b.mesh.position.x - t.centre.x) < 0.45 && Math.hypot(b.mesh.position.y - t.centre.y, b.mesh.position.z - t.centre.z) < 0.62);
      if (i < 0) { deps.toast('Candor: "Wide. Breathe out before you loose."', 2000); continue; }
      const t = deps.world.archery[i], r = Math.hypot(b.mesh.position.y - t.centre.y, b.mesh.position.z - t.centre.z);
      const ring = r < 0.12 ? 'Gold!' : r < 0.24 ? 'Red.' : r < 0.36 ? 'Blue.' : r < 0.48 ? 'Black.' : 'White, on the edge.';
      const fresh = !lesson.hit[i]; lesson.hit[i] = true;
      const left = lesson.hit.filter((h) => !h).length;
      deps.toast(`Candor: "${ring} ${fresh ? (left ? `${left} to go.` : 'That\'s all three.') : 'That one was already hit.'}"`, 2400);
      haptics.play('hit');
      if (!left) finishLesson();
    }
  }
  function finishLesson() {
    if (!lesson) return;
    const n = lesson.shots; lesson = null;
    const first = archery.lessons === 0, better = !archery.best || n < archery.best;
    archery.lessons++; if (better) archery.best = n;
    storeSet(ARCHERY_KEY, JSON.stringify(archery));
    setTimeout(() => {
      deps.toast(`Candor: "All three in ${n} bolt${n === 1 ? '' : 's'}.${better && !first ? ' Your best yet.' : ''}${n === 3 ? ' Clean. I have nothing to teach you today.' : ''}"`, 4200);
      if (first) setTimeout(() => deps.earn(15, 'your first archery lesson with Candor', 'archery-first'), 1200);
    }, 900);
  }
  return { startLesson, get lesson() { return lesson; }, set lesson(v) { lesson = v; }, updateLesson, candorHit, archery };
}
