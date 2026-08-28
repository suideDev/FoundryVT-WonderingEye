import { FLAG_KEY, MODULE_ID, TARGET_NEAREST } from "./constants.mjs";
import { hostFrame, log, readEye, rotateVector, toRadians, warn } from "./util.mjs";

const PREFIX = `flags.${MODULE_ID}.${FLAG_KEY}`;

function localize(key) {
  return game.i18n.localize(`${MODULE_ID}.${key}`);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function checkbox(key, label, checked, hint) {
  return `
    <div class="form-group">
      <label>${esc(label)}</label>
      <div class="form-fields">
        <input type="checkbox" name="${PREFIX}.${key}" ${checked ? "checked" : ""}>
      </div>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
    </div>`;
}

function number(key, label, value, step, hint) {
  return `
    <div class="form-group">
      <label>${esc(label)}</label>
      <div class="form-fields">
        <input type="number" step="${step}" data-dtype="Number"
               name="${PREFIX}.${key}" value="${esc(value)}">
      </div>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
    </div>`;
}

function targetOptions(scene, cfg) {
  const options = [
    `<option value="" ${cfg.target === "" ? "selected" : ""}>${esc(localize("target.none"))}</option>`,
    `<option value="${TARGET_NEAREST}" ${cfg.target === TARGET_NEAREST ? "selected" : ""}>${esc(localize("target.nearest"))}</option>`
  ];

  const tokens = [...(scene?.tokens ?? [])].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  for (const token of tokens) {
    const selected = cfg.target === token.id ? "selected" : "";
    options.push(
      `<option value="${esc(token.id)}" data-actor-id="${esc(token.actor?.id ?? "")}" ${selected}>${esc(token.name)}</option>`
    );
  }

  return options.join("");
}

function pupilField(cfg) {
  const hasFilePicker = !!customElements.get("file-picker");
  const field = hasFilePicker
    ? `<file-picker name="${PREFIX}.pupilSrc" type="imagevideo" value="${esc(cfg.pupilSrc)}"></file-picker>`
    : `<input type="text" name="${PREFIX}.pupilSrc" value="${esc(cfg.pupilSrc)}">`;

  return `
    <div class="form-group">
      <label>${esc(localize("field.pupilSrc"))}</label>
      <div class="form-fields">${field}</div>
      <p class="hint">${esc(localize("hint.pupilSrc"))}</p>
    </div>`;
}

function tintField(cfg) {
  const hasColorPicker = !!customElements.get("color-picker");
  const field = hasColorPicker
    ? `<color-picker name="${PREFIX}.tint" value="${esc(cfg.tint)}"></color-picker>`
    : `<input type="color" name="${PREFIX}.tint" value="${esc(cfg.tint)}">`;

  return `
    <div class="form-group">
      <label>${esc(localize("field.tint"))}</label>
      <div class="form-fields">${field}</div>
    </div>`;
}

function usersField(cfg) {
  const players = game.users.filter(user => !user.isGM);
  if (!players.length) return "";

  const options = players
    .map(user => `<option value="${esc(user.id)}" ${cfg.users.includes(user.id) ? "selected" : ""}>${esc(user.name)}</option>`)
    .join("");

  const field = customElements.get("multi-select")
    ? `<multi-select name="${PREFIX}.users">${options}</multi-select>`
    : `<select name="${PREFIX}.users" multiple size="${Math.min(players.length, 5)}">${options}</select>`;

  return `
    <div class="form-group">
      <label>${esc(localize("field.users"))}</label>
      <div class="form-fields">${field}</div>
      <p class="hint">${esc(localize("hint.users"))}</p>
    </div>`;
}

function buildSection(scene, cfg) {
  return `
    <fieldset class="wondering-eye-config">
      <legend>${esc(localize("legend"))}</legend>

      ${checkbox("enabled", localize("field.enabled"), cfg.enabled)}

      <div class="form-group">
        <label>${esc(localize("field.target"))}</label>
        <div class="form-fields">
          <select name="${PREFIX}.target" class="wondering-eye-target">${targetOptions(scene, cfg)}</select>
        </div>
        <p class="hint">${esc(localize("hint.target"))}</p>
      </div>
      <input type="hidden" name="${PREFIX}.targetActorId" class="wondering-eye-actor" value="${esc(cfg.targetActorId)}">

      ${pupilField(cfg)}
      ${tintField(cfg)}
      ${number("alpha", localize("field.alpha"), cfg.alpha, "0.05")}
      ${checkbox("glow", localize("field.glow"), cfg.glow, localize("hint.glow"))}

      <div class="form-group">
        <label>${esc(localize("field.socket"))}</label>
        <div class="form-fields">
          <input type="number" step="0.01" data-dtype="Number" name="${PREFIX}.socketX" value="${esc(cfg.socketX)}">
          <input type="number" step="0.01" data-dtype="Number" name="${PREFIX}.socketY" value="${esc(cfg.socketY)}">
          <button type="button" class="wondering-eye-pick">${esc(localize("button.pick"))}</button>
        </div>
        <p class="hint">${esc(localize("hint.socket"))}</p>
      </div>

      <div class="form-group">
        <label>${esc(localize("field.travel"))}</label>
        <div class="form-fields">
          <input type="number" step="0.01" min="0" data-dtype="Number" name="${PREFIX}.travelX" value="${esc(cfg.travelX)}">
          <input type="number" step="0.01" min="0" data-dtype="Number" name="${PREFIX}.travelY" value="${esc(cfg.travelY)}">
        </div>
        <p class="hint">${esc(localize("hint.travel"))}</p>
      </div>

      ${number("pupilScale", localize("field.pupilScale"), cfg.pupilScale, "0.005", localize("hint.pupilScale"))}
      ${number("gazeAmount", localize("field.gazeAmount"), cfg.gazeAmount, "0.05", localize("hint.gazeAmount"))}
      ${number("smoothing", localize("field.smoothing"), cfg.smoothing, "0.05", localize("hint.smoothing"))}

      ${checkbox("idleDrift", localize("field.idleDrift"), cfg.idleDrift, localize("hint.idleDrift"))}
      ${checkbox("blink", localize("field.blink"), cfg.blink)}
      ${checkbox("respectVisibility", localize("field.respectVisibility"), cfg.respectVisibility, localize("hint.respectVisibility"))}

      ${usersField(cfg)}
    </fieldset>`;
}

/**
 * Anchor searched within the form itself, so injected fields can never end up
 * outside it and get dropped on submit.
 */
function insertionAnchor(form) {
  return form.querySelector("footer.form-footer")
    ?? form.querySelector("footer.sheet-footer")
    ?? form.querySelector("footer")
    ?? form.querySelector("button[type='submit']")
    ?? null;
}

function pickSocket(doc, root) {
  const host = doc?.object;
  if (!host) {
    ui.notifications.warn(localize("notify.noPlaceable"));
    return;
  }

  // PIXI 7 names the backing element `view`, PIXI 8 names it `canvas`.
  const view = canvas?.app?.view ?? canvas?.app?.canvas;
  if (!view?.addEventListener) return;

  ui.notifications.info(localize("notify.pickPrompt"));

  view.addEventListener("pointerdown", event => {
    event.preventDefault();
    event.stopPropagation();

    let world = canvas.mousePosition;
    if (!world || !Number.isFinite(world.x)) {
      const rect = view.getBoundingClientRect();
      world = canvas.stage.toLocal(new PIXI.Point(event.clientX - rect.left, event.clientY - rect.top));
    }

    const frame = hostFrame(host);
    if (!frame) return;

    const local = rotateVector(
      world.x - frame.center.x,
      world.y - frame.center.y,
      -toRadians(frame.rotation)
    );

    const socketX = root.querySelector(`[name="${PREFIX}.socketX"]`);
    const socketY = root.querySelector(`[name="${PREFIX}.socketY"]`);
    if (socketX) socketX.value = (local.x / frame.w).toFixed(4);
    if (socketY) socketY.value = (local.y / frame.h).toFixed(4);

    ui.notifications.info(localize("notify.pickDone"));
  }, { capture: true, once: true });
}

function activate(app, root) {
  const select = root.querySelector(".wondering-eye-target");
  const actorInput = root.querySelector(".wondering-eye-actor");

  select?.addEventListener("change", () => {
    if (!actorInput) return;
    const option = select.selectedOptions?.[0];
    actorInput.value = option?.dataset?.actorId ?? "";
  });

  root.querySelector(".wondering-eye-pick")?.addEventListener("click", () => {
    pickSocket(app.document, root);
  });
}

function onRenderConfig(app, html) {
  try {
    const doc = app?.document;
    if (!doc) return;
    if (!["Tile", "Token"].includes(doc.documentName)) return;
    if (doc.parent?.documentName !== "Scene") return;

    const root = rootElement(html);
    if (!root || root.querySelector(".wondering-eye-config")) return;

    const form = root.tagName === "FORM" ? root : root.querySelector("form");
    if (!form) return;

    const section = buildSection(doc.parent, readEye(doc));
    const anchor = insertionAnchor(form);

    if (anchor) anchor.insertAdjacentHTML("beforebegin", section);
    else form.insertAdjacentHTML("beforeend", section);

    activate(app, form);

    try {
      app.setPosition({ height: "auto" });
    } catch (err) {
      log("setPosition unsupported", err);
    }
  } catch (err) {
    warn("Failed to inject configuration UI", err);
  }
}

export function registerConfigUI() {
  Hooks.on("renderTileConfig", onRenderConfig);
  Hooks.on("renderTokenConfig", onRenderConfig);
}
