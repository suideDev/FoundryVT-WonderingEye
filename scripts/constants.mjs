export const MODULE_ID = "wondering-eye";
export const FLAG_KEY = "eye";

export const TARGET_NEAREST = "@nearest";

export const PUPIL_STYLES = [
  "slit",
  "round",
  "horizontal",
  "diamond",
  "star",
  "crescent",
  "cross",
  "triangle",
  "ring",
  "orb"
];

export const DEFAULTS = {
  enabled: false,
  target: "",
  targetActorId: "",
  pupilStyle: "slit",
  pupilSrc: "",
  tint: "#ff2d2d",
  alpha: 1,
  glow: true,
  socketX: 0,
  socketY: 0,
  travelX: 0.05,
  travelY: 0.05,
  pupilScale: 0.08,
  gazeAmount: 1,
  smoothing: 0.2,
  idleDrift: true,
  blink: false,
  respectVisibility: true,
  users: []
};

export const HOST_TYPES = ["Tile", "Token"];
