// The knight frame, a pilotable rune mech (src/mech/frame.ts): waking it, getting in and out, its HUD, and the touch and gamepad hooks declared with it. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { type Collider } from '../world';
import { type View } from '../settings';
import { audio } from '../audio';
import { TouchControls } from '../input/touch';
import { GamepadControls } from '../input/gamepad';
import type { GameHooks } from '../input/hooks';
import { haptics } from '../input/haptics';
import { isMelee, type Hand } from '../hands';
import { KnightFrame, type Strike } from '../mech/frame';
import { storeSet } from '../store';
import type { KnightFrameDeps, Interactable } from '../main';

export function setupKnightFrame(deps: KnightFrameDeps) {
  // It stands in the treeline east of the green, awake and rideable from the start (Mike 2026-11-06; it used to sleep
  // until the descent's third floor was cleared, and wait for the first day). E / A / the Use button climbs in at its back; the same climbs out. Inside: move as usual (Alt / B /
  // the sprint button pushes it to a run), LMB / RT / Strike punches, RMB / LT / Guard raises the shield arm, Space /
  // Y / jump is a ground-slam, Q / D-pad up / ✦ a rune pulse that staggers everything near. It can't use doors,
  // roads out of town or the trapdoor: climb out first.
  const FRAME_KEY = 'gametool.frame';
  const FRAME_AT = { x: 39, z: -20, ry: -Math.PI / 2 };
  const knight = new KnightFrame();
  knight.root.position.set(FRAME_AT.x, deps.player.terrain(FRAME_AT.x, FRAME_AT.z), FRAME_AT.z);
  knight.root.rotation.y = FRAME_AT.ry;
  deps.world.scene.add(knight.root);
  const frameCol: Extract<Collider, { kind: 'circle' }> = { kind: 'circle', x: FRAME_AT.x, z: FRAME_AT.z, r: 1.0 };
  deps.world.colliders.push(frameCol);
  knight.wake(true);
  function wakeFrame() {   // kept for old saves and tests; the frame is awake from the start now
    if (knight.awake) return;
    knight.wake(); storeSet(FRAME_KEY, 'awake');
  }
  const frameExit: Interactable = { obj: knight.hit, verb: () => 'Climb out', act: () => exitFrame() };
  deps.interactables.push({
    obj: knight.hit, when: () => !deps.inDungeon && !knight.piloted && deps.regions.current === 'town',
    verb: () => knight.awake ? (knight.standing ? 'Climb into the knight frame' : 'The knight frame is waking...') : 'A rusted knight frame (asleep)',
    act: () => {
      if (!knight.awake) { deps.toast('A knight frame, ten feet of elvish bronze gone green, kneeling in the ferns. The gem in its chest is dark. Clear the third floor of the descent and something down there might wake it.', 6000); return; }
      if (knight.standing) enterFrame();   // Mike 2026-11-06: rideable from the start (no first-day wait)
    },
  });
  let viewBeforeFrame: View | null = null;
  function enterFrame() {
    deps.groups.mark('station', 'knight');   // B52/B53
    if (deps.crossbow.equipped) deps.equip(false);
    deps.handDown.left = deps.handDown.right = false; deps.syncAim();
    if (deps.torch.lit) deps.toggleTorch();
    viewBeforeFrame = deps.currentView();
    if (viewBeforeFrame === 'first') deps.setView('overhead', false);
    const i = deps.world.colliders.indexOf(frameCol); if (i >= 0) deps.world.colliders.splice(i, 1);
    deps.player.pos.set(knight.root.position.x, knight.root.position.y, knight.root.position.z);
    deps.player.yaw = deps.player.bodyYaw = knight.root.rotation.y - Math.PI; deps.player.pitch = 0;
    deps.player.sneaking = false; deps.player.held.clear();
    deps.player.piloting = true; knight.piloted = true;
    deps.player.pilotJump = () => { if (knight.slam()) haptics.play('jump'); };
    haptics.play('land'); audio.footstep();
    deps.toast(deps.inputMode === 'pad' ? 'You climb in through the hatch. RT strike · LT guard · Y slam · D-pad up rune pulse · A climb out.'
      : deps.inputMode === 'touch' ? 'You climb in through the hatch. Strike, Guard, jump to slam, ✦ for a rune pulse, Climb out to leave.'
      : 'You climb in through the hatch. LMB strike · RMB guard · Space slam · Q rune pulse · E climb out.', 5200);
  }
  function exitFrame() {
    if (!knight.piloted) return;
    const ry = knight.root.rotation.y, bx = -Math.sin(ry) * 1.6, bz = -Math.cos(ry) * 1.6;   // out of the back hatch
    knight.piloted = false; knight.guarding = false;
    deps.player.piloting = false; deps.player.pilotJump = null;
    frameCol.x = knight.root.position.x; frameCol.z = knight.root.position.z; deps.world.colliders.push(frameCol);
    deps.player.pos.set(knight.root.position.x + bx, deps.player.pos.y, knight.root.position.z + bz);
    deps.player.syncNow();
    if (viewBeforeFrame === 'first') deps.setView('first', false);
    viewBeforeFrame = null;
    haptics.play('land');
  }
  function pilotHand(h: Hand, down: boolean) {
    if (deps.state !== 'play') return;
    if (h === 'right') { if (down) knight.swing(); }
    else knight.guarding = down;
  }
  function pilotPulse() {
    if (knight.pulse()) haptics.play('slam');
    else if (knight.pulseWait > 0) deps.toast(`The runes are still dim (${Math.ceil(knight.pulseWait)} s).`, 1200);
  }
  let roadToastAt = 0;
  function tooBigForRoad() {
    const away = new THREE.Vector3(-deps.player.pos.x, 0, -deps.player.pos.z).normalize().multiplyScalar(0.6); deps.player.pos.add(away);
    if (performance.now() - roadToastAt > 3000) { roadToastAt = performance.now(); deps.toast('The knight frame is too big for the road. Climb out first.', 2400); }
  }
  const STRIKE: Record<Strike, { reach: number; arc: number; dmg: number }> = {
    swing: { reach: 2.4, arc: 0.8, dmg: 6 }, slam: { reach: 3.6, arc: Math.PI, dmg: 4 }, pulse: { reach: 6, arc: Math.PI, dmg: 1 },
  };
  knight.onStrike = (kind, at, fwd) => {
    const k = STRIKE[kind], from = kind === 'swing' ? knight.root.position : at;
    deps.goblins.slash(from, fwd, k.reach, k.arc, k.dmg, kind !== 'pulse');
    audio.swordSwish(kind !== 'pulse');
    if (kind === 'slam') { haptics.play('slam'); deps.dust.burst(at, 18, 1.6); audio.footstep(); }
    else if (kind === 'swing') haptics.play('hit');
    else deps.dust.burst(knight.root.position, 10, 2.4);
  };
  knight.onStep = () => {
    if (!knight.piloted) return;
    audio.footstep(); haptics.play('stomp');
    deps.dust.burst(knight.root.position, 3, 0.7);
  };

  const hooks: GameHooks = {
    state: () => deps.state,
    player: deps.player,
    get book() { return deps.reader.isOpen ? deps.reader : deps.book; },
    begin: () => void deps.begin(),
    pause: deps.pause,
    resume: () => { if (deps.state === 'pause') deps.closePauseMenu(); else void deps.resumePlay(); },
    activate: deps.activate,
    lookingAtBook: () => deps.lookingAt !== null,
    useVerb: () => (deps.lookingAt !== null ? deps.promptVerb.textContent : null),
    openMap: () => deps.openMap(),
    openJournal: () => deps.openCasebook(),
    advanceDialogue: () => deps.dialogue.press(),
    closeInventory: deps.closeInventory,
    openInventory: deps.openInventory,
    crossbow: deps.crossbow,
    fire: deps.fire,
    hand: (h, down) => deps.handButton(h, down),
    handTap: (h) => {
      if (deps.state !== 'play') return;
      if (deps.player.piloting) { pilotHand(h, h === 'right' ? true : !knight.guarding); return; }
      const it = deps.hands.held[h];
      if (deps.hands.aimsWith(h) || it === 'shield' || it === 'buckler' || it === 'sling') deps.handButton(h, !deps.handDown[h]);   // a latch, like the old Aim button (Block; a sling: whirl, then loose)
      else { deps.handButton(h, true); deps.handButton(h, false); }
    },
    handVerb: (h) => {
      if (deps.player.piloting) return h === 'right' ? 'Strike' : knight.guarding ? 'Lower' : 'Guard';
      const it = deps.hands.held[h];
      return it === 'spear' ? 'Thrust' : isMelee(it) ? 'Swing' : it === 'crossbow' ? 'Fire' : it === 'shield' || it === 'buckler' ? 'Block'
        : it === 'rock' ? 'Throw' : it === 'sling' ? (deps.handDown[h] ? 'Loose' : 'Whirl') : deps.hands.aimsWith(h) ? 'Aim' : null;
    },
    hasCrossbow: () => deps.inventory.count('crossbow') > 0,
    sword: deps.sword,
    hasSword: () => deps.sword.owned,
    weaponSwap: () => deps.quickSwap('right'),
    toggleRun: () => deps.toggleRun(),
    toggleView: () => deps.cycleView(),
    shoulderSwap: () => deps.shoulderSwap(),
    dialogueMove: (d: number) => deps.dialogue.move(d),
    stepCamera: (n) => deps.stepView(n),
    toggleTorch: () => deps.toggleTorch(),
    quickEquip: (what) => {   // B28: tap the crossbow or sword to take it in hand; tap it again to put it away
      if (deps.state !== 'play') return;
      if (what === 'crossbow') deps.equip(deps.hands.held.right !== 'crossbow'); else if (deps.hands.held.right === 'sword') deps.hands.set('right', 'none'); else deps.equipSword();
      deps.showQuick();
    },
    torchLit: () => deps.torch.lit,
    quickSwap: (h) => deps.quickSwap(h),
    menuActive: () => !!deps.intro?.active || deps.extras.isOpen || deps.gateOpen || deps.telling.isOpen || deps.quick.isOpen || deps.whatsNew.isOpen || (deps.wiki.isOpen && deps.state !== 'forge') || deps.campfire.isOpen,
    menu: (d) => deps.menuInput(d),
    bandPad: (i) => { if (deps.campfire.isOpen && deps.campfire.section === 'play' && !deps.telling.isOpen) deps.campfire.pad(i); },
    forgeStick: (x, y) => {
      if (deps.weaponForge.isOpen) deps.turnWeapon(x * 0.06, y * 0.04);
      else if (deps.characterForge.isOpen) { deps.player.bodyYaw += x * 0.06; deps.player.body.rotation.y = deps.player.bodyYaw; }   // B40: turn the hero too
    },
    panel: (d) => deps.panelInput(d),
    panelHold: (on) => {
      if (!(deps.gear.isOpen && deps.gear.job === 'sharpen')) return false;
      if (deps.inputMode === 'pad') deps.gear.holding = on;   // B40: hold A to lift the blade, like holding Space
      return true;
    },
    deskOpen: () => (deps.reader.isOpen ? deps.readerDesk : deps.lecternDesk).isWriting,
    bookPen: () => (deps.reader.isOpen ? deps.readerDesk : deps.lecternDesk).pressPen(),
    piloting: () => deps.player.piloting,
    fighter: () => deps.isFighter(),
    mage: () => deps.isMage() || deps.isMonk(),
    cast: () => { if (deps.isMonk()) deps.lockOn(); else deps.castMissile(); },
    technique: (t) => deps.technique(t),
    breathe: () => deps.breathe(),
    canSwapShoulder: () => deps.state === 'play' && deps.player.piloting || deps.state === 'play' && deps.player.thirdPerson && deps.rig.step === 1 && !deps.crossbow.equipped,
    setMode: deps.setMode,
  };
  const touch: TouchControls | null = new TouchControls(hooks);
  const gamepad = new GamepadControls(hooks, () => deps.settings.sensitivity);
  gamepad.onFamily = () => deps.syncGlyphs();
  document.body.dataset.input = deps.inputMode;
  // Mike 2026-10-30: from the very first screen, a phone held upright is asked to turn sideways. The card goes away
  // by itself in landscape; "Play upright anyway" keeps it away for this session. Where the browser can lock the
  // orientation (Android, in fullscreen), "Turn it for me" does it.
  {
    type Lockable = ScreenOrientation & { lock?: (o: string) => Promise<void> };
    const canLock = !!document.documentElement.requestFullscreen && typeof (screen.orientation as Lockable | undefined)?.lock === 'function';
    if (canLock) deps.$('rotateTurn').classList.remove('hidden');
    else deps.$('rotateIos').classList.remove('hidden');   // iPhone: no lock, so point at Control Centre's rotation lock
    // Automated test browsers skip it (their phone viewports are upright) unless a test asks: localStorage gametool.rotateask = 'on'.
    try { if (sessionStorage.getItem('gametool.upright') === 'ok' || (navigator.webdriver && localStorage.getItem('gametool.rotateask') !== 'on')) document.body.dataset.upright = 'ok'; }
    catch { if (navigator.webdriver) document.body.dataset.upright = 'ok'; }
    deps.$('rotateOk').addEventListener('click', (e) => {
      e.stopPropagation();
      document.body.dataset.upright = 'ok';
      try { sessionStorage.setItem('gametool.upright', 'ok'); } catch { /* private mode */ }
    });
    deps.$('rotateTurn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        .then(() => (screen.orientation as Lockable).lock?.('landscape'))
        .catch(() => undefined);
    });
  }

  // iPhone (Mike 2026-10-31): Safari won't let a page hide its address bar, but a Home Screen icon opens the game
  // fullscreen (manifest display: fullscreen). iPhone/iPad Safari outside that gets a one-line tip on the title screen
  // until it's closed. Test browsers skip it unless localStorage gametool.hometip = 'on'.
  {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    let show = ios && !installed;
    try { if (localStorage.getItem('gametool.hometip') === 'off' || (navigator.webdriver && localStorage.getItem('gametool.hometip') !== 'on')) show = false; }
    catch { if (navigator.webdriver) show = false; }
    if (show) deps.$('homeTip').classList.remove('hidden');
    deps.$('homeTipClose').addEventListener('click', (e) => {
      e.stopPropagation();
      deps.$('homeTip').classList.add('hidden');
      storeSet('gametool.hometip', 'off');
    });
  }
  return { gamepad, touch, pilotHand, knight, pilotPulse, exitFrame, tooBigForRoad, frameExit, enterFrame, wakeFrame };
}
