# Changelog

Per §0 rule 3 of the Video Gametool Project spec. One entry per shipped `VERSION`.

## Unreleased — next launch (roadmap 0.03 onward + Artheria lore pass)

One merged entry until the site launches on GitHub Pages; the owner sets `VERSION` then (still 0.02).
Spec doc v0.05.

### v0.04 feedback, part 3: time of day

- **Starts at a dark sunset:** the sun sits low and orange, the sky dims and the first stars show. Bring a torch.
- **Bedroll sleep:** a bedroll by the campfire. Use it to fade out and wake at the next time of day:
  day → sunset → night → day. Night has a moon, stars and a cool, dark fill.

### v0.04 feedback, part 2: player

- **Vault and climb (Mirror's Edge):** jump at a ledge up to 1.6 m above your feet to vault it. A thin
  obstacle, like the 1 m ruin walls, is vaulted clean over; a deep one is climbed onto. In mid-air, pushing into
  a ledge within 1.2 m is caught and mantled. Rises up to 0.35 m are walked up.
- **Fallen rocks:** a climbable rock fall east of the library (about x 24, z −22) with a 3.5 m lookout on top.
- Solids can now have a standing height (`top` on a collider); the camera clears what it's above.
- **Torch:** a hand torch with a warm, flickering light, carried in the figure's hand (in view in first person).
  T, hold D-pad down (0.4 s), or the phone's 🔥 button.
- **D-pad quick swap (Skyrim style):** D-pad left swaps the left hand (empty / torch), D-pad right the right
  hand (hands / crossbow). A short line shows what each hand holds.
- **Footsteps:** each step's pitch varies by ±12%.

### v0.04 feedback, part 1: mobile, controller, camera

- **Camera, 5 distances:** the wheel (one step per notch), LB/RB, a pinch or vertical drag, the right stick and
  the phone's −/+ buttons step through first person, over the shoulder, follow, high and overhead. The camera
  eases between them.
- **Fix:** backing into a wall no longer pushes the camera into the head, which looked like first person. When
  the follow spot is blocked close up, the camera cranes up over the player instead.
- **Controller layout:** A use, B sneak/back, X reload, Y jump, LB/RB camera in/out (pages in the book),
  LT aim and RT fire (analog, past halfway), View bag, Menu pause, L3 sprint until the stick is let go,
  R3 first person, D-pad up crossbow. The pause menu's **Controls** map (and the title, in pad mode) shows
  it with the pad's own button names: Xbox, PlayStation (✕ ○ □ △, L2/R2) or Nintendo.
- **Haptics:** controller rumble and phone vibration on jump, landing, firing, reloading and jams, and on
  each touch button. Settings > Vibration turns it off.
- **Phone, landscape first:** the app asks for landscape (manifest, plus an orientation lock in fullscreen on
  Android); in portrait a translucent "turn your phone sideways" hint shows while playing. Touch buttons sit in a
  controller's face-button diamond (Jump, Sneak, Sprint, View), with camera −/+ at the top.

### Hand-drawn head and face sheets

- **Your own head art:** drop `<id>.png` (head) and `<id>-face.png` (face) into `src/art/heads/` and rebuild.
  They're inlined into the game file. Optional Aseprite JSON sets the frames, and each tag becomes an expression.
  Ids: `heroine` (default player), `hero`, `natalie`, `pedlar`. Missing files fall back to the drawn heads.
  The format is in `src/art/heads/README.md`.
- **Heads are two layers:** a head sheet (5 directions, the other 3 mirrored, or 8 as drawn) and a face sheet
  (one row per expression; front, three-quarter and profile columns). The drawn heads use the same layout.
- **Face swap, as in Mega Man Legends:** characters blink every 2–5 s and move their mouths (`talk-a`/`talk-b`)
  while talking. Changing expression only moves the face to another frame of its sheet.
- `art-templates/`: guide templates and starter sheets (the current drawn heads) to paint over in Aseprite.

### Storybook restyle S2h: 2D drawn heads, no 3D head

- **Heads are flat 2D pixel art** (`src/render/headArt.ts`), as in Tree of Savior. Each look gets one drawn
  8-frame sheet (45° apart; the three turns to the right are the left ones mirrored): skin, ears, big pixel eyes,
  brows, blush and mouth, then a crown with pointed fringe locks, side locks, long hair as a sheet of pointed
  strands from the side and back, caps, headpieces and species features (horns, ear tufts, beaks, halo, flame).
- **There is no 3D head.** The skull, hair and face meshes are gone; the head bone only carries an anchor that the
  billboard follows. The billboard just picks the frame for the side it's seen from, with no render pass per head.
- Pixel-sprite mode (Graphics > Characters) uses the same drawn heads over the sprite body.
- Graphics > Characters now reads "3D bodies, drawn heads" / "Pixel sprites".

### Storybook restyle S2g: hand-painted character textures

- **Painted atlas:** every character gets a 512 px hand-painted diffuse atlas, generated at load (`src/tex/paintedAtlas.ts`).
  There's one tile per colour, painted by material: cloth gets brush strokes and fold lines with lit edges,
  hair gets strands and a shine band, leather gets scuffs and stitching, metal gets a sheen, and skin stays
  soft. Every tile darkens toward its edges, so each face of a part reads as painted occlusion. The baked light
  rides on top in the vertex colours.
- Figures with the same colours share one atlas and material.

### Storybook restyle S2f: Tree of Savior pipeline pass

- **Unlit characters:** bodies drop the toon lighting and, as ToS does, carry all their shading baked in. Each
  part is also shaded down its own height (occlusion underneath, light on top), so bodies match the head sprites.
- **Stepped animation:** skeletal poses update at 12 fps instead of every frame, for the flipbook feel of 8-direction
  sprite cycles. Walking through the world stays smooth.
- **Billboard pass:** updates only the figures it draws, not the whole scene graph, each frame.
- **Tests:** B7, B8 and the leg-swing check now wait on frames rather than a fixed wall-clock sample.

### Storybook restyle S2d: Tree of Savior heads and the gothic heroine

- **Pixel-art heads:** as in Tree of Savior, the body stays a 3D toon-lit mesh, but the head is a pixel-art
  billboard that turns through 8 directions. It is drawn live from the 3D head (skull, hair, hats, species
  features and the pixel face), with a 1 px ink outline. The body masks it, so long hair hangs behind the
  body from the front and over it from the back.
- **New default hero:** a gothic chibi after Mike's Tree of Savior reference: long wavy platinum hair (separate
  swaying strands down the back, alternately shaded, with curled tips), red eyes,
  a flowered headband, a black bell dress with a pale frill and puffed sleeves, small black wings, and platform
  boots with strapped stockings.
- **Forge:** adds the Flowing hair style, Bell dress and Platform boots toggles, Wings and Headpiece choices, and
  black, platinum and red swatches.

### Storybook restyle S2c: hybrid characters (default)

- **Hybrid characters:** as in Tree of Savior, characters are 3D bodies with pixel-art faces. The body is built in
  layers (base body, outfit, hair and headgear) and lit with a 3-step toon ramp. Parts are rounder and softer, and
  the head is close to a ball.
- **Pixel-art face:** 24 px, nearest-filtered and stamped in layers (skin, fringe, eyes with whites, iris, pupil,
  highlight and lashes, brows, blush, mouth). It curves to follow the head and is toon-lit, so its edge never shows.
- **Graphics > Characters:** switches between "3D with pixel faces" (the default) and "Pixel sprites" (the S2b
  billboards). The choice is saved.

### Storybook restyle S2b: pixel-art sprite characters (option)

- **Sprite characters (option since S2c):** every character can be drawn as a pixel-art sprite that faces the camera, like Tree of
  Savior and Ragnarok Online. Each one is redrawn from its 3D figure in one of 8 directions (45° steps) at a sprite
  frame rate of 12 fps, with a dark 1 px outline. It leans back toward a high camera, so the overview isn't squashed.
- Walking, poses, the forge, species and contributor looks all still work, because the sprite is drawn from the
  live figure (`src/render/sprites.ts`).
- The figures under the sprites are softer: pillowy rounded parts, round limbs and a rounder head.

### Storybook restyle S2+S3: chibi characters and painted world (style slice)

- **Chibi figures:** everyone is rebuilt to the "Echoes of Avalon" boards: about 2.7 heads tall, a rounded
  head with big anime eyes (highlights, lashes, blush), and bevelled low-poly parts. The new default look has
  a newsboy cap with goggles, a navy vest and trousers over a cream shirt, a rust neckerchief, leather gloves,
  chunky cuffed boots, a satchel strap and belt pouches. The character forge adds the Cap hair style and a
  navy/rust/leather/cream/moss palette. Poses and animations are retargeted to the shorter rig.
- **Painted world:** brighter storybook colours for grass, dirt, paving, stone, bark and leaves, with smooth
  filtering instead of crisp pixels. Cut-out textures (grass blades, ferns, leaves) fill their holes with edge
  colour so smooth filtering doesn't leave dark fringes. Tree canopies and bushes are faceted low-poly balls.
- **Sky:** a clear blue storybook sky with a warm cream horizon and softer, brighter fill light.

### Storybook restyle S1: camera and controls

- **Follow camera:** a Dark Cloud 2 style follow camera above and behind you, easing after you. The mouse wheel
  zooms out to a high Ragnarok Online / Tree of Savior overview (narrower FOV). Dragging turns it. Walls still
  pull it in, it looks down over the roofless library, and it stays under the dungeon ceiling.
- **First person:** optional and off by default. Scroll in past the closest zoom and the camera glides into the
  eyes; scroll out to leave it. F and the new pause-menu Camera list (for phones) also switch it, and the choice
  is saved. Aiming the crossbow still goes first person.
- **Free cursor:** no pointer lock or crosshair in the follow view. Hovering highlights what's within reach and
  a click uses it. E uses the highlighted thing, else the eye ray, else the nearest thing in front of you, and
  it now re-checks at the moment of the press.
- The light shafts are one instanced mesh, so the wider view stays inside the draw-call budget.
- Reference boards and coding references: SimonDev's Quick_3D_RPG (MIT) for the camera easing idea.

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

### Phase F: places (B15, B7, B14)

- **Seeded dungeon (B15, `src/dungeon/`):** a trapdoor beside the Ruined Library (E: *Open the trapdoor*) leads to
  a dungeon generated from a seed. The default is today's date; any number or word works, and the same seed always
  builds the same dungeon, so you can send one to a friend. Rooms are tagged (entrance, treasure, goblin nest,
  shrines, pools, halls), with one of five themes. Painted torch light is stored in tile colours, so it costs five
  draw calls. Chests give a trinket once per seed. Shrine carvings quote library lore with its credit. *Climb back
  up* returns you to the glade, and delves are saved on this device.
- **Living map (B7, `src/map/`, M or the pause menu):** a hand-inked glade map that fills in as you walk (fog of
  war in 4 m cells) and marks what you did: clues, your lead, the friend you found, your ballad, delved seeds and
  drills done. *Pin it here* adds your own notes, and *Submit my notes…* exports them as `type: map-notes`.
- **Dojo (B14, `src/dojo/`):** training mats, a bar and a water barrel south-west of the dais (E: *Train at the
  dojo*). A safety disclaimer comes first. Your character then demonstrates each drill (horse stance, punches,
  eyes-open focus, the inverted bowl crunch, plank) with new procedural poses, while the panel gives a
  beginner-safe version to do yourself. Risky moves are marked *character only*. Holds count seconds, reps are on
  the honour system, and *Teach a drill* submits a new one only with a beginner-safe version.

### Phase E: campfire (B8, B11, B9)

- **Campfire + the bard (B8, `src/campfire/`):** a fire ring with log seats at the camp (E: *Sit by the fire*). Tell the
  adventure in three turns (how it started, what you found, how it ended). Natalie takes a turn between yours, from
  your quest so far. She is a bard, so she turns it into a ballad: your lines become verses, with her couplets and a
  refrain. Nothing about your story is invented. *Put it on the shelf* saves it, and *Submit…* exports a `type: song`.
  A new telling can **pick up where another ballad left off** (collaborative chain).
- **Bard tunes (B11):** an 8-step sequencer over a C-major pentatonic scale (any pattern sounds fine), with chords
  allowed, three instruments (lute, flute, bells) and a tempo. The ballad keeps its tune (`tune:` line plus a
  chord line for the library music box) and plays it whenever it's opened.
- **Gallery hall (B9):** an open-air hall east of the dais with eight framed, credited exhibits: your hero (portrait
  from the forge), your crossbow and its legend, your banner, your latest ballad, your theory, and three library
  works once you've read them (Natalie Bourbon, Straphan at Sunset, Song of the Paved Road). E on a frame shows the
  card, and *Open* reads it. All eight pictures share one canvas atlas.

### Phase D: quests (B2, B12)

- **Story seed: "Where did Natalie's party go?"** (`content/quest/missing-party.json`, `src/quest/`). Natalie's
  crossbow talk starts it. Seven clues are hidden around the glade, the camp and the library (a rune glint marks
  each one; E: *Look closer*). With three or more, the **casebook** (J, or the pause menu) lets you write what you
  think happened. Natalie reads your words and suggests *who / where / why* tags; you pick the tags. Optional
  constraint dice (B6). Your theory decides where the blue lead light appears (library, forest or road), which friend
  you find, and how Natalie finishes her field note. No theory is wrong. Natalie also says whether the clues back it up.
  *Submit my theory…* exports it as a `type: theory` reply to *Natalie's Field Note*.
- **Companion (B2):** talk to Natalie again after the crossbow and she adds *What do you think?*, *Come with me /
  Wait here* and *casebook* to her usual choices. Following, she walks a step behind you (through the library door
  too), turns to face you, and thinks out loud about places and clues. *Quiet companion* in the pause menu mutes her
  ambient lines.
- **Item folklore + the Curio Pedlar (B12, `src/quest/folklore.ts`):** an Owlkin trader by the coach road
  (placeholder NPC). Legendary things you've seen (the Noctavel shard, the scout's crossbow) carry fixed canon,
  credited, with curated player rumors under it. *I want to tell you about something I found* opens the folklore
  panel: name any item or clue you hold, give it a history and a rumor, and *Submit…* it.
- Budget: the library's red books draw as one mesh (13 → 1 draw calls); clicking a book works as before.

### Phase C: writing on the world (B13, B3, B10)

- **Sketchbook + camp banner (B10, `src/writing/sketch.ts`):** a 32×32 pixel painter with a 15-colour Legends/Vintage
  Story palette, pen, fill, eraser, mirror, undo and a shelf of up to 12 saved sketches. *Hang on the banner* stamps the
  sketch onto a cloth banner at the camp, which sways in the wind. Open it at the banner pole (E) or from the pause menu.
  Sketches double as wax seals on margin notes. *Submit…* exports the sketch as a lore file (`pixels:` front matter).
- **Margin notes (B3, `src/writing/margins.ts`):** the ✎ on any open book (the lectern book or a shelf book) pins a
  handwritten note to that page. Notes show as tilted paper slips in the ink they were written in, with an optional
  wax seal. Tap to unfold, × to remove. The lectern's 3D pages get ink scribbles and seals, and every shelf book you
  wrote in gets a ribbon bookmark in your ink. *Submit my notes on this story…* exports a `type: margin` file with
  `reply_to` the entry.
- **Ink and paper (B13):** six inks (iron gall, sepia, cinnabar, verdigris, indigo, rune glow) and four papers (fresh,
  aged, vellum, charred) restyle every book and the lectern pages.
- Text boxes now keep Space and the arrow keys (they were swallowed by the game). The camp is batched (10 → 4 draw
  calls) so the scene stays under the F5.1 budget. The pause menu has *Character* (the original form) and
  *Character forge* as separate buttons again.

### Phase B: forges and dice (B4, B5, B6)

- **Travellers' camp** by the stagecoach: a standing **mirror** (character forge) and an **anvil** (weapon forge).
  Both are also in the pause menu.
- **Character forge** (`src/forge/character.ts`): 11 lore species (Human, Elf, Infernling, Drakari, Owlkin, Emberkin,
  Stonekin, Cinderkin, Titankin, Corvani, Lumari). Species add horns, tails, snouts, beaks, wing feathers, ear tufts,
  pointed ears, a halo, a flame crest or rock plates. You also pick height, build, skin, eye style and colour,
  freckles or paint, six hair styles, outfit colours and coat tails, plus a name and backstory. The camera frames your
  real in-game character, which updates live (drag to turn it). Your look replaces the default body everywhere.
- **Weapon forge** (`src/forge/weapon.ts`), cosmetic only: stock style, limb style, five materials, a tint, metal
  and string colours, an engraving drawn on the stock, a name and a legend. It previews over the anvil, and your held
  crossbow uses it.
- **Constraint dice** (`src/forge/dice.ts`, `content/rolltables/constraint-dice.json`): roll a word, a mood and a rule
  to work into a backstory or legend. Lore names and species are faces too. You get two rerolls.
- **Curated submissions** (`src/submit.ts`, Mike's decision 2026-10-26): everything is saved on the device. *Submit*
  offers a pre-filled GitHub issue for review, a .md download, or a copy. Nothing goes public until Mike merges it.
  A submitted character keeps its `look:` line, and the library draws it with that look.
- `test/e2e-forge.mjs` (18 checks).

### Phase A: animation and polish (B1, R5)

- **Every character animates** (`src/anim/procedural.ts`). The built-in figures are now one skinned mesh on a
  12-bone rig (still one draw call). They get walk and run cycles with knee bend, arm swing, hip bob and lean,
  idle breathing and weight shift, talk gestures with nods, a two-handed aim pose, a jump tuck and a landing squash.
  All of these blend smoothly.
- **NPCs look at you:** Natalie, the hero and the library figures turn their heads toward a player within 6 m.
- **Your body turns to where you move** in third person, instead of strafing sideways. With the crossbow in hand,
  or in first person, it faces the view.
- **`.glb` models:** clips win when present (R4). A model without clips now bobs, leans and breathes as a whole,
  instead of standing frozen.
- **Footstep dust** on running steps, and a ring of it on landing (one draw call).
- **Look:** a soft vignette on every preset, and a light colour grade on High (cool shadows, warm highlights).

### Rebuild R4: gameplay port

- **Crossbow** viewmodel and bolts use the world's pixel textures and sunlight instead of the legacy toon
  shading. Every bolt shares one mesh and material.
- **Imported `.glb` models:** untextured parts are lit by the world's sun and sky (the legacy toon ramp is gone).
  Textured parts stay unlit with their painted light, and their textures stay crisp pixels.
- **Fix:** with your back to a wall, the follow camera used to sit inside the player's head. The body now
  hides until the camera has room again.
- **Fix:** the held crossbow no longer floats in the dialogue and reading shots.
- **Animation clips in `.glb` models:** `idle`, `walk`, `run`, `talk` and `aim` play by state with 0.2 s crossfades.
  Missing clips fall back (run → walk → idle); a model without clips stands still as before. Clip names are in the README.
- `test/e2e-rebuild.mjs` covers both fixes; `test/e2e-models.mjs` covers the clips.

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
