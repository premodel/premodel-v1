# Adding images & video

Media is optimized automatically. You don't run any tools — you add a file,
reference it, and push. Here's what happens and what you do.

## Images — fully automatic

1. Drop the image into `images/` (any name, `.png`/`.jpg`).
2. Reference it the normal way:
   - a normal image: `<img src="images/your-photo.jpg" alt="...">`
   - a gallery/case-study image: add it to that slide's `data-images` list
     (e.g. `{"src":"images/your-photo.jpg","alt":"..."}`)
3. Push.

On deploy, the build generates AVIF + WebP at multiple sizes and serves the
smallest one each visitor needs. Nothing else to do. Your original file stays
untouched as the fallback.

## Video — drop it in `media-src/`, push

Videos can't be optimized in the deploy build, so a GitHub Action handles them.

1. Put the raw video in **`media-src/`** (e.g. `media-src/hero-reveal.mp4`).
2. Reference it in the markup as **`images/<name>.mp4`** (same base name), e.g.
   `images/hero-reveal.mp4`. (There's no real file there — the build swaps it for
   the hosted URL.)
3. Push.

On push, the **Optimize videos** Action compresses it with ffmpeg, uploads it to
Vercel Blob, records it in `video-manifest.json`, and deletes the raw. The build
then serves it from Blob. **It takes ~1–2 minutes after your push** for the
Action to finish and the video to appear — so on a PR, wait for the preview to
refresh before reviewing the video.

One-time setup (already done): the Blob token is a GitHub Actions secret named
`BLOB_READ_WRITE_TOKEN`.

### Example A — a reveal video in the hero carousel
Each hero card is a `.flip-card`. The video lives in the front face like this
(copy an existing card and swap the file names):

```html
<video class="hero-frame active hero-frame--video" data-state="0"
       muted loop playsinline preload="metadata"
       poster="images/hero-reveal-poster.png">
  <source src="images/hero-reveal.mp4" type="video/mp4">
</video>
```
- `media-src/hero-reveal.mp4` → the raw video (Action handles it).
- `images/hero-reveal-poster.png` → a still frame shown before play; drop it in
  `images/` like any image (it gets optimized automatically).

### Example B — a VR clip in a gallery/case-study modal
Add an entry to that slide's `data-images` list with `"type":"video"`:

```html
data-images='[
  {"src":"images/your-vr-clip.mp4","alt":"VR Walkthrough","type":"video"},
  {"src":"images/your-render.png","alt":"Final"}
]'
```
Put `media-src/your-vr-clip.mp4` (raw) and push.

## The push/merge flow (same as any change)
1. Create a branch, make your changes, push.
2. A Vercel **preview URL** appears on the pull request — check it there.
   (For video, give the Action ~1–2 min, then reload the preview.)
3. Merge to `main` → it goes live on the staging site.

If anything looks off, ping the team — but you shouldn't ever need to manually
compress or upload anything.
