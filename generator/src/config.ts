import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the generator root, not the caller's cwd — the CLI is run
// from whatever folder the photos live in.
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

export const ROOT = path.resolve(__dirname, "..");
export const PROJECT = path.resolve(ROOT, "..");
export const PHOTOS_DIR = path.join(PROJECT, "example images");
export const REFERENCE_DIR = path.join(PROJECT, "Reference");
export const OUT_DIR = path.join(ROOT, "output");

export const API_KEY = process.env.GOOGLE_API_KEY ?? "";
if (!API_KEY) throw new Error("GOOGLE_API_KEY missing — see generator/.env.example");

/** Vision pass: triage + caption. Cheap, text-out. */
export const VISION_MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-3.6-flash";

/** Image pass. All three are available on this key; batch compares them. */
export const IMAGE_MODELS = {
  nb31: "gemini-3.1-flash-image",
  nb25: "gemini-2.5-flash-image",
  pro3: "gemini-3-pro-image",
} as const;
export type ImageModelKey = keyof typeof IMAGE_MODELS;

/** Account holder's nominated model. */
export const DEFAULT_IMAGE_MODEL: ImageModelKey =
  (process.env.GEMINI_IMAGE_MODEL as ImageModelKey) ?? "nb31";

/** Art director's ink colour. Fixed for the PoC — presets later. */
export const INK_HEX = "#D82020";

/** Model input target. The crop is upscaled to this before generation. */
export const GEN_INPUT_PX = 1280;

/** Luminance above this counts as background/highlight and becomes alpha. */
export const MATTE_THRESHOLD = 218;
/** Soft edge either side of the threshold, in luminance units. Keeps ink grit. */
export const MATTE_FEATHER = 26;
