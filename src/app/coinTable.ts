// B55: Tam's coin table beside the Inn, a coin-flip wager (src/coinflip.ts). Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { station } from '../stations';
import { CROWN } from '../shop';
import { pixelTexture } from '../tex/pixel';
import { mergeMeshes } from '../world/mergeMeshes';
import { CoinTable } from '../coinflip';
import { signBoard } from '../world/regions';
import type { CoinTableDeps } from '../main';

export function setupCoinTable(deps: CoinTableDeps) {
  const coinTable = station(new CoinTable());
  const COIN_AT = (() => {
    const door = deps.world.town.doors.inn, at = deps.outFrom(door, 5.5, 3), ry = door.rotation.y;
    const g = new THREE.Group(); g.name = 'coin-table'; g.position.set(at.x, deps.world.heightAt(at.x, at.z), at.z); g.rotation.y = ry;
    const wood = new THREE.MeshLambertMaterial({ color: '#7A5634', map: pixelTexture('wood') }), felt = new THREE.MeshLambertMaterial({ color: '#2E5A3A' });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 14), wood); top.position.y = 0.78; top.castShadow = top.receiveShadow = true; g.add(top);
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.01, 14), felt); cloth.position.y = 0.815; g.add(cloth);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.76, 8), wood); leg.position.y = 0.38; leg.castShadow = true; g.add(leg);
    const gold = new THREE.MeshLambertMaterial({ color: '#E2B567', emissive: '#4A3210' });
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 10), gold); c.position.set(0.18 + (i % 2) * 0.01, 0.825 + i * 0.009, -0.12); g.add(c); }
    const flat = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 10), gold); flat.position.set(-0.1, 0.824, 0.08); g.add(flat);
    for (const [x, z] of [[0, -0.85], [0, 0.85]]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8), wood); st.position.set(x, 0.225, z); st.castShadow = true; g.add(st); }
    const sign = signBoard('Heads or Tails · 1:1', 1.1, 0.3); sign.position.set(0, 1.25, 0); g.add(sign);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), wood); pole.position.set(0, 1.0, 0); g.add(pole);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.7; hit.name = 'coin-hit'; g.add(hit);
    mergeMeshes(g);
    deps.world.scene.add(g);
    deps.world.colliders.push({ kind: 'circle', x: at.x, z: at.z, r: 0.6 });
    return { group: g, hit, at };
  })();
  function openCoinTable() {
    deps.groups.mark('npc', 'tam');
    deps.enterForge();
    coinTable.open(() => deps.inventory.count(CROWN), (d) => { if (d > 0) deps.inventory.give(CROWN, d); else if (d < 0) deps.inventory.take(CROWN, -d); }, () => deps.leaveForge());
  }
  deps.interactables.push({ obj: COIN_AT.hit, verb: () => deps.sideGate("Flip a coin at Tam's table"), when: () => !deps.inDungeon, act: () => deps.sideGo(openCoinTable) });
  return { COIN_AT, coinTable, openCoinTable };
}
