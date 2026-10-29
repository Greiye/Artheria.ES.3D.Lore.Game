# Hand-drawn faces

Since 2026-10-29 every character has realistic proportions and a low-poly 3D head. Its face is drawn and sits on
the front of the skull as two strips, eyes over mouth, each swapped on its own like Mega Man Legends' face textures
(the DokiBird method from the references review: separate eye and mouth sheets need far fewer frames than whole
faces, and blinking and talking combine with any expression). Drop sheets here and rebuild; they're inlined into
the game. A character uses them when its look has `art: '<id>'` (heroine = default player, hero, natalie, pedlar).
Without art, the face is drawn in `src/render/headArt.ts`. Templates and starters are in `art-templates/`.

| File | What |
| --- | --- |
| `<id>-eyes.png` | Eye strip sheet: both eyes and brows (and freckles). One row per eye state. |
| `<id>-mouth.png` | Mouth strip sheet: mouth and blush. One row per mouth state. |
| `<id>-face.png` | Or a whole-face sheet (the older format): the game cuts each cell into the two strips. |
| `<id>-{eyes,mouth,face}.json` | Optional Aseprite sheet data (File > Export Sprite Sheet > Output > JSON Data). |

**Strip sheets** (`art-templates/eyes-template.png`, `mouth-template.png`; starters drawn from the game's own face in
`art-templates/starters/drawn-eyes.png`, `drawn-mouth.png`): 48 px wide; eye rows 31 px tall, mouth rows 17 px.
Bigger is fine if the proportions hold (96 px wide: 62 and 34). Without JSON the rows are, in order:

- eyes: `open`, `blink`, `happy`, `angry`, `surprised`, `sad`, `wink`, `half`
- mouth: `neutral`, `smile`, `frown`, `open`, `grit`, `talk-a`, `talk-b`

With JSON, each Aseprite tag names a row (its first frame is used). Missing rows fall back to the first.

**Expressions** (6): `neutral` (open + neutral), `happy` (happy + smile), `angry` (angry + grit), `surprised`
(surprised + open), `sad` (sad + frown), `wink` (wink + smile). The game blinks every 2–5 s and alternates
`talk-a`/`talk-b` while a character talks, on top of whatever expression it shows. Code sets one with
`root.userData.expression = 'happy'`.

**Whole-face sheets** (older): 96×104 px cells as in `art-templates/face-template.png`, rows `neutral`, `blink`,
`talk-a`, `talk-b` (or Aseprite tags, which may also name the six expressions). The game shows the middle 48×48 px
of each cell (x 24–72, y 22–70); the eye strip is its top 31 px, the mouth strip the bottom 17.

**Format:** PNG, indexed colour (Aseprite: Sprite > Color Mode > Indexed) keeps each sheet a few KB.
Don't use lossy WebP (it smears pixels).
