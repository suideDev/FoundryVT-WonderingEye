let cached = null;

/**
 * Built-in pupil used when no image is configured: a soft radial glow with a
 * vertical slit punched out of it. Drawn in white so the tint setting works,
 * and generated at runtime so the module ships no binary assets.
 */
export function defaultPupilTexture() {
  if (cached && !cached.destroyed) return cached;

  const size = 256;
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;

  const ctx = element.getContext("2d");
  const r = size / 2;

  const glow = ctx.createRadialGradient(r, r, 0, r, r, r);
  glow.addColorStop(0.00, "rgba(255,255,255,1)");
  glow.addColorStop(0.16, "rgba(255,255,255,0.98)");
  glow.addColorStop(0.30, "rgba(255,255,255,0.62)");
  glow.addColorStop(0.52, "rgba(255,255,255,0.24)");
  glow.addColorStop(0.78, "rgba(255,255,255,0.07)");
  glow.addColorStop(1.00, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(r, r, size * 0.042, size * 0.155, 0, 0, Math.PI * 2);
  ctx.fill();

  cached = PIXI.Texture.from(element);
  return cached;
}
