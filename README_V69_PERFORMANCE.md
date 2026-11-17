# RPG Typing Versus v69 — Fast Loading Update

**Source update, not yet deployed.** This is the GitHub Pages student-game repository, built on v68. Firebase Spark, online-only connection monitoring, game modes, rankings, and the teacher laptop tournament service remain in place. No Cloud Functions, Cloud Run, service worker, or offline gameplay is introduced.

## What changed

- Shrunk supplied artwork before packaging: icon thumbnails 320 px wide; full character portraits 768 px; card themes 900 px. See `ASSET_REPORT_v69.json`. Original originals can be retained *outside the published `docs/` folder*.
- Removed the unused duplicate `icon03.webp` (two icons remain selectable; icon03 was identical to icon01). The original `icon01` and `icon02` filenames remain valid.
- All bundled image/audio URLs are indexed in `docs/asset-manifest.js`, with **content hashes** appended as `?v=`. Unchanged assets can be reused from normal browser HTTP cache after a later code deployment; replacing an asset changes its URL automatically after re-indexing.
- Empty/missing local stage and intro art/music names do not trigger 404s. Instead, the existing stage/boss fallback graphics remain visible.
- The intro no longer sends a new request with `?v=${Date.now()}`.
- Preloads `story-mode.js`, `adventure_rewards.js` and `adventure_engine.js` during the online card/login screen; they are still executed in their original order after authentication.
- Starts preparing Stage 1 assets while the required Firebase vocabulary/balance operations run. Prepares **only the next stage** in idle time once gameplay begins. Current-stage image preparation has a **650 ms maximum budget**; gameplay does not wait indefinitely for pictures.
- Music is loaded only when its source actually exists and is requested, rather than loading every track upfront. Current/next stage audio may be prefetched by the browser; it is advisory and browsers can ignore prefetch. The legacy `setBgm` early return was removed so actual configured music files can play. Chrome's user-gesture/autoplay rules still apply.
- Profile portraits use the content-hashed URLs and hidden character choices use lazy image loading.
- Corrected `CHARACTER_MANIFEST.json` to use paths relative to the GitHub Pages project directory, not `/assets/...` on the domain root.
- Added **local-only performance telemetry** for HTML/DOM, Firebase connection, card login, script startup, stage art and total run start; enable on `http://localhost:5500/adventure.html?perf=1`. This makes no Firebase writes.

## Adding or replacing media

1. Copy your owned media files to `docs/`. For the original Extra-stage patterns, use: `stage1_bg.webp`, `stage1_boss.webp`, `stage1_boss2.webp`, `stage1_bgm.m4a`, through `stage5_...`, and optional `intro_*_bg.webp`/`intro_*_bgm.m4a`. Existing paths in `adventure_engine.js` are unchanged; if a stage uses a different name, edit its stage configuration to match.
2. Run `OPTIMIZE_ASSETS_WINDOWS.bat` (or `py tools/build_assets.py --optimize`) from the `github-repository` directory. One-time install for image resizing: `py -m pip install Pillow`. If Pillow is unavailable, `py tools/build_assets.py` still regenerates the manifest without compression.
3. Confirm the expected filenames now appear in `ASSET_REPORT_v69.json`. Commit both the new assets **and** updated `docs/asset-manifest.js` to GitHub when ready. If you forget this step, the game will deliberately skip newly added local assets rather than issue missing-file requests.
4. Do **not** upload private student records, databases, secret card backups, or service-account credentials to the public repository. Back up high-resolution originals outside the published `docs` folder.

### Media note

The v68 input ZIP **does not contain** the optional Extra-stage artwork or BGM files, nor the intro backgrounds/BGM. v69 does not invent replacements. `ASSET_REPORT_v69.json` lists all 26 missing optional filenames. Their screens use existing fallback graphics; audio is skipped. **Some legacy Extra-stage completion rules use a music-ending event**, so supply the required music before depending on those stages for student gameplay. That's a pre-existing content/gameplay limitation, not something a performance patch can resolve by compression.

## Local testing (no GitHub uploads)

- Double-click `TEST_LOCAL_WINDOWS.bat` in `github-repository`. It starts a static HTTP server on `localhost:5500` and opens the game with the performance panel. Windows Python must be installed.
- Real Firebase credentials and an authorized localhost authentication domain are still required for gameplay: local testing is **not offline mode** and does not bypass student authentication or online checks. Use a separate test project when testing changes to Firebase data/rules.
- To test new artwork, edit the local files, rerun the asset manifest tool, and refresh the page. Publish to GitHub only after you're satisfied.
- Run `node TEST_V69_ASSETS.cjs` for no-network asset loader regression tests.

## What this does NOT do

- It does not create missing boss art or BGM, convert copyrighted music, guarantee a particular seconds-to-load value, or bypass Firebase login time.
- No live school Chromebook test or deployment was performed. Browser automation in the test environment was blocked from localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`); source, synthetic JavaScript, and server smoke checks were used instead.
- GitHub Pages has a caching policy it controls: content-hash query strings help with updates, but browsers/CDNs retain final control. There is no service worker or persistent offline app.
- No gameplay or Firebase data migrations. The tournament server stays on your laptop and is unchanged.
