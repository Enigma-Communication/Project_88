# p88 — Test Card

## Start

```bash
cd "/Users/will/Desktop/Project 88/example images"
export PATH="/Users/will/Desktop/Project 88/generator/bin:$PATH"
```

Or double-click `generator/bin/open-p88.command`.

## Run

```bash
p88 DSC07264.jpg --keep
open DSC07264_illustration_on-white.png
```

`p88 --clean` wipes previous outputs.

## What good looks like

```
[1/5] preflight  ✓ 2 in frame · face clear · dynamic · 1 overlapping
     NEEDS CROP    1 other player overlapping the subject
[2/5] crop       ✓ 3911px → 985px in model input
[3/5] generate   ✓ 298kb
[4/5] ink sep    ✓ ground lum 255 (87% of frame) → 685x940
[5/5] write png  ✓ 45kb
```

**Watch for:**
- `ground lum` near **255** — model returned a clean white ground
- `% of frame` above **~70%** — lower means a patchy ground, cut-out may have holes
- `border frame removed` — the model drew a frame; post-process caught it

## Photos

Green — clean solo, easiest:
```
DSC04576  best all-rounder     DSC01965  smaller source
DSC04351  lowest res           DSC02294  static pose
DSC01740  back-turned
```

Harder — other players in frame:
```
DSC04262  gameplay wide        DSC01649  tunnel run, 5 players
DSC07264  flag + pyro          DSC02466  6 tangled players, expect fail
```

## Options

```
--keep       crop + raw + comps on white/black/navy
--clean      delete everything p88 made here
--model=     nb31 (default) | pro3 (slower, better) | nb25
--out=       output filename
--fresh      re-run vision pass, ignore cache
--force      generate even if preflight says NOT SUITABLE
--help
```

## If it breaks

| Message | Meaning |
|---|---|
| `limit: 0` | Key's project has no billing — see `API-KEY-SETUP.md` |
| `Rate limited` | Wait ~60s, retry |
| `model returned no image` | Model refused — re-run |
| `ground lum` well below 255 | Model ignored the white-ground instruction — re-run |
| `NOT SUITABLE` | Preflight refused. `--force` to override |

## Changing the style

Edit `Prompt.md`, then mirror it in `generator/src/prompt.ts`.
That file is the AD's prompt close to verbatim — keep it that way.
