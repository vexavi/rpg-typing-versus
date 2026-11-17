# RPG Typing Versus v71 — Recruitment Banner Editor

## What changed
- Added `docs/recruitment-admin.html`, linked from teacher tools.
- Teacher can edit Featured and Standard banner **tab label, heading, large title, subtitle, and description** in Firebase Firestore without republishing GitHub.
- The student Recruitment screen reads `recruitmentConfig/banners` one time per page visit and merges text onto packaged `recruitment-banners.json` without overwriting artwork paths.
- Teacher editing is protected by the existing configured teacher UID and Firestore security rules; students have read-only access.
- Every write increments a revision; simultaneous editor tabs receive a conflict error rather than silently overwriting changes.
- No Firestore polling or realtime listener added; one get per Recruitment visit and one get when teacher opens the editor. A save uses a transaction.
- Pulls, currency, rates, and reward behavior stay **disabled** (same as v70). No paid cloud backend.

## Deploy
1. Back up your current GitHub source and Firestore rules.
2. Publish the contents of the included GitHub repository to your existing GitHub Pages repository (`docs/` folder).
3. In Firebase Console, deploy the updated `firestore.rules` from this package. **Publishing GitHub alone does not grant the new document permissions.**
4. Keep the existing Spark plan and Realtime Database configuration. No new Firebase service required.
5. Open `https://YOUR-GITHUB-PAGES-URL/recruitment-admin.html` (if your Pages publishing root is `docs/`, this is relative to that Pages site). Sign in with the same authorized Google teacher account as for the Vocabulary Manager.
6. Edit the banner and press **Save to Firebase**. Reload Recruitment to verify the updated text.

## Defaults and future images
- The packaged `docs/recruitment-banners.json` remains the fallback if no Firestore override has been saved.
- Artwork paths are still managed in that JSON file and can be added later. This teacher editor does not upload media.
- Banner IDs remain `featured` and `standard` and cannot be renamed. Displayed titles and tab labels can be changed.
- If you previously enabled another client/server that does not use this Firestore data, its banner text will not automatically change.

## Limits / security
- Teacher UID is configured in both `online-spark.js` and `firestore.rules` as before; teacher Google sign-in is mandatory.
- Firestore rules validate only the banner-text schema. They do not enable recruitment transactions.
- The game remains online-only. Live changes show on students' next visit/reload, rather than altering an already-open recruitment screen.
- Live Firebase and real Chromebook end-to-end behavior cannot be verified until the files and rules are deployed to your Firebase project.
