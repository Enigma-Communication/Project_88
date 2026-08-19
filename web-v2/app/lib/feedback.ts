/**
 * Local-only feedback notes.
 *
 * Describing a 2px spacing nit in prose costs more than fixing it, so this
 * lets the note be attached to the element itself. Everything lives on the
 * device until it is sent; sending writes a markdown file into the repo that
 * the agent reads directly.
 *
 * Dev only. The widget is compiled out of a production build and the API route
 * refuses to run in one, so there is no path where this ships to the club.
 */
const KEY = "p88-feedback";

export type FeedbackTarget = {
  label: string;
  text: string;
  tag: string;
  classes: string;
  rect: { x: number; y: number; w: number; h: number };
  /** The handful of properties that answer most "this looks off" notes. */
  styles: Record<string, string>;
};

export type FeedbackItem = {
  id: string;
  createdAt: number;
  note: string;
  screen: string;
  url: string;
  viewport: { w: number; h: number };
  target: FeedbackTarget | null;
  sent: boolean;
};

export function loadFeedback(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FeedbackItem[]) : [];
  } catch {
    return [];
  }
}

export function saveFeedback(items: FeedbackItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* quota — the notes are short, so this should not happen */
  }
}

const STYLE_KEYS = [
  "fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight",
  "color", "backgroundColor", "padding", "margin", "borderRadius", "textTransform",
];

/**
 * Describe a clicked element well enough that the note is actionable without
 * a screenshot: what it says, what it is, where it sits, and how it is set.
 */
export function describe(el: HTMLElement): FeedbackTarget {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const styles: Record<string, string> = {};
  for (const k of STYLE_KEYS) {
    const v = cs[k as keyof CSSStyleDeclaration];
    if (typeof v === "string" && v) styles[k] = v;
  }

  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const classes = typeof el.className === "string" ? el.className : "";

  // prefer something a human recognises, fall back to the tag
  const label = text ? `"${text.slice(0, 40)}"` : `<${el.tagName.toLowerCase()}>`;

  return {
    label,
    text,
    tag: el.tagName.toLowerCase(),
    classes: classes.split(/\s+/).filter(Boolean).slice(0, 14).join(" "),
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    styles,
  };
}
