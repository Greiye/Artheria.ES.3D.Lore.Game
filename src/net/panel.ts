import { escapeHtml } from '../submit';
// (Blocks are .net-sec divs, not <section>s: fit-panel would turn sections into tabs, and host / join / name belong on one page.)
import { Room, MAX_PLAYERS, NAME_MAX, cleanCode, newCode, loadNetName, saveNetName, type LeaveWhy } from './room';
import { EMOTES } from './emotes';
import './net.css';

// Play with friends (Mike 2026-11-04, multiplayer PR 1): host a room or join one by code; see who's in it; leave.
// Opened from the Journal. The room keeps running when the page is closed (you stay in it while you play).
export class FriendsPanel {
  readonly el: HTMLDivElement;
  room: Room | null = null;
  private busy = false;
  private error = '';
  private slowTimer = 0;
  /** Called whenever the room starts, changes or ends (main.ts adds and removes the other players). */
  onRoom: (room: Room | null, why?: LeaveWhy) => void = () => {};
  toast: (msg: string) => void = () => {};
  /** Say a preset phrase or do an emote (multiplayer 3; main.ts sends it and shows your bubble). */
  emote: (i: number) => void = () => {};

  constructor(private fallbackName: () => string, private mode: () => 'p2p' | 'local', private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'forge hidden';
    this.el.id = 'friendsPanel';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.id === 'netName') { saveNetName(t.value); this.room?.rename(t.value); }
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).id === 'netCode') { e.preventDefault(); void this.join(); }
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get name() { return loadNetName(this.fallbackName()); }

  open(code?: string) {
    this.error = '';
    this.render();
    this.el.classList.remove('hidden');
    if (code && !this.room) { const box = this.el.querySelector<HTMLInputElement>('#netCode'); if (box) box.value = code; }
  }
  close() {
    if (!this.isOpen) return;
    const box = this.el.querySelector<HTMLInputElement>('#netName');
    if (box) { saveNetName(box.value); this.room?.rename(box.value); }
    this.el.classList.add('hidden'); this.onClose();
  }

  /** Host (no code) or join (a code). Resolves once the room is set up (joiners may still be connecting). */
  async start(code: string | null): Promise<Room | null> {
    if (this.busy) return null;
    this.leave();
    this.busy = true; this.error = '';
    const host = code === null;
    try {
      const room = await Room.open(code ?? newCode(), this.name, host, this.mode());
      if (host) room.status = 'open';
      room.onChange = () => { this.onRoom(room); if (this.isOpen) this.render(); };
      room.onJoined = (m) => this.toast(`${m.name} joined the room`);
      room.onLeft = (m) => this.toast(`${m.name} left the room`);
      room.onClosed = (why) => {
        if (this.room === room) this.room = null;
        clearTimeout(this.slowTimer);
        if (why === 'full') this.error = `That room is full (${MAX_PLAYERS} players).`;
        if (why === 'kicked') this.toast('The host removed you from the room.');
        this.onRoom(null, why);
        if (this.isOpen) this.render();
      };
      this.room = room;
      clearTimeout(this.slowTimer);
      if (!host) this.slowTimer = window.setTimeout(() => { if (this.room === room && room.status === 'connecting' && this.isOpen) this.render(true); }, 15000);
      this.onRoom(room);
      return room;
    } catch (e) {
      this.error = 'Could not reach the room. Check your connection and try again.';
      console.warn('multiplayer:', e);
      return null;
    } finally {
      this.busy = false;
      if (this.isOpen) this.render();
    }
  }
  leave() { this.room?.close('left'); this.room = null; }

  inviteLink(code: string) {
    const u = new URL(location.href);
    u.search = ''; u.hash = '';
    u.searchParams.set('room', code);
    return u.toString();
  }

  private async join() {
    const box = this.el.querySelector<HTMLInputElement>('#netCode');
    const code = cleanCode(box?.value ?? '');
    if (!code) { this.error = 'A room code is 5 letters and numbers, like K7MPQ.'; this.render(); return; }
    await this.start(code);
  }

  private render(slow = false) {
    const r = this.room;
    const nameField = `<label class="field">Your name in rooms<input id="netName" type="text" maxlength="${NAME_MAX}" value="${escapeHtml(this.name)}" placeholder="Shown over your head"></label>`;
    const err = this.error ? `<p class="net-error" role="alert">${escapeHtml(this.error)}</p>` : '';
    let body: string;
    if (!r) {
      body = `<div class="net-sec"><h4>Who you are</h4>${nameField}</div>
        <div class="net-sec"><h4>Host</h4><p class="fine">Start a room and share its code with up to ${MAX_PLAYERS - 1} friends.</p>
          <div class="forge-actions"><button class="primary" data-net="host" ${this.busy ? 'disabled' : ''}>Host a room</button></div></div>
        <div class="net-sec"><h4>Join</h4>
          <label class="field">Room code<input id="netCode" type="text" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="K7MPQ"></label>
          <div class="forge-actions"><button class="primary" data-net="join" ${this.busy ? 'disabled' : ''}>${this.busy ? 'Joining…' : 'Join'}</button></div></div>`;
    } else {
      const who = r.everyone.map((m) => `<li>${escapeHtml(m.name)}${m === r.self ? ' <span class="fine">(you)</span>' : ''}${m.host ? ' <span class="net-host">host</span>' : ''}${r.isHost && m !== r.self ? ` <button class="net-kick" data-kick="${escapeHtml(m.id)}" aria-label="Remove ${escapeHtml(m.name)} from the room">Remove</button>` : ''}</li>`).join('');
      const says = EMOTES.map((e, i) => `<button class="net-say" data-emote="${i}">${escapeHtml(e.label)}</button>`).join('');
      const status = r.status === 'connecting'
        ? (slow ? 'Still looking for the room. Check the code with your friend; strict school or work Wi-Fi can block rooms.' : 'Looking for the room…')
        : r.count === 1 ? 'Waiting for friends to join.' : `${r.count} of ${MAX_PLAYERS} players.`;
      body = `<div class="net-sec"><h4>Room</h4>
          <p class="net-code" aria-label="Room code">${r.code}</p>
          <div class="forge-actions"><button class="secondary" data-net="copy">Copy invite link</button></div>
          <p class="fine" id="netStatus" aria-live="polite">${status}</p>
          <ul class="net-list">${who}</ul></div>
        <div class="net-sec"><h4>Say</h4><div class="net-says">${says}</div>
          <p class="fine">Pick a phrase: it shows over your head for everyone in the room.</p></div>
        <div class="net-sec"><h4>Who you are</h4>${nameField}</div>
        <div class="forge-actions"><button class="secondary" data-net="leave">Leave the room</button></div>`;
    }
    this.el.innerHTML = `<div class="forge-panel net-panel">
      <div class="eyebrow">Play with friends</div>
      <h2>${r ? 'In a room' : 'Rooms'}</h2>
      ${err}${body}
      <div class="forge-actions"><button class="secondary" data-net="close">Done</button></div>
      <p class="fine">Friends only: players find each other by code. Only your room name, look and moves are shared, phone to phone. Your writing and saves stay on this device.</p>
    </div>`;
  }

  private click(e: Event) {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) return;
    const act = b.dataset.net;
    if (b.dataset.emote !== undefined) { const i = Number(b.dataset.emote); this.close(); this.emote(i); return; }
    if (b.dataset.kick && this.room) {
      const m = this.room.members.get(b.dataset.kick);
      if (m) { this.room.kick(m.id); this.toast(`${m.name} was removed from the room`); }
      return;
    }
    if (act === 'close') this.close();
    else if (act === 'host') void this.start(null);
    else if (act === 'join') void this.join();
    else if (act === 'leave') { this.leave(); this.render(); }
    else if (act === 'copy' && this.room) {
      const link = this.inviteLink(this.room.code);
      navigator.clipboard?.writeText(link).then(() => this.toast('Invite link copied'), () => this.toast(link));
    }
  }
}
