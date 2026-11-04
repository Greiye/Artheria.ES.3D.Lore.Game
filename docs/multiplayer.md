# Multiplayer (v0.15)

Mike, 2026-11-04: "Make this game multiplayer!" Proposal approved with every default ("Do it"): option A (peer-to-peer),
4 players, friends-only rooms by code, preset phrases only, a separate room name.

## How it connects
- `src/net/transport.ts`: one `Transport` interface. `p2pTransport` uses WebRTC through Trystero (Nostr strategy).
  Public Nostr relays only carry the encrypted introductions (the room code is the password); after that the game data
  goes phone to phone. No server of ours, so GitHub Pages stays as it is. `localTransport` (`?net=local`) uses a
  BroadcastChannel between tabs of one browser: the e2e test and trying it on one PC.
- A relay server (option B: Cloudflare Durable Objects or PartyKit, needed for public rooms or 8+ players) would be a
  third `Transport`; nothing else changes.
- Known limit: strict networks (some school/work Wi-Fi, some mobile carriers) block direct WebRTC links. A TURN relay
  (`turnConfig` in `p2pTransport`) would fix those; none is configured.

## What is shared
| Message | When | What |
| --- | --- | --- |
| `hello` | on join, rename, new look | room name, host flag, join time, look (`src/net/look.ts`, whitelisted on receipt) |
| `state` | 12 Hz while in the world | position, yaw, crouch, speed, flags (airborne, aim, sword, talking, torch), pose, swing, combo, head look, lean |
| `emote` | on a phrase | an index into `EMOTES` (`src/net/emotes.ts`); never text |
| `pet` | on join, on change | the pet with you: species id and name |
| `time` | on join (host), on any sleep | `day` / `sunset` / `night` |
| `kick` | host only | the target leaves |

Nothing else leaves the device: lore, writing, sketches, the character's motivation and secret, saves, bag, quests.
NPCs, townsfolk and the crowd run locally on each phone.

## Rules
- Full room: the first 4 to join (by join time) stay; a later one leaves on its own phone and is never counted in.
- A player silent for 5 s is hidden (at a menu, phone asleep). Past 45 m only their name tag shows.
- On Low / Low power the crowd drops 3 sprites per guest (never below 4).

## Files
`src/net/transport.ts`, `room.ts`, `panel.ts` (Journal → Play with friends), `remotes.ts` (other players' figures),
`look.ts`, `emotes.ts`, `net.css`; wiring in `src/main.ts` (search "Multiplayer"). Test: `test/e2e-multiplayer.mjs`.
