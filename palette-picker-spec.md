# Palette picker spec — Premodel prototype

**Hand-off to Claude Code.** Two tasks bundled: (1) commit the new palette artifacts to GitHub on a branch Ashley can share with Paige, and (2) implement a palette picker on the working mobile prototype that lets the viewer toggle between five accent options and an "off" state.

---

## Repo context

- Repo: `github.com/premodel/premodel-v1`
- Working directory on Ashley's Mac: `/Users/ashleywells/Documents/Claude/Projects/GTM website`
- Live prototype URL: `https://premodel.github.io/premodel-v1/premodel_homepage_prototype.html`
- Prototype file: `premodel_homepage_prototype.html` at repo root (confirmed, 2,607 lines)
- Current branch when this spec was written: `claude/footer-and-modals` (unrelated WIP — do not commit on top of this branch)
- Files this spec relies on (all already in the working directory, untracked):
  - `premodel_palette_v2.html` — the palette comparison page that Paige will be linked to from the picker
  - `premodel_lockup_explorer.html` — related internal exploration; commit it too for context
  - `lockup-explorations/` — 22 PNG files, the tagline-accent lockup variants the palette page references
  - `premodel-logo-full.png` — source logo PNG used to derive every recolored lockup
  - `premodel_lockup_v2_on-paper.png`, `premodel_lockup_v2_on-dark-card.png` — earlier neutral lockups still referenced by older notes; commit for archive

---

## Task 1 · commit palette files to a shareable branch

Goal: a branch named `claude/palette-v2` on origin, branched cleanly from `origin/main`, containing only the palette artifacts. Ashley can then open a PR or share the branch link directly with Paige.

Steps:

1. From the working directory, fetch latest: `git fetch origin`.
2. Create the new branch from `origin/main` (NOT from the current `claude/footer-and-modals`): `git checkout -b claude/palette-v2 origin/main`.
   - Untracked palette files travel with the working tree, so they'll be available on the new branch.
3. Stage only the palette-related files (exact list):
   - `premodel_palette_v2.html`
   - `premodel_lockup_explorer.html`
   - `premodel_lockup_v2_on-paper.png`
   - `premodel_lockup_v2_on-dark-card.png`
   - `premodel-logo-full.png`
   - `lockup-explorations/` (entire folder, 22 PNGs)
   - `palette-picker-spec.md` (this file)
4. Do NOT stage:
   - `.claude/`, `tools/`, `hero-mockups/` (working state, not for this PR)
   - `faq-implementation-plan.md`, `footer-implementation-plan.md` (other initiatives' specs)
   - `Reveal_First_Seattle_Launch_Campaign_Plan.docx` (separate workstream)
   - `how_it_works_v1.md`, `how_it_works_mobile_prototype.html` (the prototype itself — modify and commit in Task 2, not here)
   - `premodel_palette_v1.html` (superseded by v2)
   - `premodel_lockup_editorial_on-*.png` (older AI-generated lockups, superseded by `lockup-explorations/`)
   - `premodel-restyle.plugin` (different tooling)
5. Commit message:

   ```
   Palette v2: 5-accent set with signature tagline lockup

   - New accent options: oxblood (default), sage, cyanotype blue,
     aubergine, saffron. Three retired (sienna, terracotta, rust)
     for sitting too close to Claude's coral.
   - Signature lockup approach: only the tagline "Before You
     Remodel" carries the accent. Mark and wordmark stay neutral.
   - 22 lockup PNGs in lockup-explorations/ are deterministic PIL
     recolors of premodel-logo-full.png (no AI generation in the
     final assets).
   - palette-picker-spec.md spec for next step: add picker to
     mobile prototype.

   Co-authored-by: Claude <noreply@anthropic.com>
   ```

6. Push: `git push -u origin claude/palette-v2`.
7. Print the PR-creation URL so Ashley can open it in one click:
   `https://github.com/premodel/premodel-v1/compare/main...claude/palette-v2?expand=1`

Acceptance: `git ls-tree -r claude/palette-v2 --name-only | wc -l` shows the new files added; `git diff origin/main..claude/palette-v2 --stat` shows only the palette-related files changed; nothing from `claude/footer-and-modals` bleeds in.

---

## Task 2 · palette picker on the mobile prototype

### Goal

Add a small palette picker UI just below the phone-frame mockup on the working mobile prototype. The viewer can click any swatch to apply that accent's full editorial color system to the prototype in place, or click "Off" to restore the prototype's current black-and-white treatment.

This is a sharing/feedback tool. Paige and others will use it to react to the palette options applied in real context (the actual prototype, not the standalone comparison page).

### The prototype

File: `premodel_homepage_prototype.html` at repo root. Served via GitHub Pages at `https://premodel.github.io/premodel-v1/premodel_homepage_prototype.html`.

Key structural facts you'll need:

- Single `<body>` contains a `.prototype-wrapper` div.
- Inside that wrapper: a `.prototype-toolbar` (Layout A/B switcher, Size selector, version pill) ABOVE the phone frames.
- Two `.phone-frame` elements as siblings — `data-layout="a"` (visible) and `data-layout="b"` (hidden). The Layout toggle swaps which is visible.
- Each `.phone-frame` contains a `.phone-scroll` with the actual mobile homepage content.
- All real color values are already CSS variables defined in `:root` (`--color-background-primary`, `--color-text-primary`, `--color-brand-navy`, etc.). The prototype is well-tokenized — no major refactor needed.
- A `@media (prefers-color-scheme: dark)` block redefines the same `:root` variables for dark mode. Inline `style.setProperty(...)` on `<html>` from JS wins over both the static `:root` block and the dark-mode `@media` block, so the palette swap works regardless of OS dark-mode setting.

### Picker placement

- **Position:** Inside `.prototype-wrapper`, AFTER both `.phone-frame` elements (sibling, not nested), centered horizontally with ≥40px breathing room above.
- **Sticky vs static:** Static. Do not make it sticky-to-viewport — it should sit naturally so reviewers scroll past it after seeing it once. The existing `.prototype-toolbar` above the phone is non-sticky too; match that pattern.
- **Width:** Match the phone frame width (the frame width is driven by the Size selector — Mobile M is 390px). Picker can be 360–420px wide; if you want it to track the frame width exactly, use the same CSS variable that drives `--frame-width`.
- **Visual register:** Match `.prototype-toolbar`'s aesthetic — it's the reference for "prototype-chrome UI" in this file. Same label typography, same button rounding, same color treatment for inactive vs active states. The picker is a peer to the toolbar, not its own design moment.

### Picker visual design

```
Palette                                          [link icon] Compare all →
┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌─────┐
│ × │ │ ▢ │ │ ▢ │ │ ▢ │ │ ▢ │ │  ▢  │
└───┘ └───┘ └───┘ └───┘ └───┘ └─────┘
 Off  Oxbld Sage  Cyan  Aubg  Saffr
```

Specifics:

- **Label:** "Palette" — 11px uppercase, letter-spacing 0.12em, weight 600, color matches the prototype's current label/eyebrow color.
- **Compare link:** Top-right of the picker row, label "Compare all →", links to `premodel_palette_v2.html` (relative path; both files live in the same repo root). Same typographic treatment as the "Palette" label, but underlined on hover. Open in a new tab (`target="_blank" rel="noopener"`).
- **Swatches:** 32×32px squares with 6px border-radius, 8px gap between swatches.
- **Off swatch:** A 32×32 square with a 1px dotted border in the prototype's current text-secondary color, "×" or "—" centered inside. Communicates "no palette / off state."
- **Active state:** 2px solid ring in the prototype's primary text color, offset 2px outside the swatch. The "Off" swatch's active state is the same ring treatment.
- **Hover state:** subtle scale (1.05) or 1px ring in a neutral color. Pick one — don't double up.
- **Optional caption:** Tiny 10px label under each swatch with the color name (Off, Oxblood, Sage, Cyanotype, Aubergine, Saffron). If space is tight, drop captions and use hover/title-tooltip instead.

### Behavior

- Click a color swatch → apply that accent's CSS variables to `:root` (or a wrapping `.palette-active` class on `<body>`, see Implementation below). Mark that swatch as `.active`. Remove `.active` from other swatches.
- Click "Off" → remove all palette overrides, restore the prototype's default black-and-white state. Mark "Off" as `.active`.
- Initial state on page load: "Off" is active (matches current prototype).
- Persistence: do NOT use localStorage. Each new visitor lands in "Off" so the prototype's default state is what they see first; toggling is exploratory.

### Implementation — CSS variable system

The picker swaps the prototype's existing CSS variables on `:root` (no new variables needed). When a palette is active, the picker overrides the prototype's `--color-*` vars with editorial-warm-neutrals values and replaces `--color-brand-navy` with the chosen accent. When "Off" is selected, the picker removes its overrides and the prototype reverts to its declared defaults (which include `@media (prefers-color-scheme: dark)` handling).

**The mapping** (prototype variable → editorial override when a palette is active):

| Prototype variable | Off default (already in `:root`) | Editorial override |
|---|---|---|
| `--color-background-primary` | `#ffffff` | `#f7f4eb` (warm paper) |
| `--color-background-secondary` | `#f6f5f0` | `#fbf8ef` (card surface) |
| `--color-background-tertiary` | `#faf9f4` | `#fbf8ef` (or keep close to surface) |
| `--color-surface-secondary` | `#f3f1eb` | `#ece4d1` (pill / chip bg) |
| `--color-text-primary` | `#1a1a18` | `#2a2826` (slight warmth lift) |
| `--color-text-secondary` | `#6b6a64` | `#6a625a` (warmth lift) |
| `--color-text-tertiary` | `#a8a7a1` | `#998f80` (warmth lift) |
| `--color-brand-navy` | `#3b6eb5` | **the chosen accent's primary value** |
| `--color-border-primary` | `rgba(0,0,0,0.25)` | leave alone (rgba auto-adapts) |
| `--color-border-secondary` | `rgba(0,0,0,0.18)` | leave alone |
| `--color-border-tertiary` | `rgba(0,0,0,0.10)` | leave alone |
| `--color-background-warning` | `#faeeda` | leave alone (status color) |
| `--color-text-warning` | `#854f0b` | leave alone (status color) |

Status colors (`--color-*-warning`, the scattered `#e65100` / `#c0392b` literals if any are used for errors) are intentionally not palette-driven — alerts should look like alerts regardless of brand color.

**The JS:**

```js
const PALETTES = {
  off: null,  // remove all overrides

  // Editorial warm-neutrals base (shared by all 5 color palettes)
  _base: {
    '--color-background-primary':   '#f7f4eb',
    '--color-background-secondary': '#fbf8ef',
    '--color-background-tertiary':  '#fbf8ef',
    '--color-surface-secondary':    '#ece4d1',
    '--color-text-primary':         '#2a2826',
    '--color-text-secondary':       '#6a625a',
    '--color-text-tertiary':        '#998f80',
  },

  // Each accent only needs to override --color-brand-navy
  oxblood:   { '--color-brand-navy': '#5e2c2e' },
  sage:      { '--color-brand-navy': '#7d8a72' },
  cyanotype: { '--color-brand-navy': '#2a5680' },
  aubergine: { '--color-brand-navy': '#4a2942' },
  saffron:   { '--color-brand-navy': '#c89028' },
};

const ALL_OVERRIDE_KEYS = [
  ...Object.keys(PALETTES._base),
  '--color-brand-navy',
];

function applyPalette(key) {
  const root = document.documentElement;
  // Always clear first — restores Off / default behavior including dark mode
  ALL_OVERRIDE_KEYS.forEach(v => root.style.removeProperty(v));

  if (key === 'off') return;

  const tokens = { ...PALETTES._base, ...PALETTES[key] };
  Object.entries(tokens).forEach(([v, val]) => root.style.setProperty(v, val));
}
```

**Why just `--color-brand-navy` per accent and not a four-variable accent system?** The prototype currently uses navy as its single brand color throughout (CTAs, links, accent text, pill borders). Overriding that one variable gets you the entire re-skin. Hover / soft / on-dark variants of the accent aren't currently used in the prototype — adding them now is scope creep for a reviewer tool. If you later want hover + soft + on-dark behavior, introduce `--color-brand-hover`, `--color-brand-soft`, `--color-brand-on-dark` in the prototype's `:root` first, then add them to each palette object.

**Hex literal sweep (optional):** A handful of scattered hex literals exist outside `:root` (e.g., `#1a1a18`, `#3a3935`, `#2a5490`). Don't tokenize them in this PR unless they obviously belong to the palette system. Many are status / chrome colors that should NOT re-skin. If something visually fails to re-skin after the swap, grep for the offending literal and tokenize it in a follow-up.

### Swatch markup template

```html
<div class="palette-picker" role="radiogroup" aria-label="Color palette">
  <div class="palette-picker-head">
    <span class="palette-picker-label">Palette</span>
    <a href="premodel_palette_v2.html" target="_blank" rel="noopener" class="palette-picker-compare">Compare all →</a>
  </div>
  <div class="palette-picker-swatches">
    <button class="swatch swatch-off active" data-palette="off" role="radio" aria-checked="true" aria-label="Off — restore default">
      <span aria-hidden="true">×</span>
    </button>
    <button class="swatch" data-palette="oxblood" role="radio" aria-checked="false" aria-label="Oxblood" style="--swatch-color: #5e2c2e;"></button>
    <button class="swatch" data-palette="sage" role="radio" aria-checked="false" aria-label="Sage" style="--swatch-color: #7d8a72;"></button>
    <button class="swatch" data-palette="cyanotype" role="radio" aria-checked="false" aria-label="Cyanotype" style="--swatch-color: #2a5680;"></button>
    <button class="swatch" data-palette="aubergine" role="radio" aria-checked="false" aria-label="Aubergine" style="--swatch-color: #4a2942;"></button>
    <button class="swatch" data-palette="saffron" role="radio" aria-checked="false" aria-label="Saffron" style="--swatch-color: #c89028;"></button>
  </div>
</div>
```

Color swatches use `background: var(--swatch-color)` in CSS. The off swatch gets dotted-border treatment, no background.

### Accessibility

- Wrap the swatches in `role="radiogroup"` with an `aria-label`.
- Each swatch is `role="radio"` with `aria-checked` reflecting active state.
- Each swatch has an `aria-label` with the palette name (since color alone isn't accessible).
- Keyboard nav: arrow keys move focus between swatches; Space/Enter activates. The browser's default focus ring on `<button>` is fine — don't suppress it.
- The "Off" swatch should also be keyboard-activatable and labeled clearly.

### Edge cases & guardrails

- **Layout A and Layout B:** There are two `.phone-frame` instances in the DOM (`data-layout="a"` and `data-layout="b"`). Only one is visible at a time per the Layout switcher. The picker is a SINGLE instance sitting after both frames in `.prototype-wrapper`. The CSS variable swap on `:root` re-skins both layouts simultaneously; no per-layout picker logic needed.
- **The prototype toolbar:** The existing `.prototype-toolbar` (Layout / Size / version pill) sits ABOVE the phone frames and is reviewer chrome — it should NOT re-skin with the palette. The toolbar already uses neutral colors (mostly the prototype's text/border tokens). If toolbar elements happen to use `--color-brand-navy` or `--color-background-primary` and re-skin unintentionally, either tokenize those usages to chrome-specific variables (`--toolbar-bg`, etc.) or use hardcoded values for the toolbar.
- **The phone-frame border itself:** The `.phone-frame` element has `background: var(--color-background-primary)` and `border: 0.5px solid var(--color-border-secondary)`. Both are palette-driven, which is correct — when the palette is active, the frame's background becomes warm paper. This is desired behavior.
- **The picker UI itself:** Don't let the picker's own styles get caught by the palette swap. Use scoped class names (`.palette-picker`, `.swatch`) with self-contained color values that don't depend on palette tokens. The picker should look identical regardless of which palette (or Off) is active.
- **Dark mode:** The prototype has `@media (prefers-color-scheme: dark)` redefining the same `--color-*` variables. Inline `style.setProperty` on `:root` from JS wins over both the static `:root` block AND the media query, so palettes look correct in both OS modes. When "Off" is active and the user's OS is in dark mode, the prototype shows its dark-mode defaults — that's expected.
- **Image assets that imply a color:** Ashley confirmed there are no Premodel lockup PNGs embedded in the prototype yet. If you find one during implementation, leave it as-is (do not attempt to swap it for one of the `lockup-explorations/` variants). The picker is about page chrome and accent, not lockup placement.
- **Hardcoded hex literals:** A handful of `#1a1a18`, `#3a3935`, `#2a5490`, `#e65100`, `#c0392b` literals exist outside `:root`. Most are status / chrome / state colors that shouldn't re-skin. If something visibly fails to re-skin during testing, identify the literal and decide on a case-by-case basis whether to tokenize it. Don't bulk-tokenize.

### Acceptance criteria

1. Picker renders below both `.phone-frame` elements (inside `.prototype-wrapper`) on load with "Off" active.
2. Clicking any color swatch re-skins the visible phone frame in place — backgrounds shift from white to warm paper, text gets a slight warmth bump, and every place the prototype used `--color-brand-navy` now shows the chosen accent (CTAs, links, accent text, pill borders, etc.). No layout jump.
3. Clicking "Off" returns the prototype to its exact original appearance, including correct dark-mode behavior if the user's OS is in dark mode.
4. Toggling Layout A ↔ Layout B while a palette is active: the newly-visible layout shows the same palette (since the swap is on `:root`, not per-frame). Verified visually.
5. "Compare all →" link opens `premodel_palette_v2.html` in a new tab (`target="_blank" rel="noopener"`). Relative URL works in both local file:// and GitHub Pages contexts.
6. Keyboard nav works: Tab into the picker, arrow keys cycle between swatches, Space/Enter activates the focused swatch.
7. No console errors or warnings.
8. The picker is visually distinct from the prototype content — it reads as reviewer chrome, peer to the existing `.prototype-toolbar`, not as part of the homepage design.
9. The picker itself does NOT re-skin when the palette is active (its own styles are scoped and self-contained).
10. The `.prototype-toolbar` above the frames does NOT re-skin either (or if any element accidentally does, that's flagged as a follow-up).

### Out of scope for this iteration

- No logo / lockup placement in the prototype (Ashley explicitly noted this).
- No persistence across page loads.
- No analytics / tracking on swatch clicks.
- No A/B testing infrastructure.
- The picker is reviewer-facing tooling; do not style it to look like a production feature.

---

## Hand-off summary

After completing both tasks, expected state:

- `claude/palette-v2` branch on origin contains the palette artifacts.
- PR creation URL printed for Ashley.
- The working mobile prototype, on the same branch (or a follow-up branch — your call, both are reasonable), has the palette picker working below the phone frame with the 5 accents + Off.
- A second commit on the same branch with message like:

  ```
  Mobile prototype: add palette picker for reviewer feedback

  - 5 accents + Off, below the phone frame.
  - Off restores the prototype's default black-and-white state.
  - "Compare all →" link to premodel_palette_v2.html.
  ```

Open questions to surface to Ashley if encountered:

- If the canonical prototype file is unclear (multiple `*prototype*.html`), confirm before modifying.
- If the prototype's CSS uses heavily-hardcoded colors that would require substantial tokenization to be palette-swappable, surface scope before doing the refactor.
- If the prototype already has a different color-toggle mechanism, ask whether to replace it or add alongside.
