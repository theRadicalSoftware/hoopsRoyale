# Hoops Royale — Project Guide

## What Is This?

Hoops Royale is a **street basketball game** built entirely in **Three.js** (v0.162.0) using vanilla JavaScript ES modules with zero build tools. The game runs in any modern browser from a static file server. No bundler, no npm dependencies at runtime — just an `index.html` that loads Three.js from a CDN via import maps.

The vision: a gritty, NYC street basketball experience. Think Central Park pickup games with chain-link fences, graffiti, cracked asphalt, and city skyline all around. The game starts at a worn-down public court and will eventually progress to better courts as the player advances.

## Current State (as of March 29, 2026)

**What exists:**
- A fully built, explorable 3D environment (court, park, city)
- A controllable player character with jointed limbs, walk/jump animation, and velocity-based movement
- Basketball with procedural leather texture, physics (gravity, bounce, drag, rolling), and sleep system
- Ball pickup (Z key) with pickup assist (brief magnetism window for smoother grabs)
- Idle chest hold and speed-triggered dribbling with realistic 4-phase animation cycle (push down, floor bounce, rise, top dwell — hand returns faster than ball to wait at top)
- Shooting mechanic with aim stance (X key), adjustable arc angle (W/S), smooth velocity-based player rotation (A/D), and projectile physics with aim assist
- **Shooting arc visualization** — subtle red arc line showing projected trajectory during aim stance, with fade in/out animation
- **Power meter** — vertical oscillating bar (right side of screen) that determines shot strength (0.55x–1.15x) with sweet spot indicator; locks on X press. Shared between shooting and passing stances.
- **Torus rim collision** — ball passes through open center of rim while bouncing off the metal tube; full 3D bounce normals
- **Scoring detection** — Y-plane crossing + radial containment check detects made baskets; tracks points, makes, and attempts. Score attribution via `_lastShooterRef` on the ball — determines whether player team or opponent team gets the points.
- **Score HUD** — top-left player score display (points + makes/attempts); top-right opponent score display (blue-tinted glassmorphism); shot feedback popup ("Bucket +2" / "OPP Dunk +2") with CSS fade
- **Dunk system** — multi-phase animation (approach → slam → hang → release) triggered by pressing X while airborne near rim. Works for both the player and opponents (opponent dunk is AI-triggered).
- **Seating system** — sit on benches/bleachers (C key for player) with smooth enter/exit transitions and seated pose animation. AI players can also sit on benches to recover stamina (walking → entering → seated → exiting phases with smooth transitions and forward step on exit).
- **Punch system** — V key throws alternating hook punches (or free-hand punch while dribbling). Fast 3-phase animation: extend (0.08s) → hold (0.04s) → retract (0.16s). Blends on top of any current arm pose.
- **Punch impact & stun system** — punches that connect with another player's body cause: ball drop (ball pops up and away), 1.8-second stun with flinch animation (arms drop limp, knees buckle, recoil pushback in hit direction), all actions blocked during stun. Works between all player entities (user, teammates, opponents). Cancels active dunks on hit.
- **Stamina / energy system** — all players (user, teammates, opponents) have stamina (0-100). Drains from: running (3/sec), punching (10), shooting (15), passing (6), dunking (18), jumping (7). Recovers: idle standing (1.5/sec), sitting on bench (22/sec). Below 20 stamina: movement speed reduced to 62%. Below 5: can't punch/shoot/dunk. AI opponents drop the ball and seek benches when stamina < 22, leave bench when > 85. Visual: 3D overhead stamina bars on AI players (billboard-aligned to camera using inverse parent quaternion), HUD bar for user (left side, below score).
- **Teammate system** — up to 3 AI teammates (red jerseys with canvas-drawn numbers: 5, 11, 32). Wander the court, walk toward player when holding ball, auto-pass back when close or after hold timer. Evade opponents when holding ball (with court boundary awareness: ±11m X, ±19m Z). Seek benches when stamina is low.
- **Passing system** — Z key to pass (close auto-pass within 5m, far aimed pass with red line + power meter). Pass stance: chest-level ball hold, A/D to aim, X or Z to fire, C to cancel. Mutual exclusion with shooting stance. Opponents also pass between each other when pressured or after holding too long.
- **Opponent system** — up to 3 AI opponents (blue jerseys `0x2266cc` with numbers: 3, 7, 24). Full AI with multi-state behavior:
  - **Ball pursuit**: chase free balls, pick up within 0.65m
  - **Ball holding**: dribble toward player's rim, enter shooting prep when in range (1.8–9.0m), attempt dunks when very close (< 2.8m, 65% chance), pass to open teammates when pressured or held too long
  - **Shooting**: wind-up animation (0.45s), face rim, shoot with random angle (48-56°) and power (0.88-1.06x), tracks shots attempted/made
  - **Dunking**: AI-triggered multi-phase dunk (same approach → slam → hang → release as player), auto-scores, 18 stamina cost
  - **Chase**: pursue whoever has the ball — player OR teammates — with aggressive approach + random punches when close (< 1.4m)
  - **Positioning**: when a teammate opponent has the ball, other opponents spread out near the target rim
  - **Bench recovery**: drop ball and walk to nearest bench when stamina < 22, sit with smooth transitions, leave when > 85
  - Cylinder colliders (radius 0.44) prevent walking through, 1.1m minimum approach distance
- Collision system for both player and ball against environment objects (benches, trash cans, bleachers, fence posts, hoop poles, backboards)
- Dribble-time collision release (ball bounces off objects while being dribbled and escapes player control)
- Three camera modes: Orbit, Free Roam, and Drop In (player control with camera-relative movement)
- **Start menu** with smooth time-driven orbit camera animation and "Click To Begin" overlay
- Day/night cycle with smooth transitions, celestial bodies (sun/moon), and illuminating lamp posts
- Chain-link fencing with gate openings, bleachers, benches, trees, paths
- NYC-style city surroundings with buildings, streets, cars, street props
- Eight UI buttons: Orbit Cam, Free Roam, Drop In, Ball Drop, Panels toggle, Day/Night toggle, Add Teammate (red), Add Opponent (blue)

**What does NOT exist yet:**
- Game rules, game modes (1v1, H-O-R-S-E, etc.)
- Sound/audio
- Multiplayer
- Court progression system
- Player customization
- Jump shots / running shots (shooting only while stationary for player; opponents shoot from standing)
- Three-point detection (all baskets score 2 points currently)
- Teammate shooting AI (teammates only pass back to player, don't shoot or score)
- Ball stealing (opponents can only get the ball via pickup after drop, punch-forced drop, or catching passes)

The project is at the **competitive gameplay stage**. Both teams can score — opponents have full shooting and dunking AI with team passing. A stamina system adds resource management (bench recovery). The next major milestone is **game modes, three-point detection, and sound**.

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
├── index.html          # Entry point, UI buttons, HUD elements, CSS, importmap (~591 lines)
├── package.json        # Just { "type": "module" } for node --check
├── CLAUDE.md           # This file
├── .gitignore
└── js/
    ├── main.js         # Scene setup, camera, controls, day/night, gameplay state machines, AI, stamina, animation loop (~3270 lines)
    ├── court.js        # Basketball court surface, lines, paint, graffiti (~672 lines)
    ├── hoops.js        # Hoop assemblies (poles, backboards, rims, chain nets) (~479 lines)
    ├── park.js         # Fencing, trees, benches, bleachers, lamps, paths, seat data (~1195 lines)
    ├── city.js         # Buildings, streets, sidewalks, cars, street props (~707 lines)
    ├── lighting.js     # All scene lights (sun, ambient, hemi, fill, rim, lampposts, moon) (~86 lines)
    ├── player.js       # Player model, joints, walk/jump/idle/carry/shoot/dunk/sit/punch/stun animation, collision, stamina bar (~1129 lines)
    └── ball.js         # Basketball creation, physics, dribbling, pickup, shooting, passing, torus rim collision (~1157 lines)
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
        ├── js/player.js     → createPlayer(scene, options), updatePlayer(pd, delta, input, movementBasis, colliders, carryState), getPunchFistPosition(pd), applyStun(pd, dirX, dirZ), updateStaminaBar(pd, camera), PUNCH_HIT_RADIUS
        └── js/ball.js       → createBasketball(scene), dropBasketballAtCenter(ball), tryPickUpBasketball(ball, playerData), updateBasketball(ball, delta, colliders, playerData, allPlayers), shootBasketball(ball, playerData, angleDeg, powerMult), passBallToTarget(ball, from, targetPos, type), tryTeammateCatch(ball, tmData), forceDropBall(ball, hitDirX, hitDirZ)
```

Every environment module exports a single factory function that creates a `THREE.Group`, populates it, adds it to `scene`, and returns it. `hoops.js` and `park.js` also populate `scene.userData` with collider arrays. `player.js` and `ball.js` export additional update/interaction functions.

---

## Detailed File Guide

### `main.js` (~3270 lines) — The Brain

This is the orchestrator. It owns the renderer, scene, camera, controls, all gameplay state machines, teammate/opponent AI, stamina system, and the animation loop.

**Key systems:**

1. **Renderer**: WebGL with antialiasing, PCFSoftShadowMap, ACES tonemapping, `powerPreference: 'high-performance'`, pixel ratio capped at 1.5
2. **Camera modes** (variable: `cameraMode`):
   - `'orbit'` — OrbitControls around court center. Default on load.
   - `'freeroam'` — First-person with pointer lock. WASD + mouse look. Custom yaw/pitch system.
   - `'player'` — Third-person. OrbitControls target follows the player. Arrow keys/WASD move player relative to camera facing.
3. **Start menu**: Time-driven orbit camera (`startOrbitElapsed` drives angle computation, not delta-accumulated) with position smoothing via `startOrbitCamPos` lerp. Avoids jitter from `smoothedDelta` convergence.
4. **Day/Night system**: `dayNightTransition` lerps from 0 (day) to 1 (night). `applyDayNightState(t)` updates fog, exposure, sky texture swap, light intensities, window glow, lamp glow, and celestial body opacity.
5. **Delta smoothing**: `smoothedDelta += (clampedDelta - smoothedDelta) * 0.18` prevents jitter from frame time spikes
6. **Loading sequence**: `buildScene()` creates everything in order with progress bar updates
7. **Animation loop**: Updates controls, player, opponents, teammates, punch collisions, basketball, scoring, arc visualization, power meter, pass line, dunk, seating, day/night, net sway, and leaf sway every frame
8. **Tag system**: After scene build, `collectTransparentObjects()`, `collectAnimatedObjects()`, and `tagCityWindows()` traverse the scene tree to tag/cache meshes for runtime behavior
9. **Shooting arc visualization**: `createShootingArc()` builds a 60-point `THREE.Line` with `BufferGeometry`. `updateShootingArc(delta)` replicates the exact projectile math from ball.js to show the predicted trajectory as a subtle red arc line. Fades in/out with exponential smoothing.
10. **Power meter**: `updatePowerMeter(delta, active)` oscillates a triangle wave at 1.0 cycle/sec, mapping to 0.55x–1.15x shot power. `lockPowerMeter()` freezes the bar briefly on shot release for feedback. DOM elements styled as a vertical bar with sweet spot zone.
11. **Scoring system**: `refreshRimSensors()` extracts rim positions from `isRim` colliders. `updateScoringSystem(delta)` detects ball crossing the rim Y-plane from above (`prevY > rimY` → `currY <= rimY`, velocity.y < -0.2), then enters a pending state requiring the ball to drop 0.28m below rim while staying centered (< 86% rim radius). Confirmed = `registerMadeBasket()` → updates score, shows feedback popup. **Score attribution**: `basketballData._lastShooterRef` is set when any player shoots or dunks. `registerMadeBasket()` checks this ref — if the shooter is an opponent (not player, not teammate), points go to `oppTotalScore`; otherwise to `totalScore`.
12. **Pickup assist**: `updatePickupAssist(delta)` provides a brief magnetism window (0.24s) after Z press, gently pulling nearby ball toward the player's hand position for smoother pickups.
13. **Dunk system**: `findDunkRim()` checks proximity + height + facing when airborne with ball. `startDunk(rim)` initiates multi-phase animation: approach → slam → hang → release. `updateDunk(delta)` interpolates player/ball positions through each phase, auto-scores on slam.
14. **Seating system**: `findNearestSeat()` checks proximity to `parkSeats`. `startSittingOnSeat(seat)` / `startStandingFromSeat()` initiate smoothStep-interpolated enter/exit transitions. `updateSeating(delta)` handles phase progression (enter → sit → exit).
15. **Ball Drop**: `dropBall()` function exposed to `window` for the UI button, calls `dropBasketballAtCenter()`
16. **Teammate system**: `addTeammate()` creates parameterized players (red jerseys with canvas-drawn numbers). `updateTeammateAI(tm, delta)` handles: wander with random pauses, walk toward player when holding ball (dribbling), auto-pass back when close or after hold timer, evade opponents when holding ball (with boundary awareness ±11m X, ±19m Z). Stunned teammates skip AI. Teammates seek benches when stamina is low.
17. **Passing system**: Z key triggers pass. Close teammates (< 5m) get instant auto-pass (`'chest'` type). Far teammates enter pass stance: ball held at chest level (`_passingStance` flag), A/D rotation to aim, red line visualization, power meter shared with shooting. X or Z fires aimed pass, C cancels. Mutual exclusion with shooting stance. Opponents also pass between each other via `findOpenOpponentForPass(fromOpp)` when pressured (enemy within 2.5m) or after holding > 4s.
18. **Opponent system**: `addOpponent()` creates blue-jersey players with cylinder colliders (radius 0.44) added to `playerColliders`. `updateOpponentAI(opp, delta)` handles comprehensive multi-state AI:
    - **Dunk check** (top priority): if `opp._dunkState` is active, run `updateOppDunk()` and skip normal AI
    - **Stun check**: if stunned, skip AI, just physics/animation
    - **Bench sitting**: if `opp._aiSitState` is active, run AI sitting phases (walking → entering → seated → exiting)
    - **Ball holding**: dribble toward rim, attempt dunk (< 2.8m, 65% chance), enter shoot prep (1.8–9.0m), pass when pressured, low stamina → drop ball and seek bench
    - **Ball free**: pursue ball, attempt pickup within 0.65m
    - **Enemy has ball**: chase whoever holds ball (player OR teammate), punch when close (< 1.4m, ~1.2% chance/frame)
    - **Teammate has ball**: position near target rim for passes
    - **Default**: wander court with random pauses
    - Each opponent filters its own collider during `updatePlayer` to prevent self-collision
19. **Opponent shooting AI**: `opp._shootPrep` flag enters wind-up phase (0.45s). Opponent faces rim, then shoots with random angle (48-56°) and power (0.88-1.06x). Shot attempts/makes tracked in `oppShotsAttempted`/`oppShotsMade`. Shooting stance uses `carryState.shooting = true` for overhead arm pose.
20. **Opponent dunk system**: `findOppDunkRim(opp, targetRimZ)` finds nearby rim. `startOppDunk(opp, rim)` initiates multi-phase dunk on `opp._dunkState` (same approach → slam → hang → release as player dunk). Opponent gets jump boost (velocityY = 7.5), auto-scores on slam, ball released with downward velocity. Costs 18 stamina. Punching mid-dunk cancels it and drops ball.
21. **Stamina system**: `updateStaminaForPlayer(pd, delta, isSitting)` runs for all players each frame. Drains from actions (running, jumping, punching, shooting, passing, dunking), recovers while idle or sitting. `drainStamina(pd, amount)` / `recoverStamina(pd, amount)` clamp to 0-100. Below `STAMINA_LOW_THRESH` (20): `speedMultiplier` reduces movement speed. Below `STAMINA_EXHAUSTED` (5): can't punch/shoot/dunk. AI seeks bench below 22, leaves above 85.
22. **AI sitting system**: `findNearestSeatForAI(pd)` finds closest unoccupied bench. `updateAISitting(pd, delta)` manages 4 phases: walking (approach bench, threshold 1.6m), entering (smooth lerp to seated position using `SIT_ROOT_OFFSET`, 0.3s), seated (recover stamina, leave when > 85), exiting (stand + step forward in seat facing direction, 0.45s). Empty collider arrays passed during enter/seated/exit to prevent bench AABB from fighting the position lerps.
23. **3D stamina bars**: Created in `player.js` via `createPlayer` — a PlaneGeometry background + fill mesh positioned at `PLAYER_HEIGHT + 0.18` above player root. `updateStaminaBar(pd, camera)` in player.js handles billboard alignment (inverse parent quaternion × camera quaternion), fill scale/color (green → yellow → red), and fade in/out based on stamina changes. Shown on AI players; user has a HUD bar instead.
24. **Punch collision detection**: `updatePunchCollisions()` runs every frame. For each player with an active punch (blend > 0.5), checks fist world position against all other players' torso regions. On hit: `applyStun()` on target, `forceDropBall()` if holding ball, cancel stances/dunks if applicable. One hit per punch swing via `_punchHitLanded` flag.

**Important global state:**
- `lightingGroup` — reference to the lighting group, traversed during day/night updates
- `playerData` — the player state object from `createPlayer()`
- `basketballData` — the ball state object from `createBasketball()`
- `transparentObjects[]` — cached list of all meshes with `userData.isTransparentHelper = true`
- `animatedNets[]`, `animatedLeaves[]` — cached for per-frame animation
- `hoopColliders[]`, `parkColliders[]`, `playerColliders[]` — combined collider arrays from hoops.js and park.js
- `rimSensors[]` — extracted rim positions from `isRim` colliders (for scoring detection)
- `parkSeats[]` — seat position data from park.js (for seating system)
- `pickupQueued` — set true on Z keypress, consumed next frame
- `pickupAssistTimer` — countdown for pickup magnetism window
- `shootQueued`, `cancelShootQueued` — set true on X/C keypress in appropriate states
- `shootingStance` — true when player is in aim/shoot mode; gates input routing
- `shootAngle` — current launch angle in degrees (38-70, default 52)
- `shootTurnVelocity` — current rotational velocity in stance (smooth ramp up/down)
- `shootInput` — `{ aimUp, aimDown, turnLeft, turnRight }` flags for stance controls
- `shotPowerMultiplier` — current power value from meter oscillation
- `powerMeterPhase`, `powerMeterNorm`, `powerMeterOpacity`, `powerMeterLockTimer` — power meter animation state
- `totalScore`, `shotsMade`, `shotsAttempted` — player team scoring state
- `oppTotalScore`, `oppShotsMade`, `oppShotsAttempted` — opponent team scoring state
- `scoreCooldown`, `pendingMake`, `scorePrevBallValid`, `scorePrevBallPos` — scoring detection state
- `dunkState` — multi-phase player dunk animation state (null when not dunking); opponents use `opp._dunkState` instead
- `sitState` — seating animation state (null when not seated)
- `sitToggleQueued` — set true on C keypress, consumed next frame
- `sunMesh`, `moonMesh`, `moonGlowMesh` — celestial body references
- `playerMoveBasis` — `{ forward, right }` vectors computed from camera direction each frame for camera-relative controls
- `startOrbitElapsed`, `startOrbitCamPos` — time-driven start menu orbit animation state
- `shootingArcLine`, `arcOpacity` — shooting arc visualization state
- `teammates[]` — array of teammate playerData objects (max 3)
- `opponents[]` — array of opponent playerData objects (max 3), each with `_collider` reference
- `passingStance` — true when player is in aimed pass mode; mutual exclusion with `shootingStance`
- `passTargetTeammate` — reference to the teammate being passed to
- `passQueued` — set true on Z keypress when holding ball with teammates present

**Exposed to window (for HTML button onclick):**
- `window.switchCameraMode(mode)`
- `window.toggleTransparentHelpers()`
- `window.toggleDayNight()`
- `window.dropBall()`
- `window.startGame()`
- `window.addTeammate()`
- `window.addOpponent()`

**Shooting state machine** (in animate loop, player mode only):
- When `shootQueued` and player holds ball + grounded → enter `shootingStance`, reset power meter
- In stance: W/S adjust `shootAngle` (38-70°), A/D rotate via velocity-based turning (`shootTurnVelocity` with exponential accel/decel)
- X fires: locks power meter, calls `shootBasketball(ball, playerData, shootAngle, releasePower)` then exits stance
- C cancels: exits stance, returns to normal play, resets power meter
- `playerInput` is zeroed every frame while in stance so the player stands still
- `carryState.shooting` flag is set so player.js applies the shooting animation pose
- `ball._shootingStance` flag is set so ball.js holds the ball above the player's head

**Dunk state machine** (in animate loop, player mode only):
- When `shootQueued` and player holds ball + airborne → `findDunkRim()` checks proximity/height/facing
- If rim found: `startDunk(rim)` enters multi-phase animation (approach → slam → hang → release)
- Auto-scores on slam phase, ball released with downward velocity after hang
- During dunk: all input zeroed, player velocity/position controlled by dunk interpolation

**Seating state machine** (in animate loop, player mode only):
- C key toggles `sitToggleQueued`
- If standing near seat → `startSittingOnSeat(seat)` with smoothStep enter transition
- If sitting → `startStandingFromSeat()` with smoothStep exit transition
- During sit: all input zeroed, player position locked to seat

**Passing state machine** (in animate loop, player mode only):
- Z key with ball + teammates → `passQueued = true`
- Close teammate (< 5m): instant `executePass(target, 'chest')` — auto-aimed chest pass
- Far teammate (> 5m): enter `passingStance`, set `ball._passingStance` for chest-level hold, show pass line
- In stance: A/D rotate to aim, X or Z fires aimed pass with power meter value, C cancels
- Pass stance and shooting stance are mutually exclusive — cannot enter one while in the other
- Pass fire check runs BEFORE pass entry check to prevent `passQueued` from being cleared prematurely

**Opponent AI state machine** (per opponent, every frame — priority order):
1. If `_dunkState` active → run `updateOppDunk()`, skip all other AI. If stunned mid-dunk → cancel dunk, force drop ball.
2. If stunned → skip AI, just run physics/animation with no input. Cancel sitting state.
3. If `_aiSitState` active → run `updateAISitting()` phases (walking/entering/seated/exiting). Drop ball before entering.
4. If holding ball → complex sub-state machine:
   - Low stamina (< 22) → force drop ball, seek bench
   - Very close to rim (< 2.8m) + enough stamina → attempt dunk (65% chance) via `startOppDunk()`
   - In shooting range (1.8–9.0m) + not pressured + held > 0.5s → enter `_shootPrep` (face rim, 0.45s wind-up, then shoot)
   - Pressured (enemy < 2.5m) + held > 0.3s, or held > 4.0s → pass to open teammate via `findOpenOpponentForPass()`
   - Otherwise → dribble toward drive target (aimed at shooting range). Target resets when reached (< 1.0m).
5. If ball is free → pursue ball, attempt pickup when within 0.65m
6. If enemy holds ball (player OR teammate) → chase aggressively, punch when close (< 1.4m, ~1.2% chance/frame)
7. If teammate opponent has ball → position near target rim for receiving passes
8. Default → wander court with random pauses (0.8–2.0s). Low stamina → seek bench.
- Each opponent filters its own collider from `playerColliders` during `updatePlayer` to avoid self-collision

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

### `hoops.js` (~479 lines) — The Hoop Assemblies

Two identical hoop assemblies, one at each end (sides -1 and +1).

**Each assembly contains:**
1. **Pole structure**: Vertical pole (tapered cylinder), horizontal arm to backboard, diagonal brace, base plate with bolts, safety padding on lower pole
2. **Backboard**: Glass material (`MeshPhysicalMaterial` with `transmission: 0.4`), metal frame on all 4 edges, shooter's square outlines on both faces. NOT tagged as `isTransparentHelper` — always visible.
3. **Rim & bracket**: Orange torus at regulation height (3.048m). Connected to backboard via a neck bar + mounting bracket + two angled support arms. 12 hook points around rim for net attachment.
4. **Chain net**: Diamond-pattern mesh. Built from a node grid (12 columns x 11 rows) where odd rows are offset by half a column. Nodes connected by cylinder links aligned with quaternions. Tapers from rim radius to 65% at bottom. Has a bottom ring connecting the last row.

**Colliders**: Sets `scene.userData.hoopColliders` — an array of cylinder and AABB colliders for the poles and backboard structures. Rim colliders are tagged with `isRim: true` and `rimRingRadius` for torus collision in ball.js. Net volume colliders are tagged with `isNetVolume: true` and skipped during ball collision so the ball passes through. These are combined with park colliders in main.js to form `playerColliders`.

**Positioning math** (critical, was a major bug source):
```
backboardFaceZ = baselineZ - side * BACKBOARD_FROM_BASELINE
backboardCenterZ = backboardFaceZ + side * (BACKBOARD_THICKNESS / 2)
rimCenterZ = backboardFaceZ - side * (RIM_FROM_BACKBOARD + RIM_RADIUS)
```
The `side` variable (-1 or +1) ensures everything faces the correct direction on both ends.

### `park.js` (~1195 lines) — The Park Environment

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

**Seat data**: Sets `scene.userData.parkSeats` — an array of `{ x, y, z, facing }` objects for bench and bleacher seat positions. Used by the seating system in main.js. Both `createBenches()` and `createBleachers()` populate this array.

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

### `player.js` (~1129 lines) — The Player Character

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
- `speedMultiplier` — multiplied into target velocity (default 1.0, reduced to 0.62 when stamina is low). Set by `updateStaminaForPlayer()` in main.js.
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
6. **Shooting stance** (ball held, `carryState.shooting = true`): Both arms raised overhead (shoulders -2.6/-2.4 X), slight elbow bend, legs in stable base with knees at 0.22 bend. Smooth lerp transition (rate 12).
7. **Dunking** (`carryState.dunking = true`): Arms raised overhead for slam. Separate `hanging` state for post-slam hang on rim.
8. **Seated** (`carryState.seated = true`): Legs forward with knee bend, arms relaxed at sides. `seatSettled` flag for final seated pose vs transition.
9. **Punching** (overlay): Hook punch blended on top of any current arm pose. 3 phases: extend (smoothstep in, 0.08s), hold (0.04s), retract (ease-in quad, 0.16s). Free hand punches while dribbling; alternating hands when not carrying.
10. **Flinch/Stun** (overlay, `stunIntensity > 0`): Arms drop outward and go limp (shoulders +0.3 X, ±0.5 Z), knees buckle (0.35 bend), hips tilt back. Ramps up in 0.1s (smoothstep), decays over remaining stun duration. Overrides all other poses while active.

**Parameterized `createPlayer(scene, options)`:**
- `jerseyColor` — hex color for jersey material (default `0xcc2222` red)
- `skinColor` — hex color for skin (default `0x8d5524`)
- `shoeColor` — hex color for shoes (default `0x1a1a1a`)
- `spawnPosition` — `{ x, y, z }` starting position
- `facingAngle` — initial rotation in radians (default `Math.PI`)
- `name` — identifier string for the player group
- `visible` — whether player starts visible
- `isTeammate` — boolean flag stored on playerData
- `jerseyNumber` — number drawn on jersey front/back via canvas texture

**Stamina-related properties on playerData** (set by `createPlayer`, managed by main.js):
- `stamina` — current stamina value (0–100, starts at 100)
- `maxStamina` — maximum stamina (100)
- `speedMultiplier` — movement speed multiplier (1.0 normal, 0.62 when low stamina)
- `_justJumped` — flag set in player.js when jump fires, consumed by `updateStaminaForPlayer()` in main.js to drain stamina
- `_staminaBarGroup`, `_staminaBarFill`, `_staminaBarFillMat` — 3D overhead stamina bar mesh references (for AI players)

**Controls** (handled in main.js):
- Arrow keys / WASD set `playerInput` flags (or `shootInput` when in shooting/passing stance)
- Space sets `playerInput.jump`
- Z queues ball pickup attempt (with pickup assist magnetism) OR pass to teammate (when holding ball + teammates exist)
- X enters shooting stance (when holding ball, grounded) / fires shot or pass (when in stance) / triggers dunk (when airborne near rim)
- C cancels shooting/passing stance, or toggles seating on nearby bench/bleacher
- V throws a punch (blocked during stances, stun, seated, dunking)
- Player smoothly rotates to face movement direction (or velocity-based A/D rotation in stance)

### `ball.js` (~1157 lines) — The Basketball

The most complex gameplay module. Handles ball creation, physics simulation, environment/player collision (including torus rim collision), held ball state machine (idle hold + dribbling + shooting/passing stance), dribble-time collision release, shooting with projectile physics, passing between players, teammate catch detection, and force-drop on punch.

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
    heldByPlayerData: null,  // reference to which playerData holds the ball
    dribblingByPlayer: false,// dribbling (subset of held)
    dribblePhase: 0,         // 0 to 2π, drives dribble animation
    sleeping: false,         // physics paused (ball at rest)
    grounded: false,         // touching floor
    velocity: Vector3,
    prevPosition: Vector3,   // for rolling rotation
    idleFrames: 0,           // counter toward sleep
    _ignorePlayerRef: null,  // player to ignore collision with (for passes)
    _ignorePlayerTimer: 0,   // countdown for ignore window
    _shootingStance: false,  // held overhead for shooting
    _passingStance: false,   // held at chest for passing
    _lastShooterRef: null    // playerData of last player to shoot/dunk (for score attribution)
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
| `RIM_COLLISION_TUBE` | 0.03 | Effective rim tube radius for torus collision |
| `RIM_BOUNCE` | 0.55 | Restitution for rim hits |
| `PICKUP_RADIUS` | 0.72 | Max XZ distance for ball pickup |
| `PICKUP_RADIUS_ASSIST` | 1.02 | Extended pickup radius during assist window |
| `PICKUP_VERTICAL_ASSIST` | 1.55 | Vertical tolerance during assist window |

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
- **Colliders tagged `isNetVolume`**: skipped entirely for ball collision (ball passes through net)
- **Colliders tagged `isRim`**: uses torus collision via `resolveRimTorusCollision()` — finds closest point on rim ring's major circle, checks distance from ball center to tube surface, pushes out along 3D normal + bounces with `bounceAgainstNormal3D()` (full 3D velocity reflection, not just XZ)
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

**Shooting stance hold** (`_shootingStance` flag):
- When `ball._shootingStance = true`, `updateHeldByPlayer` positions the ball above the player's head at `SHOT_RELEASE_HEIGHT` (2.15m above ground), slightly forward
- Smooth lerp follow like idle hold, ball stays locked to overhead position as player rotates

**Shooting** (`shootBasketball(ball, playerData, launchAngleDeg, powerMultiplier = 1.0)`):
- `getTargetRimPosition()` computes both rim positions and picks the one the player is most facing (dot product)
- Rim positions calculated from `HALF_COURT_LENGTH`, `BACKBOARD_FROM_BASELINE`, `RIM_FROM_BACKBOARD`, `RIM_RADIUS_HOOP` — same math as hoops.js
- Projectile motion formula: `speed = sqrt(g * d^2 / (2 * cos^2(a) * (d*tan(a) - dy)))` where `d` = horizontal distance, `dy` = height difference, `a` = launch angle
- Speed capped at 18 m/s to prevent absurd close-range launches, then **multiplied by `powerMultiplier`** (from power meter, range 0.55x–1.15x)
- **Aim assist**: final aim direction is 70% player facing + 30% actual rim direction, so the player has control but shots are gently corrected toward the hoop
- Ball positioned at release point (above head), then `releaseHeldBall(ball, pd, true)` with velocity already set
- Visual backspin: `_backspin` object on ball with axis (perpendicular to facing) and speed (8 rad/s), applied in `applyRollingRotation`, decays at 0.5% per frame, cleared on floor contact

**Shooting physics constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| `SHOT_RELEASE_HEIGHT` | 2.15 | Release point above ground (meters) |
| `SHOT_MIN_ANGLE` | 38 | Flattest allowed shot (degrees) |
| `SHOT_MAX_ANGLE` | 70 | Highest arc (degrees) |
| `SHOT_DEFAULT_ANGLE` | 52 | Starting angle when entering stance |
| `SHOT_ANGLE_SPEED` | 28 | Degrees per second when adjusting with W/S |
| `SHOT_BACKSPIN` | 8.0 | Visual backspin speed (radians/sec) |
| `SHOT_POWER_MIN` | 0.55 | Minimum power multiplier (power meter low) |
| `SHOT_POWER_MAX` | 1.15 | Maximum power multiplier (power meter high) |

**Passing** (`passBallToTarget(ball, fromPlayerData, targetPosition, passType)`):
- `'chest'` type: auto-aimed at target position, speed 6-14 m/s (scales with distance), slight loft
- `'aimed'` type: follows player's facing direction, speed 7-16 m/s (scales with power multiplier), minimal loft
- Sets `_ignorePlayerRef = fromPlayerData` with 0.45s ignore timer to prevent self-catch
- Ball released from chest level with `releaseHeldBall(ball, pd, true)`

**Teammate catch** (`tryTeammateCatch(ball, teammateData)`):
- Catches within 0.65m radius at chest height (0.3–2.0m above ground)
- Skips if `_ignorePlayerRef === teammateData` (prevents self-catch after throwing)

**Force drop** (`forceDropBall(ball, hitDirX, hitDirZ)`):
- Called when holder is punched — releases ball via `releaseHeldBall`
- Ball pops up (velocity.y = 3.0) and pushes away in hit direction (2.5 m/s)

### Stamina Constants (in `main.js`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `STAMINA_MAX` | 100 | Maximum stamina |
| `STAMINA_PUNCH_COST` | 10 | Drain per punch |
| `STAMINA_SHOOT_COST` | 15 | Drain per shot |
| `STAMINA_PASS_COST` | 6 | Drain per pass |
| `STAMINA_DUNK_COST` | 18 | Drain per dunk |
| `STAMINA_JUMP_COST` | 7 | Drain per jump |
| `STAMINA_RUN_DRAIN` | 3.0/sec | Drain while moving (speed > 0.3) |
| `STAMINA_IDLE_REGEN` | 1.5/sec | Recovery while standing still |
| `STAMINA_SIT_REGEN` | 22.0/sec | Recovery while seated on bench |
| `STAMINA_LOW_THRESH` | 20 | Below this: speed penalty applied |
| `STAMINA_EXHAUSTED` | 5 | Below this: can't punch/shoot/dunk |
| `STAMINA_AI_SEEK_BENCH` | 22 | AI drops ball and seeks bench below this |
| `STAMINA_AI_LEAVE_BENCH` | 85 | AI stands up from bench above this |
| `STAMINA_SPEED_PENALTY` | 0.62 | Speed multiplier when stamina depleted |

### Opponent Shooting / Dunk Constants (in `main.js`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `OPP_SHOOT_RANGE_MIN` | 1.8m | Minimum distance from rim to shoot |
| `OPP_SHOOT_RANGE_MAX` | 9.0m | Maximum distance from rim to shoot |
| `OPP_SHOOT_WINDUP` | 0.45s | Time in shoot prep before firing |
| `OPP_TARGET_RIM_Z` | 12.73 | Z position of the rim opponents attack |
| `OPP_DUNK_APPROACH_DIST` | 2.8m | Max distance from rim to attempt dunk |
| `OPP_DUNK_CHANCE` | 0.65 | Probability of dunk vs close-range shot |
| `OPP_PICKUP_RADIUS` | 0.65m | Distance to attempt ball pickup |
| `OPPONENT_COLLIDER_RADIUS` | 0.44m | Cylinder collider radius for opponents |

### `index.html` (~591 lines) — Entry Point

- Loading screen with animated progress bar
- **Start menu overlay**: glassmorphism panel with "Click To Begin" button, title, and eyebrow text
- HUD overlay with game title
- **Score HUD** (top-left): Player score value + makes/attempts detail, with `hud-hidden` CSS class toggle
- **Opponent Score HUD** (top-right): Opponent score value + makes/attempts, blue-tinted glassmorphism style
- **Stamina HUD** (left side, below score): Vertical bar with gradient fill (green → yellow → red), percentage label. Glassmorphism style.
- **Shot feedback popup** (center): "Bucket +2" / "OPP Dunk +2" / "Total N" text with CSS opacity/transform transitions
- **Power meter** (right side): Vertical bar with track, sweet spot zone, animated marker, and value label. Styled with gradient background, border radius, and backdrop blur
- 8 UI buttons: Orbit Cam, Free Roam, Drop In, Ball Drop, Panels toggle, Day/Night toggle, Add Teammate (red), Add Opponent (blue)
- Controls hint text at bottom (updates per camera mode, mentions Z pass, V punch)
- CSS: dark theme, minimal UI, backdrop blur on buttons, `hud-hidden` utility class for fade in/out
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
- **`main.js`** merges them: `playerColliders = hoopColliders.concat(parkColliders)`, plus dynamically added opponent cylinder colliders (tagged `_isOpponentCollider`, `_opponentRef`)

### Two collision resolvers

1. **Player collision** (`player.js: resolvePlayerCollisions`): Treats player as a circle of radius 0.22 on the XZ plane, with height from feet to head. 3 iterative passes. Removes inward velocity on contact.

2. **Ball collision** (`ball.js: resolveEnvironmentCollisions`): Treats ball as a sphere of `BALL_RADIUS`. Uses broadphase culling (cached bounding circle per collider). Bounces with restitution + tangential damping. Special handling for tagged colliders:
   - `isNetVolume` colliders: skipped entirely (ball passes through net)
   - `isRim` colliders: torus collision via `resolveRimTorusCollision()` with 3D bounce normals (allows ball through rim center)

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
| `isRim` | Rim collider (torus collision) | hoops.js `addHoopColliders()` | ball.js `resolveEnvironmentCollisions()` |
| `rimRingRadius` | Rim ring radius for torus math | hoops.js `addHoopColliders()` | ball.js `resolveRimTorusCollision()` |
| `isNetVolume` | Net volume (skip ball collision) | hoops.js `addHoopColliders()` | ball.js `resolveEnvironmentCollisions()` |

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
2. **Sky transition** — day/night sky still swaps at `t=0.5` rather than true texture blending. Could use shader-based blend.
3. **Lamp light positions hardcoded in lighting.js** — must be manually kept in sync with lamp positions in park.js.
4. **No boundary constraints on player** — can walk beyond the court, outside the fence (through gate openings), and into the city.
5. **Dribble only while grounded** — ball returns to chest hold if player jumps while dribbling. No mid-air dribble or ball release.
6. **Shooting only while stationary** — player must be standing still and grounded to enter shooting stance. No jump shots or running shots yet.
7. **All baskets score 2 points** — no three-point detection based on shot distance. Need to check shooter distance relative to the three-point line at release time.
8. **main.js is very large** (~3270 lines) — gameplay systems (scoring, dunking, seating, stamina, power meter, teammate/opponent AI, passing, opponent dunking) could be extracted into separate modules. This is the most pressing technical debt.
9. **No per-player colliders for teammates** — only opponents have cylinder colliders. Teammates can be walked through.
10. **Dynamic collider array allocation** — `updateOpponentAI` creates a filtered collider array each frame per opponent. Could be optimized with a shared pre-filtered array.
11. **Duplicate dunk code** — player dunk (`findDunkRim`/`startDunk`/`updateDunk`) and opponent dunk (`findOppDunkRim`/`startOppDunk`/`updateOppDunk`) are largely duplicated. Could be refactored into a shared generic dunk system parameterized by player data reference.
12. **No ball stealing mechanic** — opponents can only get the ball via pickup after it's dropped, punch-forced drop, or catching passes. No reach-in steal or interception.

---

## Where We Left Off / Next Steps

As of March 29, 2026, the game has **competitive team gameplay** working. Both the player's team and the opponent team can score. Opponents have full AI: dribble toward the rim, shoot from range, dunk up close, pass between each other when pressured, and recover stamina on benches. All players have a stamina system that drains from actions and recovers by resting. Score is tracked separately for each team with dedicated HUD displays.

**What was done in the most recent session (March 29, 2026):**
- Extended stun duration from 1.0s to 1.8s
- Fixed opponent ball pickup (reduced pickup radius from 0.9 to 0.65 to match ball.js's PICKUP_RADIUS)
- Built complete stamina system (drain from all actions, recover idle/seated, speed penalty when low)
- Added 3D stamina bars above AI players with billboard alignment
- Added user stamina HUD bar (left side, glassmorphism style)
- Built AI bench-sitting system (walking → entering → seated → exiting with smooth transitions)
- Fixed bench exit to step forward instead of floating straight up
- Made opponents drop ball and seek benches when stamina is low
- Increased opponent collider radius (0.28 → 0.44) and spacing thresholds to prevent clipping
- Made opponents chase whoever has ball (player OR teammates), not just player
- Made teammates evade opponents when holding ball (with boundary awareness)
- Built opponent passing system (`findOpenOpponentForPass`)
- Built opponent shooting AI (drive to rim, wind-up, shoot with random variation)
- Built opponent dunk system (AI-triggered multi-phase dunk near rim, 65% chance vs close-range shot)
- Added opponent score tracking with dedicated HUD (top-right, blue-tinted)
- Added `_lastShooterRef` tracking for score attribution
- Fixed opponent freezing near rim (lowered min shoot range 3.5 → 1.8, added stale drive target reset)
- Added jump stamina drain (7 per jump)

### Immediate next steps:
1. **Three-point detection** — Check shooter distance from basket at shot time; award 3 points for shots beyond the arc (7.24m from rim center). This is the biggest missing scoring feature.
2. **Teammate colliders** — Add cylinder colliders to teammates so nobody can walk through each other
3. **Teammate shooting AI** — Teammates currently only pass back. They should also drive and shoot when they have the ball.
4. **Ball stealing** — Opponents should be able to steal the ball from a dribbling player/teammate (reach-in steal mechanic)
5. **Sound** — Ball bounce, swish, chain net rattle, punch impact, ambient city sounds

### Medium-term:
6. **Game modes** — 1v1, 3v3, H-O-R-S-E, free play with rules (scoring target, possession changes, etc.)
7. **Shot types** — Jump shots, layups (close range), mid-range jumpers
8. **Smarter AI** — Defensive positioning, pick-and-roll, teammates run plays
9. **Refactor main.js** — At ~3270 lines, this is urgent. Extract: stamina system, AI (opponent + teammate), scoring, dunking, seating, power meter into separate modules.
10. **Net physics** — Chain net reacts to ball passing through (currently static sway only)
11. **Player customization** — Different jerseys, skin tones, accessories

### Long-term vision:
12. **Court progression** — Start at this gritty court, unlock nicer courts as you win
13. **Career mode** — Street rep system, unlockable gear
14. **Multiplayer** — WebSocket-based online play
15. **Mobile controls** — Touch joystick and buttons

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

12. **Ball state machine** — The ball has seven major states: free (physics simulation), held-idle (chest hold, not moving), held-dribbling (moving while holding), held-shooting (above head in aiming stance, `_shootingStance`), held-passing (at chest in pass stance, `_passingStance`), held-dunk (`_dunkControl` flag, position driven by dunk system), and force-dropped (released with velocity from a punch). `heldByPlayerData` tracks which specific player holds the ball (can be user, teammate, or opponent). Transitions: pickup → held-idle. Start moving → held-dribbling. Stop moving → held-idle. Dribble collision → free. Press X (grounded) → held-shooting. Press X (in stance) → free (shot released). Press Z (with teammates) → held-passing or immediate chest pass. Punch target → force-dropped (ball pops up and away). Press C → held-idle (cancel). The `carryState` object passed from main.js to player.js drives arm animation poses (includes `shooting`, `dunking`, `hanging`, `seated` flags — note: `passingStance` does NOT set `carryState.shooting`, so chest hold pose is used).

13. **Performance-sensitive patterns** — Delta is smoothed (`smoothedDelta`) to prevent physics jitter. Ball uses adaptive substeps (1-5 based on speed). Broadphase culling uses cached bounding circles on colliders. Pixel ratio is capped at 1.5. Lamp SpotLights don't cast shadows.

14. **Shooting mechanic architecture** — The shooting system spans all three gameplay files. `main.js` owns the state machine (`shootingStance`, `shootAngle`, `shootInput`, power meter), gates input routing between normal play and aim mode, and constructs `carryState.shooting`. `player.js` animates the shooting pose when `carryState.shooting` is true. `ball.js` holds the ball overhead when `_shootingStance` is set, and `shootBasketball()` calculates projectile velocity using the standard formula with aim assist blending and power multiplier.

15. **Scoring detection architecture** — `refreshRimSensors()` extracts rim positions from `isRim` colliders at scene build. `updateScoringSystem(delta)` runs every frame and uses a two-phase detection: (1) entry detection when ball crosses rim Y-plane from above with sufficient downward velocity and is within the entry radius, (2) confirmation when ball drops 0.28m below rim while staying centered. This prevents false positives from balls bouncing on the rim.

16. **Gameplay state machine priority** — In the animate loop, state machines are checked in priority order: stun > seating > dunk > shooting stance > passing stance > dunk trigger (airborne) > stance entry (grounded) > pass entry. Each higher-priority state zeros input and blocks lower states. Stun cancels all active stances and blocks all actions. The `carryState` object passed to `updatePlayer()` includes flags for all states: `holding`, `shooting`, `dribbling`, `dunking`, `hanging`, `seated`, `seatSettled`. For opponents, the priority is: active dunk (`_dunkState`) > stun > bench sitting (`_aiSitState`) > ball holding (with sub-priorities: low stamina → dunk attempt → shoot prep → pass → dribble toward rim) > ball pursuit > chase enemy with ball > positioning > wander.

17. **Multi-player collision architecture** — Opponents have cylinder colliders dynamically added to `playerColliders`. `updateOpponentColliders()` syncs collider positions each frame. Each opponent filters out its own collider when calling `updatePlayer` to avoid self-collision. Ball collision in `updateBasketball` checks against `allPlayers` array (user + teammates + opponents) with per-player ignore via `_ignorePlayerRef`/`_ignorePlayerTimer`.

18. **Punch collision architecture** — `updatePunchCollisions()` runs after all players are updated but before basketball update. Uses `getPunchFistPosition(pd)` from player.js which returns the fist's world position (via `elbow.localToWorld()`) only when punch blend > 0.5 and `_punchHitLanded` is false. Checks fist against each other player's torso region (XZ distance < `PUNCH_HIT_RADIUS` 0.55m, Y within 0.5–1.8m above ground). On hit: `applyStun()` sets 1.8s stun timer with recoil direction, `forceDropBall()` pops ball up and away. Also cancels opponent dunk state if mid-dunk.

19. **Stamina system architecture** — Stamina is stored on each playerData object (`pd.stamina`, 0–100). `updateStaminaForPlayer(pd, delta, isSitting)` runs each frame for all players (user, teammates, opponents). Jump drain uses a `_justJumped` flag set in player.js and consumed in main.js. Action drains (punch, shoot, pass, dunk) are called at the point of action in main.js. `speedMultiplier` on playerData is set by the stamina system and read in player.js velocity calculation. The user sees a HUD bar; AI players get 3D billboard bars via `updateStaminaBar(pd, camera)` in player.js.

20. **Opponent dunk architecture** — Parallel to the player dunk system but stored per-opponent on `opp._dunkState` instead of the global `dunkState`. `updateOpponentAI` checks for active `_dunkState` at top priority (before stun check). The dunk decision happens in the ball-holding sub-state: when close to rim (< `OPP_DUNK_APPROACH_DIST` 2.8m) with enough stamina, 65% chance to dunk vs shoot. `startOppDunk` gives a jump boost (velocityY = 7.5) and sets up the same multi-phase animation. `updateOppDunk` runs the phases identically to `updateDunk` but operates on the opponent's position/state. `registerMadeBasket('Dunk')` handles score attribution via `_lastShooterRef`.

21. **AI sitting architecture** — Each AI player has an optional `_aiSitState` object with phases: `walking` (approach bench, stop at 1.6m), `entering` (smooth lerp to `seat.y - SIT_ROOT_OFFSET`, face seat direction, 0.3s), `seated` (recover stamina at 22/sec, leave when stamina > 85), `exiting` (stand + step forward 0.8m in seat facing direction, 0.45s). During entering/seated/exiting, empty collider arrays `[]` are passed to `updatePlayer` to prevent the bench AABB from fighting the position lerps. Ball is force-dropped before entering sitting state. Catch detection skips players with `_aiSitState`.
