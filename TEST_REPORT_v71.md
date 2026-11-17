# RPG Typing Versus v71 — Banner Editor Test Report

## Verified in this environment
- All public JavaScript files pass `node --check`.
- Five utility assertions pass: cloud text merging, preservation of packaged artwork, fallback of the Standard banner, valid schema, rejection of blank/mismatched/oversized titles.
- Isolated Chromium DOM tests passed with a simulated Firebase bridge: load default titles, live preview, save Featured title, switch/save Standard title, switch back without losing edits, and display saved titles in the student Recruitment screen.
- The new API routes are registered **before** the existing disabled-recruitment catch-all route.
- Firestore rules provide signed-in read access and teacher-only creates/updates for `recruitmentConfig/banners`; titles are rendered as text (not HTML).
- This update does not change score, tournament, wallet, recruitment draw, or player data logic.

## Not verified
- The environment blocks Chromium navigation to local and external URLs, so the tests used `page.set_content()` and mock cloud operations, not a fully networked Firebase integration.
- Firestore rules could not be evaluated in a live Firebase emulator here; deploy rules and verify authorized teacher save, denied student save, and student read on your actual project.
- GitHub Pages deployment, connection-monitor behavior with real student accounts, and Chromebook responsive/real-device behavior remain unverified.

## Deployment requirement
Publish both the updated GitHub Pages files **and** `firestore.rules` before using the editor. GitHub Pages alone cannot enable permission to write the new Firestore document.
