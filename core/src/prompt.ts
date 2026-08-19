import type { Triage } from "./gemini";

/**
 * The art director's prompt, from `Prompt V2.md`. That file is the source of
 * truth. `Prompt.md` is the superseded v1 and is kept only for history.
 *
 * V2 is not a tweak — it reverses three rules the v1 build had hardened:
 *
 *  - Logos and lettering are now PRESERVED. V1 § E said "SOLID FILL, NO LOGOS"
 *    and filled them with flat ink. V2 makes the Knights crest a priority
 *    identity element.
 *  - "Cut" is explicitly NOT geometric. V1 rounds 4-5 pushed scalpel-cut,
 *    faceted, angular edges. V2 § E says do not interpret cut that way — the
 *    construction is organic and hand-inked first, screenprinted second.
 *  - Facial likeness must survive with selective internal detail. V1's negative
 *    prompt listed "detailed facial features" as something to avoid.
 *
 * Two things are still added here, and both are mechanical rather than
 * creative:
 *
 *  1. A pure white ground replaces V2's "warm off-white ground" (#F5F0E8).
 *     We key the ground out to alpha after generation and off-white keys
 *     unreliably. V2 § E "THE BACKGROUND STAYS CLEAN" explicitly asks for a
 *     result suitable for clean luminance keying, so this serves the brief.
 *
 *  2. The subject line is filled from the vision pass, since § C's STYLE_ONLY
 *     template has an explicit {subject} slot.
 *
 * One conditional was added to serve V2's own priority order: when the vision
 * pass reports the face as obscured, we tell the model not to invent one.
 * V2 § A lists as an uncertainty that detail "should only be reproduced when
 * genuinely visible in the source image", and demanding facial landmarks from
 * a turned-away head is how a face gets invented.
 *
 * Nothing else is invented. If the style needs to change, change
 * `Prompt V2.md` and this follows.
 */

/** Prompt V2.md § D — negative prompt, verbatim. */
const NEGATIVE =
  "generic face, altered identity, redrawn identity, caricature, cartoon face, comic-book face, " +
  "exaggerated expression, enlarged eyes, simplified doll-like features, beautification, facial smoothing, " +
  "changed age, changed hairstyle, changed body proportions, changed pose, invented action, invented equipment, " +
  "omitted logos, replaced logos, fake sponsor names, garbled lettering, redesigned club crest, " +
  "missing jersey pattern, photorealism, full-colour rendering, gradients, airbrush shading, glossy 3D, " +
  "smooth vector polish, geometric stencil shapes, ruler-straight edges, perfect curves, uniform line weight, " +
  "clean digital tapers, clip-art appearance, generic distress overlay, texture in the empty background, " +
  "complex background, watermark";

/**
 * Mechanical: the deliverable is an isolated transparent cut-out, so the
 * output must contain the athlete and nothing else. This carries V2 § E
 * "THE BACKGROUND STAYS CLEAN" plus the isolation requirement.
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
  "All grain, speckling, broken ink and surface variation belongs INSIDE the printed figure, its internal " +
  "marks and its outer edges. Do NOT add paper grain, floating distress, ink splatter or background dirt — " +
  "the surrounding space stays perfectly clean and unmarked so the figure keys cleanly to transparency. " +
  "Generate the artwork as a standard one-colour ink separation on this clean light ground. Do NOT produce " +
  "a light-on-dark or inverted image; inversion is an export treatment applied later. " +
  "Nothing at all may touch or approach the edges of the canvas — only the athlete, floating in empty white space.";

export function buildPrompt(t: Triage): string {
  const faceHidden = t.faceVisibility === "obscured";

  return [
    // § C — STYLE_ONLY, with {subject} filled from the photo.
    `Render ${t.subject} as a one-colour, observational hand-inked sports illustration with an imperfect ` +
      `screenprint finish. Preserve the exact identity, facial likeness, expression, anatomy, pose, action, ` +
      `clothing, equipment and visible insignia of the reference. Use organic pressure-sensitive linework, ` +
      `subtly wobbling contours, broken line endings, flat ink masses, selective facial detail, carved ` +
      `negative-space highlights and uneven dry ink fill. Avoid mechanically straight lines, geometric ` +
      `stencil construction, cartoon features and smooth vector polish.`,

    // § B — style definition, verbatim.
    `A one-colour sports illustration style combining observational hand-inked drawing with the imperfect ` +
      `finish of a physical screenprint. The supplied photograph controls the player's identity, expression, ` +
      `pose, action, uniform and composition. Organic, pressure-sensitive ink marks describe anatomy, fabric ` +
      `and movement without becoming cartoon-like. Facial likeness is retained through accurate proportions, ` +
      `distinctive landmarks, natural asymmetry and selective internal detail, all expressed through flat ink ` +
      `and negative space. Contours are irregular, broken and human, with no mechanically straight or ` +
      `vector-clean edges. Ink fill is uneven, grainy and occasionally starved. Jersey patterns, sponsor marks ` +
      `and club crests remain recognisable. The result feels handmade, athletic and specific to the ` +
      `photographed player.`,

    // § E — SOURCE IMAGE IS THE AUTHORITY.
    `SOURCE IMAGE IS THE AUTHORITY. This is a universal image-to-image treatment. Do NOT impose a running ` +
      `pose, ball-carrying action, fend, celebration or any other predetermined sporting gesture. Preserve the ` +
      `exact action, posture, expression, framing, crop, camera angle and equipment visible in the supplied ` +
      `photograph. The style may transform HOW the player is rendered, but it must not transform WHO the ` +
      `player is or WHAT they are doing.`,

    // § E — HAND-INKED FIRST, SCREENPRINTED SECOND.
    `HAND-INKED FIRST, SCREENPRINTED SECOND. The illustration should feel as though an artist carefully ` +
      `observed the photograph and described it using expressive ink, before the artwork was transferred to a ` +
      `screen and printed imperfectly. Do NOT interpret "cut" as rigid, geometric, angular or faceted. Shapes ` +
      `can have decisive edges, but their construction must remain organic and responsive to anatomy, fabric, ` +
      `movement and likeness. The finish combines, in this order: observational hand-inked drawing; simplified ` +
      `one-colour shape construction; imperfect physical screenprint reproduction. The screenprint texture ` +
      `must NEVER replace the quality of the underlying drawing.`,

    // § E — ORGANIC LINEWORK.
    `ORGANIC LINEWORK. No contour should feel mechanically generated. Lines must vary naturally in thickness ` +
      `and pressure — swelling, thinning, hesitating, overlapping, tapering irregularly, breaking and resuming. ` +
      `Use naturally wobbling contours, imperfect joins, broken or dry line endings, small changes in pressure, ` +
      `occasional ink pooling, slightly frayed edges, expressive internal marks and irregular but intentional ` +
      `negative-space cuts. Nominally straight elements such as jersey stripes, seams and logo edges must stay ` +
      `recognisable but carry slight hand movement — never ruler-straight, geometrically perfect or ` +
      `vector-clean. Avoid random scribbling: every mark should describe identity, anatomy, fabric, action or light.`,

    // § E — FACIAL IDENTITY MUST SURVIVE. The vision pass decides which branch
    // applies; demanding landmarks from a turned-away head invents a face.
    faceHidden
      ? `FACE TURNED AWAY IN THE SOURCE. The face is obscured, turned away or looking down in the supplied ` +
          `photograph. Keep it that way. Do NOT invent facial features, do NOT turn the head toward camera and ` +
          `do NOT supply eyes, nose or mouth that are not visible in the reference. Likeness here comes from ` +
          `head shape, hairline and hairstyle, ears, facial hair, neck and shoulder line, body proportions and ` +
          `the exact posture — describe those precisely instead.`
      : `FACIAL IDENTITY MUST SURVIVE. The face must remain recognisable as the exact person in the reference ` +
          `photograph. Do NOT replace it with a generic illustrated athlete or a cartoon approximation. ` +
          `Preserve overall head and face shape, eye placement and spacing, brow shape, nose length, width and ` +
          `profile, mouth shape, jawline and cheek structure, hairline and hairstyle, ears, facial hair, age, ` +
          `expression, natural asymmetries and any clearly visible identifying features. Translate these into ` +
          `selective flat ink marks and negative space — enough internal facial information to hold the ` +
          `likeness, but no realistic colour, gradients or conventional portrait shading. Facial simplification ` +
          `must be selective, not generic. If stylistic simplification and likeness conflict, LIKENESS WINS.`,

    // § E — PRESERVE ALL VISIBLE LOGOS AND LETTERING.
    // This reverses v1's "SOLID FILL, NO LOGOS" outright.
    `PRESERVE ALL VISIBLE LOGOS AND LETTERING. Do NOT remove sponsor logos, brand marks, jersey lettering, ` +
      `player numbers, badges or club insignia. The Newcastle Knights crest is a priority identity element and ` +
      `must remain in its correct location, shape, proportion and orientation wherever it is visible in the ` +
      `reference. Use the reference itself as the source — do NOT invent, rename, approximate or replace a ` +
      `sponsor or crest from memory. Translate logos and lettering into the same single-colour ink treatment ` +
      `while retaining their recognisable structure. Small marks may be simplified ONLY where the source does ` +
      `not contain enough visible information to reproduce them accurately.`,

    // § E — KEEP THE JERSEY CONSTRUCTION.
    `KEEP THE JERSEY CONSTRUCTION. Preserve the jersey's stripes, hoops, chevrons, panels, collar, sleeves and ` +
      `major colour-block structure. Translate different source colours into distinct ink shapes, ` +
      `negative-space gaps or patterns of ink density while staying within the single-colour system. Do NOT ` +
      `flood the jersey into one undifferentiated block — its construction, club pattern, logos and crest must ` +
      `remain readable. All jersey elements follow the player's body, perspective, fabric tension and folds.`,

    // § E — IMPERFECT INK, NOT A DISTRESS FILTER.
    `IMPERFECT INK, NOT A DISTRESS FILTER. Ink coverage is uneven, slightly starved and physically varied: ` +
      `mottling, pinholes, dry-brush gaps, small flecks, and heavier areas where pigment appears to pool. The ` +
      `breakup must feel specific to the individual marks and shapes — do NOT apply a uniform noise texture ` +
      `across the whole illustration. Texture reinforces the direction and pressure of the hand-inked marks ` +
      `rather than sitting over them as a digital effect.`,

    // § A palette — one saturated ink, tonal variation from density only.
    `Use ONE dominant saturated ink colour for all contour, shadow, facial information, uniform detail and ` +
      `logos, against the clean light ground as negative space. Any apparent tonal variation must come from ` +
      `ink density, grain, broken marks or exposed ground — never from additional colours or gradients.`,

    GROUND,

    `Avoid: ${NEGATIVE}.`,

    // § E — FINAL PRIORITY ORDER. Last, because the model weights the closing
    // instruction heavily and this is the AD's own tie-breaker.
    `FINAL PRIORITY ORDER — when instructions compete, resolve in this order: ` +
      `1. Preserve the exact player's identity and facial likeness. ` +
      `2. Preserve the source pose, action, expression and composition. ` +
      `3. Preserve the uniform structure, sponsor marks and club crest. ` +
      `4. Maintain organic, observational hand-inked linework. ` +
      `5. Translate the image into a single-colour flat ink system. ` +
      `6. Apply imperfect screenprint grain within the ink. ` +
      `7. Keep the surrounding background completely clean.`,
  ].join("\n\n");
}
