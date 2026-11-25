// B35: fighter mode against Kavik, side-on on the dojo mats (src/fight/). Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { type DialogueScript } from '../dialogue';
import { station } from '../stations';
import { DOJO } from '../dojo/dojo';
import { FightMode } from '../fight/mode';
import { haptics } from '../input/haptics';
import type { FightModeDeps } from '../main';

export function setupFightMode(deps: FightModeDeps) {
  const fightMode = station(new FightMode());
  const kavikRoot = deps.world.standees.kavik;
  const kavikHit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  kavikHit.position.copy(kavikRoot.position).setY(0.95);
  deps.world.scene.add(kavikHit);
  // Mike 2026-11-06 ("Kavik needs a dialogue before the fight and after"): E talks first; the fight starts from his talk.
  deps.interactables.push({ obj: kavikHit, verb: () => deps.sideGate(fightMode.record.beaten ? 'Talk to Kavik (spar, no holding back)' : 'Talk to Kavik (spar)'), act: () => deps.sideGo(talkToKavik), when: () => !deps.inDungeon });
  // The fight runs on the mats: its x along them (the world's -x), its z across (the world's +z). The camera starts on
  // the -Z side, side-on, and swings round with the line between the fighters as they sidestep.
  const DOJO_RING = { x: DOJO.x, y: 0.24, z: DOJO.z - 0.3, rot: 0 };
  // B5: a Monk's duel puts the mat wherever the duel starts, turned (rot about Y) so you keep your side of it.
  let RING = DOJO_RING;
  const ringPt = (fx: number, fz: number) => { const c = Math.cos(RING.rot), s = Math.sin(RING.rot), lx = -fx; return { x: RING.x + lx * c + fz * s, z: RING.z - lx * s + fz * c }; };
  let kavikWas: { x: number; y: number; z: number; ry: number } | null = null, fightView: boolean | null = null;
  const fightFx = new THREE.Group(); fightFx.name = 'fight-fx'; deps.world.scene.add(fightFx);
  // A flash where a hit lands: gold on a hit, pale on a block, red on a counter hit.
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#FFE08A', transparent: true, depthWrite: false });
  const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), sparkMat); spark.visible = false; fightFx.add(spark);
  let sparkT = 0;
  const fightCam = { x: 0, z: 0 };
  function talkToKavik() {
    if (deps.state !== 'play') return;
    deps.talkTo('kavik', kavikHit.position, kavikBefore());
  }
  /** Before the spar: fight or not now (and, once, what he saw at the bottom of the descent). */
  function kavikBefore(): DialogueScript {
    const r = fightMode.record, met = r.wins + r.losses > 0;
    const open = r.beaten ? "You again. You beat me once. That means I stop being polite." : met ? 'Back on the mats? Good. Shoes off.' : "New face. You've got the look of someone who's never been hit properly. Want to fix that?";
    return { speaker: 'Kavik', start: 'k1', nodes: {
      k1: { text: open, choices: [
        { text: r.beaten ? "Let's go. Best of three." : "Let's spar.", next: 'fight' },
        { text: 'Have you been down the descent?', next: 'deep' },
        { text: 'Not now.', next: 'later' },
      ] },
      fight: { text: r.beaten ? 'No holding back. Hands up.' : met ? 'Best of three. Hold back to block.' : "Best of three. I'll go easy until you win one. Hold back to block.", actions: ['kavik:fight'], end: true },
      deep: { text: "Floor thirty? I went. Gold to the ceiling, and something asleep on it. I didn't stay to ask its name.", next: 'k1' },
      later: { text: "The mats aren't going anywhere. Neither am I.", end: true },
    } };
  }
  /** After the spar: different words for a win and a loss (the last match decides). */
  let lastSpar: { won: boolean; first: boolean } | null = null;
  function kavikAfter(won: boolean, first: boolean): DialogueScript {
    const text = first ? "Hm. You got me. Don't let it go to your head. From now on I fight properly."
      : won ? "Again. Fine. I'll be thinking about that one all night."
      : fightMode.record.beaten ? "You beat me once. Not today. Watch for the low ones."
      : 'Down you go. You swing and then you stand there. Block first, then hit me while I recover.';
    return { speaker: 'Kavik', start: 'a1', nodes: {
      a1: { text, choices: [
        { text: won ? 'Good fight.' : "I'll be back.", next: 'a2' },
        { text: 'Again!', next: 'again' },
      ] },
      a2: { text: won ? 'It was. Go rest those hands.' : 'I know. Eat something first.', end: true },
      again: { text: 'Hands up, then.', actions: ['kavik:fight'], end: true },
    } };
  }
  function openFight() {
    if (deps.state !== 'play') return;
    lastSpar = null; deps.monkM.duel = null; RING = DOJO_RING;
    deps.enterForge();
    fightView = deps.player.thirdPerson; deps.player.thirdPerson = true;
    kavikWas = { x: kavikRoot.position.x, y: kavikRoot.position.y, z: kavikRoot.position.z, ry: kavikRoot.rotation.y };
    fightMode.open();
  }
  fightMode.onClose = () => {
    if (deps.monkM.duel) { deps.endDuel(); return; }
    if (kavikWas) { kavikRoot.position.set(kavikWas.x, kavikWas.y, kavikWas.z); kavikRoot.rotation.y = kavikWas.ry; kavikWas = null; }
    fightFx.visible = false;
    deps.player.spawn(new THREE.Vector3(RING.x, 0, RING.z - 2.2), Math.PI);   // off the mats, facing them
    if (fightView !== null) { deps.player.thirdPerson = fightView; fightView = null; }
    deps.leaveForge();
    // Mike 2026-11-06: after a match, Kavik has a word (a win and a loss read differently).
    const last = lastSpar; lastSpar = null;
    if (last) setTimeout(() => { if (deps.state === 'play' || deps.state === 'resume') deps.talkTo('kavik', kavikHit.position, kavikAfter(last.won, last.first)); }, 250);
  };
  fightMode.onResult = (won, crowns, first) => { if (deps.monkM.duel) { deps.monkM.duel.won = won; return; } lastSpar = { won, first }; if (crowns) deps.earn(crowns, first ? 'your first win over Kavik' : 'a win over Kavik'); };
  fightMode.onHit = (e) => {
    if (!e.blocked && (!deps.monkM.duel || e.on === fightMode.fight.a)) deps.gesture('hit', e.on === fightMode.fight.a ? 'player' : 'kavik');
    if (e.on === fightMode.fight.a || e.by === fightMode.fight.a) haptics.play(e.blocked ? 'tap' : 'hurt');
    if (e.outcome !== 'break') {
      const m = e.move, hy = m.level === 'low' ? 0.35 : m.level === 'high' ? 1.5 : 1.05;
      { const w = ringPt((e.by.x + e.on.x) / 2, (e.by.z + e.on.z) / 2); spark.position.set(w.x, RING.y + e.on.y + hy, w.z); }
      sparkMat.color.set(e.blocked ? '#CFE8FF' : e.outcome === 'counter' ? '#FF6A4A' : '#FFE08A');
      sparkT = e.blocked ? 0.12 : 0.2;
      if (!e.blocked) fightMode.hitStop = e.outcome === 'counter' || m.launch ? 0.09 : 0.05;   // a beat's pause, for weight
    }
  };
  return { fightMode, kavikRoot, get RING() { return RING; }, set RING(v) { RING = v; }, DOJO_RING, fightFx, ringPt, get sparkT() { return sparkT; }, set sparkT(v) { sparkT = v; }, spark, sparkMat, fightCam, openFight, talkToKavik };
}
