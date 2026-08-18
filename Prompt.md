{
  "subject": "A red single-colour illustration of a rugby player in motion, holding a ball under one arm while extending the opposite arm outward in a fend or directional gesture.",
  "medium": "Screenprint-like digital or hand-rendered ink illustration. Evidence includes uneven red pigment fill, rough edge breakup, visible mark texture, simplified negative-space highlights, and flat colour application on an off-white ground.",
  "style_movements": ["screenprint sports illustration", "linocut-inspired graphic art", "retro athletic poster design", "minimal editorial illustration"],
  "composition": "Portrait-oriented figure study with the athlete positioned diagonally through the frame. The extended left arm creates a strong horizontal lead, while the bent running legs create a secondary diagonal. The ball and torso form the visual mass, with generous off-white negative space around the figure.",
  "lighting": "No naturalistic lighting. Volume is implied through white negative-space cuts and red ink density rather than shadow modelling. The image relies on graphic contrast, not illumination.",
  "palette": {
    "hex": ["#D82020", "#F5F0E8", "#B51618", "#FFFFFF"],
    "harmony": "two-tone monochrome with high figure-ground contrast",
    "notes": "The saturated red carries all line, shadow and form information, while the warm off-white background gives it a printed-paper feel."
  },
  "texture": "Rough ink edges, imperfect fill, brushy screenprint grain, broken contour lines, simplified anatomical shapes and carved-out highlights. Texture is central to the character of the image.",
  "mood": "Energetic, bold, athletic, direct and nostalgic, with a handmade sports-club poster quality.",
  "era_signals": "Mid-century sports poster influence, vintage match-day programme graphics, screenprinted merchandise language, simplified community-club identity design.",
  "confidence": "high",
  "uncertainties": ["The exact sport code is inferred from the ball shape, headgear and pose.", "The original may be digitally simulated rather than physically screenprinted."]
}


B. Style Definition (prose, ≤120 words)
A bold one-colour sports illustration style built from rough ink marks, carved negative space and simplified athletic anatomy. The figure is reduced to essential motion lines, heavy contour, flat colour blocks and broken highlights, creating a handmade screenprint or linocut feel. Detail is selective: face, uniform folds, limbs and equipment are described with quick graphic strokes rather than realism. The composition favours strong silhouettes, diagonal movement and open negative space. Colour is highly restricted, usually one saturated ink tone against warm paper. The result feels energetic, accessible and emblematic, like a vintage community sports poster or club merchandise graphic.
C. Diffusion Prompts
UNIVERSAL
rugby player running with ball, single-colour red ink illustration, screenprint sports poster, linocut-inspired marks, rough contour lines, carved white highlights, diagonal athletic pose, off-white paper background, bold negative space, handmade texture, vintage community club graphic
NATURAL
Create a bold one-colour red illustration of a rugby player running with the ball, using a rough screenprint and linocut-inspired sports poster style. Keep the figure dynamic and diagonal, with simplified anatomy, broken ink edges, carved white highlights and minimal detail. Use a warm off-white paper background, strong negative space and a handmade community-club graphic feel.
STYLE_ONLY
Render {subject} as a single-colour screenprint-style illustration with rough ink edges, bold contour lines, carved negative-space highlights, simplified forms, dynamic diagonal composition, minimal detail, warm off-white paper ground and a vintage community sports poster finish.
D. Negative Prompt
photorealism, full colour rendering, smooth vector polish, gradients, airbrush shading, realistic skin, detailed facial features, glossy 3D, complex background, soft lighting, thin clean outlines, perfect symmetry, text, watermark

---

E. Art Director Amendments
(18 Aug — added after first review round. Keep this file and
generator/src/prompt.ts in sync.)

SOLID FILL, NO LOGOS — BUT KEEP THE JERSEY PATTERN
Sponsor logos, brand marks, jersey lettering, numbers, badges and small
printed details must NOT be drawn or reproduced. Fill those areas with solid
flat ink instead, as a plain block. The same applies to fine surface detail —
shoe branding, stitching, fabric print.

CRITICAL EXCEPTION: the jersey's own stripe and panel pattern MUST be kept.
The vertical stripes, hoops, chevrons and colour-block panels of the kit are
club identity and are the most recognisable thing about it. Draw them as bold
flat shapes, following the body and the folds. Never flood the jersey with one
unbroken block of ink, and never cover the stripes with a logo fill. Remove the
printing on the jersey; keep the jersey.

STENCIL INVERSION (for dark backgrounds)
Deliverable only, not a prompt instruction. The illustration is a one-colour
ink separation; on dark backgrounds it can also be exported inverted, the way
a stencil artist cuts a plate — ink and carved-out areas swapping, so the
figure reads light-on-dark. Handled in export, not by the model.


INK ROUGHNESS (added after round 3 — the output drifted smooth)
The roughness is the whole character of the style and must not be lost to the
other rules. Every contour and every edge of every flat shape is hand-cut and
hand-printed: ragged, broken, uneven, wobbling in thickness, occasionally
skipping or breaking away entirely. Nothing is smooth, even, tapered or
vector-like. This applies to the jersey stripes and panels too — they are bold
flat shapes, but their edges are cut by hand, not drawn with a ruler.
