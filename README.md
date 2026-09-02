# Wondering Eye

A Foundry VTT module that attaches a gaze-tracking eye to any tile or token. A
pupil is drawn over the host artwork and continuously reorients toward a chosen
token, so a piece of set dressing can appear to watch a character as it moves.

Tracking runs entirely on each client, reading configuration from document
flags. Nothing is written to the database while the eye is moving, so there is
no network traffic per frame and no movement history to clean up.

## Installing on The Forge

In The Forge, open your game's **Add-on Modules** tab, choose **Install Module**,
and paste:

```
https://github.com/suideDev/FoundryVT-WonderingEye/releases/latest/download/module.json
```

Updates come from GitHub Releases. Tag `vX.Y.Z` to publish a new version; Foundry
then compares that release's `module.json` against the copy you already have.

## Setting up an eye

1. Place your artwork as a **Tile**. Large set-piece art works better as a tile
   than a token: it stays out of the turn order, cannot be targeted by accident,
   and does not interact with vision.
2. Open the tile's configuration and switch to the **Eye** tab.
3. Tick **Enable eye** and pick the token to watch under **Watch**.
4. Click **Pick on canvas**, then click the spot on the map where the eye should
   sit. This fills in Socket X and Y for you.
5. Choose a **Pupil** style, or supply your own **Pupil image**. Set **Travel X / Y**
   to control how far the pupil moves, and **Pupil size** for its diameter. Both
   are fractions of the tile's size, so they stay correct if you resize the tile
   later.
6. Save. The eye starts tracking immediately on every connected client.

Tokens work as hosts too, with the same tab in the token configuration sheet.
Prototype tokens are skipped, since there is no scene to pick a target from.

The tab is built by cloning the sheet's own navigation entry and tab panel, so
it inherits the correct markup instead of assuming a fixed structure. That also
means it coexists with modules that replace the tile sheet, such as Monk's
Active Tile Triggers. Sheets with no tab bar at all get the fields appended to
the end of the form instead.

## Settings reference

| Field | What it does |
| --- | --- |
| Watch | Token to follow. `Nearest player token` re-picks continuously. |
| Pupil | Built-in shape. Ignored if a pupil image is set. |
| Pupil image | Optional artwork. Blank uses the built-in style chosen above. |
| Tint / Opacity | Colour and alpha of the pupil. Any hex form is accepted. |
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

### Colour

The built-in pupils are drawn in white, so **Tint** multiplies against them
cleanly and any hex colour works. Short hex, long hex and hex with an alpha
suffix are all accepted.

The default **Slit** style is the original glowing vertical pupil. Round,
horizontal, diamond, star, crescent, cross and triangle punch a different hole
in the same glow. Ring is a hollow band of light, and orb is the glow with no
hole.

Be aware of how it interacts with **Additive glow**. Additive blending adds light
to whatever is underneath, so dark tints become faint and black vanishes
entirely. Leave it on for a bright pupil glowing out of dark artwork; turn it off
if you want a dark or muted pupil, and the tint will blend normally instead.

### Only visible to

Restrict the eye to specific players and only they will see it, while everyone
else sees the unaltered artwork. Gamemasters always see it regardless. Useful
when one character is meant to notice something the others do not.

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
  pupilStyle: "slit",
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
over token artwork rather than interleaving with it by elevation. For background
set dressing this is invisible; if you put an eye on something that tokens walk
in front of, they will not correctly occlude the pupil.

Compatibility is declared through v14 but has not been verified against every
build. The module touches the canvas render loop, so if an eye stops appearing
after a Foundry update, enable **Debug logging** in the module settings and check
the console for the failing call.
