import { DEFAULTS, PUPIL_STYLES } from "./constants.mjs";

const canvases = new Map();
const textures = new Map();

function makeCanvas(size = 256) {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  return { element, ctx: element.getContext("2d"), size, r: size / 2 };
}

function fillGlow(ctx, size, r) {
  const glow = ctx.createRadialGradient(r, r, 0, r, r, r);
  glow.addColorStop(0.00, "rgba(255,255,255,1)");
  glow.addColorStop(0.16, "rgba(255,255,255,0.98)");
  glow.addColorStop(0.30, "rgba(255,255,255,0.62)");
  glow.addColorStop(0.52, "rgba(255,255,255,0.24)");
  glow.addColorStop(0.78, "rgba(255,255,255,0.07)");
  glow.addColorStop(1.00, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
}

function punch(ctx, path) {
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  path(ctx);
  ctx.fill();
}

function pathStar(ctx, cx, cy, points, outer, inner) {
  const step = Math.PI / points;
  let angle = -Math.PI / 2;
  ctx.moveTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
  for (let i = 0; i < points; i++) {
    angle += step;
    ctx.lineTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    angle += step;
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
  }
  ctx.closePath();
}

const PAINTERS = {
  slit(ctx, size, r) {
    fillGlow(ctx, size, r);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(r, r, size * 0.042, size * 0.155, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  round(ctx, size, r) {
    fillGlow(ctx, size, r);
    punch(ctx, c => c.arc(r, r, size * 0.115, 0, Math.PI * 2));
  },

  horizontal(ctx, size, r) {
    fillGlow(ctx, size, r);
    punch(ctx, c => c.ellipse(r, r, size * 0.155, size * 0.042, 0, 0, Math.PI * 2));
  },

  diamond(ctx, size, r) {
    fillGlow(ctx, size, r);
    punch(ctx, c => {
      c.moveTo(r, r - size * 0.15);
      c.lineTo(r + size * 0.1, r);
      c.lineTo(r, r + size * 0.15);
      c.lineTo(r - size * 0.1, r);
      c.closePath();
    });
  },

  star(ctx, size, r) {
    fillGlow(ctx, size, r);
    punch(ctx, c => pathStar(c, r, r, 5, size * 0.175, size * 0.068));
  },

  crescent(ctx, size, r) {
    fillGlow(ctx, size, r);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(r, r, size * 0.165, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.beginPath();
    ctx.arc(r + size * 0.075, r - size * 0.02, size * 0.15, 0, Math.PI * 2);
    ctx.clip();
    fillGlow(ctx, size, r);
    ctx.restore();
  },

  cross(ctx, size, r) {
    fillGlow(ctx, size, r);
    const t = size * 0.055;
    const l = size * 0.19;
    punch(ctx, c => {
      if (typeof c.roundRect === "function") {
        c.roundRect(r - t, r - l, t * 2, l * 2, t);
        c.roundRect(r - l, r - t, l * 2, t * 2, t);
      } else {
        c.rect(r - t, r - l, t * 2, l * 2);
        c.rect(r - l, r - t, l * 2, t * 2);
      }
    });
  },

  triangle(ctx, size, r) {
    fillGlow(ctx, size, r);
    punch(ctx, c => {
      c.moveTo(r, r - size * 0.16);
      c.lineTo(r + size * 0.15, r + size * 0.11);
      c.lineTo(r - size * 0.15, r + size * 0.11);
      c.closePath();
    });
  },

  ring(ctx, size, r) {
    const glow = ctx.createRadialGradient(r, r, 0, r, r, r);
    glow.addColorStop(0.00, "rgba(255,255,255,0)");
    glow.addColorStop(0.22, "rgba(255,255,255,0)");
    glow.addColorStop(0.36, "rgba(255,255,255,0.55)");
    glow.addColorStop(0.48, "rgba(255,255,255,1)");
    glow.addColorStop(0.58, "rgba(255,255,255,0.55)");
    glow.addColorStop(0.78, "rgba(255,255,255,0.08)");
    glow.addColorStop(1.00, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  },

  orb(ctx, size, r) {
    fillGlow(ctx, size, r);
  }
};

function resolveStyle(style) {
  return PUPIL_STYLES.includes(style) ? style : DEFAULTS.pupilStyle;
}

/** Draw a built-in pupil onto a cached canvas. White, so tint multiplies cleanly. */
export function drawPupil(style) {
  const id = resolveStyle(style);
  const cached = canvases.get(id);
  if (cached) return cached;

  const { element, ctx, size, r } = makeCanvas();
  PAINTERS[id](ctx, size, r);
  canvases.set(id, element);
  return element;
}

export function pupilTexture(style) {
  const id = resolveStyle(style);
  const existing = textures.get(id);
  if (existing && !existing.destroyed) return existing;

  const texture = PIXI.Texture.from(drawPupil(id));
  textures.set(id, texture);
  return texture;
}

export function defaultPupilTexture() {
  return pupilTexture(DEFAULTS.pupilStyle);
}
