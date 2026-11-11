// B56 (Mike 2026-11-06): the portal to the modern world and travel between maps. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters (PortalDeps), so nothing is read before it exists.
import * as THREE from 'three';
import { type DialogueScript } from '../dialogue';
import { pixelTexture } from '../tex/pixel';
import { REGIONS, TOWN_EXITS, MODERN_FRIENDS, swirlTexture, type RegionId } from '../world/regions';
import { randomCharacterSpec } from '../morph/spec';
import { assemble } from '../morph/assemble';
import type { PortalDeps } from '../main';

export function setupPortal(d: PortalDeps) {
  // Beside the Cartographer's: a standing stone ring with a purple swirl. Through it (after the first day, like the side
  // games) is one modern flat (src/world/regions.ts 'modern') with Josh, Jason, Liv and Rev; the portal there brings you
  // back here. The friends are B57 assembled people; their looks are placeholders until they say how they want to look.
  const PORTAL = (() => {
    const door = d.world.town.doors.cartographer, at = d.outFrom(door, 3.2, 3.5), ry = door.rotation.y;
    const g = new THREE.Group(); g.name = 'portal'; g.position.set(at.x, d.world.heightAt(at.x, at.z), at.z); g.rotation.y = ry;
    const stone = new THREE.MeshLambertMaterial({ color: '#8C8478', map: pixelTexture('mossStone') });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.14, 8, 24), stone); ring.position.y = 1.2; ring.castShadow = true; g.add(ring);
    for (const x of [-0.75, 0.75]) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.45), stone); foot.position.set(x, 0.15, 0); foot.castShadow = true; g.add(foot); }
    const swirl = swirlTexture();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ map: swirl, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    disc.position.y = 1.2; disc.name = 'portal-swirl'; g.add(disc);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.0), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.2; hit.name = 'portal-hit'; g.add(hit);
    d.world.scene.add(g);
    d.world.colliders.push({ kind: 'box', minX: at.x - 0.5, maxX: at.x + 0.5, minZ: at.z - 0.5, maxZ: at.z + 0.5 });
    REGIONS.modern.home = { at: [at.x + Math.sin(ry) * 1.6, at.z + Math.cos(ry) * 1.6], yaw: ry + Math.PI };
    return { group: g, hit, swirl, at };
  })();
  d.interactables.push({ obj: PORTAL.hit, verb: () => d.sideGate('Step through the portal'), when: () => !d.inDungeon && d.regions.current === 'town' && !travelling, act: () => d.sideGo(() => travel('modern')) });
  const modernFriends: { id: string; name: string; root: THREE.Object3D; hit: THREE.Mesh }[] = [];
  function friendSpec(seed: number, i: number) {
    const s = randomCharacterSpec(seed);
    const TOPS = ['#3A5A7A', '#7A3A3A', '#3A6A4A', '#5A4A7A'], LEGS = ['#2E3E5E', '#3A3A3E', '#4A5A7A', '#2A2A2E'];
    s.parts.top.color = TOPS[i % 4]; s.parts.bottom = { id: '01', color: LEGS[i % 4] }; s.parts.shoes.color = i % 2 ? '#E8E8E8' : '#2A2A2A';
    s.parts.hat = { id: '', color: s.parts.hat.color };   // indoors
    return s;
  }
  function addFriends() {
    const g = d.regions.groups.get('modern'); if (!g) return;
    MODERN_FRIENDS.forEach((f, i) => {
      const root = assemble(friendSpec(f.seed, i));
      root.position.set(f.at[0], f.pose === 'sit' ? 0.02 : 0, f.at[1]); root.rotation.y = f.yaw;
      root.name = 'friend-' + f.id; root.userData.friend = f.id; root.userData.pose = f.pose;
      g.add(root);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(f.at[0], 0.95, f.at[1]); g.add(hit);
      const id = 'modern:' + f.id;
      d.puppets.set(id, d.figureOf(root));
      d.interactables.push({ obj: hit, verb: () => `Talk to ${f.name}`, when: () => d.regions.current === 'modern' && !travelling, act: () => d.talkTo(id, hit.getWorldPosition(new THREE.Vector3()), friendScript(f)) });
      modernFriends.push({ id: f.id, name: f.name, root, hit });
    });
  }
  function friendScript(f: (typeof MODERN_FRIENDS)[number]): DialogueScript {
    return { speaker: f.name, portrait: f.id, start: 'hi', nodes: {
      hi: { text: f.hello, choices: [
        { text: 'What is this place?', next: 'place' },
        { text: 'How do I get back?', next: 'back' },
        { text: 'See you around.', next: 'bye' },
      ] },
      place: { text: "Our world. Phones, buses, bills. Mike writes Aralon down and we read it. Now it reads us back, apparently.", next: 'hi' },
      back: { text: 'The ring on the wall. Step into the swirl and you are back by the Cartographer\'s.', next: 'hi' },
      bye: { text: 'Come back any time. The portal remembers you.', end: true },
    } };
  }
  let travelling = false;
  const REGION_KEY = 'gametool.region';
  const savedRegion = (): RegionId => { try { const r = localStorage.getItem(REGION_KEY) as RegionId | null; return r && (r === 'town' || r in REGIONS) ? r : 'town'; } catch { return 'town'; } };
  function placeIn(to: RegionId, from: RegionId) {
    const old = from === 'town' ? null : d.regions.colliders.get(from);
    if (old) { const set = new Set(old); for (let i = d.world.colliders.length - 1; i >= 0; i--) if (set.has(d.world.colliders[i])) d.world.colliders.splice(i, 1); }
    d.regions.show(to);
    d.addRegionSpots(to);
    const fog = d.world.scene.fog as THREE.Fog;
    if (to === 'town') {
      d.player.bounds = d.rig.bounds = d.companion.bounds = d.world.bounds;
      d.world.sky.setCentre(new THREE.Vector3());
      d.world.setTime(d.world.time);   // puts the town's fog back
      const side = from === 'town' ? 'north' : REGIONS[from].side, e = TOWN_EXITS[side], home = from === 'town' ? undefined : REGIONS[from].home;
      const at = home ? new THREE.Vector3(home.at[0], d.world.heightAt(home.at[0], home.at[1]), home.at[1]) : new THREE.Vector3(e.inside[0], 0, e.inside[1]);
      d.player.spawn(at, home ? home.yaw : e.yaw);
      if (d.companion.prefs.follow) d.natalieRoot().position.copy(at).add(new THREE.Vector3(1.2, 0, 1.2));
      for (const p of d.pets) if (p.following) p.placeNear(at);
    } else {
      const r = REGIONS[to];
      d.world.colliders.push(...(d.regions.colliders.get(to) ?? []));
      d.player.bounds = d.rig.bounds = d.companion.bounds = 2000;
      d.world.sky.setCentre(new THREE.Vector3(r.origin.x, 0, r.origin.z));   // the dome round the map (the clifftop sees the town inside it)
      if (r.fogFar) { fog.far = r.fogFar; fog.near = r.fogFar * 0.5; }
      const at = r.origin.clone().add(r.arrive);
      d.player.spawn(at, r.arriveYaw);
      if (d.companion.prefs.follow) d.natalieRoot().position.copy(at).add(new THREE.Vector3(1.2, 0, 1.2));
      for (const p of d.pets) if (p.following) p.placeNear(at);
    }
    try { localStorage.setItem(REGION_KEY, to); } catch { /* private mode */ }
  }
  /** Walk out to `to` (or home): the load screen covers the move, then lifts. */
  function travel(to: RegionId, instant = false, byWagon = false) {
    if (travelling || d.inDungeon || to === d.regions.current) return;
    const from = d.regions.current;
    if (instant) { placeIn(to, from); if (byWagon) d.atWagon(to); return; }
    travelling = true;
    const r = to === 'town' ? null : REGIONS[to];
    d.player.speedMul = 0;
    const line = byWagon ? `By wagon from ${d.placeName(from)}: wheels, ruts, a mule that hums. ${r ? r.line : 'Home to Aralon.'}` : r ? r.line : 'Back down the road, home to the glade.';
    d.loadScreen.show(r ? r.name : 'Aralon', line, () => { placeIn(to, from); if (byWagon) d.atWagon(to); }, () => {
      travelling = false; d.player.speedMul = 1;
      if (byWagon) d.toast(`${d.placeName(to)}. The wagon waits here to take you back.`, 4200);
      else if (r) d.toast(`${r.name}. ${r.backHint ?? 'The waystone by the path leads back to Aralon.'}`, 4200);
    });
  }
  return { savedRegion, placeIn, PORTAL, REGION_KEY, get travelling() { return travelling; }, travel, addFriends, modernFriends };
}
