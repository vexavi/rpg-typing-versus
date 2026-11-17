# v82 Text Update — Verification

- First-scan mock QR flow: shows welcome heading, **What is your name?**, **Ready**, with no old kicker or explanatory paragraph.
- Returning-scan mock QR flow: loads start screen automatically and shows **Start**.
- Registration: simulated profile saved and loaded after form submission.
- Manual-code entry fallback: available when QR lacks code.
- No JavaScript page errors in mock Chromium runs.
- Regression checks: Guild Coins (120), Aura (886), Roster (112), Teacher Grants (71) passed.
- Firebase deployment and real Chromebook tests not performed.
