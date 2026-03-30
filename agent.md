# Hoops Royale Agent Guide

## Purpose
This file is the execution playbook for agents working on Hoops Royale.
It complements:
- `README.md` for quick project overview and run instructions
- `CLAUDE.md` for deep architecture and system-level technical reference

Use this guide to stay aligned on product goals, implementation order, and quality standards.
When docs conflict, treat code as source of truth and then update docs.

---

## North Star
Build a gritty, believable NYC pickup basketball experience that feels:
- responsive to control
- physically coherent
- stylistically consistent (streetball, not cartoon)

Keep additions in line with the current tone:
- worn court, chain nets, procedural city park atmosphere
- competitive team play with readable, skill-based mechanics

---

## Current Stage Snapshot (March 29, 2026)
The game is already in a competitive team-play phase:
- Player movement/combat/interaction: walk, jump, dribble, shoot, dunk, pass, punch, sit
- Team systems: teammates + opponents with AI behaviors
- Scoring: player team and opponent team points + makes/attempts HUD
- Stamina: drains by actions, recovers idle/seated, affects speed
- Day/night transition, start menu, and three camera modes

Key missing gameplay pieces:
1. Three-point detection (all made baskets currently score 2)
2. Teammate physical colliders
3. Teammate shooting AI
4. Ball stealing/reach-in mechanic
5. Audio

Default priority: complete immediate gameplay gaps before medium/long-term polish, unless the user requests otherwise.

---

## Product Evolution Plan

### Immediate Priorities
1. Three-point scoring logic
2. Teammate colliders
3. Teammate offensive AI (shooting decisions + execution)
4. Steal mechanic
5. Core sound pass

### Medium-Term
1. Game modes/rules (1v1, 3v3, possession/win conditions)
2. Shot type expansion (jumpers/layups/runners)
3. Smarter team defense/offense behavior
4. `main.js` decomposition into focused modules

### Long-Term
1. Court progression and career loop
2. Customization systems
3. Multiplayer
4. Mobile controls

---

## Technical Ground Rules
- Runtime stack: Three.js via CDN import map, vanilla ES modules, no bundler.
- No external image assets; textures are procedural canvas generation.
- `main.js` is the orchestrator and state-machine hub.
- Physics and player feel should remain coherent when adding features.

Do not introduce architecture that fights the current zero-build setup.

---

## Edit Map (Where To Work)

### Gameplay Orchestration / State Machines
- `js/main.js`
- Use for: scoring flow, AI decisions, stamina drains/recovery wiring, input routing, HUD state transitions

### Player Motion / Rig / Punch / Stun / Collision
- `js/player.js`
- Use for: animation pose changes, movement physics, stun behavior, punch geometry timing, 3D stamina bar visuals

### Ball Physics / Hold States / Shooting / Passing
- `js/ball.js`
- Use for: projectile math, rim collision behavior, dribble hold math, pass trajectories, pickup/catch/drop transitions

### Environment / Colliders / Seats
- `js/park.js`, `js/hoops.js`
- Use for: adding world obstacles, seat anchors, physical collision surfaces

### Lighting / Day-Night Roles
- `js/lighting.js`
- Use for light-role changes; keep role tags compatible with runtime transitions

### UI / HUD Layout
- `index.html`
- Use for HUD controls and display elements only; keep behavior wiring in `main.js`

---

## Critical Invariants (Do Not Break)

1. Gameplay state priority
- Stun and higher-priority action states must suppress lower-priority actions.
- Shooting, passing, dunking, and seating transitions must remain mutually coherent.

2. Ball ownership integrity
- `heldByPlayer`, `heldByPlayerData`, `_dunkControl`, `_shootingStance`, `_passingStance` must transition cleanly.
- Any new possession mechanic must respect ignore timers and collision release behavior.

3. Score attribution integrity
- Made baskets rely on shooter tracking (`_lastShooterRef`).
- New shot types must preserve correct team attribution.

4. Stamina consistency
- Costs and recovery should remain predictable and balanced across player entities.
- If new stamina costs are added, wire them at action trigger points in `main.js`.

5. Collider consistency
- New physical objects must register colliders in their build modules and be merged into runtime arrays.

6. Visual direction consistency
- Preserve gritty streetball tone and avoid generic UI/style drift.

---

## Working Workflow For Agents

1. Read scope
- Read user request, then confirm relevant sections in `README.md` and `CLAUDE.md`.

2. Find touchpoints
- Identify exact files/functions before editing.

3. Implement narrowly
- Keep changes scoped to the requested feature.
- Avoid unrelated refactors unless explicitly requested.

4. Validate quickly
- Run syntax checks (`node --check ...`) for edited JS modules.
- Do a logic sanity pass for state transitions affected by the change.

5. Update docs if behavior changed
- Update `README.md` for user-facing behavior changes.
- Update `CLAUDE.md` and this `agent.md` for system-level changes.

6. Report clearly
- Summarize what changed, why, and any residual risks or follow-up work.

---

## Regression Traps To Watch
- Breaking shoot/pass/dunk/seat input routing overlap.
- Forgetting to maintain `_lastShooterRef` when adding new scoring paths.
- Adding new colliders without considering ball and player collision differences.
- Desynchronizing lamp positions vs lamp light positions.
- Introducing heavy per-frame allocations in hot loops.
- Expanding `main.js` complexity without keeping state-machine order explicit.

---

## Definition of Done (Per Feature)
Before considering a task complete:
1. Feature works in intended game mode(s).
2. No obvious regressions in existing core loops.
3. Syntax checks pass for touched modules.
4. Docs are updated if behavior, controls, or priorities changed.
5. Remaining known limitations are stated clearly.

---

## Documentation Ownership
If you change behavior or priorities, update:
- `README.md` for player-facing truth
- `CLAUDE.md` for deep technical truth
- `agent.md` for execution truth

Keeping all three aligned is part of the task, not optional cleanup.
