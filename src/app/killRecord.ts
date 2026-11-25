// B49: most goblins in one delve, as a statue on the green near the library. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import { station } from '../stations';
import { QuickDungeon } from '../dungeon/quick';
import { dailySeed } from '../dungeon/gen';
import { haptics } from '../input/haptics';
import { CROWN } from '../shop';
import { FOUNTAIN, TOWN_LOTS } from '../world/town';
import { FLOORS, saveRecord, GIFTS, hasGift, KITS } from '../delve/descent';
import { KillStatue, loadKills, saveKills, plaqueText } from '../world/statue';
import type { KillRecordDeps } from '../main';

export function setupKillRecord(deps: KillRecordDeps) {
  const kills = loadKills();
  let runKills = 0, recordToasted = false, statueDirty = false;
  const killStatue = (() => {
    const lib = TOWN_LOTS.find((l) => l.id === 'library')!, k = 0.42;
    const x = FOUNTAIN.x + (lib.x - FOUNTAIN.x) * k, z = FOUNTAIN.z + (lib.z - FOUNTAIN.z) * k;
    const st = new KillStatue(x, z, Math.atan2(FOUNTAIN.x - x, FOUNTAIN.z - z));   // faces the fountain
    deps.world.scene.add(st.group);
    deps.world.colliders.push({ kind: 'circle', x, z, r: 0.95 });
    st.set(kills);
    return st;
  })();
  deps.interactables.push({ obj: killStatue.hit, verb: () => 'Read the plaque', act: () => deps.toast(`${plaqueText(kills)}. Goblins you've beaten in all: ${kills.total}.`, 5200), when: () => !deps.inDungeon });
  function countKill() {
    kills.total++;
    if (deps.inDungeon) {
      runKills++;
      if (runKills > (kills.best?.count ?? 0)) {
        kills.best = { count: runKills, name: deps.character.name || 'A stranger', look: JSON.parse(JSON.stringify(deps.wornLook.look)), height: deps.wornLook.height, at: new Date().toISOString().slice(0, 10) };
        statueDirty = true;
        if (!recordToasted && runKills > 1) { recordToasted = true; deps.toast('A new record for one delve! The statue on the green will show it.', 3200); }
      }
    }
    saveKills(kills);
  }
  let descendSheet: HTMLElement | null = null;
  function openDescend() {
    deps.enterForge();
    const el = document.createElement('div');
    el.className = 'gallery-card';
    el.id = 'descend';
    el.innerHTML = `<div class="card-in"><div class="credit">Under the Ruined Library</div><h3>Go down for the books?</h3>
      <p>The library is in flux: the witch in the ruins keeps it moving, and every floor is new each time you go down. They say it goes ${FLOORS} floors deep, with a dragon's hoard at the bottom. Each floor is harder. Climb out on any floor's stairs to hand Natalie the books you carry. <b>Die down there and this hero is gone</b>, with the bag, the crowns and the books on them.</p>
      <p class="fine">Deepest so far: floor ${deps.record.deepest || '-'} · books handed in: ${deps.record.delivered} · heroes lost: ${Math.max(0, deps.record.heroes - 1)}</p>
      <div class="forge-actions"><button class="primary" data-act="go">Descend to floor 1</button>${deps.friends.room && deps.multiplayerM.partyRun && deps.multiplayerM.partyRun.floor > 1 ? `<button class="primary" data-act="rope" data-floor="${deps.multiplayerM.partyRun.floor}">Join your friends on floor ${deps.multiplayerM.partyRun.floor}</button>` : ''}${deps.record.ropes.map((f) => `<button class="primary" data-act="rope" data-floor="${f}">Natalie's rope to floor ${f}</button>`).join('')}<button class="secondary" data-act="quick">Quick Dungeon (practice, nobody dies)</button></div>
      ${hasGift(deps.record.delivered, 'kit') && deps.record.kitFor !== deps.record.heroes ? `<p class="fine">The patrons' kit, one per hero:</p><div class="forge-actions">${KITS.map((k) => `<button class="secondary" data-act="kit" data-kit="${k.id}">${k.name}</button>`).join('')}</div>` : ''}
      ${deps.record.delivered ? `<p class="fine">Patrons' gifts: ${GIFTS.map((g) => deps.record.delivered >= g.at ? `<b>${g.name}</b>` : `${g.name} at ${g.at} books`).join(' · ')}</p>` : ''}
      <div class="forge-actions"><button class="secondary" data-act="close">Not yet</button></div></div>`;
    el.addEventListener('click', (ev) => {
      const a = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!a) return;
      if (a.dataset.act === 'kit') {
        const k = KITS.find((x) => x.id === a.dataset.kit);
        if (k) { for (const [id, n] of k.items) deps.inventory.give(id, n); deps.record.kitFor = deps.record.heroes; saveRecord(deps.record); haptics.play('pickup'); deps.toast(`From the patrons: ${k.name.toLowerCase()}. Choose what each hand holds in the bag.`, 3600); }
        el.remove(); descendSheet = null; deps.leaveForge(); openDescend(); return;
      }
      const seed = dailySeed();
      el.remove(); descendSheet = null;
      if (a.dataset.act === 'quick') { openQuick(seed); return; }   // stays in the forge state until the run ends
      deps.leaveForge();
      if (a.dataset.act === 'go') deps.startDescent();
      if (a.dataset.act === 'rope') deps.startDescent(Number(a.dataset.floor) || 1);
    });
    document.body.appendChild(el);
    descendSheet = el;
  }
  // v0.05 §6: the Quick Dungeon, a menu-only run picked from the trapdoor.
  const quick = station(new QuickDungeon());
  quick.carvings = () => deps.shrineLines.map((e) => ({ line: e.body.replace(/^#.*$/gm, '').replace(/[*_>[\]]/g, '').trim().split(/(?<=[.!?])\s+/)[0], title: e.title, credit: e.credit_as }));
  quick.onReward = (r) => { if (r.crowns) deps.inventory.give(CROWN, r.crowns); for (const [id, n] of r.items) deps.inventory.give(id, n); haptics.play('pickup'); };
  quick.onFinish = (seed, end) => {
    const d = deps.delves[seed] ?? (deps.delves[seed] = { theme: quick.graph!.theme, at: new Date().toISOString().slice(0, 10) });
    if (end !== 'fled' && d.quick !== 'won') { d.quick = end; deps.saveDelves(); }
    deps.toast(end === 'won' ? 'The nest is cleared. Quick Dungeon done.' : end === 'lost' ? 'Back at the top of the stairs. Rest up and try again.' : 'Back at the top of the stairs.', 3200);
  };
  quick.onClose = () => deps.leaveForge();
  function openQuick(seed: number) { if (deps.state !== 'forge') deps.enterForge(); quick.open(seed); }
  return { get descendSheet() { return descendSheet; }, set descendSheet(v) { descendSheet = v; }, get runKills() { return runKills; }, set runKills(v) { runKills = v; }, get recordToasted() { return recordToasted; }, set recordToasted(v) { recordToasted = v; }, get statueDirty() { return statueDirty; }, set statueDirty(v) { statueDirty = v; }, killStatue, kills, quick, countKill, openDescend, openQuick };
}
