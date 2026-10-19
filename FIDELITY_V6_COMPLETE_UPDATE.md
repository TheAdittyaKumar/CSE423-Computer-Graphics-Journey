# Majhi Jaben?! — Browser Port Fidelity Pass v6

**Reference:** `MajhiJaben_CinematicEdition_NoComments(3).py` (5,404 lines). This upload has the same SHA-256 as version `(2).py` and is unchanged by the browser port. **Status:** a working adapted game with new fixes, **not an independently verified exact one-to-one port**.

## Upload to GitHub Pages

1. Unzip the package. Open **docs/** inside it.
2. In `https://github.com/TheAdittyaKumar/CSE423-Computer-Graphics-Journey/tree/main/docs`, replace all **six files** with the files from this docs folder. Do **not** replace the repository README or Python originals, and do not accidentally create `docs/docs/`.
3. Commit to `main`. Your existing Pages deployment should remain set to `main` → `/docs`.
4. Wait for a successful Pages Actions deployment, open `https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/` and force-refresh (Ctrl+Shift+R). The JS now uses `fidelity6` version strings.
5. Test first-person **C → V**, approach a home pickup with a car nearby, approach both campus shops, and try photo **P** at Shaheed Minar.

If the upload shows a GitHub size warning, note that the **binary** asset is 14.5 MB; upload the actual file, not the ZIP. The six-file docs tree must be intact.

## Implemented or corrected specifically in v6

| Feature | Reference implementation | v6 status |
|---|---|---|
| Car-blocked home pickups | `HomePickupRadius`, `DrowningPickupRadius`, `isBoatPositionValid`, `updateStudentRideSystem` | Corrected unobstructed pickup positions on restart; when a car blocks the pickup lane, allow boarding from a safe roadside distance (122 home / 84 water rescue, compared to ordinary 72 / 56) without driving into the car. Boarding still requires stopping and holding 1.3 / 0.65 seconds. This is an intentional accessibility adjustment to the original rules. |
| Shop signage | `renderNeighborhoodShopGeometry` with `drawFlatSignText` | Actual 3D-facing text for **ICON STATIONERY**, **FOOD VALLEY**, and their original subtitles. The source converter ignored `glutStrokeCharacter`; v6 adds a small pixel-glyph geometry system placed at the original shop facades. |
| First-person rain and windshield wiper | `startWindshieldWiper`, `updateWindshieldWiper`, `removeRainDropsInWiperPath`, `drawWindshieldOverlay` | Rain drops accumulate on first-person screen; **V** swings a real blade from 18° to 158° and back at 155°/s; rain spots in the blade's path are cleared. Wiper remains visible at rest. Third-person view does not show windshield. |
| Pickup water effects | `addRescueSplash`, `drawRescueSplashEffects`, `drawPaddleContactSplashes` | Short spreading water rings on boarding; approximate paddle contact ripple and boat wake during rowing. These are smaller browser approximations, not the Python's full spray ribbons. |
| Landmark photo information | `tryLandmarkPhoto`, `drawPhotoFeedback` | At the Shaheed Minar photo spot, **P** opens an eight-second on-screen historical information panel alongside +70 score. Text matches reference data. |
| Static original world geometry | `renderBRACUStaticGeometry`, building/shop/boat draw functions | V5 geometry binary reused; same original uploaded Python file contents. All six files deploy together. |

## Broader source-to-browser feature audit

Legend: **Implemented** = functional browser version confirmed in code; **Adapted** = partially ported or different behavior/visuals; **Not verified** = cannot claim exact parity.

| Source subsystem | Web-browser situation |
|---|---|
| Flooded-Dhaka grid, buildings, university, memorial, roadside scenery | Implemented with original source-derived mesh exporter; font lettering reconstructed |
| Boat steering, forward/reverse, boost, two cameras | Implemented, though input interpolation/collision details are adaptations |
| Captain body, rowing hands/paddles | Source-derived sampled poses; per-frame motion is adapted rather than evaluating every Python draw call |
| Student ride requests, queue, deadlines, home/SOS pickups | Implemented with matching headline rules; special pickup allowance added to avoid trapped car pickups |
| Rescue students struggling, pickup, seat boarding | Source meshes and animations partially implemented; splash/final positions are approximations |
| Timed-out passengers leave, struggle and sink | Implemented as timed animation; exact choreography and rendering need visual comparison |
| Student drop-off, delivery points, walk-off | Implemented; fireworks/feedback visuals simplified |
| Red/green traffic, penalty, stop-line | Implemented with exported red/green visual states; dynamic car reactions may differ |
| Blackout per district, repair-box red/green, windows and streetlights | Source-derived state meshes, implemented; color changes should still be visually checked live |
| Water physics, translucent flooded streets, fog and weather | Adapted: browser shader not identical to fixed-function OpenGL/rain splash rendering |
| BRACU warm sunshine and aura | Adapted: browser translucent procedural sunlight/rings, not exact alpha/blend parity |
| Street vendors, shops, shop signs | Scene geometry source-derived, v6 signs added; merchant/customer idle animations not fully reproduced |
| Submerged and slow-moving cars, wake/splash | Parked source-derived cars; moving cars are simplified browser models and wakes are incomplete |
| Water currents, debris impacts, collisions | Functional approximations; exact SAT overlap-severity and dynamic car behavior not guaranteed |
| Windshield raindrops and wiper | v6 first-person overlay closely follows angle, speed and clearing logic; canvas transparency differs from GLUT |
| Shaheed Minar photo task and information card | Implemented with simplified 3D target/feedback |
| First-person and third-person HUD and minimap | Functional but visuals, text placement, some indicators and zoom differ from source |
| Illustrated cinematic menu and flashlight prank | Adapted; browsers cannot close a tab the same way desktop GLUT can |
| Rain splashes, passenger exits, paddle sprays, camera obstacle shortening | Adapted/partial; require visual regression in real WebGL |
| 6-delivery win, 6-missed loss, 15-minute limit | Implemented; full 15-minute end-to-end game completion has not been exhaustively tested |

## Automated checks performed

- `node --check`: both JavaScript files pass.
- In a headless Chromium **mocked WebGL** harness: game initializes with geometry-index stub and produces no JavaScript exceptions; original-shop labels create 4,974 textured-equivalent (solid-color) 3D vertices; first-person wiper angle advances from 18° to ~80° during test and raindrops accumulate; plain home pickup boards and awards 35; blocked-by-car pickup at 120 units boards and awards 35; photo task awards +70 and shows information; power repair +100 works; timed-out onboard student creates an exit animation state; delivery creates walk-off animation.
- **Genuine WebGL not verified here:** Chromium cannot create a WebGL context in this environment (`getContext('webgl')` returned null), so the appearance of signage, wiper, water, and students still needs checking on your computer. Please do not treat mock checks as real graphics validation.

## Remaining important parity work (do not call finished until tested)

- Convert moving-car geometry and their wake/stop behavior, shop/customer idle animations, rain droplets/splash ribbons, and paddle sprays more precisely.
- Visually compare all three power districts, sunlight and rain-free BRACU zone, water visibility, original 2D menu/searchlight, photo HUD, and game-end screens in the actual live WebGL edition.
- Full end-to-end in-browser test: accept/pick up six students, deliver all six, deliberately miss six, run recurring outages, test all pickups and photo spot, both cameras, all collisions.
- Performance pass on ordinary laptop and mobile GPUs. Original source uses OpenGL fixed-function features not supported verbatim by WebGL 1, so exact parity remains a porting effort.
