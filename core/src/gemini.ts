import { GoogleGenAI, Type } from "@google/genai";
import { apiKey, VISION_MODEL, IMAGE_MODELS, type ImageModelKey } from "./config";

let _ai: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: apiKey() });
  return _ai;
}

export type Box = { ymin: number; xmin: number; ymax: number; xmax: number };
export type Person = {
  box: Box;
  role: "dominant" | "secondary";
  overlapsDominant: boolean;
};
export type Triage = {
  people: Person[];
  /** Tight box around the dominant athlete's head, same 0-1000 convention. */
  faceBox?: Box | null;
  faceVisibility: "clear" | "partial" | "obscured";
  poseReadable: boolean;
  figureCutOff: boolean;
  motion: "dynamic" | "static";
  subject: string;
  notes: string;
};

/**
 * Gemini returns boxes as [ymin, xmin, ymax, xmax] normalised 0-1000.
 * We keep that convention all the way through and only convert in crop.ts.
 */
const triageSchema = {
  type: Type.OBJECT,
  properties: {
    people: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          box: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "[ymin, xmin, ymax, xmax] normalised 0-1000",
          },
          role: { type: Type.STRING, enum: ["dominant", "secondary"] },
          overlapsDominant: { type: Type.BOOLEAN },
        },
        required: ["box", "role", "overlapsDominant"],
      },
    },
    faceBox: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "[ymin,xmin,ymax,xmax] 0-1000 around the dominant athlete's head. Empty array if not visible.",
    },
    faceVisibility: { type: Type.STRING, enum: ["clear", "partial", "obscured"] },
    poseReadable: { type: Type.BOOLEAN },
    figureCutOff: { type: Type.BOOLEAN },
    motion: { type: Type.STRING, enum: ["dynamic", "static"] },
    subject: { type: Type.STRING },
    notes: { type: Type.STRING },
  },
  required: ["people", "faceBox", "faceVisibility", "poseReadable", "figureCutOff", "motion", "subject", "notes"],
};

const TRIAGE_PROMPT = `You are a preflight assistant for a sports illustration tool. Analyse this photograph.

Return:
- people: every person clearly visible in the foreground (ignore blurred crowd). Exactly ONE must have role "dominant" — the primary athlete: largest, most central, sharpest, the subject of the photo. Set overlapsDominant true for any secondary person whose body overlaps or touches the dominant athlete's bounding box.
- faceBox: a tight bounding box around the dominant athlete's HEAD only (hair to chin). Empty array if the head is not visible.
- faceVisibility: "clear" if the face is toward camera, "partial" if angled or half-turned, "obscured" if turned away, looking down, or hidden.
- poseReadable: true if the dominant athlete's pose and limbs are clearly legible and not ambiguously merged with another player.
- figureCutOff: true if the dominant athlete is significantly cut off by the frame edge.
- motion: "dynamic" if running, jumping, diving, twisting, mid-action. "static" if standing, walking, posing.
- subject: ONE sentence describing the dominant athlete for an illustrator. Describe ONLY pose, body position, limb placement, ball position, kit and any headgear.
  CRITICAL: never name or attempt to identify the person. Never mention their face, features, ethnicity, or likeness. Never guess who they are.
  Write it as a physical action description, e.g. "an athlete diving forward horizontally, arm extended to ground the ball, legs trailing behind".
- notes: anything an operator should know (props such as flags or capes, heavy motion blur, obstructions).`;

export async function triage(imgB64: string, mime = "image/jpeg"): Promise<Triage> {
  const res = await client().models.generateContent({
    model: VISION_MODEL,
    contents: [{ role: "user", parts: [
      { inlineData: { mimeType: mime, data: imgB64 } },
      { text: TRIAGE_PROMPT },
    ]}],
    config: { responseMimeType: "application/json", responseSchema: triageSchema, temperature: 0 },
  });
  const raw = JSON.parse(res.text ?? "{}");
  const fb = Array.isArray(raw.faceBox) && raw.faceBox.length === 4 ? raw.faceBox : null;
  return {
    ...raw,
    faceBox: fb ? { ymin: fb[0], xmin: fb[1], ymax: fb[2], xmax: fb[3] } : null,
    people: (raw.people ?? []).map((p: any) => ({
      box: { ymin: p.box[0], xmin: p.box[1], ymax: p.box[2], xmax: p.box[3] },
      role: p.role,
      overlapsDominant: p.overlapsDominant,
    })),
  };
}

/** Returns PNG/JPEG bytes of the first image part, or null if the model returned none. */
export async function generateImage(
  modelKey: ImageModelKey,
  prompt: string,
  images: { b64: string; mime: string }[],
): Promise<Buffer | null> {
  const res = await client().models.generateContent({
    model: IMAGE_MODELS[modelKey],
    contents: [{ role: "user", parts: [
      ...images.map((i) => ({ inlineData: { mimeType: i.mime, data: i.b64 } })),
      { text: prompt },
    ]}],
  });
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) return Buffer.from(p.inlineData.data, "base64");
  }
  return null;
}
