# v74 — Character Aura Workshop (Spark/Featured-Only Edition)

This update builds on v73 Guild Coins and the featured-only recruitment UI. **Real pulls, character awards, and duplicate shard payouts remain disabled** because the current Firebase Spark client cannot authoritatively validate results. The new aura progression is usable for existing starter characters when an authorized teacher issues *test shards*. Recruited characters will appear in the Aura Workshop when a future trusted recruitment service adds them to `players/{playerId}.recruitment.owned` and the character catalog is populated.

## Upgrade costs

| Tier | Cumulative Character Shards | Cost from prior tier |
|---|---:|---:|
| No aura | 0 | 0 |
| White | 10 | 10 |
| Azure | 30 | 20 |
| Violet | 70 | 40 |
| Gold | 150 | 80 |

Each character has independent unlocks and its own equipped aura; the student has one shared shard balance. Upgrading automatically equips the new tier. Switching among previously unlocked tiers (including no aura) is free. Auras are purely cosmetic and display on the Workshop character artwork, the Profile avatar, and the Profile showcase.

## Duplicate shard rules reserved for the future

* Duplicate 4★ -> 1 shard
* Duplicate 5★ -> 3 shards
* Duplicate 6★ -> 8 shards

`docs/aura-core.js` has these constants, but **they DO NOT credit shards yet**. Recruitment's current visual-only reveals cannot award characters, currency, or shards. Guild Coins cannot be converted to shards.

## Deployment

1. Back up your Firebase rules and current repo before deployment.
2. Upload the contents of the updated `docs/` folder (including `auras.html`, `auras.js`, `auras.css`, `aura-core.js`, `aura-admin.html`, `aura-admin.js`, `auras-demo.html`, `auras-demo.js`, and updated Profile/Recruitment pages) to the existing GitHub Pages `docs/` directory.
3. Replace the Firebase Firestore rules with the included **entire** `firestore.rules` file, preserving the already configured teacher UID. Publish rules. Do not replace them with only a fragment.
4. Enter the student Profile with an Adventure Card. Open `OPERATORS`, then click `OPEN AURA WORKSHOP`, or use the link in the Featured Recruitment page. It requires the same online Firebase connection as the rest of the game.
5. To test aura purchases before recruitment is active, sign in to **`aura-admin.html`** using the configured *teacher Google account*. Grant a small number of *test Character Shards* to a specific player ID (e.g. `P000001`). Avoid giving students access to your teacher Google account. The admin page grants only shards, not Guild Coins or characters.
6. Reload the student's Aura Workshop to see the new shard balance. Unlock each tier sequentially or preview higher tiers. The actual purchases commit atomically to Firebase.
7. To inspect the visual interactions without a player login, open **`auras-demo.html`**. Its fake 160-shard wallet and upgrades exist **only within that demo page** and do not alter Firebase.

## Data format

The `players/{publicId}` document contains:

```json
"recruitment": {
  "coins": 0,
  "permits": 0,
  "pity_six": 0,
  "owned": {},
  "recent": [],
  "shards": 0,
  "auras": {
    "crimson_knight": {"level": 2, "equipped": 1}
  }
}
```

Older player records without `shards` and `auras` are interpreted as zero/defaults; they do not need an immediate bulk migration. The first teacher grant populates `shards`; the first aura transaction populates `auras`. Rules disallow student-side currency increases and restrict changes to one owned character per transaction. Teacher grants can be incremented in small steps via `aura-admin.html` (max 1,000 per grant).

## Limitations and trust

* Actual recruitment costs (100 / 1,000 Guild Coins), gacha RNG, pity, ownership awards, free daily pulls, and duplicate shard payouts remain **locked** pending a trustworthy backend.
* This adds **real Firestore aura purchases and equipment**, but shard issuance is currently teacher-only for pilot testing. A teacher can also directly edit player documents via Firebase Console.
* The existing Adventure Card is a bearer secret. Users with the card may control its associated profile; safeguard card codes.
* UI and shared rule behavior require deployed-project testing. Local JavaScript, economy, and asset tests passed; a headless browser preview and live Firebase emulator were unavailable in this environment.
* Editing `firestore.rules` without publishing it will make client upgrades fail with permission errors.
* Firebase Spark traffic remains lightweight: normal aura page loads its existing profile; upgrade uses one Firestore transaction per action. There is no polling added.
