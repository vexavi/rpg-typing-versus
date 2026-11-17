# RPG Typing Versus v72.1 — star-first recruitment reveal

This is a **visual-only prototype** integrated into the v71 Recruitment screen. It is not a real gacha system and it does not call Firebase to create pulls, charge coins/permits, or grant characters.

## Preview without Firebase

Open `docs/recruitment-reveal-demo.html` in a browser (or from `TEST_LOCAL_WINDOWS.bat` using the local development server). Choose Preview ×1 or Preview ×10. This is a standalone UI tester, not a playable offline mode.

## Student Recruitment screen

Open Recruitment in the online game. `RECRUIT ×1` or `RECRUIT ×10` now starts a preview: stars appear FIRST (automatically transitioning after around 1.25 seconds), then the corresponding character placeholder. A 10-pull repeats this for each character and ends with all ten results. `SHOW ALL RESULTS` skips ahead. Escape or the × Close button dismisses it.

## Rarity and characters

The example star counts in the prototype are fixed demonstration values and DO NOT represent drop probabilities. The single demo shows a 5-star placeholder. The ten-pull demo shows an illustrative mix of 3–6 stars, including one 6-star. Every revealed result is named `OPERATOR 01` etc. There is NO character inventory, roster or authentic artwork in the reveal yet. Real pulls would require a trusted reward backend, and the free Firebase Spark version intentionally keeps these disabled.

## Integration files

- `docs/recruitment.html` includes the new CSS and JavaScript.
- `docs/recruitment.js` opens the visual reveal on the existing 1× and 10× buttons.
- `docs/recruitment-reveal.css` controls reveal appearance, rarity themes, stars, character placeholders, and results grid.
- `docs/recruitment-reveal.js` controls the client-only preview sequence and keyboard interactions.
- `docs/recruitment-reveal-demo.html` allows UI review without signing in or changing Firebase records.

The operator artwork area is deliberately empty. Your future artwork can replace the placeholders without changing the star-first timing.

## Deployment

Update GitHub Pages files under `/docs`. No Firestore rule changes or backend migrations are needed for this UI-only change. The actual game still requires Firebase and a working internet connection.

## v72.1 rarity restriction

Recruitment preview now shows only **4★ / 5★ / 6★** rarities in single-pull reveals and all ten-pull results. The demo sample is deterministic, **not** an indication of real odds or guarantees. The character catalog declares `allowed_rarities: [4, 5, 6]`; no actual pulling, probabilities, or Firebase spending are enabled.
