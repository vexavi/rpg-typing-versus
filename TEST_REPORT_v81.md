# v81 Test Report — QR Auto Login

## Tested locally

- Actual v81 login HTML/JS run in Chromium with simulated Firebase responses (no localhost networking):
  - New card: only username registration displayed; QR code hidden; no registration write on probe.
  - New card registration: name persisted in mocked bridge; auto-loads saved profile and title screen.
  - Registered card: one card API call, no username or code fields, opens title automatically.
  - No QR parameter: manual-entry fallback.
  - Tablet viewport: username registration visible and readable.
- `TEST_QR_LOGIN_v81.cjs`: 15 bridge, API, query-preservation, and MC-selection regression checks.
- Syntax: `node --check` on modified JS files.
- Existing suites: Guild Coins 120 tests; Aura 886; Teacher grants 71 and UI mock; Roster 112; Asset 18 all pass.

## Not yet tested

- Real Firebase sign-in/session permission on the deployed Spark project.
- Production Firestore rules on teacher's live project and actual first-time/returning student QR cards.
- School Chromebook/device tests and QR camera behavior.

No server functions, Firestore rules, or new paid infrastructure were added.
