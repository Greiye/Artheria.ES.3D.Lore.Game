# Changelog

Per §0 rule 3 of the Video Gametool Project spec. One entry per shipped `VERSION`.

## Unreleased — next launch (roadmap 0.03 onward + Artheria lore pass)

One merged entry for the roadmap work. The corner label shows the current build version (`VERSION` 0.08,
Mike 2026-10-28; batch B 2026-10-31; batch C 2026-11-01). Spec doc v0.06.

### v0.08 changelog, part 1: the sword (Mike 2026-11-01)
- A practice sword stands on the block outside the smithy. "Take the practice sword" puts it in your bag and your right hand; the stand stays empty after.
- Draw it with 3, or cycle the right hand with Q / D-pad right (hands, sword, crossbow), or tap the weapon button on touch. 2 puts it away.
- Swing with a click, RT, or the touch Swing button. A cut hits every goblin in a short arc in front of you. It does 2 damage, flashes the goblin red, knocks it back, and staggers it so it can't hit back at once. Keep swinging for a three-cut combo (forehand, backhand, then a heavy overhead cut for 3). The heavy cut goes through a pot lid; a light cut can be turned.
- In the follow views a cut turns you toward the nearest goblin within reach. In first person the sword sits at the right of the screen and sweeps across it.
- Each cut has a swish, each hit has a thud, rumble on a controller, and a short pause.

### v0.07 changelog, part 5: the wiki in the game (B21, Mike 2026-10-31)
- The game's [GitHub wiki](https://github.com/Greiye/Artheria.ES.3D.Lore.Game/wiki) is now inside the game. Each build pulls the wiki pages into `content/wiki/` and bakes them into the page, so they read offline and the game never calls GitHub while you play. With no network, the build keeps the last pulled copy.
- Read it at the reading room lectern, just inside the Ruined Library, or from Extras → Wiki on the main menu. Links between wiki pages stay in the game; web links open in a new tab.
- Editing a wiki page now republishes the game: the deploy workflow also runs on wiki edits.
- Only public lore goes on the wiki. A page marked `<!-- private -->`, or named starting with "DM" or "_", is never pulled.

### v0.07 changelog, part 4: real skills (B19, Mike 2026-10-31)
- A practice table stands beside the dojo mats, with rope, a first-aid tin and kindling. Using it teaches three real skills by doing: knots (square knot, bowline), first aid (a small cut, a small burn) and fire craft (lay and light a fire; put it out: drown, stir, feel).
- Each skill has two short rounds. In some you tap the steps in the right order; a step out of order gets a hint. In others you tap everything that helps; a wrong pick says why (for example, no ice on a burn).
- Finishing a skill earns its card, and a few crowns the first time. Journal → Skills book keeps the cards. "I've done this for real" stamps a card on the honour system.
- As at the dojo, a safety note comes first: these are beginner basics, not training or medical advice, and in an emergency you call for help first. Each skill has its own safety line, such as only lighting fires with an adult and where fires are allowed.

### v0.07 changelog, part 3: the Spanish caravan (B16, Mike 2026-10-31)
- A caravan camps beside the coach road, west of the glade: a wagon, a mule, a cooking fire and a frame of shawls. Its three people (la cocinera, la tejedora, el arriero) speak only Spanish and are never translated.
- Talking to one opens a short conversation. Each line comes with a picture cue, a gesture to read, and "🔊 Otra vez" to hear it again (a Spanish voice, where the browser has one). Answer by picking a Spanish reply or by writing one (accents, capitals and ¡! don't matter). A reply that makes no sense gets "¿Cómo?" or "No te entiendo." and is struck out.
- Getting through a conversation pays a few crowns, once. The cook asks your name and uses your hero's name (B25).
- Journal → Phrasebook lists every line you got through, in Spanish, with a box for what you think it means. The game never fills it in. The living map marks the caravan.

### v0.07 changelog, part 2: profiles (B24, Mike 2026-10-31)
- Three profiles on one device. Each keeps its own hero, save, bag, writing, map, casebook and progress. Settings, key bindings and the GitHub token are shared and never part of a profile.
- The main menu shows which profile is loaded ("Profile: Rill"). Tap it to see all three: play another, start an empty one, export, import, or clear (clear needs a second tap).
- Export saves one profile as a JSON file. Import loads a file into any slot, to keep a copy or move a game to another device. Nothing is stored online.

### v0.07 changelog, part 1: who you are (B25, Mike 2026-10-31)
- Character creation is back, as an optional step. Begin still goes straight into play and never asks who you are.
- The Journal (pause menu) has a "Who you are" page, also under Gameplay → Your hero. It holds your name, what you want most, and one secret about the world. Close leaves it blank; nothing needs filling in.
- On a phone the form never opens the keyboard by itself.
- Your name heads the casebook ("Casebook of …"), names your hero in the credits, and stays the same as the name at the tailor's mirror. Change it in either place.
- `VERSION` is 0.07.

### Torn clothes (Mike 2026-10-31)
- In the dungeon your clothes show how hurt you are. As health drops they darken with grime, and rips open one at a time from 75% down (chest, thigh, back, sleeve, other thigh, side) as health drops. Back above ground they're mended. The hero's figure gets its own material, so other figures stay clean. Code in `src/wear.ts`; the check is in `test/e2e-ux-world.mjs`.

### UX pass 3: flow (Mike 2026-10-31)
- **Continue on the main menu:** with a save, the top item reads Continue (still the biggest), with New game under it. New game asks for a second tap, then starts over at the coach with an empty bag.
- **Auto-save:** every door you go through, sitting at the campfire and waking from sleep all save. A quill mark ("✒ Saved") shows for a moment in the corner.
- **The pause menu is your journal:** a stitched leather cover titled Journal. Its last pages are the Casebook, the Map and the Bag, one tap each from it.
- **Teach by doing:** in the first minute, one short line at a time tells you how to walk, then look, then (once something is in reach) use. It's worded for keys, thumbs or a pad, and each line goes as soon as you've done it, once per device. (Begin already goes straight into play, #30.)
- New `test/e2e-ux-flow.mjs`.

### UX pass 2: the world shows it, not the HUD (Mike 2026-10-31)
- **The map is paper in your hands:** a tilted sheet held at its lower corners, with the world still in view behind it.
- **Status on the body:**
  - Crowns hang at your hip as a leather purse. It fills out as they come in, bobs and jingles when coins drop in, and clinks as you walk.
  - In the dungeon, the health counter is gone from the screen. Hurt reddens the edges of your sight and flares when you're hit; below half health you breathe hard, and below 40% you limp. The old line is still read out to screen readers.
- **Directions from the town:** a fingerpost where the lane meets the green has one arm per building, smoke rises from every chimney, and windows stay lit at night. There are no floating markers.
- **Natalie speaks the tutorial hints** when she's with you, in her own words, naming the key or button for how you play: J or the Journal button, I or the Bag button, the torch. Without her near, they're the usual toast.
- **No clock:** the sky shows the hour, and the library spire's bell tolls when it changes (three in the morning, two at sunset, one at nightfall), placed in the world like the other sounds.
- New `test/e2e-ux-world.mjs`.

### UX pass 1: comfort and thumbs (Mike 2026-10-31)
- **Thumb zones:** Map, Journal, Bag and Menu sit in one row in the top-right corner, one tap each. Camera −/+ and the torch move to the opposite top corner. Every touch button is at least 44 px.
- **One context button:** next to the face buttons, it says what it will do (Talk to Natalie, Enter the Library, Read, Pick up bolt…) and shows only when there's something to do.
- **Floating joystick:** a faint "Move" ring shows where it appears. It still spawns wherever the thumb lands.
- **Pause → Gameplay → Comfort:** Left-handed (the joystick moves right, the buttons move left), Touch button size (75–150%), Text size (85–150%, for dialogue, books and Natalie's tellings) and Reading speed (0.5–2×, for dialogue typing and the telling).
- **Haptics:** a buzz on pickups (crowns, bolts, loot), on hits and when you're hurt. This works on Android and controllers; iPhone Safari has no vibration API.
- **Two taps deep:** Map, Journal and Bag take one tap, and every options group takes two. New `test/e2e-ux.mjs`.

### iPhone pass (Mike 2026-10-31)
- Text boxes are 16px on phones, so iPhone Safari no longer zooms the page in when you tap one.
- The "Turn your phone sideways" card tells iPhone players how to switch off Rotation Lock (iPhones can't be turned by the page).
- Safari won't let a page hide its address bar. On iPhone and iPad, a small tip on the title screen explains Share → Add to Home Screen, which opens the game fullscreen. ✕ hides it for good.
- The canvas follows the visible part of the screen as Safari's bars grow and shrink, and book pages size by the visible height (`dvh`).
- New `test/e2e-iphone.mjs` (iPhone 13 size) with screenshots.

### Character creation rolled back (Mike 2026-10-31)
- New players no longer get the "who are you" form (name, motivation, secret) on their first Begin. On iPhone it brought up the keyboard before play. Begin always goes straight into the game, and Pause → Character is hidden. The form stays in the code for backlog B25, when it returns as its own optional step.

### Phone start and Begin (after v0.06, Mike 2026-10-30)
- A phone held upright gets a "Turn your phone sideways" card from the very first screen. It goes away by itself once the phone is sideways. "Play upright anyway" hides it for the session, and on Android "Turn it for me" goes fullscreen and locks landscape. It replaces the small in-game hint.
- Begin goes straight into the game. The What's new window no longer opens on Begin; it's under Extras → What's new.
- Begin is the biggest option on the start menu.

### Models from the references (after v0.06)
- Three cleared models now ship in `public/models/` (credits are in Extras → Inspirations → Asset credits and in `public/models/CREDITS.md`):
  - Quaternius's **Witch** (CC0) stands by the windmill, idling. She is a placeholder NPC, role name only, simplified from 6.9k to 4.5k triangles.
  - Quaternius's **Sword** (CC0) stands on a stone block in front of the smithy.
  - 99.Miles's **Low Poly Forest Tree Pack** (CC BY 4.0) puts about 70 trees and 20 rocks on the hills past the meadow. It costs 6 draw calls, lit like the world's own trees, with textures cut to 512 px.
- Models with animation clips are now sized in their idle pose, and skinned models are measured through their bones (the Quaternius rigs were coming in a few centimetres tall).
- The README is rewritten for the current game.

### References put into the game (after v0.06)
From the references review (`docs/references-review-2026-10-29.md`, Mike 2026-10-29). Nothing from `references/` ships; only the ideas.
- Faces are two strips, eyes over mouth, swapped on their own (the DokiBird method). Six expressions: neutral, happy, angry, surprised, sad and wink. Blinking and talking play on top of any of them. Drawn sheets can now be an eye sheet plus a mouth sheet (`src/art/heads/README.md`; templates and starters in `art-templates/`); whole-face sheets still work.
- Goblins paint from one shared 256² swatch atlas (the Mona method): a roll only picks rows from it, so a nest of six costs one texture.
- The town has a Willowbrook layout:
  - a fountain in the middle of the plaza (it replaces the well);
  - a river down the west side, crossed by a stone bridge on the coach road and a plank footbridge to a windmill whose sails turn;
  - a bell tower with a slate spire on the library;
  - seven colours for roofs, walls, awnings and bunting (brown, tan, brick red, grey, slate blue, moss green, cream).
  You hear water at the fountain and at both bridges.
- Mobile budget:
  - every character is at most 5k triangles (the fullest heroine went from 5.7k to 3.5k: thin parts are plain boxes and hair tips are lighter);
  - every texture is at most 512²: faces are packed in a grid, signs sit two to a row, and the gallery wall stores its pictures at half size (the exhibit card still shows full text).
- Auto quality (Graphics settings, on by default), after the idea in Edelweiss's Optimizer.js. When frames run long it eases off one step at a time: render scale first, then shadows and undergrowth, then fewer townsfolk. It steps back up after 8 easy seconds. Your settings are never changed.

### Trait roll tables: rolled goblins and crowds (after v0.06)
- Goblins are rolled from trait tables (`src/data/traits/goblin.json`, spec `docs/trait-roll-tables.md`, approved by Mike 2026-10-29). Each goblin rolls a size, a skin, headgear, a behaviour, a weapon that fits it, and two accessories. Rarity, requirements, exclusions, "roll on another table" and a threat budget of 6 keep the stacking sensible. The dice are never shown; you only see the goblin.
- New goblins every run. Every goblin has a name, and Rare ones also get a title from their traits ("Moll Pot-Head", "Soot the Plague-Crowned"). Name tags are coloured by rarity, with a health bar.
- Goblins are real-time foes in the dungeon under the library: up to 6 per delve, one per room and two in the nest (its boss rolls with a bigger budget). Each behaviour has its own AI:
  - Rushers charge.
  - Skirmishers hit and back off.
  - Cowards flee at half health and call the others.
  - Thieves snatch two bolts and run.
  - Ambushers wait crouched until you're within 4 m.
  - Archers keep their distance and shoot.
  - Trappers lay snares that bite and slow you.
  - Pack leaders shriek (+1 damage to goblins near them while they live).
  - Mimics strafe while you aim.
- Weapons: ladles, swords and greatclubs hit up close, spears from further away. Slings and shortbows shoot from range, and bomb pots land at your feet and go off. Diseased goblins slow you with each hit. Pot-lid shields can turn a bolt.
- Crossbow bolts hurt goblins. A fallen goblin drops crowns, plus any bolts it caught or stole (more if it had a bandolier or a sack). The dungeon HUD shows your health (♥ 10). At 0, Natalie hauls you back up the stairs.
- The Quick Dungeon's fights and nest meet rolled goblins too. The text describes each one ("Mire, a small, loud goblin in a rag hood, swinging a rusty shortsword"), and its tactic changes the fight.
- The townsfolk crowd is rolled from `src/data/traits/townsfolk.json` (height, build, skin, hair, hairstyle, clothes, pace and a habit: some read at every door). Natalie, the Pedlar and the other key NPCs stay hand-made.
- Figures gained sockets (head_top, face, neck, chest, back, hips, hands) and an `extras` hook for props, which are merged into the body (no extra draw calls). There is a goblin species: long ears, a hooked nose and a bigger head.
- Debug only: `?seed=N` forces the first goblin, and `?bestiary` lines up 12 rolled goblins on the green.

### Sculpted hair (after v0.06)
- Hair is sculpted instead of stacked boxes: a rounded cap that hugs the skull, with the hairline high at the front and low at the nape, plus tapered locks for fringes, spikes and long hair. Every style was redone (short, spiky, long, flowing, topknot, cap, hood); the cap and hood are rounded too. Figures cost about the same to draw.
- The old 2D head sheets (`hero.png`, `natalie.png`) are deleted (Mike 2026-10-29). Drawn faces stay.

### Realistic characters (after v0.06)
- Every character now has realistic proportions (about 7.5 heads tall) instead of the chibi look: tapered low-poly limbs, a V-shaped torso, soft-cornered clothes and kit. Every outfit option, hairstyle and species feature was reworked for the new body.
- Heads are low-poly 3D (skull, jaw, nose, ears) with 3D hair. The face is drawn and laid over the front of the head. Blinking and talking swap the drawn face like Mega Man Legends' face textures, and Mike's drawn faces (the heroine, Natalie, the hero) are used where they exist. The flat 2D head billboards are gone, along with v0.06's wider-front-head tweak.
- The overhead follow camera starts closer (about 5.5 m back instead of about 12 m), so faces read.
- Kavik (Mike's character) stands by the dojo door watching the pupils spar, with his own outfit: purple skin, horns, wrap top, obi with a back bow, bracers, hakama and leg wraps.
- Station poses (sitting by the fire, kneeling on the bedroll, the dojo stance, hanging from the bar) are adjusted for the longer legs.
- Face sheets only need the front cell of each expression now; see `src/art/heads/README.md`. The old 2D head sheets are no longer used or shipped, so the page is about 28 KB smaller.

### v0.06 changelog, part 4: shop, cinema, art
- Unlimited crowns for now: the purse shows ◎ ∞ in the store and the inventory, and buying costs nothing. Finds and writing still pay underneath, so prices come back by switching off one flag (`DEBUG_UNLIMITED_CROWNS` in `src/economy.ts`).
- The General Store has eight everyday sundries (candle, wax, lamp oil, soap, twine, chalk, salt, bread), shown faded below the main stock. They can be bought but do nothing yet.
- The cinema ships a short in-house sample reel (a looping title card), so it is never empty on a fresh deploy.
- Reels are WebM only and always loop. GIF and MP4 support is gone; the cinema README says so.
- The Ruined Library and the gallery hall have timber ceilings: looking up from inside, in any camera, shows planks and beams, never sky. They only face down, so the overview still looks into both halls and their outsides are unchanged. The follow camera stays under them while you're inside.
- Heads seen from the front are drawn wider, so the whole face reads (a little wider at three-quarter; profile and back unchanged).
- The Ragnarok-style head redraw (H2) is dropped: Mike chose realistic proportions with 3D heads next, and the RO reference will shape their face textures instead.

### v0.06 changelog, part 3: living town and sound
- Townsfolk (placeholders, role names only): four walkers go door to door round the green, two pupils spar and one drills outside the dojo, two customers haggle at the General Store's counter, and two pairs chat on the green, taking turns to talk. They walk round the well, the lamp posts and the houses, and never get in your way. Low has fewer of them.
- A small band (fiddler, drummer, piper) stands by the Projectionist's screen and plays along whenever a reel with its sound on is playing.
- Every sound in the world now has a place: it gets fainter as you walk away, goes silent out of range, and pans left or right with where it is. That covers the campfire band and your own notes there, the cinema reels (from the screen), the townsfolk's voices and the new ambience. Menu sounds stay as they were.
- Ambience you hear only near its source: birdsong in the trees, water at the well, the hammer at the smithy, chatter by the General Store.
- Night: every lantern and lamp post glows with a soft halo, there's a new lantern by every door in town, the windows burn brighter, and up to four warm lights (two on Low) follow you from lantern to lantern. The moonlight is cooler, the shadows darker, and the night fog closes in.
- The frame rate is uncapped again on Medium and High (Low keeps 30). Movement runs on a fixed step, so speed is the same at any frame rate. Saves on Medium's old 60 cap move to uncapped once.

### v0.06 changelog, part 2: stations, campfire, centre, mobile
- The rune dais at the centre is gone: the blue stones, the pillars, the lectern and its book, and the dirt patch around them. The red book is read at the library door. The scratched-tally clue moved to a buttress of the library.
- Stations put you in a pose: sitting on the log at the fire, standing at the anvil, standing at the mirror, writing at the desk, kneeling at the bedroll.
- While a station is open the camera frames the whole station and you beside the panel (above it on a phone), then slowly sways a few degrees each way (about 10 s). Reduced motion turns the sway off.
- The tailor's mirror stands in the doorway facing the street, so the building no longer hides you in the character editor.
- The weapon on the anvil stays still. Turn it with a right-mouse drag, a one-finger drag or the right stick; it stays where you leave it.
- The camp banner is now a writing desk with a sheet of paper, an inkpot and a quill. Your sketch lies on the paper.
- The campfire menu is a list of large buttons with icons, each opening its options: **Sleep, Play along, Hear a tale, Tell a tale, Leave**. One opens at a time; D-pad up/down moves, A opens, B closes. Sleep is ready as soon as you sit.
- With a controller connected, the band's note pads show the pad's buttons (X, Y, LB, RB, LT, RT) and play from the pad; the labels swap live.
- Phone: the crossbow buttons sit in their own block beside the action cluster, Sprint and View hide while aiming, and every button is at least 44 px.
- Backing right up to a wall in the overhead view, the camera rises straight up instead of sitting in your head.

### v0.06 changelog, part 1: title, main menu, pause menu
- The splash lasts 2 seconds, and its book-and-sword icon animates: the book opens and the sword is drawn into it with a glint. With reduced motion it stays still.
- After "Press any button" the title stays on screen (the drifting stone wall, the water and the logo) and the main menu fades in under the logo: **Begin, Extras, Options**, with no panel behind them. Arrow keys, the D-pad or a stick move between them, A or Enter picks one, and mouse and touch work too.
- The old welcome window is gone. The controls tables moved to Pause → Controls, and Write lore moved to Extras.
- A "What's new" window opens the first time you press Begin in a session. This version is open at the top and every earlier version is a bar you can open. It's built from this changelog, and today's writing prompt sits at the bottom. Close it with A, Enter, a tap or ✕.
- Begin always starts in the overhead camera.
- The main menu and the pause menu show whether a controller is connected, and the label updates live.
- New pause menu, Skyrim style: a sidebar with Resume, Gameplay, Graphics, Sound, Controls and Quit to Main Menu. Picking a group opens its options beside it, and picking it again (or B / Esc) closes it. It works fully on D-pad and keyboard: left and right change a setting, and B on the sidebar resumes. Options on the main menu opens the same panel.
- Side panels (the pause menu, the forges, the shop and the other stations) fade from solid at their edge toward the middle of the screen.
- The walk/run label in the bottom-left corner is gone. Caps Lock still toggles always-run and says so.
- The "E: …" prompt sits lower, between the middle and the bottom of the screen.

### Style pass 2: storybook town and land
- Town: four houses (inn, scriptorium, cartographer, tailor) have a jettied upper floor with lit upstairs windows; crooked brick chimneys; window boxes of flowers; terracotta pots by every door; striped awnings over the shop counter and the tailor's and gallery's windows; barrels and crates against some side walls.
- A well in the middle of the green, and bunting strung between the lamp posts.
- Worn footpaths are painted into the ground with soft, ragged edges (spawn to the town, the camp, the gallery hall, the dojo, the rock climb, the coach road out to the gate, and two trails off the green). They replace the old flat dirt strips.
- The meadow has gentle bumps (up to about 0.45 m). Everything built on flat ground stays flat, and trees, rocks, bushes, grass, Natalie and crossbow bolts follow the ground.
- Seven mossy rock outcrops out in the meadow.
- Still one draw call for the ground; the town dressing adds one (about 10k triangles).

### v0.05 changelog, part 4: Quick Dungeon
- The trapdoor now asks "Enter Normal Dungeon or Run Quick Dungeon?". Normal is the walkable dungeon as before.
- The Quick Dungeon is menu-only: a left-to-right map of five layers (the stairs, three layers of 2–3 rooms, the goblin's nest). Every room leads to 2–3 rooms on the next layer, so you make exactly four picks.
- Rooms resolve at once in a card: a fight (a short summary; it costs health and pays crowns), a carving (a line from the lore, credited), a cache (crowns, sometimes bolts) or a spring (heals). At the nest you win a trinket and 12 crowns if you have enough health left, or back up the stairs to try again.
- The paths you can take light up; the map glides to keep your room in the middle (it scrolls sideways on a phone).
- Tap a room, or use D-pad / arrows to move between the rooms ahead and A / Enter to pick; A carries on after a card; B / Esc backs up the stairs.
- Same seed, same map and same outcomes. The result is saved with the seed's delve record.

### v0.05 changelog, part 3: campfire band, Natalie's telling
- The campfire song is split into seven stems: humming, hand drum, whistling, clapping and stomping, violin, lute and ocarina. You play one instrument; the camp plays every other stem, looping while you sit. "Hear your part" plays your stem softly so you can follow it.
- Violin and ocarina are new, sold at the General Store with the other instruments.
- The bedroll is part of the camp: it unlocks once you've sat by the fire and locks again when you leave camp.
- Natalie tells lore pages by the fire ("Hear a tale"). Words appear one at a time, paced by the punctuation, and the page's markdown sets her delivery: `*whisper*` is smaller, lighter and slower; `**emphasis**` is bold and swells; `***dramatic beat***` is big, with a breath before it; `...` and `—` are lingering pauses. The fire flares on the emphasised words.
- The camera frames Natalie and the fire beside the words (above them on a tall screen). On a phone held sideways, she asks you to turn it upright ("Carry on sideways" skips it).
- Tap, A, Space or E hurries her to the end of the paragraph; when she's done the same goes back to the fire. Esc or B leaves at any time.
- Natalie's Field Note is tagged as the first example.

### v0.05 changelog, part 2: three camera perspectives, shoulder swap, D-pad dialogue
- The camera has three perspectives: first person, over the shoulder and overhead (the Dark Cloud 2 style view, now the default). F (or R3, or the touch eye button) cycles them; the wheel, a pinch, the right stick or LB / RB step in and out; the pause menu's Camera list picks one. A saved "follow" view becomes overhead.
- Swap shoulder: Q (or D-pad up) moves the shoulder view to the other shoulder. In first person and overhead the same button switches weapon (hands ↔ crossbow). It's rebindable under Controls.
- Dialogue choices are D-pad friendly: one choice is highlighted; D-pad / arrow keys / W-S (or a stick flick) move it, wrapping round; A, E or Enter picks it. Number keys and clicks still work, and Space still only advances (it never picks a choice by accident).
- Fixed: town plaster showed small repeating marks that read as paw prints.

### Style pass 1: fully painted
- Every texture is repainted at 64 px with soft washes and brush strokes instead of pixel noise: clumped grass with a few flowers, cobbles on dark grout, chiselled stone, bark furrows, plank grain, leaf clumps.
- New lime-plaster walls (rain streaks) and slate roof tiles for the town; brighter roof colours.
- One colour grade for every material (more saturation, warmer highlights, a faint cool lift in the shadows). It is folded into each shader, so it costs nothing and works on Low.
- Warm sunlight with cooler fill light from below, and the haze starts further out.
- Baked shading at the foot of walls, trunks, rocks and props, plus a light top edge (vertex colours, free at runtime).
- Fixed: grass and fern tufts rendered near-black when seen from behind.
- Menus and panels re-skinned as tooled leather with gold borders, gold serif headings and carved-wood buttons, to match the title wall.

### Leanness pass: lighter on phones, faster first frame, tests in CI
- Phones (touch screens) now start on the Low preset. Antialiasing is off on phones and on Low.
- The bloom chain is only built the first time post effects are switched on, so Low/Medium no longer allocate it.
- Shaders compile behind the loading bar (`compileAsync`), so the first frame no longer hitches.
- The library interior is hidden while you are outside it (town walk: 120 → 82 draw calls).
- Dropped the unused Draco decoder (~250 KB of files); models use Meshopt only.
- Fixed: graphics settings could reset on reload (the page-close save overwrote them).
- Fixed the 3 failing test suites (frame-cost check is now info only; Natalie prompt and reload timing checks were timing-sensitive).
- New CI smoke test on every PR and push to main (build + boot + town suites). `npm run knip` lists dead code; one cleanup pass done.

### v0.05 changelog, part 1: boot, menus, saving, the exit gate

- **Boot sequence.** A 1 s developer splash (a book-and-sword icon, "Michael P. Go Presents:", a short jingle)
  fades to the **title**: a carved stone wall drifting slowly (pan and zoom), flowing water, the *Tales of
  Artheria* logo and the prototype notice. Any key, click, tap or pad button opens the **main menu** with a blip.
- **Main menu:** Begin, Write lore, Options and **Extras**. Extras has **Inspirations** (Jason Molina, Vanessa
  Escalambre, Revlis Go, Little Miguel) and **Evolution of the game**: 15 titled screenshots from the R2 rebuild to
  the v0.04 town. Scroll or swipe, use the arrow keys or the D-pad left / right. The images ship as separate files
  in `dist/evolution/` (from `assets/evolution/`).
- **Version notice:** the menu says "Tales of Artheria v0.05 | System up to date" (or "Updated from v0.04").
- **Menus from the pad and keyboard:** the D-pad or arrow keys move between buttons, A or Enter presses, and B or Esc
  goes back.
- **Save and return to the menu** (pause menu) keeps where you stood, the hour and your bag; Begin carries on
  from there.
- **Rebind keys** in the pause menu's Controls (click an action, press its new key; Reset keys). Saved on this
  device. The controller map is drawn beside it.
- **The exit gate** stands at the west end of the coach road, under the sign **"Temporary Exit - Mind the
  dust"**. Walking through asks "Leave the area? This will retire you." Yes saves your bag and the hour and
  returns you to the menu; next time you begin back at the glade. No steps you back inside.
- Automated test browsers skip the intro unless a test asks for it.

### v0.04 feedback, part 8: town layout, placeholder names, version label

- **The town is a ring round a green.** All nine buildings sit on it: library (opens the lore book),
  smithy, tailor, scriptorium, cartographer, dojo (opens the drills), gallery (leads to the hall), general store
  and inn. Each lot is set at its own angle and distance from the green, and the buildings vary in size, so no
  two stand square to each other. The lane from the glade and the projectionist's screen take two gaps in the ring.
- **Placeholders get generic names and never enter the lore** (Mike's rule). The cinema NPC is now **the
  Projectionist**. Natalie's missing party are **the Archer** (was "the scout"), **the Mage** (was "the
  tracker") and **the Swordsman** (was "the shieldbearer"); the crossbow is now the **Archer's Crossbow**.
- **Corner label** reads `v0.04 · Mike Go`.
- Draw calls: the town signs share one texture atlas, the screen stand is part of the town batch, and the five
  dirt patches round the spawn are one mesh (119 calls on the budget walk, under 120).

### v0.04 feedback, part 7: cinema

- **The Projectionist** (placeholder): stands by a framed screen on the town green. Talk to them
  (or the screen) to watch short reels by Mike and friends.
- **Reels** live in `assets/cinema/` (see its README): `name.webm` preferred, `name.gif` as the fallback (or
  `.mp4`), optional `clips.json` for titles, credits and whether a clip has sound. They ship as separate files
  in `dist/cinema/`, so the page stays small and phones only download a reel when it plays.
- Clips start muted; sound is one button away. While a video plays, the screen in town shows it too.
- No reels ship yet: until clips are added, the Projectionist says where to put them.

### v0.04 feedback, part 6: campfire

- **Lore writing moved to the campfire:** the L hotkey and the in-game "Write lore" buttons (HUD, pause menu) are
  gone. Sit by the fire and pick "Write lore with Natalie": she holds the quill and the lore editor opens. The
  title screen keeps its button for writing before you play.
- **Natalie the bard:** while you sit, she comes to the fire and strums a looping lute backing (C – Am – F – G).
- **Playable instruments:** pick one and play along on six pads (keys 1–6): hum and clap & stomp are always
  yours; the tin whistle, hand drum and lute come from the General Store. Melodic instruments play a pentatonic
  scale so anything you play fits Natalie's chords.

### v0.04 feedback: Mike's follow-ups

- **Heroine hair:** her back hair is shorter, now ending at the shoulders.
- **Magister Greer:** the Curio Pedlar is now Magister Greer, Aralon's wizard-trader who is half the time a rooster
  (from the public lore, Mike's pick). White feathers, a purple wizard's robe, a red comb mark, new lines.

### v0.04 feedback, part 5: world

- **Hills:** the middle of the glade stays flat; from 42 m out the land rolls up into hills at the edge of the
  walkable square and on past it. Trees, rocks and the forest ring sit on the slopes; you can walk up them.
- **Distant mountains:** a ring of craggy, snow-capped low-poly peaks on the horizon, drawn past the fog.
- **Town:** down the lane south of the spawn point, a street of six storybook buildings, one per tool: Smithy
  (weapon forge), Tailor (character mirror), Scriptorium (sketchbook), Cartographer (living map), General
  Store (shopkeeper) and Inn (sleep). Each has a sign, lit windows and a door; E at the door opens the tool.
  The library, dojo and gallery keep their own places; the camp stations still work too.
- **Shopkeeper:** trades at a counter outside the General Store. Buys curios and bolts; sells bolts, a tin
  whistle, a hand drum and a lute (the instruments are played at the campfire, coming next).
- **Crowns (◎):** the new currency. Earned by finds (each clue, a purse on the rock lookout, selling curios) and
  by writing (margin note +2, banner sketch +3, ballad +5, lore page +10). Session-only, like the bag.

### v0.04 feedback, part 4: reading

- **Read pose:** while a book is open the avatar reads: head down, an open book held at the chest (shelf books),
  a page turned now and then. At the lectern the avatar turns to face the stand.
- **Phones held upright:** the book becomes one vertical scroll; pages run on with small page numbers, and the
  page at the top is remembered as the last page read. Margin notes follow the page in view.
- **Phones held sideways:** opening a book shows a faint "turn your phone upright" hint for a few seconds;
  pages still turn by swipe.

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
