// Multiplayer transport (Mike 2026-11-04, "Make this game multiplayer!" + "Do it"; option A, friends-only rooms).
// One small interface so the rest of the game never knows how players are connected. Two versions:
//  - 'p2p'   : WebRTC, phone to phone (Trystero over public Nostr relays for the introductions only). No server of ours.
//  - 'local' : BroadcastChannel between tabs of this browser (`?net=local`), for tests and trying it on one PC.
// A relay server (option B in the proposal) would be a third version of this same interface.

export type Handler = (data: unknown, from: string) => void;

export interface Transport {
  readonly selfId: string;
  /** Send to every peer in the room, or to one. */
  send(kind: string, data: unknown, to?: string): void;
  on(kind: string, fn: Handler): void;
  onJoin(fn: (peer: string) => void): void;
  onLeave(fn: (peer: string) => void): void;
  leave(): void;
}

const APP_ID = 'artheria-es-3d-lore-game';

/** Kinds of messages, kept short on the wire (Trystero caps action names at 12 bytes). */
export const KINDS = ['hello', 'state', 'kick', 'emote', 'time', 'pet'] as const;

export async function p2pTransport(code: string): Promise<Transport> {
  const { joinRoom, selfId } = await import('trystero');
  // The room code doubles as the password: introductions on the public relays are encrypted with it.
  const room = joinRoom({ appId: APP_ID, password: 'artheria:' + code }, code);
  type Act = { send: (d: never, o?: { target: string }) => unknown; onMessage: unknown };
  const actions = new Map<string, Act>();
  const act = (kind: string): Act => {
    let a = actions.get(kind);
    if (!a) { a = room.makeAction(kind) as unknown as Act; actions.set(kind, a); }
    return a;
  };
  for (const k of KINDS) act(k);
  return {
    selfId,
    send: (kind, data, to) => { void act(kind).send(data as never, to ? { target: to } : undefined); },
    on: (kind, fn) => { act(kind).onMessage = (data: unknown, meta: { peerId: string }) => fn(data, meta.peerId); },
    onJoin: (fn) => { room.onPeerJoin = fn; },
    onLeave: (fn) => { room.onPeerLeave = fn; },
    leave: () => { void room.leave(); },
  };
}

/** Same-browser rooms over BroadcastChannel. Peers announce themselves, answer announcements, and say goodbye. */
export function localTransport(code: string): Transport {
  const selfId = Math.random().toString(36).slice(2, 10);
  const ch = new BroadcastChannel('artheria-room-' + code);
  const handlers = new Map<string, Handler>();
  const peers = new Set<string>();
  let join: (p: string) => void = () => {}, leave: (p: string) => void = () => {};
  type Wire = { from: string; to?: string; kind: string; data?: unknown };
  const post = (m: Wire) => ch.postMessage(m);
  ch.onmessage = (e: MessageEvent<Wire>) => {
    const m = e.data;
    if (!m || m.from === selfId || (m.to && m.to !== selfId)) return;
    if (m.kind === '~hi' || m.kind === '~ack') {
      if (m.kind === '~hi') post({ from: selfId, to: m.from, kind: '~ack' });
      if (!peers.has(m.from)) { peers.add(m.from); join(m.from); }
      return;
    }
    if (m.kind === '~bye') { if (peers.delete(m.from)) leave(m.from); return; }
    if (peers.has(m.from)) handlers.get(m.kind)?.(m.data, m.from);
  };
  const bye = () => post({ from: selfId, kind: '~bye' });
  addEventListener('pagehide', bye);
  setTimeout(() => post({ from: selfId, kind: '~hi' }), 0);
  return {
    selfId,
    send: (kind, data, to) => post({ from: selfId, to, kind, data }),
    on: (kind, fn) => { handlers.set(kind, fn); },
    onJoin: (fn) => { join = fn; },
    onLeave: (fn) => { leave = fn; },
    leave: () => { bye(); removeEventListener('pagehide', bye); ch.close(); peers.clear(); },
  };
}
