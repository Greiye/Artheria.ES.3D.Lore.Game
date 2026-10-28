# Cinema reels

Short clips by Mike and friends, shown by the Lanternist in town (v0.04).

- Drop a clip here as `name.webm` (preferred: small, plays everywhere but older iPhones) and, if you like,
  `name.gif` with the same name as the fallback. `name.mp4` also works.
- Sound is optional; clips start muted and the viewer can turn sound on.
- Titles and credits (optional) go in `clips.json`:

```json
{ "first-session": { "title": "The First Session", "credit": "Mike", "sound": true } }
```

Without an entry the file name becomes the title. Keep each clip short (under ~20 s, under ~5 MB): the site is
public and phones download it on demand. Only clips you own or have permission to share.
