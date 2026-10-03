# Hell Hole: Game Design Document

> A first-person tomb shooter. Twin 1911s, torchlight, and whatever is still awake under
> the sand. Every level is a staircase further down.

- **Concept art:** [Hell Hole Concept Art](https://claude.ai/artifact/AfyjwVC31uRyJ9aMe5WBgo)
  (in-engine renders; source in `concept/`, PNGs in `concept/shots/`)
- **Built from:** [mstr-gme-dsgn-tmpt](https://github.com/mtd-public/mstr-gme-dsgn-tmpt) house
  rules, [labyrinth-larry](https://github.com/mtd-public/labyrinth-larry) (Sin City ink pass,
  torch light pool), [Vertical-Vantage](https://github.com/mtd-public/Vertical-Vantage)
  (first-person core, Egypt tomb kit), [dr-mow](https://github.com/mtd-public/dr-mow) (PS1
  retro pipeline, synth audio)
- **Stage:** Depth I playable ([play](https://claude.ai/artifact/LgwBE6F1kzjzdbSh2d6EX7)).
- **Decided:** Dagger look at 360 lines; a 1980s soldier; the bazooka and Mk 2 grenades are 1940s
  finds in the pyramid; the Staff of Ra is found at Depth III.

## 1. Pillars

1. **Dark first.** Fire is the only light: small torches every 7 m in passages, bronze braziers
   in rooms. Between them, black. Every weapon past the 1911s is also a light source.
2. **Always deeper.** Each level ends at a way down (a stair, a shaft, a scarab door). The
   descent is the progression and the title.
3. **Devil Daggers pressure, Powerslave place.** Swarms that never let you stand still, in
   Egyptian tombs with real architecture.
4. **Colour is a signal.** Crimson is danger only (eyes, heart scarabs, weak points). Turquoise
   light is a sign that means something. Gold marks the way on. Fire is the only warm glow.

## 2. Look: "Dread" (`js/render/dread.js`)

| Setting | Value | Why |
|---|---|---|
| Internal resolution | 360 lines (640 × 360 at 16:9), hard-pixel upscale; 270 and 540 in settings | Sharper than dr-mow's 240, still chunky |
| Default style | **Dagger**: one warm ramp (black → bone) with a 4×4 Bayer dither; fire, crimson, gold and turquoise-sign accent ramps | Devil Daggers' near-mono: only the colour that means something survives |
| Alternate | **Pigment**: full colour snapped to 36 Egyptian inks | Kept in settings |
| Brightness | exposure 1.8 by default (settings 0.8–3) | Lifts lit stone without lifting black |
| Ink edges | depth edges in the opposite tone; dark-side rims fade out by 18 m | Monsters arrive as outlines before they arrive lit (Sin City) |
| Sin City | two-tone ink + hatching | Same materials, one uniform flips material roles |
| Torch light (game) | 10 cd, 10 m range, decay 2, from a pool of 8 real lights | Physical units: a pool about 4 m across, dark between |
| Brazier light (game) | 110 cd, 24 m range | Rooms are arenas lit from a few fires |
| Torch shadows | off by default (setting) | 256 px cube maps acne across whole rooms |
| Glyph glow | in play, walls never glow; only placed signs (ankh over a shrine, scarab on the door) | A lit sign always means something (§4) |

Flames are fog-free cards (three crossed, plus a top rosette and a white-hot core so they read
from above). Shots that would vanish edge-on (fire, beams, blasts) are camera-facing cards.

## 3. Player and arsenal

The hero is a **1980s soldier**: M81 woodland sleeves rolled, black fingerless gloves, a digital
watch. His squad went in an hour ahead of him. The radio went quiet at the second chamber.

| Weapon | Ammo | Role | Where | Light |
|---|---|---|---|---|
| Twin M1911A1 | .45 ACP, 7 + 1 each | Each trigger fires its own gun | his own | Muzzle flash is a real light |
| Remington 870 | 7 in the tube, 9 pellets | Close; staggers, clears swarms | the squad's, found in Depth I | Big flash |
| Bazooka (M1 pattern) | 1 + 6 rockets | Splash; back-blast near walls | found, 1940s expedition (Depth II) | The rocket is a moving light |
| Mk 2 grenades | carried, max 6 | Throw, bounce, 2 s fuse | found, 1940s crate (Depth I) | Blast lights the room |
| Staff of Ra (relic) | stored sun | Beam that burns through a line | Depth III | The only white light |

Live numbers are in `js/sim/tuning.js`, each with its reason.

## 4. Glyph language

| Lit sign | Meaning |
|---|---|
| Ankh | A shrine nearby restores health |
| Wedjat eye | A secret: false wall, niche, relic |
| Scarab | The way down (on the door at the bottom of every level) |

## 5. Bestiary

| Monster | Role | Weak point |
|---|---|---|
| The Wrapped (mummy) | Slow shambler; steps out of wall niches | Heart scarab (one shot) |
| Scarabs | Swarms of 20–40, climb walls | One bullet each |
| Jackal Warden | 2.5 m khopesh guard, telegraphs the slash | Head |
| Ba | Skull on painted falcon wings; flocks circle, then dive | Two shots |
| Canopic Mother | Floating spawner: ba from the mouth, scarabs from cracks | Crimson cracks |
| Serqet | Horse-sized scorpion; tail strike at 3 m | Stinger, while raised |
| **Ammit** (boss, Depth IV) | Crocodile, lion, hippo; charges and snaps | Gullet, while stunned by the scales |

## 6. Depths (first pass)

| Depth | Name | Content |
|---|---|---|
| I | The Descending Corridor | Torch-lit passages, the Wrapped, scarabs |
| II | Hypostyle of Night | Brazier-lit columns, Jackal Wardens, Canopic Mother; bazooka |
| III | The Well | Spiral stair round a burial shaft, ba on the steps; Staff of Ra |
| IV | Hall of Two Truths | Ammit under the Scales of Ma'at |

## 7. Depth I as built

`js/sim/levels.js`, 24 × 31 cells of 3 m: the start corridor (a mummy, ammo) → the antechamber
(four columns, two braziers, three mummies) → the east corridor (a scarab nest) → the squad's last
stand (bones in woodland, a helmet, the 870, shells) → north corridors (a mummy, a nest) → the hall
of pillars (eight columns, four braziers, five mummies, two nests, an ankh shrine, a 1940s grenade
crate) → the exit corridor → the scarab door. 42 sim checks prove it's finishable.

## Delta log

### claude/trusting-babbage-3fhzep: Depth I playable

- Decisions: Dagger default at 360 lines; 1980s soldier (woodland, fingerless gloves); the 870
  is his own; bazooka and Mk 2 grenades are 1940s finds; Staff of Ra at Depth III.
- `js/sim/`: pure rules: movement, twin-trigger 1911s with per-gun reloads, the 870 (shell-by-shell
  reload), bouncing Mk 2 grenades, mummies (path field, windup, heart-scarab one-shot), scarab
  nests and swarms, pickups, ankh shrine, exit. `tools/sim-check.mjs` (42 checks).
- `js/render/`: level geometry from the map, the torch light pool (8 lights), baked mummies,
  instanced scarabs, particles and explosions, the viewmodel; the Dagger ramp gained a turquoise
  glyph accent and a Brightness exposure.
- `js/input`, `js/audio`, `js/ui`, `index.html`, `css/`: pointer lock + gamepad + touch, synth
  sound set, HUD, title / pause / settings / end screens.
- Verified: sim checks 42/42; `tools/smoke.mjs` on desktop and phone (0 console errors, no page
  scroll, firing, pause, the door ends the depth).

### claude/trusting-babbage-3fhzep: concept art (no game loop yet)

- `js/render/dread.js`: the Dread post pass (Pigment / Dagger / Sin City), from
  labyrinth-larry's `ink.js` and dr-mow's retro dither.
- `js/render/tomb.js`, `textures.js`: tomb kit (corridors, halls, papyrus columns, burial shaft,
  torches, braziers, pylons) and procedural painted textures with glowing-glyph emissive maps.
- `js/render/monsters.js`, `guns.js`, `weapons.js`: bestiary, twin 1911 viewmodel, the arsenal
  and effects (explosion, rocket, sun beam).
- `concept/`: shot composer and the concept board; `tools/render-concepts.mjs` renders it all.
- Verified: every shot renders headless through swiftshader with no page errors; the board has
  no horizontal scroll at 390 px and 1280 px.
