// Multiplayer: friends-only rooms, remote players, shared state (src/net/). Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import { controls } from '../controls';
import { station } from '../stations';
import { type AnimInput } from '../anim/procedural';
import { Pet, SPECIES, type PetId, type PetPrefs } from '../pets/pet';
import { REGIONS, WAGON_STOPS, type RegionId } from '../world/regions';
import { type TimeOfDay } from '../world/sky';
import { FriendsPanel } from '../net/panel';
import { cleanCode, cleanName, MAX_PLAYERS, type Room } from '../net/room';
import { Remote, packState, placeLabel, SEND_HZ } from '../net/remotes';
import { EMOTES, emoteAt, Bubble } from '../net/emotes';
import type { MultiplayerDeps } from '../main';

export function setupMultiplayer(deps: MultiplayerDeps) {
  // `?net=local` keeps rooms inside this browser (tabs talk over BroadcastChannel): tests, and trying it on one PC.
  const friends = station(new FriendsPanel(() => deps.character.name, () => (deps.urlFlags.get('net') === 'local' ? 'local' : 'p2p'), () => deps.leaveForge()));
  friends.toast = (m) => deps.toast(m, 3200);
  function openFriends(code?: string) { if (deps.state !== 'play' && deps.state !== 'pause') return; deps.enterForge(); friends.open(code); }
  // Multiplayer 2: the other players in the room, as rigged figures in the puppet loop (ids 'net:<peer>').
  const remotes = new Map<string, Remote>();
  function syncRemotes(room: Room | null) {
    for (const [id, r] of remotes) if (!room?.members.has(id)) {
      if (room && deps.inDungeon && !r.away && r.place === placeNow()) deps.toast(`${r.name} dropped out. The goblins are yours to hold.`, 3600);   // Round D4
      r.remove(); remotes.delete(id); deps.puppets.delete('net:' + id); setRemotePet(id, null); }
    if (deps.netGuests !== (room?.members.size ?? 0)) { deps.netGuests = room?.members.size ?? 0; deps.applyQuality(); }   // phone polish: fewer crowd sprites per guest on Low
    syncRoomBtn(room);
    if (!room) return;
    for (const m of room.members.values()) {
      let r = remotes.get(m.id);
      if (!r) {
        r = new Remote(m.id, m.name, deps.world.scene); remotes.set(m.id, r);
        const sw = deps.sword.held.clone(), bk = deps.heldBook.model.clone(); sw.visible = bk.visible = false;
        r.hold({ sword: sw, torch: deps.torch.cloneHeld(), book: bk });
        if (deps.descent && partyRun) room.send('run', partyRun, m.id);   // Round D2: a newcomer gets the run's floor and seed
        room.send('pet', myPet(), m.id);                       // tell a newcomer about your pet,
        if (room.isHost) room.send('time', deps.world.time, m.id);  // and the host sets their sky to the room's
      }
      if (r.name !== m.name) r.setName(m.name);
      if (m.look !== r.lookRaw && r.setLook(m.look)) deps.puppets.set('net:' + m.id, { root: r.figure!, fig: r.fig ?? undefined });
    }
  }
  // Multiplayer 4: a small room button on the HUD while you're in a room (taps, clicks; pads use the Journal).
  const roomBtn = document.createElement('button');
  roomBtn.id = 'roomBtn'; roomBtn.className = 'hidden'; roomBtn.type = 'button';
  deps.$('hud').appendChild(roomBtn);
  roomBtn.addEventListener('click', (e) => { e.stopPropagation(); openFriends(); });
  roomBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  function syncRoomBtn(room: Room | null) {
    roomBtn.classList.toggle('hidden', !room);
    if (!room) return;
    // Round D1: players in another place are not drawn; the button says where they are instead.
    const here = placeNow();
    const apart = [...remotes.values()].filter((r) => !r.away && r.place !== here).map((r) => `${r.name} ${placeLabel(r.place)}`);
    const text = `💬 Room ${room.code} · ${room.count}/${MAX_PLAYERS}${apart.length ? ` · ${apart.join(', ')}` : ''}`;
    if (roomBtn.textContent !== text) roomBtn.textContent = text;
  }
  /** Where you are, as the room sees it: 0 up top, the descent's floor, or -1 in another cellar. */
  function placeNow(): number { return deps.inDungeon ? (deps.descent?.floor ?? -1) : 0; }
  // Multiplayer 3: emotes (preset only), pets that come along, one sky for the room, and the host's Remove.
  const myBubble = new Bubble();
  deps.player.body.add(myBubble.sprite); myBubble.sprite.position.y = controls.eyeHeight + 0.9;
  const remotePets = new Map<string, Pet>();
  function setRemotePet(peer: string, d: unknown) {
    const o = d && typeof d === 'object' ? d as { id?: unknown; name?: unknown } : null;
    const id = o && typeof o.id === 'string' && Object.prototype.hasOwnProperty.call(SPECIES, o.id) ? o.id as PetId : null;
    const had = remotePets.get(peer);
    if (had && had.id === id) { const n = cleanName(o?.name); if (n) had.prefs.names[id!] = n; return; }
    if (had) { deps.world.scene.remove(had.root, had.hit); remotePets.delete(peer); }
    const r = remotes.get(peer);
    if (!id || !r) return;
    const prefs: PetPrefs = { friends: [id], withYou: id, stayAt: {}, names: {} };
    const n = cleanName(o?.name); if (n) prefs.names[id] = n;
    const p = new Pet(id, deps.world.scene, r.root.position.clone(), r.root.rotation.y, deps.world.colliders, () => deps.player.bounds, prefs);
    p.terrain = (x, z) => deps.world.heightAt(x, z);
    p.root.name = 'netpet:' + peer;
    remotePets.set(peer, p);
  }
  function myPet() { const p = deps.pets.find((q) => q.following); return p ? { id: p.id, name: p.name } : null; }
  function emote(i: number) {
    const e = EMOTES[i], room = friends.room;
    if (!e || !room) return;
    room.send('emote', i);
    myBubble.say(e.say);
    if (e.gesture) deps.gesture(e.gesture);
  }
  friends.emote = emote;
  // Round D3: on a shared floor the player with the lowest id leads: their game runs the goblins and sends where they
  // are; the others' goblins follow and send back the hits they land. If the leader leaves, the next one takes over.
  const FOE_HZ = 8;
  let foeClock = 0, foeLead: string | null = null;
  function floorLeader(): string | null {
    const room = friends.room;
    if (!room || !deps.inDungeon || !deps.descent) return null;
    const here = placeNow();
    const ids = [room.self.id, ...[...remotes.values()].filter((r) => !r.away && r.place === here).map((r) => r.id)];
    return ids.length > 1 ? ids.sort()[0] : null;
  }
  function syncFoes(dt: number) {
    const room = friends.room;
    foeLead = floorLeader();
    const follow = !!room && !!foeLead && foeLead !== room.self.id;
    if (deps.goblins.puppet !== follow) { deps.goblins.puppet = follow; if (!follow) for (const f of deps.goblins.list) f.net = undefined; }
    // Round D4: the leader's goblins go for the nearest of everyone on the floor.
    const here = placeNow();
    deps.goblins.friends = room && foeLead && !follow ? [...remotes.values()].filter((r) => !r.away && r.place === here).map((r) => ({ id: r.id, pos: r.root.position })) : [];
    if (!room || !foeLead || (foeClock += dt) < 1 / FOE_HZ) return;
    foeClock = 0;
    if (!follow) room.send('foes', { seed: deps.dungeon.layout?.seed ?? 0, f: deps.goblins.snapshot() });
    else { const c = deps.goblins.claims(); if (c.length) room.send('hit', c, foeLead); }
  }
  // Round D2: a room shares its descent. One seed per floor; whoever goes down sends it, and the rest read it.
  let partyRun: { seed: number; floor: number } | null = null;
  function sharedSeed(floor: number): number {
    const room = friends.room;
    if (!room) return (Math.random() * 2 ** 31) | 0;
    const seed = partyRun?.floor === floor ? partyRun.seed : (Math.random() * 2 ** 31) | 0;
    partyRun = { seed, floor };
    room.send('run', partyRun);
    return seed;
  }
  friends.onRoom = (room) => {
    if (!room) partyRun = null;
    if (room) {
      room.on('foes', (d, m) => {
        const s = d as { seed?: unknown; f?: unknown } | null;
        if (!s || !deps.goblins.puppet || m.id !== foeLead || !deps.inDungeon || s.seed !== deps.dungeon.layout?.seed) return;
        deps.goblins.applySnapshot(s.f);
      });
      room.on('hit', (d, m) => {
        if (deps.goblins.puppet || !deps.inDungeon || !Array.isArray(d) || remotes.get(m.id)?.place !== placeNow()) return;
        for (const c of d.slice(0, 32)) if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) deps.goblins.claim(c[0], c[1]);
      });
      room.on('ouch', (d, m) => {
        if (!deps.goblins.puppet || m.id !== foeLead || !deps.inDungeon || !Array.isArray(d)) return;
        const f = deps.goblins.list[Number(d[0]) | 0], dmg = Number(d[1]);
        if (!f || f.state === 'dead' || !(dmg > 0)) return;
        deps.goblinWorld.hurt(Math.min(30, dmg), f, f.st.slowOnHit, f.root.position);
      });
      room.on('ride', (d, m) => {   // B54: a friend set off by wagon; if you're at the same stop, you ride along
        const r = d as { to?: unknown; from?: unknown } | null, to = r?.to as RegionId, from = r?.from as RegionId;
        if (!r || !(to === 'town' || to in REGIONS) || from !== deps.regions.current || !WAGON_STOPS[to] || deps.state !== 'play' || deps.inDungeon || deps.portalM.travelling) return;
        const s = deps.wagonStop(from); if (!s || deps.player.pos.distanceTo(s.at) > 10) return;
        deps.toast(`${m.name} calls you aboard. You ride along to ${deps.placeName(to)}.`, 3600);
        deps.travel(to, false, true);
      });
      room.on('fell', (d, m) => { if (Number.isFinite(d)) deps.toast(`${m.name} fell on floor ${d} of the descent.`, 4200); });
      room.on('run', (d, m) => {
        const r = d as { seed?: unknown; floor?: unknown } | null;
        if (!r || !Number.isFinite(r.seed) || !Number.isFinite(r.floor)) return;
        partyRun = { seed: Number(r.seed) | 0, floor: Number(r.floor) | 0 };
        if (!deps.inDungeon) deps.toast(`${m.name} is on floor ${partyRun.floor} of the descent. Go down the stairs to join.`, 4200);
      });
      room.lookOf = () => deps.myLook;
      room.onState = (from, d) => remotes.get(from)?.apply(d);
      room.on('emote', (d, m) => {
        const e = emoteAt(d), r = remotes.get(m.id);
        if (!e || !r) return;
        r.bubble.say(e.say);
        if (e.gesture) r.fig?.play(e.gesture);
        if (r.away || r.root.position.distanceTo(deps.player.pos) > 25) deps.toast(`${m.name}: ${e.say}`, 2600);   // too far to see the bubble
      });
      room.on('time', (d) => { if ((d === 'day' || d === 'sunset' || d === 'night') && d !== deps.world.time) { deps.setWorldTime(d); netTime = d; } });
      room.on('pet', (d, m) => setRemotePet(m.id, d));
      netTime = deps.world.time; netPet = JSON.stringify(myPet());
    }
    syncRemotes(room);
  };
  let netTime: TimeOfDay = 'day', netPet = 'null';
  deps.netHello = () => friends.room?.sayHello();
  let netClock = 0;
  function netSend(dt: number, mine: AnimInput) {
    const room = friends.room;
    syncRoomBtn(room);   // Round D1: the room button follows who is below as you go down and up
    syncFoes(dt);        // Round D3: one player on a floor runs its goblins
    myBubble.update(dt);
    for (const [peer, p] of remotePets) {
      const r = remotes.get(peer);
      if (!r) continue;
      p.update(dt, r.root.position, r.root.rotation.y, false);
      p.root.visible = !r.away && r.place === placeNow();
    }
    if (!room || !deps.inWorld || (netClock += dt) < 1 / SEND_HZ) return;
    netClock = 0;
    room.sendState(packState(deps.player.body, mine, deps.torch.lit, placeNow()));
    if (deps.world.time !== netTime) { netTime = deps.world.time; room.send('time', netTime); }   // you slept: the room's sky moves on with you
    const pet = JSON.stringify(myPet());
    if (pet !== netPet) { netPet = pet; room.send('pet', myPet()); }
  }
  let inviteCode = cleanCode(deps.urlFlags.get('room') ?? '');   // an invite link: the panel opens with its code on the first Begin
  return { get inviteCode() { return inviteCode; }, set inviteCode(v) { inviteCode = v; }, friends, openFriends, remotes, placeNow, netSend, sharedSeed, get partyRun() { return partyRun; }, floorLeader };
}
