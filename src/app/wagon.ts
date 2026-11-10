// B54: the wagon between Aralon and the far maps; friends at the stop ride along. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { lore } from '../lore';
import { binds, REBINDABLE, bindKey, resetKeys, keyLabel, type Action } from '../controls';
import { VERSION } from '../version';
import { promptOfTheDay } from '../prompts';
import { type DialogueScript } from '../dialogue';
import { gatherPortfolio } from '../portfolio';
import { REGIONS, TOWN_EXITS, WAGON_STOPS, buildWagon, signpost, type RegionId, type Side } from '../world/regions';
import { Extras } from '../extras';
import { WhatsNew } from '../whatsnew';
import { topPanel, padMove, padNudge, padPress, padBack, type PadDir } from '../input/padnav';
import type { WagonDeps } from '../main';

export function setupWagon(deps: WagonDeps) {
  const placeName = (id: RegionId) => (id === 'town' ? 'Aralon' : REGIONS[id].name);
  /** The wagon stop in world space (the spot beside the wagon where you climb on). */
  function wagonStop(id: RegionId): { at: THREE.Vector3; yaw: number } | null {
    const ws = WAGON_STOPS[id]; if (!ws) return null;
    const o = id === 'town' ? new THREE.Vector3() : REGIONS[id].origin;
    const x = o.x + ws.at[0] + Math.sin(ws.yaw) * 1.8, z = o.z + ws.at[1] + Math.cos(ws.yaw) * 1.8;
    return { at: new THREE.Vector3(x, id === 'town' ? deps.world.heightAt(x, z) : o.y, z), yaw: ws.yaw };
  }
  function atWagon(id: RegionId) {
    const s = wagonStop(id); if (!s) return;
    deps.player.spawn(s.at, s.yaw + Math.PI);
    if (deps.companion.prefs.follow) deps.natalieRoot().position.copy(s.at).add(new THREE.Vector3(1.2, 0, 1.2));
    for (const p of deps.pets) if (p.following) p.placeNear(s.at);
  }
  const TOWN_WAGON = (() => {
    const ws = WAGON_STOPS.town!, w = buildWagon();
    w.position.set(ws.at[0], deps.world.heightAt(ws.at[0], ws.at[1]), ws.at[1]); w.rotation.y = ws.yaw; deps.world.scene.add(w);
    const c = Math.cos(ws.yaw), sn = Math.sin(ws.yaw), hx = Math.abs(c) * 1.4 + Math.abs(sn) * 0.7, hz = Math.abs(sn) * 1.4 + Math.abs(c) * 0.7;
    deps.world.colliders.push({ kind: 'box', minX: ws.at[0] - hx, maxX: ws.at[0] + hx, minZ: ws.at[1] - hz, maxZ: ws.at[1] + hz });
    const post = signpost('Wagon'); post.position.set(ws.at[0] + sn * 1.6, deps.world.heightAt(ws.at[0], ws.at[1]), ws.at[1] + c * 1.6); post.rotation.y = ws.yaw; deps.world.scene.add(post);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2.2), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(ws.at[0] + sn * 1.1, 1, ws.at[1] + c * 1.1); hit.name = 'wagon-hit'; deps.world.scene.add(hit);
    return { group: w, hit };
  })();
  deps.interactables.push({ obj: TOWN_WAGON.hit, verb: () => 'Ride the wagon', when: () => deps.regions.current === 'town' && !deps.inDungeon && !deps.portalM.travelling, act: () => openWagon() });
  function wagonScript(): DialogueScript {
    const here = deps.regions.current, dests = (Object.keys(WAGON_STOPS) as RegionId[]).filter((id) => id !== here);
    const n = deps.friends.room ? [...deps.remotes.values()].filter((r) => !r.away).length : 0;
    const nodes: DialogueScript['nodes'] = {
      hi: { text: `"Where to? I go to ${dests.map(placeName).join(', ')}."${n ? ' Anyone with you at the stop rides along.' : ''}`, choices: [
        ...dests.map((id) => ({ text: placeName(id), next: 'go_' + id })),
        { text: 'Not now.', next: 'bye' },
      ] },
      bye: { text: '"Suit yourself. I\'ll be here."', end: true },
    };
    for (const id of dests) nodes['go_' + id] = { text: `"${placeName(id)} it is. Hold on to something."`, actions: ['ride:' + id], end: true };
    return { speaker: 'The wagoner', portrait: 'wagoner', start: 'hi', nodes };
  }
  function openWagon() { const s = wagonStop(deps.regions.current); deps.talkTo('wagoner', s ? s.at : deps.player.pos.clone(), wagonScript()); }
  function rideWagon(to: RegionId) {
    deps.friends.room?.send('ride', { to, from: deps.regions.current });   // friends at this stop come along
    deps.travel(to, false, true);
  }
  function exitCheck() {
    if (deps.state !== 'play' || deps.inDungeon || deps.portalM.travelling) return;
    const x = deps.player.pos.x, z = deps.player.pos.z;
    if (deps.regions.current === 'town') {
      for (const side of Object.keys(TOWN_EXITS) as Side[]) if (TOWN_EXITS[side].trigger(x, z)) {
        if (deps.player.piloting) { deps.tooBigForRoad(); return; }   // the frame stays in Aralon
        deps.travel(TOWN_EXITS[side].to); return;
      }
      return;
    }
    const r = REGIONS[deps.regions.current];
    if (r.back(x - r.origin.x, z - r.origin.z)) deps.travel('town');
  }
  function gateYes() {
    if (!deps.gateOpen) return;
    deps.gateOpen = false;
    deps.$('gateConfirm').classList.add('hidden');
    deps.snapshot(false);
    deps.toMenu('You retired at the gate. Your bag is saved; Begin starts you back at the glade.');
  }
  deps.$('gateYes').addEventListener('click', () => gateYes());
  deps.$('gateGo').addEventListener('click', () => {
    if (!deps.gateOpen) return;
    deps.gateOpen = false;
    deps.$('gateConfirm').classList.add('hidden');
    deps.leaveForge();
    deps.travel('amethyst');
  });
  deps.$('gateNo').addEventListener('click', () => deps.gateNo());

  const extras = new Extras(() => { deps.setState('title'); focusMenu(1); });
  extras.portfolio = () => { const author = deps.forgeAuthor(); return { author, pieces: gatherPortfolio(author, (id) => lore.entries.find((e) => e.id === id)?.title ?? id) }; };   // B37
  extras.onWrite = () => { extras.el.classList.add('hidden'); deps.openEditor(); };   // v0.06: Write lore moved from the main menu to Extras
  // v0.06 M6: What's new, once per session on Begin. Automated test browsers skip it unless a test asks.
  const whatsNew = new WhatsNew(promptOfTheDay());
  extras.onWhatsNew = () => { extras.el.classList.add('hidden'); whatsNew.open(() => { extras.open(); focusMenu(0); }); };
  extras.onWiki = () => { extras.el.classList.add('hidden'); deps.wiki.open(() => { extras.open(); focusMenu(0); }, 'menu'); focusMenu(0); };   // B21
  deps.$('openExtras').addEventListener('click', () => { deps.show('title', false); extras.open(); focusMenu(0); });
  deps.$('openProfiles').addEventListener('click', () => { deps.show('title', false); extras.open('profiles'); focusMenu(0); });   // B24

  // Pause → Controls: rebind the keyboard. Click a key, then press the new one (Esc cancels).
  let rebinding: Action | null = null;
  function renderKeyBinds() {
    deps.$('keyBinds').innerHTML = `<p class="fine">Keyboard: click an action, then press its new key. Esc cancels.</p><div class="binds">${REBINDABLE.map(([a, label]) =>
      `<button class="bind${rebinding === a ? ' on' : ''}" data-bind="${a}"><span>${label}</span><kbd>${rebinding === a ? '…' : keyLabel(binds[a][0])}</kbd></button>`).join('')}</div><button class="secondary" data-bind="reset">Reset keys</button>`;
  }
  deps.$('keyBinds').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    if (b.dataset.bind === 'reset') { resetKeys(); rebinding = null; }
    else rebinding = b.dataset.bind as Action;
    renderKeyBinds();
  });
  window.addEventListener('keydown', (e) => {
    if (!rebinding) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') bindKey(rebinding, e.code);
    rebinding = null;
    renderKeyBinds();
  }, true);
  renderKeyBinds();

  // Menus without a mouse: arrow keys / D-pad move between buttons, Enter / A presses, Esc / B goes back.
  function menuButtons(where: 'side' | 'panel' = 'side'): HTMLElement[] {
    if (whatsNew.isOpen) return [...whatsNew.el.querySelectorAll<HTMLElement>('summary, button.primary')];
    if (deps.wiki.isOpen) return [...deps.wiki.el.querySelectorAll<HTMLElement>('button')];
    if (deps.state === 'pause' && !deps.gateOpen) {
      const root = where === 'panel' && deps.pauseGroup ? deps.$('pause').querySelector(`[data-panel="${deps.pauseGroup}"]`) : deps.$('pause').querySelector('.pause-side');
      return root ? [...root.querySelectorAll<HTMLElement>('button, input, select')].filter((b) => b.offsetParent !== null && !(b as HTMLButtonElement).disabled) : [];
    }
    const root = deps.gateOpen ? deps.$('gateConfirm') : extras.isOpen ? extras.el : deps.state === 'title' ? deps.$('title') : null;
    return root ? [...root.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.offsetParent !== null && !b.disabled) : [];
  }
  // B40: a controller in any open panel (stations, the map, the journal, the books, the lore editor, the margin desk).
  // The fight with Kavik has its own controls (src/fight/mode.ts), so the panel controls leave it alone.
  function panelRoot(): HTMLElement | null {
    if (deps.state === 'editor') return deps.$('editor');
    if (deps.state === 'book') { const d = deps.reader.isOpen ? deps.readerDesk : deps.lecternDesk; return d.isWriting ? d.deskEl : null; }
    if (deps.state !== 'forge' || deps.fightMode.isOpen || deps.sky.isOpen) return null;
    return topPanel();
  }
  function panelInput(d: PadDir | 'ok' | 'back') {
    const root = panelRoot();
    if (!root) { if (d === 'back' && deps.state === 'forge' && !deps.fightMode.isOpen && !deps.sky.isOpen) deps.closeForges(); return; }
    if (d === 'ok') { padPress(root); return; }
    if (d === 'back') {
      if (padBack(root)) return;
      if (deps.state === 'editor') deps.closeEditor();
      else if (deps.state === 'book') (deps.reader.isOpen ? deps.readerDesk : deps.lecternDesk).closeDesk();
      else deps.closeForges();
      return;
    }
    if ((d === 'left' || d === 'right') && padNudge(document.activeElement, d === 'right' ? 1 : -1)) return;
    padMove(root, d);
  }
  function focusMenu(i: number, where: 'side' | 'panel' = 'side') { const bs = menuButtons(where); bs[Math.max(0, Math.min(bs.length - 1, i))]?.focus({ preventScroll: true }); }
  function menuInput(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): boolean {
    if (deps.intro?.active) { deps.intro.input(); return true; }
    if (deps.telling.isOpen) { if (dir === 'ok') deps.telling.press(); else if (dir === 'back') deps.telling.close(); return true; }
    if (deps.campfire.isOpen) { deps.campfire.input(dir); return true; }   // v0.06 C1
    if (deps.quick.isOpen) { deps.quick.input(dir); return true; }
    if (extras.isOpen && extras.tab === 'evolution' && (dir === 'left' || dir === 'right')) { extras.go(extras.index + (dir === 'right' ? 1 : -1)); return true; }
    if (extras.isOpen && dir === 'back') { extras.back(); if (extras.isOpen) focusMenu(0); return true; }
    if (deps.gateOpen && dir === 'back') { deps.gateNo(); return true; }
    if (whatsNew.isOpen && dir === 'back') { whatsNew.close(); return true; }
    if (deps.wiki.isOpen && deps.state !== 'forge' && dir === 'back') { deps.wiki.back(); if (deps.wiki.isOpen) focusMenu(0); return true; }
    if (deps.state === 'pause' && !deps.gateOpen) return pauseInput(dir);
    const bs = menuButtons();
    if (!bs.length) return false;
    const at = bs.indexOf(document.activeElement as HTMLButtonElement);
    if (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right') { focusMenu(at < 0 ? 0 : (at + (dir === 'down' || dir === 'right' ? 1 : -1) + bs.length) % bs.length); return true; }
    if (dir === 'ok') { (at < 0 ? bs[0] : bs[at]).click(); return true; }
    return false;
  }
  // v0.06 P1: the pause menu without a mouse. In the sidebar: up / down move, A / right opens a group, B resumes.
  // In a group: up / down move between settings, left / right change one, A presses or flips it, B goes back.
  function pauseInput(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): boolean {
    if (dir === 'back') { deps.pauseBack(); return true; }
    const active = document.activeElement as HTMLElement | null;
    const inPanel = !!deps.pauseGroup && !!active?.closest('.pause-panel');
    const bs = menuButtons(inPanel ? 'panel' : 'side');
    const at = bs.indexOf(active as HTMLElement);
    if (dir === 'up' || dir === 'down') { focusMenu(at < 0 ? 0 : (at + (dir === 'down' ? 1 : -1) + bs.length) % bs.length, inPanel ? 'panel' : 'side'); return true; }
    const el = bs[at < 0 ? 0 : at];
    if (!el) return true;
    if (inPanel) {
      if (dir === 'left' && !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) { deps.pauseBack(); return true; }
      if (dir === 'left' || dir === 'right') { deps.nudge(el, dir === 'right' ? 1 : -1); return true; }
      if (el instanceof HTMLButtonElement) el.click(); else deps.nudge(el, 1);
      return true;
    }
    if (dir === 'left') return true;
    if (dir === 'right' && !el.dataset.group) return true;
    if (el.dataset.group && deps.pauseGroup === el.dataset.group) { focusMenu(0, 'panel'); return true; }
    el.click();
    if (el.dataset.group && deps.pauseGroup) focusMenu(0, 'panel');
    return true;
  }
  window.addEventListener('keydown', (e) => {
    if (e.repeat || deps.state !== 'pause' || deps.gateOpen || rebinding || (e.target as HTMLElement)?.closest?.('textarea, input[type=text]')) return;
    const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Escape: 'back' } as Record<string, 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'>)[e.code];
    if (!dir || (dir === 'ok' && (e.target as HTMLElement)?.tagName === 'BUTTON')) return;   // Enter on a button clicks it natively
    if (dir === 'back' && deps.pauseFrom === 'play' && deps.lockSupported && deps.wantLock() && !deps.pauseGroup) return;   // locked first person: the browser's own Esc
    e.preventDefault(); e.stopImmediatePropagation();
    pauseInput(dir);
  }, true);
  // v0.06 C1: the campfire list from the keyboard (arrows; Esc closes the open item first, then leaves).
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !deps.campfire.isOpen || deps.telling.isOpen || (e.target as HTMLElement)?.closest?.('input, textarea')) return;
    const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Escape: 'back' } as Record<string, 'up' | 'down' | 'left' | 'right' | 'back'>)[e.code];
    if (!dir) return;
    e.preventDefault(); e.stopImmediatePropagation();
    deps.campfire.input(dir);
  }, true);
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !(deps.state === 'title' || extras.isOpen || deps.gateOpen || whatsNew.isOpen || (deps.wiki.isOpen && deps.state !== 'forge')) || (e.target as HTMLElement)?.closest?.('input, textarea')) return;
    if (extras.isOpen && extras.handleKey(e.code)) { e.preventDefault(); if (extras.isOpen) focusMenu(0); return; }
    const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Escape: 'back' } as const)[e.code as 'ArrowUp'];
    if (dir && menuInput(dir)) e.preventDefault();
  });

  // v0.05 §1.1: say which version this is when the menu first shows (and whether it's new since the last visit).
  function versionNote() {
    let last: string | null = null;
    try { last = localStorage.getItem('gametool.version'); localStorage.setItem('gametool.version', VERSION); } catch { /* blocked */ }
    const el = deps.$('versionNote');
    el.textContent = last && last !== VERSION ? `Tales of Artheria v${VERSION} | Updated from v${last}` : `Tales of Artheria v${VERSION} | System up to date`;
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 4500);
  }
  return { focusMenu, extras, exitCheck, wagonStop, placeName, rideWagon, openWagon, atWagon, whatsNew, menuInput, panelInput, versionNote, TOWN_WAGON };
}
