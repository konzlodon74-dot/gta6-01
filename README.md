[![Palmera Heat on make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/konzlodon74-dot/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/konzlodon74-dot/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Palmera Heat

A top-down open-world crime game that runs entirely in the browser. No
libraries, no downloads, no network: every sprite is drawn in code on a
canvas and every sound is synthesized with WebAudio.

You are Nico Ferreira, a marina hand on the Costa Serena who owes the fixer
Dario Venn a $2,000 marker. Work it off the only way Palmera offers: favours,
deliveries, borrowed cars, and staying one intersection ahead of the
Palmera police.

## The city

Palmera is a living grid of six avenues and four streets across eight named
districts — Hillside, Old Town, Downtown, the Mercado, Portside, Palm Beach,
the Marina and Farallon Point with its lighthouse. Traffic follows the road
network on its own, pedestrians walk their blocks and scatter when things get
loud, and the east edge of town gives way to sand, piers, moored boats and
open water.

## What you can do

- Walk and run anywhere; walk into the glowing ring to talk and take jobs.
- Take any car you can reach — parked ones quietly, traffic ones in front of
  their drivers — and drive it with arcade physics: drifts, handbrake turns,
  skid marks, panel damage, smoke and wrecks.
- Commit crimes and earn a wanted level of up to five stars. Police units
  converge from across the city, chase with your velocity in mind, and try to
  box you in. Get pinned at low speed and the bust meter fills.
- Follow a six-mission story chain for Dario: a first meeting at the marina,
  a cooler run, a passenger who knows too much, a vermillion coupe that has
  to change hands, a case delivered under a three-star sky, and a final
  escape along the coast.
- Earn on the side with courier drops and passenger fares, both offered on
  the street between story beats.
- Lose the heat for good at Venn's Garage, where $150 buys new plates and a
  respray.
- Get busted and wake up outside Palmera Police HQ, lighter in the wallet.
  Get wasted and wake up at St. Serena Hospital. Either way, the city keeps
  your story progress.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot, drive |
| Shift | Run on foot |
| F | Enter / exit the nearest car |
| Space | Shove (on foot) / handbrake (in a car) |
| E | Pay for new plates at Venn's Garage |
| P or Esc | Pause |
| Enter | Start, continue after a bust or a hospital visit |
| N | New game from the title screen |

Progress is saved to localStorage whenever a mission or side job lands.

## Running it

Open `game/index.html` from any static file server (or straight from disk in
most browsers) and play. The page is the whole game: `game/src/` holds the
modules — city generation, vehicles, pedestrians, police, missions,
rendering, HUD, audio and the staged screenshot scenes.

For deterministic screenshot scenes, append `?shot=chase`, `?shot=beach`,
`?shot=marina` or `?shot=arrest` to the URL; the game freezes on a composed
gameplay moment and flags `window.__shotReady` when it is on screen. The
four captures in `screenshots/` come straight from those scenes: a three-star
pursuit downtown, Rosa waiting on Palm Beach, a delivery staged on the marina
pier, and a bust about to land at a downtown intersection.

## Hand-in

`main.ts` is the make.fun hand-in script. With `MAKEFUN_OUTPUT_DIR` set it
copies `game/` and `screenshots/` into the output directory and writes
`dossier.json` there with `buildDossier` from `vendor/makefun-game.ts`,
which is the competition kit's vendor file, kept byte-identical.

## License

MIT — see `LICENSE`.
