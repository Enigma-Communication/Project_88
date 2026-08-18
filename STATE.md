# Project 88 — current state

**Last updated:** 18 Aug 2026 · working tree clean, 8 commits

---

## Where we are

Both days done. **CLI and web app work end to end. Deployed and verified live.**

```
photo → preflight (vision triage) → crop → generate → ink separation
      → transparent PNG (+ stencil inversion)
```

| | |
|---|---|
| Repo | `/Users/will/Desktop/Project 88` → `github.com/BrownieNN/project-88` (private) |
| Live | https://project-88-j8onvmrpe-willgotradiecoms-projects.vercel.app |
| Prod password | in Vercel env `APP_PASSWORD` — `vercel env pull`. Never in this repo. Vercel's SSO wall is off, so this gate is the only gate |
| CLI | `p88` — `generator/bin/p88` |
| Web | `web/` — Next.js, runs on :3088 |
| Shared pipeline | `core/` — the `p88-core` workspace package |
| Model | `gemini-3.1-flash-image` |
| Ink | `#D82020` default; picker has `#F90000 #0027C5 #000000 #FFFFFF` |

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

## ▶ NEXT: step 2 of 7 — test on a real iPhone

Agreed priority list, ordered by what breaks if it's missing. **1–3 are downside
protection, 4–6 are upside.**

1. ~~**Deploy**~~ — **DONE.** Verified in production: password gate (401/200),
   preflight vision call, full generation, transparent PNG + stencil.
   **Not done: key rotation and spend cap** — deliberately deferred, see below
2. **Test on a real iPhone** ← *next* — most likely first-contact failure. HEIC may not
   decode in the browser downscaler; touch crop and 4G upload both untested
3. **Failure states and limits** — match-day concurrency, model returning junk,
   quota exhaustion. Errors currently surface as raw API text
4. **Batch triage** — drop 20 photos, rank by suitability, generate the best few.
   The differentiator; mostly built already since it reuses preflight
5. **Onboarding** — fold into 4; the ranked list is the teaching
6. **Export presets** — the Dominic Young lockup shows the deliverable is a
   finished graphic, not a cut-out
7. **History** — generate, close tab, gone

### Step 1 — what actually happened

Done: repo pushed, Vercel linked, env vars set in all three environments,
SSO wall disabled, deploy verified end to end.

**Still outstanding by choice:**
- **1a** Rotate the API key (`API-KEY-SETUP.md` steps 5–7). The current key
  arrived via chat — treat as burned. **It is live in production right now.**
  Must happen before client handover
- **1b** Spend cap $20/month at console.cloud.google.com/billing → Budgets

### Deploy rules that cost an hour to learn — don't relearn them

- **Every commit's email must belong to the GitHub account**, or Vercel refuses
  to build. It does not fail — it never *starts*: status `UNKNOWN`, zero build
  duration, no logs, nothing in the CLI. The cause only appears in the dashboard.
  All 10 original commits used a Gmail not attached to `BrownieNN`. Repo is now
  pinned to `17942130+BrownieNN@users.noreply.github.com` via **repo-local**
  git config — a fresh clone won't inherit it, so set it again
- **The lockfile is macOS-only.** Every native dep resolved to `darwin-arm64`;
  Vercel builds `linux-x64` and cannot find them. Failures arrive one at a time,
  each a separate build: `lightningcss` → `@typescript/typescript` →
  `@next/swc`. The Linux builds are now pinned in `web/package.json`
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
- Vercel's own SSO wall is **on by default** and sits in front of `APP_PASSWORD`,
  so the link can't be shared until it's off: `vercel project protection disable --sso`
- The local Vercel CLI is v54 against a v58+ API. It reports live builds as
  `UNKNOWN` and returns no logs — **trust the dashboard over the CLI**

---

## Rules that cost time to learn — don't relearn them

- **`Prompt.md` is the source of truth for style.** Six variants of custom prose
  each made it worse: likeness went first, then boldness, ending at something
  that read as an inverted photo. `core/src/prompt.ts` is the AD's spec close to
  verbatim. **Don't write style prose — amend `Prompt.md` and mirror it.**
- **Alpha is done in post, never asked of the model.** Prompt for flat white,
  key it with a luminance ramp. AI matting (rembg) is rejected — it softens the
  rough screenprint edges that carry the style.
- **Ground detection = dominant bright mode of the luminance histogram.** Fixed
  threshold and border sampling both failed.
- **Style reference images leak content.** All four AD refs show players holding
  balls; the model drew a ball into a photo that had none. Removed.
- **Every rule added pulls the output smoother.** Logo, stripe and isolation
  rules each nudged it toward careful, and careful reads as smooth. If the AD
  asks for another rule, expect a roughness check with it.
- **Preflight is triage, not a bouncer** — READY / NEEDS CROP / NOT SUITABLE
  with reasons. Face visibility is informational, never a blocker: half the AD's
  references have obscured faces.
- **Browser-side downscale to 3000px is required.** Camera files are 5–25MB;
  a 21MB upload exceeded the request body limit outright, 3.4MB passed.
- **Next won't follow a symlink out of its root** — hence the npm workspace.
- Free-tier Gemini allows **0** image requests and 20 vision/day.

---

## AD feedback, all addressed

| Round | Note | Fix |
|---|---|---|
| 1 | Not rough enough, no grain, likeness slipping | prompt rebuilt from `Prompt.md` |
| 2 | Invert fill on dark backgrounds like a stencil artist | `stencilInvert()` |
| 2 | No logos, fill solid | `Prompt.md § E` |
| 3 | Jersey stripes lost | § E exception: remove the printing, keep the jersey |
| 3 | Stencil outline too thin | contour band, 6px at ~640px output |
| 4 | Too smooth again | § E ink-roughness amendment, placed last |

---

## Open / known

- Sponsor logos occasionally still legible — parked by AD decision
- No generation history; single shared password, not per-user accounts
- Concurrency untested
- **Rotate the API key before client handover**
