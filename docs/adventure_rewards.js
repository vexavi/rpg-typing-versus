/* RPG Typing Versus v67 Spark: disable authoritative reward endpoints entirely.
   Do not send a network request for each typed word. The existing local
   typing score/XP engine remains, but these do not grant cloud currency. */
window.RPG_REWARDS={startStage(){},correctWord(){},stageClear(){},isOnline:false};
