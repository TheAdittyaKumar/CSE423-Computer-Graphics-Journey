# Majhi Jaben?! — Web Fidelity v9

This archive contains a full replacement `docs/` website for the existing GitHub Pages game and a parity report. It is based on `MajhiJaben_CinematicEdition_NoComments(3).py` and the working v8 browser edition.

## Deploy

1. Unzip. Open `docs/` and upload **all six files** from that directory into the *existing repository*'s `docs/` directory (not a nested `docs/docs/` directory).
2. Replace `game.js`, `index.html`, `styles.css`, `menu-scene.js`, `original-geometry.bin`, and `original-geometry.json` together. Both geometry files must be updated because v9 reindexes the geometry and adds source-derived shop animation frames.
3. Keep your root `README.md`, Python original, lab work, and other project files untouched.
4. Commit, wait for the GitHub Pages deployment check to pass, then hard-refresh with Ctrl+Shift+R.
5. Your project URL should remain `https://theadittyakumar.github.io/CSE423-Computer-Graphics-Journey/`.

## Most visible changes

- Clear **time to BRACU delivery** displayed while any student is onboard; individual names and their own countdowns shown. Urgent (< 25 sec) timers turn red.
- Active rescue queue (up to five accepted requests) showing names, status, time left.
- Larger minimap (360px backing canvas), larger mission symbols, more readable legend.
- Moving traffic now stops before reaching the boat, and resumes where it stopped after the boat moves.
- 24 original-source shop customer/keeper geometry poses (12 each at two shops) replace frozen snapshot characters.
- Current-direction arrows, moving-vehicle wake trails, and BRACU delivery celebration rings/banner.
- More complete ending report. Six misses wait for the last drowning animation before ending (the Python rule).
- Optional F3 graphics-quality switch and F4 render-performance readout.

## Known limitations

Source code geometry and gameplay tests pass; **real hardware WebGL rendering was not available in the test environment**. Validate the appearance and performance on your browser. Not all original visuals, subtle effects, precise timings, animated fog/weather shading, UI/menu details, and collision corner cases are certified identical to Python. The browser port should be called *fidelity v9*, not a complete one-to-one port.
