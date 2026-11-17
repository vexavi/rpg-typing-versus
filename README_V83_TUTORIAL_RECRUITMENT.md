# RPG Typing Versus v83 — First-Time Tutorial + Real Recruitment

**Deploy Firestore rules before uploading the new GitHub Pages client.**

## Student flow

1. Scan printed `adventure.html?card=...` QR. New card: enter a name once; registered card: automatic login.
2. Start screen (MC silhouette, or profile-selected operator) → **Start**.
3. Only new v83 accounts (profile `tutorial.version == 0`) enter `tutorial.html`:
   - Lesson 1: type a stationary word (apple).
   - Lesson 2: clear three slow falling words (cat, sun, book).
   - Lesson 3: defeat the training boss by typing three words (green, water, happy).
   - Lesson 4: select Recruitment from a guided Mode Select, then use the **first free 10-pull**.
4. Star-first reveals show actual recruited characters. Recruitment outcomes and duplicate shards are saved before the reveal begins. On returning mid-reveal, the player sees saved results rather than receiving another pull.
5. Tutorial completion is stored in Firestore (`tutorial.version = 1`) only after the reveal results page is closed. Mode Select opens. Existing profiles lacking a `tutorial` field are considered already onboarded and skip the tutorial.
6. The **How to Play** menu option replays lessons with non-rewarding example results.

## Recruitment settings

- **One Featured Banner**. First featured 6★: **Tavi**. Change it using the existing teacher Recruitment Banner Editor; files are not renamed.
- Base odds, per roll: 4★ 91.2%, 5★ 8%, 6★ 0.8%.
- Guarantee 5★ or higher within 10 consecutive pulls.
- 6★ chance is 0.8% through pull 65; from pull 66 increase by 5 percentage points per pull; guaranteed by pull 80. On any 6★, pity resets.
- Featured 6★ chance 50%; losing makes the next 6★ featured. Both counters carry over across Featured Banner rotations.
- Real single pull costs **100 Guild Coins**; real 10-pull costs **1,000 Guild Coins**. Ten consecutive pulls advance the same counters.
- Each day students may claim **one free 10-pull** after a qualifying completed run has produced a Guild Coin receipt **that day (Japan time)**. The tutorial's first free 10-pull counts as that day's claim. No Guild Coin earning cap or diminishing returns.
- Duplicate Character Shards: 4★ +1, 5★ +3, 6★ +8. Aura Workshop remains 10/30/70/150 total shards for White/Azure/Violet/Gold. Duplicates and purchases update the same Firebase player record transactionally.
- Pull receipts live in `recruitmentDraws` and are immutable. Tutorial/daily free pulls use deterministic IDs (`playerId__daily-YYYY-MM-DD`) to avoid duplicate free claims across reloads/devices.
- `profile` now offers every recruited owned character in the Featured Operator selector. Start-screen silhouette uses that selection. MC remains the default and is not recruitable.

## Deployment order (first installation)

1. **Back up your Firebase data.** Keep a copy of any earlier Firestore rules before replacing them.
2. In Firebase Console, enable **Anonymous Authentication** for student cards and Google Authentication for the authorized teacher. Use the existing project on the free **Spark** plan.
3. Create/enable Firestore and Realtime Database. In Firebase Console, publish `firestore.rules` and `database.rules.json` from the `github-repository` folder. If you previously installed rules, **publish the new `firestore.rules` before any new student registrations**: the new player document contains tutorial fields, and old rules would reject it.
4. Confirm the web Firebase configuration in `docs/cloud-api.js` matches your project and `docs/realtime-config.js` has the correct **Realtime Database URL**. Confirm the authorized teacher UID in `docs/online-spark.js` matches `firestore.rules`. Do not enable billing, Cloud Functions, or Cloud Run for this build.
5. Push the contents of `github-repository` to GitHub. In GitHub Pages, select the branch and `/docs` site folder. Open `https://YOUR-SITE/adventure.html` to verify it loads.
6. Sign into the teacher's `setup-spark.html` once to install/configure initial vocabulary and system settings if this is the first Firebase deployment; issue/assign student cards through `cloud-cards.html`.
7. Before using real student cards, create **one disposable test card**. Check first-time QR → name registration → Start → Lessons 1–4 → free 10-pull → saved collection. Reload during the 10-pull reveal and confirm it resumes instead of granting another. Check that the same date cannot grant a second free 10-pull.
8. Test with an old registered card (should skip the tutorial); test a normal clear, a Guild Coin claim, a paid pull, an aura purchase, and the next day's free 10-pull. Confirm your Firestore permissions actually allow the new transactions in the deployed project.
9. Keep the tournament Python files in `tournament-local` on your laptop. v83's tutorial and gacha do not require the laptop tournament server to be online.

## Known limitations, verify before students use it

- **Browser-generated drop results can be manipulated** by a technically motivated student. Firestore rules verify matched receipt/coin/collection writes and block basic duplicate free claims but **cannot prove honest gameplay, RNG, or the browser's calendar**. This is a deliberate classroom-grade trade-off for a ¥0 serverless setup.
- The new Firestore transaction rules have been statically reviewed but **have not been verified against your live Firebase project or a Firestore emulator**. If you receive `permission-denied` during testing, do not hand out live QR cards yet; inspect the rule evaluation before deployment.
- The browser preview environment used for this build blocked loopback navigation; there is **no claim of full live Chromebook/Firebase end-to-end testing**. Use `docs/tutorial-preview.html` for a local UI-only demo (it does not connect to Firebase or award anything).
- Free 10-pulls require the **most recent Guild Coin reward receipt** to be dated today in Japan. This is a concrete completion requirement, rather than just opening the app once.
- A printed QR card remains a **bearer credential**. Anyone who obtains the image/code may open that card's profile.
- Profile/tournament cosmetic appearance does not change battle damage or rank. Recruitment characters are cosmetic collectibles.

## Key files

- `docs/tutorial.html`, `docs/tutorial.js`, `docs/tutorial-preview.html` — four onboarding lessons and local UI demo
- `docs/recruitment-core.mjs` — rates, pity, featured guarantees, duplicate shards
- `docs/recruitment.js`, `docs/recruitment-reveal.js` — spend coins, claim the daily free 10-pull, star-first reveals
- `docs/online-spark.js` — Firestore transactions and state checks
- `firestore.rules` — new tutorial progress and recruitment receipt / wallet permissions
- `TEST_RECRUITMENT_v83.mjs`, `TEST_TUTORIAL_v83.cjs` — static/rate tests
