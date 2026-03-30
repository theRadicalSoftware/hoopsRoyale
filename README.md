# Hoops Royale

A street basketball game built in Three.js. No frameworks, no bundlers, no image assets. Everything is procedural and runs directly in the browser with native ES modules.

---

**The court is cracked. The nets are chain. The city never sleeps.**

Hoops Royale drops you into a gritty NYC pickup court surrounded by fences, graffiti-tagged asphalt, benches, bleachers, and a living skyline that shifts from day to night.

---

## Current Gameplay State

- Full NBA-scale court + park + city environment
- Player movement and animation: walk, jump, idle, dribble, shoot, dunk, punch, sit
- Ball physics: pickup, dribble cycle, bounce/roll/sleep, torus rim collision, projectile shooting, passing
- Team gameplay:
  - Up to 3 teammates (red) and 3 opponents (blue)
  - Opponent AI: pursue, pass, shoot, dunk, chase, punch, bench recovery
  - Teammate AI: wander, evade pressure, pass support
- Scoring system:
  - Player team and opponent team scores
  - Makes/attempts tracking for both sides
  - Shot feedback popup
- Stamina system for all players:
  - Action drains and idle/bench recovery
  - User stamina HUD + 3D stamina bars for AI
- Day/night transition with lamp/window lighting response
- Three camera modes: Orbit, Free Roam, Drop In

## Not Implemented Yet

- Three-point scoring detection (all made baskets currently award 2)
- Teammate colliders (teammates can still be walked through)
- Teammate shooting AI
- Reach-in/steal mechanic
- Audio (bounce, swish, impact, ambience)
- Game mode/rules layer (1v1, 3v3, possession rules, win conditions)

---

## Run It

```bash
# Any static file server:
python3 -m http.server 8080
# or
npx serve .
# or
npx http-server .
```

Open `http://localhost:8080`.

No build step, no runtime dependencies, no install required.

## Controls

| Mode | Input | Action |
|------|-------|--------|
| **Orbit** | Click + drag | Look around |
| | Scroll | Zoom |
| | Right-click + drag | Pan |
| **Free Roam** | Click | Capture mouse |
| | WASD / Arrows | Move |
| | Mouse | Look |
| | Space / Shift | Up / Down |
| | Escape | Release mouse |
| **Drop In** | WASD / Arrows | Walk (camera-relative) |
| | Space | Jump |
| | Z | Pick up ball / pass (if holding ball with teammates present) |
| | X | Enter shooting stance / shoot (in stance) / dunk (airborne near rim) |
| | W / S (in stance) | Adjust shot angle |
| | A / D (in stance) | Turn/aim |
| | C | Sit/stand (normal play) or cancel active shoot/pass stance |
| | V | Punch |
| | Click + drag | Orbit camera around player |
| | Scroll | Zoom |

Top-right buttons: camera mode switch, ball drop, add teammate, add opponent, panel toggle, day/night toggle.

---

## Tech

Three.js v0.162.0 via CDN import map. Vanilla ES modules. Every texture is generated at runtime with canvas; there are no image assets in this repo.

```
js/
├── main.js       — Scene setup, gameplay state machines, AI, stamina, scoring, animation loop
├── court.js      — Court surface, paint, lines, graffiti
├── hoops.js      — Hoops, backboards, rims, chain nets, hoop colliders
├── park.js       — Fence, lamps, trees, benches, bleachers, park colliders, seat anchors
├── city.js       — Streets, buildings, props
├── lighting.js   — Day/night light rig and lamp lights
├── player.js     — Player rig, movement, animation, collisions, punch/stun, stamina bar
└── ball.js       — Ball physics, dribble/hold/shoot/pass, rim collision, catches, forced drops
```

See [CLAUDE.md](CLAUDE.md) for the detailed technical guide and roadmap.

---

## Roadmap

**Now:** Competitive pickup gameplay is live (teams, scoring, stamina, opponent AI, passing, dunking).

**Next:** Three-point scoring, teammate colliders, teammate shooting AI, steal mechanic, sound.

**Later:** Mode/rules systems, smarter team tactics, player progression/customization, multiplayer.

---

## License

All rights reserved.
