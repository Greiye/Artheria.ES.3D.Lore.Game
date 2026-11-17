# Rebuild from scratch: studio proposal

Status: **proposal only (2026-11-17).** No code changes. Nothing here is approved until Mike says so.
Builds on: `docs/vision.md`, `docs/rebuild-plan.md`, the backlog, the lore mapping, and the rebuild-kit
(`open-decisions.md`, `lessons-v1.md`, `backlog-specs.md`, `decisions.md`). Where this doc and an owner
decision disagree, the decision wins.

---

## 1. The brief, as a studio reads it

**What it is:** a private, long-lived piece of software where a group of friends keep, read and add to the
lore of Artheria. The game is the frame that makes that lore worth visiting again.

**What it is not:** a public or commercial game, a feature showcase, or a pile of side games.

**Pitch:** *Natalie needs the lore that exists only in the Ruined Library. The hag witch keeps the shelves in
flux. Go down, bring the books out, read them by the fire, and leave your own mark in them.*

### Design pillars (every feature must serve at least one)
1. **Lore first.** Books, places and people come from the lore files. The game never invents canon.
2. **Return for years.** Saves and friends' works survive every update. Nothing a friend made is ever lost.
3. **One verb at a time.** Each place teaches one thing: read, fight, write, trade.
4. **Small and deep over big and shallow.** Fewer systems, each finished.

### Why rebuild (from v1)
v1 proved the ideas but grew by accretion: `main.ts` reached ~4,500 lines, timers ran on frame time,
three projectile copies existed before a shared one, tests waited on the clock, and around 40 features
compete with the core loop. The ideas are good; the shape is not. See `lessons-v1.md`.

---

## 2. Core concepts kept, and why

| Concept | Why it stays | Rebuild role |
|---|---|---|
| **The Ruined Library + lorebooks** | It is the premise. Books exist only there. | The hub and the reason to play. |
| **Natalie, the warner** | The player's anchor and quest giver; replaces the Keeper (2026-10-21). | Opens the game, receives the books, frames each return. |
| **The hag witch and the flux** | Explains why floors change between runs and why the books need rescuing. | The antagonist and the descent's rule-setter. |
| **The descent (roguelike under the Library)** | The action half of the loop; books count only once carried out. | Seeded floors, permadeath per run, timer per floor. |
| **Party classes on a counter wheel** | Gives runs identity and friends a reason to play together. | Fighter, Ranger, Mage (= Wizard = Archivist), Monk at launch; Engineer later. Fighter > Ranger > Mage > Fighter. |
| **The dojo (Kavik)** | Where combat is learned safely; home of the monk deck. | Training ground and class trainer. |
| **The town (Aralon)** | Makes the world feel lived in; shops, people, rest. | Small, dense, one street at first. |
| **Campfire** | The social, reflective end of each run. | Where books are read aloud, ballads made, and the day closes. |
| **Writing and creative systems** | The "creativity" in the project's purpose. | Merged into one *Works* system (section 3). |
| **Player text stays local; Submit exports** | Privacy and hand-curation (2026-10-26). | Unchanged. |
| **Credit and content pass before shelving** | Public site, real friends' names. | A required field and a gate in the content pipeline. |

---

## 3. Cut, merge or park

### Merge
| v1 pieces | Becomes | Why |
|---|---|---|
| Lectern writing, margins, sketchbook, ballads, the three forges (character, weapon, dice), recipes, folklore, gallery, portfolio export | **Works**: one system with work *types* (note, margin, sketch, ballad, character, item, recipe). Same storage, same viewer, same export, same Submit. | Ten UIs and ten save formats today. One system makes "review your creative works over years" a single place. |
| Sling, crossbow, missile, thrown items | **One projectile system** with weapon data. | v1 had copies of flight code. |
| Casebook, quest groups (meet every NPC, use every station), first-day quest, tutorial run | **One quest system** driven by data. | Same mechanics, four implementations. |
| Fight mode, monk deck, dungeon combat | **One combat model**; the deck is the monk's class kit, the dojo is where it is edited. | Avoids two combat rule sets. |
| Profiles, store, save, migrate, bootMigrate, backups | **One save layer** (section 4.4). | Longevity depends on it being boring and single. |

### Park (keep specs, build later, only on Mike's go)
Skyrunner plane, knight frame / mech, wagon travel, coin-flip wager, portal room, cinema, pets,
cooking, gear care (sharpen/oil/restring), pushups, comics, multiplayer, DM-as-player (B69), morphology
editor beyond presets, supply chains (B59), vehicles, tent design.
Each one has a spec in `backlog-specs.md` or the backlog, so nothing is lost. The order they come back
is Mike's choice; the recommendation is "whatever a friend asks for first".

### Cut
- Webdriver checks in game code, URL feature flags as product features (`?mech`, `?realistic`), and the
  bottom-right label beyond version + "Mike Go".
- Any NPC with a lore-sounding name that is not in the lore (role names only, 2026-10-28).

---

## 4. Architecture

### 4.1 Engine and stack
- **Stay on the web stack:** TypeScript, Vite, three.js, GitHub Pages serving `dist/`. Reasons: the QR
  code and phones must keep working, the team (Mike plus LLMs) already knows it, and no install step.
- **Renderer:** three.js WebGPU renderer with its WebGL2 fallback (open decision 2). Heavy effects only on
  WebGPU; the low preset never needs them.
- **Physics:** a small custom kinematic controller for the player, plus Rapier loaded lazily for props
  (physics-ideas 2026-11-09).
- **UI:** DOM overlays with one small component library and one navigation model, so every panel works with
  mouse, touch and gamepad from day one (B40 lesson).
- Considered and rejected: Godot or Unity web exports (large downloads, weak on iPhone, harder for LLM
  edits); a custom engine (no time benefit).

### 4.2 Code shape
- **Simulation and view are separate.** Game state advances on a fixed 60 Hz tick; rendering interpolates.
  Same result at 10 fps and 60 fps.
- **One seeded random source** for gameplay. Runs are reproducible from a seed.
- **Features register themselves** (library, descent, dojo, town, campfire, works, quests). The entry file
  only boots the registry and stays small. Features talk through events, not imports of each other.
- **Shared systems first, each with unit tests:** clock, RNG, input, saves, content loader, i18n,
  projectiles, colliders, LOD, audio.
- **One test hook**, shaped by design, exposing state for tests. One explicit test mode flag; no hidden
  differences between test and player builds.

### 4.3 Content is data
Everything a writer or designer touches lives in `content/`, validated at build time by schemas.
A build fails on a broken reference, never at runtime.

| Content type | Format | Holds |
|---|---|---|
| **Lorebooks** | Markdown with a header block | id, title, author, `credit_as`, content-pass status, visibility (public / private), shelf location, linked people/places/items |
| **People** (Natalie, Kavik, Candor, townsfolk) | Data files | look preset, home, schedule, dialogue ids, lore links, voice language |
| **Places** | Data files | area, what's here, which books and stations it holds |
| **Dialogue and quests** | Data files with simple conditions | steps, triggers, rewards; no logic in code per quest |
| **Classes, moves, decks, weapons, enemies** | Data tables | stats, counter wheel, move frames, loot |
| **Descent floors** | Room pieces + rules | seeded layout rules, hag flux rules, floor timer |
| **UI strings** | Per-language tables | UI only (lore and dialogue stay English, 2026-11-08) |

**Lore as a graph.** Books, people, places and items reference each other by id. The game can then answer
"who wrote this", "where is this place", "which books mention Natalie" for the map, the reader and the
wiki, all from the same source. The public wiki and the game read the same files.

**Privacy gate.** DM-private lore never enters the build. A book without `credit_as` or a passed content
check cannot be shelved; the build reports it instead.

### 4.4 Saves and versioning
- One versioned save per profile in IndexedDB, with a migration per version and a fixture per version in
  tests. Old saves must always load (2026-11-05).
- **Works are stored apart from game progress.** Progress can be reset or migrated freely; Works are
  append-only and exported in full on request.
- Full backup export and import as one file. The v1 full-backup / portfolio file imports into Works
  (open decision 6), so friends keep what they made.
- Writes are awaited before any reload; nothing depends on timing.

### 4.5 Localization
- UI strings by key in per-language tables (English, Spanish, Japanese, Tagalog first). Missing keys fail
  the build in test, fall back to English in play.
- Lore, books and dialogue stay English; speaker NPCs keep their own language. Language is per device.

### 4.6 Assets and performance
- CC0 models and materials in a separate public assets repo with its own Pages site (open decision 3).
- glTF with compressed textures; one LOD path for every humanoid; static meshes merged per area chunk;
  repeats instanced; creatures at three draw calls or fewer (`lessons-v1.md` section 1).
- A CI test measures draw calls and triangles at fixed camera spots per preset and fails over budget.

### 4.7 Tests
- Most checks run on the simulation by stepping ticks, with no browser and no clock.
- One browser pass per feature for UI, served over local http, each starting from a save fixture.
- Every wait fails at the wait, naming what it waited for.
- Done = one PR, full suite green, merged by Mike.

---

## 5. Build order

Each phase is one PR (or a short series), stops for Mike's merge, and has a plain exit check.

| Phase | Builds | Exit check |
|---|---|---|
| **0. Foundations** | Clock, RNG, save layer + migrations, content loader + schemas, input (all four devices), i18n, test harness, perf-budget test, deploy | A scripted run gives the same result at 10 and 60 fps; a v1 backup imports into Works; Pages deploys. |
| **1. First playable slice** (below) | Library, Natalie, reader, Works (notes only), campfire close | A new player finishes the slice on phone and PC. |
| **2. The descent** | Floors 1 to 5, hag flux, timer, permadeath, the four classes, one projectile system, four enemy types | A run reaches a floor boss, dies, and restarts with a new seed. Then extend to 30 floors. |
| **3. The dojo** | Kavik, the counter wheel tuned, monk deck and editor, learning by blocking | The deck saves, loads and wins a sparring round. |
| **4. The town** | One street of Aralon, shops, townsfolk with schedules, quest casebook | Every station is reachable and saves its state. |
| **5. Works, complete** | Sketches, ballads, character/item/dice forging, gallery, Submit, full portfolio view | A friend can review everything they ever made from one screen. |
| **6. Look pass** | Art target picked from two test scenes; lighting, sky, vegetation, characters (realistic proportions) | Mike signs off on real-GPU screenshots. Can start in parallel from phase 1. |
| **7. Release to friends** | Credits, content pass, locales, "what's new" | Mike shares the QR. |
| **Later** | Parked list in section 3, in the order friends ask for it | Per item. |

### First playable slice: "One evening at the Library"
About 15 minutes. Proves the whole loop once, small.
1. Title, then a short character creation: name, look preset, class (four).
2. Dusk at Natalie's coach camp by the ruin. She warns the player (first-meeting scene).
3. Into the Library's ground floor. One flux event shows the shelves shifting.
4. Find three books: one of Mike's (credited, content-passed), two short ones. Read them in the reader.
5. Carry them out to Natalie. She files them; the patron is mentioned, unnamed.
6. Campfire. The player writes a margin note on one book. It appears in Works and can be exported.
7. Save, close, reopen: the note and the books are still there.

Out of the slice on purpose: the descent, combat, the town, multiplayer.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| **Scope creep again** (v1's main problem) | Pillars gate every feature; parked list needs Mike's go; one PR per phase. |
| **Losing friends' works** in the move | Works stored apart from progress; v1 backup import in phase 0; fixtures per save version. |
| **Phones too slow** | Low preset defined first; perf test in CI from phase 0; Mike names the oldest target phone. |
| **Art eats the schedule** | CC0 assets only; look pass is its own phase with a sign-off, not spread across features. |
| **Private lore leaks to the public site** | Privacy gate at build time; DM notes never in the content folder. |
| **The rebuild loses v1 behaviour friends liked** | v1 e2e suites kept as behaviour specs; v1 tagged `v1-final` and buildable. |
| **Two codebases at once** | v1 frozen except fixes once phase 0 starts; Pages switches when phase 1 passes. |

---

## 7. Open questions for Mike

Recommendations are in bold. Reply "R" to take them all. The full list from earlier rounds is in
`rebuild-kit/docs/open-decisions.md`; these are the ones this proposal adds or depends on most.

1. **Same repo or new?** **Same repo, tag v1 as `v1-final` first** (keeps the Pages URL and printed QR codes).
2. **Is the first slice right?** Library + Natalie + reading + one written note, no combat. **Yes.**
3. **Classes at launch:** four (Fighter, Ranger, Mage, Monk) with Engineer later, or all five? **Four.**
4. **Works merge:** fold all ten creative tools into one Works system? **Yes.**
5. **Parked list:** agree that plane, mech, wagon, coin flip, portal, cinema, pets, cooking and gear care wait? **Yes, return on request.**
6. **v1 data:** import friends' works, drop game progress? **Yes.**
7. **Art target:** pick from two test scenes on real assets (painterly vs grounded)? **Yes, during phase 1.**
8. **The hag's name and her library** (lore open since 2026-11-05). **Placeholder "the hag witch"; her library is the Library of the Wise.**
9. **Who builds it:** this project's threads, or another LLM with the rebuild-kit? **Either; this doc and the kit are written to hand over.**
