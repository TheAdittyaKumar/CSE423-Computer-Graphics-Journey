# Majhi Jaben?! — Browser Fidelity Pass v8

**Reference:** The user's `MajhiJaben_CinematicEdition_NoComments(3).py` (5,404 lines), compared with the v7 GitHub Pages web port. The original desktop project and its source files have not been modified.

## What v8 changes

| System | Browser v8 implementation | Source reference |
| --- | --- | --- |
| Wiper position | Moves the wiper pivot to the lower **center** (normalized from the desktop's x=505, y=55 in its 1000×800 coordinate system); keeps the 18°→158°→18° at 155°/s sweep. | `startWindshieldWiper`, `removeRainDropsInWiperPath`, `updateWindshieldWiper`, `drawWindshieldOverlay` |
| Rain clearing | Removes droplets throughout the actual angle traversed each animation update, rather than only at the endpoint. Drops stop spawning while a sweep is underway; raindrops clear on entry to the BRACU safe zone. | `removeRainDropsInWiperPath`, `updateWindshieldWiper` |
| First-person passengers | Restores visible seated avatars in **both** camera modes by raising/re-scaling the silhouettes to follow the original seat-model proportions. The rest of the first-person camera is unchanged. | `drawPassengerSeats`, `setupFirstPersonCamera` |
| Cars | The two moving vehicles render detailed source-derived automobile geometry instead of the old low-poly placeholder. The stationary car geometry is preserved. | `renderImprovedCarBody`, `drawSingleSubmergedCar` |
| Broken-car drivers | Adds hand-waving/frustration poses beside the original broken-car indices **1 and 4**, animated in 24 phases. | `BrokenCarIndices`, `drawStrandedCarDriver` |
| Heavy world rain | Adds **330 world rain streaks**, **108 camera-local rain streaks**, and impact-generated water-ring splashes. They fall in the 3D world, not just a 2D canvas. The old distant overlay is reduced to subtle atmosphere. | `drawRainAndSplashEffects`, `updateRainDropPositions` |
| BRACU aura | Strengthens warm, translucent spotlight/cone; blends the campus water toward calm/dry; adds a softly blended grassy raised courtyard inside the rain-free zone. The approach and delivery dock remain in water. | `drawBRACUSunAura`, `drawBRACUClearSky`, `getBRACUDaylightWeight`, `isInsideBRACUClearArea`, plus requested meme reference |
| Street lights | Glowing translucent bulb halos and reflections appear near powered lights. Both are suppressed for the actual blackout district, using the existing working dynamic power states. | `drawStreetLight`, `isPositionInsideBlackoutDistrict` |
| Map legend | Seven distinct symbols: **YOU**, **HOME**, **SOS**, **BRACU**, **DOCK**, **REPAIR**, **PHOTO**. Pending rides are hollow; pickups have different symbols for HOME/SOS. | `drawMinimapSymbolAt`, `drawMinimapLegend`, `drawArcadeMinimapMarkers` |

## Scope and differences

This release improves fidelity to the source, but **does not claim to be a pixel-perfect port**. The world rain is inspired by the original physical rates and spawn patterns but is implemented with a new WebGL triangle/mesh pipeline. The dry courtyard and stronger sunshine are deliberate additions based on the user's meme reference; the original Python game provides a rain-free light/sun halo but not this exact courtyard mesh. Driver poses use a simplified approximation to the source's limb pose. Some animated shopkeepers, moving car routes/wake, rain/spray shading, water waves, subtle fog, and menu/HUD alignment remain simplified. All rendering, sunbeam brightness and driver/passenger framing require a final desktop-browser visual check.

## Tests performed

- `node --check` passes for `docs/game.js` and `docs/menu-scene.js`.
- Source binary contains **520,875 vertices** across **109 indexed mesh groups**; checked group ranges, triangle counts, finiteness and the two added car-body geometries.
- Browser interaction harness with *mocked WebGL* passes: startup/menu, engine geometry stub, ordinary pickup, car-adjacent boarding, rowing, photo, power repair, passenger timeouts, deliveries/walk-offs, wiper motion and crossed-droplet clearing, campus rain suppression, six-delivery win and six-miss loss.
- v8-specific browser checks pass: the wiper pivot is horizontally centered (0.505 viewport width), 330 persistent world storm drops advance downwards, 24 driver pose frames exist, streetlight list generated, seven category legend items render, and no JavaScript exceptions occur in the simulated renderer.
- The actual WebGL browser image was **not** tested: this environment refused WebGL context creation and blocked local browser navigation. Genuine rain/wiper 3D composition, transparency, sunlit courtyard and performance **must be verified on the deployed site**. If a browser screenshot differs from the original, it should be treated as a regression to fix rather than a final accepted state.

## Upload to GitHub Pages

1. Extract `majhi-jaben-fidelity-v8-complete.zip` and open its `docs` directory.
2. Upload and **replace all six files** in the *existing* GitHub repository's `docs/` directory, keeping paths such as `docs/game.js` and `docs/original-geometry.bin`. Do not upload an extra nested `docs` directory.
3. Keep all Python files and the repository's existing root `README.md` unchanged.
4. Commit to `main`. Check the Pages workflow in GitHub **Actions** until a green check mark appears.
5. Open `https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/` and hard-refresh (`Ctrl+Shift+R`). The HTML has a `fidelity8` cache-busting suffix for the scripts.

## Live test checklist

- [ ] Press **C** to switch to first-person, accept a ride and verify its head/body remain visible above the front seats without obstructing the view.
- [ ] Press **V**. Confirm the wiper originates near the bottom **center**, sweeps from side to side, and removes droplets it passes over. Try windowed/fullscreen.
- [ ] Explore a stormy block away from BRACU. Confirm plentiful rain streaks at different depths and occasional small water-impact splashes.
- [ ] Approach BRACU. Look for a golden sunlit, quieter, rain-free region and a raised dry patch, while the water dock stays navigable.
- [ ] Approach a streetlight in a powered district, then repair an outage and confirm glowing lamps/windows in that district; disabled lamps have no halo.
- [ ] Compare moving cars against stationary cars for detail. Find one of the **broken** cars and watch its frustrated driver wave an arm.
- [ ] Open the minimap and distinguish HOME vs SOS, DOCK vs BRACU, POWER, and PHOTO symbols with the new legend.
- [ ] Complete pickups near cars, at least one delivery, power repair, photograph, and timed-out passenger sequence; ensure mission and scoring still work.

## Rollback

Retain the v7 ZIP. If v8 has a visual bug, restore **all six v7 files** to the repository `docs/` folder, commit and wait for Pages to publish the restored version.
