# v81 — QR Auto Login (GitHub Pages + Firebase Spark)

## Student flow

- Print an Adventure Card using the existing teacher Cloud Cards page. Its destination URL must be the game's `adventure.html`, including `?card=CODE`. You do not have to reprint existing QR cards whose links already contain `?card=`. Older cards pointing to `index.html?card=...` also work because the root redirect now retains the query.
- First scan: open the URL, verify the card online, ask **only for a username**. The game registers the username to the card and opens the v80/v81 title screen.
- Subsequent scans: open the same URL, verify the registered card online, load progress and profile, and open the title screen **without any login fields or second PLAY button**. The student still presses **Click to continue** on the title screen to enter Mode Select.
- Opening `adventure.html` without a card query gives a manual code-entry fallback.
- The MC is the default selected character for newly registered players. The Profile screen now offers MC alongside existing starter character cosmetics. Existing student profiles and selections are not overwritten.

## Deployment

1. Upload the contents of `github-repository/docs/` to your existing GitHub Pages deployment, replacing matching files. Keep the rest of your setup unchanged.
2. Do **not** erase Firestore documents or generate new QR cards. You do not need new Firestore rules for this flow.
3. Test one unregistered and one registered card using their real QR URLs. Test a QR on a different Chromebook/browser as well.
4. `docs/qr-flow-preview.html` provides an offline, noninteractive-Firebase screenshot comparison.

## Important

- QR card codes are bearer credentials. Anyone with a photo or copy of a QR card can access that student's classroom game profile. Keep the cards private and rotate compromised cards using your teacher registry.
- Returning scans still require an active internet connection, Firebase sign-in, and a server-verified card. Saving a card code on the device is not used as an authentication shortcut.
- Security constraints and the existing recruitment/gacha lock are unchanged.
- Browser tests use **mocked Firebase**. Real Firebase deployment and student Chromebook testing remain outstanding.
- To avoid spending extra reads, the v81 probe uses the existing card check, returning `registration_required` when the card is unregistered and no username was supplied. It makes no write on that first check. Registered cards only need one openCard call.
