// Hints and toasts, dialogue actions, talking to Natalie, the bag, and E to use what you face. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { controls } from '../controls';
import { audio } from '../audio';
import type { InputMode } from '../input/hooks';
import { type DialogueScript } from '../dialogue';
import { ITEMS } from '../inventory';
import natalieScript from '../../content/dialogue/natalie.json';
import natalieCampScript from '../../content/dialogue/natalie-camp.json';
import { QUEST, saveQuest, support } from '../quest/quest';
import { saveCompanion } from '../quest/companion';
import { haptics } from '../input/haptics';
import { Thrower } from '../sling';
import { REGIONS, type RegionId } from '../world/regions';
import { FLOORS } from '../delve/descent';
import { FirstMeeting, metNatalie } from '../cinematic/firstmeet';
import type { TalkDeps } from '../main';

export function setupTalk(deps: TalkDeps) {
  let toastTimer = 0;
  // UX pass (Mike 2026-10-31): tutorial hints are spoken by Natalie when she's with you, in her own words, naming the
  // key or button for how you're playing. Without her near (or with her quiet), the hint is the usual toast.
  const KEY_NAMES: Record<'casebook' | 'bag' | 'torch', Record<InputMode, string>> = {
    casebook: { mouse: 'J', touch: 'the Journal button', pad: 'Menu, then Gameplay' },
    bag: { mouse: 'I', touch: 'the Bag button', pad: 'View' },
    torch: { mouse: 'T', touch: 'the flame button', pad: 'hold the D-pad down' },
  };
  const keyName = (k: keyof typeof KEY_NAMES) => KEY_NAMES[k][deps.inputMode];
  let lastHint = '';
  function hint(natalie: string, plain: string, ms = 3600) {
    const near = deps.companion.prefs.follow && !deps.companion.prefs.quiet && !deps.inDungeon && deps.companion.pos.distanceTo(deps.player.pos) < 14;
    if (near && deps.companion.say(natalie, { force: true })) { lastHint = 'natalie'; return; }
    lastHint = 'toast';
    toast(plain, ms);
  }
  function toast(msg: string, ms = 3000) {
    const el = deps.$('toast');
    el.textContent = msg;
    deps.show('toast', true);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => deps.show('toast', false), ms);
  }
  // F3.4: dialogue actions. `give:<item>:<n>` happens once per session per node, so talking again is safe.
  const givenOnce = new Set<string>();
  deps.dialogue.onAction = (a) => {
    const [verb, id, n] = a.split(':');
    if (verb === 'ride' && (id === 'town' || id in REGIONS)) { afterDialogue = () => { void deps.resumePlay(); deps.rideWagon(id as RegionId); }; return; }   // B54
    if (verb === 'give') {
      if (givenOnce.has(a)) return;
      givenOnce.add(a);
      deps.inventory.give(id, Number(n) || 1);
      toast(`Received ${ITEMS[id]?.name ?? id} × ${Number(n) || 1}`);
      setTimeout(() => hint(`It's in your bag now. ${keyName('bag')} opens it.`, '(I: inventory)', 2600), 1800);
    } else if (verb === 'lend' && id === 'crossbow') {
      // Mike 2026-11-06: ask Natalie for the Archer's crossbow again whenever you have none (no once-per-session guard).
      if (deps.inventory.count('crossbow') > 0) return;
      deps.inventory.give('crossbow', 1);
      const bolts = Math.max(0, 10 - deps.inventory.count('bolt'));
      if (bolts) deps.inventory.give('bolt', bolts);
      toast(`Received ${ITEMS.crossbow?.name ?? 'crossbow'} × 1${bolts ? ` and ${ITEMS.bolt?.name ?? 'bolt'} × ${bolts}` : ''}`);
    } else if (verb === 'unlock' && id === 'library_door') {
      deps.world.openDoor();
    } else if (verb === 'quest' && id === 'start') {
      if (deps.quest.stage === 'none') { deps.quest.stage = 'clues'; saveQuest(deps.quest); setTimeout(() => toast(`New: ${QUEST.title} (J: casebook)`, 4500), 600); }
    } else if (verb === 'companion') {
      deps.companion.prefs.follow = id === 'follow'; saveCompanion(deps.companion.prefs);
    } else if (verb === 'folklore' && id === 'open') afterDialogue = deps.openFolklore;
    else if (verb === 'casebook' && id === 'open') afterDialogue = deps.openCasebook;
    else if (verb === 'kavik' && id === 'fight') afterDialogue = () => { deps.setState('play'); deps.openFight(); };
    else if (verb === 'archery' && id === 'start') afterDialogue = () => { void deps.resumePlay(); deps.startLesson(); };
    else if (verb === 'archery' && id === 'stop') deps.lesson = null;
    else if (verb === 'magic' && id === 'learn') deps.learnMissile();
    else if (verb === 'sky' && id === 'fly') afterDialogue = () => { deps.setState('play'); deps.openSky(); };
    else console.warn('Unknown dialogue action', a);
  };
  deps.dialogue.onLine = () => audio.pageTurn();
  let afterDialogue: (() => void) | null = null;
  let dialogueWith = '';
  deps.dialogue.onEnd = () => {
    const next = afterDialogue; afterDialogue = null;
    if (next) { next(); return; }
    if (deps.world.doorOpen && dialogueWith === 'natalie' && deps.quest.stage === 'clues' && deps.quest.clues.length === 0) toast('The library door is open.');
    void deps.resumePlay();
  };
  function talkTo(who: string, at: THREE.Vector3, script: DialogueScript) {
    dialogueWith = who;
    deps.groups.mark('npc', who.replace(/^modern:/, ''));   // B52
    deps.gesture('wave');   // B34: say hello
    deps.setState('dialogue');   // F3.3: frees the pointer, freezes movement
    deps.rig.setShot(deps.rig.twoShot(at, 1.55));
    if (document.pointerLockElement) { deps.expectUnlock = true; document.exitPointerLock(); }
    deps.dialogue.start(script, who);   // B30: the portrait is assets/portraits/<who>.png
  }
  // B50: the first talk opens with a short cinematic (not on Low power or with reduced motion: straight to the box).
  const firstMeet = new FirstMeeting((s) => deps.rig.setShot(s));
  function talkToNatalie() {
    deps.groups.mark('npc', 'natalie');   // B52
    if (deps.quest.stage === 'none' && !metNatalie() && !firstMeet.active && deps.settings.preset !== 'lowpower' && !deps.reducedMotion.matches) {
      const n = deps.natalieRoot();
      dialogueWith = 'natalie';
      deps.setState('dialogue');
      if (document.pointerLockElement) { deps.expectUnlock = true; document.exitPointerLock(); }
      // Mike 2026-11-05: Greer comes up from the coach road for the scene, a step in front of her and a little aside;
      // they face each other and the hero steps out of frame. All put back when it ends.
      const g = deps.greerRoot(), feet = n.getWorldPosition(new THREE.Vector3()), yaw = n.rotation.y;
      const spot = feet.clone().add(new THREE.Vector3(Math.sin(yaw + 0.45), 0, Math.cos(yaw + 0.45)).multiplyScalar(1.45));
      const keep = { gp: g.position.clone(), gy: g.rotation.y, ny: n.rotation.y, body: deps.player.body.visible };
      g.position.set(spot.x, g.position.y, spot.z); g.rotation.y = Math.atan2(feet.x - spot.x, feet.z - spot.z);
      n.rotation.y = Math.atan2(spot.x - feet.x, spot.z - feet.z);
      deps.player.body.visible = false; deps.player.offstage = true;
      firstMeet.play(feet, spot, () => {
        g.position.copy(keep.gp); g.rotation.y = keep.gy; n.rotation.y = keep.ny; deps.player.offstage = false; deps.player.body.visible = keep.body;
        talkTo('natalie', deps.world.natalieTarget.position, natalieScript as DialogueScript);
      });
      return;
    }
    talkTo('natalie', deps.world.natalieTarget.position, deps.quest.stage === 'none' ? natalieScript as DialogueScript : natalieCompanionScript());
  }
  // B2: once the quest has started, the same talk gains companion choices after the original three
  // (follow / wait, what she thinks, the casebook). Node ids and the first choices stay as they were.
  function natalieCompanionScript(): DialogueScript {
    const base = structuredClone(natalieScript) as DialogueScript, n = QUEST.natalie, c = deps.quest.clues.length;
    const hint = deps.quest.stage === 'lead' ? `${support(deps.quest, deps.quest.theory!) >= 2 ? n.supported : n.leap} Follow the blue light.`
      : deps.quest.stage === 'done' ? n.found : c === 0 ? n.hintNone : c < QUEST.minClues ? n.hintMore : n.hintReady;
    base.nodes.n1.text = deps.companion.prefs.follow ? "I'm right behind you." : 'You came back. Any sign of them?';
    base.nodes.n2.choices = [...(base.nodes.n2.choices ?? []),
      { text: 'What do you think?', next: 'hint' },
      deps.companion.prefs.follow ? { text: 'Wait here.', next: 'wait' } : { text: 'Come with me.', next: 'follow' },
      { text: 'Let me check the casebook.', next: 'book' },
      { text: 'What is under the library?', next: 'deep' },
      { text: 'Why is the camp here?', next: 'camp' },
      // Mike 2026-11-06: whenever you have no crossbow, you can ask for the Archer's (her party's arbalest).
      ...(deps.inventory.count('crossbow') === 0 ? [{ text: "Could I borrow the Archer's crossbow?", next: 'lend' }] : []),
    ];
    Object.assign(base.nodes, {
      hint: { text: hint, next: 'n2' },
      wait: { text: n.wait, actions: ['companion:wait'], end: true },
      follow: { text: n.follow, actions: ['companion:follow'], end: true },
      book: { text: 'Read it out to me as you go.', actions: ['casebook:open'], end: true },
      lend: { text: "Lost it already? He'll have words when we find him. Here. Mind the reload this time.", actions: ['lend:crossbow'], end: true },
      // Mike 2026-11-05: the descent's premise.
      deep: { text: `It moves. The witch in the ruins keeps the whole place in flux: the stairs are never where I left them. They say it goes ${FLOORS} floors down, with a dragon's hoard at the bottom. Bring me the books you find. ${deps.record.deepest ? `The deepest anyone's brought me word from is floor ${deps.record.deepest}.` : 'Nobody has brought me word from very deep yet.'}`, next: 'deep2' },
      camp: { text: (natalieCampScript.nodes.c2.text + ' ' + natalieCampScript.nodes.c3.text), next: 'camp2' },
      camp2: { text: natalieCampScript.nodes.c7.text, next: 'n2' },
      deep2: { text: "Only Kavik ever came back from the bottom. His drawing's on the Inn wall. The names on the other wall at the Inn didn't come back at all.", next: 'n2' },
    });
    return base;
  }

  function openInventory() {
    if (deps.state !== 'play') return;
    if (document.pointerLockElement) { deps.expectUnlock = true; document.exitPointerLock(); }
    deps.inventory.render();
    deps.setState('inventory');
  }
  function closeInventory() { if (deps.state === 'inventory') void deps.resumePlay(); }
  function activate() {
    if (deps.state !== 'play') return;
    if (deps.player.piloting) { deps.exitFrame(); return; }
    deps.player.syncNow(); deps.camera.updateMatrixWorld(); deps.updateTarget();
    if (deps.lookingAt !== null) deps.coach.used();
    if (deps.lookingAt === 'natalie') talkToNatalie();
    else if (deps.lookingAt === 'thing') deps.lookingAtThing?.act();
    else if (deps.lookingAt === 'library' && deps.libraryHit) deps.useLibrary(deps.libraryHit);
    else if (deps.lookingAt === 'bolt') {
      const c = deps.crossbow.boltAt(deps.player.eyePos, deps.lookDir, controls.activateRange) ? deps.crossbow : deps.crossbow2, b = c.boltAt(deps.player.eyePos, deps.lookDir, controls.activateRange);
      if (b) { c.pickUp(b); haptics.play('pickup'); deps.gesture('pickup'); toast('Bolt recovered', 1200); }
    } else if (deps.lookingAt === 'rock') {
      const r = Thrower.rockAt(deps.player.eyePos, deps.lookDir, controls.activateRange);
      if (r) { Thrower.pickUp(r, deps.inventory); haptics.play('pickup'); deps.gesture('pickup'); toast('Rock picked up', 1200); }
    }
  }
  return { toast, talkTo, closeInventory, hint, get dialogueWith() { return dialogueWith; }, firstMeet, keyName, get afterDialogue() { return afterDialogue; }, set afterDialogue(v) { afterDialogue = v; }, activate, openInventory, talkToNatalie, get lastHint() { return lastHint; } };
}
