# v83 QA report — 2026-11-17

## Automated checks passed

- v83 tutorial integration: 36 static assertions.
- v83 recruitment core: 23 deterministic/statistical assertions; 100,000 simulated base pulls showed about 0.8% 6★ and 8% 5★.
- v81 QR login: 15 checks.
- v73 Guild Coins: 120 checks.
- v74 Aura Workshop: 886 checks.
- v75 Operator Art: 112 checks.
- v76 Teacher Grant: 71 checks plus simulated UI transaction checks.
- v69 Asset tests: 18 checks.
- JavaScript syntax: `online-spark.js`, `online-boot-v66.js`, `adventure_engine.js`, `profile.js`, `recruitment.js`, `recruitment-reveal.js`, `tutorial.js`, and `recruitment-core.mjs` passed Node syntax checks.
- Firestore rules: brackets balanced and cross-document receipt logic inspected statically; **rules were not evaluated in the Firebase emulator or live project**.

## Not tested

- End-to-end Firebase registration, reward, free draw, and Firestore rule permission evaluation.
- Chromebook browser walkthrough of the tutorial; local browser navigation was blocked by the environment.
- Simultaneous students using the same QR code at the exact same time.

## Classroom release checklist

Do not use production student cards until a disposable test card has completed the flow from registration through the 10-pull and tutorial completion, including retry after refresh. See README_V83_TUTORIAL_RECRUITMENT.md.
