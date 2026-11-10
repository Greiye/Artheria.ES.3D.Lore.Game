// The Fighter's techniques (src/fighter.ts). Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { audio } from '../audio';
import { FighterKit, TECH, BREATH, type Technique } from '../fighter';
import { haptics } from '../input/haptics';
import type { FighterTechniquesDeps } from '../main';

export function setupFighterTechniques(deps: FighterTechniquesDeps) {
  const fighterKit = new FighterKit();
  const isFighter = () => deps.character.profession === 'fighter';
  let techToldAt = 0;
  function technique(t: Technique) {
    if (!isFighter() || deps.state !== 'play' || deps.player.piloting || deps.player.dashing) return;
    if (!fighterKit.use(t)) {
      if (performance.now() - techToldAt > 1200) { techToldAt = performance.now(); deps.toast(fighterKit.breathing ? 'Still drawing breath.' : `${TECH[t].name} ready in ${Math.ceil(fighterKit.cd[t])} s.`, 1200); }
      return;
    }
    const yaw = deps.player.thirdPerson ? deps.player.bodyYaw : deps.player.yaw, fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const armed = deps.sword.equipped || deps.sword2.equipped, T = TECH[t];
    const damage = Math.max(1, T.damage - (armed ? 0 : 1));
    const land = () => {
      const n = deps.sword.slash?.({ from: deps.player.pos.clone(), fwd, reach: T.reach, arc: T.arc, damage, heavy: true }) ?? 0;
      if (n) { haptics.play('hit'); deps.hitStop = 0.06; }
      techLog.push({ t, n });
    };
    audio.swordSwish(true); haptics.play('tap');
    if (t === 'lunge') { deps.player.dash(fwd.x, fwd.z, TECH.lunge.dash, TECH.lunge.dashSec); setTimeout(land, TECH.lunge.dashSec * 1000); }
    else land();
    if (armed) (deps.sword.equipped ? deps.sword : deps.sword2).swing();   // the cut you see
    techHud();
  }
  const techLog: { t: Technique; n: number }[] = [];
  function breathe() {
    if (!isFighter() || deps.state !== 'play' || deps.player.piloting) return;
    if (!fighterKit.breathe()) { if (performance.now() - techToldAt > 1200) { techToldAt = performance.now(); deps.toast(`Your breath steadies again in ${Math.ceil(fighterKit.cd.breath)} s.`, 1200); } return; }
    audio.breath(); deps.gesture('stretch');
    deps.toast('You plant your feet and draw a slow breath…', 1400);
  }
  function updateFighter(dt: number) {
    if (deps.state !== 'play') return;
    if (fighterKit.breathing > 0) { deps.player.analog.x = deps.player.analog.y = 0; deps.player.held.delete('forward'); deps.player.held.delete('back'); deps.player.held.delete('left'); deps.player.held.delete('right'); }
    if (fighterKit.update(dt)) { deps.toast(`+${BREATH.temp} temporary health (${BREATH.lasts} s).`, 2000); haptics.play('pickup'); }
    techHud();
  }
  /** The Fighter's three buttons on touch, with their cooldowns (hidden for other professions). */
  function techHud() {
    const el = document.getElementById('techHud');
    if (!el) return;
    const mage = deps.isMage() && deps.missile.learned, monk = deps.isMonk() && deps.inDungeon, on = (isFighter() || mage || monk) && deps.state === 'play' && !deps.player.piloting;
    el.classList.toggle('hidden', !on);
    el.classList.toggle('mage', mage);
    el.classList.toggle('monk', monk);
    if (!on) return;
    if (monk) { el.querySelector<HTMLElement>('[data-tech="lock"]')!.classList.toggle('cooling', !deps.lockTarget()); return; }
    if (mage) {
      const b = el.querySelector<HTMLElement>('[data-tech="missile"]')!, cd = deps.missile.cd;
      b.classList.toggle('cooling', cd > 0);
      const label = cd > 0 ? cd.toFixed(1) : 'Missile';
      if (b.textContent !== label) b.textContent = label;
      return;
    }
    for (const k of ['lunge', 'sweep', 'breath'] as const) {
      const b = el.querySelector<HTMLElement>(`[data-tech="${k}"]`)!, cd = fighterKit.cd[k];
      b.classList.toggle('cooling', cd > 0);
      const label = cd > 0 ? `${Math.ceil(cd)}` : k === 'lunge' ? 'Lunge' : k === 'sweep' ? 'Sweep' : 'Breath';
      if (b.textContent !== label) b.textContent = label;
    }
  }
  {
    const el = document.createElement('div'); el.id = 'techHud'; el.className = 'hidden';
    el.innerHTML = '<button data-tech="lunge" aria-label="Lunge">Lunge</button><button data-tech="sweep" aria-label="Sweep">Sweep</button><button data-tech="breath" aria-label="Take a breath">Breath</button><button data-tech="missile" aria-label="Magic missile">Missile</button><button data-tech="lock" aria-label="Lock on">Lock on</button>';
    el.addEventListener('pointerdown', (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tech]')?.dataset.tech; if (!t) return; e.preventDefault(); e.stopPropagation(); if (t === 'breath') breathe(); else if (t === 'missile') deps.castMissile(); else if (t === 'lock') deps.lockOn(); else technique(t as Technique); });
    document.getElementById('hud')?.appendChild(el);
  }
  return { fighterKit, techHud, isFighter, technique, breathe, updateFighter, techLog };
}
