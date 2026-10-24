# Dusk City v2: improvement plan

Status: **draft for review**. Nothing here is implemented yet.
Branch: `claude/beautiful-hawking-60ityz`

## Goal

Make the city look as good and as detailed as it can, from the orbit overview down to street level, while keeping what already works:

- one self-contained `index.html`, no network, everything generated procedurally at start-up
- walk and orbit modes, collision, mini-map, touch controls, the `window.__city` debug API
- runs on a mid-range laptop and degrades gracefully on mobile (the existing adaptive quality system stays)

## What the current version does well, and where it falls short

I reviewed `src/*.js` and the screenshots in `screenshots/`.

**Good base:** clean block grid, a merged-geometry and instancing approach (about 50 draw calls), working shadows, bloom, three time-of-day presets, a Ferris wheel, traffic and a landmark tower.

**What makes it read as a "toy city" today:**

| Area | Current state | Why it looks cheap |
|---|---|---|
| Buildings | Every building is 1 to 3 stacked boxes with one of 3 tiled window textures | The same 8x8 window tile repeats everywhere. Windows run right down to the pavement (no shops, lobbies or doors). Facades are perfectly flat, with no ledges, cornices or mullion depth. Roofs are flat grey slabs with random boxes on them. |
| Window lights | Baked into the texture, so lit/unlit is identical on every repeat | The repeating pattern is visible from orbit, and lights cannot switch on gradually at dusk. |
| Streets | Flat asphalt plane with instanced line markings | No curbs to speak of, no traffic lights, signs, benches, bus stops or people. Sidewalks are wide and empty at street level. |
| Vehicles | One box car model in 12 colours driving loops around blocks | No variety (taxis, buses, vans), cars drive through each other at intersections, and nothing ever stops. |
| Trees | Three icosahedron blobs per tree, flat-shaded | Fine from orbit; very low-poly up close (see the right edge of `03-walk-dusk-street.png`). |
| Sky and atmosphere | Gradient sky with an fbm cloud layer, exponential fog, ring of smooth "hills" | The hills are a flat-coloured donut; fog is uniform, with no height falloff or sun scattering; there are no god rays at dusk. |
| Lighting | One 2048² shadow map refocused on the camera, hemisphere light, PMREM of the sky | No ambient occlusion, so building bases and street corners look like they float. Shadows go soft and blurry from orbit. At night, street lamps light only an additive decal; facades get no light at all. |
| Post-processing | Bloom and ACES | No AO, colour grading, vignette or depth haze. |
| Time of day | Three hard presets | No sunrise, golden hour or a continuous sun path. |

## Proposed work, in phases

Each phase ends with a fresh set of screenshots from the same camera positions (before and after) and a perf check, so we can review step by step and stop at any point.

### Phase 0: tooling and baseline (small)
- Make the Playwright screenshot script path-independent (it currently hard-codes `/workspace/city3d-demo/screenshots/`), and add a fixed list of "review cameras": overview, mid-height, street level, park, landmark, at day, dusk and night.
- Record baseline numbers: build time, draw calls, triangles, file size.
- Remove or fold the throwaway `build/test1..7.py` into one test script.

### Phase 1: rendering pipeline (largest visual gain per line of code)
1. **Ambient occlusion:** three.js r170 ships `GTAOPass`. Use it on high quality, with a cheaper half-res variant on balanced and none on fast. This grounds every building, tree and car.
2. **Better shadows:** replace the single refocused shadow map with 3 cascades (the three.js `CSM` addon or a small custom version): crisp shadows at your feet and stable ones across the whole city from orbit.
3. **Atmosphere:** custom fog chunk with height falloff and sun-direction in-scattering (warm haze toward the sun at dusk, cool away from it). Add a light-shaft (god-ray) pass at dusk only.
4. **Sky:** physically based sky (Preetham/Hosek model, like the three.js `Sky` addon) driven by real sun elevation, plus a two-layer cloud shader with sun-lit edges. Add moon and stars at night.
5. **Continuous time of day:** a slider (and a "play" button) from dawn to night that drives the sun along an arc. The keys 1/2/3 stay as shortcuts that jump to day/dusk/night. Lighting parameters are interpolated from keyframes instead of three fixed presets.
6. **Grading:** AgX or tuned ACES, a small procedurally generated colour-grading LUT per time of day, subtle vignette and film grain. The `B` key keeps toggling bloom.

### Phase 2: buildings (the core of "more detail")
1. **Shader-based windows instead of a tiled texture.** A facade shader computes window cells from world position, giving per-building window sizes, mullion patterns and spacing. Each window gets a hash-based "is it lit / which colour / when does it turn on" value, so lights switch on gradually through dusk and the pattern never repeats.
2. **Interior mapping** for glass windows: a fake room (back wall, floor, ceiling, occasional furniture silhouette or curtain) rendered with parallax inside each window. This is the single most convincing trick for street-level and mid-range views, and it costs one shader, not geometry.
3. **Building grammar: base, shaft and crown.**
   - Ground floor: storefronts with large display windows, doors, awnings in varied colours, lit shop interiors, and the existing neon signs moved here.
   - Shaft: horizontal ledges and cornices every few floors, vertical pilasters, balconies on residential blocks, curtain-wall mullions with real depth on glass towers.
   - Crown: varied tops, including setback "wedding-cake" Art Deco crowns, spires, sloped glass tops, rooftop water towers (a New York touch), helipads, solar panels, rooftop gardens and pools, and HVAC with ducts.
4. **More building archetypes**, chosen by district: brick walk-ups with fire escapes (old town), Art Deco towers, modern glass towers with chamfered or rounded corners, a twisted signature tower, mid-rise offices, and low row houses near parks.
5. **Districts:** split the 9x9 grid into a financial core, an old town, a residential ring and a waterfront, so the skyline reads as a real city with a shape rather than a random height field.
6. **Landmark tower redesign:** a tapered, faceted tower with a lit crown, observation deck and spire, replacing the three stacked boxes.
7. **Detail level:** full detail geometry only for blocks near the camera; distant blocks use the plain box plus the window shader. The city is chunked per block so off-screen blocks are culled (today it is one giant mesh per material, so nothing is culled).

### Phase 3: streets and life
1. **Real curbs, gutters and drains**, with corner radii at intersections, kerb ramps at crossings, manholes and road-wear decals (patches, oil stains and cracks), and a slightly wet, reflective road option at night.
2. **Street furniture (all instanced):** traffic lights at every intersection with working cycles, walk signals, street name signs, bus stops with lit ads, benches, bins, fire hydrants, bollards, newspaper boxes, parking meters and bike racks.
3. **Traffic that obeys the lights:** several vehicle models (sedan, hatchback, taxi, bus, delivery van, the odd sports car), real rolling wheels, brake lights when stopping, headlights at dusk, and queueing at red lights instead of the current fixed loops. Parked cars along some kerbs.
4. **Pedestrians:** instanced low-poly people with a vertex-shader walk cycle, walking along sidewalks and waiting at crossings. No skeletons, so they stay cheap: a few hundred visible near the camera.
5. **Small ambient motion:** flags on the landmark and civic buildings, birds circling at dusk, a plane with blinking lights crossing the sky at night.

### Phase 4: nature, water and landscape
1. **Trees:** several species (round deciduous, conifer, palm-like plaza tree, autumn colours) built from clustered leaf cards with alpha-tested leaf texture and a wind-sway shader. Higher detail near the camera, current blob style far away.
2. **Parks:** curved paths instead of a plus sign, a fountain with animated water and particle spray, a pond, flower beds, hedges, benches and park lamps, plus a playground or basketball court in one park.
3. **Waterfront:** replace one edge of the city with a river or bay that uses a reflective water shader (three's `Water`/`Reflector` style, with planar reflection on high quality and an environment-map fallback on lower). Add a promenade and a suspension bridge with lit cables. This makes dusk and night shots dramatically better because the skyline reflects.
4. **Landscape:** noise-based terrain hills with grass, rock and tree colouring instead of the smooth donut, and a faint distant-city silhouette on the horizon.

### Phase 5: night and dusk lighting
1. **Lamps that light things:** a cheap "light card" approach that projects lamp light onto nearby facades and the road in the shader (no per-lamp real-time lights), plus the existing glow sprites.
2. **Neon signs** with flicker and coloured light spill onto the pavement; vertical blade signs on old-town buildings; a lit billboard or two on rooftops.
3. **Aviation lights** synchronised across towers, a lit landmark crown and spire, illuminated bridge cables, and window lights reflected on the water.

### Phase 6: presentation and UX
- **Cinematic tour:** a button that flies a scripted camera path through the city (useful for demos and for generating review screenshots).
- **Photo mode:** hide the UI, free camera, depth-of-field toggle.
- **Quality selector** in the UI (Low / Medium / High / Ultra) on top of the current automatic downgrade; Ultra enables planar reflections, full-res AO and more pedestrians.
- Update the help screen and README, and regenerate screenshots.

## Performance and size budget (proposal)

| Item | Today | Target |
|---|---|---|
| `index.html` size | 594 KB | ≤ 1.2 MB (still single file, no assets) |
| Start-up generation | ~5 s | ≤ 6 s on a laptop; heavy work split across frames with a progress bar |
| Draw calls (high) | ~50 | ≤ 300 |
| Frame rate | n/a | 60 fps at 1080p on an integrated laptop GPU at "High"; mobile falls back to "Low" automatically |

I can only measure with the software renderer in this environment (SwiftShader), so I will compare relative cost (draw calls, triangles, shader passes) and rely on the quality tiers. A real-GPU check on your side would be valuable after Phases 1 and 2.

## Order and checkpoints

I suggest doing Phases 0 → 1 → 2 first, since they change the look the most, then reviewing screenshots together before continuing with 3 → 4 → 5 → 6. Each phase is a separate commit (or a few), pushed to this branch, with before/after screenshots in `screenshots/`.

## Questions for you

1. **"Sweet city":** did you mean the existing Dusk City generally, or do you want a particular flavour, for example a candy-coloured or pastel "sweet" style? That would change the palette and building choices in Phase 2.
2. **Scope:** all six phases, or should I stop after Phases 1 and 2 for a review?
3. **Real-world feel vs. stylised:** should I aim for photoreal-leaning (current direction, more realistic materials), or a stylised look (crisper, more colourful, like a premium city-builder game)?
4. **Waterfront:** OK to replace one edge of blocks with a river or bay? It changes the map and the mini-map.
5. **Size budget:** is about 1.2 MB for `index.html` acceptable, or must it stay near 600 KB?
6. **Mobile:** must mobile keep the same feature set, or is "looks good on desktop, runs acceptably on mobile at Low" enough?
