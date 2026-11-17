# RPG Typing Versus v70 — Recruitment UI Preview

The new standalone page `docs/recruitment.html` implements a red-and-black banner layout influenced by the provided recruitment reference. No character or background art is included. Open **Profile → Recruitment** in the live online game; the `profile.html?tab=recruitment` view also links to the new page.

## Add artwork later

1. Put a suitably licensed or original widescreen image into `docs/assets/recruitment/` (e.g. `featured.webp`). A transparent character composite or full background can be used.
2. Edit `docs/recruitment-banners.json` and change the selected banner's `art` field from `null` to `"assets/recruitment/featured.webp"`.
3. Upload updated static files to GitHub. GitHub Pages serves artwork; no Firestore writes or reads are needed for the banner selection.
4. Prefer WebP, sized for a laptop/Chromebook display, and keep the subject on the left of the image because the right side holds controls.

The image path must be a local file under `assets/recruitment/`, not an external URL. A missing image will leave the dark placeholder composition visible; supply the image when ready.

## Flow currently implemented

- Choose Featured or Standard banner (visual preview only).
- View banner details and unconfigured probability information.
- Click Recruit ×1 or Recruit ×10 to see a disabled scouting confirmation panel.
- Close dialogs and return to Profile.

**No RNG, real draws, balance mutations, reward submissions, fabricated rates, or daily free draws are activated.** The Spark edition requires a trusted backend for those operations and has none. Reusing this UI does not compromise the locked rewards model.

## Online-only policy

The page imports `online-spark.js` and retains its blocking Firebase startup overlay; it does not bypass connectivity, login, or the existing offline lock. The banner configuration comes from GitHub static JSON, not Firestore.
