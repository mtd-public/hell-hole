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
- **Stage:** design note and concept art. No game loop yet.

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
| Internal resolution | 270 lines (480 × 270 at 16:9), hard-pixel upscale | Devil Daggers / PS1 chunk; dr-mow ships 240 |
| Default style | **Pigment**: full colour snapped to 36 inks with a 4×4 Bayer dither | Multi-colour (user direction), but every pixel is one ink |
| Value curve | gamma 1.5 on luminance, hue kept | "Shrouded in darkness": mids fall to black |
| Ink edges | depth edges in the opposite tone; dark-side rims fade out by 18 m | Monsters arrive as outlines before they arrive lit (Sin City) |
| Alternates | **Dagger** (near-mono warm ramp + 3 accent ramps), **Sin City** (two-tone ink + hatching) | Same materials, one uniform flips material roles |
| Torch light | 1.8 cd, 6.5 m range, decay 2 | Pools of light with dark between |
| Brazier light | 30 cd, 20 m range | Rooms are arenas lit from a few fires |
| Glyph glow | only ankh, wedjat eye and scarab, ~30 % of those | A lit sign is rare, so it means something (§4) |

Flames are fog-free cards (three crossed, plus a top rosette and a white-hot core so they read
from above). Shots that would vanish edge-on (fire, beams, blasts) are camera-facing cards.

## 3. Player and arsenal

| Weapon | Ammo | Role | Light |
|---|---|---|---|
| Twin M1911A1 | .45 ACP, 7 + 1 each | Each trigger fires its own gun; alternate or fire both | Muzzle flash is a real light |
| Trench gun (M1897 pattern) | 6 shells, 9 pellets | Close; slam-fire by holding trigger and pumping | Big flash |
| Bazooka (M1 pattern) | 1 + 6 rockets | Splash; back-blast near walls | The rocket is a moving light |
| Mk 2 grenades | carried | Cook, throw, bounce; left hand throws while the right keeps a 1911 | Blast lights the room red |
| Staff of Ra (relic, Depth III) | stored sun | Beam that burns through a line | The only white light; recharge in a brazier |

All numbers above are proposals to tune in a `TUNING` table, each with its reason.

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

## 7. Open questions

- Pigment as the look, or Dagger's near-mono?
- 270 lines, or a sharper 360?
- 1930s expedition hero, or a modern operator?
- Staff of Ra as a late relic, or in hand from the start?

## Delta log

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
