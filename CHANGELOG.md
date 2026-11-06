# Changelog

Per §0 rule 3 of the Video Gametool Project spec. One entry per shipped `VERSION`.

## Live builds 0.03 to 0.16 (each round deploys to GitHub Pages; roadmap 0.03 onward + Artheria lore pass)

One merged entry for the roadmap work. The corner label shows the current build version (`VERSION` 0.16,
Mike 2026-10-28; batch B 2026-10-31; batch C 2026-11-01; batch D 2026-11-01; B26 2026-11-02). Spec doc v0.06.

### v0.16 changelog, part 45: the Ruined Library looks its age, 6: ivy and plants (Mike 2026-11-06, Graphics thread: "Add 2d quad ivy and plants.")
- **Cut-out quad ivy and plants**, painted in our own leaf, fern and grass textures and swaying in the wind. **Ivy curtains** hang down the inside walls. **Vines** dangle through every hole in the ceiling, with grass and ferns growing on the floor below where the sky comes in. **Tufts** sprout in the floor's cracks and at the walls' foot.
- Outside, ferns and grass grow along the hall's walls, and more ivy hangs off the top of the front.
- Three merged meshes inside (one per texture) and three outside.

### v0.16 changelog, part 44: the Ruined Library looks its age, 5: stone stairs down (Mike 2026-11-06, Graphics thread: "Trap doors are now stairs down.")
- **The trapdoor is gone.** In its place a **stone stairwell** is cut into the library floor: twelve worn steps go down into the dark under a black arch, with a torch in a bracket halfway down. A low kerb with corner posts runs round three sides, and you go down from the side facing the door ("Go down the stairs"). You can't fall in.
- The flagstones leave a gap for it, and the ground under the hall is sunk well below so you can see down the steps.
- Coming back up (from the descent or a Quick Dungeon) puts you at the top of the stairs. "Back to the stairs" replaces "Back to the trapdoor", and the map and patrons' kit say "stairs" too.
- The descent and Quick Dungeon flows are unchanged (`e2e-descent`, `e2e-descent-cinematic`, `e2e-descent-extras`, `e2e-patrons` pass). `e2e-places` is updated for the new prompt; its B15 floor-1 check still fails as it does on main.

### v0.16 changelog, part 44: the Ruined Library looks its age, 5: stone stairs down (Mike 2026-11-06, Graphics thread: "Trap doors are now stairs down.")
- **The trapdoor is gone.** In its place a **stone stairwell** is cut into the library floor: twelve worn steps go down into the dark under a black arch, with a torch in a bracket halfway down. A low kerb with corner posts runs round three sides, and you go down from the side facing the door ("Go down the stairs"). You can't fall in.
- The flagstones leave a gap for it, and the ground under the hall is sunk well below so you can see down the steps.
- Coming back up (from the descent or a Quick Dungeon) puts you at the top of the stairs. "Back to the stairs" replaces "Back to the trapdoor", and the map and patrons' kit say "stairs" too.
- The descent and Quick Dungeon flows are unchanged (`e2e-descent`, `e2e-descent-cinematic`, `e2e-descent-extras`, `e2e-patrons` pass). `e2e-places` is updated for the new prompt; its B15 floor-1 check still fails as it does on main.

### v0.16 changelog, part 42: the Ruined Library looks its age, 3: goblins moved in (Mike 2026-11-06, Graphics thread: "Make it look like goblins moved in.")
- **Bedrolls** of sacking on scattered straw, a few with a stolen blanket; **gnawed bones** in little heaps, some with a skull; a **cart wheel** dragged in and propped against a wall.
- **Chalk tally marks** on the walls at goblin height, in rows of five. Someone is counting something.
- One merged mesh, kept off the aisle and clear of everything you use.

### v0.16 changelog, part 41: the Ruined Library looks its age, 2: books on every wall (Mike 2026-11-06, Graphics thread: "The walls have countless books.")
- **Tall bookcases climb every wall**: over the lore shelves up to the broken ceiling on both sides, over the pictures and full height in the corners at the back, and high either side of the door. There are 25 cases and nearly 200 shelves of books.
- The books are our own pixel-painted spines (four strips of an atlas, with gaps where books were taken and a few leaning). Each shelf is one recessed plane, so thousands of books cost a few hundred triangles; the cases are one merged mesh.
- The lore shelves and their red books are unchanged.

### v0.16 changelog, part 40: the Ruined Library looks its age, 1: the ruin (Mike 2026-11-06, Graphics thread: "Change the library. It needs to look old, decrepid.")
- **Rubble heaps** where the upper walls came down (big blocks, a skirt of stones, moss), **toppled bookcases** with snapped shelves and spilled planks, a **fallen roof beam**, worn scorch on the flagstones and grit everywhere.
- **Cracked walls**: thin cracks wander down all four inner walls, and bricks have fallen out here and there (they lie at the wall's foot).
- **The ceiling has fallen in places**: nine holes open to the sky, with splintered boards hanging at their edges.
- All of it is one merged mesh of flat-coloured low-poly pieces (`src/world/ruin.ts`), placed off the aisle and clear of everything you use. It only draws when you're near the hall.
- New `test/e2e-library-ruin.mjs`.

### v0.16 changelog, part 39: the Monk locks on and fights hand to hand (Mike 2026-11-06, Round B)
- **Monks** lock on to the nearest goblin ahead in the descent with Z (LB on a pad, a Lock on button on touch), and the fight moves into **fight mode** right where you stand: the mat is laid between you, turned so you keep your side, and the camera comes in closer for corridors.
- A duel is **one round**. The goblin's health bar is scaled to its toughness, and leaders, guardians and floors 10+ fight at Kavik's "fair" level. Win and it falls, loot and all. Lose, or leave the mat, and you break away for 3 health.
- Kavik's spar on the dojo mat is unchanged (best of three).
- New `test/e2e-monk.mjs` (12/12).

### v0.16 changelog, part 38: the Mage's magic missile, taught by Magister Greer (Mike 2026-11-06, Round B)
- **Mages** can ask **Magister Greer** by the coach road for a spell. He teaches **magic missile** (kept on your profile), then has advice instead.
- **Cast** with Z (LB on a pad, a Missile button on touch): a small bolt of pale light flies where you look, bends gently toward a goblin ahead, hurts it (2) and bursts on walls. It **lights the walls and floor as it flies**, which helps in the dark below. A short cooldown (1.2 s) between casts.
- One shared light, added only once the spell is learned, so other heroes pay nothing for it on phones.
- New `test/e2e-mage.mjs` (11/11).

### v0.16 changelog, part 37: the Fighter's techniques and steadying breath (Mike 2026-11-06, Round B)
- **Fighters** trade the shoulder-button zoom for two trained techniques with a sword: **Lunge** (LB, or Z) dashes forward into a hard thrust (4 s cooldown), **Sweep** (RB, or X) cuts all around you (6 s). On touch they get two technique buttons.
- **Steadying breath** (hold LB + RB together, or V): stand still a moment and gain 4 temporary health that soaks hits first and fades after 30 s (45 s cooldown). The health line shows it as "+N".
- Other professions keep LB / RB zoom as before. Keys are rebindable.
- New `test/e2e-fighter.mjs` (11/11).

### v0.16 changelog, part 36: Candor teaches archery (Mike 2026-11-06, "Add to world. Have him teach Archery. Name him Candor.")
- **Candor**, in Mike's own Painted Archer model, stands at a new **archery range** in the east meadow between the library and the skyrunner perch: a chalk shooting line and three straw butts on stands, 7, 10 and 13 m out.
- Talk to him (**Talk to Candor (archery)**): **Teach me archery.**, **How do I aim?** (iron sights or, for a Ranger, the crosshair) or **Not now.** No crossbow? He lends one with ten bolts.
- The lesson: one bolt in each butt. He calls every hit by its ring (gold, red, blue, black, white) and how many are left, and a miss gets a word too. The first full lesson pays 15 crowns; after that he remembers your best (fewest bolts for all three). Walk off the range and the lesson ends.
- The map's "What's here" lists his range. The model ships at 0.8 MB (its 4K textures cut to 1K; the unused normal and ORM maps dropped); credited in `public/models/CREDITS.md`.
- New `test/e2e-candor.mjs` (13/13).

### v0.16 changelog, part 35: the Ranger's crosshair, and iron sights for everyone else (Mike 2026-11-06, "ranger: Has better crosshairs that give them way better aim. Everyone else does not have crosshairs and must use iron sights")
- **Rangers** get a true crosshair whenever a crossbow is in hand, in every view: four ticks around a dot that close in and turn gold as they steady. Their aim sways a quarter as much, steadies twice as fast and spreads a third as much from the hip.
- **Everyone else** has no crosshair with a crossbow in hand (the steadiness ring is gone too). The held crossbow now carries **iron sights**, a notched rear sight and a front post with a brass bead; aim down the sights in first person and the bead sits where the bolt goes.
- `test/e2e-steady-aim.mjs` checks both (14/14).

### v0.16 changelog, part 58: Natalie saw the creation (Mike 2026-11-06, "When players start the game, they go right into character creation. Then a cinematic plays of Natalie talking to the player")
- Once a new hero is made, a short cinematic plays: Natalie, in the letterbox, says she saw the whole creation, that it was odd to watch someone change so quickly, and that it bothers her a little. Then the camp welcome, if it was still to come, follows.
- `test/e2e-natalie-creation.mjs` checks the four lines play in order and play resumes; `test/e2e-character-creation.mjs` now expects the scene after Done.

### v0.16 changelog, part 34: make your hero, with a profession (Mike 2026-11-06, "There's no character creation at new game" and "Character Creation: Give character choice of profession")
- A new game now makes your hero: once you're up, you step to the camp mirror and the Tailor & Barber-Surgeon opens on a new first tab, **Profession**. Pick **Fighter**, **Ranger**, **Mage** or **Monk**; every other tab (name, story, body, hair, clothes) stays optional, and **Done** goes into play. No text box opens a phone keyboard by itself.
- The profession is saved with the hero and shown in the panel's heading. Change it any time at the tailor or the mirror. Heroes made before this get a one-time note saying where to pick one.
- What each profession does arrives one update at a time (each card says so until it's in): Fighter techniques on LB / RB and a steadying breath, the Ranger's crosshair, the Mage's magic missile from Magister Greer, the Monk's lock-on.
- New `test/e2e-character-creation.mjs`; `test/e2e-tailor.mjs` counts the new tab.

### v0.16 changelog, part 57: no quest at the start (Mike 2026-11-06, "Make it so that the players don't have a quest when they start new game")
- A new game no longer starts the guided first day: no goal card, no gold marker, and the side games (spar, sky run, dojo, the stairs down) are open from the start. A friend part-way through an old first day can finish it or skip it from the casebook.
- `test/e2e-first-day.mjs` checks a new game starts with no quest.

### v0.16 changelog, part 33: Kavik talks before and after a spar (Mike 2026-11-06, "Kavik needs a dialogue before the fight and after")
- E on Kavik now opens a talk (**Talk to Kavik (spar)**): **Let's spar.**, **Have you been down the descent?** (his floor-thirty story, which used to be a one-off toast) or **Not now.** His greeting changes once you've sparred, and again once you've beaten him.
- After a match, leaving the mats brings his reply: different lines for a first win, a later win, a loss while he's going easy, and a loss after you've beaten him. Then **Again!** for a rematch or a parting line.
- `test/e2e-fight.mjs` covers both talks (29/29).

### v0.16 changelog, part 32: map notes where you click (Mike 2026-11-06, "Map pinning doesn't work right. Right click on the map, then add a note there")
- **Right-click** anywhere on the living map (M), or **long-press** on a phone, and a small note box opens at that spot with a red ring on the map. Type and press Enter or **Add note**; **Cancel** or Esc drops it. The note is pinned where you clicked, not where you stand.
- Notes are now drawn over the fog, so you can mark a place you haven't walked to yet. **Pin it here** (at your own spot) still works.
- New `test/e2e-map-notes.mjs`.

### v0.16 changelog, part 31: gamepad: click the left stick to crouch (Mike 2026-11-06, "Gamepad: Left thumbstick is crouch")
- **L3** (click the left stick) now toggles crouch / sneak. Sprint moved to **B**: press it while moving and you sprint until you let go of the stick (B still backs out of menus). In the knight frame, B pushes it to a stomping run.
- The controller map in Pause → Controls shows the new layout. `test/e2e-mobile.mjs` checks both buttons.

### v0.16 changelog, part 30: ask Natalie for the Archer's crossbow (Mike 2026-11-06, "Add Natalie dialogue option to ask for a crossbow from her former arbalest")
- Once her quest has started, whenever you have no crossbow, talking to Natalie adds **"Could I borrow the Archer's crossbow?"** (the Archer is her party's crossbowman). She hands it over and tops your bolts up to 10. Ask again as often as you lose it.
- `test/e2e-quest.mjs` checks the choice is hidden while you carry one and works twice in a row; it also counts her newer "What is under the library?" choice (a stale check).

### v0.16 changelog, part 29: the knight frame is rideable from the start (Mike 2026-11-06, "Make the Mech rideable from the start")
- The knight frame now stands awake in the treeline east of the green from the first moment: walk up and climb in (E / A / Use). It no longer waits for the descent's third floor or for a new friend's first day.
- The map marks it as ready from the start. `?mech` is no longer needed.
- `test/e2e-knight-frame.mjs` checks it stands and offers "Climb into" on a fresh profile.

### v0.16 changelog, part 28: the Ruined Library is open from the start (Mike 2026-11-06, "Make the library accessible right from the start")
- The library's door stands open when the world loads, so you can walk in before talking to Natalie. Her crossbow talk still gives the crossbow and bolts; its old unlock step does nothing now.
- `test/e2e-world-controls.mjs`: the door check now walks through the open doorway. Two stale checks were fixed too: the camera-against-the-wall check turns see-through off (B45) and checks that the camera never sits inside a wall (in the overhead view it may pass over the top).

### v0.16 changelog, part 27: wake at the camp, and Natalie's welcome (Mike 2026-11-06, "Spawn at the campfire, not at the inn")
- A new game now wakes on the camp bedroll by the fire instead of the inn bed. Continuing an older save still wakes where you last slept.
- Once you're up, Natalie explains the camp: it's her party's base camp at the Ruined Library (once the Library of the Wise), set up to map it and bring its lost books home, until one goblin scattered them. She then says how to play (find her party, read and write in the Library, go down when ready) and how to win (thirty floors to a dragon's hoard, bring her the lore books, climb back out alive and your drawing goes up on the Inn wall beside Kavik's). It plays once per profile. Ask her "Why is the camp here?" to hear it again. The text lives in `content/dialogue/natalie-camp.json`.

### v0.16 changelog, part 26: the map shows what there is to do (Mike 2026-11-05, "Mark it on the map. Update the map so that new players can see what the game has to offer")
- The living map (M) now marks every place to visit from the start, over the fog: the knight frame (grey and locked until it wakes), the skyrunner perch, the descent's trapdoor, Natalie, the camp (campfire, mirror, anvil, sketchbook), Kavik, the caravan, the practice table, the grindstone, the cinema and the record statue.
- Beside it, a **What's here** list gives each one a line on what you do there (and, for the frame, how to wake it).
- The town is drawn as it is now: every house on the green to scale, with its name, and the four roads out (the Ranlean and Amethyst Peak gates marked shut). The old glade-era labels are gone.

### v0.16 changelog, part 25: the knight frame, a pilotable mech (Mike 2026-11-05, "Robots? Can you add pilotable mechs?")
- A **knight frame** kneels asleep in the treeline east of the green: ten feet of elvish bronze gone green, the same make as the Caerne's *Telandor Savior* (Tales Part I), with a dark gem in its chest. **Clear the descent's third floor** (take the stairs down from floor 3) and it wakes and stands. The wake is saved with your profile. For testing, `?mech` on the URL wakes it straight away.
- **Climb in** at it with E / A / Use; the same button **climbs out** of the back hatch. It stays where you leave it.
- Inside, you move as usual (Alt / L3 / the sprint button pushes it to a stomping run; it turns slowly). **Strike** with LMB / RT / Strike, **guard** with the shield arm on RMB / LT / Guard, **ground-slam** with Space / Y / jump, and a **rune pulse** that staggers everything near on Q / D-pad up / ✦ (6 s to recharge). Footfalls rumble the pad and shake up dust. The camera pulls back and up; there is no first person inside.
- Like the other side games, climbing in waits until a new friend's first day is done (lore first); `?mech` skips that too.
- It can't use doors, the trapdoor or the roads out of Aralon (climb out first). No passengers and no multiplayer sync yet (next round). Low poly: 588 triangles, ink outlines, never cut away by see-through.
- New `test/e2e-knight-frame.mjs` (17/17, with the map checks).
### v0.16 changelog, part 24: stair cinematics and floor hints (Mike 2026-11-05, thread "Add dungeon floor cinematics and hints")
- Dropping through the trapdoor and going down each floor's stairs now plays a short cinematic (about 4 s and 3 s): the camera rides down a torch-lit spiral stair while a card reads "Leaving Floor 3 / Floor 4 of 30". Any key, click, tap or pad button skips it; with reduced motion the camera holds still.
- Each card carries up to two hints of what's below, felt rather than told and always true to the floor just built: damp and sweating walls for a flooded floor, moist air where there are many pools, a guttering torch for a dark one, heat and smoke for a burning one, breath fogging on a Frost floor, roots on a Verdant one, deep breathing before a guardian, woodsmoke before a camp, goblin sign when a tougher band starts, and gold-light before the hoard.
- The stair shaft is dressed to match (fog colour, torch strength, drips, embers, frost, leaves or dust), with footsteps on stone and drips, crackle or a low rumble. If Natalie is following, she says a line about it at the bottom.
### v0.16 changelog, part 23: sending your work to Mike (lore-first round, item 5, Mike 2026-11-05)
- Every piece in **Your works** (formerly Portfolio) has a **Send** button. The send sheet now says plainly that Mike adds it to the game with your name on it.
- On phones and other browsers that can, **Share…** opens the device's own share sheet (Messages, WhatsApp, email) with the piece and its lore file, so no GitHub account is needed. GitHub, download and copy are still there.
- **Your works · send to Mike** is in the pause menu too, and Back returns you there.

### v0.16 changelog, part 22: lore first (lore-first round, item 4, Mike 2026-11-05)
- A new friend's first day now starts with the stories. Right after getting up, Natalie sends them to read a tale in the Library, and only then to the Scriptorium, the Tailor or Smithy, and the campfire (five steps).
- The side games (dojo, sparring with Kavik, sky runs, the trapdoor) wait until the first day is done or skipped. Their prompts still show, marked "after your first day". Profiles from before the first day existed are not affected, and a day part-way through keeps its place (save upgrade 1→2).
- Extras now leads with the lore: Write lore, Your works and Wiki first, then What's new, Profiles, Inspirations and Evolution.

### v0.16 changelog, part 21: saves that last for years (lore-first round, item 3, Mike 2026-11-05)
- Saves are versioned. Every profile on the device is upgraded to the current shape when the game starts, and so is any profile or backup file you import, so a save from years ago still opens. A v0.16 profile is kept as a test fixture that must keep loading forever (`test/e2e-longevity.mjs`).
- Extras → Profiles → **Keep it for years**: **Back up everything** saves one file with all three profiles and your settings (never the GitHub token). **Restore a backup** brings it all back, on this device or a new one. The page says when you last backed up and nudges you after two months.
- On Begin, the game asks the browser to keep its data even when space runs low (installed apps usually agree without asking).

### v0.16 changelog, part 20: the skyrunner (Mike 2026-11-05, "ride a fixed-wing plane ... A to B within 1 minute")
- A launch perch (a timber tower with a glider on the deck) stands in the meadow east of the library. "Fly a sky run" takes you up in a **skyrunner**: a one-seat glider with mana-sail wings and a gem in the nose (airships and mana-borne flight are both in the public lore).
- Every run is its own **seeded map**: about 3 km of low-poly hills, lakes, forest and rock spires, with mountains round the edge. You start on the perch (A); the **beacon** (B), a stone tower with a pillar of blue fire, is 1.6 to 2 km away. Reach it inside **60 seconds**. Four wind rings along the way add 2 s each. Hit the ground or a spire and you crash. The result card shows the map number and your best time on it: "Again" flies the same map, "New map" rolls another, or type a map number a friend sends you.
- **Flight**: arcade, not a sim. It turns where it banks and levels out when you let go. Throttle sets the speed (90 to 200 km/h). A mana **surge** gives +40% for 2 s (6 s cooldown). Chase camera, a cockpit view (V / Back), and look back (R / R3).
- **Dogfight**: one run in twenty, a **hexed skyrunner** (black sails, violet bolts) comes for you 10 s in. Both planes fire mana bolts, with a little aim help and a heat bar that jams for 1.5 s if you hold the trigger too long. You take 5 hits, it takes 4, and you can out-turn it. You don't have to shoot it down to win. `?dogfight` forces it.
- **First person** (Mike 2026-11-05): V, Back on a gamepad, or the View button (also on touch) puts you in the pilot's seat. You see the cowl, the nose gem and a brass sighting ring, and the view rolls with the wings. The choice is remembered.
- **Tilt steering** (Mike 2026-11-05, "motion control"): on a phone, the Tilt button lets the gyro fly the glider. Tip the phone left or right to bank, and forward or back to dive or climb. It levels to however you're holding the phone when the run starts, and Recenter resets it mid-flight. It works held upright or sideways, the stick still works alongside it, and the game remembers the choice (an iPhone asks for motion permission on the first tap).
- **Lenju and Taitai** (Mike 2026-11-05): two new characters at the foot of the perch. Lenju is the pilot who flies the skyrunner; he explains how it flies, gives tips, and "Let me fly it" sends you up. Taitai is a carpenter and Lenju's close friend; he built the perch, the ramp, the beacon towers and the glider frame with him, and works at a sawhorse beside it.
- **Controls**: keyboard W A S D or the arrows (W dives; "Pitch: inverted" swaps it), Shift / Z throttle, Space or click fires, Q surges. On a gamepad: left stick, RT / LT, A or RB fire, Y surge, Start leaves. On touch: a stick on the left, Fire, Surge and Look back on the right, and the throttle sorts itself out. Rumble on hits and crashes.
- Pays 20 crowns a win, +30 with the hexed skyrunner shot down. Runs, wins, kills and best times are saved on the device. New `test/e2e-sky.mjs` (22/22).

### v0.16 changelog, part 19: chimney smoke (decoration 7, Mike 2026-11-05, Graphics thread "Add all decorations")
- Chimney smoke is now chunky low-poly puffs that swell, turn and fade as they drift up in the wind, instead of flat cards. One instanced mesh for the whole town.

### v0.16 changelog, part 18: ivy and moss (decoration 6, Mike 2026-11-05, Graphics thread "Add all decorations")
- Ivy climbs the low stone walls and the library ruin, and moss creeps along wall tops, feet and house plinths. Flat low-poly leaves, two merged meshes.

### v0.16 changelog, part 17: wells and signposts (decoration 5, Mike 2026-11-05, Graphics thread "Add all decorations")
- Two stone wells with a roof, winch and bucket, and a wooden signpost at the start of each footpath out of town. One merged mesh, with colliders.

### v0.16 changelog, part 16: woodpiles, hay and carts (decoration 4, Mike 2026-11-05, Graphics thread "Add all decorations")
- Woodpiles stand behind the smithy, inn, dojo, cartographer and library; hand carts by the inn, smithy, tailor and gallery; hay stacks by the inn, dojo, scriptorium and shop. None blocks a path. One merged mesh.

### v0.16 changelog, part 15: wall lanterns (decoration 3, Mike 2026-11-05, Graphics thread "Add all decorations")
- Every house has two iron lanterns on brackets on its side walls. Their glass glows warm, and at dusk and night they join the town's light pools. Two merged meshes (iron, glass).

### v0.16 changelog, part 14: market stalls (decoration 2, Mike 2026-11-05, Graphics thread "Add all decorations")
- Three market stalls stand round the paved plaza: timber frames under striped, scalloped awnings (red, blue, green), with goods on the counters (fruit, bread, cloth, pots). You walk round them, not through. One merged mesh.

### v0.16 changelog, part 13: banners and flags (decoration 1, Mike 2026-11-05, Graphics thread "Add all decorations")
- Every house has a pair of heraldic banners flanking its door, hung from a rod with gold finials. Four tall flagpoles stand on the green, and pennants stream from the gate posts. The cloth moves in the wind. It is all low-poly 3D in flat painted colours, two meshes in total (cloth, poles), so it stays cheap on phones.

### v0.16 changelog, part 12: solid barrels and crates (Mike 2026-11-05, Graphics thread, "Don't billboard the crates and barrels")
- Barrels, kegs and crates are real low-poly 3D again (no more flat cards that turn to face you): eight-sided barrels that bulge in the middle, with iron hoops and end-grain lids, and crates with rounded corners, planks and an X brace. All barrels are one merged mesh and all crates another (two draw calls), with shadows and ink outlines like the other props.

### v0.16 changelog, part 11: fallen heroes' gear and the patrons' gifts (Mike 2026-11-05)
- **Fallen heroes' gear**: when a hero dies, goblins carry off each of their arms with an even chance (up to three:
  sword, dagger, mace, spear, crossbow, sling, shield, buckler). Goblins on that floor or the one either side then
  carry and use them: blades and maces hit harder, a crossbow or sling shoots, a shield turns blows. Their tag names
  it ("Snik, with Ana's flanged mace"). Beat the carrier and it's yours.
- **Natalie's patrons** (Greer's friend) send gifts as books reach her, kept from hero to hero: at 2 books each new
  hero starts with 20 crowns; at 5 the smith charges a quarter less; at 8 each hero can take one kit at the trapdoor
  (sword and buckler, crossbow and 15 bolts, mace and shield, or sling, rocks and a dagger); at 12 every run starts
  with a choice of the witch's scrolls. The trapdoor lists them.
- New `test/e2e-patrons.mjs` (9/9).

### v0.16 changelog, part 10: the witch's scrolls (Mike 2026-11-05)
- Each time you take the stairs down, three scrolls lie on the top step. Take one (or leave them) and it imbues
  something you carry until the run ends: Rime (bolts slow a goblin), Witchfire (bolts +1, but blows hurt you 1
  more), the Drinking Edge (cuts mend 1), the Hungry Edge (+1 blade damage, but camps no longer mend you), Thorns
  (a blocked blow wounds the striker), the Seeing Flame (with a torch lit, lurkers and mimics can't hide), the
  Heavy Stone (rocks hit harder) and Quick Feet (faster, but thieves always go for your books).
- Only scrolls for things you carry are offered, never one you already have. The HUD lists what you're imbued with.
- New `test/e2e-scrolls.mjs` (9/9).

### v0.16 changelog, part 9: guardians, rest camps and flux floors (Mike 2026-11-05)
- **Guardians**: a named boss goblin (Gnash the Binder, Old Mother Mildew, ...) waits in the deepest room of its
  floor. Guardian floors are rolled once: each 7 to 10 floors after the last, so up to 3 early, never more than 10
  apart. Beat one and Natalie ties a rope there: the trapdoor then offers that floor as a start point. Ropes are kept
  from hero to hero.
- **Rest camps** on floors 5, 10, 15, 20 and 25, by the stairs: rest once to heal fully, oil the blade and restring
  the crossbow.
- **Flux floors**: some floors come out twisted, more often deeper down (never camps, guardians or the hoard):
  pitch dark, flooded to the knee (slow), burning shelves (the heat bites now and then), or light (you fall slowly
  and jump high). The load screen warns you.
- Test: `e2e-descent-extras`.

### v0.16 changelog, part 8: the descent, a roguelike under the library (Mike 2026-11-05)
- The trapdoor now offers **the descent**. The library is in flux (the witch in the ruins): every floor is a new
  layout each time. They say it goes 30 floors deep, with a dragon's hoard at the bottom. Stairs down sit in the
  deepest room of each floor (behind a load screen); every floor has its stairs up. Your wounds carry down.
- **Books are carried**: they reach Natalie (and the gallery shelves) only when you climb out alive. Climbing out
  records your deepest floor. The seed box is gone; the Quick Dungeon stays as practice where nobody dies.
- **Death ends the hero**: write their last words, and the bag, crowns, hands and carried books are gone. Writing,
  sketches, forge designs, the gallery, books already handed in and the kill statue stay. A new hero wakes at the
  glade and the mirror opens to make them.
- **The Inn's front wall**: the death tally (name, deepest floor, books handed in, slain by, date, last words) and
  the survivors' wall, where only Kavik's sketch hangs. Take the hoard on floor 30, climb out alive, and your
  drawing (your newest sketch, or a portrait) goes up beside his; that hero retires.
- **Goblins get harder and smarter by depth**: more of them, tougher, harder-hitting, and new tricks by band:
  4-8 they flank you in packs and carry extra snares; 9-13 slingers, pot-lid guards, and the wounded back off to
  mend; 14-19 shelf-lurkers drop on you, blows can douse your torch, and thieves go for your books (kill them to get
  it back); 20-24 shamans mend the others and hex you (the dark closes in, or your legs go heavy); 25-29 captains
  with a double blow, and they learn your habits (lean on the sword and more pot lids turn up; on the crossbow and
  they dodge); 30 the hoard-keepers.
- Natalie answers "What is under the library?"; Kavik has a word about floor 30.
- Tests: `e2e-descent` (new); `e2e-places` updated for the new trapdoor sheet.

### v0.16 changelog, part 7: four ways out of Aralon (Mike 2026-11-05)
- One exit per side, each signposted, each to its own map after a load screen (the place's name, a line, a bar):
  - north: **Aralon Edge**, a clifftop with a rail, a bench and a lone pine, built on a real cliff north of town, so
    you look down on Aralon itself;
  - south: **the Beach**, dunes, driftwood, an upturned boat, a jetty and a breathing tide;
  - east: **the Ranlean Gates**, the city wall, towers and banners; the gates are shut ("knock" to hear why);
  - west: the coach-road gate now offers **Walk on to the Amethyst Peak gates** (snow, amethyst crystals, a carved
    gate sealed until the thaw) beside retiring.
- Each map has a waystone ("Head back to Aralon"), and walking off its back edge goes home too; you come back in at
  the side you left from. Natalie and your pets come along if they're following.
- The save remembers which map you were on; Continue puts you back at its waystone.
- Test: `e2e-exits`.

### v0.16 changelog, part 6: a new first-meeting scene, Greer and Natalie (Mike 2026-11-05)
- The first talk with Natalie now opens on Magister Greer, come up from the coach road to look in on her for her
  patron (a close friend of his). A letterboxed two-shot by the library door with her title card, then the camera cuts
  between them over the shoulder as they talk, subtitled, about 24 s in all. Then Greer goes back to his post and her
  dialogue starts as before. Still once per profile, any key skips, and Low power or reduced motion goes straight to
  the dialogue box.
- Test: `e2e-first-meet` (rewritten).

### v0.16 changelog, part 5: item cards in the bag (Mike 2026-11-05)
- Hover a bag item (mouse), long-press it (touch) or move onto it (keyboard, controller) for a Diablo-style card: the
  name coloured by kind (weapons white, shields blue, instruments violet, food green, coin gold; a forged weapon with
  its own name shows gold), the type, the stats that matter (damage, speed, reach and sweep; a shield's block arc; the
  sling's whirl), which hand holds it, the forged engraving and legend, the flavour line, and its price.
- Bag cells can now take focus, so the controller walks them like buttons.
- Test: `e2e-item-cards`.

### v0.16 changelog, part 4: the sword forge, and the weapon shown centre screen (Mike 2026-11-05)
- The weapon forge has Crossbow and Sword tabs. The sword takes a blade (arming, broad, curved, slim), a guard (cross,
  swept, disc), a pommel (round, disc, ring), steel, metal and grip colours, an engraving, a name and a legend. Done
  puts the new look on the sword in hand (both hands if you hold two) and saves it; Submit exports it like the crossbow.
- The weapon being forged now shows large in the middle of the free screen, on a soft dark backdrop, instead of over
  the anvil. Drag it, use the right stick or the arrow keys to turn it.
- Test: `e2e-sword-forge`.

### v0.16 changelog, part 3: daggers, maces, spears, rocks and slings (Mike 2026-11-05)
- The smith's counter now also sells a dagger, a flanged mace and an ash spear; the General Store sells a shepherd's sling. Like everything else, they go in either hand, in any pair.
- The dagger cuts in half a sword's time for less, so two make a flurry. The mace is slow and heavy: every blow goes through a pot lid and knocks a goblin back. The spear jabs straight out a long way on a narrow line, so you can reach a goblin before it reaches you. Any of them comes up to turn half a blow if you keep holding its button after the blow, like the sword.
- Rock piles by the fountain, the gate and the smithy give five rocks at a time (E). With rocks in hand, the button throws one in an arc. With the sling, hold the button to whirl it and let go to loose: the longer the whirl, the farther and harder, up to about a bolt's hit. Rocks lie where they land; pick them back up with E. The ammo line shows your rocks and how far the sling is wound.

### v0.16 changelog, part 2: shields and blocking (Mike 2026-11-05)
- The smith's counter, in front of the smithy, sells a wooden buckler and a round iron-rimmed shield, shown on a rack. A new shield goes onto your left hand if it's free. Like everything else, either goes in either hand, or both.
- Hold a hand's button to block with what it holds. A shield turns any blow from the front: the buckler covers a narrow arc, the round shield a wide one, and two shields wider still. Keep holding a sword's button after its cut and the blade comes up to turn half a blow. Blows from behind, and snares, get through, and a heavy blow still shoves you back a step. You move slower while blocking.
- Shields work against thrown rocks and bolts too, and show raised in your hand in first person and on your arm in the follow view.

### v0.16 changelog, part 1: two hands, any combination (Mike 2026-11-05, "Y")
- Each hand holds what you choose: nothing, the sword, the crossbow or a torch, in any pair, feasible or not. Two torches, two swords, two crossbows, a sword and a crossbow.
- D-pad left changes what the left hand holds, D-pad right (or Q) the right hand. The bag has a Hands row: press a hand to change it. T, holding D-pad down or the torch button still lights a torch in the left hand and puts it out again.
- Each hand has its own button: LMB, RT or Fire is the right hand; RMB, LT or the left touch button is the left. A crossbow fires and a sword swings. A hand holding nothing (or a torch) aims the crossbow down the sights while you hold its button, as RMB always has.
- Two crossbows: R reloads both, at 2.2 times the time (4.4 s, the perfect-reload window still works). Each hand fires its own bolt. Two crossbows can't be aimed down the sights; it's hip fire only.
- Two swords: each hand cuts with its own button; press a hand again while its blade is mid-cut and the other blade cuts, so one button mashed alternates them.
- The crossbow only sways while you aim down the sights. From the hip the view holds still, and the bolt has a little spread instead.

### v0.15 changelog, part 14: barrels and crates (quad detail 4, Mike 2026-11-04, Graphics thread)
- Barrels, kegs and crates are now painted pixel-art cards that turn to face you and lean back a little toward a high camera, all one mesh (one draw call, two triangles each instead of 12 to 40). There are more of them where trade happens: crates by the shop counter, kegs at the inn door, barrels by the smithy.

### v0.15 changelog, part 13: rolling hills and drifting clouds (quad detail 3, Mike 2026-11-04, Graphics thread)
- Two rings of painted hill cards stand between the meadow and the mountains, and about thirty pixel-art clouds drift slowly across the sky. They are flat cards in three meshes, tinted by the time of day so they warm at dusk and darken at night.

### v0.15 changelog, part 12: fences along the paths (quad detail 2, Mike 2026-11-04, Graphics thread)
- Painted fence panels line the coach road and the lanes: split-rail, woven wattle hurdles and a whitewashed picket fence, each one flat painted panel, all in one mesh (one draw call). The posts block the way; gaps every few panels let you through, and they keep clear of the gate, the caravan and the buildings.

### v0.15 changelog, part 11: a fuller meadow (quad detail 1, Mike 2026-11-04, Graphics thread)
- About 2,600 more grass tufts across the meadow from one painted sheet of eight cards: short and tall grass, seed heads, clover, and daisies, buttercups, bluebells and poppies growing in patches of one kind. They are all one instanced mesh that sways in the wind, so they add one draw call, and the lower quality settings draw fewer of them.

### v0.15 changelog, part 10: cel-shaded characters (Mike 2026-11-04, Graphics thread "Sure!")
- Characters are lit in three flat steps (lit, half-shade, shade with a cool tint) from the sun instead of a smooth falloff, so they read like a drawn comic over their ink outlines. Faces stay smooth. It is one extra line in the shader, so it costs nothing on phones.

### v0.15 changelog, part 9: meeting Natalie (B50, Mike 2026-11-04)
- The first time you talk to Natalie, a short cinematic plays: black bars slide in to a wide frame over a shot of her by the library door, then narrow as the camera pushes in on her face, with her name on screen. Then her dialogue starts as usual.
- It plays once per profile. Any key, click, tap or pad button skips it. On Low power, or with reduced motion on, she goes straight to the dialogue box.

### v0.15 changelog, part 8: fighting Kavik in 3D (Mike 2026-11-04, "more like Tekken" + "All 6")
- Tap up or down to sidestep round the other fighter (hold up to hop, hold down to crouch). Straight moves miss someone who steps off their line; round kicks and sweeps track and still hit.
- The fight turns on the mat as you circle, and the camera swings round with it, always side-on, so the stick always means toward and away.
- Kavik sidesteps straight moves he sees coming, circles to get round you, and answers your sidesteps with round kicks and sweeps.

### v0.15 changelog, part 7: the goblin hunter's statue (B49, Mike 2026-11-04)
- A statue on the green, near the library, honours your most goblins beaten in one delve: your own figure in painted stone, sword arm raised, with a gold plaque giving the count. Beat your record and the statue takes your look of that day.
- Read the plaque (E) for the record and how many goblins you've beaten in all. Each profile keeps its own record.

### v0.15 changelog, part 6: deeper delves pay (B48, Mike 2026-11-04)
- Under the library, every new room you reach pays a crown per room of depth. The deepest room adds a 5-crown purse and a lore book you haven't read yet, and the chest now holds a lore book under its trinket. Each room pays once per seed, so walking the same dungeon again doesn't farm.
- Climbing out shows what the delve paid: new rooms, crowns and the books you found.

### v0.15 changelog, part 5: lore books as comics (B47, Mike 2026-11-04)
- A lore book with a comic shows a Comic button (or press C): the same story as panels, with caption boxes and speech bubbles beside the speaker's portrait. Text brings the words back. Your choice is kept for your profile.
- First comic: Natalie's Field Note, six panels. The art is placeholder cards for now; drawn panels drop into content/assets/comics/ (see its README). Every caption and line is quoted from the book's own text.

### v0.15 changelog, part 4: fighting Kavik, 3D-fighter rules (Mike 2026-11-04, "more like Tekken" + "All 6")
- Four limb buttons: left hand, right hand, left foot, right foot (keys U I J K, pad X Y A B, touch buttons). A direction held changes the move: about 25 of our own moves.
- Hold back to block highs and mids standing, down-back to block lows; highs whiff over a crouch. Both hands together throw, which beats a guard but whiffs on a crouch; press a hand in time to break it.
- Strings (jab into cross into heel or a low rake, and more), counter hits on a move as it starts, and moves that are unsafe on block: block one and hit back before the attacker recovers.
- Launchers pop the other fighter up for a juggle; heavy hits splat them on the walls at the edges of the mat. Hits flash and pause for a beat.
- Kavik uses the same moves: he guards high or low by what he sees coming, punishes, throws a guard, and breaks some throws.
- The shield bubble, dodge roll, double jump and ember bolt are gone.

### v0.15 changelog, part 3: pause menu on the right (Mike 2026-11-04, "Move esc. Pause menu to right")
- The Esc pause menu (Journal) now opens on the right side of the screen, like the station panels; a group's options open to its left. The controller status and version label move to the left while it's open.

### v0.15 changelog, part 2: bodies show strength (B46, Mike 2026-11-04)
- Strength and Endurance, 1 to 20, on the Tailor's Body tab. Strength fills out the shoulders, arms, chest and thighs: 20 looks like a bodybuilder, 2 frail and skinny. Endurance thickens the torso and waist. 10 is the body you had before.
- Townsfolk have their own strength and endurance, mostly near average with a few frail or burly ones. Your friends in a room see your build too.

### v0.15 changelog, part 1: play with friends (Mike 2026-11-04, "Make this game multiplayer!" + "Do it")
- Journal → Play with friends: host a room and share its 5-letter code or invite link, or join a friend's. Up to 4 players in a room; friends only, nobody finds a room without its code.
- Everyone in the room walks the same world: you see each other's characters, looks and name tags, walking, running, jumping, sitting, reading, aiming and swinging a sword, with a lit torch in hand and the pet that's with them following along.
- Say something with a preset phrase or a wave (no free typing): it shows in a bubble over your head on every screen.
- One sky for the room: when anyone sleeps, morning (or sunset, or night) comes for everyone. The host can remove a player.
- Phones connect straight to each other. Only your room name, look and moves are shared, and only with the room; your writing, saves, bag and quests stay on your device. A room button at the top of the screen shows the code and how many are in.
- On Low and Low power the background crowd thins a little for each guest, and players far away show only their name tag, so the frame rate holds.

### v0.14 changelog, part 17: pets 4, the pack (Mike 2026-11-04)
- Seven more dogs live around town, each its own breed and colours: Princess by the gallery, Milo by the smithy, Hot Dog by the scriptorium, Brandy by the library, Buster by the dojo, Peanut by the tailor, and Kona, a tiny big-eared chihuahua, by the inn.
- A giant hamster, dog-sized, lives by the cartographer. It takes sunflower seeds, now sold with the shop's sundries.

### v0.14 changelog, part 16: pets 3, a pet that helps (Mike 2026-11-04)
- The pet with you warns you when a goblin is near below: it stops, faces it and growls, hisses, hoots or rolls into a ball of spines.
- It sniffs out what's hidden near you, an unfound clue up top or an unopened chest below, and trots over to sit by it until you take it.

### v0.14 changelog, part 15: pets 2, the cat, the owl and Shadow (Mike 2026-11-04)
- Three more pets to befriend, one with you at a time: a grey tabby barn cat by the General Store (dried fish), a little owl on the grass by the Ruined Library that is only out from dusk (jerky; it flies at your shoulder), and Shadow, a giant hedgehog the size of a dog, snuffling by the campfire (mealworms). The store sells all their food.
- Talk to a pet you've befriended for the pets page: give it a name, tell it to stay or come, or call one of your others. Names are saved on this device.

### v0.14 changelog, part 14: more tabs for the shop and tailor (Mike 2026-11-04, "The extra tabs")
- The General Store has four tabs (Gear, Instruments, Sundries, Sell). The Tailor & Barber-Surgeon has nine (Who you are, Secret, Backstory, Body, Barber, Face, Tailor, Outfit, Surgeon). Every tab fits a phone at full text size again, with no scrolling.
- On a touch screen a panel's tabs sit in one row you swipe sideways, and the open tab stays in view.

### v0.14 changelog, part 13: pets, the farm dog (Mike 2026-11-04, "Add pets" + "Go")
- A farm dog waits outside the inn. Pet it and it wags. Give it some bread (the General Store sells it) and it is yours: it trots a step behind your right shoulder (Natalie keeps the left), runs when you run, finds its way round walls and carts, catches up if you get far ahead, follows you into the dungeon, sits when you stand still and noses about.
- Talk to it to tell it to stay, or to call it back. Who you've befriended, who is with you and where a waiting dog sits are saved on this device.

### v0.14 changelog, part 12: crossed-quad bushes (Mike 2026-11-04, Graphics thread)
- Meadow bushes are now crossed-quad cards like the trees: two or three upright cards each, from a pixel-art bush sheet painted in the game (five greens, a dark rim, some with red berries, white blossom or yellow flowers). One mesh for all of them; still walk-through.

### v0.14 changelog, part 11: phone panels shrink to fit again (Mike 2026-11-04, "Shrink to fit")
- Phones go back to B27: a tall station panel fits the screen without scrolling. On a touch screen its text steps down from 16px to 11px first, which keeps buttons full size, and then it zooms out, to no less than 0.6. Short panels keep UI 3's large text. The long shop and tailor end up at about 7px text on a phone.
- The caravan's answers stay at least 44px tall and 16px on screen when their panel is zoomed.

### v0.14 changelog, part 10: UI 3, larger text for phone (Mike 2026-11-04, Graphics thread)
- Text in the sheets is bigger: 16px body text on touch screens and 15px on PC. Titles are 1.5×, and small print and capitals are no smaller than 13px on a phone. Text boxes stay at 16px or more so iOS doesn't zoom in.
- On a touch screen a tall station panel now scrolls instead of shrinking its text to fit. PC keeps B27's fit-without-scrolling.
- New `test/e2e-readable.mjs` (11/11, PC, phone, phone sideways). `e2e-panels` lets the phone scroll.

### v0.14 changelog, part 9: UI 2, ribbon titles (Mike 2026-11-04, Graphics thread)
- Every sheet's title now sits on a green cloth ribbon with gold lettering, gold stitch lines and swallowtail ends. That covers the station panels, the pause menu's journal and groups, extras and dialog cards. Our own art, CSS only.
- The gold on green keeps 5.8:1 contrast.
- New `test/e2e-ribbon.mjs` (14/14, PC and phone). `e2e-parchment` skips text with its own fill.

### v0.14 changelog, part 8: UI 1, parchment panels (Mike 2026-11-04, Graphics thread)
- Menus and station panels (pause menu, shop, casebook, forges, cooking, skills, gear, dojo, caravan, campfire, extras and dialogs) are now parchment paper in a gold frame, with dark ink text. Our own art: CSS paper with an SVG grain, a gold double rule and a burnt edge. No image files, no GPU cost.
- Every text on the paper keeps at least 4.5:1 contrast. The title screen menu and the HUD keep their look.
- New `test/e2e-parchment.mjs` (11/11, PC and phone). `e2e-menus` now checks the parchment sheet instead of the old dark gradient.

### v0.14 changelog, part 7: town style 2, pixel-art town and lamp light (Mike 2026-11-04, Graphics thread)
- The town's buildings, roofs, doors, timber and street are pixel art now: each painted tile is cut to 32 pixels a metre with its own 6-colour palette, drawn with crisp pixels up close. The countryside keeps its painted look; the player and named NPCs are unchanged.
- From dusk every lantern throws a warm pool of light on the ground under it, drawn as pixel-art rings (softer at dusk, brighter at night). One draw call for all of them.
- New `test/e2e-town-pixel.mjs` (9/9).

### v0.14 changelog, part 6: town style 1, the sprite crowd (Mike 2026-11-04, Graphics thread)
- The town green fills up with a crowd of small 2D pixel-sprite townsfolk (44, 16 on Low), painted in 8 directions with 4 walk frames and 12 looks. They walk between the doors or stand and chat, turn the side that faces you, and dim with the hour like the 3D characters.
- One instanced draw for all of them plus one for their shadows (draw calls 202 → 204, same frame rate).
- Named NPCs and the player stay 3D.
- Fix: the 3D townsfolk no longer clip the Tailor's corner (their routes are densified and pushed clear of the buildings and the well).
- New `test/e2e-crowd.mjs` (11/11).

### v0.14 changelog, part 5: NPC lean (B42, Mike 2026-11-04)
- Goblin shooters use the same lean as the player. A ranged goblin that is in range but can't see you past a wall edge leans out from the corner, aims, and shoots from the lean, then leans back.
- Archers only back off from you when they can actually see you, so they hold a corner instead of drifting away.
- New `test/e2e-npc-lean.mjs` (6/6).

### v0.14 changelog, part 4: auto-lean (B41, Mike 2026-11-04)
- Aiming the crossbow with a wall edge just ahead leans you out past the edge, toward the open side. Your eyes, aim and view move about half a metre and the view tilts a little. Let go of aim, or move off, and you lean back in.
- Crouched behind low cover (the low walls), aiming rises you up to peek and shoot over it.
- It's automatic. Options > Gameplay > "Auto-lean" turns it off.
- The geometry is shared with NPCs (`src/lean.ts`). It's a few point tests a frame while aiming and nothing on the GPU.
- New `test/e2e-lean.mjs` (12/12).

### v0.14 changelog, part 3: your portfolio (B37, Mike 2026-11-04)
- Extras → Portfolio lists everything this profile made: your hero from the Tailor, your crossbow, sketches, ballads, margin notes, folklore and your theory.
- "Export portfolio" saves one page (`artheria-portfolio-<name>.html`) that opens in any browser and works offline. Pictures are inside it. Each piece's lore file is tucked under it, so it can also be sent in for review.
- "Postcard" on any piece saves a 1200×800 PNG, framed like a gallery plaque.
- Nothing is sent anywhere; you share the file if you want to. The work is in `src/portfolio.ts`.
- New `test/e2e-portfolio.mjs` (9/9).

### v0.14 changelog, part 2: buttons buzz on phones (Mike 2026-11-04)
- Every button you tap on a phone now gives a short buzz: menus, pause, panels, chips, toggles and sliders, as well as the touch HUD.
- iPhone Safari has no vibration API. On iOS 18 and later a tap now ticks the Taptic Engine through a hidden system switch, the one haptic a web page can reach on iPhone. Older iOS stays silent.
- Settings > Vibration still turns it all off. The work is in `src/input/haptics.ts`, plus one listener in `src/main.ts`.
- New `test/e2e-touch-haptics.mjs` (7/7).

### v0.14 changelog, part 1: your first day (B36, Mike 2026-11-04)
- A new profile gets a short guided first day that teaches the main loop: get up, write something at the Scriptorium, make something at the Tailor or the Smithy, then sit at the campfire.
- Natalie points the way. Her lines appear under the screen, and a gold marker floats over the next door. A small card in the top-left shows the step you're on ("First day · 2 of 4").
- Finishing the day earns 10 crowns. The casebook (J) lists the four steps and has "Skip the first day".
- It runs once per profile (B24). Profiles that already have a save don't get it. The work is in `src/quest/firstday.ts`.
- New `test/e2e-first-day.mjs` (10/10).

### v0.13 changelog, part 10: banded painted sky (graphics G5, Mike 2026-11-03)
- The sky is painted in soft flat bands, pale at the horizon and bluer toward the top, instead of a smooth airbrushed gradient. The band edges are soft and wave a little near the horizon, like brushwork. The sun's glow stays smooth. Dusk and night use the same bands in their own colours.
- It's per pixel in the sky dome's shader (the dome is drawn last, so only visible sky pixels pay).
- New `test/e2e-banded-sky.mjs` (3/3).

### v0.13 changelog, part 9: chunkier foliage (graphics G4, Mike 2026-11-03)
- Bushes are fewer and bigger: each is two or three fat lumps (a dark base with lighter tops), so they sit with the card trees. The triangle budget is about the same as before.
- Flowers are fewer, bigger clumps with three large flower heads each (cream, gold or pink) and a dark rim so they read from afar. Ferns are a little bigger and fewer.
- New `test/e2e-chunky-foliage.mjs` (3/3).

### v0.13 changelog, part 8: warm windows and lanterns at dusk (graphics G3, Mike 2026-11-03)
- Every lit window gets a soft warm glow from sunset (stronger at night), one instanced draw for all 26.
- The real lantern lights now come on at dusk too, at under half their night strength, so walls and paths by the lanterns warm up as the sun goes down. Lantern halos are a little brighter at dusk.
- Kept small on purpose: characters already take lantern and torch light since part 1 (B43).
- New `test/e2e-dusk-glow.mjs` (5/5).

### v0.13 changelog, part 7: ink outlines (graphics G2, Mike 2026-11-03)
- Characters, buildings and props get a thin dark ink line around their silhouettes, like the line on drawn sprites. It's about 1.6 px up close and thins with distance so far scenery doesn't turn to ink.
- It's the cheap "inverted hull": a back-faces-only copy pushed out along smoothed normals, no post pass, so it works on every preset. All town buildings and props share one outline mesh (one extra draw call; the camp has another), and each character has one skinned outline on its own skeleton.
- Walls opened by see-through (B45) open their outline too. Fog fades it.
- Options > Graphics > "Ink outlines" turns it off.
- New `test/e2e-ink-lines.mjs` (6/6).

### v0.13 changelog, part 6: painted ground (graphics G1, Mike 2026-11-03)
- The meadow, town grass and paths carry a broad layer of soft brush strokes: lighter warm patches and darker cool ones, at two crossing scales, so the ground reads as hand-painted instead of one repeating tile.
- Cost: one 256 px texture and two extra texture reads in the ground shader, on every preset.
- New `test/e2e-painted-ground.mjs` (3/3).

### v0.13 changelog, part 5: steady aim with the crossbow (B44, Mike 2026-11-03)
- With the crossbow in first person there's no crosshair. The aim (and the view with it) wanders with a slow drift and your breathing, body-cam style.
- Holding still fills a stability meter that calms it. Aiming down the sights steadies you fully in about 1.6 s; from the hip it only gets part way.
- Walking, jumping or turning fast drains it, and each shot's kick knocks it back to 30%.
- Bolts fly where the wandering aim points, plus a little spread when you're not steady.
- A ring in the middle of the screen tightens as you steady and turns gold when you're ready to shoot.
- There's no bow in the game yet; when one comes it can use the same sway. Push-up strength (B26) can scale it later.
- New `test/e2e-steady-aim.mjs` (10/10). `e2e-traits` now fires its goblin shot from a steady aim.

### v0.13 changelog, part 4: the camera leads where you walk (B39, Mike 2026-11-03)
- In the follow views (overhead and over the shoulder), the camera drifts up to 18° toward the side you're walking, so you don't have to keep steering it with the right thumb. It eases in over about half a second.
- It eases back to neutral when you walk straight on, stop, or turn the camera yourself. It's off in first person and at stations.
- It only moves the camera; your stick still moves you relative to the view you had, so it can never spin you in circles.
- Options > Gameplay > "Camera follows your walk": Touch and controller (default), Always, or Off.
- New `test/e2e-camera-lead.mjs` (10/10).

### v0.13 changelog, part 3: the camera sees through walls (B45, Mike 2026-11-03)
- The follow camera no longer pulls in when a building or prop is behind you. Walls, roofs, trees and props between the camera and you open up in a soft, dithered circle and close again once you've moved on.
- The ground, sky, mountains and characters are never cut. It's off in first person, at stations and in the dungeon (the dungeon camera still pulls in).
- On by default. Options > Gameplay > "See through walls" turns it off and brings back the old pull-in.
- The cut is a cone from the camera to your chest, added to each world material's shader (`src/render/seeThrough.ts`); the rig skips colliders when it's on (`src/camera/rig.ts`).
- New `test/e2e-see-through.mjs` (6/6).

### v0.13 changelog, part 2: iPhone performance pass (B38, Mike 2026-11-03)
- **Low power preset.** Render scale is 40%, fog closes in at 35 m, it's capped at 30 fps, there are no shadows or glow, fewer townsfolk and less undergrowth, and one real lantern light at night. iPhones and iPads start on it. It can be changed under Options > Graphics.
- **Off-screen characters.** Characters that are off-screen or past the fog aren't drawn or animated, on every preset. Skinned figures can't be frustum-culled by three, so each one is now checked per frame.
- **Far forest.** The far forest band is hidden whenever the fog would hide it anyway.
- **`?perf` readout.** Add `?perf` to the address, or set localStorage `gametool.perf` to `on`, to show fps, frame ms, CPU ms, draw calls, triangles and the preset. Use it to measure on a real phone.
- The iPhone name box Mike reported was the character form on first Begin, which was removed in PR #30. e2e-iphone checks for it and passes 12/12.
- New `test/e2e-lowpower.mjs` (8/8).

### v0.13 changelog, part 1: characters take torch and lantern light (B43, Mike 2026-11-03)
- Characters keep their painted shading, but the hour now dims and tints them. They're full colour by day, warmer and darker at sunset, and dim blue at night, so they sit in the scene instead of glowing.
- Nearby point lights brighten them: your torch, the campfire, the town lanterns and the dungeon torches.
- This covers the player, townsfolk, standees, Kavik, goblins and loaded models, and their drawn faces too.
- The work is in `figureMaterial` / `figureLight` in `src/world/figure.ts`, a Lambert material that keeps only the point-light term. The sky sets the hour's tint.
- New `test/e2e-npc-light.mjs` (4/4): every character uses the lit material, the hour dims them, and a torch at night brightens a character beside it.

### v0.12 changelog: controller everywhere (B40, Mike 2026-11-03)
- **Every panel works with a controller.** This covers the stations and forges, the tailor, the shop, the cinema, the dojo, gear care, cooking (also when it's opened at the campfire), the map, the journal, the Skills, Phrasebook and Recipe books, the library wiki, the DM view, the gallery, the sketchbook and the lore editor.
  - The D-pad or a left-stick flick moves to the nearest control in that direction, and repeats while held.
  - A presses the control. On a text box, A gives it the focus so the system keyboard can type.
  - Left and right change a slider or a list.
  - B or Start leaves through the panel's own Close, Leave or Done button. In a text box, the first B puts the pen down.
  - The control the controller is on is always outlined.
- **Margin notes:** in an open book, Y picks up the pen. The desk then works like any other panel.
- **Gear care:** hold A to lift the blade while sharpening, the same as holding Space.
- **Character forge:** the right stick turns the hero, the same as at the weapon forge.
- **Map from the controller:** hold View or Create for 0.4 s. A tap still opens the bag.
- **Touch:** a ⇄ button next to 🎥 swaps the shoulder. It shows only in the shoulder view.
- The Kavik fight keeps its own controller layout (v0.11 part 6). The panel controls stay out of it.
- Code: `src/input/padnav.ts`, plus the panel hooks in `src/input/gamepad.ts` and `src/main.ts`. Test: `test/e2e-gamepad.mjs`.

### v0.11 changelog, part 7: every tree is a card (Mike 2026-11-03, "Trees are still 3D")
- The card-tree change (#57) only replaced the far forest. The 95 meadow trees and the horizon ring were still 3D trunks and leaf clumps.
- Every tree in the meadow and the horizon ring now uses the same crossed cards (`src/world/index.ts`, `cardTree` / `cardMesh` in `src/world/treeCards.ts`), merged into one mesh. Each meadow tree keeps a trunk collider.
- Bushes and ivy stay as low-poly leaf clumps.
- Fix from B35: Kavik used to stand in front of the dojo door, so his "Spar with Kavik" target covered "Enter the Dojo". He now stands beside the doorway.

### v0.11 changelog, part 6: controller in the Kavik fight (Mike 2026-11-03)
- The fight now works on a gamepad:
  - The left stick or D-pad moves and aims.
  - A is attack, B special, Y jump and X grab.
  - Any shoulder button or trigger holds the shield.
  - Start leaves the mat.
- On the result screen, A is a rematch and B leaves.
- With a pad in use, the controls line shows the pad buttons.
- The A press that starts the fight doesn't count as an attack.
- `test/e2e-fight.mjs` has 6 new pad checks (21/21).

### v0.11 changelog, part 5: fighter mode vs Kavik (B35, Mike 2026-11-03)
- **Spar with Kavik** at the dojo. It's a 1v1, side-on on the mats, with health bars, a 60 s clock and best of 3 rounds.
- **Moves:** one Attack button and one Special button, each by direction, plus a shield and a grab. All the moves are our own.
  - Attack: Quick Cut (neutral), Stepping Slash (side), Rising Arc (up), Low Sweep (down).
  - Special: Ember Bolt (neutral), Comet Dash (side), Updraft (up), Still Water (down, a counter).
  - Shield blocks; shield plus a direction rolls away. The Shoulder Throw grab beats a shield.
- **Kavik's AI** is a small state machine: approach, poke, block, punish, anti-air, back off. He goes easy until you win your first match. After that he fights fair for good: he blocks, anti-airs and punishes some whiffs, and he reads button-mashing. He still reacts with a human delay and leaves openings after his attacks.
- **Rewards:** 25 crowns for the first win, then 5 per win. The save keeps your record (`gametool.fight`).
- **Controls:**
  - Keyboard: A D move, W S aim up or down, Space jump, J attack, K special, L shield, I grab, Esc leaves.
  - Touch: a stick on the left, with Attack, Special, Shield and Jump on the right.
  - No gamepad support in this mode yet.
- Code: `src/fight/` holds the engine, the AI and the screen. Test: `test/e2e-fight.mjs`.

### v0.11 changelog, part 4: more animations (B34, Mike 2026-11-03)
- New one-shot moves layered over whatever a figure is doing:
  - **Wave:** NPCs wave hello when you come near (once a minute each), and you wave when you start a conversation.
  - **Pick-up:** a crouch and reach when you take the sword from its stand, pick up a bolt or open a chest below.
  - **Hit:** a flinch when something hits you in the dungeon.
- **Idle fidgets:** figures standing still look round, stretch or shift their weight every 8 to 18 s.
- **Sit:** stand still in the world for 25 s and you sit down on the ground. Any move gets you up.
- Test: `test/e2e-animations.mjs`.

### v0.11 changelog, graphics: crossed-quad trees (Mike 2026-11-03)
- The hills' forest is now card trees on every preset: each tree is two or three upright cut-out quads crossed through the trunk, standing in loose clusters of two to five. Eight cards from 99.Miles' Low Poly Forest Tree Pack (CC BY 4.0, still credited) are baked side-on into one 512 px sheet (`src/art/trees/tree-cards.png`, by `scripts/bake-tree-cards.mjs`).
- `public/models/forest-trees.glb` (2.1 MB) no longer ships. The whole forest is one mesh and one draw call, and it shows on `file://` pages too.
- Tests: `test/e2e-references.mjs` checks the card forest.

### v0.11 changelog, graphics: the witch's drawn face (Mike 2026-11-03)
- The Witch (the Quaternius model) now has a drawn face like everyone else, with blinks and expressions, on a face quad on her head bone. Her baked-in eyes are hidden. She uses the hero's sheet until Mike draws hers (`src/art/heads/`).
- Any .glb slot can do the same with a `face` entry (`src/models.ts`, `drawnFace`).
- Test: `test/e2e-witch-face.mjs`.

### v0.11 changelog, graphics: pixel shadows (Mike 2026-11-03)
- Shadows are hard-edged and chunky: the sun's shadow map is 512 px (was 2048) with no soft filtering, so edges step in visible pixels. Shadows are on by default on High (Pause > Graphics > Shadows on any preset).

### v0.11 changelog, part 3: wake-up intro (B31, Mike 2026-11-03)
- Begin and Continue now go black, then fade in on your character getting up: lying down, a stretch, sitting up, then standing. It takes two seconds, and any key, click, touch or pad button skips it.
- A new game wakes in the inn's new guest bed, under the jetty by the door. Continue wakes where you last slept: the bedroll if that was at camp, otherwise the inn. The save remembers it.
- Test browsers skip the intro unless `localStorage gametool.waketest = 'on'` (like the coach), so the other suites still start at the glade.
- Test: `test/e2e-wake.mjs`.

### v0.11 changelog, part 2: touch buttons cancel on slide-off (B32, Mike 2026-11-03)
- A finger that presses a touch button and slides off it no longer triggers it. Map, Journal, Menu, Bag, the perspective and quick-equip buttons (crossbow, sword, torch) and Use now act when the finger lifts, and only if it is still over the same button.
- Jump, Sneak, Sprint, Fire, Aim and Reload still act the moment they're pressed.
- A finger that starts on the move stick or the look area can never press a button by sliding onto it.
- A touch after a key press brings the touch buttons back (before, they stayed hidden until the next Begin).
- Test: `test/e2e-touch-slide.mjs` (real touch input: slide-off cancels, lift-over acts, instant buttons, stick finger).

### v0.11 changelog, part 1: smooth animation (B33, Mike 2026-11-03)
- Characters animate smoothly: poses update every frame. The 12 fps stepped "flipbook" look from restyle S2f is gone.
- Test: `test/e2e-rebuild.mjs` checks the running legs move on every frame.

### v0.10 changelog, part 5: review fixes, optional round (code tidy, no change in play)
- 117 exports used only inside their own file are now private, and four unused constants are gone (`LAYERS`, `ANIM_STATES`, `HIPS_AT`, `panelTab`).
- Saving to the browser goes through one helper (`src/store.ts`, `storeSet`) instead of 28 copies of the same try/catch.
- This changelog's top heading says what it is: live builds 0.03 to 0.10, not "Unreleased".
- `docs/rebuild-plan.md` is marked historical.
- The town-life test gives a second game up to 90 s to boot (it reopens the game with an old save, and on a slow machine 30 s wasn't always enough).

### v0.10 changelog, part 4: review fixes, round 3 (tests and CI)
- Every suite now runs in CI: the new **Full e2e** workflow (`.github/workflows/e2e-full.yml`) splits `test/suites.json` across four parallel jobs, nightly, on demand, and on PRs labelled `full-e2e`. The quick smoke test still runs on every PR.
- `npm run test:e2e` runs `scripts/e2e-run.mjs`: one list (`test/suites.json`), a summary at the end, `--only` and `--shard`.
- Suites named after old roadmap steps are named after what they test: `e2e-settings-audio` (was v0.02), `e2e-world-controls` (v0.03), `e2e-dialogue-inventory` (v0.04), `e2e-crossbow` (v0.05), `e2e-library-books` (v0.06), `e2e-shop-ceilings` (v0.06-part4).
- Five timing-sensitive checks (crossbow fire, perfect reload, bolt pickup prompt, hands, camera toggle) wait for the game's next frame instead of a fixed pause, which could be shorter than one slow frame under software rendering.

### v0.10 changelog, part 3: review fixes, round 2 (code only, no change in play)
- Every station panel registers itself (`src/stations.ts`), and "close everything" closes them newest first, so a new station can't be left out.
- `main.ts` slimmed by about 200 lines: the page's static markup is in `src/ui/shell.ts`, the controller map in `src/input/padmap.ts`, the town soundscape (ambience zones, townsfolk voices) in `src/world/soundscape.ts`, and the cinema screen and Projectionist in `src/world/cinema-spot.ts`.

### v0.10 changelog, part 2: review fixes, round 1 (Mike 2026-11-02, "Run all")
- Dev tools: Vite pinned to 5.4.21 (fixes the high-severity dev-server advisory in 5.4.11). The game itself was never affected. A moderate esbuild advisory remains for the dev server only; it needs a Vite major upgrade.
- Credits: MediaPipe Pose Landmarker and Tasks Vision (Google, Apache-2.0) are in Extras → Inspirations → Asset credits, the README and `public/models/CREDITS.md`.
- One version number: `package.json` is now `tales-of-artheria` 0.10.0, and the build stops if it and `src/version.ts` disagree.
- README brought up to date (v0.07–v0.10 features, controls, credits).

### v0.10 changelog: camera push-up counter (B26, Mike 2026-11-01)
- The dojo has a new **Push-ups** drill. Your character does push-ups on the mat, and you follow along. Knees down is the beginner version and counts the same.
- **📷 Count with camera** (opt-in): MediaPipe Pose Lite watches you through the phone or laptop camera and counts each rep. A rep is the elbow bending past about 95° and then straightening past about 150°, using whichever arm the camera sees better. Reps less than 0.4 s apart are ignored.
- While the camera is on, a small preview with a skeleton overlay and a red **● Camera on** pill sit in the top-left corner. The camera turns off when you press Stop camera, switch drills or leave the mats.
- Everything runs on the device. No frame is recorded or sent anywhere.
- The pose library, its WebAssembly and the model (about 15 MB) ship beside the page in `dist/pose/`. They're only downloaded the first time someone turns the camera on, so the game itself is no bigger.
- If the camera is refused or missing, the panel says so and **Rep done** still works.
- Today's reps, your best day and your all-time total are kept in your profile. They're shown under the drill and on a new **Push-ups** card in the Skills book, which you earn by finishing the drill once.
- The dojo camera is reframed for the right-hand panel, so the plank and push-ups are in clear view.
- Test: `test/e2e-pushups.mjs`. With `POSE_REAL=1` it also loads the real model in Chromium.

### v0.09 changelog, part 4: Tailor & Barber-Surgeon (B22, Mike 2026-11-01)
- The tailor is now the **Tailor & Barber-Surgeon**: on its sign (two lines), at its door and on the DM map.
- Its station (also the camp mirror) has five tabs:
  - **Who you are:** name, what they want most, one true thing only you know, the backstory and the constraint dice. The old pop-up "Who are you?" form is folded in here and gone.
  - **Body:** species, height, build, skin.
  - **Barber:** hair style and colour, eyes.
  - **Tailor:** clothes and colours, coat tails, dress, boots, wings, headpiece.
  - **Surgeon:** markings, plus the surgeon's first-aid card (the Skills book's card with its safety line).
- Journal → Who you are, and Gameplay → Who you are, open the Tailor & Barber-Surgeon on its "Who you are" tab. Done returns you to the Journal.
- It's still free, and first-time creation is still optional: Begin goes straight into the game.
- Test: `test/e2e-tailor.mjs`.

### v0.09 changelog, part 3: dialogue portraits (B30, Mike 2026-11-01)
- In a conversation, the speaker's portrait stands on the left of the dialogue box, Ren'Py style, with the name tag beside it. It scales with the screen, smaller on a phone.
- There's no art yet, so each speaker gets a drawn placeholder card: a silhouette, their initial and name, in a colour of their own.
- To add art, drop `assets/portraits/<speaker>.png` (or `.webp` / `.jpg`; 512x640, head and shoulders) and rebuild. Speakers today are `natalie` and `pedlar`.
- Expressions: `<speaker>-<mood>.png`, picked by `"mood"` on a dialogue line. A mood without a file falls back to the plain portrait. `assets/portraits/README.md` has the details.
- Portraits ship beside the page (`dist/portraits/`) like the cinema reels. The list is baked in, so the game never asks for a missing file.
- Test: `test/e2e-portraits.mjs`.

### v0.09 changelog, part 2: touch controls (B28, Mike 2026-11-01)
- The camera − / + buttons at the top are gone. In their place:
  - **🎥 Change perspective**, the only button that changes the view. It cycles first person, over the shoulder and overhead.
  - **Quick-equip buttons:** 🏹 crossbow, 🗡 sword and 🔥 torch. Tap one to take it in hand, and tap it again to put it away. The one in hand is lit, and an item you don't own yet is dimmed.
- The old "View" button by Jump is now **Bag** (your inventory). The Bag button that sat at the top right is gone, so there's only one.
- No more drag-to-zoom on touch: dragging on the right of the screen only turns you. It used to zoom the camera, which fought the move stick.
- The gamepad and mouse are unchanged.
- Test: `test/e2e-touch-hud.mjs`.

### v0.09 changelog, part 1: station panels on the right, all on one screen (B27 + B29, Mike 2026-11-01)
- Every station's side panel now sits on the **right** of the screen: the forges, campfire, camp kitchen, dojo, caravan, skills table, grindstone, store, sketchbook and the Journal pages. The camera's view slides over by the panel's width, so the station stays in the open space on the left. A phone held upright still has the panel along the bottom.
- The panels are compact. Type, spacing and buttons follow the screen height, so everything shows at once without scrolling, on a 720p screen and on a phone held sideways.
- Panels made of several groups show one group at a time under a row of tabs, and remember the open tab:
  - Character forge: Species, Body, Face, Hair, Outfit, Extras, Story.
  - Weapon forge: Stock, Limbs, Fittings, Story.
  - Campfire telling: Your tune, Tell it to the bard.
- With one campfire item open, the others shrink to a row of icons above it.
- The store's sundries sit in two columns.
- On a short screen, labels sit beside their text boxes, and the tune grid goes flat.
- If a panel still runs past the bottom, it scales down to fit (to 70% at most) before it would scroll.
- Text boxes keep 16 px type, so an iPhone doesn't zoom in when you type.
- Test: `test/e2e-panels.mjs` checks every station, and every tab, for scrolling at 1280x720 and 844x390.

### v0.08 changelog, part 4: DM view (B20, Mike 2026-11-01)
- Add `?dm` to the game's address to open the DM view. It's a planning tool over the game, not part of play, and it sits behind a passphrase. The code holds only the phrase's SHA-256 hash. This keeps it out of players' way; it is not security, since the site and its code are public.
- Part III (the DM-private lore) is never loaded or shipped.
- **Map:** a top-down plan of the glade and town (the library, the nine town buildings, the fountain). Click to drop pins: NPC, door, dungeon seed (rolled automatically), kit piece or note. Each pin gets a label, position and notes.
- **Quest graph:** dialogue and quest nodes drawn as a graph. Each node has a line, a "then" link or choices, and actions (one per line: `give:item:n`, `crowns:n`, `flag:name`, `unlock:door`, `quest:start`). A choice can carry a condition (`has:crossbow`, `flag:x`), drawn as a dashed link. Drag nodes to arrange them, link them, and set the start node. "Load from the game" opens Natalie's real dialogue as a graph.
- Everything saves on this device, outside the player profiles. "Export JSON" writes the pins, every graph, and each graph in the game's own dialogue format (`content/dialogue/*.json`) for merging by hand. "Import…" restores an export.
- Test: `test/e2e-dm.mjs`.

### v0.08 changelog, part 3: cooking (B18, Mike 2026-11-01)
- The campfire has a new item: Cook. "Cook a meal" opens the camp kitchen over the fire. A kitchen-safety note comes first: cook for real only with an adult, wash your hands, and check for allergies.
- There are three real recipes, simple enough to cook at home: lentejas (lentil soup, la cocinera's from the caravan), pan flatbread, and baked apples.
- Each recipe takes three stages:
  - **Prep:** tap the steps in order. A step out of order gets a hint.
  - **The fire:** pick the heat (embers, steady flame, roaring) and take the dish off when the doneness bar is in the gold band. Too hot and it burns; the note says what heat the dish wants and why.
  - **Finish:** season it or let it cool.
- Every recipe has its own safety line.
- Eating it with the camp gives a small buff, one meal at a time:
  - Lentejas are **Hearty**: your next trip below starts with 3 extra hearts.
  - Flatbread makes you **Light on your feet**: 10% faster for 3 minutes.
  - Baked apples leave you **Well fed**: goblin hits do 1 less damage on your next trip below.
- Cooking a recipe the first time pays a few crowns.
- Journal → Recipe book writes out every recipe you've cooked in full: ingredients, method and safety. "Write your own recipe" turns yours into a lore file to submit.

### v0.08 changelog, part 2: gear care (B17, Mike 2026-11-01)
- Gear now wears with use, and never breaks. Each sword hit dulls the edge a little. Fighting with the sword below the library leaves the blade spotted with rust. Every bolt you loose frays the crossbow string.
- Worn gear does less. A dull or rusty sword cuts for less, down to 1 a hit, and a frayed string throws bolts slower (the ammo line says "string frayed"). It shows on the sword: the steel turns grey when dull and brown when rusty, and the bright edge line goes.
- The smith keeps a grindstone outside the smithy: "Care for your gear". A knife-safety note comes first. Then there are three jobs:
  - **Sharpen:** eight strokes on the whetstone. Hold Lift (or Space) to keep the blade's angle in the gold 15–20° band; let go and it tips flat. Each clean stroke brings the edge back.
  - **Clean and oil:** tap the steps in order to take the rust off.
  - **Restring the crossbow:** tap the steps in order to get full power back.
- Doing all three once earns the Gear care card, with real sharpening, oiling and bow-string basics, plus a few crowns. Journal → Skills book shows it. The living map marks the grindstone.

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
