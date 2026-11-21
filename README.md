[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ariin6661/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ariin6661/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar City

An original 2D top-down open-world crime game. Rio Vega, a driver-for-hire, is drawn back into the Solmar underworld by Mara — explore a sun-soaked coastal city on foot and by car, steal rides, outrun the police, run taxi fares, find hidden packages, and finish a four-mission story.

## What is in the game

- A city to explore on foot and by car: 9 avenues × 8 streets, buildings, parks, a beach and a pier, five named landmarks (Mara's Garage, Plaza del Sol, The Meridian, Solmar Pier, Dockside Yards), with a camera that follows you.
- Traffic cars that follow the roads and pedestrians who stroll the sidewalks — and flee when you threaten them.
- Cars to steal and drive: walk up, press E, drive with WASD, handbrake on Space, collisions and skid marks.
- A wanted level (0–5 stars): police cruisers spawn, chase and ram you; the heat dies down when you lay low.
- Four story missions with objectives, minimap markers and dialogue: Borrowed Wheels, The Pickup, Beat the Clock (90 seconds), Dockside Standoff (four armed enemies) — plus taxi fares and 10 hidden packages.
- Combat: punch and a pistol (12 rounds, R to reload), enemies who shoot back.
- A HUD with a live minimap, health, money, wanted stars, objective text, a clock, dialogue, crosshair and ammo.
- Start screen, pause menu, game over with respawn, mission-passed screens, and saving to localStorage (money, missions, packages, best stats).
- Polish: smooth camera with shake, day/dusk/night lighting, and fully synthesized WebAudio sound — engine, sirens, gunshots and a music loop (M toggles it). No audio files, no network requests.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 — the game loads from `game/` and plays offline.

## Controls

- **WASD / arrows** — move on foot, drive the car
- **Mouse** — aim the pistol, **click** to shoot
- **E** — enter / exit a car
- **Space** — handbrake
- **F** — punch
- **R** — reload
- **P** — pause
- **M** — music on/off
- **N** — start the next story mission

## Screenshots

Four real renders of the game itself, in `screenshots/` (the first by name is the cover): a dusk police chase, Rio on foot at Plaza del Sol, Mission 1 in progress, and a second chase angle. Reproduce them with `?shot=chase|play|mission&seed=1` (or `seed=7` for the fourth) on the game URL.

Built with make.fun — try it yourself: https://make.fun/r/k7ew9786 (referral code k7ew9786)
