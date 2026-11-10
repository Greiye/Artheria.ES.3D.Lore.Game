// B5: the Monk locks on to a goblin and meets it hand to hand. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { type DialogueScript } from '../dialogue';
import { type AnimInput } from '../anim/procedural';
import type { Fighter } from '../fight/engine';
import type { Level } from '../fight/ai';
import { type Foe } from '../foes/goblins';
import { haptics } from '../input/haptics';
import type { MonkDeps } from '../main';

export function setupMonk(deps: MonkDeps) {
  const isMonk = () => deps.character.profession === 'monk';
  const LOCK = { range: 6, cone: 1.2, lossDmg: 3 };
  let duel: { foe: Foe; won: boolean | null; view: boolean } | null = null;
  let lockToldAt = 0;
  /** The goblin a Monk would lock on to: the nearest awake one ahead, inside a few strides. */
  function lockTarget(): Foe | null {
    const yaw = deps.player.thirdPerson ? deps.player.bodyYaw : deps.player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let best: Foe | null = null, bd = Infinity;
    for (const f of deps.goblins.alive) {
      if (f.state === 'hidden') continue;
      const dx = f.root.position.x - deps.player.pos.x, dz = f.root.position.z - deps.player.pos.z, d = Math.hypot(dx, dz);
      if (d > LOCK.range || d < 0.01) continue;
      if (Math.acos(THREE.MathUtils.clamp((dx * fx + dz * fz) / d, -1, 1)) > LOCK.cone) continue;
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  function lockOn() {
    if (!isMonk() || deps.state !== 'play' || deps.player.piloting || deps.fightMode.isOpen) return;
    const tell = (m: string) => { if (performance.now() - lockToldAt > 1500) { lockToldAt = performance.now(); deps.toast(m, 1600); } };
    if (!deps.inDungeon) { tell('Nothing here to lock on to. Below, in the descent, you can meet a goblin hand to hand.'); return; }
    const f = lockTarget();
    if (!f) { tell('No goblin close enough ahead to lock on to.'); return; }
    // The mat goes down between you, turned so you keep your side of it.
    const mx = (deps.player.pos.x + f.root.position.x) / 2, mz = (deps.player.pos.z + f.root.position.z) / 2;
    const dx = deps.player.pos.x - mx, dz = deps.player.pos.z - mz;
    deps.RING = { x: mx, y: deps.player.pos.y, z: mz, rot: Math.atan2(-dz, dx) };
    duel = { foe: f, won: null, view: deps.player.thirdPerson };
    deps.enterForge();
    deps.player.thirdPerson = true;
    const lvl: Level = f.st.leader || f.role === 'guardian' || (deps.goblins.floor ?? 1) >= 10 ? 'fair' : 'easy';
    deps.fightMode.open({ name: f.v.display, hp: Math.round(THREE.MathUtils.clamp(f.hp * 8, 30, 100)), level: lvl });
    haptics.play('tap');
  }
  function endDuel() {
    const d = duel!; duel = null; deps.RING = deps.DOJO_RING;
    deps.fightFx.visible = false;
    deps.player.thirdPerson = d.view;
    deps.leaveForge();
    if (d.won) { deps.goblins.defeat(d.foe); haptics.play('hit'); }
    else {   // lost, or left the mat: you break away and it costs you
      const p = deps.player.pos, f = d.foe.root.position, dx = p.x - f.x, dz = p.z - f.z, n = Math.hypot(dx, dz) || 1;
      if (deps.dungeon.walkable(p.x + (dx / n) * 1.2, p.z + (dz / n) * 1.2)) deps.player.pos.set(p.x + (dx / n) * 1.2, p.y, p.z + (dz / n) * 1.2);
      deps.goblinWorld.hurt(LOCK.lossDmg, d.foe, 0, null);
    }
  }
  function lenjuScript(): DialogueScript {
    const r = deps.sky.record, flown = r.runs > 0;
    return { speaker: 'Lenju', start: 'hi', nodes: {
      hi: { text: flown ? (r.wins ? `Back for more sky? ${r.wins} beacon${r.wins > 1 ? 's' : ''} reached. Not bad for someone who walks most days.` : 'You came back down in one piece. That counts as a first lesson.') : "I'm Lenju. I fly the skyrunner, the glider up on the perch. Mana-sail wings, a gem in the nose, no engine at all.", choices: [
        { text: 'How does it fly?', next: 'how' },
        { text: 'Who built all this?', next: 'built' },
        { text: 'Any tips?', next: 'tips' },
        { text: 'Let me fly it.', next: 'fly' },
        { text: 'Later.', next: 'bye' },
      ] },
      how: { text: "The sails catch the mana in the air, the way the old fairies' wings did. Bank and it turns, let go and it levels out. You have sixty breaths to reach the blue beacon before the sails run dry.", next: 'hi2' },
      built: { text: 'Taitai. Best carpenter this side of the river and my oldest friend. He built the perch, the ramp, every beacon tower. I just fall off them with style.', next: 'hi2' },
      tips: { text: "Fly through the golden wind rings, they buy you time. Stay above the hills. And if a black-sailed skyrunner shows up, bank hard and pull. It can't turn as tight as you.", next: 'hi2' },
      hi2: { text: 'Anything else?', choices: [
        { text: 'How does it fly?', next: 'how' },
        { text: 'Who built all this?', next: 'built' },
        { text: 'Any tips?', next: 'tips' },
        { text: 'Let me fly it.', next: 'fly' },
        { text: 'Later.', next: 'bye' },
      ] },
      fly: { text: "Up the ladder, then. Taitai checked the straps this morning. I think.", actions: ['sky:fly'], end: true },
      bye: { text: 'The sky will keep.', end: true },
    } };
  }
  function taitaiScript(): DialogueScript {
    return { speaker: 'Taitai', start: 'hi', nodes: {
      hi: { text: "Taitai, carpenter. Mind the offcuts. Lenju had an idea about flying and needed somewhere to fall from, so I built him one.", choices: [
        { text: 'You built the perch?', next: 'perch' },
        { text: 'How do you know Lenju?', next: 'friend' },
        { text: 'Goodbye.', next: 'bye' },
      ] },
      perch: { text: 'The perch, the ramp, and the stone-footed towers that hold the beacons out past the hills. Oak legs, cross-braced twice. The glider frame too. Lenju only trusts my joints.', next: 'hi2' },
      friend: { text: "Since we were small. He climbed things, I built them taller. Somebody has to keep him from flying off a roof that isn't finished.", next: 'hi2' },
      hi2: { text: 'Anything else?', choices: [
        { text: 'You built the perch?', next: 'perch' },
        { text: 'How do you know Lenju?', next: 'friend' },
        { text: 'Goodbye.', next: 'bye' },
      ] },
      bye: { text: "Tell Lenju to bring the glider back in one piece. I'm out of good ash.", end: true },
    } };
  }
  /** How a fighter's state shows on its figure: fists up, walking, hopping, a crouch, the strike, down. */
  function fightInput(f: Fighter): AnimInput {
    const m = f.move;
    let k = 0;
    if (m) k = f.t < m.startup ? (f.t / m.startup) * 0.5 : f.t < m.startup + m.active ? 0.5 : 0.5 + ((f.t - m.startup - m.active) / m.recovery) * 0.5;
    const thrower = !!f.holding;
    return {
      speed: f.state === 'walk' || f.state === 'guard' ? Math.hypot(f.vx, f.vz) : f.state === 'step' ? 2.4 : 0,
      airborne: !f.grounded || f.state === 'juggle' || f.state === 'thrown',
      fight: f.state !== 'ko' && f.state !== 'down',
      crouch: f.low && f.state !== 'down',
      strike: thrower ? { limb: 'throw', aim: 'grab', k: 0.5 } : m ? { limb: m.limb, aim: m.aim, k: Math.min(1, k) } : null,
      pose: f.state === 'ko' || f.state === 'down' ? 'sitground' : null, look: null,
    };
  }
  /** Run the fight and put both fighters, the shields, the bolts and the camera where the fight says. */
  function syncFight(dt: number) {
    if (!deps.fightMode.isOpen) return;
    deps.fightMode.update(dt);
    const F = deps.fightMode.fight, a = F.a, b = F.b;
    // Facing on the mat to a yaw in the world (the mat's x is the world's -x).
    const pa = deps.ringPt(a.x, a.z), pb = deps.ringPt(b.x, b.z), foe = duel ? duel.foe.root : deps.kavikRoot;
    deps.player.pos.set(pa.x, deps.RING.y + a.y, pa.z); deps.player.yaw = deps.player.bodyYaw = Math.atan2(a.face.x, -a.face.z) + deps.RING.rot; deps.player.pitch = 0; deps.player.syncNow();
    foe.position.set(pb.x, deps.RING.y + b.y, pb.z); foe.rotation.y = Math.atan2(-b.face.x, b.face.z) + deps.RING.rot;
    if (duel) duel.foe.anim.update(dt, fightInput(b));
    deps.fightFx.visible = true;
    deps.sparkT -= dt; deps.spark.visible = deps.sparkT > 0;
    if (deps.spark.visible) { deps.spark.scale.setScalar(1 + (0.2 - deps.sparkT) * 6); deps.sparkMat.opacity = Math.min(1, deps.sparkT * 8); }
    // Side-on to the line between the fighters, from the side the screen's right says: it swings round as they circle.
    const mx = (pa.x + pb.x) / 2, mz = (pa.z + pb.z) / 2, gap = F.dist(), up = Math.max(a.y, b.y) * 0.6;   // follow a jump up
    const rx = -F.right.x, rz = F.right.z, back = (duel ? 3.6 : 4.8) + gap * 0.45;   // the screen's right in the world; the camera sits behind it (closer below: corridors)
    const c = Math.cos(deps.RING.rot), sn = Math.sin(deps.RING.rot), ox = -rz * back, oz = rx * back;
    deps.fightCam.x = mx + ox * c + oz * sn; deps.fightCam.z = mz - ox * sn + oz * c;
    deps.rig.setShot({ pos: new THREE.Vector3(deps.fightCam.x, 1.7 + up, deps.fightCam.z), look: new THREE.Vector3(mx, 1.15 + up, mz), fov: 46 });
  }
  return { syncFight, fightInput, get duel() { return duel; }, set duel(v) { duel = v; }, endDuel, lenjuScript, taitaiScript, isMonk, lockTarget, lockOn };
}
