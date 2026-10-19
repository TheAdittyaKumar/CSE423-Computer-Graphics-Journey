# Majhi Jaben browser edition — startup fix (v2)

The first game page loaded its design, but the buttons could remain inactive when `game.js` was missing or its WebGL initialization failed.

This patch makes **How to Play** usable independently of WebGL and adds a visible engine status / error message to the menu.

## Replace these files on GitHub

- `docs/index.html`
- `docs/game.js`

The rest of your repository and the existing `docs/styles.css` do not need changing. Upload the replacement files to the `docs` directory, commit to main and wait for GitHub Pages to deploy. Refresh your game page with **Ctrl+Shift+R** (or a private/incognito tab).

Before clicking Start, look beneath the menu note for a status message:

- `✓ Game engine ready`: the JavaScript finished initializing. Try Start Rescue.
- `Game script missing`: `docs/game.js` is missing or was not served at the expected path.
- `WebGL unavailable`: the browser cannot create a WebGL context; try hardware acceleration or another browser.
- `Game script error (line …)`: open F12 → Console and send the full error so it can be fixed.

This is a diagnostic/startup reliability patch. It does not guarantee that a browser with WebGL disabled can run a 3D WebGL game.
