# NEON EXODUS

A lightweight browser FPS. You are **UNIT-7**, the last maintenance android aboard Helios
Station. The station AI — **MOTHER** — has purged the crew and turned the security fleet
against you. Fight through five sectors to reach the last escape pod.

## Run it

Double-click **`index.html`** — that's it. No install, no build, no server, **no internet**.
Three.js is vendored locally (`vendor/three.min.js`) and everything else is procedural,
so the game runs fully offline straight from `file://`.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Rendering | Three.js r128 (vendored, classic script) | WebGL power, zero build step, runs offline from `file://` |
| Code | Vanilla JS modules-by-convention (`js/*.js`) | No bundler, no framework weight |
| Audio | WebAudio, fully synthesized | Zero asset files — every gunshot/explosion is generated |
| Assets | None | All geometry is procedural low-poly neon |

## Controls

| Key | Action |
|---|---|
| WASD | Move |
| Mouse | Aim / Fire |
| Shift | Sprint |
| Space | Jump |
| 1–5 | Switch weapons |
| R | Reload |
| Esc | Pause |

## Arsenal (unlocked sector by sector)

1. **PULSE PISTOL** — semi-auto, infinite ammo
2. **SCATTER COIL** — 8-pellet magnetic shotgun
3. **RIPPER SMG** — 700rpm full-auto
4. **ARC RAILGUN** — pierces every enemy in a line
5. **SUNLANCE** — explosive reactor fragment (boss killer)

## Hostiles

- **Stalker** — melee chaser
- **Swarmer** — fast, fragile, comes in packs
- **Watcher** — hovering ranged drone, strafes and keeps distance
- **Brute** — heavy tank
- **THE WARDEN** — boss; fires bolt fans and summons swarmers

Enemies drop health cells and ammo cubes. Each sector recolors the arena.

## Project layout

```
index.html         HTML + CSS (HUD, menus, story screens, fault screen)
vendor/three.min.js Three.js r128, vendored for offline play
js/audio.js        procedural WebAudio sfx + ambient music
js/world.js        scene, arena, collision, particles, pickups
js/weapons.js      weapon defs, firing, viewmodel, tracers
js/enemies.js      enemy types, AI, projectiles, boss
js/player.js       first-person controller (pointer lock)
js/game.js         story, sectors, waves, combat resolution, HUD
.test/             headless smoke test (the deploy gate)
.github/workflows/ CI: runs the smoke test on every push/PR
```

## Tests

```
cd .test
npm install          # installs puppeteer (bundled Chromium) for CI/headless
node smoke.js        # serves the repo over localhost and runs 26 assertions
```

The harness picks a browser in this order: `BROWSER_PATH` env var → bundled
`puppeteer` Chromium → an auto-detected local Chrome/Edge. CI runs it on every
push as the deploy gate.
