# RPG Typing Versus v72.2 — Featured Banner Only

## Changes
- One recruitment banner: **Featured**. The Standard banner selector and default were removed.
- Existing teacher title, category, subtitle, description, and tab-label editing are retained, with a single Featured editor.
- The student page continues to show a single, non-clickable Featured banner identifier; all artwork remains a placeholder until supplied.
- The cloud reader **ignores legacy Standard entries** from an earlier two-banner Firestore document. Teacher's first save replaces that document with a one-banner schema, incrementing its revision.
- The new Firestore rule accepts **exactly one** `featured` banner record. Deploy the updated `firestore.rules` before the teacher's first save.
- 4★ / 5★ / 6★ reveal demo and 1-pull/10-pull UI remain unchanged. Odds and reward transactions still **not implemented**.
- No extra Firebase listeners or polling are introduced; the banner document is read only on page/editor visit.

## Deploy
1. Upload the updated GitHub repository `docs/` to your GitHub Pages repo.
2. Deploy the new `github-repository/firestore.rules` in Firebase Console.
3. Open `recruitment-admin.html` and sign in as your authorized teacher.
4. Verify the saved Featured text. Press **Save to Firebase** once to migrate any legacy two-banner document to one Featured banner. Old Standard text is discarded.
5. Reload `recruitment.html` to see the Featured banner only.

**Note:** v72.2 is a code package, not a live deployment. Do not enable billing; this change uses the existing Spark services.
