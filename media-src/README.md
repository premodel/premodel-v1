# media-src — drop raw videos here

Put a raw video file here (e.g. `hero-reveal.mp4`) and push. The "Optimize
videos" GitHub Action will compress it, upload it to Vercel Blob, record it in
`video-manifest.json`, and delete the raw from here automatically.

Reference it in the page markup as `images/<name>.mp4` (e.g.
`images/hero-reveal.mp4`) — the build swaps that for the Blob URL. No `.mp4` is
ever served from Vercel itself.
