import { storeSet } from '../store';
import { localTransport, p2pTransport, type Transport } from './transport';

// Friends-only rooms (Mike 2026-11-04, multiplayer defaults): up to 4 players, joined by a 5-letter code or a
// `?room=CODE` link. Only your multiplayer name, look and moves are shared, and only with the players in the room;
// nothing is stored anywhere but this device. Peers are other people's phones, so everything they send is checked.

export const MAX_PLAYERS = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I
const NAME_KEY = 'gametool.net.name';
export const NAME_MAX = 20;

export interface Member { id: string; name: string; host: boolean; joinedAt: number; look?: unknown }
export type RoomStatus = 'connecting' | 'open';

export function newCode(): string {
  let s = '';
  const r = crypto.getRandomValues(new Uint32Array(5));
  for (const n of r) s += CODE_CHARS[n % CODE_CHARS.length];
  return s;
}
/** Upper-cases and strips a typed or pasted code; null if it isn't one. */
export function cleanCode(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 5 && [...c].every((ch) => CODE_CHARS.includes(ch)) ? c : null;
}
export function cleanName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX) : '';
}
export function loadNetName(fallback: string): string {
  try { return cleanName(localStorage.getItem(NAME_KEY) ?? '') || cleanName(fallback) || 'Traveller'; } catch { return cleanName(fallback) || 'Traveller'; }
}
export function saveNetName(n: string) { storeSet(NAME_KEY, cleanName(n)); }

export type LeaveWhy = 'left' | 'full' | 'kicked';

export class Room {
  readonly members = new Map<string, Member>();   // everyone else in the room
  readonly self: Member;
  status: RoomStatus = 'connecting';
  onChange: () => void = () => {};
  onJoined: (m: Member) => void = () => {};
  onLeft: (m: Member) => void = () => {};
  onClosed: (why: LeaveWhy) => void = () => {};
  /** Another player's 12-a-second state (src/net/remotes.ts reads it). */
  onState: (from: string, data: unknown) => void = () => {};
  /** Your look, sent with your hello (main.ts sets it; src/net/look.ts packs it). */
  lookOf: () => unknown = () => null;
  private closed = false;

  private constructor(readonly code: string, readonly t: Transport, name: string, host: boolean) {
    this.self = { id: t.selfId, name, host, joinedAt: Date.now() };
    t.onJoin((id) => { this.t.send('hello', this.hello(), id); });
    t.onLeave((id) => {
      const m = this.members.get(id);
      if (!m) return;
      this.members.delete(id); this.onLeft(m); this.onChange();
    });
    t.on('hello', (d, from) => this.gotHello(d, from));
    t.on('state', (d, from) => { if (this.members.has(from)) this.onState(from, d); });
    t.on('kick', (_d, from) => { if (this.members.get(from)?.host) this.close('kicked'); });
  }

  static async open(code: string, name: string, host: boolean, mode: 'p2p' | 'local'): Promise<Room> {
    const t = mode === 'local' ? localTransport(code) : await p2pTransport(code);
    return new Room(code, t, cleanName(name) || 'Traveller', host);
  }

  get isHost() { return this.self.host; }
  get count() { return this.members.size + 1; }
  /** Everyone, in join order (the order the full-room rule uses). */
  get everyone(): Member[] { return [this.self, ...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1)); }

  rename(name: string) {
    const n = cleanName(name);
    if (!n || n === this.self.name) return;
    this.self.name = n; this.t.send('hello', this.hello()); this.onChange();
  }
  /** Tell the room your look changed (the forge, the tailor). */
  sayHello() { if (!this.closed) this.t.send('hello', this.hello()); }
  /** Room messages beyond hello/state (emote, time, pet, run): sent to all, or one; heard only from members. */
  send(kind: 'emote' | 'time' | 'pet' | 'run', data: unknown, to?: string) { if (!this.closed && this.members.size) this.t.send(kind, data, to); }
  on(kind: 'emote' | 'time' | 'pet' | 'run', fn: (data: unknown, from: Member) => void) {
    this.t.on(kind, (d, from) => { const m = this.members.get(from); if (m && !this.closed) fn(d, m); });
  }
  sendState(w: unknown) { if (!this.closed && this.members.size) this.t.send('state', w); }
  kick(id: string) { if (this.isHost && this.members.has(id)) this.t.send('kick', 1, id); }
  close(why: LeaveWhy = 'left') {
    if (this.closed) return;
    this.closed = true; this.t.leave(); this.members.clear(); this.onClosed(why);
  }

  private hello() { return { name: this.self.name, host: this.self.host, at: this.self.joinedAt, look: this.lookOf() }; }
  private gotHello(d: unknown, from: string) {
    if (this.closed || !d || typeof d !== 'object') return;
    const o = d as { name?: unknown; host?: unknown; at?: unknown; look?: unknown };
    const at = typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : Date.now();
    const known = this.members.get(from);
    const m: Member = { id: from, name: cleanName(o.name) || 'Traveller', host: o.host === true, joinedAt: at, look: o.look };
    this.members.set(from, m);
    this.status = 'open';
    // Full: the first MAX_PLAYERS to have joined stay; anyone later bows out on their own phone (and the rest
    // never count them in).
    const order = this.everyone;
    if (order.indexOf(this.self) >= MAX_PLAYERS) { this.close('full'); return; }
    if (order.indexOf(m) >= MAX_PLAYERS) { this.members.delete(from); return; }
    if (!known) this.onJoined(m);
    this.onChange();
  }
}
