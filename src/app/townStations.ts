// Town stations: forge preview turning, the General Store, the smith's counter, rock piles, door saves, the cinema, town sounds. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { audio } from '../audio';
import { buildCinemaSpot } from '../world/cinema-spot';
import { townZones, FolkVoices } from '../world/soundscape';
import { station } from '../stations';
import { GALLERY } from '../campfire/gallery';
import { haptics } from '../input/haptics';
import { buildShield } from '../shield';
import { ShopPanel } from '../shop';
import { CinemaPanel } from '../cinema';
import { TOWN_NAMES, GATE, FOUNTAIN, TOWN_LOTS, type TownId } from '../world/town';
import { mergeMeshes } from '../world/mergeMeshes';
import { hasGift } from '../delve/descent';
import { Ambience } from '../ambience';
import { NEXT_TIME } from '../world/sky';
import type { TownStationsDeps } from '../main';

export function setupTownStations(deps: TownStationsDeps) {
  // Drag on the scene to turn the hero (character forge).
  let forgeDrag: number | null = null, forgeDragY = 0;
  deps.canvas.addEventListener('pointerdown', (e) => { if (deps.state === 'forge') { forgeDrag = e.clientX; forgeDragY = e.clientY; } });
  window.addEventListener('pointerup', () => { forgeDrag = null; });
  deps.canvas.addEventListener('contextmenu', (e) => { if (deps.state === 'forge') e.preventDefault(); });
  window.addEventListener('pointermove', (e) => {
    if (deps.state !== 'forge' || forgeDrag === null) return;
    const dx = e.clientX - forgeDrag, dy = e.clientY - forgeDragY;
    forgeDrag = e.clientX; forgeDragY = e.clientY;
    if (deps.weaponForge.isOpen) turnWeapon(dx * 0.012, dy * 0.008);   // v0.06 S4: let go and it stays at that angle
    else if (deps.characterForge.isOpen) { deps.player.bodyYaw += dx * 0.012; deps.player.body.rotation.y = deps.player.bodyYaw; }
  });
  function turnWeapon(yaw: number, pitch: number) { deps.forgePreview.turn(yaw, pitch); }
  deps.interactables.push(
    { obj: deps.world.stations.mirror, verb: () => 'Change your look', act: () => deps.openCharacterForge() },
    { obj: deps.world.stations.banner, verb: () => 'Sketch at the writing desk', act: () => deps.openSketchbook() },
    { obj: deps.world.stations.anvil, verb: () => deps.inventory.count('crossbow') > 0 ? 'Forge your crossbow' : 'Anvil (bring a crossbow)', act: () => { if (deps.inventory.count('crossbow') > 0) deps.openWeaponForge(); else deps.toast('Natalie has a crossbow you could borrow.'); } },
  );
  // v0.04 town: one building per tool. E at a door opens it; the shopkeeper trades at the counter.
  const shop = station(new ShopPanel(deps.inventory, () => deps.leaveForge()));
  function openShop() {
    deps.groups.mark('npc', 'shopkeeper');   // B52
    deps.enterForge();
    const k = deps.world.town.shopkeeper.position, top = new THREE.Vector3(k.x, 1.3, k.z);
    const ry = deps.world.town.shopkeeper.rotation.y, c = Math.cos(ry), sn = Math.sin(ry);
    const pos = new THREE.Vector3(k.x - 2.6 * c + 3.0 * sn, 1.7, k.z + 2.6 * sn + 3.0 * c);   // from the side, past the player's shoulder
    const d = top.clone().sub(pos).normalize(), right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    deps.rig.setShot({ pos, look: top.addScaledVector(right, -0.7), fov: 44 });
    shop.open();
  }
  // Mike 2026-11-05: the smith's counter by the smithy door sells arms (shields; more in later rounds).
  const smithShop = station(new ShopPanel(deps.inventory, () => deps.leaveForge(), true));
  smithShop.discount = hasGift(deps.record.delivered, 'smith') ? 0.75 : 1;   // F2 the patrons' gift
  smithShop.onBuy = (id) => {
    haptics.play('pickup');
    // A new shield goes straight onto a free hand (the left, unless it holds something you'd miss).
    if ((id === 'shield' || id === 'buckler') && (deps.hands.held.left === 'none' || deps.hands.held.left === 'torch')) { deps.hands.set('left', id); deps.beforeTorch = 'none'; }
  };
  const smithCounter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
  smithCounter.name = 'smith-counter';
  const SMITH_LOT = TOWN_LOTS.find((l) => l.id === 'smithy')!;
  { // in front of the smithy, between the sword stand (front left) and the grindstone (front right)
    const L = SMITH_LOT, c = Math.cos(L.ry), sn = Math.sin(L.ry), lx = -L.w / 2 + 1.9, lz = L.d / 2 + 0.9;
    smithCounter.position.set(L.x + lx * c + lz * sn, 0.75, L.z - lx * sn + lz * c);
    smithCounter.userData.front = [sn, c];   // the way out to the street (for tests and the camera)
  }
  deps.world.scene.add(smithCounter);
  { // the wares on show: a rack with the round shield and the buckler hung on it
    const rack = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: '#5A3A22' });
    const post = (x: number) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), wood); p.position.set(x, 0.6, 0); rack.add(p); };
    post(-0.45); post(0.45);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), wood); bar.position.y = 1.15; rack.add(bar);
    const big = buildShield('shield'); big.position.set(-0.2, 0.8, 0.08); rack.add(big);
    const small = buildShield('buckler'); small.position.set(0.28, 0.82, 0.08); rack.add(small);
    rack.position.copy(smithCounter.position).setY(0);
    rack.rotation.y = SMITH_LOT.ry;   // facing the street
    rack.traverse((o) => { (o as THREE.Mesh).raycast = () => {}; });
    deps.world.scene.add(rack);
  }
  // Mike 2026-11-05: rock piles about town: E gathers a handful (for throwing, or the sling).
  const rockPiles: THREE.Object3D[] = [];
  {
    const geo = new THREE.IcosahedronGeometry(0.11, 0), mat = new THREE.MeshLambertMaterial({ color: '#8C8780' });
    const spots: [number, number][] = [[FOUNTAIN.x + 3.2, FOUNTAIN.z + 2.6], [GATE.x + 3.5, GATE.z + 3.2], [smithCounter.position.x + smithCounter.userData.front[0] * 2 + 1.5, smithCounter.position.z + smithCounter.userData.front[1] * 2]];
    spots.forEach(([x, z], k) => {
      const pile = new THREE.Group(); pile.name = 'rock-pile';
      for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(geo, mat); const a = i * 2.4 + k; r.position.set(Math.cos(a) * 0.18 * (i % 3), 0.08 + (i > 4 ? 0.12 : 0), Math.sin(a) * 0.18 * (i % 3)); r.rotation.set(a, a * 1.3, 0); r.scale.setScalar(0.8 + (i % 3) * 0.2); r.castShadow = true; pile.add(r); }
      pile.position.set(x, 0, z);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.3; hit.name = 'rock-pile'; pile.add(hit);
      mergeMeshes(pile);
      pile.traverse((o) => { if (o !== hit) (o as THREE.Mesh).raycast = () => {}; });
      deps.world.scene.add(pile); rockPiles.push(hit);
      deps.interactables.push({ obj: hit, verb: () => 'Gather rocks', act: () => { deps.inventory.give('rock', 5); haptics.play('pickup'); deps.gesture('pickup'); deps.toast('Five good throwing stones.', 1600); }, when: () => !deps.inDungeon });
    });
  }
  deps.interactables.push({ obj: smithCounter, verb: () => 'Buy arms from the smith', act: () => { deps.groups.mark('npc', 'smith'); deps.enterForge(); smithShop.open(); }, when: () => !deps.inDungeon });
  /** A point `ahead` metres out of a town door, on the ground. */
  const outOfDoor = (id: TownId, ahead: number) => { const d = deps.world.town.doors[id]; return new THREE.Vector3(d.position.x + Math.sin(d.rotation.y) * ahead, 0, d.position.z + Math.cos(d.rotation.y) * ahead); };
  const townAct: Record<TownId, () => void> = {
    library: () => { const p = deps.player.pos; void deps.openBook(new THREE.Vector3(p.x - Math.sin(deps.player.yaw) * 0.45, 1.25, p.z - Math.cos(deps.player.yaw) * 0.45)); },
    smithy: () => { if (deps.inventory.count('crossbow') > 0) deps.openWeaponForge(outOfDoor('smithy', 0.8)); else deps.toast('The smith works on crossbows. Natalie has one you could borrow.'); },
    tailor: () => deps.openCharacterForge(),
    scriptorium: () => deps.openSketchbook('body'),
    cartographer: () => deps.openMap(),
    dojo: () => deps.openDojo(),
    gallery: () => { deps.player.spawn(new THREE.Vector3(GALLERY.minX - 1.2, 0, GALLERY.z), -Math.PI / 2); deps.toast('Through the back door and down the lane: the gallery hall.'); },
    shop: () => openShop(),
    inn: () => { if (!deps.inDungeon) deps.sleep(); },
  };
  // UX pass: every door you go through saves the game.
  for (const id of Object.keys(townAct) as TownId[]) { const go = townAct[id]; townAct[id] = () => { go(); deps.autoSave(); }; }
  for (const id of Object.keys(townAct) as TownId[]) {
    deps.interactables.push({ obj: deps.world.town.doors[id], verb: () => id === 'inn' ? `Rent a bed until ${deps.WAKE_AT[NEXT_TIME[deps.world.time]]}` : `Enter the ${TOWN_NAMES[id]}`, act: () => townAct[id]() });
  }
  deps.interactables.push({ obj: deps.world.town.shopkeeperHit, verb: () => 'Trade with the Shopkeeper', act: () => openShop() });
  // v0.04 cinema: the Projectionist (a placeholder, never in the lore) shows short reels by Mike and friends
  // (assets/cinema/) on a screen in a gap of the town ring.
  const { reelScreen, projectionistHit } = buildCinemaSpot(deps.world);
  const cinema = station(new CinemaPanel(reelScreen, () => deps.leaveForge()));
  function openCinema() { deps.groups.mark('station', 'cinema'); deps.enterForge(); cinema.open(); }
  // v0.06 T3: the reels' sound comes from the screen; the fire's music from the fire.
  cinema.onVideo = (v) => { const p = reelScreen.position; audio.attachMedia(v, 'cinema', p.x, p.y, p.z, 24); };
  let fireOut: AudioNode | null = null;
  deps.campfire.out = () => (fireOut ??= audio.spatial('campfire', deps.world.stations.campfire.position.x, 0.8, deps.world.stations.campfire.position.z, 26, 'music'));
  const ambience = new Ambience(townZones(deps.world.trees));
  const folkVoices = new FolkVoices(deps.townsfolk, ambience);
  deps.interactables.push({ obj: projectionistHit, verb: () => 'Watch the Projectionist\'s reels', act: () => openCinema() });
  deps.interactables.push({ obj: reelScreen, verb: () => 'Watch the reels', act: () => openCinema() });
  return { cinema, folkVoices, outOfDoor, smithShop, reelScreen, turnWeapon, ambience, rockPiles, townAct, shop, openShop, smithCounter, openCinema };
}
