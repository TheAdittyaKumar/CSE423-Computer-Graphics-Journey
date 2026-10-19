# Majhi Jaben?! — Fidelity pass 4

## Purpose

This replaces the earlier *approximation* with source-derived geometry and animations from `MajhiJaben_CinematicEdition_NoComments(2).py`. The original desktop Python project was not modified.

## How to deploy

1. Extract the ZIP.
2. Open your repository's existing `docs/` folder on GitHub, on `main`.
3. Upload/replace **all six** files from this ZIP's `docs/` folder:
   - `index.html`
   - `styles.css`
   - `game.js`
   - `menu-scene.js` (NEW)
   - `original-geometry.json`
   - `original-geometry.bin`
4. Commit and let GitHub Pages finish deploying from `main` / `docs`.
5. Hard refresh the live page. Verify the load indicator says `Original game geometry loaded` and test the controls.

## Changes based on the Python source

- A/D and arrow steering mapping flipped to compensate for the reflected ground-axis conversion from Python's OpenGL +Z-up scene to browser +Y-up scene.
- 24 poses sampled directly from `drawPlayerHandsAndPaddles` in third person, plus 24 in first person. While rowing, the browser cycles through the actual sampled arm and paddle positions instead of leaving a single static mesh.
- 24 poses sampled from the Python `drawFloodRescuePeople` function, including varying arm wave and water ripples. Waiting SOS students render animated poses instead of a static standing avatar.
- Boarding students transition from the boat side into their seats over 1.25 seconds.
- BRAC University retains its source-derived 30,558 vertices, with missing facade title re-created as 3D pixel letters. The opaque rectangular source `clear-sky` wall is not rendered because in the browser it visually dominates/masks the university; the actual campus geometry is still included.
- The original Python menu's flooded skyline, university island, struggling student, sampan, rower, torch direction changes and blinding EXIT/CLOSE spotlight have been rebuilt with Canvas2D. The browser cannot close tabs programmatically, so EXIT shows the flashlight and asks the visitor to close the tab themselves.

## Tests completed

- Original source's static and animated geometry exported to an 8.2 MiB WebGL interleaved buffer; includes 95 groups and 307,191 triangle vertices.
- Sampled animations checked numerically: rowing, first-person rowing, and swimmer frames differ in position.
- `node --check` passes for `game.js` and `menu-scene.js`.
- In a Chromium interaction test with a mocked WebGL context, the engine reached `PLAYING`, the request system offered and accepted a pickup, D increased turn angle while A decreased it, W updated the rowing stroke index and moved the boat, and Esc entered PAUSED. No JavaScript exceptions.
- Actual illustrated HTML menu / EXIT flashlight were rendered and visually inspected in Chromium.

## **Not yet verified / not guaranteed**

**This is not yet a complete pixel-identical or logic-identical port of all 5,404 Python lines.** In this environment Chromium is prevented from creating a real WebGL rendering context, so the updated full 3D scene *cannot be visually confirmed here*. Final verification must happen in a real WebGL-enabled browser and against screenshots/recordings of the actual Python edition.

Further parity areas: full camera/building clipping under all headings, exact wave/windshield effects, alpha-blended sunshine aura, complete mouse interaction and menu layout match, pickups in every scenario (home, SOS, seats, missed deadlines), driver's complex collision response, delivery and ending animations, and every timing/score detail. The source was used for geometry and key poses, but remaining systems are a browser rewrite and could diverge.

**Recommended verification**: compare Python vs web at the same startup scene, camera angle and boat route, then check every interaction from the Python help screen. Record specific mismatches before treating the port as faithful.
