# Majhi Jaben?! — Browser Fidelity v7

**Source of truth:** `MajhiJaben_CinematicEdition_NoComments(3).py`, the user's 5,404-line PyOpenGL game.

**Scope:** v7 is a focused camera, windshield, weather, and game-state regression pass on the v6 source-geometry web port. It is not a claim of pixel-perfect parity with the desktop version. The original Python project is unchanged.

## Publish on GitHub Pages

1. Extract `majhi-jaben-fidelity-v7.zip`.
2. Open the extracted **`docs`** folder. It contains **six** required files: `game.js`, `index.html`, `menu-scene.js`, `styles.css`, `original-geometry.bin`, and `original-geometry.json`.
3. In `https://github.com/TheAdittyaKumar/CSE423-Computer-Graphics-Journey/tree/main/docs`, upload all six files, replacing their previous versions. Do not upload another nested `docs/` directory or overwrite your repository's existing README/Python files.
4. Commit to `main`, wait for the GitHub Pages Actions job to finish, and load `https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/`. Force-refresh with **Ctrl+Shift+R**; script URLs use a `fidelity7` cache suffix.
5. Keep the old v6 ZIP as a backup. Rolling back means restoring the v6 `docs` files.

## Changes since v6

| Area | v7 implementation | Reference or reason |
|---|---|---|
| First-person passengers | Third-person renders retain the v6 seats; first-person passenger meshes are reduced to 0.36 relative scale and lowered to leave the forward sightline usable. Animations and seat counts still update. | `drawPassengerSeats`, `setupFirstPersonCamera`; eliminates oversized heads seen in the v6 screenshots. This is an intentional visual adaptation, not identical physical sizes. |
| First-person windshield | Slim wiper arm/blade originates near the lower-right windshield edge and follows the source's 18°→158°→18° sweep at 155° per second. Droplet clearing and rendering use the same scaled coordinates. | `updateWindshieldWiper`, `removeRainDropsInWiperPath`, `drawWindshieldOverlay`. The pivot is relocated from the Python center-bottom location for visibility. |
| Raindrops | Semi-transparent oval drops and small highlights replace screen-filling blue rectangles; windshield rain is cleared on entering the campus rain-free zone. World rain continues as finer streaks. | Reduces HUD obstruction while preserving rainy/stormy ambiance. |
| BRACU sunshine | Procedural aura cone fades smoothly by distance from campus and height, rather than ending as a hard-edged slab. Rain density tapers across the neighborhood boundary. | `getBRACUDaylightWeight`, `drawBRACUSunAura`, rain-clear area; this is an approximate WebGL shader, not the source's exact blending. |
| Chase camera | When a building shortens the camera arm, raise the camera and widen the field of view progressively to reduce extreme close-ups. | `getSafeChaseCameraDistance`, `setupFirstPersonCamera`; reduces near-wall captain overfill. |
| Expired passengers | Preserve the v6 boat-exit, water struggle, sinking, and ripple states; avoid drawing a jump model inside the first-person eye position. | `drawMissedPassengerEffects`; original non-graphic transition remains represented. |
| Gameplay | No rule changes to steering, rescues, deadlines, scoring, boost, traffic signals, power, photo mission, or end states. | Regression tests described below. |

## Automated tests run

- `node --check` succeeds for both `game.js` and `menu-scene.js`.
- Browser interaction harness with **mocked WebGL** checks engine initialization and menu, boat input, shop sign geometry, first-person wiper state, standard pickup, pickup beside car, photo popup and +70, power repair +100, an onboard student timing out, a successful dock walk-off, and no page errors.
- Additional **v7 regressions:** wiper clears a correctly positioned drop during its sweep; crossing into the BRACU rain-free radius clears the windshield; simulated six successful deliveries reaches `WON`, six timed-out onboard passengers reaches `LOST`.
- Python verifies that the original-geometry binary is valid and its full mesh indices fit within the buffer. ZIP integrity checked after packaging.

## What cannot be certified here

The available headless Chromium and Xvfb software-renderer configurations do **not** return a real WebGL context. Tests substitute a minimal mocked WebGL API for graphics calls. This means lighting, fog, mesh depth, rain appearance, cockpit sightline, and frame rate are **not** certified visually. Test in a normal hardware-accelerated browser before calling the release final.

## Suggested live test in this order

1. Start, press **C**. Accept 1–3 rides. Compare the sizes/placement of seated heads in first-person and chase cameras.
2. Press **V** in first-person. Confirm a **thin blade moves in and out** and the raindrops it crosses disappear. Check at multiple window sizes.
3. From several blocks away, approach BRACU, observing the softness of the local sun, rain taper, and fog.
4. Steer close to building corners and confirm the chase camera no longer zooms uncomfortably onto the back of the captain.
5. With a passenger onboard, let their deadline expire, in both camera views. Verify jump, water struggle, sink, and removal, with correct score and missed count.
6. Complete a few ordinary pickups and car-adjacent pickups; test power repair, traffic red/green, photo task, and dock deliveries.

Other known deviations from full Python parity include moving cars and some ambient pedestrians, exact water simulation, rain spray patterns, full menu and HUD alignment, and performance optimization. Those remain future tasks, not concealed as completed work.
