# Majhi Jaben?! — Phase 21: Gameplay HUD & Camera Polish

This phase focuses on **Phase 25 from the roadmap**: making the in-game interface cleaner, more stylish, and more readable, while improving both chase and first-person camera behavior.

## What changed

### 1) Racing-inspired HUD polish
- Added a darker **performance/racing-game inspired HUD treatment** with gold/cyan accents.
- Restyled the following **without touching the main menu or BRACU ID-card scene**:
  - rescue request panel
  - active passenger timers
  - celebration banner
  - objective toast / notifications
  - minimap target strip and route controls
  - boost / docking bars
  - pause / camera / accept / reject buttons
- Used sharper panel silhouettes and stronger contrast to give the HUD a more premium look.

### 2) Better readability / less overlap
- Raised and polished the **voice subtitle box** so it interferes less with the bottom mission prompt.
- Added urgency states for:
  - round timer
  - passenger delivery timer
  - request panel when time is low
- Added a small visual state sync so the HUD reacts more clearly during critical moments.

### 3) Camera polish
- **Third-person chase camera** now feels slightly more deliberate:
  - small dynamic distance change while rowing / boosting
  - improved forward lead for better navigation readability
  - slightly calmer framing near walls
- **First-person / POV camera** now sits much closer to the majhi’s real viewpoint instead of feeling too far behind.
- Reduced excessive first-person roll/pitch so the game remains stormy but easier to read.
- Added a clearer camera button label so switching views is more understandable.

## Things intentionally left untouched
- Main menu design
- BRACU ID card / gate sequence UI
- Core mission logic
- Score / rescue rules / boarding logic

## Verification
- `node -c game.js`
- `node test_vm.js`
- `node test_events.js`
- `node test_horizon.js`

All passed after the HUD/camera changes.
