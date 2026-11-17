# RPG Typing Versus v78 — Original MC artwork

This update adds the supplied **MC.png** (1024 × 1536 transparent PNG) as the permanent **visual protagonist** for tournament battles. The old temporary Crimson Knight selection remains the *internal* `crimson_knight` ID to preserve compatibility with existing player-card and room data; the visible character is now the uploaded hooded masked MC.

## What changed

- Tournament lobby, versus previews, battle portraits, and winner screens use `tournament-local/assets/characters/mc.webp` through the existing fixed-protagonist character ID.
- The character-selection screen stays removed. Students enter a room code, a name, and join directly.
- `tournament-local/server.py` still forces the internal `crimson_knight` ID, even for older clients.
- Original temporary Crimson Knight/Silver Knight images are retained **unchanged** for previously saved profile cosmetics and other standalone appearance selections.
- A second lightweight `github-repository/docs/assets/characters/mc.webp` copy is included for future MC presentation on GitHub Pages, and is declared as a **non-recruitable mainCharacter** in `CHARACTER_MANIFEST.json`.
- The 14 gacha operators and Featured Banner setup are unchanged. MC is **not a gacha pull** and has no 4★/5★/6★ rarity.
- Original upload is archived as `source-art/MC.png` in the complete distribution.

## Deploy to your laptop

1. Stop your local tournament server.
2. Back up your existing `player_cards.db` or player data first.
3. Copy the contents of `tournament-local/` to the laptop's existing tournament folder. **Do not overwrite your existing player database.**
4. Start the tournament server with `START_TOURNAMENT_WINDOWS.bat` and reload student browser pages.
5. Confirm the new MC appears on lobby, VS, and results screens. The file name `mc.webp` avoids browsers showing a cached old Crimson Knight image.

No Firebase security-rule updates are required for the MC art change. The new `docs/assets/characters/mc.webp` and manifest can be included in the next GitHub deployment, but aren't needed to update the local tournament character.

**Not changed:** Adventure Mode gameplay (which doesn't currently render a separate player sprite), character ownership, profile cosmetics, Aura Workshop balances, Guild Coins, Recruitment, or existing saved student progress.

## Testing

- Run `python tournament-local/TEST_FIXED_MC_v77.py` from the complete package root.
- Run `python tournament-local/TEST_MC_ASSET_v78.py` to check MC transparency, role bindings, and profile-art isolation.
- GitHub static assets and previous Guild Coin, Aura, Recruitment, and teacher grant test suites were also checked during packaging.

This build was validated with local tests but not deployed to live Chromebooks or Firebase.
