# Project 88 — current state

**Last updated:** 19 Aug 2026 · `web-v2/`, `Font/`, `Lockup/` untracked · 10 commits

---

## Where we are

Both build days done, **plus the AD's V2 prompt and a stencil fix.**
CLI and web app work end to end. Deployed and verified live.

```
photo → preflight (vision triage) → crop → generate → ink separation
      → transparent PNG (+ stencil inversion)
```

| | |
|---|---|
| Repo | `/Users/will/Desktop/Project 88` → `github.com/BrownieNN/project-88` (private) |
| **Live (stable)** | **https://project-88-ten.vercel.app** — use this one, it survives every deploy |
| Also aliased | `project-88-willgotradiecoms-projects.vercel.app` |
| Prod password | in Vercel env `APP_PASSWORD` — `vercel env pull`. Never in this repo. Vercel's SSO wall is off, so this gate is the only gate |
| CLI | `p88` — `generator/bin/p88` |
| Web | `web/` — Next.js, runs on :3088 |
| Shared pipeline | `core/` — the `p88-core` workspace package |
| Model | `gemini-3.1-flash-image` |
| Ink | `#D82020` default; picker has `#F90000 #0027C5 #000000 #FFFFFF` |
| **Style spec** | **`Prompt V2.md`** — `Prompt.md` is the superseded v1, kept for history |

### Run the CLI
```bash
cd "/Users/will/Desktop/Project 88/example images"
export PATH="/Users/will/Desktop/Project 88/generator/bin:$PATH"
p88 DSC04351.jpg --keep
```

### Run the web app
```bash
cd "/Users/will/Desktop/Project 88/web" && npm run dev   # localhost:3088
```
Local password is `REDACTED` (in `web/.env.local`).

---

## What landed on 19 Aug

### 1. `Prompt V2.md` replaced the v1 style spec — `08d504a`

The AD rewrote the brief. It is **not an amendment**; it reverses three rules
the v1 build had hardened over rounds 1–5, so `core/src/prompt.ts` was rebuilt
rather than patched.

| | v1 (was) | V2 (now) |
|---|---|---|
| Logos | "SOLID FILL, NO LOGOS" — filled with flat ink | **Preserved.** Knights crest is a priority identity element |
| Edges | Scalpel-cut, faceted, angular (rounds 4–5) | **Explicitly not geometric.** Hand-inked first, screenprinted second |
| Face | "detailed facial features" sat in the negative prompt | **Likeness is priority one,** held by selective internal detail |

Also dropped: the imposed "dynamic diagonal composition", which fought V2's
instruction to preserve the source crop and camera angle.

**The round-5 roughness-vs-stripes trade-off is moot.** V2 replaced that whole
last-word-wins architecture with an explicit FINAL PRIORITY ORDER, which
`prompt.ts` now mirrors as its closing block.

**Deliberate divergences from V2**, all documented in the `prompt.ts` header:

- pure white ground instead of V2's warm off-white `#F5F0E8` — the luminance
  key needs it, and V2 § E asks for a clean-keying result anyway
- `{subject}` filled from the vision pass
- an isolation block V2 never had — the deliverable is a cut-out, not an
  illustration, and the model draws frames and turf if not told otherwise
- a **face branch**: when the vision pass reports `faceVisibility: obscured`,
  the prompt says keep it obscured rather than demanding facial landmarks.
  This is the one judgement call rather than a mechanical necessity — V2 has a
  single face rule and demanding landmarks from a turned-away head is exactly
  how a face gets invented

### 2. The stencil stopped hollowing out limbs — `5cd471e`

Reported as "the stencil misses body parts" — arms filled, face and legs
outline-only. **It was not the model failing to fill skin.** The silhouette
flood in `stencilInvert` was leaking into the figure. Measured on DSC02294: the
flood claimed 47% of the canvas as "outside" when the figure left only ~42%.

Two independent causes, both fixed:

1. **Broken contours.** V2 § E ORGANIC LINEWORK explicitly asks for lines that
   break and resume, so a limb outline is not a sealed loop and the flood walks
   through a 2–4px gap. The ink mask now gets a morphological close (dilate
   then erode by `seal`) before flooding. Recovered area plateaus at a 4px
   radius, so `seal` is ~0.6% of the short side — wide enough for a broken
   line, too narrow to weld an arm to the torso.
2. **Limbs cut by the crop.** A leg running off the frame is *genuinely* open
   at the cut edge and no sealing closes it. The flood is no longer seeded from
   those openings: a short open run along a canvas edge with figure on both
   sides is a sliced limb, not the exterior.

Silhouette on DSC02294 goes 47.0% → 53.9%. Verified across three outputs (walk,
run-out, flag): skin fills solid, jersey pattern and carved highlights survive,
no limb welded to the body. Both radii exposed as options (`seal`, `maxCut`).

⚠️ **V2 makes cause (1) more likely than v1 did**, because it pushes harder on
broken linework. If limbs go hollow again after a prompt change, look here
first.

### 4. `web-v2/` — the UX uplift, built from the Figma boards

A second Next app beside `web/`, sharing `core/` unchanged. **`web/` is
untouched** — same `package.json`, same deploy config, still the thing at
`project-88-ten.vercel.app`.

```
web/      :3088   stable, deployed, unchanged
web-v2/   :3089   the uplift, local only
core/             shared by both, plus the CLI
```

Boards 02-05 built, plus 01 (sign-in) and the failure state the dog exposed.
Export presets and the lockup composer (board 06) are still the next slice.

| | |
|---|---|
| Run it | `cd web-v2 && npm run dev` → :3089 |
| On a phone | `http://<mac-lan-ip>:3089` — QR at `/qr.html` |
| Local password | `REDACTED` (`web-v2/.env.local`) |
| Comment tool | Bottom-right widget → writes `web-v2/feedback/FEEDBACK.md` |

**What it does that v1 does not**

- **Batch tray.** Drop up to 40, all preflighted ~5 at a time, chips and
  ranking filling in progressively. The wait sits on the home screen in the
  dropzone, not on an empty review screen.
- **Verdicts as sentences.** One finding, one instruction, composed from the
  triage data — no second model call, deterministic, same photo reads the same
  way twice. Metrics demoted to a disclosure.
- **Narrated generating.** Four named stages, the real measured vision time,
  a wipe on arrival, and a cancel.
- **Session strip.** IndexedDB, survives a reload — the fix for the worst CX
  bug in v1, where closing the tab lost every paid generation.
- **Download pack.** Both versions in all four inks, eight PNGs, zipped in the
  browser. Costs nothing at the API.
- **A real sign-in** (board 01) replacing the browser's Basic-auth dialog, with
  a working cookie gate in `web-v2/proxy.ts`.
- **A rejection screen** for photos preflight cannot use, which reads the error
  and says which of the three real causes it was.

**Rules this build cost time to learn**

- **`allowedDevOrigins` is required for phone testing.** Next blocks
  cross-origin dev resources, which kills the HMR socket when you open the app
  by LAN IP. The dev client then reloads on a loop, so nothing responds to a
  tap — it looks like the app is broken, and the cause is one line in the
  server log.
- **Static files must bypass the auth matcher.** The sign-in screen is served
  to people who are by definition not signed in and needs the poster, the
  lockup and the fonts — all in `public/`. With only the `_next` paths excluded
  they redirect to `/login` themselves and the gate renders with broken images.
- **Figma's type is cap-trimmed.** Every button node carries
  `text-box-trim:trim-both` with `text-box-edge:cap alphabetic`, so a 12px line
  reports as a 10px box and padding is measured cap-to-baseline. Without it
  all-caps labels sit optically high and every button is 2-4px too tall.
- **Tracking is zero on buttons**, widened only on the small eyebrow labels. A
  blanket 0.1em made "CHOOSE PHOTO" 203px against a spec of 174.
- **A width baked into a shared component beats an unprefixed override.** The
  lockup's own `w-full` silently won over the header's `w-[121px]` — same
  specificity — and the mark vanished on mobile while desktop looked fine
  because `lg:` outranks it.
- **Tailwind v4 sets `cursor: default` on buttons**, unlike v3.
- **`scroll-padding` is what makes `snap-start` respect a gutter.** Without it
  the first card snaps flush to the container edge and cancels the padding.
- **`web-v2/package.json` needs the same Linux `optionalDependencies` as
  `web/`** or a Vercel build fails one native dep at a time.

**Deliberate divergences from the Figma file**, all on request:

- example captions and chip copy in PP Formula Extended, not Archivo/IBM Plex
- the daily 40 cap removed entirely — the club moves to its own API key
- "Sign out" in the top bar where the file has the counter
- hero copy is "an accent", not "a screenprint"

## ▶ NEXT

0. **Decide where `web-v2` deploys.** It is build-ready — Linux deps pinned,
   comment tool excluded via `.vercelignore` — but `vercel.json` points at
   `web/` and `.vercel/project.json` links this folder to the **project-88**
   project. Deploying `--prod` as-is would repoint
   `project-88-ten.vercel.app` at v2 and take the stable app down. A second
   Vercel project keeps both. **Also: deploying ships the licensed fonts to a
   public URL** — the licence check that keeps `Font/` untracked applies.

1. **AD reviews the V2 output.** Nothing has been generated through the new
   prompt yet — the deploy is the test. Both changes shipped unverified against
   a live generation, deliberately, to save quota
2. **Rotate the API key** (`API-KEY-SETUP.md` steps 5–7). It arrived via chat —
   treat as burned. **It is live in production right now.** Must happen before
   client handover
3. **Spend cap** $20/month at console.cloud.google.com/billing → Budgets
4. **Test on a real iPhone** — HEIC decode, touch crop, 4G upload all untested.
   The crop surface only sets `touch-action` on the handles, so a drag on the
   box itself will scroll the page
5. Failure states and limits — errors still surface as raw API text
6. Batch triage — the differentiator; preflight already is the ranker
7. Export presets / lockup composer

---

## Rules that cost time to learn — don't relearn them

- **`Prompt V2.md` is the source of truth for style.** Six variants of custom
  prose each made it worse: likeness went first, then boldness, ending at
  something that read as an inverted photo. `core/src/prompt.ts` is the AD's
  spec close to verbatim. **Don't write style prose — amend `Prompt V2.md` and
  mirror it.** The file is not read at runtime; the mirror is by hand, so
  editing one without the other is how they drift.
- **Diagnose silhouette bugs by rendering the mask, not by reasoning.** Dumping
  `outside` as a bitmap made the leak obvious in one look and took a guess off
  the table. Same trick applies to any flood/matte problem here.
- **Alpha is done in post, never asked of the model.** Prompt for flat white,
  key it with a luminance ramp. AI matting (rembg) is rejected — it softens the
  rough screenprint edges that carry the style.
- **Stencil inversion is an export treatment, not a generation mode.** V2 says
  so explicitly and the code already worked that way.
- **Ground detection = dominant bright mode of the luminance histogram.** Fixed
  threshold and border sampling both failed.
- **Style reference images leak content.** All four AD refs show players holding
  balls; the model drew a ball into a photo that had none. Removed.
- **Preflight is triage, not a bouncer** — READY / NEEDS CROP / NOT SUITABLE
  with reasons. Face visibility is informational, never a blocker: half the AD's
  references have obscured faces.
- **Browser-side downscale to 3000px is required.** Camera files are 5–25MB;
  a 21MB upload exceeded the request body limit outright, 3.4MB passed. It
  silently falls back to the original file when it can't decode a HEIC, and
  that fallback then fails later at upload, where the cause is invisible.
- **Next won't follow a symlink out of its root** — hence the npm workspace.
- Free-tier Gemini allows **0** image requests and 20 vision/day.

---

## Deploy rules that cost an hour to learn — don't relearn them

- **Every commit's email must belong to the GitHub account**, or Vercel refuses
  to build. It does not fail — it never *starts*: status `UNKNOWN`, zero build
  duration, no logs, nothing in the CLI. The cause only appears in the dashboard.
  Repo is pinned to `17942130+BrownieNN@users.noreply.github.com` via
  **repo-local** git config — a fresh clone won't inherit it, so set it again
- **The lockfile is macOS-only.** Every native dep resolved to `darwin-arm64`;
  Vercel builds `linux-x64` and cannot find them. Failures arrive one at a time,
  each a separate build: `lightningcss` → `@typescript/typescript` →
  `@next/swc`. The Linux builds are pinned in `web/package.json`
  `optionalDependencies`. **Adding any native dep means pinning its Linux twin.**
  `sharp` is deliberately unpinned — core wants 0.34.5, web 0.35.3, and pinning
  one version would break the other. It resolves correctly as-is
- **Root Directory stays at the repo root** (`p88-core` only resolves when
  install runs there) — **but that alone fails.** Vercel reads the *root*
  `package.json` for framework detection and `next` lives only in `web/`, so it
  dies in 12s with "No Next.js version detected". Fix: `next` is declared at the
  root as well. Both halves are required; neither works alone
- **`.vercelignore` is load-bearing** — without it the deploy uploads the 170MB
  photo library. With it, 92KB
- Vercel's own SSO wall is **on by default** and sits in front of `APP_PASSWORD`:
  `vercel project protection disable --sso`
- **Deploy with `npx vercel --prod --yes` from the repo root.** The stable alias
  `project-88-ten.vercel.app` re-points automatically — don't hand anyone a
  per-deploy URL
- The local Vercel CLI is v54 against a v58+ API. It sometimes reports live
  builds as `UNKNOWN` and returns no logs — **trust the dashboard over the CLI**
- Sanity check after deploying: `curl -sI https://project-88-ten.vercel.app/`
  should return `401` with a `WWW-Authenticate` header. That proves it is
  serving and the gate is up

---

## Open / known

- **V2 output is unreviewed** — no generation has run through the new prompt
- `Font/` is untracked in the repo root, deliberately left uncommitted pending
  a licence check on the font binaries
- No generation history; single shared password, not per-user accounts
- Concurrency untested
- **Rotate the API key before client handover.** The production password is
  also in git history (commit `e1e66c2`)
