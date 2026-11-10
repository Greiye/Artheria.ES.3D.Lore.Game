// B7: the living map. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { station } from '../stations';
import { QUEST, clueById } from '../quest/quest';
import { loadBallads } from '../campfire/ballad';
import { DOJO } from '../dojo/dojo';
import { PERCH } from '../sky/perch';
import { RANGE } from '../world/archery';
import { CARAVAN } from '../spanish/caravan';
import { TEAHOUSE } from '../langs/japanese';
import { PALENGKE } from '../langs/tagalog';
import { SKILL_TABLE } from '../skills/skills';
import { LivingMap, type Mark, type Sight } from '../map/livingmap';
import { TOWN_NAMES, TOWN_LOTS } from '../world/town';
import { REGIONS, TOWN_EXITS, type Side } from '../world/regions';
import { FLOORS } from '../delve/descent';
import type { LivingMapDeps } from '../main';

export function setupLivingMap(deps: LivingMapDeps) {
  const livingMap = station(new LivingMap(() => {
    const m: Mark[] = [];
    for (const id of deps.quest.clues) { const c = clueById(id); if (c) m.push({ x: c.at[0], z: c.at[2], label: '', kind: 'clue' }); }
    if (deps.quest.theory) {
      const l = (QUEST.leads as Record<string, { at: number[]; friend: string }>)[deps.quest.theory.where];
      if (l) m.push({ x: l.at[0], z: l.at[2], label: deps.quest.stage === 'done' ? `${l.friend} found here` : 'your lead', kind: deps.quest.stage === 'done' ? 'found' : 'lead' });
    }
    const bd = loadBallads();
    if (bd.length) m.push({ x: deps.world.stations.campfire.position.x, z: deps.world.stations.campfire.position.z + 1.6, label: `“${bd[0].title}” sung here`, kind: 'song' });
    const n = Object.keys(deps.delves).length;
    if (n) m.push({ x: deps.TRAPDOOR.x, z: deps.TRAPDOOR.z, label: `${n} seed${n > 1 ? 's' : ''} delved`, kind: 'delve' });
    const nCards = Object.keys(deps.skills.st.cards).length;
    if (nCards) m.push({ x: SKILL_TABLE.x, z: SKILL_TABLE.z + 2.6, label: `${nCards} skill card${nCards > 1 ? 's' : ''}`, kind: 'place' });
    if (deps.caravan.st.done.length) m.push({ x: CARAVAN.x, z: CARAVAN.z + 2.6, label: `${deps.caravan.st.phrases.length} phrases`, kind: 'place' });
    if (deps.dojo.st.done.length) m.push({ x: DOJO.x, z: DOJO.z + 3.4, label: `${deps.dojo.st.done.length} drill${deps.dojo.st.done.length > 1 ? 's' : ''} done`, kind: 'place' });
    return m;
  }, () => ({ x: deps.player.pos.x, z: deps.player.pos.z, yaw: deps.player.yaw }), () => deps.leaveForge(), deps.forgeAuthor, () => mapSights(),
    TOWN_LOTS.map((l) => ({ ...l, name: TOWN_NAMES[l.id] })),
    (Object.keys(TOWN_EXITS) as Side[]).map((side) => { const e = TOWN_EXITS[side]; return { x: e.at[0], z: e.at[1] + (side === 'east' || side === 'west' ? -5 : 0), label: `${side === 'north' ? '↑' : side === 'south' ? '↓' : side === 'east' ? '→' : '←'} ${REGIONS[e.to].name}`, shut: e.to === 'ranlean' || e.to === 'amethyst' }; })));
  /** Mike 2026-11-05: everything there is to do, marked on the map from the start so a new player can see it. */
  function mapSights(): Sight[] {
    const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const st = deps.world.stations, nat = at(deps.natalieRoot()), kv = at(deps.kavikRoot), kp = deps.knight.root.position;
    return [
      deps.knight.awake ? { x: kp.x, z: kp.z, icon: '⚙', label: 'Knight frame', note: 'A ten-foot rune mech. Climb in and pilot it (E).' }
        : { x: kp.x, z: kp.z, icon: '⚙', label: 'Knight frame (asleep)', note: 'A rune mech kneeling in the trees. Clear floor 3 of the descent to wake it.', locked: true },
      { x: RANGE.x, z: RANGE.z, icon: '➶', label: "Candor's range", note: 'Candor teaches archery: three straw butts, one bolt in each.' },
      { x: PERCH.x, z: PERCH.z, icon: '✈', label: 'Skyrunner perch', note: 'Fly a glider from A to B in about a minute. Sometimes a dogfight.' },
      { x: deps.TRAPDOOR.x, z: deps.TRAPDOOR.z, icon: '▼', label: 'The descent', note: `Stone stairs down from the library floor: ${FLOORS} floors of goblins, lost lore books and a hoard. One life.` },
      { x: nat.x, z: nat.z, icon: '❦', label: 'Natalie', note: 'The warner by the library. Lore books, quests and the crossbow.' },
      { x: st.campfire.position.x, z: st.campfire.position.z, icon: '♨', label: 'Camp', note: 'The campfire (write lore, tell stories, play music), the mirror (make your hero), the anvil (forge a weapon) and the sketchbook (draw your banner).' },
      { x: kv.x, z: kv.z, icon: '✊', label: 'Kavik', note: 'Spar with him (best of 3). Drills in the dojo.' },
      { x: CARAVAN.x, z: CARAVAN.z, icon: '⛺', label: 'Caravan', note: 'Travellers who teach you Spanish phrases.' },
      { x: TEAHOUSE.x, z: TEAHOUSE.z, icon: '🍵', label: 'Tea house', note: 'A tea seller, a potter and a fisher who speak only Japanese.' },   // B23
      { x: PALENGKE.x, z: PALENGKE.z, icon: '🥭', label: 'Market corner', note: 'A fruit seller, a fisherman, Lola and a child who speak only Tagalog.' },   // B23
      { x: SKILL_TABLE.x, z: SKILL_TABLE.z, icon: '✦', label: 'Practice table', note: 'Skill cards: practise and level up.' },
      { x: deps.GRIND.x, z: deps.GRIND.z, icon: '◎', label: 'Grindstone', note: 'Sharpen your blade.' },
      { x: deps.reelScreen.position.x, z: deps.reelScreen.position.z, icon: '▶', label: 'Cinema', note: 'Watch reels on the town screen.' },
      { x: deps.killStatue.group.position.x, z: deps.killStatue.group.position.z, icon: '♛', label: 'Record statue', note: 'The most goblins beaten in one delve.' },
      { x: deps.COIN_AT.at.x, z: deps.COIN_AT.at.z, icon: '◎', label: "Tam's coin table", note: 'Heads or tails for crowns: a fair coin at even odds, stakes 1 to 20.', ...(deps.firstDay.sideGamesOpen ? {} : { locked: true }) },   // B55
      { x: deps.PORTAL.at.x, z: deps.PORTAL.at.z, icon: '◍', label: 'Portal', note: "Through to the modern world: a flat where Josh, Jason, Liv and Rev are.", ...(deps.firstDay.sideGamesOpen ? {} : { locked: true }) },   // B56
    ];
  }
  function openMap() { if (deps.state !== 'play' && deps.state !== 'pause') return; deps.groups.mark('station', 'map'); deps.enterForge(); livingMap.open(); }
  let mapClock = 0;
  return { openMap, get mapClock() { return mapClock; }, set mapClock(v) { mapClock = v; }, livingMap };
}
