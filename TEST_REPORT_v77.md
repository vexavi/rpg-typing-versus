# v77 test report

PASSED:
- Automated Chromium UI simulation: Room Code -> Name -> direct Join Tournament; missing character-selection screen; fixed protagonist in posted payload; no JavaScript page errors.
- Eight live local HTTP API assertions: room creation; room validation; legacy silver_knight request becomes crimson_knight; character switch action refused; duplicate names refused; card identity retained; linked card's tournament character fixed; preexisting card profile-character preference preserved.
- Python 3 server compiles; embedded tournament JavaScript parses under Node.js.
- Existing tests: Guild Coin v73 (120), Aura v74 (886), Roster v75 (112), Teacher Grants v76 (71 and UI mock).

UNTESTED: physical classroom Chromebooks, actual Firebase deployment, Windows start script.

The protagonist picture remains the temporary Crimson Knight until the user provides the intended MC artwork.
