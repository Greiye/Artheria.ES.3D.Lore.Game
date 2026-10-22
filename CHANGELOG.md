# Changelog

Per §0 rule 3 of the Video Gametool Project spec. One entry per shipped `VERSION`.

## Unreleased — next launch (roadmap 0.03 onward + Artheria lore pass)

One merged entry until the site launches on GitHub Pages; the owner sets `VERSION` then (still 0.02).
Spec doc v0.05.

### Rebuild R1–R2: new look (docs/vision.md, docs/rebuild-plan.md)

- **R1 render core:** pixel textures painted at load time from colour ramps plus clustered per-texel
  noise (`src/tex/pixel.ts`: grass, dirt, paving, stone, mossy stone, scorched bricks, bark, birch, leaves,
  grass blades, ferns, flowers, planks, door). 1 tile = 1 m everywhere via world-space box UVs, and props
  are batched into a few draw calls (`src/world/batch.ts`). Nearest-neighbour up close, mipmapped far away.
- **R1 lighting:** golden-hour sky, teal overhead and gold at the horizon. The low sun (13°, still F2.2) is
  brighter, there's a warm haze, soft light shafts that face the camera, and drifting motes (`src/world/sky.ts`).
- **R1 post effects:** the Graphics "Outlines" toggle is now **Post effects (glow)**, which adds bloom on the
  sun, rune caps, lanterns and shafts (`src/render/post.ts`). It's on in High only, off in Low and Medium.
  Saved "outlines" settings carry over.
- **R2 glade:** Vintage Story-style forest: birch and oak trunks with alpha-cut leaf-block canopies, a tree
  ring beyond the boundary, leaf-block bushes, ~3,200 wind-swayed grass/fern/flower tufts, dirt patches,
  mossy dais and pillars, carved lectern, ivy-hung scorched library with door lanterns. Layout, colliders
  and ids are unchanged.
- **R2 characters:** the hero, Natalie and the player are Mega Man Legends-style placeholder figures: boxy
  parts, a big head with a painted face, light painted into the vertex colours (unlit), and a blob shadow.
  The stagecoach is a chunky coach with lit lanterns. `.glb` model slots work as before.
- Legacy `src/world.ts` and `src/palette.ts` were removed. Tests were updated for the post-effects toggle.

### Rebuild R3: camera rig

- **Camera rig** (`src/camera/rig.ts`): the camera code moved out of the player. **Third-person follow is now
  the default view** (3 m back, 0.5 m right, never through walls; it pulls in at once and eases back out).
  F still switches to first person.
- **Framed shots:** opening the lectern book eases the camera to a low three-quarter view of the book, and
  the page scrim is now lighter and blurred so the shot shows through. Talking to Natalie frames her over the
  player's shoulder. Both blend back over 0.6 s.
- **Crossbow:** equipping it switches to first person (the viewmodel), and putting it away restores the
  previous view, whether you use keyboard, touch or gamepad.
- **Mouse-look** ignores a single bogus huge jump that Chromium sometimes sends under pointer lock (the view
  used to snap sideways).
- **Auto-update notice:** the game checks `build.json` and shows "New version, Reload" when Pages has a newer
  build (fixes the installed Firefox app lagging one update).
- `test/e2e-rebuild.mjs` (new, in `npm run test:e2e`) covers the pixel textures, batching, follow camera,
  reading shot and dialogue shot, and waits on game state rather than wall-clock time.
  `test/e2e-v0.03.mjs` now expects third person by default. v0.05/v0.06 aim checks no longer race the
  test browser's frame rate or its pointer re-centring.

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

### Roadmap 0.04 — F3 dialogue and inventory

- **F3.1 Dialogue box:** Ren'Py-style bottom panel with a name tag, typewriter at 40 characters/s. Click,
  Space or E first finishes the line, then advances. Scripts load from `content/dialogue/*.json` (§6.7).
- **F3.2 Choices:** buttons (or number keys 1–9); a choice picks the next node.
- **F3.3:** talking frees the pointer and freezes movement.
- **F3.4 Inventory (I):** grid of name + count (touch: Bag). Items live in `content/items.json` (H4).
  Dialogue actions `give:<item>:<n>` and `unlock:library_door` work: Natalie hands over the scout's crossbow
  and 10 bolts, and the library door swings open. The roofless hall can be entered (interior is 0.06).
- **0.04 creativity check:** Natalie's "I don't know what to make" answers with a random §6.3 prompt, then
  still gives the crossbow.
- E on Natalie shows "E — Talk to Natalie"; talking again replays her lines without duplicating items.
- `test/e2e-v0.04.mjs`.

### Roadmap 0.05 — F4 crossbow

- **F4.1:** 1 equips the scout's crossbow (once Natalie has given it), 2 puts it away. RMB aims down sights
  (FOV −15°), LMB fires. Placeholder box crossbow in first person (A6).
- **F4.2:** bolts fly at 60 m/s with gravity and stick in walls, trees, rocks or the ground for 30 s.
- **F4.3 Active reload:** R starts a 2 s bar. R again inside the bright 15% zone = 0.5 s reload and 2× damage
  on the next shot; outside it = a 3 s jam.
- **F4.4:** every shot uses a bolt; E on a stuck bolt picks it back up. HUD shows bolts and reload state.
- Gamepad: RT fire, LT aim, X reload, D-pad up crossbow/hands. Touch: Bow, Reload, Aim, Fire buttons.
- Creativity check: none for 0.05 (combat only, as §8 states).
- `test/e2e-v0.05.mjs`.

### Ruined Library lore pass

- The Noctavel Portal artifact is on a scorched stone altar in the back hall (public lore: "holds an artifact
  that comes from the Noctavel Portal. The artifact is still there."). It turns slowly and gives its line when E is pressed.
- Grey books gain two charred-by-orc-fire lines (mapping §0 0.06 row).
- The Ruined Library entry says where the artifact is now. Part III DM material is not used.

### Roadmap 0.06 — F5 library and books, §6.1–§6.5 (the creativity version)

- **F5.1 Library interior:** 12 shelves (6 per side wall) with name plates, three tables with candles and
  scrolls, crates, and the small exit door at the far end (it opens at 0.12). Static furniture is baked into
  one mesh per colour to stay inside the draw-call budget.
- **F5.2 `content/shelves.json`:** each shelf lists its red-book slugs and a grey-book count. Every slug must
  resolve to an `.md`; a book missing from `shelves.json` is shelved automatically, so contributors never
  have to edit it.
- **F5.3 Grey books:** E shows a random line from `content/rolltables/grey-books.json` for 3 s.
- **F5.4 Shelf reader:** E on a red book opens it alone in the parchment reader (no contents page; it doesn't
  move the lectern book's saved page).
- **F5.5 Tiers:** `fragment` / `note` / `work` from word count (a contributor may set it lower, never higher).
  Tier shows in the byline and on the spine; fragments get a loose binding and an "unfinished on purpose" note.
- **F5.6 Links:** `[[slug]]` is a tappable link that opens the linked book; a broken link is plain text with a
  "missing page" note. `links: [slug]` makes a reply book ("In reply to *Title* by *credit_as*").
- **§6.1 Creative types:** `content/artifacts/` holds characters (capsule + nameplate), songs (music box that
  plays the `chords:` line on the Music bus), food (scroll + dish) and art (framed picture on the back wall).
  Each opens its page in the reader. One placeholder of each ships.
- **§6.2 Templates and validation:** `content/templates/` has one template per type (replaces
  `content/lore/_template.md`). `npm run lore` now requires `title`, `contributor`, `credit_as`, `created` and
  `type`; every problem is one plain line naming the file, the field and the fix. Old files with neither
  `credit_as` nor `type` still build, with a warning, until 0.12.
- The lectern book lists red-book lore only; artifacts live on their own objects in the library.
- *Song of the Paved Road* moved to `content/artifacts/` as the song placeholder.
- `test/e2e-v0.06.mjs`. The creativity check itself (a non-technical friend adds a book unaided in < 10 min)
  needs a real person.

### .glb models (owner request)

- Drop `public/models/<slot>.glb` into the repo and that slot's placeholder is replaced by the model:
  `natalie`, `stagecoach`, `hero`, `player`. The build lists which files exist, so absent slots are never
  requested; broken files keep the placeholder.
- Draco (decoder in `public/draco/`) and Meshopt compression supported. Models are fetched next to
  `index.html`, not inlined, so they only cost download time when they exist.
- Textured models render unlit so hand-painted, baked lighting shows (Mega Man Legends style, see
  `docs/assumptions.md` #39); untextured ones use the world's toon ramp.
- `test/e2e-models.mjs` (+ `test/fixtures/make-box-glb.mjs`).

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
