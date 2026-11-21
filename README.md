[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ariin6661/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ariin6661/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar City

A 2D top-down open-world crime game, built from scratch. Rio Vega — a driver-for-hire — is pulled back into the Solmar underworld by Mara. Roam a sun-soaked coastal city on foot and behind the wheel, lift cars, dodge the police, run fares, pocket hidden packages, and play through a four-job story.

## Inside the game

- A living city on a 9-avenue by 8-street grid: buildings, parks, a beach and a pier, five named landmarks (Mara's Garage, Plaza del Sol, The Meridian, Solmar Pier, Dockside Yards), and a camera that trails you everywhere.
- Traffic that drives the grid and pedestrians who walk the sidewalks — and sprint away when you or a gunshot threatens them.
- Cars worth stealing: walk up, press E, drive with WASD, handbrake on Space, with collisions and skid marks.
- A wanted level from 0 to 5 stars: cruisers spawn, chase and ram, and the heat only fades when you lay low.
- A four-mission story with map markers and dialogue — Borrowed Wheels, The Pickup, Beat the Clock (90 seconds), Dockside Standoff (four armed guards) — plus taxi fares and 10 hidden packages to find.
- Combat: fists and a pistol (12 rounds, R reloads) against enemies who fire back.
- A HUD with a live minimap, health, cash, wanted stars, objectives, a clock, dialogue, crosshair and ammo.
- A title screen, pause menu, game-over with respawn, mission-passed screens, and a save in localStorage (money, jobs, packages, best stats).
- The feel: a smooth camera with shake, daylight that slides into dusk and night, and a fully synthesized WebAudio soundtrack — engine, sirens, gunfire and a bass loop (M toggles it). No audio files, no network requests, no libraries.

## Running it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game loads from `game/` and plays offline.

## Controls

- **WASD / arrows** — walk on foot, drive the car
- **Mouse** — aim the pistol, **click** to shoot
- **E** — get in / out of a car
- **Space** — handbrake
- **F** — punch
- **R** — reload
- **P** — pause
- **M** — music on/off
- **N** — start the next story job

## Screenshots

Four real renders of the game itself, in `screenshots/` (the first by name is the cover): a dusk police chase, Rio on foot at Plaza del Sol, Mission 1 in progress, and a second chase angle. Retake them with `?shot=chase|play|mission&seed=1` (or `seed=7` for the fourth) on the game URL. Clear the site's localStorage first — the game autosaves, and one shot's money and progress would otherwise leak into the next shot.

Built with make.fun — try it yourself: https://make.fun/r/k7ew9786 (referral code k7ew9786)
