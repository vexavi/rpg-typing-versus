# RPG Typing Versus v77 — Fixed Tournament Protagonist

The tournament entry is now **Room Code → Username → Waiting Lobby**. There is no "Choose Character" screen.

- Students join immediately after submitting their name (or linked Adventure Card name).
- Tournament battles, lobby portraits, and results use one fixed protagonist for all players.
- The temporary protagonist is **Crimson Knight**, identified internally as `crimson_knight`.
- The **local tournament server** enforces this selection even for clients using outdated browser code; lobby character-change requests are rejected.
- Existing Adventure Card registrations, cosmetic selections, profiles, Guild Coins, gacha roster, and Aura Workshop are not deleted or reset.
- No Firebase rules or GitHub Pages changes are required for this specific tournament-entry update.

## Replace the temporary protagonist later

When the original MC artwork is ready, replace the temporary file at
`tournament-local/assets/characters/crimson_knight.webp` with the new artwork, and update the display name for `crimson_knight` under `const CHAR` near the start of `tournament-local/index.html`. Keep the internal ID unchanged to avoid migrating existing tournament/player-card data.

This changes tournament gameplay presentation, not the independent recruitable-character catalog or profile icons. The online Adventure profile setup still has optional profile-icon customization.

## Updating your laptop

1. Stop the local tournament server.
2. Back up your existing `player_cards.db` if one is present on the laptop.
3. Copy the updated tournament files to your existing tournament folder (without overwriting `player_cards.db`).
4. Run `START_TOURNAMENT_WINDOWS.bat`; have students reload their classroom browser page.

## Verification

- Live browser simulation: room code → username → single Join button, no character selection, correct automatic character in the join request.
- Server/API: fixed character despite a legacy request, no lobby switching, room/name validation, card-linked profile character retained.
- Syntax: Python compile and JavaScript parse passed.
- Existing Guild Coin, Aura, roster, and teacher grants local regressions passed.

No real Chromebook classroom deployment or live Firebase test was performed in this environment.
