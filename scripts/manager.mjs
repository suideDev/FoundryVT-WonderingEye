import { HOST_TYPES, MODULE_ID } from "./constants.mjs";
import { Eye } from "./eye.mjs";
import { log, readEye, warn } from "./util.mjs";

/**
 * Owns the client-side render loop. Every client runs its own copy, reading the
 * eye configuration from document flags, so tracking costs no network traffic.
 */
export const GazeManager = {
  eyes: new Map(),
  container: null,
  ticking: false,
  rebuildQueued: false,

  init() {
    Hooks.on("canvasReady", () => this.rebuild());
    Hooks.on("canvasTearDown", () => this.teardown());

    for (const type of HOST_TYPES) {
      Hooks.on(`create${type}`, doc => this.onHostChange(doc));
      Hooks.on(`delete${type}`, doc => this.onHostChange(doc));
      Hooks.on(`update${type}`, (doc, changes) => {
        if (foundry.utils.hasProperty(changes ?? {}, `flags.${MODULE_ID}`)) this.onHostChange(doc);
      });
    }
  },

  onHostChange(doc) {
    if (doc?.parent && canvas?.scene && doc.parent.id !== canvas.scene.id) return;
    this.queueRebuild();
  },

  queueRebuild() {
    if (this.rebuildQueued) return;
    this.rebuildQueued = true;
    setTimeout(() => {
      this.rebuildQueued = false;
      this.rebuild();
    }, 50);
  },

  /**
   * Insert the overlay directly above the primary group so the pupil draws over
   * host artwork, but stays below interface elements such as borders and
   * nameplates. Equal zIndex keeps the insertion order intact if the stage
   * sorts its children.
   */
  ensureContainer() {
    if (this.container && !this.container.destroyed && this.container.parent) return this.container;

    const stage = canvas?.stage;
    if (!stage) return null;

    const container = new PIXI.Container();
    try {
      container.name = "wondering-eye";
    } catch (err) {
      log("container naming unsupported", err);
    }
    container.interactiveChildren = false;
    try {
      container.eventMode = "none";
    } catch (err) {
      container.interactive = false;
    }

    const primary = canvas.primary;
    let index = stage.children.length;
    if (primary && primary.parent === stage) {
      index = Math.min(stage.getChildIndex(primary) + 1, stage.children.length);
      container.zIndex = primary.zIndex ?? 0;
    }

    stage.addChildAt(container, index);
    this.container = container;
    return container;
  },

  hostPlaceables() {
    const hosts = [];
    if (canvas?.tiles?.placeables) hosts.push(...canvas.tiles.placeables);
    if (canvas?.tokens?.placeables) hosts.push(...canvas.tokens.placeables);
    return hosts;
  },

  rebuild() {
    this.clearEyes();

    if (!canvas?.ready) return;

    const container = this.ensureContainer();
    if (!container) return;

    for (const host of this.hostPlaceables()) {
      const cfg = readEye(host.document);
      if (!cfg.enabled) continue;

      const eye = new Eye(host, container);
      this.eyes.set(`${host.document.documentName}:${host.document.id}`, eye);
      eye.prepare().catch(err => warn("Failed to prepare eye", err));
    }

    log(`rebuilt with ${this.eyes.size} eye(s)`);
    this.eyes.size ? this.startTicker() : this.stopTicker();
  },

  clearEyes() {
    for (const eye of this.eyes.values()) eye.destroy();
    this.eyes.clear();
  },

  teardown() {
    this.stopTicker();
    this.clearEyes();
    if (this.container && !this.container.destroyed) {
      this.container.parent?.removeChild(this.container);
      this.container.destroy({ children: true });
    }
    this.container = null;
  },

  startTicker() {
    if (this.ticking) return;
    const ticker = canvas?.app?.ticker;
    if (!ticker) return;
    ticker.add(this.tick, this);
    this.ticking = true;
  },

  stopTicker() {
    if (!this.ticking) return;
    canvas?.app?.ticker?.remove(this.tick, this);
    this.ticking = false;
  },

  tick() {
    const deltaMS = canvas?.app?.ticker?.deltaMS ?? 16;
    for (const [key, eye] of this.eyes) {
      try {
        eye.update(deltaMS);
      } catch (err) {
        warn(`Eye ${key} threw during update and was removed`, err);
        eye.destroy();
        this.eyes.delete(key);
      }
    }
    if (!this.eyes.size) this.stopTicker();
  }
};
