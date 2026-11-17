# v78 — Original MC artwork: local test report

- Source image: `MC.png`, 1024×1536, RGBA with transparent corners.
- Tournament image: `tournament-local/assets/characters/mc.webp`, 1024×1536, 131,538 bytes, RGBA transparency retained.
- GitHub preview asset: `docs/assets/characters/mc.webp`, 768×1152, 89,040 bytes, RGBA transparency retained.
- Tournament `CHAR.crimson_knight.path` points to `/assets/characters/mc.webp`, while the server's forced ID remains `crimson_knight` to preserve room/player data.
- Existing Crimson Knight/Silver Knight cosmetic art stays untouched; recruitment roster and gacha art stay untouched.
- `TEST_FIXED_MC_v77.py`: 8/8 passed (join, legacy request, switch protection, profile retention).
- `TEST_MC_ASSET_v78.py`: all integration assertions passed.
- `TEST_V69_ASSETS.cjs`: 18 asset/cache/startup checks passed.
- `TEST_GUILD_COINS_v73.cjs`: 120 checks passed.
- `TEST_GUILD_GRANTS_v76.cjs`: 71 checks passed.
- `TEST_GUILD_GRANTS_UI_v76.cjs`: passed.
- `TEST_AURAS_v74.cjs`: 886 checks passed.
- `TEST_ROSTER_v75.cjs`: 112 checks passed.

**Limitations:** Actual Chromebook render and Firebase deployment were not tested. No change to Firestore rules required for the MC artwork.
