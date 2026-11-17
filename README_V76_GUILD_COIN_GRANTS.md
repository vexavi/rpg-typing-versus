# RPG Typing Versus v76 — Teacher Guild Coin Grants

## What is new

Authorized teachers can add an exact positive amount of **Guild Coins** to one existing registered player using `docs/guild-grants.html`. This does **not** change gameplay earning rates, daily free 10-pull planning, shard balances, or the non-functional recruitment spending buttons.

The dedicated teacher page is linked from `recruitment-admin.html` (Featured Banner Editor), `game-settings.html` (Game Settings), and `aura-admin.html`.

- Teacher Google account must match the teacher UID already configured in `firestore.rules` and `docs/guild-grants.js`.
- Loads existing player wallets once on entry and on the Refresh button. There is **no polling**.
- Select a player by username and public player ID (`P000001`, etc.); search by name or ID.
- Enter **1 to 1,000,000 Guild Coins** per grant. Player balance cannot exceed **1,000,000,000**.
- Optional reason, maximum 100 characters.
- Confirmation displays the selected player and exact amount before writing.
- A Firestore transaction reads the current wallet and then atomically updates `players/{playerId}.recruitment.coins` and creates one receipt in `guildCoinGrants/{id}`.
- Recent 20 receipts are visible to the teacher. Students cannot read or write the grant history. Firestore rules make receipts create-only (no updates/deletions).
- A disabled player or a card without a migrated Guild Coin wallet cannot receive a grant. Migrate older player cards first.

## Publish / deployment

1. Upload the contents of `github-repository/docs/` to the existing GitHub Pages `/docs` location, replacing older versions.
2. **Publish the included updated `github-repository/firestore.rules`** in the same Firebase project's Firestore Rules editor. Without the new rule, the player's wallet update may succeed only if the receipt is not required, but in our implementation **both commit atomically**; a denied receipt aborts the whole transaction.
3. On GitHub Pages, open `https://YOUR-SITE/guild-grants.html` and sign in with the authorized teacher Google account.
4. Verify that the player list loads. If it is empty, students may need to scan their Adventure cards once to initialize their player documents.
5. Select a test player, confirm a small grant, and inspect the new balance and audit entry. Have that player reload their Recruitment screen to see the updated balance.

### Do not run a test on live student data without intending to give those coins

The grant is **real** within the existing Guild Coin wallet; there is no undo button. Teachers can make a compensating correction manually in Firebase Console if they grant the wrong amount, but this console intentionally does not allow subtraction.

### Security and limits

`guildCoinGrants` is teacher-only and immutable via rules. Firestore validates amount, player ID, old/new balance and cross-document wallet write. The same account remains authorized to update player documents as before. Student-generated game claims still have the v73 client-reported limitations, and **gacha spending and automatic character awards are still disabled**.

No paid server, no Cloud Functions, no Firebase billing, and no periodic reads are added. Firestore writes/reads incur normal Spark quotas. The player list reads one document per player each time the teacher opens or refreshes this page; history reads up to 20 documents. Granting uses a Firestore transaction plus one audit document.

## Testing status

Pure validation, duplicate prevention behavior, template references, and Firestore rule structure are covered in `TEST_GUILD_GRANTS_v76.cjs`. These are local checks, not a live Firebase emulator or school deployment test. Live teacher login and Firestore transaction should be tested once after publishing the rules.
