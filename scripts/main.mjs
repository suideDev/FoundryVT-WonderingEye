import { WonderingEyeAPI } from "./api.mjs";
import { MODULE_ID } from "./constants.mjs";
import { registerConfigUI } from "./config.mjs";
import { GazeManager } from "./manager.mjs";
import { setDebug } from "./util.mjs";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "debug", {
    name: `${MODULE_ID}.settings.debug.name`,
    hint: `${MODULE_ID}.settings.debug.hint`,
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => setDebug(value)
  });

  registerConfigUI();
  GazeManager.init();

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = WonderingEyeAPI;
  globalThis.WonderingEye = WonderingEyeAPI;
});

Hooks.once("ready", () => {
  setDebug(game.settings.get(MODULE_ID, "debug"));
  if (canvas?.ready) GazeManager.rebuild();
});
