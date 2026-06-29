# video-raw — large videos go straight to Blob from here

For big originals (anything that would blow past GitHub's 100MB push limit),
**don't** put them in `media-src/`. Drop them here instead and run one command.
Nothing in this folder (except this README) is ever committed.

## One-time setup
Create `.env.local` in the repo root with the Blob token:

```
BLOB_READ_WRITE_TOKEN="<token>"
```

Get the token from the Vercel dashboard → Storage → the Blob store → tokens.
(It's the same value as the `BLOB_READ_WRITE_TOKEN` GitHub Actions secret, but
GitHub won't show a secret again after it's set, so copy it from Vercel.)

Then make sure deps are installed once: `npm install`.

## Each video
1. Drop the raw file here, e.g. `video-raw/hero-reveal.mp4`.
2. Run:
   ```
   npm run video                       # processes every .mp4 in video-raw/
   # or target one file:
   npm run video -- video-raw/hero-reveal.mp4
   ```
   This compresses it (1280px wide, no audio, web-optimized H.264), uploads it to
   Vercel Blob, and records it in `video-manifest.json` — keyed as
   `images/<name>.mp4`.
3. Reference it in the markup as **`images/<name>.mp4`** (the build swaps that for
   the Blob URL).
4. Commit only `video-manifest.json` + your markup change, and push. No raw,
   no large blob, no LFS.

You can delete the raw from this folder afterward; it's already on Blob.

## When to use media-src/ instead
Small clips (well under 100MB) can still go the simple route: drop in
`media-src/`, reference as `images/<name>.mp4`, and push — the "Optimize videos"
GitHub Action handles them. Use `video-raw/` + `npm run video` whenever the raw
is too big to push.
