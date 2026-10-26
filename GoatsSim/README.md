# GOATS on Hanamura (Overwatch, late 2018)

A browser game: you're the Reinhardt in a GOATS mirror (Reinhardt, Zarya, D.Va, Lúcio, Brigitte, Zenyatta on both sides) attacking Hanamura's first point. Your team walks in through the main gate behind your shield, pokes from the platform above the point, waits for Lúcio's speed, and brawls. Both teams trade ults the way the meta did: bait a save with one ult, land the next when the save is gone, and answer theirs.

The heroes and the map are the real Overwatch models, converted from the rips in `source/` (see [Models and map](#models-and-map)).

## Playing

Serve the folder and open it in Chrome, Edge or Firefox (the preview config in `.claude/launch.json` does this as `goats-sim`):

```
python -m http.server 8803 --directory GoatsSim
```

then go to http://localhost:8803. To open `index.html` straight from disk instead, run `python GoatsSim/tools/pack_assets.py` once first (browsers block loading the models from a file:// page, so that bundles them into a script).

**Play** puts you in the fight. **Watch the bots** runs the same fight with a bot on your Reinhardt and a camera behind your team, if you want to see how a GOATS fight plays out before you try it.

| | |
|---|---|
| `W` `A` `S` `D`, `Space` | Move, jump |
| Mouse | Look (click the game to lock the mouse) |
| `LMB` | Rocket Hammer (hold to keep swinging; swings alternate direction) |
| `RMB` | Barrier Field (hold; the camera goes third person, like the game) |
| `Shift` | Charge (pins the first enemy it hits; 300 damage when the charge ends) |
| `E` | Fire Strike (goes through barriers and heroes) |
| `Q` | Earthshatter (blocked by a Reinhardt or Brigitte barrier in the way) |
| `Tab` | Scoreboard for the current fight |
| `H` | Coach tips on or off |
| `Esc` | Pause |

Settings (sensitivity, FOV, coach, bot skill, reading comms aloud) are saved in your browser.

## What a fight looks like

1. **Setup and walk-in.** Your team groups up in the plaza outside the gate and walks in behind you. Lúcio plays speed on the walk. The defenders set up on the point.
2. **Poke.** Your team takes the platform over the courtyard. Zen discords a tank, D.Va and Zen poke, Zarya fishes for energy, Brig hugs you with packs ready. Shields face each other.
3. **Engage.** Someone calls it: an ult advantage, a pick, an enemy save used, or you walking into them. Lúcio amps speed, everyone goes in.
4. **Ult trade.** Grav into bomb if it's there. Trans the grav, Beat the bomb. Bubbles on whoever is about to eat a Shatter or a bomb. Rally on the engage. Shatter when their Rein's shield is down or turned, or once their saves are gone.
5. **End.** A team is wiped (or down to its last hero), the point is captured, or the clock runs out. The result screen shows the fight's timeline (every ult, grav catch, bomb and kill) with notes on your Reinhardt.

Each fight after the first picks a scenario that sets who walks in with which ults: an even fight, you holding Grav and Bomb against their Trans and Beat, them holding the combo, or a Shatter-vs-Shatter fight.

### The HUD

Health in 25 hp segments (white health, yellow armour, blue shields), ult meter, abilities with cooldowns and the barrier's health, objective and both teams up top, kill feed. On top of the 2018 HUD there are team comms as text ("Grav is up", "Their Trans is down!"), the ult voice lines (theirs in their language: "Огонь по готовности!", "Pass into the Iris."), an ult tracker (your team's ult %, and what you've seen theirs use) and a coach box.

## How the sim works

| Part | What it does |
|---|---|
| Heroes (`js/data.js`, `js/kits.js`) | Late-2018 numbers: Rein 300+200 armour, 2000 barrier, 75 hammer, 300 pin, 2.5 s Shatter knockdown; Zarya 200+200, bubbles 200 for 2 s, energy from absorbed damage, 4 s Grav; D.Va 400+200 mech, Defense Matrix, boosters, micro missiles, 1000 bomb, baby D.Va and Call Mech; Lúcio 16.25 hps / 30% speed songs, Amp It Up, Soundwave, 750 Sound Barrier; Brigitte 150+50, 3 repair packs, Inspire, Whip Shot, Shield Bash with the 2018 stun, Rally; Zen 50+150, Harmony 30 hps, Discord +30%, 300 hps Transcendence. Ult costs are tuned for one fight rather than copied |
| Damage (`js/units.js`) | Overwatch's order: bubble and Transcendence first, then Discord, then Sound Barrier shields, Brigitte's overhealth armour, shields, armour (2018 rule: −5 per hit, half for hits under 10), health. Barriers are curved walls that stop shots, Shatter and bombs; Defense Matrix eats projectiles and bullets but not beams |
| Bots (`js/ai.js`) | A director per team runs the phases (setup, walk-in, poke, engage, retreat) and the ult trade; each hero has a brain that holds its spot in the deathball and plays its kit (D.Va dives the Zen, Brig whips squishies and bashes a charging Rein, Zarya bubbles whoever is about to eat a big hit, Zen moves up when he can't see the fight). Saves react with a human-ish delay |
| Map (`js/world.js`) | Hanamura's real geometry, with up to four standable floors per half-metre cell (so stairs, the platform and the courtyard work), A* paths over them, and a wall grid for line of sight |
| Animation (`js/rig.js`, `js/anim.js`) | The rips have no animations, so everything is procedural: walk cycles from actual movement, spine aim, a pose per hero and action, and two-bone IK putting the hands on the weapon grips. Every Overwatch hero shares bone ids (bone_0002 pelvis, bone_0011 head, ...), so one bone map drives them all |

## Models and map

The rips are DataTool FBX exports with the material → texture links stripped. The tools here rebuild what the game needs, in Blender (any 4.x; the commands use the one bundled with another project here):

```
blender -b --factory-startup --python GoatsSim/tools/export_heroes.py
blender -b --factory-startup --python GoatsSim/tools/export_map.py
blender -b GoatsSim/work/map/hanamura.blend --python GoatsSim/tools/build_nav.py
python GoatsSim/tools/pack_assets.py
```

- **Heroes** (`export_heroes.py`, about 15 s): Reinhardt (Optimus Prime), Zarya (OW2), D.Va (My Melody mech and pilot), Lúcio (Jazzy), Brigitte (ANTIFRAGILE BB), Zenyatta (OW2) and their weapons. Each material's colour map is pinned by texture id: it was found by comparing each mesh's UV layout with the painted area of every texture in its folder, then checked by eye. Meshes are decimated to about 15k triangles, textures scaled to 2048 or less, weapons baked to static meshes that the game puts in the hands.
- **Map** (`export_map.py`): the first run imports the 200 MB Hanamura FBX (about 6 minutes) and caches it as `work/map/hanamura.blend`. It cuts out the area from the town to the bell temple in detail (about 270k polygons) plus a decimated backdrop and skyline. Hanamura's textures are tiling sheets and can't be matched to its 350 materials by UV layout, so each surface gets a colour from what it is (roof, ground, plaster, lacquer, wood, cherry blossom, bushes) and baked ambient occlusion. Foliage is found from the rip's vertex colours, which are pure red on leaves.
- **Navigation** (`build_nav.py`, about 15 s): samples every triangle in the fight area into floors (up to 4 per cell) and a wall grid.

`viewer.html` is a dev page that poses every hero with its weapons (on the map, or on a plain floor with `?nomap`) to check the bone map and weapon axes.

`source/` and `work/` are git-ignored, so Blizzard's files never go into the repo.

## Files

| | |
|---|---|
| `index.html`, `css/style.css` | Page, HUD and menus |
| `js/data.js` | Hero numbers, comp, battletags, comms and ult lines |
| `js/assets.js` | Loads the GLBs and nav data (fetch, or the packed script from disk) |
| `js/world.js` | Renderer, lighting, map, nav floors, line of sight, A* |
| `js/rig.js`, `js/anim.js` | Procedural skeleton posing, IK, weapon placement; poses per hero |
| `js/units.js` | Units, damage pools, barriers, projectiles |
| `js/kits.js` | Every ability, and resolving melee, hitscan, beams and projectiles |
| `js/ai.js` | Team directors (phases, engage calls, ult trade) and hero brains |
| `js/player.js` | Your controls, first-person hammer, third-person and watch cameras |
| `js/fx.js`, `js/audio.js` | Effects and synthesised sound |
| `js/hud.js` | HUD, kill feed, comms, ult tracker, coach, scoreboard |
| `js/main.js` | Map points, scenarios, the fight loop, physics, objective, results |
| `tools/` | The Blender export scripts and the packer |

## Changelog

- **1.0.0**: first version. Hanamura first point, attack, GOATS mirror with the six real hero models, procedural animation, team directors with ult rotations, coach, watch mode.
