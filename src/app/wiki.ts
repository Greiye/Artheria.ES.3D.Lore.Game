// B21: the GitHub wiki at the reading room lectern, the phrasebook, and the ruin's reading room props. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { lore } from '../lore';
import { station } from '../stations';
import { WikiPanel, buildWikiLectern } from '../wiki';
import { haptics } from '../input/haptics';
import { CROWN } from '../shop';
import type { WikiDeps } from '../main';

export function setupWiki(deps: WikiDeps) {
  const wiki = station(new WikiPanel());
  const wikiLectern = buildWikiLectern(deps.library.group, deps.world.colliders);
  function openWiki() { if (deps.state !== 'play') return; deps.enterForge(); wiki.open(() => deps.leaveForge(), 'library'); }
  deps.interactables.push({ obj: wikiLectern, verb: () => 'Read the wiki', act: () => openWiki(), when: () => !deps.inDungeon });
  function openPhrasebook() { if (deps.state !== 'play' && deps.state !== 'pause') return; deps.enterForge(); deps.phrasebook.open(); }
  deps.interactables.push({ obj: deps.trapHit, verb: () => deps.sideGate('Go down the stairs'), act: () => deps.sideGo(deps.openDescend), when: () => !deps.inDungeon });
  const shrineLines = lore.entries.filter((e) => e.type === 'lore' && e.body.length > 80);
  for (const hit of (deps.dungeon as unknown as { hits: THREE.Mesh[] }).hits) {
    const spotOf = () => deps.dungeon.spots.find((s) => s.hit === hit);
    deps.interactables.push({ obj: hit, when: () => deps.inDungeon && !!spotOf(), verb: () => {
      const s = spotOf()!, d = deps.delves[deps.dungeon.layout!.seed];
      if (s.kind === 'down') return `Go down to floor ${(deps.descent?.floor ?? 0) + 1}`;
      if (s.kind === 'hoard') return deps.descent?.hoard ? 'The hoard (in your bag now)' : "Take the dragon's hoard";
      if (s.kind === 'camp') return deps.descent?.rested ? 'The camp fire (rested)' : 'Rest at the camp';
      return s.kind === 'stairs' ? (deps.descent ? `Climb out (floor ${deps.descent.floor})` : 'Climb back up') : s.kind === 'chest' ? (d?.chest ? 'An empty chest' : 'Open the chest') : s.kind === 'shrine' ? 'Read the carving' : 'Search the nest';
    }, act: () => {
      const s = spotOf()!, seed = deps.dungeon.layout!.seed, d = deps.delves[seed];
      if (s.kind === 'stairs') { deps.exitDungeon(); return; }
      if (s.kind === 'down') { deps.goDown(); return; }
      if (s.kind === 'camp') {
        if (!deps.descent || deps.descent.rested) { deps.toast('You have rested here already. The stairs are waiting.', 2400); return; }
        deps.descent.rested = true; if (!deps.imbued('hunger')) deps.delveHp = Math.max(deps.delveHp, deps.DELVE_HP);
        deps.gear.st.rust = 0; deps.gear.st.string = 1; deps.gear.st.sharp = Math.max(deps.gear.st.sharp, 0.85); deps.gear.save(); deps.gear.onChange();
        haptics.play('pickup');
        deps.toast(deps.imbued('hunger') ? 'You rest by the fire, but the hungry edge keeps your wounds open. The blade is oiled, the crossbow restrung.' : `You rest by the fire: wounds bound (♥ ${deps.DELVE_HP}/${deps.DELVE_HP}), the blade oiled, the crossbow restrung.`, 4800);
        return;
      }
      if (s.kind === 'hoard') {
        if (!deps.descent || deps.descent.hoard) return;
        deps.descent.hoard = true; deps.inventory.give(CROWN, 250); haptics.play('pickup'); deps.gesture('pickup');
        deps.toast('The hoard: more gold than the whole of Aralon, and a crown on top. Now get it out alive. The stairs up are back at the start.', 6500);
        deps.companion.say('It was true. Oh, it was all true. Go, go!', { force: true });
        return;
      }
      if (s.kind === 'chest') {
        if (d.chest) { deps.toast('Empty. You already took what was here.'); return; }
        d.chest = true; deps.saveDelves();
        deps.inventory.give('trinket', 1); haptics.play('pickup'); deps.gesture('pickup');
        deps.hint(`A trinket from below! Into the bag with it (${deps.keyName('bag')}). Magister Greer would love its story.`, 'A trinket from below (I: inventory). Magister Greer would love to hear its story.', 4500);
        setTimeout(() => { if (deps.inDungeon) deps.dropLoreBook('under the trinket', seed); }, 4700);   // B48
        return;
      }
      if (s.kind === 'shrine') {
        const e = shrineLines[(seed + s.room.cx * 7 + s.room.cy) % shrineLines.length];
        const line = e.body.replace(/^#.*$/gm, '').replace(/[*_>[\]]/g, '').trim().split(/(?<=[.!?])\s+/)[0];
        deps.toast(`Carved in the stone: “${line}” (${e.title}, by ${e.credit_as})`, 7000);
        return;
      }
      d.nest = true; deps.saveDelves();
      deps.toast('The goblin\'s nest: a heap of red-book covers, gnawed at the corners, and four tally marks scratched by the door. A fifth is crossed out.', 7000);
      deps.companion.say('This is where it sleeps. It keeps them like treasure.', { force: true });
    } });
  }
  return { wiki, shrineLines, openPhrasebook, openWiki };
}
