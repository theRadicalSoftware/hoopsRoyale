# Hoops Royale — Project Guide

## What Is This?

Hoops Royale is a **street basketball game** built entirely in **Three.js** (v0.162.0) using vanilla JavaScript ES modules with zero build tools. The game runs in any modern browser from a static file server. No bundler, no npm dependencies at runtime — just an `index.html` that loads Three.js from a CDN via import maps.

The vision: a gritty, NYC street basketball experience. Think Central Park pickup games with chain-link fences, graffiti, cracked asphalt, and city skyline all around. The game starts at a worn-down public court and will eventually progress to better courts as the player advances.

## Current State (as of March 2026)

**What exists:**
- A fully built, explorable 3D environment (court, park, city)
- A controllable player character with jointed limbs, walk/jump animation, and velocity-based movement
- Basketball with procedural leather texture, physics (gravity, bounce, drag, rolling), and sleep system
- Ball pickup (X key), idle chest hold, and speed-triggered dribbling with phased animation cycle
- Collision system for both player and ball against environment objects (benches, trash cans, bleachers, fence posts, hoop poles, backboards)
- Dribble-time collision release (ball bounces off objects while being dribbled and escapes player control)
- Three camera modes: Orbit, Free Roam, and Drop In (player control with camera-relative movement)
- Day/night cycle with smooth transitions, celestial bodies (sun/moon), and illuminating lamp posts
- Chain-link fencing with gate openings, bleachers, benches, trees, paths
- NYC-style city surroundings with buildings, streets, cars, street props
- Six UI buttons: Orbit Cam, Free Roam, Drop In, Ball Drop, Panels toggle, Day/Night toggle

**What does NOT exist yet:**
- Shooting mechanic (aim, power, release arc)
- Scoring / hoop detection (ball passing through rim)
- AI opponents or teammates
- Game rules, scoring, game modes
- Sound/audio
- Multiplayer
- Court progression system
- Player customization

The project is at the **basketball dribbling stage**. The player can walk, jump, pick up the ball, hold it at chest level while idle, and automatically dribble while running. The next major milestone is **shooting mechanics** — aiming, releasing, ball arc physics, and rim/backboard collision for makes/misses.

---

## How to Run

```bash
# Any static file server works. Examples:
python3 -m http.server 8080
# or
npx serve .
# or
npx http-server .
```

Then open `http://localhost:8080` in a browser. That's it — no install, no build step.

The `package.json` exists solely to set `"type": "module"` so that `node --check` can validate ES module syntax during development.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D Engine | Three.js v0.162.0 via CDN importmap |
| Module System | Native ES modules (`<script type="module">`) |
| Textures | 100% procedural via `<canvas>` + `CanvasTexture` — no image files |
| Controls | `OrbitControls` (orbit/player modes) + custom pointer lock (free roam) |
| Rendering | `WebGLRenderer` with PCFSoftShadowMap, ACESFilmicToneMapping, SRGBColorSpace |
| Build Tools | None — zero dependencies, no bundler |

**Performance settings:** `powerPreference: 'high-performance'`, pixel ratio capped at 1.5, sun shadow map 2048x2048, lamp post SpotLights have `castShadow: false` to avoid 6 extra shadow-map passes per frame.

---

## File Architecture

```
Hoops-Royale/
├── index.html          # Entry point, UI buttons, CSS, importmap
├── package.json        # Just { "type": "module" } for node --check
├── CLAUDE.md           # This file
├── .gitignore
└── js/
    ├── main.js         # Scene setup, camera, controls, day/night, animation loop (~756 lines)
    ├── court.js        # Basketball court surface, lines, paint, graffiti (~672 lines)
    ├── hoops.js        # Hoop assemblies (poles, backboards, rims, chain nets) (~474 lines)
    ├── park.js         # Fencing, trees, benches, bleachers, lamps, paths (~1161 lines)
    ├── city.js         # Buildings, streets, sidewalks, cars, street props (~707 lines)
    ├── lighting.js     # All scene lights (sun, ambient, hemi, fill, rim, lampposts, moon) (~86 lines)
    ├── player.js       # Player model, joints, walk/jump/idle/carry animation, collision (~622 lines)
    └── ball.js         # Basketball creation, physics, dribbling, pickup, collisions (~703 lines)
```

### Module Dependency Graph

```
index.html
  └── js/main.js (entry point)
        ├── js/court.js      → createCourt(scene)
        ├── js/hoops.js      → createHoops(scene)         [sets scene.userData.hoopColliders]
        ├── js/park.js       → createPark(scene)           [sets scene.userData.parkColliders]
        ├── js/city.js       → createCity(scene)
        ├── js/lighting.js   → createLighting(scene)
        ├── js/player.js     → createPlayer(scene), updatePlayer(pd, delta, input, movementBasis, colliders, carryState)
        └── js/ball.js       → createBasketball(scene), dropBasketballAtCenter(ball), tryPickUpBasketball(ball, playerData), updateBasketball(ball, delta, colliders, playerData)
```

Every environment module exports a single factory function that creates a `THREE.Group`, populates it, adds it to `scene`, and returns it. `hoops.js` and `park.js` also populate `scene.userData` with collider arrays. `player.js` and `ball.js` export additional update/interaction functions.

---

## Detailed File Guide

### `main.js` (~756 lines) — The Brain

This is the orchestrator. It owns the renderer, scene, camera, controls, and animation loop.

**Key systems:**

1. **Renderer**: WebGL with antialiasing, PCFSoftShadowMap, ACES tonemapping, `powerPreference: 'high-performance'`, pixel ratio capped at 1.5
2. **Camera modes** (variable: `cameraMode`):
   - `'orbit'` — OrbitControls around court center. Default on load.
   - `'freeroam'` — First-person with pointer lock. WASD + mouse look. Custom yaw/pitch system.
   - `'player'` — Third-person. OrbitControls target follows the player. Arrow keys/WASD move player relative to camera facing. X picks up ball.
3. **Day/Night system**: `dayNightTransition` lerps from 0 (day) to 1 (night). `applyDayNightState(t)` updates:
   - Fog color and density
   - Tone mapping exposure
   - Sky background texture swap (at t=0.5)
   - Every light intensity (by `userData.lightRole`)
   - Window emissive glow on buildings
   - Lamp bulb emissive glow
   - Sun/moon mesh opacity (3D celestial bodies)
4. **Delta smoothing**: `smoothedDelta += (clampedDelta - smoothedDelta) * 0.18` prevents jitter from frame time spikes
5. **Loading sequence**: `buildScene()` creates everything in order with progress bar updates
6. **Animation loop**: Updates controls, player, basketball, day/night, net sway, and leaf sway every frame
7. **Tag system**: After scene build, `collectTransparentObjects()`, `collectAnimatedObjects()`, and `tagCityWindows()` traverse the scene tree to tag/cache meshes for runtime behavior
8. **Ball Drop**: `dropBall()` function exposed to `window` for the UI button, calls `dropBasketballAtCenter()`

**Important global state:**
- `lightingGroup` — reference to the lighting group, traversed during day/night updates
- `playerData` — the player state object from `createPlayer()`
- `basketballData` — the ball state object from `createBasketball()`
- `transparentObjects[]` — cached list of all meshes with `userData.isTransparentHelper = true`
- `animatedNets[]`, `animatedLeaves[]` — cached for per-frame animation
- `hoopColliders[]`, `parkColliders[]`, `playerColliders[]` — combined collider arrays from hoops.js and park.js
- `pickupQueued` — set true on X keypress, consumed next frame
- `sunMesh`, `moonMesh`, `moonGlowMesh` — celestial body references
- `playerMoveBasis` — `{ forward, right }` vectors computed from camera direction each frame for camera-relative controls

**Exposed to window (for HTML button onclick):**
- `window.switchCameraMode(mode)`
- `window.toggleTransparentHelpers()`
- `window.toggleDayNight()`
- `window.dropBall()`

**Camera-relative movement** (in player mode): Each frame, `camera.getWorldDirection()` is projected onto the XZ plane and normalized to create a forward vector. The right vector is the cross product with world up. These are passed to `updatePlayer()` as `movementBasis` so WASD/arrow keys move relative to the camera's facing direction, not world axes.

### `court.js` (~672 lines) — The Playing Surface

NBA regulation court (28.65m x 15.24m, 1 unit = 1 meter).

**Key constants:**
- Court: 28.65 x 15.24m
- Key/paint: 4.88 x 5.79m
- Three-point radius: 7.24m
- Free throw circle: 1.83m radius
- Rim from baseline: 1.575m

**Layers (bottom to top):**
1. **Ground** (`y=-0.02`): 300x300m grass plane, procedural texture with dirt patches and grass blades
2. **Court surface** (`y=-0.015`): Cracked asphalt box extending 3m beyond court boundaries on each side
3. **Playing surface** (`y=0.06`): Green court area with worn texture, scuff marks, faded paint
4. **Paint areas** (`y=0.065`): Two key areas in faded red with chipped paint showing asphalt underneath
5. **Court lines** (`y=0.072`): All NBA markings — boundary, center, keys, free throw circles, three-point arcs, restricted areas, lane blocks
6. **Details** (`y=0.073-0.075`): Worn patches, shoe scuff marks, gum spots
7. **Graffiti** (`y=0.076`): Canvas-drawn street art — "HR" center court, "BKLYN", "KING'S COURT", "NO EASY BUCKETS", "RUN IT BACK", "CB", "NEXT UP"

**Color palette** (deliberately faded/yellowed for street feel):
- Lines: `0xccccaa` (yellowed white)
- Paint: `0x882222` (faded red)
- Court: `0x2a4a28` (dark worn green)
- Asphalt: `0x383838`

### `hoops.js` (~474 lines) — The Hoop Assemblies

Two identical hoop assemblies, one at each end (sides -1 and +1).

**Each assembly contains:**
1. **Pole structure**: Vertical pole (tapered cylinder), horizontal arm to backboard, diagonal brace, base plate with bolts, safety padding on lower pole
2. **Backboard**: Glass material (`MeshPhysicalMaterial` with `transmission: 0.4`), metal frame on all 4 edges, shooter's square outlines on both faces. NOT tagged as `isTransparentHelper` — always visible.
3. **Rim & bracket**: Orange torus at regulation height (3.048m). Connected to backboard via a neck bar + mounting bracket + two angled support arms. 12 hook points around rim for net attachment.
4. **Chain net**: Diamond-pattern mesh. Built from a node grid (12 columns x 11 rows) where odd rows are offset by half a column. Nodes connected by cylinder links aligned with quaternions. Tapers from rim radius to 65% at bottom. Has a bottom ring connecting the last row.

**Colliders**: Sets `scene.userData.hoopColliders` — an array of cylinder and AABB colliders for the poles and backboard structures. These are combined with park colliders in main.js to form `playerColliders`.

**Positioning math** (critical, was a major bug source):
```
backboardFaceZ = baselineZ - side * BACKBOARD_FROM_BASELINE
backboardCenterZ = backboardFaceZ + side * (BACKBOARD_THICKNESS / 2)
rimCenterZ = backboardFaceZ - side * (RIM_FROM_BACKBOARD + RIM_RADIUS)
```
The `side` variable (-1 or +1) ensures everything faces the correct direction on both ends.

### `park.js` (~1161 lines) — The Park Environment

The largest file. Creates everything between the court and the city.

**Fencing system** (`createFencing`):
- Fence boundary: `halfW = COURT_WIDTH/2 + 4.5 = 12.12`, `halfL = COURT_LENGTH/2 + 6.0 = 20.325`
- 6 fence segments: left side (full), right side (full), back side (split for gate), front side (split for gate)
- Gate openings (2.8m wide) centered at x=0 on front and back sides — behind each hoop
- Chain-link texture: procedural diamond wire pattern on 512px canvas, separate color and alpha textures
- Wire panels: `PlaneGeometry` with manually tiled UVs, rotated by `angle + Math.PI/2` to face correctly
- Rails: cylinders along top and bottom of each segment, same rotation offset
- Posts: evenly spaced along each segment (~2.8m apart) with sphere caps
- Gate posts: thicker (0.06 radius) with caps and horizontal top bar
- Wire panels tagged `userData.isTransparentHelper = true` — toggled by Panels button. Posts/rails stay visible.

**Lamp posts** (`createLampPosts`):
- 6 lamps at `x = ±13.5` (just outside fence), z positions at -14, 0, 14
- NYC "Bishop's Crook" inspired design:
  - Ornate base: footing, pedestal, decorative torus rings
  - Tapered lower section with mid-ring
  - Main shaft (5.5m total height)
  - Curved shepherd's crook arm (10 arc segments)
  - Decorative scroll curl at tip
  - Lantern housing: dome cap, finial, wireframe cage, translucent glass cylinder, glowing bulb, bottom ring, hanging finial
- Bulbs tagged `userData.isLampBulb = true` for day/night glow control
- `facing` parameter (1 or -1) controls which direction the arm extends

**Colliders**: Sets `scene.userData.parkColliders` — an array of AABB and cylinder colliders for benches, trash cans, bleachers, and fence posts. These prevent the player and ball from passing through these objects.

**Trees** (`createTrees`): ~30 trees of 3 types (deciduous, oak, pine) with procedural textures and leaf sway animation via `userData.isLeaves`. Positioned throughout the park avoiding the court/fence area.

**Other elements:**
- Benches: 6 park benches inside fence at x=±10.5 along the sidelines
- Bleachers: 8 total — 4 along long sides (3-row, 5m wide), 4 behind hoops (2-row, 4m wide)
- Trash cans, drinking fountain, scattered leaves/pebbles
- Walking paths: paver-textured paths forming a perimeter loop, diagonal corner paths, and cardinal exit paths

### `city.js` (~707 lines) — The NYC Surroundings

Creates the urban environment around the park on all four sides.

**Layout** (from park outward):
1. **Sidewalks** (52-55.5m from center): concrete with expansion joint grid texture, raised curbs
2. **Streets** (55.5-61.5m): asphalt with yellow dashed center lines, white edge lines, corner fillers
3. **Building blocks** (62m+): procedurally generated on a grid with random sizes, heights, and colors

**Buildings**:
- Colors from brownstone, concrete, brick, and glass/steel palettes
- Height scales with distance from park (closer = shorter, zoning feel)
- Features: window grids (emissive rectangles on all faces, ~40% lit), metal cornices, ground floor awnings
- Rooftop details: NYC water towers (wooden tank + cone roof + metal legs + bands), AC units
- Windows are tagged during `tagCityWindows()` by matching emissive hex color: `0xffcc66` = lit, `0x334455` = dark

**Street props**: fire hydrants, street signs (dual perpendicular plates), newspaper boxes, traffic lights with colored bulbs

**Parked cars**: ~20 cars along all streets. Each has body, cabin (translucent glass), 4 wheels, headlights, taillights. Random colors from 7 options.

### `lighting.js` (~86 lines) — Scene Lighting

Returns a `lightGroup` with all lights tagged by `userData.lightRole` for the day/night system.

| Light | Role tag | Day intensity | Night intensity | Notes |
|-------|----------|--------------|-----------------|-------|
| AmbientLight | `ambient` | 0.45 | 0.12 | Base fill |
| HemisphereLight | `hemi` | 0.5 | 0.08 | Sky/ground color |
| DirectionalLight (sun) | `sun` | 1.8 | 0.05 | 2048 shadow map, casts shadows |
| DirectionalLight (fill) | `fill` | 0.35 | 0.02 | Back-fill from opposite side |
| DirectionalLight (rim) | `rim` | 0.25 | 0.0 | Edge highlighting |
| DirectionalLight (moon) | `moon` | 0.0 | 0.35 | Night-only moonlight |
| SpotLight x6 | `lamppost` | 0.5 | 4.0 | Aimed downward from lantern positions, no shadow casting |
| PointLight x6 | `lamppost` | 0.15 | 2.0 | Ambient glow around each lantern |

Lamp light positions are calculated to match the lantern positions in park.js: `lanternX = x + facing * 1.4`, `lanternY = 5.05`.

### `player.js` (~622 lines) — The Player Character

**Model** (1.88m tall, basketball player proportions):
- Head: sphere (r=0.105) + headband torus
- Neck: cylinder
- Torso: upper box (shoulders) + lower box (jersey)
- Waist: box (shorts)
- Arms (x2): shoulder pivot → shoulder cap → upper arm → elbow pivot → elbow joint → lower arm → hand
- Legs (x2): hip pivot → upper leg (shorts material) → knee pivot → knee joint → shin → sock → shoe → sole
- Shadow disc: dark transparent circle at feet

**Joint hierarchy** (critical for animation):
```
root (THREE.Group, positioned in world)
├── head, headband, neck, upperTorso, lowerTorso, waist (static)
├── leftShoulderPivot (y=1.52)  ← ROTATE THIS for arm swing
│   ├── shoulderCap, upperArm
│   └── leftElbowPivot (y=-0.30 from shoulder)  ← ROTATE THIS for elbow bend
│       ├── elbowJoint, lowerArm, hand
├── rightShoulderPivot (mirror)
├── leftHipPivot (y=1.05)  ← ROTATE THIS for leg swing
│   ├── upperLeg
│   └── leftKneePivot (y=-0.36 from hip)  ← ROTATE THIS for knee bend
│       ├── kneeJoint, shin, sock, shoe, sole
└── rightHipPivot (mirror)
```

All animation is done by rotating the pivot groups around their X axis (and Y/Z for carry poses).

**Movement physics:**
- `ACCELERATION = 24`, `DECELERATION = 28` — exponential smoothing via `1 - Math.exp(-rate * delta)`
- `WALK_SPEED = 4.5 m/s`, `JUMP_FORCE = 6.5 m/s`, `GRAVITY = -16 m/s^2`
- `PLAYER_FOOT_OFFSET = 0.265` — distance from root origin to sole bottom; `GROUNDED_Y = -PLAYER_FOOT_OFFSET` so feet sit on `y=0`
- `PLAYER_COLLIDER_RADIUS = 0.22` — used for environment collision resolution
- `TURN_SPEED = 10` — smooth rotation to face movement direction
- `moveBlend` — smooth transition factor for walk animation (blends in at rate 14, out at rate 10)
- Camera-relative movement via `movementBasis` parameter: input directions are projected onto camera forward/right vectors

**Collision resolution** (`resolvePlayerCollisions`):
- Iterative (3 passes) against AABB and cylinder colliders
- Height-filtered: skips colliders above head or below feet
- Separates player position then removes inward velocity component
- Same algorithm structure as ball collision but for the player capsule

**Animation states:**
1. **Walking**: Sinusoidal swing on `walkCycle` counter. Legs and arms swing opposite. Knees bend on backward swing. Walk cycle advances proportional to movement speed.
2. **Jumping**: Arms reach up on ascent, legs tuck. Reverses on descent. Uses lerp for smooth transitions.
3. **Idle**: Subtle breathing — tiny arm sway on a sine wave. All joints lerp back to rest.
4. **Carry-idle** (ball held, standing): Two-hand chest hold. Arms bent inward (shoulders rotated on Y/Z axes), elbows at -1.12 radians. Subtle breathing movement.
5. **Carry-dribble** (ball held, running): Right hand drives the dribble. Right shoulder/elbow animate based on `dribblePhase`. Left arm holds secondary position. Lower body continues normal walk cycle.

**Controls** (handled in main.js):
- Arrow keys / WASD set `playerInput` flags
- Space sets `playerInput.jump`
- X queues ball pickup attempt
- Player smoothly rotates to face movement direction

### `ball.js` (~703 lines) — The Basketball

The newest and most complex gameplay module. Handles ball creation, physics simulation, environment/player collision, held ball state machine (idle hold + dribbling), and dribble-time collision release.

**Ball creation** (`createBasketball`):
- `SphereGeometry` with `BALL_RADIUS = 0.1193` (official size 7)
- Procedural leather texture: radial gradient base (orange), 30k pebbled noise dots, dark seams (equator, meridian, 2 curved side seams), seam highlights
- `MeshStandardMaterial` with `roughness: 0.82`, `metalness: 0.02`
- Starts hidden (`mesh.visible = false`); activated by `dropBasketballAtCenter()`

**Ball state object:**
```js
{
    mesh,                    // THREE.Mesh
    radius: BALL_RADIUS,
    active: false,           // whether ball is in play
    heldByPlayer: false,     // currently held by player
    dribblingByPlayer: false,// dribbling (subset of held)
    dribblePhase: 0,         // 0 to 2π, drives dribble animation
    sleeping: false,         // physics paused (ball at rest)
    grounded: false,         // touching floor
    velocity: Vector3,
    prevPosition: Vector3,   // for rolling rotation
    idleFrames: 0            // counter toward sleep
}
```

**Physics constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| `GRAVITY` | -11.5 | Downward acceleration |
| `AIR_DRAG` | 0.12 | Velocity damping per second |
| `FLOOR_BOUNCE` | 0.74 | Restitution on floor hit |
| `WALL_BOUNCE` | 0.58 | Restitution on environment collider hit |
| `GROUND_FRICTION` | 6.0 | Horizontal deceleration when grounded |
| `ROLL_DAMP` | 2.4 | Tangential damping on wall bounce |
| `PICKUP_RADIUS` | 0.72 | Max XZ distance for ball pickup |

**Physics loop** (`updateBasketball`):
1. If ball is held by player → delegate to `updateHeldByPlayer()` (may return early or release)
2. If sleeping → check if player is nearby to wake; otherwise skip
3. Adaptive substeps based on speed: 1 step below 4.5 m/s, up to 5 steps above 14 m/s
4. Each substep: apply gravity + air drag → move → resolve floor → resolve environment collisions → resolve player collision
5. After substeps: apply rolling rotation (quaternion from displacement) → check sleep (24 idle frames at <0.03 speed)

**Floor model** (`sampleFloorY`):
- Court surface (within COURT_WIDTH/2 x COURT_LENGTH/2): y = 0.06
- Asphalt pad (within 3m/4m padding): y = 0.045
- Park ground: y = -0.02

**Environment collision** (`resolveEnvironmentCollisions`):
- Iterates all colliders with broadphase culling (cached bounding circle per collider with `COLLIDER_BROADPHASE_PAD = 0.35`)
- Y-range check first (ball top/bottom vs collider yMin/yMax)
- **Cylinder colliders**: distance from ball center to cylinder axis vs combined radii. Push out + bounce.
- **AABB colliders**: closest point on AABB to ball center. If inside radius → push out. If center is inside box → push out via nearest face.
- Bounce uses `bounceAgainstNormal()`: reflects velocity component along normal, applies tangential damping to prevent infinite sliding

**Player collision** (`resolvePlayerCollision`):
- Treats player as cylinder (radius 0.25, height 1.9m from ground)
- Pushes ball away from player body + adds impulse in push direction + slight upward pop (0.15)
- Uses player velocity to add momentum transfer

**Ball pickup** (`tryPickUpBasketball`):
- Checks: ball active, not already held, player visible
- XZ distance within `PICKUP_RADIUS` (0.72)
- Vertical gap within 1.35m of player's waist height
- On success: sets `heldByPlayer = true`, zeroes velocity, snaps ball to hold position

**Held ball state machine** (`updateHeldByPlayer`):
- Determines dribbling vs idle based on: `playerData.isGrounded && speed > DRIBBLE_TRIGGER_SPEED (0.45)`
- Uses `getHandWorldPosition()` to find actual hand world positions via joint `localToWorld()`
- `selectPlayerRightHand()` picks whichever hand is more to the right side
- `constrainHeldBallFromPlayer()` ensures ball stays minimum distance from player center and on the right side during dribbling

**Idle hold** (not dribbling):
- Ball placed exactly between both hands at chest level
- `tmpBallFromRight` and `tmpBallFromLeft` computed from hand positions with `HOLD_HAND_INSET` offset
- Midpoint of both = hold target. Minimum y = `groundY + HOLD_CHEST_HEIGHT - 0.08`

**Dribble cycle** (when moving):
- `dribblePhase` advances by `cadence * dt * 2π` where cadence scales from `DRIBBLE_SPEED_MIN (1.45)` to `DRIBBLE_SPEED_MAX (2.35)` based on player speed
- Phase 0→`DRIBBLE_TOP_DWELL (0.08)`: ball held at max height (hand contact dwell)
- Phase `TOP_DWELL`→0.5: push down (smoothstep eased) from max to min height
- Phase 0.5→`0.5+BOTTOM_DWELL (0.06)`: floor compression/rebound moment
- Phase `BOUNCE_END`→1.0: return up (smoothstep eased) from min to max height
- Ball position smoothed with `follow = 1 - Math.exp(-HOLD_SMOOTH_DRIBBLE * dt)`, with tight pin at hand-contact phase
- Ball spins around the right axis during dribble (6.5-10.5 rad/s based on speed)

**Dribble collision release**:
- While dribbling, environment collisions are checked against the held ball position
- If collision detected: ball velocity gets "away from player" boost, `releaseHeldBall()` called with `preserveVelocity = true`
- Ball bounces away naturally and returns to free physics — player loses control
- This prevents the ball from clipping through benches/fences while dribbling

### `index.html` (~184 lines) — Entry Point

- Loading screen with animated progress bar
- HUD overlay with game title
- 6 UI buttons: Orbit Cam, Free Roam, Drop In, Ball Drop, Panels toggle, Day/Night toggle
- Controls hint text at bottom (updates per camera mode, includes X key instruction in player mode)
- CSS: dark theme, minimal UI, backdrop blur on buttons
- Import map pointing to Three.js CDN (v0.162.0)

---

## Collision System Architecture

The collision system has two independent implementations sharing the same collider format:

### Collider format

```js
// Cylinder collider
{ type: 'cylinder', x, z, radius, yMin, yMax }

// AABB collider
{ type: 'aabb', minX, maxX, minZ, maxZ, yMin, yMax }
```

### Collider sources

- **`hoops.js`** → `scene.userData.hoopColliders`: poles (cylinder), backboards (AABB)
- **`park.js`** → `scene.userData.parkColliders`: benches (AABB), trash cans (cylinder), bleachers (AABB), fence posts (cylinder)
- **`main.js`** merges them: `playerColliders = hoopColliders.concat(parkColliders)`

### Two collision resolvers

1. **Player collision** (`player.js: resolvePlayerCollisions`): Treats player as a circle of radius 0.22 on the XZ plane, with height from feet to head. 3 iterative passes. Removes inward velocity on contact.

2. **Ball collision** (`ball.js: resolveEnvironmentCollisions`): Treats ball as a circle of `BALL_RADIUS` on XZ plane, with Y range. Uses broadphase culling (cached bounding circle per collider). Bounces with restitution + tangential damping.

Both use the same algorithm structure: Y-range filter → type dispatch → penetration detection → position correction → velocity adjustment.

---

## userData Tag System

The project uses `userData` properties on meshes/groups to tag objects for runtime behavior. This is the primary way the day/night system, panel toggle, and animations find their targets.

| Tag | Purpose | Where set | Where read |
|-----|---------|-----------|------------|
| `isTransparentHelper` | Toggleable fence wire panels | park.js (wire meshes only) | main.js `collectTransparentObjects()` |
| `isNet` | Net sway animation | hoops.js | main.js `collectAnimatedObjects()` → animate loop |
| `netIndex` | Net sway phase offset | hoops.js | main.js animate loop |
| `isLeaves` | Leaf sway animation | park.js tree creation | main.js `collectAnimatedObjects()` → animate loop |
| `leafSway` | Sway speed multiplier | park.js tree creation | main.js animate loop |
| `isWindowLit` | Bright window glow at night | main.js `tagCityWindows()` | main.js `applyDayNightState()` |
| `isWindowDark` | Dim window glow at night | main.js `tagCityWindows()` | main.js `applyDayNightState()` |
| `isLampBulb` | Lamp bulb brightness at night | park.js lamps + main.js tagging | main.js `applyDayNightState()` |
| `lightRole` | Light type for day/night intensity | lighting.js | main.js `applyDayNightState()` |
| `isMoonCrater` | Moon crater opacity | main.js celestial bodies | main.js `applyDayNightState()` |
| `isMoonHalo` | Moon halo opacity | main.js celestial bodies | main.js `applyDayNightState()` |

---

## Key Dimensions and Coordinates

Everything is in meters with Y up. Court center is at world origin (0, 0, 0).

| Element | X range | Z range | Notes |
|---------|---------|---------|-------|
| Court surface | ±7.62 | ±14.325 | NBA regulation |
| Blacktop | ±10.62 | ±18.325 | 3m X pad, 4m Z pad |
| Fence | ±12.12 | ±20.325 | 4.5m X pad, 6m Z pad |
| Gate openings | ±1.4 (centered) | ±20.325 | 2.8m wide |
| Hoops (rim center) | 0 | ±12.45 approx | 1.575m from baseline |
| Benches | ±10.5 | -6, 0, 6 | Inside fence on blacktop edge |
| Lamps | ±13.5 | -14, 0, 14 | Just outside fence |
| Bleachers (side) | ±14.5 | ±7 | Outside fence |
| Sidewalks | ~52m from center | | Ring around park |
| Streets | ~55.5-61.5m | | All 4 sides |
| Buildings | 62m+ | | Procedural grid |
| Player spawn | (0, -0.265, 4) | | Near center court, y offset for feet |
| Ball drop | (0, 2.25, 0) | | Center court, 2.25m up |

---

## Known Issues / Technical Debt

1. **Window tagging is fragile** — relies on matching exact hex color values (`0xffcc66`, `0x334455`). If materials change, tags break.
2. **Full scene traversal during day/night** — `applyDayNightState()` traverses the entire scene tree every frame during transitions. Could be optimized with cached mesh references (like `collectAnimatedObjects` does for nets/leaves).
3. **Sky transition** — abruptly swaps texture at `t=0.5` rather than blending. Could use shader blending.
4. **Lamp light positions hardcoded in lighting.js** — must be manually kept in sync with lamp positions in park.js.
5. **No boundary constraints on player** — can walk beyond the court, outside the fence (through gate openings), and into the city.
6. **No hoop/rim collision for scoring** — ball passes through the rim. Need ring torus collision + detection for "made basket."
7. **Dribble only while grounded** — ball returns to chest hold if player jumps while dribbling. No mid-air dribble or ball release.
8. **No throw/shoot mechanic** — player can only hold and dribble. Cannot release the ball toward the hoop.

---

## Where We Left Off / Next Steps

The basketball can be spawned, picked up, held, and dribbled. The dribble collision release system works — the ball bounces away if you run it into objects. The project is ready for **shooting mechanics**.

### Immediate next steps:
1. **Shooting mechanic** — Aim toward hoop, power gauge or timed release, ball follows arc trajectory
2. **Rim/backboard collision** — Ball bouncing off the rim torus and backboard face, with "swish" (clean through) detection
3. **Scoring detection** — Determine when ball passes through the rim cylinder from above = made basket
4. **Score HUD** — Display points on screen

### Medium-term:
5. **Shot types** — Layups (close range), mid-range jumpers, three-pointers (beyond arc)
6. **Ball release on jump** — Throw/pass the ball while airborne
7. **AI opponents** — Computer-controlled players for pickup games
8. **Game modes** — 1v1, 3v3, H-O-R-S-E, free play
9. **Sound** — Ball bounce, swish, chain net rattle, ambient city sounds
10. **Player customization** — Different jerseys, skin tones, accessories

### Long-term vision:
11. **Court progression** — Start at this gritty court, unlock nicer courts as you win
12. **Career mode** — Street rep system, unlockable gear
13. **Multiplayer** — WebSocket-based online play
14. **Mobile controls** — Touch joystick and buttons

---

## Tips for an AI Agent Picking This Up

1. **Read main.js first** — it's the hub that connects everything. The `buildScene()` function shows the creation order. The `animate()` function shows the update loop.

2. **All textures are procedural** — generated on HTML `<canvas>` elements, then wrapped in `THREE.CanvasTexture`. There are no image files in this project. To change a texture, find the canvas drawing code in the relevant module.

3. **The day/night system touches many files** — any new objects that should respond to day/night need to either:
   - Be a light in the `lightingGroup` with a `userData.lightRole` tag
   - Be a mesh tagged with `userData.isWindowLit`, `isWindowDark`, or `isLampBulb`
   - Be handled explicitly in `applyDayNightState()` in main.js

4. **The panel toggle system** — to make something toggleable with the Panels button, add `mesh.userData.isTransparentHelper = true`. The system caches these at load time in `collectTransparentObjects()`, so dynamic objects won't be caught unless you push them manually.

5. **Test changes quickly** — run `node --check js/filename.js` to catch syntax errors before refreshing the browser. The `package.json` with `"type": "module"` makes this work for ES module syntax.

6. **The player model's joint system** — all limb animation works by rotating `THREE.Group` pivot points. The hierarchy matters: shoulder pivot contains the upper arm AND elbow pivot, so rotating the shoulder swings the entire arm including the forearm. Ball.js uses `getHandWorldPosition()` to read actual hand positions from the joint hierarchy via `localToWorld()`.

7. **Coordinate system** — Three.js default: X = right, Y = up, Z = toward viewer. Court runs along Z axis (long), X axis (wide). Both hoops are at high |Z| values.

8. **The "facing" convention in park.js lamps** — `facing = 1` means the arm extends in +X, `facing = -1` means -X. This determines which way the lantern hangs and where the corresponding SpotLight should point.

9. **No build tools, no dependencies** — just serve the directory and open `index.html`. The CDN import map handles Three.js. If you need to work offline, you'd need to download Three.js locally and update the import map paths.

10. **The user's aesthetic preference** — "eloquent, attractive, and gritty." Not cartoonish, not hyper-realistic. Street basketball culture vibes. Think NYC pickup games, graffiti, worn concrete, chain nets. Any new additions should match this tone.

11. **Collision system** — Both player and ball use the same collider arrays (`playerColliders`). When adding new physical objects, create colliders in the module that builds them and add to `scene.userData.hoopColliders` or `scene.userData.parkColliders`. Main.js merges them during scene build.

12. **Ball state machine** — The ball has three major states: free (physics simulation), held-idle (chest hold, not moving), held-dribbling (moving while holding). Transitions: pickup → held-idle. Start moving → held-dribbling. Stop moving → held-idle. Dribble collision → free. The `carryState` object passed from main.js to player.js drives arm animation poses.

13. **Performance-sensitive patterns** — Delta is smoothed (`smoothedDelta`) to prevent physics jitter. Ball uses adaptive substeps (1-5 based on speed). Broadphase culling uses cached bounding circles on colliders. Pixel ratio is capped at 1.5. Lamp SpotLights don't cast shadows.

14. **Adding a shooting mechanic** — You'll need: (a) a way to aim (probably camera direction projected onto the court), (b) a release trigger (key press), (c) initial velocity calculation for the ball arc, (d) calling `releaseHeldBall()` with the right velocity, (e) rim torus collision detection in ball.js, (f) "through the hoop" detection (ball crossing the rim plane from above with position inside rim radius).
