import type { Triage } from "./gemini.js";

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
  "Do NOT add paper texture, grain or vignette. " +
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
      `Do the same with fine surface detail — shoe branding, stitching, fabric print, small patterns: ` +
      `simplify all of it into solid shapes. No legible text or recognisable logo anywhere in the image.`,

    GROUND,

    `Avoid: ${NEGATIVE}.`,
  ].join("\n\n");
}
