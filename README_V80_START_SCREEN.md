# RPG Typing Versus v80 — Single-line Start Screen

Based on v79.

- The startup title is now **RPG TYPING VERSUS**, responsive and always on one line.
- Removed News, Settings, Repair, and Logout startup controls, including their event handlers.
- Retained the character silhouette, yellow Continue button, profile card, card login, and mode-select navigation.
- Removed the duplicate subtitle; **ADVENTURE** is now the small heading above the title.
- Profile character selection and online-only login are unchanged.
- No Firebase rules changes required.

## Deploy

Upload the contents of `github-repository/docs/` to your existing GitHub Pages `docs/` folder (or merge the changed files: `adventure.html`, `adventure_engine.js`).

No changes to `tournament-local` or saved player data.
