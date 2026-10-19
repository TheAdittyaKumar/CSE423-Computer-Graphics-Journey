# Majhi Jaben?! — Fidelity Pass v5

## What this is

This is an incremental browser port, based on `MajhiJaben_CinematicEdition_NoComments(2).py`. The existing desktop Python source is not modified. This build corrects reported v4 problems and adds more source-derived state-dependent rendering. It is **not yet verified to be pixel-identical or behavior-identical to all 5,404 source lines**.

## Deploy on the existing GitHub Pages repository

GitHub: `TheAdittyaKumar/CSE423-Computer-Graphics-Journey`

1. Extract this ZIP on your computer.
2. Open the ZIP's **docs/** directory. Upload all six files **into the existing repository's `docs/` directory** on branch `main`, replacing the old files:
   - `docs/index.html`
   - `docs/styles.css`
   - `docs/game.js`
   - `docs/menu-scene.js`
   - `docs/original-geometry.json`
   - `docs/original-geometry.bin`
3. Commit the changes. GitHub Pages remains `main` → `/docs`.
4. Wait for **Actions → pages build and deployment** to succeed.
5. Visit `https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/` and hard-refresh with Ctrl+Shift+R. Asset request URLs have v5 cache-busting parameters.
6. Test in third- and first-person views. In case of a new issue, use GitHub's commit history to restore the previous six-file version.

**Keep your Python files, GitHub README and other lab directories unchanged.**

## v5 corrections based on the original game

| Behavior | Original source | Changes in v5 |
| --- | --- | --- |
| Screen orientation and mirrored signs | Original world X/Y axes, forward heading and `drawFlatSignText` orientation | Corrected horizontal screen projection and A/D direction so right/left agree with world-map coordinates and labels read left-to-right |
| Power outages | `isPositionInsideBlackoutDistrict`, `drawSingleBuilding`, `drawStreetLight`, `drawPowerRepairStation`, `tryRepairPower` | Four distinct source-rendered window, streetlight and power-panel states: all-lit, Central outage, West outage, East outage. Correct panel and indicator red on active outage, green after repair; +100 and advance district as original |
| Traffic signal | `drawFloodTrafficSignal`, `updateFloodTrafficSignal` | Exported original 22-unit signal sphere in red and green states, plus visible HUD state readout |
| Submerged streets | `drawSubmergedCityBlocks`, `drawSubmergedRoadClues`, `drawAnimatedWaterSurface` | Draw original roads/markings first and overlay moving semi-transparent water instead of hiding the streets behind opaque water |
| BRAC University sunshine | `drawBRACUSunAura`, `getBRACUDaylightWeight`, `drawBRACUClearSky` | Animated golden rings, translucent sunbeam volume, sun above campus and a local clear-sky opening; also retains calmer water shader around BRACU. **These are procedural approximations, not a direct alpha-perfect conversion.** |
| Expired onboard passengers | `addMissedPassengerVisual`, `drawMissedPassengerEffects` | Timed passenger leaves the boat (0–0.8 s), struggles in water, sinks between 2.85 and 3.85 s and leaves ripples until 4.35 s. Uses source-derived student/swimmer meshes |
| Student delivery | `addDeliveryVisuals`, `drawDeliveryExitPeople` | Passengers walk off the boat and toward the university dock over 1.65 seconds after successful delivery |
| Car collisions | `doesBoatOverlapCar`, `getCarOverlapSeverity`, `getDynamicObstacleOverlapSeverity` | Replaced square and oversized radial barriers with four-axis boat/car overlap checks, using original parked-car lane offsets. Attempts to let player move away when already overlapped by a moving vehicle |
| Street obstacles and campus | `BRACUSolidVolumes`, `isBoatCollidingWithStreetProps`, `getSafeChaseCameraDistance` | Uses six original BRACU collision rectangles, better street vendor/shop/power enclosure obstacles, and campus-camera obstruction avoidance |

The V4 source-rendered boats, city buildings, campus, shoreline stalls, rowing and swimmer animation pose assets and creative flashlight menu remain in place.

## Automated validation performed

- `node --check docs/game.js` and `node --check docs/menu-scene.js`: pass.
- Exported 107 named source-derived geometry groups, 518,487 vertices; geometry index ranges remain inside the 13.85 MiB binary.
- Geometry comparison found actual color changes between all-lit vs blackout windows (Central: 192 vertices; West/East: 264 vertices each); red-vs-green traffic meshes differ (720 vertices); power-panel states differ (420 vertices).
- Headless Chromium **mocked-WebGL** interaction tests: initial game, A/D turns, adjacent-car clearance, close-car blocking, repair state, passenger timeout effect state, BRACU delivery/walk-off state, HUD traffic state. No uncaught JavaScript errors.
- **Limitation:** A genuine WebGL rendering context is blocked in this execution environment. The replacement's full 3D render, transparency ordering and visibility of the sunshine effects are **not visually verified here**. This must be checked in the user's normal browser; do not treat this as a confirmed final parity release.

## Further deviations from the Python edition to audit

These features are *not* asserted to be equivalent and should be compared in the live browser before calling the port finished:

- The canvas/WebGL water, fog, sky light and BRACU daylight are browser implementations rather than exactly identical alpha blending and fixed-function OpenGL state. Ripple, paddle splash, tide crest and windshield effects remain partly simplified.
- Static source geometry was exported, but some scene animations (shop customers, moving-car wakes, ambient rain splashes, delivery effects) are simplified.
- Vehicle-to-boat collision escape uses a distance-away rule instead of exactly reproducing every value of the Python SAT overlap-severity sum. Moving car dynamics and boat speed can differ.
- The illustrated menu recreates the Python torch exit gag but is not pixel-matched; browser tabs cannot be forcibly closed as reliably as a GLUT window.
- HUD/minimap art, score feedback, photo-info dialog, life-cycle timings, and some pickup/home logic remain adaptations rather than the original implementation line-for-line.
- The campus is original source-derived geometry, but the sunshine aura and distant clear-sky transition are reconstructed; compare at multiple camera angles in a real browser.
- End-to-end real-browser scenarios (all six deliveries, six missed rides, repeated district outage cycles, all camera and weather conditions) are not exhaustively tested here.

## Manual verification after publishing

- Face north near spawn: A turns visually **left**, D visually **right**. BRAC UNIVERSITY should read normally, and landmarks on the minimap should correspond to visual left and right.
- Find CENTRAL repair panel: initially red, after F within 130 units becomes green; nearby CENTRAL windows and streetlights should illuminate; after 15 seconds a different district blacks out.
- Watch the actual signal and HUD readout change GREEN → RED → GREEN (5 s + 4 s cycle). The red entry rule should enforce the -35 point penalty.
- Drive beside, not into, a parked car; try moving away if a moving car touches the boat.
- View underwater road center-lines and the sunshine aura around BRACU from multiple approaches.
- Pick up a passenger and allow their deadline to expire while onboard: watch them jump, struggle and sink; verify that the onboard count decreases.
- Deliver a passenger to BRACU and look for the walk-off animation.

If the screen fails to start, open F12 → Console and send its first red error plus a screenshot. If the scene starts but a visual is missing, please send matching original-Python and browser screenshots from a similar location/heading.
