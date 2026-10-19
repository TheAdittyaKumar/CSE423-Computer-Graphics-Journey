# Majhi Jaben?! — Fidelity v9: source comparison and QA

Reference: `/mnt/data/MajhiJaben_CinematicEdition_NoComments(3).py` (5,404 lines), using v8 browser game as base. Source Python was not modified.

## Changes against v8

| Original reference behavior | Browser v9 implementation |
| --- | --- |
| `updateSlowMovingCars`: track progress per car; stop before overlapping the boat; resume without teleporting. | Two mutable car progress variables; oriented collision sampling each update; advance only on a clear route; suppress car wake while stopped. |
| `drawNeighborhoodShopPeople` dynamic shopkeeper/customer idle movement. | Re-exported prop mesh **without** frozen characters; source-derived 12-frame animations for two shop styles (24 mesh groups). |
| `applyCurrentForces` and `drawWaterCurrentEffects`. | Existing v8 currents still exert force; added directional surface arrow geometry for visual flow. Flow clue visuals are approximated rather than an exact source shader/line animation. |
| `updateStudentRideSystem`: independently decrement each accepted passenger timer; some timers expire onboard. | Prominent on-boat timer showing shortest remaining time, plus individual time per passenger, with urgency coloring at 25 seconds; time displayed also for waiting requests. |
| Source HUD shows five active requests, names and deadlines. | Active rescues panel renders up to five, sorted by deadline, with WAITING/ONBOARD category. |
| `addDeliveryVisuals`, `drawBRACUDeliverySparkle`, `drawDeliverySuccessBanner`. | Existing dock walk-off plus an additional gold-ring celebration lasting about 2.65 s and a centered feedback banner. |
| `drawSlowMovingCarWake`. | Three progressively expanding vehicle wake rings, suppressed during traffic stops. Stylized approximation. |
| `drawArcadeMinimapMarkers` and legend. | Larger 360×360 bitmap and larger differentiated icons/legend text. Pending request has an animated outline. |
| `drawGameEndingOverlay` includes water rescues and traffic violations. | Added both values and elapsed time to the browser results display. |
| `updateArcadeGameplay`: six misses do not end the game while missed-passenger effects remain. | Defeat after the last drowning animation disappears (or at 15 minutes). |
| F3 quality and F4 frame profile shortcuts. | Added toggles and a frame-duration readout; quality mode reduces splash draw density. |

## Tests

- `node --check` succeeds for `game.js` and `menu-scene.js`.
- Source-derived `.bin` contains **555,327 vertices in 133 mesh groups**, with valid group offsets, triangle-aligned lengths, and different pose data between animation frames.
- Browser interaction tests using a mocked WebGL context: startup, movement, wiper, car-obstructed and normal pickups, photo, power repair, drowning effect, BRACU delivery, 6-delivery win, delayed 6-miss loss, world rain drops, streetlamps, seven legend keys.
- Added tests: moving traffic moves normally; stops before hitting the boat; resumes progress without jumping; F3 quality switch; 360×360 minimap canvas; per-passenger countdown and full accepted queue display.
- **Visual limitation:** Chromium in this environment did not provide a real WebGL graphics context; the smoke-test screenshot is a *HUD-only / mocked-renderer screenshot*, not proof of the full 3D scene. No actual GitHub deployment was made.

## Follow-up visual checklist

1. Accept 2 students and board them. The left HUD must show BOTH names and respective delivery timers; the smallest timer should be prominent and turn urgent under 25s.
2. At least one active WAITING and one ONBOARD request should appear simultaneously in the rescue queue.
3. Check the expanded minimap and legend; distinguish You/Home/SOS/BRACU/Dock/Repair/Photo.
4. Approach a moving car and verify it stops short. Row away and watch it resume smoothly (not teleport).
5. Look at ICON STATIONERY and FOOD VALLEY for shopkeeper/customer idle animation.
6. Approach the BRACU dock with a passenger; verify delivery walk-off, rings and success banner.
7. Optional F3/F4 switches; compare render frame time with original v8 for performance.

## Remaining to verify for exact source parity

The collision map still simplifies some dynamic vehicle interactions; wave, fog, weather and splash physics are adapted for WebGL; graphics-quality toggle is a lightweight equivalent rather than identical OpenGL settings; some camera/menu transitions and ambient sound (if any) may differ. Do not claim pixel-perfect, exhaustive behavioral parity without desktop comparison and real WebGL testing.
