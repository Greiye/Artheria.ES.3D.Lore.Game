// B4: the Mage's magic missile, taught by Magister Greer (src/missile.ts). Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { audio } from '../audio';
import { MagicMissile } from '../missile';
import { haptics } from '../input/haptics';
import { storeSet } from '../store';
import type { MageDeps } from '../main';

export function setupMage(deps: MageDeps) {
  const MISSILE_KEY = 'gametool.missile';
  const missile = new MagicMissile(deps.world.scene, deps.world.solids, (x, z) => deps.player.terrain(x, z));
  const isMage = () => deps.character.profession === 'mage';
  missile.targets = (from, dir, len) => {
    const h = deps.goblins.list.length ? deps.goblins.hitTest(from, dir, len) : null;
    return h && { dist: h.dist, hit: (dmg, d) => { haptics.play('hit'); return deps.goblins.shoot(h.foe, dmg, d); } };
  };
  missile.foes = () => deps.goblins.alive.map((f) => f.root.position);
  try { if (localStorage.getItem(MISSILE_KEY) === '1') missile.learn(); } catch { /* storage blocked: unlearned */ }
  function learnMissile() {
    if (!missile.learned) { missile.learn(); storeSet(MISSILE_KEY, '1'); }
    setTimeout(() => deps.toast(`You know magic missile. Cast it with Z (LB on a pad).`, 3500), 400);
  }
  let castToldAt = 0;
  function castMissile() {
    if (!isMage() || deps.state !== 'play' || deps.player.piloting) return;
    const tell = (m: string) => { if (performance.now() - castToldAt > 1500) { castToldAt = performance.now(); deps.toast(m, 1600); } };
    if (!missile.learned) { tell('You have no spell yet. Magister Greer, by the coach road, teaches mages.'); return; }
    const dir = new THREE.Vector3(); deps.player.lookDir(dir);
    if (!missile.cast(deps.player.eyePos.clone().addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.15, 0)), dir)) return;
    audio.blip(); haptics.play('tap'); deps.gesture('wave');
    deps.techHud();
  }
  return { isMage, missile, castMissile, learnMissile };
}
