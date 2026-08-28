# Wondering Eye

A Foundry VTT module that attaches a gaze-tracking eye to any tile or token. The
eye follows a chosen token around the scene, so a looming shadow can watch one
particular character while everyone else sees a dark corner of the map.

Tracking runs entirely on each client, reading configuration from document
flags. Nothing is written to the database while the eye is moving, so there is
no network traffic per frame and no movement history to clean up.

## Installing on The Forge

In The Forge, open your game's **Add-on Modules** tab, choose **Install Module**,
and paste:

```
https://raw.githubusercontent.com/suideDev/FoundryVT-WonderingEye/main/module.json
```

The `download` URL points at the `main` branch archive, so pushing a commit and
reinstalling picks up the latest code without needing to cut releases. Bump
`version` in `module.json` when you want Foundry to offer an update.

## Setting up an eye

1. Place your artwork as a **Tile**. A giant shadow works better as a tile than
   a token: it stays out of the turn order, cannot be targeted by accident, and
   does not interact with vision.
2. Open the tile's configuration and scroll to the **Wondering Eye** section.
3. Tick **Enable eye** and pick the token to watch under **Watch**.
4. Click **Pick on canvas**, then click the spot on the map where the eye should
   sit. This fills in Socket X and Y for you.
5. Set **Travel X / Y** to control how far the pupil moves, and **Pupil size**
   for its diameter. Both are fractions of the tile's size, so they stay correct
   if you resize the tile later.
6. Save. The eye starts tracking immediately on every connected client.

Tokens work as hosts too, with the same section in the token configuration
sheet. Prototype tokens are skipped, since there is no scene to pick a target
from.

## Settings reference

| Field | What it does |
| --- | --- |
| Watch | Token to follow. `Nearest player token` re-picks continuously. |
| Pupil image | Optional artwork. Blank uses a built-in glowing slit pupil. |
| Tint / Opacity | Colour and alpha applied to the pupil sprite. |
| Additive glow | Blends the pupil additively. Best over dark artwork. |
| Socket X / Y | Eye position as a fraction of host size, from its centre. |
| Travel X / Y | Pupil travel radius as a fraction of host size. |
| Pupil size | Pupil diameter as a fraction of host width. |
| Gaze strength | 0 keeps the pupil centred, 1 pushes it fully to the rim. |
| Smoothing | 0 snaps instantly, 1 follows very lazily. |
| Drift when idle | Slow wander when there is no target. |
| Blink occasionally | Random squash of the pupil, roughly every few seconds. |
| Only track visible tokens | Ignore targets this client cannot see. |
| Only visible to | Restrict the eye to specific players. GMs always see it. |

Socket, travel and size are all fractions rather than pixels so that one set of
numbers keeps working across scenes with different grid sizes.

### Only visible to

This is the setting worth knowing about. Restrict the eye to a single player and
only that person watches their patron watching them. Everyone else sees nothing,
and the player gets to decide whether to say anything about it.

## Macro API

Available as `WonderingEye` or `game.modules.get("wondering-eye").api`. All
methods that write flags need update permission on the host, so run them GM-side.

```js
// Point an existing eye at whichever token is selected
await WonderingEye.lookAt(_token.document.parent.tiles.get("TILE_ID"), _token);

// Configure a tile from scratch
const tile = canvas.tiles.controlled[0];
await WonderingEye.set(tile, {
  enabled: true,
  target: canvas.tokens.getName("Token Name")?.id,
  socketX: 0.04,
  socketY: -0.18,
  travelX: 0.03,
  travelY: 0.015,
  pupilScale: 0.05,
  tint: "#ff2d2d",
  smoothing: 0.35,
  users: [game.users.getName("Player Name")?.id]
});

// Follow whoever is closest
await WonderingEye.lookAt(tile, WonderingEye.TARGET_NEAREST);

// Read back the resolved configuration, defaults included
WonderingEye.get(tile);

// Remove everything this module added to a host
await WonderingEye.clear(tile);
```

## Checking the maths

`node test/gaze.test.mjs` runs the pupil positioning against a stubbed canvas,
covering socket offsets, host rotation, target fallbacks and per-user
visibility. Worth running after editing anything in `scripts/eye.mjs`.

## Known limitations

The pupil is drawn just above the primary canvas group, which means it renders
over token artwork rather than interleaving with it by elevation. For a
background shadow this is invisible; if you put an eye on something that tokens
walk in front of, they will not correctly occlude the pupil.

Compatibility is declared through v14 but has not been verified against every
build. The module touches the canvas render loop, so if an eye stops appearing
after a Foundry update, enable **Debug logging** in the module settings and check
the console for the failing call.
