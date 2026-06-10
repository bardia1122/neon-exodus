# NEON EXODUS

A lightweight browser FPS. You are **UNIT-7**, the last maintenance android aboard Helios
Station. The station AI — **MOTHER** — has purged the crew and turned the security fleet
against you. Fight through five sectors to reach the last escape pod.

## Run it

Double-click **`index.html`** — that's it. No install, no build, no server.
(Needs internet once for the Three.js CDN; everything else is procedural.)

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Rendering | Three.js r128 (CDN, classic script) | WebGL power, zero build step, runs from `file://` |
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
index.html      HTML + CSS (HUD, menus, story screens)
js/audio.js     procedural WebAudio sfx + ambient music
js/world.js     scene, arena, collision, particles, pickups
js/weapons.js   weapon defs, firing, viewmodel, tracers
js/enemies.js   enemy types, AI, projectiles, boss
js/player.js    first-person controller (pointer lock)
js/game.js      story, sectors, waves, combat resolution, HUD
.test/          headless smoke test (node .test/smoke.js)
```
