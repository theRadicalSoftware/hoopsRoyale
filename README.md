# Hoops Royale

A street basketball game built in Three.js. No frameworks, no bundlers, no image assets — just raw JavaScript and procedural everything.

---

**The court is cracked. The nets are chain. The city never sleeps.**

Hoops Royale drops you into a gritty NYC pickup court surrounded by park fences, graffiti-tagged asphalt, and a skyline that shifts from golden hour to midnight. Every texture — from the worn leather on the ball to the pebbled concrete under your feet — is drawn in code at runtime.

---

## What's Here

- A full-scale NBA regulation court with faded paint, scuff marks, and hand-tagged street art
- Chain-link fencing with gate openings, Bishop's Crook lamp posts, bleachers, benches, trees
- A procedurally generated NYC block — brownstones, water towers, parked cars, fire hydrants, traffic lights
- A jointed player character with walk, jump, idle, and ball-carry animations
- A basketball with leather texture, realistic bounce physics, rolling, and a sleep system
- Ball pickup, chest hold, and speed-triggered dribbling with a phased animation cycle
- Dribble collision release — run the ball into a bench and it bounces away
- Day/night cycle with sun, moon, stars, lamp post illumination, and glowing city windows
- Three camera modes: orbit, free roam, and third-person drop-in

## What's Not Here (Yet)

Scoring. Opponents. Sound. The game is at the shooting stage — you can walk, jump, pick up the ball, dribble, enter a shooting stance, aim, and launch the ball toward the hoop with realistic arc physics. The next milestone is detecting when the ball goes through the rim and tracking score.

---

## Run It

```bash
# Any static file server. Pick one:
python3 -m http.server 8080
npx serve .
npx http-server .
```

Open `http://localhost:8080`. That's it — no install, no build step, no dependencies.

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
| | Z | Pick up ball |
| | X | Enter shooting stance (hold ball) / Shoot (in stance) |
| | W / S (in stance) | Adjust shot arc angle up / down |
| | A / D (in stance) | Rotate player left / right |
| | C | Cancel shooting stance |
| | Click + drag | Orbit camera around player |
| | Scroll | Zoom |

Use the buttons in the top-right corner to switch modes, drop a ball, toggle fence panels, or flip between day and night.

---

## Tech

Three.js v0.162.0 loaded via CDN import map. Vanilla ES modules. Zero build tools. Every texture is procedurally generated on HTML canvas elements at runtime — there are no image files in this repository.

```
js/
├── main.js       — Scene, camera, controls, day/night, shooting state machine, animation loop
├── court.js      — Court surface, lines, paint, graffiti
├── hoops.js      — Poles, backboards, rims, chain nets, colliders
├── park.js       — Fencing, lamps, trees, benches, bleachers, paths, colliders
├── city.js       — Buildings, streets, sidewalks, cars, props
├── lighting.js   — Sun, moon, ambient, hemisphere, fill, rim, lamppost lights
├── player.js     — Player model, joint animation, movement physics, collision
└── ball.js       — Basketball physics, dribbling, pickup, shooting, collision, state machine
```

See [CLAUDE.md](CLAUDE.md) for the full technical reference — architecture, constants, collision system, coordinate map, known issues, and roadmap.

---

## Roadmap

**Now:** Shooting works. Pick up the ball, enter stance with X, aim with W/S/A/D, and shoot with X. Ball follows a realistic arc toward the hoop.

**Next:** Scoring detection — track when the ball goes through the rim, display points.

**Later:** AI opponents, game modes (1v1, 3v3, H-O-R-S-E), sound design, court progression, player customization, multiplayer.

---

## License

All rights reserved.
