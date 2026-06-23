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

import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { transform } from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';

const DIST = 'dist';
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
