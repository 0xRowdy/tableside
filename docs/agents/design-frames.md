# Design frames

`design/Tableside.pen` holds every screen. UI follows the final frames, so read the frame before building or reviewing a screen.

## Reading the file

- The file is encrypted: read it through the pencil MCP tools only. Load them with ToolSearch (`mcp__pencil__*`), then read the server's skill with `read_skill` before the first `execute`.
- `execute` needs the file open in the Pen app and `filePath` set to the absolute path of `design/Tableside.pen`.
- Read-only: use `Get`, `Print`, `GetVariables` and `TakeScreenshot`. The file is edited only in the Pen app by its owner.
- The file keeps hidden leftovers. Skip every subtree with `enabled === false` or `visible === false`.
- Functions don't persist between `execute` calls: define helpers in the same call that uses them.

Dump one frame's visible text and layout:

```js
const dump = (id, maxDepth = 6) => Get(id, (n, c) => {
  if (n.enabled === false || n.visible === false || c.depth > maxDepth) { c.skipChildren(); return; }
  const b = c.bounds, pad = '  '.repeat(c.depth);
  if (n.type === 'text') Print(pad + 'T', n.id, JSON.stringify(n.content), n.fontSize, n.fontWeight, n.fill);
  else Print(pad + (n.type === 'ref' ? 'R:' + n.ref : n.type[0].toUpperCase()), n.id, n.name,
    Math.round(b.x), Math.round(b.y), Math.round(b.width) + 'x' + Math.round(b.height),
    n.layout || '', n.gap ?? '', JSON.stringify(n.padding ?? ''), n.fill || '');
}, { resolveInstances: true }); // add resolveVariables: true for hex values
dump('<frame id>', 4);
```

List a spec's top-level frames (a visitor-less `Get` is refused):

```js
Get((n, c) => { if (c.depth === 0) { c.skipChildren(); if (/S1-/.test(n.name || '')) Print(n.id, n.name, n.x, n.y); } });
```

`TakeScreenshot(['<frame id>'])` is costly; use it to settle a layout question the dump leaves open.

## Finding a spec's frames

- Frame names carry the screen code (`S1-04`, `S5-10`, …). Each spec's screens sit in their own canvas band:

  | Spec | Canvas y |
  | --- | --- |
  | 1 | 3720–14774 (phone tables, More/Settings, S1-01–S1-12) |
  | 4 | 31000–45450 |
  | 5 | 46500–59137 (S5-10/S5-11 allowance lines at 52900 supersede S1-02 for those lines) |
  | 6 | 60500–74900 |
  | 7 | 76500–89300 |

  Use the listing recipe for a spec not in the table.
- Build frames prefixed `[MVP]`; skip `[Later…]`, `superseded` and `retired` frames. A superseding frame names the frame it replaces.
- `Annotation — … (not UI)` frames under a screen are designer notes, in the pink `--annotation` color: read them, never draw them.
- The NOTES frame (`egBbr`, x 3700, y 5800) records design rulings per spec in columns, by question id (`Q3`, `S6-Q4`, …). Read the column for your spec.
- Phone frames are 390 wide; a frame without a fixed height scrolls.

## Copy

Frame copy is final, with one standing correction: the player-facing "Deviation log" is "Departures" (CONTEXT.md, *Strategy departure*). "Basic with deviations" stays: that is a playing deviation. A spec amendment can change other copy; later amendments win.

## Design tokens

The file's variables (`GetVariables()`, one `dark` theme) are the source of truth; the Design System frame `bi8Au` (x 0, y −1249) draws them. `apps/mobile/src/theme/tokens.ts` mirrors the subset the app uses:

- `palette` keys are the camelCase of the variable name (`--muted-foreground` → `mutedForeground`). Add a variable when a screen needs it, with an `essentialPairs` entry for any text or graphic use.
- `--space-1..16` → `space`, `--radius-*` → `radius`, `--font-display` (Fraunces) / `--font-ui` (Inter) → `fonts`. Load each font weight a screen uses.
- `--vp-*` and `--navy-*` (video poker, later) and `--annotation` stay out of the app.
