# p88 — photo → screenprint illustration

Terminal proof of concept. One photo in, one transparent PNG out.

## Run

Double-click **`generator/bin/open-p88.command`** — opens a Terminal already in the
photo folder with `p88` on the PATH.

Or manually:

```bash
cd "/Users/will/Desktop/Project 88/example images"
export PATH="/Users/will/Desktop/Project 88/generator/bin:$PATH"
p88 DSC07264.jpg --keep
```

Output lands beside the source as `<name>_illustration.png` — transparent,
one-colour ink.

## Options

```
--model=<nb31|nb25|pro3>   nb31 = gemini-3.1-flash-image (default)
--keep                     also write the crop, raw model output,
                           and comps on white / black / navy
--clean                    delete everything p88 generated here
--out=<file>               output filename
--fresh                    re-run the vision pass, ignore cache
--no-triage                skip vision entirely (no auto-crop)
--force                    generate even if preflight says NOT SUITABLE
--help
```

## Pipeline

```
1  preflight   vision pass — people in frame, overlaps, face visibility,
               pose readability, one-sentence subject description.
               Prints READY / NEEDS CROP / NOT SUITABLE.
2  crop        crop to the dominant athlete, upscale to 1280px
3  generate    gemini-3.1-flash-image, flat white ground
4  separate    key the ground to alpha — true one-colour ink separation,
               then strip any border frame the model drew
5  write       transparent PNG
```

Triage is **cached per photo**, so re-running costs no vision quota.

## The prompt

`src/prompt.ts` is the art director's `Prompt.md`, close to verbatim —
STYLE_ONLY template, section B style definition, section D negative prompt.

**Two additions only, both mechanical, both documented in the file:**

1. Pure white ground instead of "warm off-white paper" — we key the ground to
   alpha and off-white keys unreliably.
2. Hard isolation rules (no border, no ground, no motion lines) — the
   deliverable is a cut-out, and the model kept drawing frames.

The `{subject}` slot is filled from the vision pass. **If the style needs to
change, change `Prompt.md` and this follows.** No prose from us in between.

## Layout

```
src/
  cli.ts        the p88 command
  config.ts     models, ink colour, paths, tunables
  gemini.ts     vision triage + image generation
  crop.ts       crop to dominant subject
  verdict.ts    READY / NEEDS CROP / NOT SUITABLE
  prompt.ts     the AD's prompt
  matte.ts      ink separation, ground detection, border strip
  cache.ts      per-photo triage cache
  slice-refs.ts cuts Reference/illustrations.png into 4 style refs
  check.ts      triage one photo          (npm run triage)
  triage-all.ts triage the whole test set (npm run triage:all)
  test-crop.ts  crop only                 (npm run crop)
  test-matte.ts ink separation only, no API calls (npm run matte)
```

## Known / open

- Sponsor logos (`nib`, `Harvey Norman`) still render legibly despite the
  negative prompt. Parked — decide with the AD whether to strip in post.
- Fine hatching appears where the reference sheet uses flat masses.
- Requires a **billing-enabled** Google Cloud project — see `API-KEY-SETUP.md`.
- The API key in `.env` arrived via chat. **Rotate before client handover.**
