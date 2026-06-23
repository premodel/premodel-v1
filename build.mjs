// Production build: turns the device-preview prototype into the clean public site.
//
// The prototype is a mobile design inside a JS-scaled device-preview harness.
// "bare" mode already renders the frame full-bleed (width:100%, height:100dvh,
// no scale) and `fitFrames()` skips scaling when bare — so the public site is
// simply the page loaded in bare mode from the start, with the review chrome,
// Layout B, and the brand-token tooling stripped/hidden.
//
//   • default      → clean public site (Layout A, light + oxblood, full-bleed)
//   • ?test        → restores the reviewer harness (toolbar + device sizing) so
//                    Ashley & Paige can review at set breakpoints
//
// Output goes to dist/ (served by Vercel). Source files stay untouched.

import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { transform } from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';
import sharp from 'sharp';

// Single-thread each sharp op so the JS-level pool below controls parallelism
// without oversubscribing cores.
sharp.concurrency(1);

const DIST = 'dist';

// Responsive image variants. Each raster in images/ gets AVIF + WebP at these
// widths (never upscaled) so srcset can serve the smallest sufficient file.
const IMG_WIDTHS = [400, 800, 1200, 1600, 2000];
const RASTER = /\.(png|jpe?g)$/i;
// node_modules/.cache persists across Vercel builds, so unchanged images (keyed
// by content hash) skip re-encoding and deploys stay fast.
const IMG_CACHE = 'node_modules/.cache/pmimg';

async function buildResponsiveImages(srcDir, outDir) {
  mkdirSync(IMG_CACHE, { recursive: true });
  const files = readdirSync(srcDir).filter((f) => RASTER.test(f));
  const manifest = {};
  const tasks = [];
  let origBytes = 0;

  // Plan every (image, width, format) variant up front, then encode in parallel.
  for (const file of files) {
    const buf = readFileSync(path.join(srcDir, file));
    origBytes += buf.length;
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12);
    const base = file.replace(RASTER, '');
    const meta = await sharp(buf).metadata();
    const origW = meta.width || 0;
    const widths = [...new Set(IMG_WIDTHS.filter((w) => w < origW).concat(origW))].sort((a, b) => a - b);
    manifest[`images/${file}`] = { base, widths, formats: ['avif', 'webp'], fallback: `images/${file}`, w: origW, h: meta.height || 0 };
    for (const w of widths) {
      for (const fmt of ['avif', 'webp']) {
        tasks.push({ buf, w, fmt, cacheKey: path.join(IMG_CACHE, `${hash}-${w}.${fmt}`), outPath: path.join(outDir, `${base}-${w}.${fmt}`) });
      }
    }
  }

  let variantBytes = 0;
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const t = tasks[next++];
      let out;
      if (existsSync(t.cacheKey)) {
        out = readFileSync(t.cacheKey);
      } else {
        const pipe = sharp(t.buf).resize({ width: t.w, withoutEnlargement: true });
        out = await (t.fmt === 'avif' ? pipe.avif({ quality: 55 }) : pipe.webp({ quality: 78 })).toBuffer();
        writeFileSync(t.cacheKey, out);
      }
      writeFileSync(t.outPath, out);
      variantBytes += out.length;
    }
  }
  await Promise.all(Array.from({ length: Math.max(2, (os.cpus()?.length || 4)) }, worker));

  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
  return { count: files.length, origBytes, variantBytes, manifest };
}

// Build a srcset string for a base image in one format.
function srcsetFor(base, widths, fmt) {
  return widths.map((w) => `images/${base}-${w}.${fmt} ${w}w`).join(', ');
}

// Rewrite each static <img src="images/..."> into a <picture> with AVIF + WebP
// sources (responsive srcset) and the original <img> kept as the universal
// fallback. Any new image added later is handled automatically on the next build.
function rewriteImgTags(html, manifest) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\bsrc="(images\/[^"]+)"/i);
    if (!m) return tag;
    const e = manifest[m[1]];
    if (!e) return tag; // non-raster (svg/gif) or unknown — leave untouched
    const sizes = 'sizes="100vw"'; // generic default; tuned per-layout in a later pass
    let img = tag;
    if (!/\bwidth=/i.test(img) && e.w) img = img.replace(/<img\b/i, `<img width="${e.w}" height="${e.h}"`);
    return (
      '<picture>' +
      `<source type="image/avif" srcset="${srcsetFor(e.base, e.widths, 'avif')}" ${sizes}>` +
      `<source type="image/webp" srcset="${srcsetFor(e.base, e.widths, 'webp')}" ${sizes}>` +
      img +
      '</picture>'
    );
  });
}
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// 1. Static passthrough (allowlist — only what the site actually references).
const STATIC = [
  'images', 'assets',
  'premodel-logo-full.png',
  'premodel-wordmark-cyanotype.png',
  'premodel-wordmark-tagline-cyanotype.png',
  'sitemap.xml', 'site.webmanifest',
];
for (const p of STATIC) if (existsSync(p)) cpSync(p, `${DIST}/${p}`, { recursive: true });

// 1b. Generate responsive AVIF/WebP variants for every raster in images/.
const imgStats = await buildResponsiveImages('images', `${DIST}/images`);
console.log(
  `Images: ${imgStats.count} sources → variants ${(imgStats.variantBytes / 1048576).toFixed(1)}MB ` +
    `(originals ${(imgStats.origBytes / 1048576).toFixed(1)}MB)`,
);

// 2. Minify the extracted CSS + JS.
const css = readFileSync('styles.css', 'utf8');
const js = readFileSync('main.js', 'utf8');
writeFileSync(`${DIST}/styles.css`, (await transform(css, { loader: 'css', minify: true })).code);
writeFileSync(`${DIST}/main.js`, (await transform(js, { loader: 'js', minify: true })).code);

// 3. Transform the HTML into the production page.
let html = readFileSync('premodel_homepage_prototype.html', 'utf8');

// Load in bare ("live") mode from parse time, so the scaler never runs.
html = html.replace(
  '<html lang="en" data-theme="light">',
  '<html lang="en" data-theme="light" class="bare live">',
);

// Replace the old bare-detection script with a test-mode escape hatch.
html = html.replace(
  /<!-- Bare preview:[\s\S]*?<\/script>/,
  "<script>/* Public site renders bare (full-bleed). ?test restores the review harness. */try{if(new URLSearchParams(location.search).has('test'))document.documentElement.classList.remove('bare','live');}catch(e){}</script>",
);

// Strip brand-token tooling (no live editor / palette engine on the public site).
html = html.replace(/<!-- premodel-tokens: pre-paint bootstrap[\s\S]*?<\/script>/, '');
html = html.replace(/<script src="premodel-tokens\.js"><\/script>\s*/, '');
html = html.replace(/<script>\s*\/\/ Shared token engine[\s\S]*?<\/script>/, '');

// Strip the "Brand and style guide" tooling link.
html = html.replace(/<div class="brand-guide-link">[\s\S]*?<\/div>\s*/, '');

// Staging noindex (belt-and-suspenders with the X-Robots-Tag header).
html = html.replace(
  '<link rel="canonical"',
  '<meta name="robots" content="noindex, nofollow" />\n<link rel="canonical"',
);

// Make every static <img> responsive (AVIF/WebP <picture> with srcset).
html = rewriteImgTags(html, imgStats.manifest);

const min = await minifyHtml(html, {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
  keepClosingSlash: true,
  html5: true,
});
writeFileSync(`${DIST}/index.html`, min);
writeFileSync(`${DIST}/premodel_homepage_prototype.html`, min);

// 4. robots.txt — staging disallow.
writeFileSync(`${DIST}/robots.txt`, 'User-agent: *\nDisallow: /\n');

console.log(`Built → dist/  (html ${(min.length / 1024).toFixed(0)}kb)`);
