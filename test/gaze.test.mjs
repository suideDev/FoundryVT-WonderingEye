class Sprite {
  constructor(texture) {
    this.texture = texture;
    this.anchor = { set() {} };
    this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
    this.visible = false;
    this.rotation = 0;
  }
  destroy() {}
}

globalThis.PIXI = { Sprite, Texture: { from: src => ({ src }) }, BLEND_MODES: { ADD: 1 } };
globalThis.game = { user: { isGM: true, id: "u1" } };

function tokenAt(id, x, y) {
  return {
    document: { documentName: "Token", id, x, y, width: 1, height: 1, rotation: 0 },
    visible: true,
    actor: { id: `a-${id}`, hasPlayerOwner: true }
  };
}

const tokens = new Map();
globalThis.canvas = {
  dimensions: { size: 100 },
  tokens: {
    get: id => tokens.get(id) ?? null,
    get placeables() { return [...tokens.values()]; }
  }
};

const { Eye } = await import("../scripts/eye.mjs");

function makeHost(overrides = {}, rotation = 0) {
  return {
    destroyed: false,
    visible: true,
    document: {
      documentName: "Tile",
      id: "tile1",
      x: 0, y: 0, width: 1000, height: 800, rotation, hidden: false,
      flags: {
        "wondering-eye": {
          eye: {
            enabled: true,
            target: "t1",
            pupilSrc: "fake.webp",
            travelX: 0.05,
            travelY: 0.02,
            pupilScale: 0.06,
            smoothing: 0,
            idleDrift: false,
            glow: true,
            ...overrides
          }
        }
      }
    }
  };
}

async function run(host, frames = 90) {
  const eye = new Eye(host, { destroyed: false, addChild() {} });
  await eye.prepare();
  for (let i = 0; i < frames; i++) eye.update(16);
  return eye;
}

const results = [];
function check(label, actual, expected, tolerance = 0.5) {
  const ok = Math.abs(actual.x - expected.x) <= tolerance && Math.abs(actual.y - expected.y) <= tolerance;
  results.push({ label, ok, got: `${actual.x.toFixed(2)}, ${actual.y.toFixed(2)}`, want: `${expected.x}, ${expected.y}` });
}

// Host centre is (500, 400). Travel radii are 50 x and 16 y.

tokens.clear();
tokens.set("t1", tokenAt("t1", 1450, 350));
let eye = await run(makeHost());
check("target due east", eye.sprite.position, { x: 550, y: 400 });

tokens.clear();
tokens.set("t1", tokenAt("t1", 450, -650));
eye = await run(makeHost());
check("target due north", eye.sprite.position, { x: 500, y: 384 });

tokens.clear();
tokens.set("t1", tokenAt("t1", -1550, 350));
eye = await run(makeHost());
check("target due west", eye.sprite.position, { x: 450, y: 400 });

// Socket offset by a quarter width right, an eighth height up: (750, 300).
tokens.clear();
tokens.set("t1", tokenAt("t1", 1450, 250));
eye = await run(makeHost({ socketX: 0.25, socketY: -0.125 }));
check("offset socket, target east", eye.sprite.position, { x: 800, y: 300 });

// Rotated host: 90deg means the local x axis points south in world space.
tokens.clear();
tokens.set("t1", tokenAt("t1", 450, 1350));
eye = await run(makeHost({}, 90));
check("rotated 90, target due south", eye.sprite.position, { x: 500, y: 450 });

// Gaze strength halves the deflection.
tokens.clear();
tokens.set("t1", tokenAt("t1", 1450, 350));
eye = await run(makeHost({ gazeAmount: 0.5 }));
check("half gaze strength", eye.sprite.position, { x: 525, y: 400 });

// No target resolvable, drift disabled: pupil rests on the socket.
tokens.clear();
eye = await run(makeHost({ target: "" }));
check("idle, no drift", eye.sprite.position, { x: 500, y: 400 });

// Falls back to the actor when the stored token id is gone.
tokens.clear();
tokens.set("other", tokenAt("t1", 1450, 350));
eye = await run(makeHost({ target: "missing", targetActorId: "a-t1" }));
check("actor fallback", eye.sprite.position, { x: 550, y: 400 });

// Nearest player token wins over the further one.
tokens.clear();
tokens.set("far", tokenAt("far", 5000, 350));
tokens.set("near", tokenAt("near", -1550, 350));
eye = await run(makeHost({ target: "@nearest" }));
check("nearest picks the west token", eye.sprite.position, { x: 450, y: 400 });

// Pupil diameter is a fraction of host width.
tokens.clear();
tokens.set("t1", tokenAt("t1", 1450, 350));
eye = await run(makeHost());
const sizeOk = eye.sprite.width === 60 && eye.sprite.height === 60;
results.push({ label: "pupil size 6% of 1000px", ok: sizeOk, got: `${eye.sprite.width}x${eye.sprite.height}`, want: "60x60" });

// Restricted visibility hides the sprite from a non-listed player.
tokens.clear();
tokens.set("t1", tokenAt("t1", 1450, 350));
globalThis.game = { user: { isGM: false, id: "u2" } };
eye = await run(makeHost({ users: ["u1"] }));
results.push({ label: "hidden from unlisted user", ok: eye.sprite.visible === false, got: `${eye.sprite.visible}`, want: "false" });
eye = await run(makeHost({ users: ["u2"] }));
results.push({ label: "shown to listed user", ok: eye.sprite.visible === true, got: `${eye.sprite.visible}`, want: "true" });

// Tint parsing: whatever a colour field hands back should survive.
const { readEye } = await import("../scripts/util.mjs");
const tintCases = [
  ["#00ff88", "#00ff88"],
  ["#0F8", "#00ff88"],
  ["00FF88", "#00ff88"],
  ["#00ff8880", "#00ff88"],
  [0x00ff88, "#00ff88"],
  [{ css: "#00ff88" }, "#00ff88"],
  ["rgb(0, 255, 136)", "#ff2d2d"],
  [null, "#ff2d2d"]
];

for (const [input, expected] of tintCases) {
  const got = readEye({ flags: { "wondering-eye": { eye: { tint: input } } } }).tint;
  results.push({
    label: `tint ${JSON.stringify(input)}`,
    ok: got === expected,
    got,
    want: expected
  });
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}  (got ${r.got} / want ${r.want})`);
}
console.log(failed ? `\n${failed} failing` : "\nall passing");
process.exit(failed ? 1 : 0);
