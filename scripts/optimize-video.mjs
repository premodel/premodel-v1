// Compress video(s) with ffmpeg and upload to Vercel Blob, recording each in
// video-manifest.json (committed). Used two ways:
//   • now, on the existing referenced videos in images/
//   • by the GitHub Action, on new videos dropped into media-src/ (push-to-deploy)
//
// Each video is keyed in the manifest by how the page references it:
// "images/<name>.mp4". The build (build.mjs) swaps those references for the Blob
// URL, so no .mp4 is ever served from Vercel itself.
//
// Usage: node scripts/optimize-video.mjs <file.mp4> [more.mp4 ...]
// Token: BLOB_READ_WRITE_TOKEN from env (the Action) or .env.local (local runs).

import { put } from '@vercel/blob';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

function getToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(/BLOB_READ_WRITE_TOKEN\s*=\s*"?([^"\n]+)"?/);
    if (m) return m[1].trim();
  }
  throw new Error('BLOB_READ_WRITE_TOKEN not set (env or .env.local)');
}

const MANIFEST = 'video-manifest.json';
let inputs = process.argv.slice(2);
if (!inputs.length) {
  // Local convenience (`npm run video` with no args): process every raw in
  // video-raw/. That folder is git-ignored, so large originals never enter git
  // — they go straight to Blob from here. The GitHub Action always passes
  // explicit media-src files, so this default never affects CI.
  const dir = 'video-raw';
  inputs = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.mp4')).map((f) => path.join(dir, f))
    : [];
  if (!inputs.length) {
    console.error('No input videos. Pass file paths, or drop .mp4s in video-raw/ and re-run.');
    process.exit(1);
  }
}

const token = getToken();
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

for (const input of inputs) {
  const name = path.basename(input).replace(/\.[^.]+$/, '') + '.mp4';
  const tmp = path.join(os.tmpdir(), `pmvid-${name}`);
  // Web-optimized H.264: cap at 1280px wide, drop audio (muted autoplay loops),
  // faststart for streaming, yuv420p for universal playback.
  execFileSync(
    'ffmpeg',
    ['-y', '-i', input,
     '-vf', "scale='min(1280,iw)':-2",
     '-c:v', 'libx264', '-crf', '26', '-preset', 'medium',
     '-movflags', '+faststart', '-an', '-pix_fmt', 'yuv420p', tmp],
    { stdio: 'ignore' },
  );
  const buf = readFileSync(tmp);
  const blob = await put(`videos/${name}`, buf, {
    access: 'public',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'video/mp4',
  });
  const origBytes = readFileSync(input).length;
  manifest[`images/${name}`] = { url: blob.url, bytes: buf.length };
  console.log(`images/${name}: ${(origBytes / 1048576).toFixed(1)}MB -> ${(buf.length / 1048576).toFixed(1)}MB  ${blob.url}`);
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${MANIFEST} (${Object.keys(manifest).length} videos total)`);
