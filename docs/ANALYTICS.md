# Analytics (PostHog)

The site sends product analytics to PostHog (project **Premodel**, US cloud).
Goal: measure the Reveal-form funnel and gallery/reveal engagement so we can refine
the page as we start spending on Instagram / Facebook.

## How it's wired

- **Loader:** the standard PostHog JS snippet lives in `<head>` of
  `premodel_homepage_prototype.html`. The key in it
  (`phc_FZ7avkp3MlzndPDBtB0ehyGfKaklYUUB7PzkKdWVQk4`) is the project's **public**
  API token — it can only write events, never read data, so it is meant to ship in
  the browser and is not a secret.
- **Guard:** init is skipped on `localhost` / `127.0.0.1`, so local dev and the
  in-app preview never pollute production data. (PostHog also has a project-level
  `$host` filter for localhost as a backstop.)
- **Custom events:** fired from `main.js` via the `pmTrack()` / `pmIdentify()`
  helpers at the top of the file. Both no-op silently if PostHog isn't present (dev,
  or an ad-blocker dropped the script), so call sites never need to guard.
- **Autocapture is ON:** pageviews, clicks, and input interactions are captured
  automatically. The custom events below add the high-signal funnel/engagement steps
  on top of that.
- **Session replay is ON** (enabled at the project level). posthog-js masks input
  *values* by default, so names/emails/phones typed into the Reveal form are never
  recorded. To turn replay off, flip it in PostHog → Settings → Replay (no deploy
  needed).
- **CSP:** `vercel.json` allows the PostHog asset host (`us-assets.i.posthog.com`)
  and ingest host (`us.i.posthog.com`), plus `worker-src blob:` for replay. If you
  tighten the CSP, keep those.

## Events

### Reveal-form funnel (primary)

| Event | When | Key properties |
| --- | --- | --- |
| `$pageview` | page load (autocapture) | — |
| `reveal_form_started` | first room chip tapped | `first_room` |
| `reveal_form_step_viewed` | each step the visitor navigates to | `step_name` (`type`/`budget`/`contact`), `room_count`, `rooms`, `scope_type`, `budget` |
| `reveal_form_note_added` | optional note saved | `length` |
| `reveal_form_submitted` | **conversion** — server accepted the lead | `rooms`, `room_count`, `scope_type`, `budget`, `pm_total` |
| `reveal_form_submit_failed` | send failed | `room_count`, `scope_type`, `budget` |

On a successful submit we also `identify()` the person by email (with name + zip),
so their session — and its replay — is tied to the lead.

> The always-mounted card's initial `showStep(1)` is intentionally **not** tracked,
> so "rooms step" ≈ `reveal_form_started` rather than ≈ pageviews. Build the funnel
> as: `$pageview` → `reveal_form_started` → `reveal_form_step_viewed` (type → budget
> → contact) → `reveal_form_submitted`.

### Gallery + reveal engagement

| Event | When | Key properties |
| --- | --- | --- |
| `gallery_opened` | a case-study modal is opened | `project`, `room`, `location` |
| `gallery_reel_scrolled` | visitor scrolls through that project's renders | `project` |
| `reveal_card_toggled` | hero before/after manually toggled | `card_index`, `location`, `face` |
| `hero_carousel_advanced` | hero carousel moved by the user (not auto-rotate) | `method` (`dot`/`drag`/`wheel`/`card`), `index`/`direction` |
| `cta_clicked` | sticky bottom CTA tapped | `location` |

## Marketing attribution (Instagram / Facebook)

No code is needed — PostHog automatically captures `utm_*` params and the referrer
on the first pageview and stores them as person/session properties. **Just tag the
ad links**, e.g.:

```
https://premodel.design/?utm_source=facebook&utm_medium=paid_social&utm_campaign=spring_launch
https://premodel.design/?utm_source=instagram&utm_medium=paid_social&utm_campaign=spring_launch
```

Then break the funnel down by `utm_source` / `utm_campaign` in PostHog to compare
channels and campaigns.

## Recommended follow-up: reverse proxy

Ad-blockers (common on social traffic) block requests to `*.posthog.com`, which
silently drops a chunk of events. The fix is to proxy ingestion through our own
domain so it looks first-party. We deferred this because the current staging setup
serves under `premodel.design/preview` via an outer proxy, which complicates a
root-level `/ingest` rewrite. **Once the site is on the apex domain**, add a Vercel
rewrite (`/ingest/* → us.i.posthog.com`, `/ingest/static/* → us-assets.i.posthog.com`),
point the snippet's `api_host` at `/ingest`, and keep `ui_host` on
`us.posthog.com`. See PostHog's "Reverse proxy → Vercel" docs.
