import { DEFAULTS, FLAG_KEY, MODULE_ID, TARGET_NEAREST } from "./constants.mjs";
import { GazeManager } from "./manager.mjs";
import { readEye } from "./util.mjs";

function asDocument(target) {
  if (!target) return null;
  if (target.documentName === "Tile" || target.documentName === "Token") return target;
  if (target.document?.documentName) return target.document;
  if (typeof target === "string") {
    return canvas?.tiles?.get(target)?.document ?? canvas?.tokens?.get(target)?.document ?? null;
  }
  return null;
}

function asToken(target) {
  if (!target) return null;
  if (typeof target === "string") return canvas?.tokens?.get(target) ?? null;
  if (target.documentName === "Token") return target.object ?? null;
  return target;
}

export const WonderingEyeAPI = {
  TARGET_NEAREST,
  DEFAULTS,

  /** Read the resolved configuration for a host tile or token. */
  get(host) {
    const doc = asDocument(host);
    return doc ? readEye(doc) : null;
  },

  /** Merge configuration onto a host. Requires update permission. */
  async set(host, options = {}) {
    const doc = asDocument(host);
    if (!doc) throw new Error(`${MODULE_ID} | set() needs a Tile or Token`);

    const allowed = {};
    for (const key of Object.keys(DEFAULTS)) {
      if (options[key] !== undefined) allowed[key] = options[key];
    }

    return doc.update({ [`flags.${MODULE_ID}.${FLAG_KEY}`]: allowed });
  },

  /** Point an existing eye at a token, or at the nearest player token. */
  async lookAt(host, target) {
    const doc = asDocument(host);
    if (!doc) throw new Error(`${MODULE_ID} | lookAt() needs a Tile or Token host`);

    if (target === TARGET_NEAREST) {
      return this.set(doc, { target: TARGET_NEAREST, targetActorId: "" });
    }

    const token = asToken(target);
    if (!token) throw new Error(`${MODULE_ID} | lookAt() could not resolve the target token`);

    return this.set(doc, {
      target: token.document.id,
      targetActorId: token.actor?.id ?? ""
    });
  },

  /** Remove all eye configuration from a host. */
  async clear(host) {
    const doc = asDocument(host);
    if (!doc) throw new Error(`${MODULE_ID} | clear() needs a Tile or Token`);
    return doc.update({ [`flags.${MODULE_ID}.-=${FLAG_KEY}`]: null });
  },

  /** Force the local render loop to rebuild. Rarely needed. */
  refresh() {
    GazeManager.rebuild();
  }
};
