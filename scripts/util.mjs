import { MODULE_ID, FLAG_KEY, DEFAULTS, PUPIL_STYLES } from "./constants.mjs";

let debugEnabled = false;

export function setDebug(value) {
  debugEnabled = !!value;
}

export function log(...args) {
  if (debugEnabled) console.log(`${MODULE_ID} |`, ...args);
}

export function warn(...args) {
  console.warn(`${MODULE_ID} |`, ...args);
}

function num(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

/**
 * Accept whatever a colour field hands back: short or long hex, hex with an
 * alpha suffix, a packed integer, or a Foundry Color. Anything unreadable falls
 * through to the caller's default rather than silently rendering the wrong hue.
 */
function toHexColour(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `#${Math.max(0, Math.min(0xffffff, Math.trunc(value))).toString(16).padStart(6, "0")}`;
  }

  let text = value;
  if (text && typeof text === "object") text = text.css ?? String(text);
  if (typeof text !== "string") return fallback;

  text = text.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(text)) {
    return `#${text[0]}${text[0]}${text[1]}${text[1]}${text[2]}${text[2]}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text.toLowerCase()}`;
  if (/^[0-9a-f]{8}$/i.test(text)) return `#${text.slice(0, 6).toLowerCase()}`;

  return fallback;
}

function toUserList(value) {
  if (Array.isArray(value)) return value.filter(u => typeof u === "string" && u.length);
  if (typeof value === "string" && value.length) {
    return value.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Read the eye configuration off a Tile or Token document, filling in defaults
 * and coercing anything the form may have handed back as a string.
 */
export function readEye(doc) {
  const raw = doc?.flags?.[MODULE_ID]?.[FLAG_KEY];
  const cfg = { ...DEFAULTS };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(DEFAULTS)) {
      if (raw[key] !== undefined) cfg[key] = raw[key];
    }
  }

  cfg.enabled = !!cfg.enabled;
  cfg.glow = !!cfg.glow;
  cfg.idleDrift = !!cfg.idleDrift;
  cfg.blink = !!cfg.blink;
  cfg.respectVisibility = !!cfg.respectVisibility;
  cfg.target = typeof cfg.target === "string" ? cfg.target : "";
  cfg.targetActorId = typeof cfg.targetActorId === "string" ? cfg.targetActorId : "";
  cfg.pupilStyle = PUPIL_STYLES.includes(cfg.pupilStyle) ? cfg.pupilStyle : DEFAULTS.pupilStyle;
  cfg.pupilSrc = typeof cfg.pupilSrc === "string" ? cfg.pupilSrc.trim() : "";
  cfg.tint = toHexColour(cfg.tint, DEFAULTS.tint);
  cfg.alpha = num(cfg.alpha, DEFAULTS.alpha, 0, 1);
  cfg.socketX = num(cfg.socketX, DEFAULTS.socketX, -1, 1);
  cfg.socketY = num(cfg.socketY, DEFAULTS.socketY, -1, 1);
  cfg.travelX = num(cfg.travelX, DEFAULTS.travelX, 0, 1);
  cfg.travelY = num(cfg.travelY, DEFAULTS.travelY, 0, 1);
  cfg.pupilScale = num(cfg.pupilScale, DEFAULTS.pupilScale, 0.001, 4);
  cfg.gazeAmount = num(cfg.gazeAmount, DEFAULTS.gazeAmount, 0, 1);
  cfg.smoothing = num(cfg.smoothing, DEFAULTS.smoothing, 0, 1);
  cfg.users = toUserList(cfg.users);

  return cfg;
}

export function hexToInt(hex) {
  const parsed = Number.parseInt(String(hex).replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : 0xffffff;
}

export function toRadians(degrees) {
  return (Number(degrees) || 0) * Math.PI / 180;
}

export function rotateVector(x, y, radians) {
  if (!radians) return { x, y };
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export function gridSize() {
  return canvas?.dimensions?.size ?? canvas?.grid?.size ?? 100;
}

/**
 * Unrotated pixel footprint of a host placeable, plus its centre and rotation.
 * Tile width/height are already pixels; Token width/height are grid units.
 */
export function hostFrame(host) {
  const doc = host?.document;
  if (!doc) return null;

  const isToken = doc.documentName === "Token";
  const size = gridSize();
  const w = (isToken ? Number(doc.width) * size : Number(doc.width)) || size;
  const h = (isToken ? Number(doc.height) * size : Number(doc.height)) || size;

  const center = centerOf(host) ?? {
    x: (Number(doc.x) || 0) + w / 2,
    y: (Number(doc.y) || 0) + h / 2
  };

  return { w, h, center, rotation: Number(doc.rotation) || 0 };
}

/**
 * Centre point of a placeable in scene coordinates. Prefers the live values so
 * that a host or target mid-animation reports its interpolated position.
 */
export function centerOf(placeable) {
  if (!placeable) return null;

  try {
    if (typeof placeable.getCenterPoint === "function") {
      const point = placeable.getCenterPoint();
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
    }
  } catch (err) {
    log("getCenterPoint failed", err);
  }

  const center = placeable.center;
  if (center && Number.isFinite(center.x) && Number.isFinite(center.y)) return center;

  const doc = placeable.document;
  if (!doc) return null;

  const isToken = doc.documentName === "Token";
  const size = gridSize();
  const w = (isToken ? Number(doc.width) * size : Number(doc.width)) || size;
  const h = (isToken ? Number(doc.height) * size : Number(doc.height)) || size;
  return { x: (Number(doc.x) || 0) + w / 2, y: (Number(doc.y) || 0) + h / 2 };
}

/**
 * Frame-rate independent exponential smoothing. `amount` runs 0 (instant) to
 * 1 (very lazy); the result is the fraction to move toward the target this frame.
 */
export function smoothingFactor(amount, deltaMS) {
  const dt = Math.min(Math.max(Number(deltaMS) || 16, 1), 250);
  const tau = 15 + (Number(amount) || 0) * 600;
  if (tau <= 1) return 1;
  return Math.min(1, 1 - Math.exp(-dt / tau));
}

export async function resolveTexture(src) {
  if (!src) return null;

  const loader = globalThis.foundry?.canvas?.loadTexture ?? globalThis.loadTexture;
  if (typeof loader === "function") {
    try {
      const texture = await loader(src);
      if (texture) return texture;
    } catch (err) {
      warn(`Could not load pupil texture "${src}"`, err);
    }
  }

  try {
    return PIXI.Texture.from(src);
  } catch (err) {
    warn(`PIXI could not load pupil texture "${src}"`, err);
    return null;
  }
}
