# Dusk City · 黄昏之城: walkable procedural 3D city (three.js)

A procedurally generated 3D city you can orbit around or walk through, with day/dusk/night lighting, bloom and a mini-map. Every texture and model is generated in JavaScript at start-up (about 5 s). Built 2026-10-19.

**Live:** https://connect-world-1985-ai.github.io/2026-10-20-city3d-demo/

## How to view
Open the link above, or open `index.html` directly in any modern desktop or mobile browser (WebGL2). No server, install or network needed: three.js r170 (MIT) is bundled inline.

## Controls
- M / Tab: switch Walk / Orbit
- Walk: click the canvas, then WASD + mouse, Shift to run, Space to jump
- Orbit: drag / scroll (right-drag to pan), double-click the ground to walk there
- 1 / 2 / 3: Day / Dusk / Night · B: bloom · H: help · V: hide UI · click the mini-map to teleport
- Touch: one finger to orbit, pinch to zoom; Walk mode has a virtual joystick, look area and jump button

URL params: `?q=high` disables auto quality drop · `?q=low` starts in low quality · `?pr=1` caps pixel ratio.
Debug API: `window.__city` (setMode, setTod, teleport, state…).

## Files
- `index.html`: the built, self-contained page (served by Pages).
- `src/`: source (`main.js`, `city.js`, `textures.js`, `sky.js`, `util.js`, `template.html`).
- `build/`: `build.mjs` bundler script plus Playwright test/screenshot scripts.
- `screenshots/`: sample views.

## Rebuild
```
cd build && npm i && node build.mjs   # regenerates ../index.html
```
