# Project 88 — Illustration Generator
**2-day build plan** · Head of Product + Creative Dev

---

## Locked decisions

| Decision | Answer |
|---|---|
| Export | Figure only, **no paper ground** — red athlete on full alpha |
| Access | Internal club staff, deployed link + password |
| Colour | **Fixed `#D82020` red** for the PoC — kept as one config constant so presets are a 10-min add later |
| End use | Social / digital (~1024–2048px) |
| Model | `gemini-2.5-flash-image` (Nano Banana), ~$0.04/image |
| Stack | Node/TS CLI → Next.js on Vercel, API key server-side only |
| Alpha | **Ink-only separation** — all white removed, in post, not by the model |
| Likeness | Must read as the athlete in the uploaded photo — via **pose and silhouette**, not just face. **No player names, ever.** |

---

## The four things that will actually break this

**1. Nano Banana does not reliably output alpha. — RESOLVED**
We never ask it for transparency. We ask for the illustration on a **flat pure-white ground, no paper texture**, and key it out ourselves in post. Deterministic and it survives model updates.

**2. Background removal is a luminance key, not an AI matting model. — RESOLVED**
Worth being explicit, because the obvious reach is `rembg` / remove.bg and **they are the wrong tool here.** Those are trained to find photographic subjects against photographic backgrounds; pointed at a flat two-tone graphic they soften the rough screenprint edges and eat the broken contours — the exact texture that carries the whole style.

What we actually need is arithmetic: the output is two-tone by construction, so alpha is a luminance threshold on white. `sharp` does it, it's ~20 lines, it's instant, it's free, and it's pixel-exact. Feathering stays a tuned parameter so the ink edges keep their grit instead of going aliased.

**3. All white comes out. — LOCKED**
Interior carved highlights go transparent along with the ground. This is a true one-colour screenprint separation and it's what the reference sheet actually is. Removes the flood-fill mode entirely — simpler build.

⚠️ One consequence to see before sign-off, not after: on a **dark** background those interior highlights read as dark, so the figure gains detail that isn't in the reference-on-paper version. That's correct behaviour for an ink separation and probably what you want — but the Day 1 contact sheet renders every result on white, mid-grey and dark so the AD sees it rather than discovers it.

**4. The AD prompt has a hardcoded subject. — RESOLVED**
`"rugby player running with ball"` won't survive arbitrary match photos. Two-pass: Gemini vision captions the uploaded photo, that caption fills the `STYLE_ONLY` template's `{subject}` slot.

**Constraint on the caption pass:** it describes **pose, kit, body position, ball placement** and nothing else. It never attempts to identify anyone, and no name ever enters the prompt. That's the brief, and it's also the right call on privacy and on accuracy — a guessed name would drag the model toward a face it invented instead of the face in the photo.

**Likeness comes from the photo, not the words.** The source image goes to the model as image input, so structure and pose carry through directly.

**Face visibility is not a requirement.** Will's correction, and the reference sheet proves it — the bottom-left illustration is a diving player with their face down and hair flying, and it's the strongest image on the sheet. Two of the AD's four references don't depend on the face. What carries recognition in this style is **pose, silhouette, body language, hair, kit and number** — the diving try-scorer reads as that player because of *how they're moving*, not their features.

⚠️ **The real risk is the opposite one: the model inventing a face that isn't in the photo.** If the source has an obscured face and we prompt generically for a "rugby player", Nano Banana will happily supply features from nowhere — and on a player lockup that's actively wrong. So the prompt branches:

| Source | Prompt behaviour |
|---|---|
| Face clearly visible | Retain likeness; weight toward source features |
| Face turned, down, or obscured | **Keep it obscured.** Explicitly instruct no invented facial detail; push motion and silhouette instead |

That branch is set by the vision pass, automatically. It costs nothing and it removes the single most embarrassing failure mode.

**Colour accuracy** comes free: single-ink output means I threshold to a mask and paint the exact preset hex. The model never has to hit `#D82020` itself.

**The Dominic Young lockup confirms the alpha decision.** Red figure sitting over white type on black, with the carved highlights reading through to the background — that only works as a true ink separation. It also tells me the real end use is **name lockups and social tiles**, so the export needs to composite cleanly over type at arbitrary scale. Day 1's contact sheet will include a mock lockup like that one, because it's the actual test.

---

## Preflight — spec

I went through the 13 tagged photos. **The headline finding: your red/orange/green tags don't map to usability the way you'd expect**, and that reshapes what preflight should do.

- `DSC01649` is tagged **red** (busy) — tunnel run, crowd, five other players. But there's an unmistakable dominant hero, and it crops to an excellent source. **Busy ≠ unusable.**
- `DSC01740` is tagged **green** (solo) — one player, clean, but turned away and standing still. Perfectly usable as a silhouette; the weakness is that it's a **static pose**, not that the face is hidden. This style wants motion.
- `DSC02466` (**red**) is the one true reject — six players tangled in a try celebration, no dominant subject.

So "count the people" is the wrong check, and neither is "can we see the face". The right question is **"is there one dominant subject, is their pose readable, and can we crop to them at enough resolution?"**

### ⚠️ The finding that changes the pipeline

`DSC04262` is the realistic gameplay case: 7008×4672.

**Correction to my first estimate.** I eyeballed the athlete at ~13% of frame height. Measured, it's **40%** — I was wrong, and the real numbers are less dramatic than I made out. Actual measurement from the built pipeline:

```
subject in source          1850px
sent uncropped @1024        405px   ← what the model would see
sent cropped  @1280         941px   ← what it sees now
```

So it's a **2.3× detail gain**, not the 8× catastrophe I implied. Worth being accurate about, since it was the headline finding.

### And having now measured all 12, the *reason* for cropping changes

Subject height across the whole set, measured:

```
smallest   DSC04262   40%
median               ~66%
largest    DSC02294   89%   DSC04576  89%
```

**No photo in the set has a subject-size problem.** My "the athlete is tiny in frame" argument was wrong as a general claim — it was drawn from one photo I'd misread.

What the triage *actually* flags is **other players overlapping the subject** — 4 of 12 photos. That, not scale, is the real failure mode in this set.

So crop-to-subject stays mandatory, but its job is **isolating the athlete from surrounding players**, not scaling them up. Same code, same position in the pipeline, honest reason. It also means the Day 2 crop UI matters more than the resolution warning does — the operator's job is separating one body from four, not zooming in.

**Pipeline:**

```
upload → detect subject → crop to subject (+ headroom) → upscale crop to ~1024–1536 → generate
```

The good news: at 7008px wide, that athlete is still ~1400 real pixels tall, so the crop upscales cleanly. The resolution is there — we just have to actually use it. **This one step is probably worth more to output quality than any amount of prompt tuning.**

### Preflight is triage, not a bouncer

Three outcomes, never a bare rejection:

| Verdict | Meaning | UI |
|---|---|---|
| ✅ **Ready** | Dominant subject, readable pose, crop has resolution | Auto-crop shown, proceed |
| ⚠️ **Needs a crop** | Multiple people or subject small — but salvageable | Crop tool opens with a proposed box, user adjusts |
| ❌ **Not suitable** | No dominant subject, figure badly cut off, or too low-res | Say *which* check failed and why |

That last column matters. "This photo won't work" trains staff to distrust the tool. "Two players overlap here — crop to one, or try a different frame" teaches them what to shoot.

### The checks

**Technical floor** (`sharp`, instant, client-side):
- [ ] Type jpg/png/heic/webp · ≤40MB (your test files run to 25MB) · ≥1200px long edge
- [ ] EXIF orientation normalised, metadata stripped

**Vision triage** (one Gemini call, structured JSON + bounding boxes):
- [ ] Person count + **bounding box per person**
- [ ] Dominant subject — largest, most central, sharpest
- [ ] Is a second person overlapping the subject's box? (the real failure mode)
- [ ] **Pose readability** — is the figure cut off at the frame edge, or are limbs ambiguously merged with another player? *This* is the gate
- [ ] Face visibility — **informational only, never a blocker.** Sets the prompt branch above so we don't invent features
- [ ] Subject height as % of frame

**Derived, no extra call:**
- [ ] Proposed crop box, portrait-biased with headroom, snapped to the reference illos' framing
- [ ] **Effective resolution after crop** — if the crop is under ~700px tall it'll upscale to mush; warn here, not after the user has paid for a generation
- [ ] Sharpness (Laplacian variance) measured **on the crop, not the whole frame** — a wide shot is mostly sharp grass

Bounding boxes come back from Gemini natively, so this is one call on the SDK we already have — no second CV model, no extra dependency. Cheap enough to run on every upload.

### Measured results — all 13 photos, run 18 Aug

| Photo | Tag | Verdict | Subject | Face | Motion | Flagged |
|---|---|---|---|---|---|---|
| DSC01649 | 🔴 | Needs crop | 64% | clear | dynamic | 2 players overlapping |
| DSC02466 | 🔴 | — | — | — | — | **503 then quota-blocked; still untested** |
| DSC01782 | 🟠 | Ready | 68% | partial | dynamic | — |
| DSC04105 | 🟠 | Needs crop | 69% | clear | dynamic | 1 player overlapping |
| DSC04262 | 🟠 | Ready | 40% | clear | dynamic | — |
| DSC04923 | 🟠 | Ready | 66% | clear | dynamic | — |
| DSC07264 | 🟠 | Needs crop | 75% | clear | dynamic | 1 player overlapping |
| DSC08347 | 🟠 | Ready | 58% | clear | dynamic | — |
| DSC01740 | 🟢 | Needs crop | 68% | partial | **static** | static pose |
| DSC01965 | 🟢 | Ready | 61% | clear | dynamic | — |
| DSC02294 | 🟢 | Needs crop | 89% | clear | **static** | cut off by frame; static pose |
| DSC04351 | 🟢 | Ready | 55% | clear | dynamic | — |
| DSC04576 | 🟢 | Ready | 89% | clear | dynamic | — |

**Reading it:**
- The tags and the triage disagree productively. `DSC01649` is tagged busy but only needs a crop — as predicted. Two **greens** got flagged, both for static poses.
- **Nothing scored NOT SUITABLE.** Either the set has no genuine rejects, or the triage is too permissive. `DSC02466` — the celebration scrum, my predicted only-true-reject — is precisely the one that failed to run. **That's the outstanding test, and it's the one that matters.**
- Only 2 of 12 had a non-clear face, so the face branch is mostly untested in anger.

### "Some pre-photoshopping might be needed"
Handled by the crop step for 90% of cases. Where it isn't — the flag/cape in `DSC07264`, an opposition player's arm across the subject — the honest answer is that preflight *flags* it and the operator crops or picks another frame. Automated object removal is a v2 conversation, not a 2-day one.

---

## ✅ SAVE STATE — Day 1 complete, 18 Aug

Working end to end. Committed to git.

```
photo → preflight → crop → generate → ink separation → transparent PNG
```

**Proven:** API key on a billing-enabled project · vision triage with
READY / NEEDS CROP / NOT SUITABLE · crop to dominant subject · generation via
`gemini-3.1-flash-image` · ink separation to true alpha · border-frame strip ·
`p88` CLI with triage caching.

**The prompt is `Prompt.md`, close to verbatim.** After drifting through six
variants of my own prose — which lost first the likeness, then the boldness —
we stripped back. `src/prompt.ts` now carries the AD's STYLE_ONLY template,
section B definition and section D negative prompt, plus two mechanical
additions only: a pure white ground (needed to key alpha) and hard isolation
rules (no border, no ground, no motion lines). Nothing else.

**Lesson worth keeping:** every time I wrote my own style prose it got worse.
The AD's spec was already right; the job was delivering it faithfully, not
improving it.

### Open
- Sponsor logos still render legibly. Parked by decision.
- Fine hatching where the reference uses flat masses.
- Rotate the API key before client handover — it arrived via chat.

### Next: Day 2 web app
Next.js + shadcn on Vercel, password-gated, key server-side, crop UI, PNG
export. The whole pipeline ports across unchanged.

---

## Build status — end of Day 1 morning

**Everything except generation is built and proven.** The pipeline is complete and waiting on billing.

| Module | Status |
|---|---|
| `config.ts` | ✅ |
| `gemini.ts` — triage + generate | ✅ triage proven on 12 photos; generate untested (blocked) |
| `crop.ts` — crop to dominant subject | ✅ proven on the hard gameplay shot |
| `matte.ts` — ink separation | ✅ **proven end-to-end, no API needed** |
| `prompt.ts` — 3 variants + face branch | ✅ written, untested against the model |
| `slice-refs.ts` | ✅ 4 style refs cut from the AD's sheet |
| `batch.ts` — full matrix runner | ✅ written, fires the moment billing is on |

### The matte is proven without spending a single API call

Took `ref3-diving-facedown`, flattened it to a solid ground to simulate a model return, then keyed it back:

```
fully opaque (ink)    23.9%
fully clear  (paper)  74.3%
partial (soft edge)    1.7%
```

That's a clean separation with a thin antialiased edge — and composited on black it reads exactly like the Dominic Young lockup, carved highlights showing the background through. **The transparency approach is confirmed working before we generate anything.**

### Ground detection — a real bug the test caught

First implementation used a **fixed** luminance threshold of 218. The reference ground measures 217. Dead on the threshold, so 77% of pixels came out half-transparent — mush.

Second attempt sampled the **border**. Also wrong: any padding, vignette or second light tone and it locks onto the wrong one. It picked up my own 241 padding while the illustration ground was 217, and 59% went partial.

Working version takes the **dominant bright mode of the luminance histogram**. The ground is always the most *common* bright value, whatever tone it happens to be. Robust to off-white paper, vignettes and padding alike.

This matters beyond the test: the AD's spec explicitly asks for *"warm off-white paper ground"*, and the style references carry a grey ground. **The model may well ignore our pure-white instruction and return off-white** — with a fixed threshold that produces garbage, and it would have looked like the prompt failing rather than the matte failing.

---

## Day 1 — CLI proof of concept
> Goal: prove the generation is good enough, and get AD sign-off on one prompt variant. No UI.

### Morning — get pixels out of the API
- [ ] Scaffold `/generator` — Node + TS, `.env` for `GOOGLE_API_KEY`, `.gitignore` first commit
- [ ] Wire `@google/genai`, confirm auth + quota with a throwaway generation
- [ ] `prompt.ts` — AD's spec as a **versioned** template (`v1`, `v2`…) so we can diff variants, plus the negative prompt
- [ ] Pass 1: vision triage + caption — one structured call returning bounding boxes, face visibility, and a subject description (pose/kit/action only, **no identity, no names**)
- [ ] **`crop.ts` — crop to dominant subject + headroom, upscale to ~1024–1536.** Non-negotiable, see Preflight spec
- [ ] Pass 2: image gen — caption + style template + **cropped** source
- [ ] **Style reference few-shot**: slice `Reference/illustrations.png` into 4 individual PNGs and pass them as reference images alongside the photo. This is the single biggest lever on style fidelity — bigger than prompt wording.

### Afternoon — post-process + the review artefact
- [ ] `preflight.ts` — full spec above (technical floor + vision triage + crop proposal), emitting Ready / Needs-crop / Not-suitable
- [ ] `matte.ts` (sharp): luminance-key white → alpha, **tunable threshold + edge feather** so rough ink edges keep their grit, despeckle, trim to bounds
- [ ] `recolour.ts`: mask → exact preset hex
- [ ] `batch.ts`: 13 test photos × M variants → **contact sheet PNG**, each result on white / mid-grey / dark, plus a **mock name-lockup** in the Dominic Young layout. Filenames encode variant + settings
- [ ] Run the batch, review, tune, re-run
- [ ] **Validate preflight against Will's tags** — does the triage agree with red/orange/green, and where it disagrees, is it right? (I think it will be, on at least three of them)

### 🚦 End of Day 1 gate — must clear before any UI work
- [ ] AD picks the winning prompt variant
- [ ] AD signs off on how the transparent version reads on dark backgrounds
- [ ] **Likeness holds** — the athlete is recognisable as the person in the source photo
- [ ] Style holds across the **orange and red** photos, not just the greens
- [ ] Preflight triage agrees with human judgement on the 13-photo set
- [ ] Known cost per generation and rough failure rate

If the style doesn't hold, Day 2 becomes more prompt work and the web app slips. That's the honest risk and it's why the gate exists.

---

## Day 2 — Web app
> Goal: deployed, password-protected URL the club can use. Generic UI library, no custom design work.

### Morning — the app
- [ ] `create-next-app` + Tailwind + shadcn/ui (generic, fast, responsive out of the box)
- [ ] Password gate (middleware, single shared secret in env)
- [ ] `/api/generate` route — **all** Gemini calls server-side, key never reaches the browser
- [ ] Upload: drag-drop + mobile camera capture (`capture="environment"` — staff will shoot on phones from the sideline)
- [ ] Preflight runs client-side first (instant feedback), re-validated server-side (trust nothing)
- [ ] **Crop UI** — proposed box pre-drawn over the photo, user drags to adjust. This is the one piece of real interaction in the app and it carries the output quality, so it gets the time
- [ ] Port Day 1 pipeline into the route unchanged

### Afternoon — output, polish, ship
- [ ] Progress states — generation is 10–30s, so a real progress indicator, not a spinner with no story
- [ ] Result preview **on a checkerboard** so alpha is visible, plus a dark-background toggle to sanity-check the cut-out
- [ ] ~~Colour preset picker~~ — **fixed red for the PoC.** One constant in config; presets are a later add
- [ ] "Generate again" for a second roll (models vary; one-shot will frustrate)
- [ ] PNG download, sensible filename
- [ ] Responsive pass: mobile / tablet / desktop
- [ ] Deploy to Vercel, smoke test on a real phone
- [ ] Handover note: how to change the prompt, add a colour, rotate the key, what it costs

### Explicitly out of scope for 2 days
Accounts, generation history, batch upload, print-res / vectorising, public access, moderation. All are additive later — none require a rewrite if the pipeline is built as above.

---

## What I need from you

**Blocking — Day 1 morning:**
1. ~~`GOOGLE_API_KEY`~~ — ✅ done, `generator/.env` created and gitignored. **Rotate this key before handover** (see Housekeeping).
2. ~~6–10 real gameplay photos~~ — ✅ **13 received** in `example images/`, tagged red/orange/green. Good spread and genuinely useful; my read on each is in `example images/TIERS.md`.

**Blocking — Day 2:**
*(nothing outstanding)*
3. ~~Club colour hex codes~~ — ✅ not needed. Fixed `#D82020` for the concept.

**Helpful, not blocking:**
4. Any **source photo → finished illustration pair** the AD already produced by hand. One pair is worth more than another page of prompt notes — it tells me exactly how much the AD abstracts from the original.
5. Are the 4 reference illustrations available as **separate files**? Slicing the contact sheet works, but originals are cleaner as few-shot inputs.
6. Confirm the sport codes in scope — the AD's prompt is rugby-league-specific, and union/AFL/netball kit differs enough to matter if this gets reused across the club.

---

## Housekeeping

- [ ] **Rotate the API key before handover.** It came through a chat transcript, so treat it as burned for production. Fine for a 2-day PoC, not fine for the client's live deployment — regenerate at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) when we deploy.
- [ ] Set a **billing cap / quota alert** on the Google project before the club touches it.
- [x] ~~Verify the key~~ — done. It authenticates (the `AQ.` prefix is fine).

### ✅ RESOLVED 18 Aug — new key on a billing-enabled project works

Full pipeline ran end to end in 18.7s. First real output produced. Setup steps that fixed it are in `API-KEY-SETUP.md`.

**First results, `DSC04576` (green):**

| | v2_styleonly | v3_reffirst (style refs attached) |
|---|---|---|
| Alpha separation | ✅ clean | ✅ clean |
| Ground detected | 255 (pure white — model obeyed) | 255 |
| Pose + likeness | ✅ held | ✅ held |
| Sponsor text | ❌ "nib" / "JIM BEAM" legible | ✅ abstracted away |
| Flat masses | too much fine linework | ✅ closer to reference |
| **Rough ink edges** | ❌ too smooth | ❌ still too smooth |

**v3_reffirst is clearly ahead** — attaching the AD's own illustrations as style inputs fixed the sponsor-text leak and simplified the masses, exactly as predicted.

**The remaining gap is texture.** Both variants produce a clean vector-like trace. The reference's broken, ragged, screenprinted ink edge — the thing that makes it look handmade — is not coming through. That is the Day 1 tuning job, and it is a prompt/reference problem, not a pipeline problem.

Ideas to test, in order of expected payoff:
1. More style refs, and crops of *edges* specifically so the model sees the ink quality up close
2. Push texture words harder and drop competing "clean/bold contour" language
3. Compare `pro3` (`gemini-3-pro-image`) — may hold texture better than flash
4. If the model won't produce grit, add it in post: erode/roughen the alpha edge in `matte.ts`

### 🔴 ~~BLOCKER — billing must be enabled~~ (historical)

Measured on this key, 18 Aug:

| | Free-tier limit |
|---|---|
| Image models (all 6) | **0 requests** — hard zero, not a daily allowance |
| `gemini-3.6-flash` vision | **20 requests/day** — exhausted after the 13-photo triage |

Image generation on the Gemini API requires a **billing-enabled** Google Cloud project. This is the gate on the entire project — not just image gen; the 20/day vision cap means we can't even re-run preflight today.

- [ ] **Enable billing** on the project behind this key → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- [ ] Set a spend cap immediately after. Full matrix (13 photos × 3 variants) is under $2 at ~$0.04/image, so the cap is protection, not budgeting.

### Model availability, measured
- `gemini-2.5-flash` — **dead for new keys** ("no longer available to new users"). Vision pass switched to `gemini-3.6-flash`.
- Image models on this key: `gemini-2.5-flash-image`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`, `gemini-3-pro-image`, `gemini-3-pro-image-preview`, `nano-banana-pro-preview`. More than planned — the batch runner can compare flash vs pro once billing is live.
- The `/models` listing is **not** a reliable guide to access; several listed models 404 on call. Probe, don't trust the list.

---

## Open questions for you
- **Is this fan-facing eventually?** Changes nothing on Day 2, but if public access is coming in v2 I'd put the rate-limit hooks in now rather than retrofit them.
- **Is the flag/cape in `DSC07264` part of the illustration or dropped?** Small question, but the kind of thing the AD should rule on once rather than per-image.
- **Expected volume?** 20 images a week and 2,000 a week are the same build but very different quota conversations.
- **Photos of minors / junior grades?** If juniors are in scope that's a consent question for the club before the tool ships, not a technical one — worth raising with them early.
