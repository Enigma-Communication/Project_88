import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The CLI loads .env from the generator root (not the caller's cwd — it runs
// from whatever folder the photos live in). The web app gets its key from the
// hosting environment instead, so dotenv is optional and never fatal.
/**
 * The CLI needs GOOGLE_API_KEY from generator/.env, because it runs from
 * whatever folder the photos live in rather than from the project.
 *
 * Parsed by hand rather than with dotenv: this module is shared with the web
 * app, where the key comes from the hosting platform and dotenv is not
 * installed. A missing file is normal, not an error.
 */
if (!process.env.GOOGLE_API_KEY) {
  try {
    const envPath = path.resolve(__dirname, "..", "..", "generator", ".env");
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env — platform env, or the key is genuinely absent */ }
}

/** core/src -> core -> project root */
export const PROJECT = path.resolve(__dirname, "..", "..");
export const ROOT = path.resolve(PROJECT, "generator");
export const PHOTOS_DIR = path.join(PROJECT, "example images");
export const REFERENCE_DIR = path.join(PROJECT, "Reference");
export const OUT_DIR = path.join(ROOT, "output");

/**
 * Resolved lazily. Throwing at import time breaks the web build, which imports
 * these modules without a key present.
 */
export function apiKey(): string {
  const k = process.env.GOOGLE_API_KEY ?? "";
  if (!k) throw new Error("GOOGLE_API_KEY missing — see generator/.env.example");
  return k;
}

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
