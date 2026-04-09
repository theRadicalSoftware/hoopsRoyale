# Hoops Royale — Project Guide

## What Is This?

Hoops Royale is a **street basketball game** built entirely in **Three.js** (v0.162.0) using vanilla JavaScript ES modules with zero build tools. The game runs in any modern browser from a static file server. No bundler, no npm dependencies at runtime — just an `index.html` that loads Three.js from a CDN via import maps.

The vision: a gritty, NYC street basketball experience. Think Central Park pickup games with chain-link fences, graffiti, cracked asphalt, and city skyline all around. The game starts at a worn-down public court and will eventually progress to better courts as the player advances.

## Current State (as of April 8, 2026)

**What exists:**
- A fully built, explorable 3D environment (court, park, city) with procedural sky system
- A controllable player character with jointed limbs, walk/jump animation, and velocity-based movement
- Basketball with procedural leather texture, physics (gravity, bounce, drag, rolling), and sleep system
- Ball pickup (Z key) with pickup assist (brief magnetism window for smoother grabs)
- Idle chest hold and speed-triggered dribbling with realistic 4-phase animation cycle (push down, floor bounce, rise, top dwell — hand returns faster than ball to wait at top)
- Shooting mechanic with aim stance (X key), adjustable arc angle (W/S), smooth velocity-based player rotation (A/D), and projectile physics with aim assist
- **Shooting arc visualization** — subtle red arc line showing projected trajectory during aim stance, with fade in/out animation
- **Power meter** — vertical oscillating bar (right side of screen) that determines shot strength (0.55x–1.15x) with sweet spot indicator; locks on X press. Shared between shooting and passing stances.
- **Torus rim collision** — ball passes through open center of rim while bouncing off the metal tube; full 3D bounce normals
- **Scoring detection** — Y-plane crossing + radial containment check detects made baskets; tracks points, makes, and attempts. Score attribution via `_lastShooterRef` on the ball — determines whether player team or opponent team gets the points.
- **Three-point scoring** — shot value is determined from shooter release distance to rim (7.24m threshold). Release distance is captured at shot/dunk release and used by `registerMadeBasket()`.
- **Score HUD** — unified glassmorphism scoreboard used in both solo mode (centered) and free play mode (upper-left corner via `sb-corner` CSS class). Shot feedback popup ("Bucket +2" / "OPP Dunk +2") with CSS fade.
- **Neon title text** — "HOOPS ROYALE" rendered in red neon glow style (`#ff3a2f` with layered `text-shadow`). Positioned below the scoreboard in free play (`title-under-sb` class), upper-left in solo mode.
- **Dunk system** — multi-phase animation (approach → slam → hang → release) triggered by pressing X while airborne near rim. Works for both the player and opponents (opponent dunk is AI-triggered).
- **Seating system** — sit on benches/bleachers (C key for player) with smooth enter/exit transitions and seated pose animation. AI players can also sit on benches to recover stamina (walking → entering → seated → exiting phases with smooth transitions and forward step on exit).
- **Punch system** — V key throws alternating hook punches (or free-hand punch while dribbling). Fast 3-phase animation: extend (0.08s) → hold (0.04s) → retract (0.16s). Blends on top of any current arm pose.
- **Punch impact & stun system** — punches that connect with another player's body cause: ball drop (ball pops up and away), 1.8-second stun with flinch animation (arms drop limp, knees buckle, recoil pushback in hit direction), all actions blocked during stun. Works between all player entities (user, teammates, opponents). Cancels active dunks on hit.
- **Block mechanic** — B key hold enables blocking stance. Drains stamina at 7.2/sec, cancels all stances, zeros movement, negates incoming punch hits. Serialized in multiplayer state via `pd.blocking` flag.
- **Stamina / energy system** — all players (user, teammates, opponents) have stamina (0-100). Drains from: running (3/sec), punching (10), shooting (15), passing (6), dunking (18), jumping (7), blocking (7.2/sec). Recovers: idle standing (1.5/sec), sitting on bench (22/sec). Below 20 stamina: movement speed reduced to 62%. Below 5: can't punch/shoot/dunk/block. AI drops the ball and seeks benches when stamina < 22, leaves bench when > 85. Visual: HUD bar for user + under-foot thin yellow stamina arc for all players.
- **Teammate system** — up to 3 AI teammates (red jerseys with canvas-drawn numbers: 5, 11, 32). Full competitive multi-state AI: free-ball pursuit, dribble-drive to correct rim (-Z), shoot, dunk, pass to player/teammates, defensive chase/punch, off-ball positioning, bench recovery.
- **Passing system** — Z key to pass (close auto-pass within 5m, far aimed pass with red line + power meter). Pass stance: chest-level ball hold, A/D to aim, X or Z to fire, C to cancel. Mutual exclusion with shooting stance. Opponents also pass between each other when pressured or after holding too long.
- **Opponent system** — up to 3 AI opponents (blue jerseys `0x2266cc` with numbers: 3, 7, 24). Full AI with multi-state behavior:
  - **Ball pursuit**: chase free balls, pick up within 0.65m
  - **Ball holding**: obstacle-aware dribble-drive with 5-candidate sampling + defender clearance scoring, enter shooting prep when in range (1.8–9.0m), attempt dunks when very close (< 2.8m, 65% chance), pass to open teammates when pressured or swarmed
  - **Shooting**: wind-up animation (0.45s), face rim, shoot with random angle (48-56°) and power (0.88-1.06x), tracks shots attempted/made
  - **Dunking**: AI-triggered multi-phase dunk (same approach → slam → hang → release as player), auto-scores, 18 stamina cost
  - **Chase**: pursue whoever has the ball — player OR teammates — with aggressive approach + random punches when close (< 1.4m)
  - **Positioning**: slot-based off-ball spacing system (5 predefined court slots: wings, corners, top of key) replaces random wander when teammate has ball
  - **Bench recovery**: drop ball and walk to nearest bench when stamina < 22, sit with smooth transitions, leave when > 85
  - Cylinder colliders (radius 0.44) prevent walking through, 1.1m minimum approach distance
- **Cross-team body collisions** — teammates and opponents both have dynamic colliders, synced each frame and post-move, so no team can phase through teammates or opponents.
- **Ball awareness indicators** — floating red beacon directly over the live ball + 2K-style under-foot radar arc/arrow pointing to ball direction in player mode.
- **Out-of-bounds / inbounding system** — NBA-compliant OOB detection with last-touch-rule possession (`_lastTouchRef` on ball), referee ball retrieval, throw-in spot calculation (nearest sideline/baseline with free-throw-line-extended restriction), and forced pass-in mechanic. Four-phase state machine: ref_retrieve → ref_deliver → handoff → passing. All players freeze during inbound. Player uses Z key to pass in when they are the inbounder.
- **Ball last-touch tracking** — `_lastTouchRef` property on ball tracks which player last touched the ball (set on pickup, shoot, pass, catch, body collision, and punch-forced drop). Used by the OOB system to determine possession.
- **NBA-style tip-off positioning** — player and opponent directly across from each other at center court (X=0, Z=±0.9), referee to the side (X=1.5, Z=0). Ball held and tossed at dead center (0, y, 0).
- Collision system for both player and ball against environment objects (benches, trash cans, bleachers, fence posts, hoop poles, backboards)
- Dribble-time collision release (ball bounces off objects while being dribbled and escapes player control)
- Three camera modes: Orbit, Free Roam, and Drop In (player control with camera-relative movement)
- **Mode select screen** — glassmorphism card layout with 3 game mode options (Solo 3v3, Online Multiplayer, Free Play sandbox). Smooth orbit camera animation behind it.
- **Dynamic sky system** — Three.js `Sky` shader with procedural cloud layers (near/far/detail) driven by wind-offset UV scrolling, star dome (procedural starfield, fades with day/night), night tint dome. Sun/moon celestial bodies orbit on `skyElapsed`. Auto-cycle mode: sinusoidal day/night over 210-second period. Sky quality controls: LOW/MED/HIGH toggle affecting cloud layer visibility and opacity multipliers.
- Day/night cycle with smooth transitions, celestial bodies (sun/moon), and illuminating lamp posts
- Chain-link fencing with gate openings, bleachers, benches, trees (deterministic placement via `stableNoise2D`), dual-loop path network, perimeter planting beds, octagonal pavilion shelter, decorative pond with rocks/reeds/lily pads
- NYC-style city surroundings with buildings (district-based height variation, facade articulation, rooftop silhouettes, AABB colliders), streets (with crosswalks), sidewalk planters, cars, street props, material caching, city ground plane (concrete pavement beneath all building districts)
- **Multiplayer system** — full WebSocket-based host-client relay architecture:
  - **Server** (`server/` directory): Node.js HTTP+WS server, room management (create/join/leave/kick), pickup world system, session tracking with 60s reconnection window
  - **Client networking** (`js/net/` directory): singleton WebSocket connection with auto-reconnect and heartbeat, lobby UI (nickname prompt, Quick Match / Create Match / Pickup tabs, waiting room with chat), host-sync (20Hz state broadcast of all entities + ball + scores), guest-sync (snapshot buffer with interpolation + 60Hz input sending)
  - **Protocol**: mirrored `protocol.js` on client and server — lobby messages (HELLO, LIST_ROOMS, CREATE_ROOM, JOIN_ROOM, etc.), pickup world (PICKUP_ENTER_WORLD, PICKUP_POSITION, PICKUP_WORLD_STATE, PICKUP_ZONE_ENTER/LEAVE), game relay (PLAYER_INPUT, GAME_STATE, GAME_ACTION, GAME_OVER), connection (PING/PONG, RECONNECT)
  - Host runs full game simulation, broadcasts serialized state. Guests interpolate received state and send input. Remote human players control entity slots via `getRemoteInput()` in the animate loop.
  - Game mode `'online'` added alongside `'solo'` and `'freeplay'`
- **Immersive pickup world lobby** — replaces text-based pickup queue with a walk-around 3D world:
  - Players enter the shared park environment, walk their character around freely (movement-only, no gameplay state machines)
  - Two glowing **queue zones** at court gate entrances (home = -Z gate at `z=-22`, away = +Z gate at `z=22`, radius 3.0m)
  - Walking into a zone auto-queues for that team; walking out dequeues. Jersey color changes (red=home, blue=away, gray=unqueued)
  - Zone visuals: pulsing ground ring, inner fill circle, 3 slot markers (fill on occupancy), beacon pillar with slow rotation, point light
  - When both teams have 3 players, 5-second countdown starts, then auto-creates a room and launches a game
  - **Remote players** rendered as full player models with nametag sprites (canvas texture), position interpolated at 12x lerp rate with walk animation driven from position delta
  - 10 Hz position broadcast via `pickup-sync.js`, server maintains `worldPlayers` map with 45s AFK timeout cleanup
  - Pickup HUD: glassmorphism panel with home/away slot roster + contextual prompt text
  - `pickupWorldActive` flag gates ALL gameplay state machines — only movement, camera follow, and pickup zone proximity run
- Eight UI buttons in free play: Orbit Cam, Free Roam, Drop In, Ball Drop, Panels toggle, Day/Night toggle, Add Teammate (red), Add Opponent (blue)

**What does NOT exist yet:**
- Full game rules / game modes (1v1, H-O-R-S-E, etc.) — OOB/inbounding is implemented but structured scoring targets/possession flow/check-ball are not
- Sound/audio
- Court progression system
- Player customization
- Jump shots / running shots (shooting only while stationary for player; opponents shoot from standing)
- Ball stealing (opponents can only get the ball via pickup after drop, punch-forced drop, or catching passes)
- Multiplayer gameplay actions beyond movement (remote players can move but shoot/pass/punch/dunk actions from guests are not yet fully wired into the host simulation)

The project is at the **multiplayer + rules refinement stage**. Both teams have competitive AI, OOB/inbounding is implemented, the scoreboard/HUD system is unified across game modes, and multiplayer infrastructure (host-relay, lobby, immersive pickup world) is in place. The next major milestone is **steal mechanic + sound + structured game modes**.

---

## How to Run

### Single-player / offline (any static server)
```bash
python3 -m http.server 8080
# or
npx serve .
# or
npx http-server .
```
Then open `http://localhost:8080`. Solo and Free Play modes work with any static file server.

### Multiplayer (requires the game server)
```bash
cd server
npm install          # first time only — installs the `ws` package
cd ..
node server/server.js
```
This starts a combined HTTP + WebSocket server on port 8080 (configurable via `PORT` env var). The server serves static files from the project root AND handles WebSocket connections for multiplayer. Open `http://localhost:8080` — Online and Pickup modes become available.

The root `package.json` exists solely to set `"type": "module"` so that `node --check` can validate ES module syntax during development. The `server/package.json` has the `ws` dependency.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D Engine | Three.js v0.162.0 via CDN importmap |
| Module System | Native ES modules (`<script type="module">`) |
| Textures | 100% procedural via `<canvas>` + `CanvasTexture` — no image files |
| Controls | `OrbitControls` (orbit/player modes) + custom pointer lock (free roam) |
| Rendering | `WebGLRenderer` with PCFSoftShadowMap, ACESFilmicToneMapping, SRGBColorSpace |
| Sky | Three.js `Sky` shader addon + procedural cloud/star layers |
| Server | Node.js `http` + `ws` WebSocket library (only runtime dependency) |
| Networking | Custom WebSocket protocol, host-authoritative relay, 20Hz state broadcast |
| Build Tools | None — zero client dependencies, no bundler |

**Performance settings:** `powerPreference: 'high-performance'`, pixel ratio capped at 1.5, sun shadow map 2048x2048, lamp post SpotLights have `castShadow: false` to avoid 6 extra shadow-map passes per frame.

---

## File Architecture

```
Hoops-Royale/
├── index.html          # Entry point, UI, HUD, CSS, lobby HTML, pickup HUD, importmap (~2052 lines)
├── package.json        # Just { "type": "module" } for node --check
├── CLAUDE.md           # This file
├── .gitignore
├── js/
│   ├── main.js         # Scene, camera, controls, sky, gameplay state machines, AI, multiplayer integration, pickup world, animation loop (~6448 lines)
│   ├── court.js        # Basketball court surface, lines, paint, graffiti (~672 lines)
│   ├── hoops.js        # Hoop assemblies (poles, backboards, rims, chain nets) (~479 lines)
│   ├── park.js         # Fencing, trees, benches, bleachers, lamps, paths, pavilion, pond, planting beds, seat data (~1759 lines)
│   ├── city.js         # Buildings, streets, sidewalks, cars, street props, crosswalks, planters, city ground plane, building colliders (~1127 lines)
│   ├── lighting.js     # All scene lights (sun, ambient, hemi, fill, rim, lampposts, moon) (~94 lines)
│   ├── player.js       # Player model, joints, animation states, collision, stamina arc (~1233 lines)
│   ├── ball.js         # Basketball creation, physics, dribbling, pickup, shooting, passing, torus rim collision (~1169 lines)
│   └── net/
│       ├── protocol.js     # Message type constants (mirrored on server) (~42 lines)
│       ├── connection.js   # Singleton WebSocket with reconnect + heartbeat (~242 lines)
│       ├── lobby-ui.js     # All lobby DOM interactions: nickname, tabs, waiting room, chat (~608 lines)
│       ├── host-sync.js    # Host: 20Hz state broadcast + remote input reception (~260 lines)
│       ├── guest-sync.js   # Guest: snapshot interpolation + 60Hz input sending (~288 lines)
│       └── pickup-sync.js  # Pickup world: 10Hz position broadcast + zone messaging (~105 lines)
└── server/
    ├── package.json    # { "type": "module", dependencies: { "ws": "..." } }
    ├── protocol.js     # Server-side message type constants + generateSessionId() (~64 lines)
    ├── server.js       # HTTP static file server + WebSocket message router (~369 lines)
    ├── rooms.js        # Room lifecycle: create/join/leave/kick, team assignment, game relay (~354 lines)
    └── pickup.js       # Pickup world: persistent world state, zone queuing, countdown, game launch (~304 lines)
```

### Module Dependency Graph

```
index.html
  └── js/main.js (entry point)
        ├── js/court.js        → createCourt(scene)
        ├── js/hoops.js        → createHoops(scene)         [sets scene.userData.hoopColliders]
        ├── js/park.js         → createPark(scene)           [sets scene.userData.parkColliders]
        ├── js/city.js         → createCity(scene)
        ├── js/lighting.js     → createLighting(scene)
        ├── js/player.js       → createPlayer, updatePlayer, getPunchFistPosition, applyStun, updateStaminaBar, PUNCH_HIT_RADIUS
        ├── js/ball.js         → createBasketball, dropBasketballAtCenter, tryPickUpBasketball, updateBasketball, shootBasketball, passBallToTarget, tryTeammateCatch, forceDropBall
        ├── js/net/lobby-ui.js → initLobbyUI, showNicknamePrompt
        ├── js/net/host-sync.js → startHostSync, stopHostSync, getRemoteInput, getSlotAssignments, getSessionForSlot, broadcastAction, broadcastGameOver, isHostSyncActive
        ├── js/net/guest-sync.js → startGuestSync, stopGuestSync, setLocalInput, getInterpolatedState, getLatestSnapshot, getMyPlayerIndex, isGuestSyncActive
        └── js/net/pickup-sync.js → startPickupSync, stopPickupSync, setPosition, enterZone, leaveZone, sendLeavePickup, isPickupSyncActive, getMyTeam, getMySessionId

server/server.js (Node.js entry point)
        ├── server/protocol.js  → message type constants + generateSessionId
        ├── server/rooms.js     → createRoom, joinRoom, leaveRoom, switchTeam, toggleReady, startGame, endGame, listPublicRooms, findPlayerRoom, relayFromHost, relayInputToHost, broadcastToRoom, handleDisconnect
        └── server/pickup.js    → enterPickupWorld, leavePickupWorld, updatePickupPosition, enterPickupZone, leavePickupZone, handlePickupDisconnect, cleanupAfkPlayers, refreshPickupHeartbeat, isInPickupWorld
```

Every environment module exports a single factory function that creates a `THREE.Group`, populates it, adds it to `scene`, and returns it. `hoops.js` and `park.js` also populate `scene.userData` with collider arrays. `player.js` and `ball.js` export additional update/interaction functions. Networking modules are organized under `js/net/` (client) and `server/` (server) with a shared protocol format.

---

## Detailed File Guide

### `main.js` (~6448 lines) — The Brain

This is the orchestrator. It owns the renderer, scene, camera, controls, all gameplay state machines, teammate/opponent AI, stamina system, sky/celestial system, multiplayer integration, pickup world mode, and the animation loop.

**Key systems:**

1. **Renderer**: WebGL with antialiasing, PCFSoftShadowMap, ACES tonemapping, `powerPreference: 'high-performance'`, pixel ratio capped at 1.5
2. **Camera modes** (variable: `cameraMode`):
   - `'orbit'` — OrbitControls around court center. Default on load.
   - `'freeroam'` — First-person with pointer lock. WASD + mouse look. Custom yaw/pitch system.
   - `'player'` — Third-person. OrbitControls target follows the player. Arrow keys/WASD move player relative to camera facing.
3. **Start menu**: Time-driven orbit camera (`startOrbitElapsed` drives angle computation, not delta-accumulated) with position smoothing via `startOrbitCamPos` lerp. Avoids jitter from `smoothedDelta` convergence.
4. **Day/Night system**: `dayNightTransition` lerps from 0 (day) to 1 (night). `applyDayNightState(t)` updates fog, exposure, sky texture swap, light intensities, window glow, lamp glow, and celestial body opacity.
5. **Delta smoothing**: `smoothedDelta += (clampedDelta - smoothedDelta) * 0.45` prevents jitter from frame time spikes
6. **Loading sequence**: `buildScene()` creates everything in order with progress bar updates
7. **Animation loop**: Updates controls, player, opponents, teammates, punch collisions, basketball, scoring, arc visualization, power meter, pass line, ball locator indicators, dunk, seating, day/night, net sway, and leaf sway every frame
8. **Tag system**: After scene build, `collectTransparentObjects()`, `collectAnimatedObjects()`, and `tagCityWindows()` traverse the scene tree to tag/cache meshes for runtime behavior
9. **Shooting arc visualization**: `createShootingArc()` builds a 60-point `THREE.Line` with `BufferGeometry`. `updateShootingArc(delta)` replicates the exact projectile math from ball.js to show the predicted trajectory as a subtle red arc line. Fades in/out with exponential smoothing.
10. **Power meter**: `updatePowerMeter(delta, active)` oscillates a triangle wave at 1.0 cycle/sec, mapping to 0.55x–1.15x shot power. `lockPowerMeter()` freezes the bar briefly on shot release for feedback. DOM elements styled as a vertical bar with sweet spot zone.
11. **Scoring system**: `refreshRimSensors()` extracts rim positions from `isRim` colliders. `updateScoringSystem(delta)` detects ball crossing the rim Y-plane from above (`prevY > rimY` → `currY <= rimY`, velocity.y < -0.2), then enters a pending state requiring the ball to drop 0.28m below rim while staying centered (< 86% rim radius). Confirmed = `registerMadeBasket()` → updates score, shows feedback popup. **Score attribution**: `basketballData._lastShooterRef` is set when any player shoots or dunks. **Shot value**: `basketballData._lastShotReleaseDistToRim` is captured at release and used by `registerMadeBasket()` to award 2 or 3 points (7.24m threshold).
12. **Pickup assist**: `updatePickupAssist(delta)` provides a brief magnetism window (0.24s) after Z press, gently pulling nearby ball toward the player's hand position for smoother pickups.
13. **Dunk system**: `findDunkRim()` checks proximity + height + facing when airborne with ball. `startDunk(rim)` initiates multi-phase animation: approach → slam → hang → release. `updateDunk(delta)` interpolates player/ball positions through each phase, auto-scores on slam.
14. **Seating system**: `findNearestSeat()` checks proximity to `parkSeats`. `startSittingOnSeat(seat)` / `startStandingFromSeat()` initiate smoothStep-interpolated enter/exit transitions. `updateSeating(delta)` handles phase progression (enter → sit → exit).
15. **Ball Drop**: `dropBall()` function exposed to `window` for the UI button, calls `dropBasketballAtCenter()`
16. **Teammate system**: `addTeammate()` creates parameterized players (red jerseys with canvas-drawn numbers) and attaches cylinder colliders. `updateTeammateAI(tm, delta)` now mirrors opponent-style competitive behavior: free-ball pursuit/pickup, dribble-drive to the correct rim (-Z), shooting windup/release, dunk attempts, pressure-based passing to player/teammates, defensive chase/punch, off-ball positioning, and bench recovery.
17. **Passing system**: Z key triggers pass. Close teammates (< 5m) get instant auto-pass (`'chest'` type). Far teammates enter pass stance: ball held at chest level (`_passingStance` flag), A/D rotation to aim, red line visualization, power meter shared with shooting. X or Z fires aimed pass, C cancels. Mutual exclusion with shooting stance. Opponents also pass between each other via `findOpenOpponentForPass(fromOpp)` when pressured (enemy within 2.8m) or swarmed (2+ defenders), or after holding > 3.5s. Pass lane detection uses perpendicular distance from pass vector to defenders (1.5m lane width, 4x penalty).
18. **Opponent system**: `addOpponent()` creates blue-jersey players with cylinder colliders (radius 0.44) added to `playerColliders`. `updateOpponentAI(opp, delta)` handles comprehensive multi-state AI:
    - **Dunk check** (top priority): if `opp._dunkState` is active, run `updateOppDunk()` and skip normal AI
    - **Stun check**: if stunned, skip AI, just physics/animation
    - **Bench sitting**: if `opp._aiSitState` is active, run AI sitting phases (walking → entering → seated → exiting)
    - **Ball holding**: obstacle-aware dribble-drive with 5-candidate sampling (varies 2–8m from rim, scores by defender clearance), stale timeout 1.8s (0.5s when swarmed). Attempt dunk (< 2.8m, 65% chance), enter shoot prep (1.8–9.0m), pass when pressured (2.8m radius) or swarmed (2+ enemies, 0.12s threshold), max hold 3.5s → pass. Low stamina → drop ball and seek bench.
    - **Ball free**: pursue ball, attempt pickup within 0.65m
    - **Enemy has ball**: chase whoever holds ball (player OR teammate), punch when close (< 1.4m, ~1.2% chance/frame)
    - **Teammate has ball**: slot-based off-ball positioning (5 court slots: wings, corners, top of key, 2% update chance per frame) replaces random offset wander
    - **Default**: wander court with random pauses, constrained to court boundaries (opponents biased toward +Z half, teammates toward -Z half)
    - Each opponent filters its own collider during `updatePlayer` to prevent self-collision
19. **Opponent shooting AI**: `opp._shootPrep` flag enters wind-up phase (0.45s). Opponent faces rim, then shoots with random angle (48-56°) and power (0.88-1.06x). Shot attempts/makes tracked in `oppShotsAttempted`/`oppShotsMade`. Shooting stance uses `carryState.shooting = true` for overhead arm pose.
20. **Opponent dunk system**: `findOppDunkRim(opp, targetRimZ)` finds nearby rim. `startOppDunk(opp, rim)` initiates multi-phase dunk on `opp._dunkState` (same approach → slam → hang → release as player dunk). Opponent gets jump boost (velocityY = 7.5), auto-scores on slam, ball released with downward velocity. Costs 18 stamina. Punching mid-dunk cancels it and drops ball.
21. **Stamina system**: `updateStaminaForPlayer(pd, delta, isSitting)` runs for all players each frame. Drains from actions (running, jumping, punching, shooting, passing, dunking), recovers while idle or sitting. `drainStamina(pd, amount)` / `recoverStamina(pd, amount)` clamp to 0-100. Below `STAMINA_LOW_THRESH` (20): `speedMultiplier` reduces movement speed. Below `STAMINA_EXHAUSTED` (5): can't punch/shoot/dunk. AI seeks bench below 22, leaves above 85.
22. **AI sitting system**: `findNearestSeatForAI(pd)` finds closest unoccupied bench. `updateAISitting(pd, delta)` manages 4 phases: walking (approach bench, threshold 1.6m), entering (smooth lerp to seated position using `SIT_ROOT_OFFSET`, 0.3s), seated (recover stamina, leave when > 85), exiting (stand + step forward in seat facing direction, 0.45s). Empty collider arrays passed during enter/seated/exit to prevent bench AABB from fighting the position lerps.
23. **Stamina visuals**: `createPlayer` now includes an under-foot thin stamina arc (track + yellow fill line). `updateStaminaBar(pd, camera)` in `player.js` is retained for call-site compatibility but now updates this foot arc draw-range/opacity; legacy overhead bar is hidden at runtime. User still has a left-side HUD stamina bar.
24. **Ball locator indicators**: `createBallLocatorIndicators()` builds two cues in `main.js`: a floating red beacon directly above the ball and a 2K-style under-foot radar arc/arrow in player mode that points toward ball direction and uses jersey/team coloring.
25. **Punch collision detection**: `updatePunchCollisions()` runs every frame. For each player with an active punch (blend > 0.5), checks fist world position against all other players' torso regions. On hit: `applyStun()` on target, `forceDropBall()` if holding ball (with puncher passed for last-touch tracking), cancel stances/dunks if applicable. One hit per punch swing via `_punchHitLanded` flag.
26. **Out-of-bounds / inbounding system**: `isBallOutOfBounds(ball)` checks if ball XZ exceeds court boundaries + margin (0.15m). `computeInboundSpot(ballPos)` calculates NBA-compliant throw-in position (nearest sideline/baseline, with free-throw-line-extended restriction at `OOB_FT_EXTENDED_Z = 8.535`). `determineInboundTeam(ball)` uses `_lastTouchRef` for last-touch-rule possession. `triggerOutOfBounds()` freezes the ball, cancels all stances, and starts the 4-phase state machine. `updateInboundState(delta)` manages: `ref_retrieve` (referee walks to ball), `ref_deliver` (referee walks to throw-in spot), `handoff` (inbounder walks to spot, receives ball from ref), `passing` (inbounder must pass in — AI auto-passes, player uses Z key). `executeInboundPass()` fires a chest pass to nearest teammate, then `finalizeInbound()` clears state and sends ref to sideline. All AI stands idle during inbound, punch collisions disabled, OOB detection paused.
27. **Ball last-touch tracking**: `basketballData._lastTouchRef` is set on every ball interaction: pickup, shoot, pass release, catch, body collision bounce, and punch-forced drop (puncher credited). Used exclusively by the OOB system to award possession to the team that did NOT last touch the ball.
28. **AI intelligence improvements**: Obstacle-aware drive target selection (5 candidates scored by defender clearance), swarm detection (`nearbyEnemyCount` ≥ 2 triggers faster pass decisions), pass lane detection (perpendicular distance from pass vector to defenders with 1.5m lane width and 4x penalty), slot-based off-ball positioning (5 predefined court slots replace random offset wander), and court-constrained wander (opponents biased +Z, teammates biased -Z).
29. **Tip-off layout**: `SOLO_TIPOFF_LAYOUT` positions player at (0, y, 0.9) facing -Z and contest opponent at (0, y, -0.9) facing +Z (directly across at center court). Referee at (1.5, y, 0) to the side (not behind benches). Ball held and tossed from dead center (0, y, 0) between jumpers. Referee exits to (-8.8, y, -3.0) on the blacktop after toss.
30. **Block mechanic**: B key hold sets `playerBlocking = true`. Zeros all movement, cancels shooting/passing stances, negates incoming punch hits (`if (target.blocking) continue`). Drains stamina at `STAMINA_BLOCK_DRAIN` (7.2/sec). Blocked when stamina < `STAMINA_EXHAUSTED` (5). Serialized in multiplayer via `pd.blocking` on playerData.
31. **Sky system**: `createSkySystem()` builds Three.js `Sky` shader dome, 3 cloud `PlaneGeometry` layers (near/far/detail) with wind-driven UV scrolling, star dome, and night tint dome. `updateSkyAndCelestial(delta)` advances `skyElapsed`, updates sun/moon orbital positions, cloud drift, and star/night opacity based on `dayNightTransition`. `toggleAutoCycle()` enables sinusoidal auto-transition over `AUTO_CYCLE_PERIOD_SEC` (210s). `cycleSkyQuality()` rotates LOW→MED→HIGH controlling cloud visibility.
32. **Multiplayer integration**: `startOnline()` shows nickname prompt → connects → opens lobby UI. `handleGameStart(msg)` receives `START_GAME` with slot assignments, creates teammates/opponents, starts host-sync or guest-sync based on `msg.hostId`. Host runs full simulation, calls `broadcastAction()` for discrete events. Guest applies state via `applyGuestState(delta)` which deserializes entity positions, ball state, and scores from interpolated snapshots. Remote human players are detected per-slot in the opponent/teammate update loops via `getSessionForSlot()` / `getRemoteInput()`.
33. **Pickup world mode**: `enterPickupWorld()` sets `pickupWorldActive = true`, `gameMode = 'pickup-world'`, positions player at spawn, creates queue zones, starts `pickupSync`. The animate loop detects `pickupWorldActive` and skips all gameplay state machines (shooting, passing, dunking, AI, scoring, stamina drain, OOB, etc.) — only `updatePlayer()` for movement, `updatePickupWorld()` for zone proximity + remote players, and camera follow run. `cleanupPickupWorld()` removes remote players, hides zones, stops sync. `exitPickupWorldToMenu()` returns to mode select.
34. **Pickup queue zones**: `createPickupQueueZones()` builds two `THREE.Group` zones with ground ring, fill circle, 3 slot markers, beacon pillar, and point light. `checkPickupZoneProximity()` runs each frame, detects player XZ distance to zone centers, and calls `pickupEnterZone()` / `pickupLeaveZone()` via pickup-sync. `animatePickupZones(delta)` pulses ring opacity, rotates beacons, and updates slot fills based on `pickupQueueState`. Queue state (`hq`, `aq`, `cd`) received from server world state broadcasts.
35. **Remote pickup players**: `handlePickupWorldState(msg)` creates/updates/removes remote player entities. New players get a `createPlayer()` call with team-colored jersey + `createNametagSprite()` nametag. `updateRemotePickupPlayers(delta)` smoothly interpolates position/angle at 12x lerp rate and drives walk animation from position change speed.

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
- `inboundState` — OOB inbounding state machine object (null when not active); contains `phase`, `team`, `spot`, `inbounder`, `target`, `refWalking`, `passTimer`
- `gameMode` — `'solo'` | `'freeplay'` | `'online'` | `'pickup-world'` | `null`
- `blockHeld` — true while B key is held down
- `pickupWorldActive` — true when in the immersive pickup lobby (gates all gameplay state machines)
- `pickupWorldSessionId` — this client's session ID in the pickup world
- `pickupRemotePlayers` — `Map<sessionId, { playerData, nametag, targetX, targetZ, targetAngle, teamColor }>`
- `pickupZoneHome`, `pickupZoneAway` — `THREE.Group` queue zone visuals
- `pickupQueueState` — `{ hq: [], aq: [], cd: -1 }` — queue rosters and countdown from server
- `pickupMyZone` — `null` | `'home'` | `'away'` — which zone the local player is standing in
- `skyElapsed`, `autoCycleEnabled`, `autoCycleClock`, `skyQualityLevel` — sky/celestial animation state
- `skyDome`, `starDome`, `nightTintDome`, `cloudLayerNear/Far/Detail` — sky mesh references

**Exposed to window (for HTML button onclick):**
- `window.switchCameraMode(mode)`
- `window.toggleTransparentHelpers()`
- `window.toggleDayNight()`
- `window.toggleAutoCycle()`
- `window.cycleSkyQuality()`
- `window.dropBall()`
- `window.startSoloGame()`
- `window.startOnline()`
- `window.startFreePlay()`
- `window.exitPickupWorldToMenu()`
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

**Inbound state machine** (in animate loop, when `inboundState !== null`):
- Triggered by `triggerOutOfBounds()` when ball exits court boundaries
- Ball is frozen in place, all stances cancelled, referee activated
- Phase `ref_retrieve`: referee walks to ball at `OOB_REF_SPEED` (2.2 m/s), picks up within `OOB_REF_PICKUP_DIST` (0.6m)
- Phase `ref_deliver`: referee carries ball to computed throw-in spot
- Phase `handoff`: inbounder walks to spot at `OOB_INBOUNDER_SPEED` (2.8 m/s), ref hands ball off within `OOB_HANDOFF_DIST` (1.2m)
- Phase `passing`: inbounder holds ball at spot, must pass in. AI auto-passes to nearest open teammate. Player presses Z. Timeout at `OOB_PASS_TIMEOUT` (6.0s) → cancelled, ball dropped at spot.
- During inbound: all AI stands idle facing ball, player input blocked (except Z for inbound pass), punch collisions disabled, OOB detection paused
- After pass: `finalizeInbound()` clears state, referee walks to sideline position

**Opponent AI state machine** (per opponent, every frame — priority order):
1. If `_dunkState` active → run `updateOppDunk()`, skip all other AI. If stunned mid-dunk → cancel dunk, force drop ball.
2. If stunned → skip AI, just run physics/animation with no input. Cancel sitting state.
3. If `_aiSitState` active → run `updateAISitting()` phases (walking/entering/seated/exiting). Drop ball before entering.
4. If holding ball → complex sub-state machine:
   - Low stamina (< 22) → force drop ball, seek bench
   - Very close to rim (< 2.8m) + enough stamina → attempt dunk (65% chance) via `startOppDunk()`
   - In shooting range (1.8–9.0m) + not pressured + held > 0.5s → enter `_shootPrep` (face rim, 0.45s wind-up, then shoot)
   - Pressured (enemy < 2.8m) + held > 0.3s, or swarmed (2+ enemies) + held > 0.12s, or held > 3.5s → pass to open teammate via `findOpenOpponentForPass()` (with lane detection + openness weighting)
   - Otherwise → obstacle-aware dribble toward drive target (5-candidate sampling, 2–8m from rim, scored by defender clearance). Target resets when reached (< 1.0m) or stale (1.8s, 0.5s when swarmed).
5. If ball is free → pursue ball, attempt pickup when within 0.65m
6. If enemy holds ball (player OR teammate) → chase aggressively, punch when close (< 1.4m, ~1.2% chance/frame)
7. If teammate opponent has ball → slot-based off-ball positioning (5 court slots: wings, corners, top of key; 2% update chance per frame)
8. Default → wander court (constrained to court bounds, opponents biased +Z half, teammates biased -Z half) with random pauses (0.8–2.0s). Low stamina → seek bench.
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

### `park.js` (~1759 lines) — The Park Environment

Creates everything between the court and the city, including a pavilion and pond.

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

**Trees** (`createTrees`): Deterministic placement via `stableNoise2D` for consistent positioning across sessions. Multiple tree types (deciduous, oak, pine) with procedural textures, palette-based coloring, and leaf sway animation via `userData.isLeaves`. Additional ring of skyline trees at greater distance.

**Pavilion** (`createPavilion`, center at -32, -30):
- Octagonal stone platform (radius 4.8m) with metal edge trim
- 8 stone columns with capitals/bases (each has cylinder collider)
- Peaked conical wooden roof with overhang, underside disc, trim ring, finial
- 8 wooden crossbeams under roof connecting columns to center
- 6 built-in wooden bench seats with metal legs

**Pond** (`createPond`, center at 30, 30):
- Elliptical water surface (4.5m x 3.5m) with transparent blue-green material
- Mud/earth border ring, 22 irregular stones + 3 accent rocks
- 4 reed/cattail clusters with leaf sway animation
- 6 lily pads (some with pink flowers) on water surface
- Two overlapping AABB colliders prevent walking into water

**Other elements:**
- Benches: 6 park benches inside fence at x=±10.5 along the sidelines
- Bleachers: 8 total — 4 along long sides (3-row, 5m wide), 4 behind hoops (2-row, 4m wide)
- Trash cans, drinking fountain, scattered leaves/pebbles
- Walking paths: dual-loop system — inner perimeter loop (22m) + outer ring (38m) with 4 cardinal spokes, 4 diagonal connectors, feature spur paths to pavilion and pond, and 4 cardinal exits to sidewalks
- Perimeter planting beds: `createPerimeterPlantingBeds()` adds landscaping between fence and sidewalk

### `city.js` (~1127 lines) — The NYC Surroundings

Creates the urban environment around the park on all four sides.

**Layout** (from park outward):
1. **Sidewalks** (52-55.5m from center): concrete with expansion joint grid texture, raised curbs
2. **Streets** (55.5-61.5m): asphalt with yellow dashed center lines, white edge lines, corner fillers
3. **City ground plane** (62m+): concrete pavement beneath all building districts with procedural texture (slab grid, wear marks, oil stains)
4. **Building blocks** (62m+): procedurally generated on a grid with random sizes, heights, and colors

**Buildings**:
- Colors from brownstone, concrete, brick, and glass/steel palettes with material caching for performance
- District-based height variation (closer = shorter, zoning feel)
- Features: window grids (emissive rectangles on all faces, ~40% lit), metal cornices, ground floor awnings, facade articulation
- Rooftop details: NYC water towers (wooden tank + cone roof + metal legs + bands), AC units, rooftop silhouettes
- Windows are tagged during `tagCityWindows()` by matching emissive hex color: `0xffcc66`/`0xffcc70` = lit, `0x334455`/`0x26384a` = dark

**Street props**: fire hydrants, street signs (dual perpendicular plates), newspaper boxes, traffic lights with colored bulbs, sidewalk planters, crosswalks

**Building colliders**: Sets `scene.userData.cityColliders` — AABB colliders for every building footprint (with 0.3m padding). Merged into `playerColliders` in main.js. Prevents players from walking through buildings. Broadphase culling keeps these performant since buildings are 62m+ from court center.

**Parked cars**: ~20 cars along all streets. Each has body, cabin (translucent glass), 4 wheels, headlights, taillights. Random colors from 7 options.

### `lighting.js` (~94 lines) — Scene Lighting

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

### `player.js` (~1233 lines) — The Player Character

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
- `_staminaBarGroup`, `_staminaBarFill`, `_staminaBarFillMat` — legacy overhead stamina bar refs (now hidden at runtime)
- `_staminaArcGroup`, `_staminaArcFill`, `_staminaArcFillMat`, `_staminaArcTrackMat`, `_staminaArcPointCount` — under-foot stamina arc refs used by `updateStaminaBar(pd, camera)`

**Controls** (handled in main.js):
- Arrow keys / WASD set `playerInput` flags (or `shootInput` when in shooting/passing stance)
- Space sets `playerInput.jump`
- Z queues ball pickup attempt (with pickup assist magnetism) OR pass to teammate (when holding ball + teammates exist)
- X enters shooting stance (when holding ball, grounded) / fires shot or pass (when in stance) / triggers dunk (when airborne near rim)
- B hold enters blocking stance (drains stamina, cancels stances, negates punches)
- C cancels shooting/passing stance, or toggles seating on nearby bench/bleacher
- V throws a punch (blocked during stances, stun, seated, dunking, blocking)
- Player smoothly rotates to face movement direction (or velocity-based A/D rotation in stance)

### `ball.js` (~1169 lines) — The Basketball

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
    _lastShooterRef: null,   // playerData of last player to shoot/dunk (for score attribution)
    _lastTouchRef: null      // playerData of last player to touch ball (for OOB possession)
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

**Force drop** (`forceDropBall(ball, hitDirX, hitDirZ, puncher = null)`):
- Called when holder is punched — releases ball via `releaseHeldBall`
- Ball pops up (velocity.y = 3.0) and pushes away in hit direction (2.5 m/s)
- Optional `puncher` parameter sets `_lastTouchRef` on the ball for OOB possession tracking

### `index.html` (~2052 lines) — Entry Point & All UI

The single HTML file contains everything: loading screen, mode select overlay, all multiplayer lobby screens, gameplay HUD, and CSS.

**Major UI layers (z-index order):**
1. **Loading screen** — animated progress bar, shown during `buildScene()`
2. **Mode select overlay** (`#mode-select`, z-index 900) — glassmorphism card layout with 3 options:
   - **Solo** (3v3 vs AI with tip-off sequence)
   - **Online** (multiplayer — shows nickname prompt → lobby)
   - **Free Play** (sandbox mode)
   - Title: "HOOPS ROYALE" in orange accent with layered text-shadow
   - Subtitle with animated live-pulse dot
3. **Multiplayer lobby** (`#mp-lobby`) — full multiplayer flow:
   - **Nickname prompt** (`#nickname-prompt`) — input + go button, saved to localStorage
   - **Lobby tabs**: Quick Match (join code + room list), Create Match (name, public toggle, score target), Pickup (enter immersive lobby)
   - **Waiting room** (`#mp-waiting-room`) — room code, home/away slots, switch team, ready/start, chat log
   - **Connection status** — dot indicator + ping display
4. **Gameplay HUD**:
   - **Unified scoreboard** (`#solo-scoreboard`) — glassmorphism, centered (solo) or upper-left corner (`sb-corner` class, free play)
   - **Neon title** — "HOOPS ROYALE" in `#ff3a2f` with layered text-shadow glow
   - **Stamina HUD** — vertical bar with gradient fill (green→yellow→red), percentage label
   - **Shot feedback popup** — "Bucket +2" / "OPP Dunk +2" / "OUT OF BOUNDS" with CSS fade
   - **Power meter** — vertical bar with track, sweet spot zone, animated marker
   - **Countdown overlay** — large number during tip-off / pickup countdown
5. **Pickup world HUD** (`#pickup-world-hud`) — home/away queue slots, contextual prompt text, glassmorphism styling
6. **Controls bar** (`#controls-bar`) — bottom bar showing context-sensitive control hints
7. **UI buttons** — 8 buttons for free play mode (camera modes, ball drop, panels, day/night, add players)

**CSS patterns**: dark theme, `backdrop-filter: blur()` glassmorphism, `hud-hidden` utility class for show/hide transitions, responsive `clamp()` typography. Import map pointing to Three.js CDN v0.162.0.

### Client Networking (`js/net/`)

**`protocol.js`** (~42 lines): Enum-like message type constants exported as named strings. Mirrors `server/protocol.js` exactly. Types cover: lobby (HELLO, LIST_ROOMS, CREATE_ROOM, JOIN_ROOM, etc.), pickup world (PICKUP_ENTER_WORLD, PICKUP_POSITION, PICKUP_WORLD_STATE, PICKUP_ZONE_ENTER/LEAVE), game relay (PLAYER_INPUT, GAME_STATE, GAME_ACTION, GAME_OVER), connection (PING/PONG).

**`connection.js`** (~242 lines): Singleton `Connection` class wrapping native WebSocket. Features:
- Auto-detect server URL from `window.location` (HTTP → WS protocol)
- `connect(nickname, url?)` returns a Promise resolving with `sessionId` on HELLO response
- Reconnection with exponential backoff (1s, 2s, 4s, 8s, 10s)
- Heartbeat every 25s (PING/PONG with latency measurement)
- Message dispatch: `on(type, handler)` / `off(type, handler)` pattern
- Session restoration: sends `sessionId` in HELLO for reconnect

**`lobby-ui.js`** (~608 lines): All DOM interactions for multiplayer screens. Manages:
- Nickname prompt (saved to `localStorage` as `hr_nickname`)
- Tab switching between Quick Match / Create Match / Pickup panels
- Room list polling (`LIST_ROOMS` every 3s)
- Room creation with settings (name, public toggle, score target)
- Waiting room: slot display, team switching, ready toggle, start button (host only), kick, chat
- Pickup tab: join button triggers `JOIN_PICKUP` → `PICKUP_ENTER_WORLD` → calls `onPickupEnter` callback
- `initLobbyUI(gameStartCallback, pickupEnterCallback)` wires everything up from main.js

**`host-sync.js`** (~260 lines): Runs on the host browser during online games.
- `startHostSync(opts)` takes references to playerData, teammates, opponents, basketball, and score/phase getters
- Broadcasts serialized state every 50ms (20Hz) via `GAME_STATE` messages
- Entity serialization: position, rotation, velocity, grounded, jumping, moveBlend, walkCycle, stun, punch state, blocking, stamina
- Ball serialization: position, velocity, held-by (resolved to `'host'`/`'tm0'`/`'opp1'`/etc.), dribble phase, shooting/passing stance, sleeping, active
- Receives remote inputs via `PLAYER_INPUT` messages, stored in `remoteInputs` Map by sessionId
- `getRemoteInput(sessionId)` / `getSessionForSlot(team, slot)` used by main.js to apply remote inputs to entity slots

**`guest-sync.js`** (~288 lines): Runs on guest browsers during online games.
- Receives `GAME_STATE` snapshots into a ring buffer (max 10)
- Interpolation: uses two most recent snapshots with `INTERP_DELAY=3` for jitter absorption
- `getInterpolatedState()` returns interpolated players, ball, scores, gamePhase
- Sends local input at 60Hz via `PLAYER_INPUT` messages
- `getMyPlayerIndex()` maps session's team+slot to the 6-element player array (home 0-2, away 3-5)

**`pickup-sync.js`** (~105 lines): Pickup world networking.
- Sends position at 10Hz (`PICKUP_POSITION` with x, z, angle rounded to 2 decimals)
- `setPosition(x, z, angle)` called by main.js each frame
- `enterZone(team)` / `leaveZone()` send `PICKUP_ZONE_ENTER` / `PICKUP_ZONE_LEAVE`
- Receives `PICKUP_WORLD_STATE` and passes to callback for main.js to handle

### Server (`server/`)

**`server.js`** (~369 lines): Combined HTTP + WebSocket entry point.
- HTTP: serves static files from project root with MIME type mapping, directory traversal protection, `no-cache` headers
- WebSocket: message router dispatching to rooms.js and pickup.js based on message type
- Session tracking: `sessions` Map (sessionId → { ws, nickname }), 60s reconnection window
- Heartbeat: PING/PONG relay, also refreshes pickup AFK timer
- Cleanup timers: stale sessions every 60s, AFK pickup players every 10s

**`rooms.js`** (~354 lines): Room lifecycle management.
- `createRoom(sessionId, nickname, ws, settings)` — generates 4-char room code, creates room with settings (name, public, scoreTarget, mode)
- `joinRoom(sessionId, nickname, ws, code, team?)` — joins existing room, auto-assigns team if not specified
- `leaveRoom(sessionId)` — removes player, deletes room if empty, transfers host if host leaves
- `switchTeam(sessionId)` / `toggleReady(sessionId)` — lobby interactions with room broadcasts
- `startGame(sessionId)` — validates all ready, generates slot assignments ({ sessionId: { team, slot, nickname } })
- `relayFromHost(sessionId, msg)` / `relayInputToHost(sessionId, msg)` — game message relay (host→guests, guest→host)
- `broadcastToRoom(room, msg)` — sends to all room players

**`pickup.js`** (~304 lines): Persistent pickup world state.
- `worldPlayers` Map (sessionId → { ws, nickname, x, z, angle, team, queued, lastHeartbeat })
- `homeQueue[]` / `awayQueue[]` — ordered sessionId arrays for each team zone
- `enterPickupZone(sessionId, team)` — adds to queue (max `TEAM_SIZE=3`), checks game readiness
- When both queues full: 5-second countdown starts. On completion, `launchPickupGame()` creates a room, joins all 6 players, auto-starts the game, removes them from the world
- World state broadcast at 10Hz to all players: serialized positions, queue rosters (nicknames), countdown
- `cleanupAfkPlayers()` removes players inactive for 45s

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
| `STAMINA_BLOCK_DRAIN` | 7.2/sec | Drain while holding block stance |
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

### Out-of-Bounds / Inbound Constants (in `main.js`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `OOB_HALF_WIDTH` | 7.62m | Half court width for OOB detection |
| `OOB_HALF_LENGTH` | 14.325m | Half court length for OOB detection |
| `OOB_FT_EXTENDED_Z` | 8.535m | Free-throw-line-extended Z for baseline throw-in restriction |
| `OOB_MARGIN` | 0.15m | Extra margin beyond court edge before OOB triggers |
| `OOB_SIDELINE_INSET` | 0.5m | Inbounder stands this far inside sideline |
| `OOB_REF_SPEED` | 2.2 m/s | Referee walk speed to retrieve ball |
| `OOB_INBOUNDER_SPEED` | 2.8 m/s | Inbounder walk speed to throw-in spot |
| `OOB_REF_PICKUP_DIST` | 0.6m | Distance for ref to pick up ball |
| `OOB_HANDOFF_DIST` | 1.2m | Distance for ref to hand ball to inbounder |
| `OOB_PASS_TIMEOUT` | 6.0s | Max time for inbounder to pass before cancellation |
| `OOB_SETTLE_DELAY` | 0.4s | Brief delay after OOB before triggering inbound |

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
- **`park.js`** → `scene.userData.parkColliders`: benches (AABB), trash cans (cylinder), bleachers (AABB), fence posts (cylinder), pavilion columns (cylinder), pond (AABB pair)
- **`city.js`** → `scene.userData.cityColliders`: building footprints (AABB, ~100+ colliders with 0.3m padding)
- **`main.js`** merges them: `playerColliders = hoopColliders.concat(parkColliders).concat(cityColliders)`, plus dynamically added opponent cylinder colliders (tagged `_isOpponentCollider`, `_opponentRef`)

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
| Pickup zone (home) | 0 | -22 | 3.0m radius, behind -Z gate |
| Pickup zone (away) | 0 | 22 | 3.0m radius, behind +Z gate |
| Pickup spawn | 5 | -18 | Where player appears when entering pickup world |
| Pavilion | -32 | -30 | Octagonal shelter, radius 4.8m, NW quadrant |
| Pond | 30 | 30 | Elliptical, 4.5m x 3.5m, SE quadrant |
| City ground | 62m+ | 62m+ | Concrete pavement beneath all building districts |

---

## Known Issues / Technical Debt

1. **Window tagging is fragile** — relies on matching exact hex color values (`0xffcc66`/`0xffcc70`, `0x334455`/`0x26384a`). If materials change, tags break.
2. **Lamp light positions hardcoded in lighting.js** — must be manually kept in sync with lamp positions in park.js.
3. **Partial boundary constraints** — players can walk through fence gates and roam the park freely. Building colliders prevent walking through buildings, but no outer world boundary exists.
4. **Dribble only while grounded** — ball returns to chest hold if player jumps while dribbling. No mid-air dribble or ball release.
5. **Shooting only while stationary** — player must be standing still and grounded to enter shooting stance. No jump shots or running shots yet.
6. **main.js is critically large** (~6448 lines) — gameplay systems (scoring, dunking, seating, stamina, power meter, teammate/opponent AI, indicators, passing, OOB/inbounding, sky system, pickup world, multiplayer integration) should be extracted into separate modules. This is the biggest and most pressing technical debt.
7. **Dynamic collider array allocation** — `updateOpponentAI` / `updateTeammateAI` build filtered collider arrays each frame. Could be optimized with reusable scratch arrays.
8. **Duplicate dunk code** — player dunk (`findDunkRim`/`startDunk`/`updateDunk`) and opponent/teammate dunk (`findOppDunkRim`/`startOppDunk`/`startTeammateDunk`/`updateOppDunk`) still have substantial duplication.
9. **No ball stealing mechanic** — defenders still gain possession via pickup, punch-forced drop, or catch only. No reach-in steal/interception input/state yet.
10. **Indicator/stamina overlap tuning** — under-foot radar arc and stamina arc can visually compete at some camera angles; may need ordering/spacing/opacity options.
11. **Multiplayer guest actions incomplete** — remote players can move but gameplay actions (shoot, pass, punch, dunk, pickup) from guest inputs are not yet fully wired into the host simulation beyond basic movement.
12. **Pickup world jersey color recreation** — when a remote player changes team zone, the entire player model is destroyed and recreated with the new jersey color. Should swap material instead.
13. **CLAUDE.md itself is very large** — this documentation file exceeds 1000 lines. As the project grows, consider splitting into multiple docs or auto-generating parts from code comments.
14. **No multiplayer latency compensation** — guest-sync uses simple interpolation with `INTERP_DELAY=3` snapshots. No client-side prediction, rollback, or server reconciliation yet.

---

## Where We Left Off / Next Steps

As of **April 8, 2026**, the project has shipped 8 PRs total. The most recent work (PRs #6–#9) added:
- **Full multiplayer system** (PR #6): WebSocket host-client relay, lobby UI, room management, host-sync (20Hz), guest-sync (interpolation + 60Hz input), slot assignments, pickup queue
- **Dynamic sky system + park/city polish** (PR #7): Three.js Sky shader, 3 cloud layers, star dome, celestial orbit, 210s auto-cycle, quality controls. Deterministic trees, planting beds, crosswalks, planters, facade articulation, rooftop silhouettes, material caching
- **Immersive pickup world lobby** (PR #8): Walk-around 3D park lobby replacing text-based queue. Walk-up queue zones at court gates, remote player rendering with nametags, 10Hz position sync, auto-game-launch, pickup HUD. All gameplay state machines gated behind `pickupWorldActive`
- **Block mechanic**: B key hold for defensive stance (drains stamina, cancels stances, negates punches)
- **Pickup world UX improvements** (PR #9): Split controls (WASD camera, arrows movement), persistent authoritative camera angles, jersey color change on zone queue, closer camera distance, remote player jump animation, glassmorphism pickup prompt, park pavilion, decorative pond, dual-loop path network, city ground plane, building colliders

### Immediate next steps
1. **Ball stealing mechanic** — add reach-in steals/interception logic (input + AI usage + possession transitions).
2. **Sound pass** — bounce, swish, rim/chain, punch impact, ambient park/city loop.
3. **Structured game modes** — possession flow, check-ball, scoring targets, and 1v1/3v3 rulesets (OOB/inbounding is now in place as a foundation).
4. **AI polish** — help defense, smarter shot selection (open vs contested), and transition play.
5. **Multiplayer guest actions** — wire guest shoot/pass/punch/dunk/pickup inputs into host simulation (currently only movement is relayed).

### Medium-term
6. **Shot type expansion** — jumpers/layups/runners and movement-contingent shot choices.
7. **`main.js` refactor** — split AI/scoring/indicator/stamina/OOB/sky/pickup-world systems into focused modules (~6448 lines is critically large).
8. **Net interaction polish** — stronger ball/net reaction cues and richer feedback.
9. **Player customization** — jersey/accessory options and visual identity layer.
10. **Multiplayer polish** — client-side prediction, latency compensation, reconnection handling during games.

### Long-term vision
11. **Court progression + career loop**.
12. **Mobile controls** (touch UI/assist layer).

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

16. **Gameplay state machine priority** — In the animate loop, state machines are checked in priority order: pickup world active (skip all gameplay) > stun > blocking > seating > dunk > shooting stance > passing stance > dunk trigger (airborne) > stance entry (grounded) > pass entry. Each higher-priority state zeros input and blocks lower states. Stun cancels all active stances and blocks all actions. Blocking cancels all stances, zeros movement, and negates punches. The `carryState` object passed to `updatePlayer()` includes flags for all states: `holding`, `shooting`, `dribbling`, `dunking`, `hanging`, `seated`, `seatSettled`, `blocking`. For opponents, the priority is: active dunk (`_dunkState`) > stun > bench sitting (`_aiSitState`) > ball holding (with sub-priorities: low stamina → dunk attempt → shoot prep → pass → dribble toward rim) > ball pursuit > chase enemy with ball > positioning > wander.

17. **Multi-player collision architecture** — Opponents **and teammates** have cylinder colliders dynamically added to `playerColliders`. `updateOpponentColliders()` and `updateTeammateColliders()` sync collider positions each frame, and `updatePlayer()` now syncs each dynamic collider post-move to avoid stale overlap artifacts. Each AI filters out its own collider when calling `updatePlayer` to avoid self-collision. Ball collision in `updateBasketball` checks against `allPlayers` array (user + teammates + opponents) with per-player ignore via `_ignorePlayerRef`/`_ignorePlayerTimer`.

18. **Punch collision architecture** — `updatePunchCollisions()` runs after all players are updated but before basketball update. Uses `getPunchFistPosition(pd)` from player.js which returns the fist's world position (via `elbow.localToWorld()`) only when punch blend > 0.5 and `_punchHitLanded` is false. Checks fist against each other player's torso region (XZ distance < `PUNCH_HIT_RADIUS` 0.55m, Y within 0.5–1.8m above ground). On hit: `applyStun()` sets 1.8s stun timer with recoil direction, `forceDropBall()` pops ball up and away. Also cancels opponent dunk state if mid-dunk.

19. **Stamina system architecture** — Stamina is stored on each playerData object (`pd.stamina`, 0–100). `updateStaminaForPlayer(pd, delta, isSitting)` runs each frame for all players (user, teammates, opponents). Jump drain uses a `_justJumped` flag set in player.js and consumed in main.js. Action drains (punch, shoot, pass, dunk) are called at the point of action in main.js. `speedMultiplier` on playerData is set by the stamina system and read in player.js velocity calculation. The user sees a HUD bar; under-foot stamina arcs are updated by `updateStaminaBar(pd, camera)` in player.js (legacy overhead bar hidden at runtime).

20. **Opponent dunk architecture** — Parallel to the player dunk system but stored per-opponent on `opp._dunkState` instead of the global `dunkState`. `updateOpponentAI` checks for active `_dunkState` at top priority (before stun check). The dunk decision happens in the ball-holding sub-state: when close to rim (< `OPP_DUNK_APPROACH_DIST` 2.8m) with enough stamina, 65% chance to dunk vs shoot. `startOppDunk` gives a jump boost (velocityY = 7.5) and sets up the same multi-phase animation. `updateOppDunk` runs the phases identically to `updateDunk` but operates on the opponent's position/state. `registerMadeBasket('Dunk')` handles score attribution via `_lastShooterRef`.

21. **AI sitting architecture** — Each AI player has an optional `_aiSitState` object with phases: `walking` (approach bench, stop at 1.6m), `entering` (smooth lerp to `seat.y - SIT_ROOT_OFFSET`, face seat direction, 0.3s), `seated` (recover stamina at 22/sec, leave when stamina > 85), `exiting` (stand + step forward 0.8m in seat facing direction, 0.45s). During entering/seated/exiting, empty collider arrays `[]` are passed to `updatePlayer` to prevent the bench AABB from fighting the position lerps. Ball is force-dropped before entering sitting state. Catch detection skips players with `_aiSitState`.

22. **Game mode architecture** — `gameMode` variable controls which UI and gameplay systems are active. `'solo'` = 3v3 AI with tip-off + scoreboard centered. `'freeplay'` = sandbox with corner scoreboard + debug buttons. `'online'` = multiplayer with host-sync or guest-sync active. `'pickup-world'` = immersive lobby with movement-only + zone proximity detection. Mode is set in `startSoloGame()`, `startFreePlay()`, `startOnline()`, `enterPickupWorld()`. The `setGameplayHudVisible()` function branches on gameMode to show/hide the correct UI elements.

23. **Pickup world gating pattern** — The `pickupWorldActive` flag is checked at ~20 points throughout the animate loop to skip gameplay systems. The pattern is: the `cameraMode === 'player'` block runs `updatePlayer()` for movement, then checks `if (pickupWorldActive)` to run `updatePickupWorld()` and skip to camera follow. Later, the entire opponents/teammates/ball/scoring/stamina block is wrapped in `if (pickupWorldActive) { /* skip */ } else { ... }`. Day/night, sky, and ambient animation (net sway, leaf sway) always run regardless of mode. When adding new gameplay systems, they must be inside the `!pickupWorldActive` guard.

24. **Multiplayer host vs guest pattern** — In the animate loop, `isHostSyncActive()` and `isGuestSyncActive()` control which code paths run. The host runs full local simulation and broadcasts state. Guests apply received state via `applyGuestState(delta)` and skip local AI (`skipLocalAI = isGuestSyncActive()`). For each entity slot, the host checks `getSessionForSlot(team, index)` to see if a human is controlling it — if yes, `getRemoteInput(sessionId)` provides their input instead of AI. Adding new gameplay actions for multiplayer requires: (1) adding the input flag to `host-sync.js:handleRemoteInput()`, (2) reading it in the entity update loop, (3) serializing relevant state in `serializeEntity()`/`serializeBall()`, (4) deserializing in `guest-sync.js:interpolateEntity()`.

25. **Server architecture** — The server is minimal by design. `server.js` is a message router, not a game server — it relays messages between clients. `rooms.js` manages room state (players, teams, ready status, slot assignments) but doesn't run game logic. `pickup.js` is the one "smart" server module — it maintains world state, manages queues, and orchestrates game launches. All game simulation runs on the host client. The `ws` package is the only dependency.

26. **Block mechanic architecture** — `blockHeld` tracks the B key state. In the animate loop, the blocking check runs after stun but before the shooting state machine. When blocking: `playerBlocking = true`, all movement zeroed, all stances cancelled, `drainStamina(pd, STAMINA_BLOCK_DRAIN * delta)`. In `updatePunchCollisions()`, `if (target.blocking) continue` skips punch damage. The `_carryState.blocking` flag tells `player.js` to render the blocking pose. Serialized via `pd.blocking` in host-sync.
