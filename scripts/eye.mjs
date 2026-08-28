import { TARGET_NEAREST } from "./constants.mjs";
import { defaultPupilTexture } from "./texture.mjs";
import {
  centerOf,
  hexToInt,
  hostFrame,
  log,
  readEye,
  resolveTexture,
  rotateVector,
  smoothingFactor,
  toRadians
} from "./util.mjs";

const BLINK_DURATION = 170;
const BLINK_MIN_GAP = 2600;
const BLINK_MAX_GAP = 8200;

export class Eye {
  constructor(host, container) {
    this.host = host;
    this.container = container;
    this.cfg = readEye(host.document);
    this.sprite = null;
    this.destroyed = false;

    this.local = { x: 0, y: 0 };
    this.driftPhase = Math.random() * 10000;
    this.blinkTimer = BLINK_MIN_GAP + Math.random() * BLINK_MAX_GAP;
    this.blinkElapsed = -1;
  }

  get id() {
    return this.host?.document?.id ?? null;
  }

  async prepare() {
    const texture = (await resolveTexture(this.cfg.pupilSrc)) ?? defaultPupilTexture();
    if (this.destroyed || !this.container || this.container.destroyed) return;

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.visible = false;
    sprite.interactiveChildren = false;
    try {
      sprite.eventMode = "none";
    } catch (err) {
      sprite.interactive = false;
    }

    sprite.tint = hexToInt(this.cfg.tint);
    sprite.alpha = this.cfg.alpha;
    // PIXI 7 exposes numeric blend constants; PIXI 8 uses strings.
    if (this.cfg.glow) sprite.blendMode = PIXI.BLEND_MODES?.ADD ?? "add";

    this.sprite = sprite;
    this.container.addChild(sprite);
    log(`prepared eye on ${this.host.document.documentName} ${this.id}`);
  }

  destroy() {
    this.destroyed = true;
    if (this.sprite && !this.sprite.destroyed) {
      this.sprite.parent?.removeChild(this.sprite);
      this.sprite.destroy({ children: true, texture: false, baseTexture: false });
    }
    this.sprite = null;
  }

  isVisibleToUser() {
    const users = this.cfg.users;
    if (!users.length) return true;
    if (game.user.isGM) return true;
    return users.includes(game.user.id);
  }

  isHostVisible() {
    const host = this.host;
    if (host.document.hidden && !game.user.isGM) return false;
    return host.visible !== false;
  }

  resolveTarget(socket) {
    const tokens = canvas?.tokens;
    if (!tokens) return null;

    if (this.cfg.target === TARGET_NEAREST) return this.nearestPlayerToken(socket);

    let token = this.cfg.target ? tokens.get(this.cfg.target) : null;

    if (!token && this.cfg.targetActorId) {
      token = tokens.placeables.find(t => t.actor?.id === this.cfg.targetActorId) ?? null;
    }

    if (!token) return null;
    if (this.cfg.respectVisibility && token.visible === false) return null;
    return token;
  }

  nearestPlayerToken(socket) {
    const candidates = canvas.tokens.placeables.filter(token => {
      if (!token.actor?.hasPlayerOwner) return false;
      if (this.cfg.respectVisibility && token.visible === false) return false;
      return true;
    });

    let closest = null;
    let closestDistance = Infinity;
    for (const token of candidates) {
      const center = centerOf(token);
      if (!center) continue;
      const distance = Math.hypot(center.x - socket.x, center.y - socket.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = token;
      }
    }
    return closest;
  }

  blinkScale(deltaMS) {
    if (!this.cfg.blink) return 1;

    if (this.blinkElapsed >= 0) {
      this.blinkElapsed += deltaMS;
      if (this.blinkElapsed >= BLINK_DURATION) {
        this.blinkElapsed = -1;
        return 1;
      }
      const progress = this.blinkElapsed / BLINK_DURATION;
      return 1 - Math.sin(progress * Math.PI) * 0.94;
    }

    this.blinkTimer -= deltaMS;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = BLINK_MIN_GAP + Math.random() * (BLINK_MAX_GAP - BLINK_MIN_GAP);
      this.blinkElapsed = 0;
    }
    return 1;
  }

  update(deltaMS) {
    const sprite = this.sprite;
    if (!sprite || sprite.destroyed) return;

    const host = this.host;
    if (!host || host.destroyed || !host.document) {
      sprite.visible = false;
      return;
    }

    if (!this.isVisibleToUser() || !this.isHostVisible()) {
      sprite.visible = false;
      return;
    }

    const frame = hostFrame(host);
    if (!frame) {
      sprite.visible = false;
      return;
    }

    const rotation = toRadians(frame.rotation);
    const socketOffset = rotateVector(this.cfg.socketX * frame.w, this.cfg.socketY * frame.h, rotation);
    const socket = { x: frame.center.x + socketOffset.x, y: frame.center.y + socketOffset.y };

    const radiusX = this.cfg.travelX * frame.w;
    const radiusY = this.cfg.travelY * frame.h;

    const target = this.resolveTarget(socket);
    let desired;

    if (target) {
      const targetCenter = centerOf(target);
      if (targetCenter) {
        const delta = rotateVector(targetCenter.x - socket.x, targetCenter.y - socket.y, -rotation);
        const angle = Math.atan2(delta.y, delta.x);
        desired = {
          x: Math.cos(angle) * radiusX * this.cfg.gazeAmount,
          y: Math.sin(angle) * radiusY * this.cfg.gazeAmount
        };
      }
    }

    if (!desired) {
      if (this.cfg.idleDrift) {
        this.driftPhase += deltaMS;
        const t = this.driftPhase / 1000;
        desired = {
          x: Math.sin(t * 0.29) * radiusX * 0.45,
          y: Math.sin(t * 0.21 + 1.1) * radiusY * 0.45
        };
      } else {
        desired = { x: 0, y: 0 };
      }
    }

    const factor = smoothingFactor(this.cfg.smoothing, deltaMS);
    this.local.x += (desired.x - this.local.x) * factor;
    this.local.y += (desired.y - this.local.y) * factor;

    const pupilOffset = rotateVector(this.local.x, this.local.y, rotation);
    sprite.position.set(socket.x + pupilOffset.x, socket.y + pupilOffset.y);
    sprite.rotation = rotation;

    const diameter = this.cfg.pupilScale * frame.w;
    sprite.width = diameter;
    sprite.height = diameter * this.blinkScale(deltaMS);
    sprite.visible = true;
  }
}
