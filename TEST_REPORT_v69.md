# RPG Typing Versus v69 — Performance Audit

Source: v68 zero-polling package. Deployment not performed.

## Before/after published `/docs` payload (uncompressed totals, not actual transfer timing)

| Measurement | v68 | v69 | Reduction |
|---|---:|---:|---:|
| All public game files | 2,897,128 B | 1,084,270 B | 62.6% |
| Bundled images + audio | 2,348,284 B | 527,988 B | 77.5% |

Actual initial page download is smaller than total published folder size; browser requests assets as they are needed. These are artifact sizes, **not real Chromebook performance measurements**.

## Checks passed

- `node github-repository/TEST_V69_ASSETS.cjs`: 18 media version, duplicate-download, missing-file, stage preload, audio prefetch and boot checks.
- `node TEST_V68_CONNECTION.cjs`: existing 60-second polling stays removed; RTDB connection signal, fail-closed behavior, and no Firestore heartbeat regressions.
- `node tournament-local/TEST_VICTORY_v65_5.js`: eight victory/menu navigation cases.
- `node --check`: all public JavaScript files syntactically valid.
- `python -m compileall -q github-repository/tools`: asset generator syntactically valid.
- Local HTTP GET smoke tests: 9 public routes/assets returned HTTP 200.
- Asset-report consistency: 15 real media files indexed; no student DB/key files in GitHub upload.

## Limitations / manual tests required

- Playwright browser navigation to localhost was blocked by environment policy: `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Full visual, Chromebook, and 65-user network testing have **not** been run.
- 26 optional intro/Extra-stage art/BGM filenames were not shipped in the v68 input, so playback/real music transfer time could not be tested. The game deliberately skips these missing local assets rather than issuing 404 requests. Some Extra-stage clear logic requires an actual BGM end event; media must be supplied for such stages.
- Audio autoplay depends on Chrome user interaction. Browser `<link rel=prefetch>` is advisory, not a guarantee.
- Image quality was inspected by dimensions/byte size and file integrity; final appearance should be reviewed on student Chromebook screens.
- Firebase auth, vocabulary downloads, Firestore rankings, and realtime presence rules are **not** changed by this release and need normal live testing after publication.
