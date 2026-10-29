# Cinema reels

Short clips by Mike and friends, shown by the Projectionist (a placeholder NPC) in town (v0.04).

- Reels are **WebM only** (v0.06) and always loop, so make the last frame flow into the first.
- Drop a clip here as `name.webm`. Other formats (GIF, MP4) are ignored.
- Sound is optional; clips start muted and the viewer can turn sound on (set `"sound": false` for silent reels).
- Titles and credits (optional) go in `clips.json`:

```json
{ "first-session": { "title": "The First Session", "credit": "Mike", "sound": true } }
```

Without an entry the file name becomes the title. Keep each clip short (under ~20 s, under ~5 MB): the site is
public and phones download it on demand. Only clips you own or have permission to share.

`sample-reel.webm` is an in-house placeholder title card so the cinema is never empty; delete it (and its
`clips.json` entry) once real reels arrive.
