// B58 (Mike 2026-11-08): the Monk's combat deck. A meditation mat in the dojo: sit on it to edit the deck (the
// panel on the right), while the camera circles slowly and a pale copy of you stands up to show a string.
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { station } from '../stations';
import { DOJO } from '../dojo/dojo';
import { DeckPanel } from '../fight/deckPanel';
import { STEP, type Move } from '../fight/engine';
import { buildFigure, type FigureRig } from '../world/figure';
import { FigureAnim, type AnimInput, type Pose } from '../anim/procedural';
import type { MonkDeckDeps } from '../main';

// At the north edge of the dojo floor, clear of the sparring mats, the bar and the board; the camera watches from outside.
export const DECK_MAT = { x: DOJO.x + 0.6, z: DOJO.z - 2.6, y: 0.2 };

export function setupMonkDeck(deps: MonkDeckDeps) {
  const scene = deps.world.scene;
  // The mat: a round woven cushion on the dojo floor.
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.07, 14), new THREE.MeshLambertMaterial({ color: 0x8C6A3C }));
  mat.position.set(DECK_MAT.x, DECK_MAT.y + 0.035, DECK_MAT.z); mat.name = 'deck-mat'; mat.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 5, 14).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xD9B36A }));
  ring.position.y = 0.04; ring.raycast = () => {}; mat.add(ring);
  scene.add(mat);

  let view: boolean | null = null, orbit = 0;
  // The pale copy that performs a string: built when first asked for, rebuilt when your look changes.
  let ghost: { root: THREE.Group; anim: FigureAnim; of: unknown } | null = null;
  let play: { moves: Move[]; i: number; t: number } | null = null;
  function ghostFor() {
    const worn = deps.wornLook;
    if (ghost && ghost.of === worn) return ghost;
    if (ghost) { scene.remove(ghost.root); ghost.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); for (const x of [m.material].flat()) x.dispose(); } }); }
    const root = buildFigure(worn.look, worn.height);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false; m.raycast = () => {};
      m.material = [m.material].flat().map((x) => { const c = x.clone(); c.transparent = true; c.opacity = Math.min(c.opacity, 0.5); c.depthWrite = false; const e = (c as THREE.MeshLambertMaterial).emissive; if (e) { e.set(0x8FCFF5); (c as THREE.MeshLambertMaterial).emissiveIntensity = 0.55; } return c; }) as THREE.Material[];
      if ((m.material as THREE.Material[]).length === 1) m.material = (m.material as THREE.Material[])[0];
    });
    root.name = 'deck-ghost'; root.visible = false; scene.add(root);
    ghost = { root, anim: new FigureAnim(root.userData.rig as FigureRig), of: worn };
    return ghost;
  }
  const panel = station(new DeckPanel(
    (moves) => { if (!moves.length) return; const g = ghostFor(); g.root.position.set(DECK_MAT.x + 1.05, DECK_MAT.y, DECK_MAT.z + 0.5); g.root.rotation.y = -Math.PI / 2; g.root.visible = true; play = { moves, i: 0, t: -18 }; },
    () => { play = null; if (ghost) ghost.root.visible = false; if (view !== null) { deps.player.thirdPerson = view; view = null; } deps.leaveForge(); },
  ));
  function openDeck() {
    if (deps.state !== 'play' && deps.state !== 'pause') return;
    if (!deps.isMonk()) { deps.toast('A meditation mat. Monks sit here to build their combos.', 2600); return; }
    deps.enterForge();
    if (view === null) { view = deps.player.thirdPerson; deps.player.thirdPerson = true; }
    deps.player.spawn(new THREE.Vector3(DECK_MAT.x, 0, DECK_MAT.z), 0);   // facing out of the dojo, toward the camera
    orbit = 0;
    panel.open();
    frame(0);
  }
  /** A slow swing round the mat, with the figure in the open part of the screen beside the panel. */
  function frame(dt: number) {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) orbit += dt * 0.12;
    const a = Math.PI + Math.sin(orbit) * 0.55, tall = innerHeight > innerWidth, far = tall ? 4.6 : 3.9;
    const cx = DECK_MAT.x + Math.sin(a) * far, cz = DECK_MAT.z + Math.cos(a) * far;
    const rx = Math.cos(a), rz = -Math.sin(a), off = tall ? 0 : -0.6;   // main.ts slides the view right by the panel's width, so frame as if the panel were on the left
    deps.rig.setShot({ pos: new THREE.Vector3(cx, tall ? 1.9 : 1.35, cz), look: new THREE.Vector3(DECK_MAT.x + rx * off, tall ? -0.4 : 0.75, DECK_MAT.z + rz * off), fov: 44 });
  }
  /** Called every frame: the camera's circle and the copy's string. */
  function tick(dt: number) {
    mat.visible = !deps.fightMode.isOpen;   // rolled away while a spar uses the floor
    if (!panel.isOpen) return;
    frame(dt);
    if (!play || !ghost) return;
    play.t += dt / STEP;
    let m = play.moves[play.i];
    while (m && play.t >= m.startup + m.active + m.recovery) { play.t -= m.startup + m.active + Math.min(m.recovery, 14); play.i++; m = play.moves[play.i]; }
    if (!m) { if (play.t > 40) { ghost.root.visible = false; play = null; } ghost.anim.update(dt, { speed: 0, fight: true, look: null }); return; }
    const t = Math.max(0, play.t), k = t < m.startup ? (t / m.startup) * 0.5 : t < m.startup + m.active ? 0.5 : 0.5 + ((t - m.startup - m.active) / m.recovery) * 0.5;
    const inp: AnimInput = { speed: 0, fight: true, crouch: !!m.crouch && k <= 0.5, strike: play.t < 0 || m.limb === 'throw' ? null : { limb: m.limb, aim: m.aim, k: Math.min(1, k) }, look: null };
    ghost.anim.update(dt, inp);
  }
  deps.interactables.push({ obj: mat, verb: () => deps.sideGate(deps.isMonk() ? 'Meditate (combat deck)' : 'Meditation mat'), act: () => deps.sideGo(openDeck), when: () => !deps.inDungeon });
  return { deckPanel: panel, openDeck, tickDeck: tick, get deckPose(): Pose | null { return panel.isOpen ? 'meditate' : null; }, get deckPreview() { return play ? { move: play.moves[play.i]?.id ?? null, i: play.i } : null; } };
}
