# Local clone + reliable preview workflow

This file is a runnable recipe for working on `premodel-v1` locally and previewing
`premodel_homepage_prototype.html` in a preview panel (Claude Desktop / Code / Cowork)
instead of a separate browser tab.

You can hand this whole file to a local coding agent ("follow LOCAL_PREVIEW.md") or run
the steps yourself in a terminal. Commands assume macOS.

---

## Mental model (read once)

- **GitHub (`premodel/premodel-v1`) is the source of truth.** Cloud sessions edit the repo
  and push branches to GitHub.
- A **clone** is a local folder linked to GitHub. You `fetch`/`checkout` branches to see work
  done in any session, and `push` to send local work back.
- A **loose copy** of the HTML (e.g. in `~/Documents/Claude/Projects/GTM website/`) is NOT linked
  to GitHub. Edits there are invisible to GitHub and vice-versa. Stop editing the loose copy once
  the clone exists.

---

## 1. One-time: clone the repo

Pick a home for it (kept separate from the old loose copy):

```bash
mkdir -p ~/Documents/Claude/Projects
cd ~/Documents/Claude/Projects
git clone https://github.com/premodel/premodel-v1.git
cd premodel-v1
```

(If you use SSH with GitHub: `git clone git@github.com:premodel/premodel-v1.git`.)

## 2. One-time safety check: don't lose local-only edits

Compare your old loose file against the repo's `main` version. If this prints differences,
your loose copy has changes that are NOT on GitHub — copy anything you want to keep before
moving on.

```bash
git checkout main && git pull origin main
diff "$HOME/Documents/Claude/Projects/GTM website/premodel_homepage_prototype.html" \
     premodel_homepage_prototype.html && echo "Identical — nothing to migrate."
```

## 3. Each session: get the branch you want to preview

For the scroll-animated chart work:

```bash
git fetch origin claude/tender-cray-WxcPJ
git checkout claude/tender-cray-WxcPJ
git pull origin claude/tender-cray-WxcPJ   # if you've checked it out before
```

To go back to the published version: `git checkout main`.

## 4. Preview reliably (this is the part that fixes the panel)

A preview panel loads a **URL**, and `file://...` paths are flaky (and can block the CDN
icons). Serving the folder over `http://localhost` is the reliable path. Start a tiny static
server from the repo root:

```bash
python3 -m http.server 8000
# leave this running; Ctrl+C to stop
```

Then open this URL **in the preview panel** (or a browser tab):

```
http://localhost:8000/premodel_homepage_prototype.html
```

In Claude Desktop / Code / Cowork: open this repo folder, then point the preview panel at the
localhost URL above. Because it's a real HTTP URL, the panel renders it consistently and the
Lucide pin icons (loaded from a CDN) appear.

### What to look at
- Use the **A / B** toggle above the phone frame — the animated chart lives in **Layout A**.
- Scroll inside the phone to the **"Why Premodel"** section; the chart pins and scrubs through
  7 beats as you scroll.

## 5. Quick reference

| Goal | Command |
| --- | --- |
| Update everything | `git fetch origin` |
| See animated chart branch | `git checkout claude/tender-cray-WxcPJ && git pull origin claude/tender-cray-WxcPJ` |
| Back to published site | `git checkout main && git pull origin main` |
| Start preview server | `python3 -m http.server 8000` (from repo root) |
| Preview URL | `http://localhost:8000/premodel_homepage_prototype.html` |
