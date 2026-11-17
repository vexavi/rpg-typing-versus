# v76 Teacher Guild Coin Grant Test Report

## Automated checks (local)

- `node --check docs/guild-grants-core.js`: PASS
- `node --check docs/guild-grants.js`: PASS
- `node TEST_GUILD_GRANTS_v76.cjs`: PASS — 71 validation/integration checks
- `node TEST_GUILD_GRANTS_UI_v76.cjs`: PASS — mocked teacher sign-in, fetch player list, select player, grant +100, confirm balance 500→600 and receipt created, prevent zero amount, prevent disabled player grants
- `node TEST_GUILD_COINS_v73.cjs`: PASS — 120 prior currency checks
- `node TEST_AURAS_v74.cjs`: PASS — 886 prior aura checks
- `node TEST_ROSTER_v75.cjs`: PASS — 112 prior roster checks

The mock browser test does **not** connect to Firebase; it validates the UI transaction logic against in-memory Firestore stand-ins.

## Not verified / requires deployment

- Live Google sign-in to the configured teacher account
- Firestore rule compilation and runtime evaluation (Firebase Emulator Suite unavailable here)
- Actual concurrent live Firestore transactions / network retries
- Full Chromium/Chromebook browser rendering (headless browser was blocked in this environment)
- Publishing GitHub and Firestore rules to the school project

No grants or changes were made to the user's live Firebase project. No character recruitment, coin spending, or shard awarding was activated.
