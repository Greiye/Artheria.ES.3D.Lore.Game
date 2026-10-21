# Changelog

Per §0 rule 3 of the Video Gametool Project spec. One entry per shipped `VERSION`.

## Unreleased — next launch (roadmap 0.03 onward + Artheria lore pass)

One merged entry until the site launches on GitHub Pages; the owner sets `VERSION` then (still 0.02).
Spec doc v0.05.

### Roadmap 0.03 — F2 world/camera, §5, §6.3 prompts

- **F2.1 Load + fade-in:** black load screen with a progress bar (`index.html`); 2 s fade once the world is
  built and the first frame is drawn.
- **F2.2 Sunset:** orange sun at 11° elevation, dusk-purple to sunset-orange sky dome, warm fog and fill
  light, low sun for long shadows (Shadows on). New palette tokens `sunLight`, `sunsetFog`, `sunsetGlow`.
- **F2.3 Ruined Library (D13):** a scorched stone hall beyond the lectern with a 3.4 m wooden door, broken
  crenellations and fallen blocks; paving runs from the dais to the door. The door is locked (opens with
  F3.4 at 0.04). Natalie's standee now stands left of the door (§3 step 4).
- **F2.4 POV toggle:** F (touch: View) switches first/third person. Third person shows a capsule body with a
  facing nub (A6), camera 3 m back and 0.5 m right, pulled in before it can enter a wall. Book reach (F3.1)
  is now measured from the eyes so it works in both views.
- **§6.3 / 0.03 creativity check:** the title screen shows one creation prompt from
  `content/rolltables/creation-prompts.json`, rotating daily.
- Page and app renamed *Tales of Artheria* (`index.html`, web manifest).
- Version number and "Mike Go" shown in the bottom-right corner of every screen.
- `test/e2e-v0.03.mjs`: checks for the above.

### Artheria lore pass (D13)

- **Setting:** the book is now *Tales of Artheria*, compiled by Natalie Bourbon (title screen + contents page).
- **Lore:** 11 entries adapted from the public-safe Artheria lore (third-party names already renamed per the
  IP-renames list; mature lines cut per the mapping's content pass). Contradictions are kept in-world as
  "Sources disagree" notes, per the retcon-attribution file. Each entry has a `source:` field naming the
  master-lore section it came from, so its text can be re-synced later.
- **Natalie Bourbon (warner):** placeholder standee by the library door; draft dialogue in `content/dialogue/natalie.json`
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
