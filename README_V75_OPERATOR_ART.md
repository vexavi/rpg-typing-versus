# RPG Typing Versus v75 — Your 14 operator illustrations

**This version imports your uploaded artwork and configures Tavi as the featured 6★ operator. It does NOT enable real gacha spending, pulls, character awards, or duplicate-shard grants.** Guild Coin and Aura Workshop behavior from v73/v74 remains as before.

## No renaming necessary

The provided filenames already followed the convention: `Vex_4star.png`, `Isolde_5star.png`, `Cassian_6star.png`, and `Tavi_6star_FEATURED.png`. They are read only during roster import. In-game operator IDs are stable (`vex`, `isolde`, `cassian`, `tavi`), so future banner rotations never require changing the image filename.

## Roster and artwork

| Rarity | Characters |
|---|---|
| 4★ (8) | Alden, Elise, Kade, Livia, Mira, Nora, Vern, Vex |
| 5★ (3) | Aveline, Isolde, Seraphine |
| 6★ (3) | Cassian, Hound, **Tavi (featured)** |

The 14 submitted RGBA PNGs were converted to transparent WebP at `docs/assets/recruitment/<id>.webp`, ~3.68MB total. The original PNG files remain your source assets and are NOT republished in the public GitHub repository. `docs/gacha_catalog.json` is the canonical structured roster with rarity and art paths; `docs/gacha-catalog.js` is a mirror for offline design demos, not a source of gameplay randomness.

## Inspect before publishing

Open these static previews after extracting the complete ZIP:

- `github-repository/docs/roster-preview.html` — all 14 imported operators, ranks, and Tavi badge. Works locally without Firebase.
- `github-repository/docs/recruitment-design-preview.html` — v75's banner and pull/reveal previews using imported operator art. Works locally (no rewards).
- `github-repository/docs/recruitment-reveal-demo.html` — single and 10-pull star-first operator showcases with a **fixed demonstration sequence**, not actual probabilities.
- `github-repository/docs/auras-demo.html` — Aura Workshop with simulated ownership of the imported roster and test shards; no real balances updated.

## Rotate the featured 6★ later

Once `github-repository/` and **its updated Firestore rules** are deployed:

1. Sign into `recruitment-admin.html` as the authorized teacher.
2. Choose Tavi, Cassian, or Hound from **Featured 6★ character**.
3. Press **Save to Firebase**. Students see the new character upon their next Recruitment page visit/reload. **No image renaming or GitHub upload is needed for existing operators.**

The existing teacher banner title, subtitle, description and tab label remain editable. Existing Firestore records that contain text-only Featured banners are read with Tavi as a safe default; the first save writes the new featured ID. Deploying rules is required for the newly extended banner document. If the new rules have not been published, saving will fail; do not remove the teacher-only security requirement.

To introduce a **brand-new** character in a future month, its art and catalog entry must first be uploaded to GitHub. After that, selecting it from the dashboard does not require renaming any old files.

## Keep these design decisions separate

- Tavi's status is in `featured_character_id`, **not** encoded in the WebP filename.
- The three 6★ illustrations are available for preview. Their future recruitment pool/limited status is **not finalized**; importing artwork does not decide whether a character is off-banner.
- Character shards, aura costs and upgrades in v74 are unchanged.
- The sample gacha reveal is deterministic; neither displayed rarity nor character selection demonstrates the final odds.
- The banner **background image** is still separate; only Tavi's foreground character illustration is provided.
- Some higher-rarity images include environmental props in their transparent image. A future silhouette-based aura may also trace those props unless you supply a character-only cutout/mask.

## Publish

Replace the contents of your GitHub Pages repository with `github-repository/` and deploy `firestore.rules` following your previous version's instructions. Do not publish `tournament-local/` to GitHub. Existing students' data remains in Firebase; this ZIP doesn't upload anything to your account automatically.

**Testing note:** Node syntax and 112 roster-integrity checks passed, as did 886 v74 Aura, 120 v73 Guild Coin, and 18 v69 asset checks. Live Chromium navigation was blocked by the runtime and is not claimed as a passed test. Firebase emulator/deployed-project testing is also still required.
