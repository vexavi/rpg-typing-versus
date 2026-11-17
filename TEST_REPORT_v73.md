# v73 Guild Coin Implementation — Test Report

**Automated local tests**

- PASS — JS syntax (`online-spark.js`, `guild-coins.js`, `adventure_engine.js`, `story-mode.js`, `profile.js`, `online-boot-v66.js`).
- PASS — `node TEST_GUILD_COINS_v73.cjs`: 120 checks. Normal 90%/89% payout; Extra high/low accuracy; Story first/replay; duplicate first/replay and rank tokens; Story not completed denial; Practice exclusion; zero-answer denial; 100 successive uncapped rewards; no diminishing returns; costs 100/1000.
- PASS — `node TEST_V69_ASSETS.cjs`: 18 asset/preload/cache/startup checks after updating preload script version to v73.
- PASS — no character awarding, permit exchanges, active pity or draw side effects added; v72.2 featured-only banner remains.

**Required live checks:** Firebase Rules compiler / emulator, authenticated transaction and security-rule permissions, race conditions across browsers, flaky network behavior, profile reload, real Chromebook test, 65-player capacity. No Firebase project credentials were available in this environment; none of these have been falsely marked as tested.

**Caveat:** client-reported earnings are not cheat-proof and must not be used as trusted redeemable currency. The previous local profile icon coin balance is separate.
