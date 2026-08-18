import type { Triage } from "./gemini";

/**
 * The art director's prompt, from Prompt.md. That file is the source of truth.
 *
 * Only two things are added, and both are mechanical necessities rather than
 * creative choices:
 *
 *  1. A pure white ground replaces Prompt.md's "warm off-white paper ground".
 *     We key the ground out to alpha after generation, and off-white keys
 *     unreliably. The deliverable is a transparent cut-out, so the paper feel
 *     could not survive anyway.
 *
 *  2. The subject line is filled from the vision pass, since Prompt.md's
 *     STYLE_ONLY template has an explicit {subject} slot and the hardcoded
 *     "rugby player running with ball" does not survive arbitrary photos.
 *
 * Nothing else is invented here. If the style needs to change, change
 * Prompt.md and this follows.
 */

/** Prompt.md § D — negative prompt, verbatim. */
const NEGATIVE =
  "photorealism, full colour rendering, smooth vector polish, gradients, airbrush shading, " +
  "realistic skin, detailed facial features, glossy 3D, complex background, soft lighting, " +
  "thin clean outlines, perfect symmetry, text, watermark";

/**
 * Mechanical: the deliverable is an isolated transparent cut-out, so the
 * output must contain the athlete and nothing else.
 *
 * "no border" was already stated and the model drew a frame anyway, so this is
 * deliberately blunt and repeated. `stripBorderFrame` in matte.ts is the
 * safety net for when it ignores this again.
 */
const GROUND =
  "OUTPUT THE ISOLATED FIGURE ONLY, on a completely flat pure white (#FFFFFF) background. " +
  "Do NOT draw a border, frame, outline box, rule or edge of any kind around the image. " +
  "Do NOT draw the ground, grass, turf, a baseline, a shadow, or anything beneath the feet. " +
  "Do NOT add motion lines, speed lines, speckles, splatter or decorative marks around the figure. " +
  "Do NOT add paper texture, grain, vignette or speckle to the BACKGROUND — the ink itself is grainy " +
  "(see below), but the empty space around the figure stays perfectly clean and flat. " +
  "Nothing at all may touch or approach the edges of the canvas — only the athlete, floating in empty white space.";

export function buildPrompt(t: Triage): string {
  return [
    // Prompt.md § C — STYLE_ONLY, with {subject} filled from the photo.
    `Render ${t.subject} as a single-colour red screenprint-style illustration with rough ink edges, ` +
      `bold contour lines, carved negative-space highlights, simplified forms, dynamic diagonal composition, ` +
      `minimal detail and a vintage community sports poster finish.`,

    // Prompt.md § B — style definition, verbatim.
    `A bold one-colour sports illustration style built from rough ink marks, carved negative space and ` +
      `simplified athletic anatomy. The figure is reduced to essential motion lines, heavy contour, flat ` +
      `colour blocks and broken highlights, creating a handmade screenprint or linocut feel. Detail is ` +
      `selective: face, uniform folds, limbs and equipment are described with quick graphic strokes rather ` +
      `than realism. The composition favours strong silhouettes, diagonal movement and open negative space. ` +
      `Colour is highly restricted: one saturated ink tone.`,

    `Redraw the athlete in the supplied photograph. Keep their pose exactly as photographed.`,

    // Prompt.md § E — art director amendment, 18 Aug.
    `SOLID FILL, NO LOGOS: do not draw or reproduce sponsor logos, brand marks, jersey lettering, numbers, ` +
      `badges or small printed details. Fill those areas with solid flat ink as a plain block instead. ` +
      `Do the same with fine surface detail — shoe branding, stitching, fabric print. ` +
      `No legible text or recognisable logo anywhere in the image.`,

    // The above overshot on first use and flooded the jersey, losing the club
    // stripes. They are the most recognisable thing about the kit.
    `KEEP THE JERSEY PATTERN: the kit's own stripe and panel design must be preserved. ` +
      `Draw the vertical stripes, hoops, chevrons and colour-block panels as bold flat shapes that follow the ` +
      `body and its folds. NEVER flood the jersey with one unbroken block of ink and never let a logo fill ` +
      `cover the stripes. Remove the printing on the jersey; keep the jersey. ` +
      `The stripes are bold flat shapes, but their edges are cut by hand — ragged, not ruled.`,

    GROUND,

    `Avoid: ${NEGATIVE}.`,

    // Prompt.md § E — INK ROUGHNESS (round 4). Placed last deliberately: every
    // other rule pulls the output toward careful, and careful reads as smooth.
    `INK ROUGHNESS — THIS OUTRANKS EVERY RULE ABOVE. The roughness is the whole character of the ` +
      `style and must not be lost to the other instructions. Every contour and every edge of every flat ` +
      `shape is hand-cut and hand-printed: ragged, broken, uneven, wobbling in thickness, occasionally ` +
      `skipping or breaking away entirely. Nothing is smooth, even, tapered or vector-like. This applies ` +
      `to the jersey stripes and panels too — bold flat shapes, but cut by hand, not drawn with a ruler.`,

    // Prompt.md § E — CUT, NOT DRAWN (round 5). The AD read the output as
    // "cartoony": smooth outlines, even weight, illustrative polish.
    `CUT, NOT DRAWN. Cartoon is the failure mode: smooth confident outlines, even line weight, tidy ` +
      `shapes, clean tapers, illustrative polish. This is NOT a drawing. It is a stencil plate cut with a ` +
      `blade and pulled through a screen, and every mark must show it.`,

    `CUT EDGES: shapes are cut, not drawn — hard, faceted, slightly angular, as though sliced from card ` +
      `with a scalpel. Nicked, over-cut at the corners, wandering off the true line, squared off where the ` +
      `blade changed direction. Contours break, skip and pick up again out of register.`,

    `INK GRAIN: the fill is NOT solid. It is starved and uneven — mottled, pitted, speckled and patchy, ` +
      `heavier where the ink pooled, thinning to broken specks where the screen ran dry. This breakup sits ` +
      `INSIDE the ink areas, as light flecks, pinholes and dry-brush gaps carved out of the red.`,

    `DISTORTED AND ERODED: edges are chewed and degraded, as though the plate is worn and this is a late ` +
      `pull from a long run — slight misregistration, ragged bite, small fragments detached and floating ` +
      `free of the main shape. Keep all of this texture in the ink; the background stays perfectly clean.`,

    // Prompt.md § E — corrective. The roughness block above, given last word,
    // flooded the jersey and lost the club stripes (the round 3 failure).
    `STRIPES SURVIVE THE GRAIN — FINAL RULE. None of the roughness above is licence to flood the jersey. ` +
      `Grain, starved fill and cut edges apply WITHIN each stripe and panel, never across them. The kit's ` +
      `stripe pattern must stay legible as bold flat shapes with clear light gaps between them — hand-cut ` +
      `and grainy, but unmistakably striped. If roughness and the stripe pattern conflict, THE STRIPES WIN.`,
  ].join("\n\n");
}
