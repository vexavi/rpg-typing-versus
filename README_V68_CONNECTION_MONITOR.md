# RPG Typing Versus v68 — Zero-Polling Firebase Online Monitor

**Based on v67 Zero-Cost (GitHub Pages + Firebase Spark + local classroom tournament server).** This is a code update, **not a deployed release**. No paid Cloud Functions/Cloud Run required. Keep your Firebase project on **Spark without a billing account**.

## What's different from v67

| Action | v67 | v68 |
|---|---|---|
| Solo entry | Firebase Auth + Firestore config read | Same + RTDB `.info/connected` required |
| During solo play | One Firestore config read every 60 seconds while tab is visible | **No scheduled Firestore online checks**; one RTDB connection-state listener per open game tab |
| Start a run | Server reads grade vocabulary/ruleset/settings | Same |
| Run finish | Firestore score/progress submission | Same; must be connected when submitted |
| Ranking screen | Firestore top-20 listener while open | Same |
| LAN tournament internet gate | Once-minute external HTTP reachability request | RTDB `.info/connected` listener, no scheduled external request |
| Drop connection | Overlay; invalidate ranked run after detection | Overlay; invalidate ranked run **when the SDK reports loss**; reload required |

**What this does not do:** RTDB's `.info/connected` is a client-specific signal, not an infallible instant internet probe or server-side proof of continuous connectivity. Transient network failures can be detected late. Scores remain **browser-reported**, not cheat-proof. The local tournament server still handles authoritative tournament combat independently. Offline play and offline score queues are not added.

## Mandatory one-time Firebase setup (existing v67 users)

1. Open **Firebase Console → Build → Realtime Database → Create Database** in the *same* project as Firestore. Choose an available location, start in **locked** mode (not public test mode). Spark supports the default database instance; check the Console first if one already exists.
2. Copy the **exact Database URL** visible in the Realtime Database console. It will typically have the form `https://<database>.firebaseio.com` or `https://<database>.<region>.firebasedatabase.app`. Do **not** guess the region from your Firestore project ID.
3. Paste the URL between the quotes in **both** `github-repository/docs/realtime-config.js` and `tournament-local/realtime-config.js`. Blank or invalid URLs intentionally block gameplay. The database URL is a public project identifier, **not** a service-account key.
4. Back up current RTDB security rules. The included `github-repository/database.rules.json` denies all ordinary data reads/writes (`.read: false`, `.write: false`). The Firebase SDK's special `.info/connected` path does not need to store user presence records. To publish the included rules, run the following in `github-repository` with Firebase CLI installed and the correct Firebase project selected:

   ```sh
   firebase login
   firebase use --add
   firebase deploy --only database
   ```

   **Deploying rules overwrites rules currently published in that Realtime Database.** If you already use RTDB for other apps, **do not blindly replace existing rules**; merge your existing rules carefully or use a separate project/database (subject to Spark limits).
5. If your GitHub Pages repo is already created, replace/update its `/docs` files and `firebase.json`, `database.rules.json`, and README. Only publish when you are ready; local testing can happen before pushing to GitHub.
6. Test on a student Chromebook: sign in using Adventure Card, start a Normal run, disconnect Wi-Fi, verify the blocking overlay and invalid ranking, reconnect and reload to begin a fresh session. Test another Chromebook simultaneously. Check the Firebase Realtime Database **Usage** and Firestore **Usage** screens.

### No Firestore migration required

No changes to `players`, `vocabPools`, `rankEntries`, `sparkRuns`, `systemConfig`, or `gameBalance`. Your grades (including shared B-group vocabulary), profile icons, score versioning and rankings are unchanged. **Do not copy or overwrite your live databases.**

## Firebase limits, 65 students and zero billing

- On **Spark**, Realtime Database permits **100 simultaneous connections**. In a typical classroom with 65 student browser tabs plus one teacher, this should fit, but a second tab or open local tournament window counts separately. 100 is a hard cap; leave headroom. See https://firebase.google.com/docs/database/usage/limits .
- RTDB has a **separate download/transfer allowance** (10 GB/month on Spark at the time of this release). Listening to `.info/connected` does **not** use Firestore document reads, but the connection itself still uses RTDB resources.
- Firestore still charges for normal profile, vocabulary, score, config and leaderboard reads/writes. A one-time startup `systemConfig/current` read is retained so missing setup is detected. **No one-minute repeating Firestore read remains in the GitHub solo game.**
- Keep Spark without billing; if free limits are exhausted, affected features may stop until quotas reset. Do not enable Blaze for this version.
- Do not put local tournament files, card QR secrets or SQLite student databases in the **public** GitHub Pages repository.

## Local testing (before uploading to GitHub)

From `github-repository/docs/` on Windows:

```bat
py -m http.server 5500
```

Open `http://localhost:5500/adventure.html`. For a safe rehearsal without real student records, use a separate Firebase test project or local Firebase emulators; RTDB and Firestore emulators require their own configuration and are not automatically enabled by this ZIP. If localhost sign-in fails, configure it as an authorized authentication domain if appropriate. A local web server alone still connects to your **real** configured Firebase project.

`TEST_V68_CONNECTION.cjs` contains automated source and mocked connection-flow checks. Run with Node:

```sh
node TEST_V68_CONNECTION.cjs
```

## Which files changed

- `github-repository/docs/online-spark.js`: RTDB listener, startup gate, no repeating Firestore check, fail closed.
- `github-repository/docs/online-boot-v66.js`: prevents Adventure engine loading when startup connectivity fails.
- `github-repository/docs/realtime-config.js`: exact URL entered here.
- `github-repository/database.rules.json` and `firebase.json`: locked RTDB rules deployment.
- `github-repository/docs/traffic-budget.html`: estimate no longer scales reads by online minutes.
- `tournament-local/tournament-online-gate.js`: RTDB listener for tournament pages instead of once-minute HTTP probe.
- `tournament-local/server.py`, `index.html`, `realtime-config.js`: serve and import the new module/config.

## What has not been verified

Full browser and Chromebook testing, live Firebase SDK connection changes, RTDB permission behavior against your actual project, Firestore rule deployments, a 65-device load test, and all live tournament interactions. These require your configured Firebase project and school network. Do not treat this as a deployed or classroom-verified update.
