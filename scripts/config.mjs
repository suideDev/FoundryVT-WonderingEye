import { FLAG_KEY, MODULE_ID, TARGET_NEAREST } from "./constants.mjs";
import { hostFrame, log, readEye, rotateVector, toRadians, warn } from "./util.mjs";

const PREFIX = `flags.${MODULE_ID}.${FLAG_KEY}`;
const TAB_ID = "wondering-eye";
const TAB_GROUP = "sheet";

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

/* -------------------------------------------- */
/*  Field builders                              */
/* -------------------------------------------- */

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

function pair(keyX, keyY, label, valueX, valueY, step, hint, extra = "") {
  return `
    <div class="form-group">
      <label>${esc(label)}</label>
      <div class="form-fields">
        <input type="number" step="${step}" data-dtype="Number" name="${PREFIX}.${keyX}" value="${esc(valueX)}">
        <input type="number" step="${step}" data-dtype="Number" name="${PREFIX}.${keyY}" value="${esc(valueY)}">
        ${extra}
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
  const field = customElements.get("file-picker")
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
  const field = customElements.get("color-picker")
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

function buildFields(scene, cfg) {
  const pickButton = `<button type="button" class="wondering-eye-pick">${esc(localize("button.pick"))}</button>`;

  return `
    <fieldset>
      <legend>${esc(localize("group.target"))}</legend>
      ${checkbox("enabled", localize("field.enabled"), cfg.enabled)}
      <div class="form-group">
        <label>${esc(localize("field.target"))}</label>
        <div class="form-fields">
          <select name="${PREFIX}.target" class="wondering-eye-target">${targetOptions(scene, cfg)}</select>
        </div>
        <p class="hint">${esc(localize("hint.target"))}</p>
      </div>
      <input type="hidden" name="${PREFIX}.targetActorId" class="wondering-eye-actor" value="${esc(cfg.targetActorId)}">
      ${checkbox("respectVisibility", localize("field.respectVisibility"), cfg.respectVisibility, localize("hint.respectVisibility"))}
      ${usersField(cfg)}
    </fieldset>

    <fieldset>
      <legend>${esc(localize("group.placement"))}</legend>
      ${pair("socketX", "socketY", localize("field.socket"), cfg.socketX, cfg.socketY, "0.01", localize("hint.socket"), pickButton)}
      ${pair("travelX", "travelY", localize("field.travel"), cfg.travelX, cfg.travelY, "0.01", localize("hint.travel"))}
      ${number("gazeAmount", localize("field.gazeAmount"), cfg.gazeAmount, "0.05", localize("hint.gazeAmount"))}
    </fieldset>

    <fieldset>
      <legend>${esc(localize("group.appearance"))}</legend>
      ${pupilField(cfg)}
      ${tintField(cfg)}
      ${number("alpha", localize("field.alpha"), cfg.alpha, "0.05")}
      ${checkbox("glow", localize("field.glow"), cfg.glow, localize("hint.glow"))}
      ${number("pupilScale", localize("field.pupilScale"), cfg.pupilScale, "0.005", localize("hint.pupilScale"))}
    </fieldset>

    <fieldset>
      <legend>${esc(localize("group.motion"))}</legend>
      ${number("smoothing", localize("field.smoothing"), cfg.smoothing, "0.05", localize("hint.smoothing"))}
      ${checkbox("idleDrift", localize("field.idleDrift"), cfg.idleDrift, localize("hint.idleDrift"))}
      ${checkbox("blink", localize("field.blink"), cfg.blink)}
    </fieldset>`;
}

/* -------------------------------------------- */
/*  Tab wiring                                  */
/* -------------------------------------------- */

function windowContent(root) {
  return root.querySelector(".window-content") ?? root;
}

function findNav(content) {
  return content.querySelector(`nav.sheet-tabs, nav.tabs, nav[data-application-part="tabs"]`);
}

/**
 * Tab content containers, identified by data attributes rather than class names
 * so this keeps working if a sheet decorates them differently.
 */
function findTabPanels(content) {
  return [...content.querySelectorAll(`[data-group="${TAB_GROUP}"][data-tab]`)]
    .filter(el => el.tagName !== "A" && !el.closest("nav"));
}

function setActiveTab(content, tabId) {
  for (const item of content.querySelectorAll(`nav [data-group="${TAB_GROUP}"][data-tab]`)) {
    item.classList.toggle("active", item.dataset.tab === tabId);
  }
  for (const panel of findTabPanels(content)) {
    panel.classList.toggle("active", panel.dataset.tab === tabId);
  }
}

/** Clone an existing nav entry so we inherit whatever markup the sheet uses. */
function buildNavItem(nav) {
  const template = nav.querySelector("a[data-tab]");
  let item;

  if (template) {
    item = template.cloneNode(true);
    item.classList.remove("active");
    // Core's action handler does not know this tab id, so we drive it ourselves.
    item.removeAttribute("data-action");
    const icon = item.querySelector("i");
    if (icon) icon.className = "fa-solid fa-eye";
    const span = item.querySelector("span");
    if (span) span.textContent = localize("tab.label");
    else item.textContent = localize("tab.label");
  } else {
    item = document.createElement("a");
    item.innerHTML = `<i class="fa-solid fa-eye" inert=""></i><span>${esc(localize("tab.label"))}</span>`;
  }

  item.dataset.tab = TAB_ID;
  item.dataset.group = TAB_GROUP;
  item.classList.add("wondering-eye-nav");
  return item;
}

/** Shallow clone of a sibling panel keeps its classes and flex behaviour. */
function buildPanel(panels, innerHTML) {
  const template = panels[0];
  let panel;

  if (template) {
    panel = template.cloneNode(false);
    panel.classList.remove("active");
    // Detach from the sheet's part system so partial re-renders ignore it.
    panel.removeAttribute("data-application-part");
  } else {
    panel = document.createElement("section");
    panel.classList.add("tab");
  }

  panel.dataset.tab = TAB_ID;
  panel.dataset.group = TAB_GROUP;
  panel.classList.add("wondering-eye-tab", "wondering-eye-config");
  panel.innerHTML = innerHTML;
  return panel;
}

function activateFields(app, scope) {
  const select = scope.querySelector(".wondering-eye-target");
  const actorInput = scope.querySelector(".wondering-eye-actor");

  select?.addEventListener("change", () => {
    if (!actorInput) return;
    actorInput.value = select.selectedOptions?.[0]?.dataset?.actorId ?? "";
  });

  scope.querySelector(".wondering-eye-pick")?.addEventListener("click", () => {
    pickSocket(app.document, scope);
  });
}

function pickSocket(doc, scope) {
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

    const socketX = scope.querySelector(`[name="${PREFIX}.socketX"]`);
    const socketY = scope.querySelector(`[name="${PREFIX}.socketY"]`);
    if (socketX) socketX.value = (local.x / frame.w).toFixed(4);
    if (socketY) socketY.value = (local.y / frame.h).toFixed(4);

    ui.notifications.info(localize("notify.pickDone"));
  }, { capture: true, once: true });
}

/**
 * Sheets without a tab bar get the fields appended instead. Only reachable on
 * older single-page sheets, where there is no flex layout to disturb.
 */
function appendWithoutTabs(content, fields) {
  const form = content.closest("form") ?? content;
  const anchor = content.querySelector("footer.form-footer, footer.sheet-footer, footer")
    ?? content.querySelector("button[type='submit']");

  const wrapper = document.createElement("div");
  wrapper.classList.add("wondering-eye-config");
  wrapper.innerHTML = `<fieldset><legend>${esc(localize("legend"))}</legend>${fields}</fieldset>`;

  if (anchor?.parentElement) anchor.parentElement.insertBefore(wrapper, anchor);
  else (form ?? content).append(wrapper);

  return wrapper;
}

function onRenderConfig(app, html) {
  try {
    const doc = app?.document;
    if (!doc) return;
    if (!["Tile", "Token"].includes(doc.documentName)) return;
    if (doc.parent?.documentName !== "Scene") return;

    const root = rootElement(html);
    if (!root || root.querySelector(".wondering-eye-config")) return;

    const content = windowContent(root);
    const fields = buildFields(doc.parent, readEye(doc));
    const nav = findNav(content);
    const panels = findTabPanels(content);

    if (!nav || !panels.length) {
      const wrapper = appendWithoutTabs(content, fields);
      activateFields(app, wrapper);
      return;
    }

    const panel = buildPanel(panels, fields);
    panels.at(-1).after(panel);

    const item = buildNavItem(nav);
    nav.append(item);

    item.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setActiveTab(content, TAB_ID);
      if (app.tabGroups) app.tabGroups[TAB_GROUP] = TAB_ID;
    });

    // Survive a re-render that happened while our tab was the active one.
    if (app.tabGroups?.[TAB_GROUP] === TAB_ID) setActiveTab(content, TAB_ID);

    activateFields(app, panel);
    log(`injected configuration tab into ${app.constructor.name}`);
  } catch (err) {
    warn("Failed to inject configuration UI", err);
  }
}

export function registerConfigUI() {
  Hooks.on("renderTileConfig", onRenderConfig);
  Hooks.on("renderTokenConfig", onRenderConfig);
}
