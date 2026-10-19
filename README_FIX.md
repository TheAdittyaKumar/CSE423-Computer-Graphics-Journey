# Majhi Jaben?! WebGL shader hotfix (v3)

## Why the previous game did not start
The older vertex shader declared `uTime` with the default highp precision, while the fragment shader declared it with its default mediump precision. Some WebGL1 implementations refuse to link shaders when a shared uniform (or varying) has different precision qualifiers.

## What changed
- `docs/game.js`: detects supported fragment precision and gives the same explicit precision to uniforms and varyings in both shader stages.
- `docs/index.html`: changes game.js?v=2 to game.js?v=3 to bypass cached JavaScript after deployment.
- `docs/styles.css` is unchanged and is NOT in this hotfix. Leave the existing file in GitHub.

## How to publish
1. Extract this ZIP.
2. Upload **only** the two files inside `docs/` (`game.js`, `index.html`) into your repository's existing `docs/` folder. Confirm GitHub will replace the existing two files.
3. Commit to `main`.
4. Wait for the Pages deployment to complete, then hard-refresh the public URL.
5. On the menu, look for `✓ Game engine ready`, then click Start Rescue.

## Testing
Validated with Chromium using real WebGL1 via SwiftShader: prior version failed shader linking, v3 linked and drew the city and boat; starting, movement, accepting a request, and pausing worked. Browser/GPU behavior can differ; check on your own Firefox/Chrome once deployed.
