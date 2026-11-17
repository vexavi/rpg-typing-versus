# RPG Typing Versus v72.1 — 4★ / 5★ / 6★ only

## Changes
- Removed the 3-star tier from the recruitment reveal UI.
- Updated deterministic ten-pull demo to: 4,4,5,4,4,4,6,4,5,4.
- Set default color fallback to the 4-star tier.
- Declared `allowed_rarities` [4,5,6] in both GitHub and local tournament catalog JSON.
- Updated recruitment reveal JS version query for browser cache refresh.
- Removed outdated 10-pull screenshot containing 3-star results.

## Tests
- Passed Node runtime simulation: single-pull stars, character, results; all 10 individual star/character screens and summary.
- Passed JavaScript syntax check.
- Both gacha catalogs parse as valid JSON and allow 4,5,6 only.

## Scope
Recruitment is still visual-only in the GitHub game. This change **does not** activate currency spending, rewards, or set drop probabilities or guarantees. The local tournament reward path remains disabled on the zero-cost build. Browser screenshot automation was blocked by environment policy, so no new 10-pull screenshot was included.
