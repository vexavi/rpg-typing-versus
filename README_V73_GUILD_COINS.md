# RPG Typing Versus v73 — Balanced Guild Coin Earnings

This release **implements Guild Coin earning and Firebase persistence**. It does **not** activate real recruitment pulls, daily free pulls, permits, character awards, or pity. Guild Coins are *client-reported/unverified*, so the browser-only Firebase Spark architecture cannot guarantee they were earned through real gameplay.

## Balanced earning rules

| Mode | Payment trigger | Base | Bonus | Maximum |
|---|---|---:|---:|---:|
| Normal | All 5 stages cleared and ranked result accepted | 10 | +5 when entire run accuracy >=90% | 15 |
| Extra | All 5 stages cleared and ranked result accepted | 15 | +5 when entire run accuracy >=90% | 20 |
| Story battle (first time) | Battle victory **and** cloud Story progress save succeeded | 5 | +15 once per stage | 20 |
| Story battle (replay) | Battle victory and cloud progress save succeeded | 5 | 0 | 5 |
| Story-only scene | No reward | 0 | 0 | 0 |
| Practice | No reward | 0 | 0 | 0 |
| All Grades challenge/shared | No reward | 0 | 0 | 0 |
| Tournament | No automatic reward; teacher awards not implemented | 0 | 0 | 0 |

**No daily coin cap, no diminishing returns, and no automatic daily resets.** Normal/Extra accuracy = correct submitted word answers / (correct submitted word answers + incorrect submitted attempts). Frozen/hacked input recognized and ignored does not count as a mistake; using Continue does not reset run counters. Stage 1–4 clears alone do not pay Normal/Extra coins.

**Recruitment preview prices:** 100 Guild Coins for one pull; 1,000 for ten pulls. Prices are informational only. The free daily ten-pull discussed in planning is **not yet active**.

## Deploy

1. Back up your current Firebase Firestore rules and GitHub Pages repository.
2. Update **GitHub Pages contents** with the files in this ZIP's `docs/` directory, including the new `guild-coins.js` and `guild-coins.css`.
3. Publish the updated **`firestore.rules`** in your Firebase project's Firestore Rules console. For projects using the Firebase CLI, deploy the `firestore.rules` from this package. GitHub uploads by themselves **do not** deploy Firestore rules.
4. Check that your existing Firebase Spark setup is working (cards, login, Firestore, Realtime Database connection monitor). No Cloud Functions, Cloud Run, or paid plan is required for unverified earning.
5. Test using a **test student Card**: Normal 90% clear should show +15; Normal <90% +10; Extra 90% +20; Story first completed *battle* +20, replay +5. Open `profile.html?tab=recruitment` or `recruitment.html` and confirm Guild Coins persist after reload.
6. Do **not** enable real recruitment spending on these balances without a trusted backend that independently validates gameplay and handles randomness/pity/ownership authoritatively.

### Game finish behavior

- Normal/Extra Victory displays **SAVING GUILD COINS...**, then amount earned and total balance; MENU re-enables after the save attempt. If submission/claim fails, it shows `RANK NOT VERIFIED` or `COINS NOT SAVED`.
- Story battle finish displays coin award on its result screen; Story-only cutscenes never pay.
- The existing local `profile.coins` used for icon purchases is **not** Guild Coins and has **not** been converted.
- A duplicate submission of the same run/attempt is recorded only once, including retries. The UI labels already-claimed attempts.

### First-clear migration behavior

First-clear Story bonuses use cloud-completed stage state. A stage already marked as completed *before* v73 is treated as a replay and gets 5 coins when replayed, even if this is its first Guild Coin claim.

### Firebase costs and security

Guild Coin claims use one **transaction** that creates one `guildClaims` receipt and increments `players/{playerId}.recruitment.coins`, then returns the new balance. Security rules enforce single-create receipts, matching wallet deltas, small payouts, owner authorization, and rank-token matching. Reads occur on claim only, not per typed word. Actual Firestore reads include security-rule lookups and vary by operation; there is no artificial daily cap, but Spark's Firebase quotas still apply.

**Not anti-cheat:** The client decides whether a Story battle occurred and supplies right/wrong counts for the 90% bonus; even submitted Normal/Extra rankings are client-reported. Firestore security rules prevent simple duplicate payment and unrestricted wallet writes, but cannot prove legitimate typing. The current coins are *not spendable* on characters. Security claims must not be represented as server-verified.

### Test status

`node TEST_GUILD_COINS_v73.cjs` — 120 pass (including 100 repeated clears, idempotency, correct/incorrect threshold, Story first/replay). `node TEST_V69_ASSETS.cjs` — 18 pass. JavaScript syntax checks pass. Live Firebase rule compilation, actual permission tests with student/teacher accounts, and 65-student classroom load tests **have not been run**. Back up and validate rules on a test project before production.
