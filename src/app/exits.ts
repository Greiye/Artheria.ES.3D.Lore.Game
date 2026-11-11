// The four town exits, one per side, each to its own map after a load screen. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import { haptics } from '../input/haptics';
import { REGIONS, TOWN_EXITS, signpost, type RegionId, type Side } from '../world/regions';
import { LoadScreen } from '../ui/loadscreen';
import type { ExitsDeps } from '../main';

export function setupExits(d: ExitsDeps) {
  const loadScreen = new LoadScreen();
  for (const side of Object.keys(TOWN_EXITS) as Side[]) {
    if (side === 'west') continue;   // the coach-road gate has its own sign
    const e = TOWN_EXITS[side], post = signpost(REGIONS[e.to].name);
    const [ix, iz] = e.inside;
    const sx = side === 'east' ? 0 : 2.2, sz = side === 'east' ? 2.2 : 0;   // beside the path, just inside the edge
    post.position.set(ix + sx, d.world.heightAt(ix + sx, iz + sz), iz + sz);
    post.rotation.y = e.yaw + Math.PI;   // the board faces you as you walk out
    post.name = 'exit-sign-' + side;
    d.world.scene.add(post);
  }
  const regionSpotsAdded = new Set<string>();
  function addRegionSpots(id: RegionId) {
    if (id === 'town' || regionSpotsAdded.has(id)) return;
    regionSpotsAdded.add(id);
    if (id === 'modern') d.addFriends();
    for (const sp of d.regions.spots.get(id) ?? []) d.interactables.push({ obj: sp.hit, verb: () => sp.verb, when: () => d.regions.current === id && !d.portalM.travelling, act: () => {
      if (sp.kind === 'back') { d.travel('town'); return; }
      if (sp.kind === 'wagon') { d.openWagon(); return; }   // B54
      if (sp.kind === 'gate') haptics.play('tap');
      d.toast(sp.line ?? '', 5200);
    } });
  }
  return { addRegionSpots, loadScreen };
}
