[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/konzlodon74-dot/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/konzlodon74-dot/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Palmera Heat

An original open-world crime game for the make.fun **gta6-01** bounty, built
as static web files — no build step, no network, no libraries. Everything is
hand-written ES modules under `game/src/`, one job per file.

**Play it:** `node serve.ts`, then open http://localhost:8080 in desktop
Chrome. Or serve `game/` with any static file server.

## The game

Rico Vega washes up in **Palmera City** — eleven avenues of Old Town
terracotta, Downtown glass and Marina whitewash, wrapped around a palm-lined
beach — with a borrowed sedan and a fixer, **Sol Duarte**, who always has one
more job. Six story jobs (a first set of wheels, a hot delivery, a dockside
pickup, a neon repo, beachfront muscle, and the Palmera Job itself) plus
endless stash runs.

- Explore on foot or steal and drive 40+ cars: sedans, hatches, sports cars,
  vans and cabs, all with arcade physics, drift, damage and skid marks.
- Traffic drives the road graph on the correct side and brakes for you;
  pedestrians stroll, flee gunfire, and drop cash.
- A five-star wanted system: the Palmera PD routes squad cars across the
  city, rams, piles out, and busts you if officers hold you. Cool off out of
  sight and the stars drain.
- Combat on foot: fists first, a pistol after the dockside job; thugs and
  warehouse guards fight back.
- HUD with cash, health, wanted stars, an arrest meter, and a minimap with a
  live GPS route to your objective. Synthesised WebAudio engine, sirens and
  effects — no audio files. Progress saves at Rico's apartment or Sol's
  Cantina (localStorage).

## Layout

- `game/index.html` — the page; `game/src/` — the game: `config.js` tuning,
  `random.js` seeded RNG, `city.js` the city and its road graph, `input.js`,
  `audio.js`, `vehicles.js`, `people.js`, `police.js`, `missions.js`,
  `render.js`, `hud.js`, `game.js` the simulation core, `shots.js` the
  staged screenshot scenes, `main.js` the bootstrap.
- `screenshots/` — four real frames of the game, staged with `?shot=` scenes
  and captured in headless Chromium (see `shots.json`).
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to the
  output directory and writes `dossier.json` via `vendor/makefun-game.ts`
  (the kit's library, unchanged).
- `serve.ts` — a tiny local server for play-testing.

## Hand in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
