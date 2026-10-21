# Changelog

Per §0 rule 3 of the Video Gametool Project spec. One entry per shipped `VERSION`.

## Unreleased — Artheria lore pass (spec v0.05, D13)

- **Setting:** the book is now *Tales of Artheria*, compiled by Natalie Bourbon (title screen + contents page).
- **Lore:** 11 entries adapted from the public-safe Artheria lore (third-party names already renamed per the
  IP-renames list; mature lines cut per the mapping's content pass). Contradictions are kept in-world as
  "Sources disagree" notes, per the retcon-attribution file. Each entry has a `source:` field naming the
  master-lore section it came from, so its text can be re-synced later.
- **Natalie Bourbon (warner):** placeholder standee at spawn; draft dialogue in `content/dialogue/natalie.json`
  (not wired: the NPC/dialogue system is F3, v0.04). §6.5 exemplar *Natalie's Field Note* added.
- **Credits (D9):** frontmatter `credit_as` is shown in the book byline and contents; defaults to `contributor`.
  Only Mike's own lore is shelved; friends' lore waits for their `credit_as` reply (D13).
- No lore images shipped (sources unverified).

## 0.02 — 2026-10-20

Roadmap: F1 (Settings), A7 (WebAudio synth), version label.

- **F1.1 Graphics settings:** presets Low/Medium/High; render scale 50–100%; shadows and outlines toggles;
  fog distance slider; FOV 60–100°; FPS cap 30/60/∞. All apply live, no reload needed.
- **F1.2 Audio settings:** four buses (Master, Music, SFX, Dialogue), one `GainNode` each, 0–100 + mute per bus.
- **F1.3 Settings access:** reachable from the title screen ("Settings" button, new) and the in-game Esc
  pause menu (existing); persisted to `localStorage`, survives reload.
- **F1.4 Performance:** Low preset targets ≤16.7 ms/frame; see `docs/assumptions.md` #29 for how this is
  checked in a GPU-less test sandbox vs. on real hardware.
- **A7 Audio synth:** `src/audio.ts` — WebAudio-synthesized SFX routed through the four buses. Wind (ambient)
  and footsteps are wired now; twang / reload-click / goblin-murmur exist as generator functions, wired when
  F4/F6 land (see `docs/assumptions.md` #30).
- Version label shown on the title screen.
- **Baseline alignment (D7):** lore folder renamed `campaign/` → `content/` to match the locked spec path.
- **A5:** added `sunset` / `dusk` palette tokens (used starting F2.2, v0.03).

## 0.01 — 2026-10-16

First-person world (D1–D2 partial), Skyrim PC controls (D3 ref), the lore book (D7), mobile + gamepad input,
the in-browser lore editor, and character creation. Built before the v0.10-roadmap spec existed; retroactively
labeled 0.01 per D8. See `docs/assumptions.md` #1–#28 for the full history.
