# v83 — First-time tutorial, daily free pulls, real recruitment

**Latest deployment instructions:** [README_V83_TUTORIAL_RECRUITMENT.md](README_V83_TUTORIAL_RECRUITMENT.md). This version supersedes older README statements saying recruitment is visual-only. Firestore rules **must be published before** new players register with v83. Pulls are real and use browser-reported RNG, not cheat-proof; confirm Firebase rules with a disposable card before classroom rollout.

## New in v76: Teacher Guild Coin Grants

Open **`docs/guild-grants.html`** (or use the link in the Recruitment Banner Editor / Game Settings) to choose a registered player, enter a Guild Coin amount, confirm it, and write an audited Firebase transaction. Only the configured teacher Google account can grant. New Firestore rules must be published. See [README_V76_GUILD_COIN_GRANTS.md](README_V76_GUILD_COIN_GRANTS.md). Actual recruitment pulls remain disabled.

## New in v75: 14-character artwork roster and featured selector

Read [README_V75_OPERATOR_ART.md](README_V75_OPERATOR_ART.md). Eight 4★, three 5★ and three 6★ characters have been imported as transparent WebP. Tavi is initially featured; the teacher can switch among existing 6★ characters through the Recruitment Banner Editor without renaming files. Pulls and rewards remain visual-only.

## New in v73: Balanced Guild Coin Earnings

See [README_V73_GUILD_COINS.md](README_V73_GUILD_COINS.md) for reward conditions and deployment steps. Normal: 10 +5 accuracy bonus; Extra: 15 +5; first Story battle clear: 20; Story replay: 5. No daily cap or diminishing returns. Guild Coins persist to Firebase with idempotent receipts; recruitment pulls are still **disabled** and browser-reported earnings are **not cheat-proof**.

# RPG Typing Versus v67 — Zero-Cost Edition

**Deployment package — NOT deployed.** v67 is designed to run with **GitHub Pages (free public repository) + Firebase Spark (no billing account) + a teacher-laptop Python server during tournaments**. Students **must have a live internet connection**; v67 does not enable service-worker or Firestore offline persistence. Solo gameplay runs in the Chrome browser and exchanges only necessary data with Firestore.

## Architecture and limitations (read before replacing v66)

| Feature | v67 | Where |
|---|---|---|
| Normal, Extra, Practice, Story, shared challenge | Online-only | GitHub Pages JavaScript + Firestore |
| Static images/audio, mechanics, published story chapters | Free hosting | GitHub Pages |
| Vocabulary editor (1/2/3/B/all) | Teacher-managed | Firestore, one document per group |
| Player cards, grade assignments, progress, selected icon | Online | Firestore |
| Normal/Extra/Shared leaderboards | Top 20 live only while open | Firestore listener |
| Teacher falling speed, spawn rate, mechanic parameters | Prefetched at **run start** | Firestore |
| Multiplayer tournament combat | Local Python authority, at school | Teacher laptop, `tournament-local` |
| Global coins, daily 10-pull, recruitment, trust-sensitive rewards | **Disabled** | No trusted zero-cost cloud backend |
| Verified solo anti-cheat | **Not provided** | Scores/XP are browser-reported |
| Automatic tournament trophy sync to cloud profile | **Not provided** | Tournament results remain in local SQLite |

This is an **intentional trade-off**, not a claim that all v66 features have equivalent no-cost replacements. Existing Firestore coin balances, if present, are not removed, but are **read-only/frozen** in this build. The offline/local cosmetic coin display in the older engine is not a cloud wallet. Don't award competitive advantages based on unverified solo scores.

## What's inside this ZIP

- `github-repository/docs/`: **only public assets and web pages**; this is the GitHub Pages root.
- `github-repository/firestore.rules`, `firestore.indexes.json`, `firebase.json`: Firebase Spark-compatible Firestore deployment rules and query indexes.
- `github-repository/.gitignore`: blocks local database and service-account files if using Git.
- `tournament-local/`: classroom server with existing v65.5 competitive engine, card tools and internet gate. **Keep private student records on your teacher laptop**.
- `TEST_REPORT_v67.md`: static/syntax and local HTTP checks, with unverified items disclosed.

## Step 1 — Create a **public** GitHub repository

GitHub Pages on GitHub Free supports public repositories. Create e.g. `rpg-typing-versus`. Copy the **contents** of `github-repository/` into the new GitHub repository (not the `tournament-local/` folder). In **Settings → Pages**, set **Deploy from a branch → main → `/docs` → Save**. The site will be `https://YOURUSERNAME.github.io/rpg-typing-versus/` (replace placeholders and inspect the live URL). Note GitHub Pages has soft bandwidth and site-size limits. A public repo means the game source/assets are publicly visible; never commit student data, QRs/card-code backups, SQLite databases or service account secrets.

## Step 2 — Firebase **Spark** (never enable billing)

1. Confirm your project ID in `docs/cloud-api.js` is `rpg-typing-versus` or change it consistently. Do **not** deploy the v66 `functions/` or `tournament-cloud/` directories; those aren't included in v67.
2. In Firebase Console, use **Spark** and verify **there is no linked billing account**. If v66 Cloud Functions or Cloud Run were previously deployed, back up and retire them before changing plans. Do not enable Blaze for this edition. No-cost quotas are hard stops; features may fail when you run out of quota, but Spark itself does not charge overage.
3. Enable **Cloud Firestore Standard**, **Anonymous Authentication** (students), and **Google Authentication** (teacher).
4. Add your GitHub Pages domain (`YOURUSERNAME.github.io`) to **Authentication → Authorized domains**. For local teacher card tools, allow localhost if needed.
5. Verify the real teacher Firebase UID. The bundled files contain the **placeholder/previous UID** `1BsaIx7kcfUSRO3rhNbHsJPRHkw1`. If different, update **all three**: `github-repository/firestore.rules`, `docs/online-spark.js`, and `docs/setup-spark.html` **before** deploying. The teacher UID is an access-control identifier, not a secret.
6. Install Firebase CLI if you haven't: `npm install -g firebase-tools`. In the `github-repository/` directory run `firebase login`, `firebase use --add` to select your project, then `firebase deploy --only firestore:rules,firestore:indexes`. This deploys database rules and indexes only; it does **not** deploy paid Functions, Cloud Run, or Firebase Hosting.
7. Open your GitHub Pages site at `/setup-spark.html`, sign in with the authorized Google account, click **INITIALIZE MISSING POOLS**. It creates missing Standard 1/2/3, combined B, and All Grades vocabulary and config documents; existing pools and player progress are preserved.
8. Use `/cloud-cards.html` to create/import Adventure Cards and `/rankings-admin.html` to assign class. The standard ranking UI shows 1年生, 2年生, 3年生, and All Grades; B-class ranking tabs remain hidden.
9. Teacher `/vocabulary-admin.html` adds/edits/disables/imports words. Each actual edit increments that pool's revision so old scores aren't mixed with new rulesets.

**Card migration:** Import a **private** exported card JSON with `/cloud-cards.html` if you already have cards. If your original player records live only in SQLite, the old v66 migration tool can be used separately by an authorized administrator with private credentials; it is intentionally **not shipped in the public repo**. Cloud Firestore `players` from a previously deployed v66 backend are reused. Never publish the private JSON or SQLite DB.

### Login model

Students authenticate anonymously with Firebase, then enter a 16-character **Adventure Card code**. The card code acts as an account credential; anyone who learns someone else's code can access that card's progress. Keep QR cards private and reissue a code if compromised. Scores remain browser-reported and can be falsified by a determined student.

## Step 3 — Classroom tournaments

- Keep `tournament-local/` **outside your public GitHub repository**. Back up your real existing `player_cards.db`, and copy it into this folder **while the old server is stopped**; do not copy the blank database from another ZIP over real student progress.
- Double-click `tournament-local/START_TOURNAMENT_WINDOWS.bat` (Python 3 required). Students on the same network use your laptop's LAN address (for example, `http://TEACHER-IP:8765/`), not GitHub Pages. Set up the Windows firewall appropriately for LAN use.
- The local tournament UI checks external Firestore reachability at entry and every 60 seconds. If the connection drops, an overlay blocks the game and requires a reload. This is an **internet-reachability check**; it does **not** synchronize active rounds to Firestore or guarantee that Firestore quotas remain available.
- If you use cards created in Firebase, open `http://localhost:8765/cloud-cards.html` on the teacher laptop and select **Sync local** to import those cards into the tournament database (after backup). The original Cloud Cards page has this facility. If it doesn't work, use its private JSON export/import workflow and inspect errors; do not generate a second set of conflicting player IDs.
- Tournament rounds and awards are authoritative **inside the local server**, but the resulting trophies/rewards are **not automatically merged with Firestore profiles**.

## Traffic controls

- No keystroke, falling word or per-word reward calls to Firebase.
- No realtime listeners for every stage. Balance and vocabulary are read at run start (roughly one to several documents per run), and stay locked until a new run.
- One connection validation read **at entry and at most once per visible minute**. The browser's `offline` event blocks play immediately when available. Some disconnections may be detected at the next check, up to about a minute later.
- Leaderboards query the top 20 and subscribe **only while open**. Reconnects and individual score updates incur more reads; opening an initial query plus a listener can load the same entries twice.
- No daily writes for empty activity, no Firestore offline persistence, no upload of art/music to Firebase Hosting.
- The static `traffic-budget.html` calculator gives **illustrative estimates only**. For actual Firestore usage, check **Firebase Console → Firestore Database → Usage**. Rules' `get()`/`getAfter()` checks also contribute reads; the estimate is not authoritative.

Firestore's standard free daily quota is **50,000 document reads and 20,000 writes** with 1 GiB of free storage. The entire project shares those limits; sustained abuse or a burst of activity could exhaust them. Stay on Spark without billing so service **stops at limits rather than charging**. GitHub Pages has a **100 GB/month soft bandwidth limit** (and 1 GB published-site size limit). These services' quotas are distinct; GitHub Pages cannot host or replace authenticated Firestore database operations.

## Known limitations / manual verification still required

- The Firebase SDK needs working Auth providers, correct project ID, and deployed Firestore rules/indexes. **We have not deployed v67 to your account**.
- The Firestore rules could not be compiled with Firebase's emulator in this environment; syntax and permissions must be tested **against an emulator or a disposable Firebase project** before rollout. Do not overwrite live rules without a backup.
- Full Chrome/Chromebook gameplay and end-to-end cross-device sync **have not been browser-tested** in your project. Migration of existing cloud data also requires a real test.
- Existing solo game mechanics are preserved from v66; some older editor pages needing the paid backend are deliberately omitted from public Pages. Story chapter content changes still require GitHub redeploy.
- Firebase/Google authentication may not permit localhost/IP origins until authorized domains are configured. We have not verified your school's network policy.
- The rank rules limit submitted score format, class, config revision and elapsed time, but **cannot verify the student's actual keystrokes**. Shared rankings are suitable for friendly class competition, not secured contests or scarce rewards.

## Free-tier documentation

- Firestore quota: https://firebase.google.com/docs/firestore/quotas
- Firebase plans: https://firebase.google.com/pricing
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## v68: Zero-polling online monitoring

- Create a **Realtime Database** in your existing Firebase Spark project. Copy its precise URL into `docs/realtime-config.js`. Do not guess its region or use the Firestore project URL.
- Deploy `database.rules.json` (deny reads/writes to application data) using `firebase deploy --only database` after reviewing rules. The special SDK path `.info/connected` is client-side connection state and requires no ordinary data writes.
- v68 subscribes to `.info/connected` while the web app is open; no 60-second Firestore heartbeat. Start-up performs one real Firestore configuration read. Normal Firebase actions still read/write as before.
- If connectivity is lost after login, the active ranked run is marked interrupted and a blocking overlay requires reload; no local/offline progress queue. Initial Firebase connection failure blocks entry.
- Spark Realtime Database supports at most 100 simultaneous connections. One tab is generally one connection, so 65 students leave limited headroom for other tabs/devices. RTDB has a separate download quota.
- Do **not** upload tournament-local or any private student data to your public repository.
- For complete steps, see `README_V68_CONNECTION_MONITOR.md` in the release package.


## v71 — Recruitment Banner Editor

The authorized teacher can change the Featured and Standard Recruitment banner text from `docs/recruitment-admin.html`, then save it directly to Firestore. No GitHub republish is needed for subsequent text edits. The student `docs/recruitment.html` reads the saved text at page open; artwork still comes from `docs/recruitment-banners.json`. Publish the updated `firestore.rules` before the first save. See `README_V71_BANNER_EDITOR.md`.

## v74 — Aura Workshop

See [README_V74_AURA_WORKSHOP.md](README_V74_AURA_WORKSHOP.md). The Aura Workshop adds collectible cosmetic glows with total costs of **10 / 30 / 70 / 150 Character Shards**. Student spending is constrained by Firestore rules; teacher-only test grants are available from `docs/aura-admin.html`. Real character pulls and duplicate shard awards remain disabled until an authoritative backend is ready. `docs/auras-demo.html` provides a no-Firebase visual demo.
