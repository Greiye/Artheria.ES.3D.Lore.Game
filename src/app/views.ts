// The three camera views, the quick-swap line, the torch, and pointer lock for first person. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { saveSettings, type View } from '../settings';
import { OVERHEAD } from '../camera/rig';
import { haptics } from '../input/haptics';
import { HAND_LABEL, type Hand, type HandItem } from '../hands';
import type { ViewsDeps } from '../main';

export function setupViews(deps: ViewsDeps) {
  function syncCrossbowView() {
    if (deps.crossbow.equipped && deps.viewBeforeCrossbow === null) { deps.viewBeforeCrossbow = deps.player.thirdPerson; deps.player.thirdPerson = false; syncLock(); }
    else if (!deps.crossbow.equipped && deps.viewBeforeCrossbow !== null) { deps.player.thirdPerson = deps.viewBeforeCrossbow; deps.viewBeforeCrossbow = null; if (deps.player.thirdPerson) deps.player.pitch = 0; syncLock(); }
    document.body.dataset.view = deps.player.thirdPerson ? 'follow' : 'first';
    if (deps.rig.inShot) { deps.crossbow.viewmodel.visible = deps.crossbow2.viewmodel.visible = false; deps.sword.viewmodel.visible = deps.sword2.viewmodel.visible = false; }   // a framed dialogue/reading shot shows the player, not the held crossbow
  }
  // v0.04 Skyrim-style quick swap; Mike 2026-11-05: the D-pad's left / right cycle what that hand holds (nothing,
  // sword, crossbow, torch: anything you own, any pair), with a short HUD line saying what's in each hand.
  let quickTimer = 0;
  function showQuick() {
    const el = deps.$('quick');
    el.innerHTML = `<span>◀ ${HAND_LABEL[deps.hands.held.left]}</span><span>${HAND_LABEL[deps.hands.held.right]} ▶</span>`;
    el.classList.remove('hidden');
    quickTimer = 1.6;
  }
  // T / hold D-pad down / the 🔥 button: a torch in the left hand, or put every torch out (what that hand held before
  // comes back).
  let beforeTorch: HandItem = 'none';
  function toggleTorch() {
    if (deps.player.piloting) return;
    if (deps.state !== 'play') return;
    if (deps.hands.held.left === 'torch' || deps.hands.held.right === 'torch') {
      for (const h of ['left', 'right'] as Hand[]) if (deps.hands.held[h] === 'torch') deps.hands.set(h, h === 'left' ? beforeTorch : 'none');
      beforeTorch = 'none';
    } else { beforeTorch = deps.hands.held.left; deps.hands.set('left', 'torch'); }
    haptics.play('tap');
    showQuick();
  }
  function quickSwap(hand: Hand) {
    if (deps.player.piloting) return;
    if (deps.state !== 'play') return;
    deps.hands.cycle(hand);
    if (hand === 'left') beforeTorch = 'none';
    haptics.play('tap');
    showQuick();
  }
  // v0.05: three perspectives, first person <-> over the shoulder <-> overhead. One step out (+1) or in (-1).
  const VIEWS: View[] = ['first', 'shoulder', 'overhead'];
  const currentView = (): View => (!deps.player.thirdPerson ? 'first' : deps.rig.step === 1 ? 'shoulder' : 'overhead');
  function stepView(n: number) {
    if (!n || deps.crossbow.equipped) return;
    const i = THREE.MathUtils.clamp(VIEWS.indexOf(currentView()) + Math.sign(n), 0, VIEWS.length - 1);
    setView(VIEWS[i]);
  }
  /** F / R3 / the touch eye button: cycle first person -> shoulder -> overhead -> first person. */
  function cycleView() { setView(VIEWS[(VIEWS.indexOf(currentView()) + 1) % VIEWS.length]); }
  // The pause menu's Camera list sets the same thing (and is how phones pick it).
  function setView(v: View, save = true) {
    if (deps.player.piloting && v === 'first') v = 'shoulder';   // no first person inside the frame
    if (v !== 'first') deps.rig.setStep(v === 'shoulder' ? 1 : OVERHEAD);
    if (save && deps.settings.view !== v) { deps.settings.view = v; saveSettings(deps.settings); }
    if (deps.crossbow.equipped) { deps.viewBeforeCrossbow = v !== 'first'; return; }   // applies when the crossbow is put away
    deps.player.thirdPerson = v !== 'first';
    if (deps.player.thirdPerson) deps.player.pitch = 0;
    document.body.dataset.view = deps.player.thirdPerson ? 'follow' : 'first';
    syncLock();
  }
  // v0.05 shoulder swap (Q / D-pad up): in the shoulder view it swaps the shoulder; in the other views it
  // doubles as the weapon switch (hands <-> crossbow), like the shoulder / stance swap in other action games.
  function shoulderSwap() {
    if (deps.state !== 'play') return;
    if (deps.player.piloting) { deps.pilotPulse(); return; }
    if (deps.player.thirdPerson && deps.rig.step === 1 && !deps.crossbow.equipped) { deps.rig.swapShoulder(); haptics.play('tap'); return; }
    quickSwap('right');
  }
  // First person locks the pointer (from the key press that switched to it); the follow view frees it.
  function syncLock() {
    if (deps.state !== 'play') return;
    if (deps.wantLock() && deps.lockSupported && !document.pointerLockElement) void deps.requestLock().then((ok) => { if (!ok && !document.pointerLockElement) { deps.lockSupported = false; deps.show('nolock', deps.state === 'play' && deps.wantLock()); } });
    else if (!deps.wantLock() && document.pointerLockElement) { deps.expectUnlock = true; document.exitPointerLock(); }
    deps.show('nolock', !deps.lockSupported && deps.wantLock());
  }
  return { stepView, setView, syncCrossbowView, get beforeTorch() { return beforeTorch; }, set beforeTorch(v) { beforeTorch = v; }, showQuick, get quickTimer() { return quickTimer; }, set quickTimer(v) { quickTimer = v; }, toggleTorch, currentView, quickSwap, cycleView, shoulderSwap, VIEWS };
}
