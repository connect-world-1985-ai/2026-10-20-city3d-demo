# Sweet City · 甜蜜之城: walkable procedural candy town (three.js)

A procedurally generated 3D candy town you can orbit, walk through or watch on a cinematic tour. Frosted rooftops with sprinkles, soft-serve towers, striped domes, candy-cane street lamps, a river with a striped suspension bridge, traffic that stops at red lights, pedestrians, fireworks, and a continuous day–night cycle. Every model and texture is generated in the browser at start-up; nothing is downloaded.

**Live:** https://connect-world-1985-ai.github.io/2026-10-20-city3d-demo/

## How to view
Open the link above, or open `index.html` directly in any modern desktop or mobile browser (WebGL2). No server, install or network needed: three.js r170 (MIT) is bundled inline.

## Controls
- **M / Tab**: switch Walk / Orbit
- **Walk**: click the canvas, then WASD + mouse, Shift to run, Space to jump
- **Orbit**: drag / scroll (right-drag to pan), double-click the ground to walk there
- **Time of day**: 1 / 2 / 3 / 4 jump to Day / Dusk / Night / Dawn; the slider sets any time; `[` `]` step ±15 min; **L** plays the day
- **T**: cinematic tour · **P**: photo mode (tilt-shift miniature, hides the UI)
- **Q**: quality (Ultra / High / Medium / Low) · **B**: bloom · **V**: hide UI · **H**: help · click the mini-map to teleport
- **Touch**: one finger to orbit, pinch to zoom; Walk mode has a virtual joystick, look area and jump button

URL params: `?q=ultra|high|medium|low` fixes the quality (and disables the automatic downgrade) · `?pr=1` caps the pixel ratio.
Debug API: `window.__city` (setMode, setTod, setHour, teleport, toggleTour, togglePhoto, state…).

## What's in it
- **Facades** are drawn by one shader, not a tiled texture: each building has its own window grid, frames, shutters, flower boxes or curtain-wall mullions. Every window is an interior-mapped room (walls, floor, ceiling lamp, furniture, curtains), shopfronts show candy-filled shelves, and lights switch on one by one as dusk falls. Window detail fades to an average at distance so it doesn't shimmer.
- **Districts** shape the skyline: a pastel glass core with soft-serve swirls, candy spires, striped domes and helipads; a chocolate quarter with chocolate-bar panels, gables and blade signs; residential streets with balconies, awnings, rooftop gardens and pools. The Sugar Spire landmark twists and tapers to a glowing frosting crown.
- **Streets**: rounded candy-striped curbs, crossings, traffic signals (the light state is computed on the GPU and shared with the car logic), seven vehicle types (including buses, taxis and an ice-cream truck) that queue, brake and turn, instanced pedestrians with a walk cycle, benches, bus stops, café terraces and wet-looking puddles at night.
- **Parks**: a fairground with a Ferris wheel and carousel, a three-tier cake fountain, a duck pond, a lollipop grove with gumdrop bushes, flower gardens around a giant cupcake, and a bandstand.
- **Waterfront**: a river with planar reflections, a promenade, an arched suspension bridge with lit cables, boats and cottages on the far bank, all set in pastel hills.
- **Atmosphere**: physically inspired sky with sun, moon and stars, cotton-candy clouds and hot-air balloons, height fog with sun scattering, ambient occlusion (GTAO), bloom, light shafts, colour grading and fireworks at night.
- **Performance**: geometry is merged into 3×3 chunks and small props are instanced with distance levels. Quality tiers trade AO, reflections, shadow resolution, bloom and pixel ratio, and the app drops a tier automatically if the frame rate falls.

## Files
- `index.html`: the built, self-contained page (served by Pages).
- `src/`: source. `main.js` (app, controls, UI), `city.js` (assembly, collision), `layout.js`, `buildings.js`, `facade.js`, `landmark.js`, `streets.js`, `traffic.js`, `people.js`, `nature.js`, `water.js`, `landscape.js`, `sky.js`, `tod.js`, `post.js`, `fx.js`, `textures.js`, `util.js`, `template.html`.
- `build/`: `build.mjs` bundler, `shots.mjs` (renders the fixed set of review cameras), `test.mjs` (smoke test: keys, time of day, walking and collision, bridge, tour, photo mode, quality, mini-map, traffic), `probe.mjs` (ad-hoc screenshot with a script).
- `screenshots/`: sample views.
- `PLAN.md`: the improvement plan this version implements.

## Rebuild
```
cd build && npm i && node build.mjs   # regenerates ../index.html
node test.mjs                         # smoke test (Playwright + Chromium)
node shots.mjs                        # regenerates ../screenshots
```
