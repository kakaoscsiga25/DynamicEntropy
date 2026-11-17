# Dynamic Entropy

A relaxing idle game in the browser. You are dreaming: build production chains
(water, plants, fire, bricks, bread, tools...) until you can finally wake up.

The whole game builds into a **single `index.html`** (~110 KB). It runs from
GitHub Pages, or straight from disk after downloading the zip from a GitHub Release.

## Development

Requires Node.js 22+ (24 LTS recommended).

```bash
npm install        # once
npm run dev        # dev server with hot reload: http://localhost:5173
npm test           # unit tests (game logic, saves)
npm run check      # TypeScript / Svelte type check
npm run build      # production build into dist/
npm run sim        # balance simulator (bots play the game, see below)
```

Add `?dev` to the URL to get a 10× speed toggle in the top bar.

## Project layout

```
src/
  game/              Game logic, no UI code (unit tested)
    data.ts          ALL game content: resources, converters (nodes), upgrades,
                     plus visual data (icons, colors, islands, node positions)
    defs.ts          The shapes of that data, with comments explaining each field
    engine.ts        The simulation: ticks, recipes, upgrades, discovery
    save.ts          Save / load (localStorage), migration of v1 saves
    __tests__/       Tests
  sim/               Headless simulator + bots for balancing (npm run sim)
  ui/
    session.svelte.ts  Game loop, autosave, playtime, player actions, UI state
    layout.ts        Graph geometry: connection lines, island boxes
    format.ts        Number / time formatting
  components/        Svelte components (graph, node cards, panels, modals)
  App.svelte         Page layout
public/              Static files copied as-is (favicon, ending gif)
legacy/              The original v1.3.2 Brython version (reference only)
```

### Changing game content

Everything lives in `src/game/data.ts`. Converters run in the order they are
listed (earlier ones get shared inputs first). `x`/`y` place the node on the map,
`region` puts it on an island.

Upgrades marked `building: true` appear in the **Build** panel instead of on a
node; `capacity` raises storage limits.

### Balancing with the simulator

```bash
npm run sim                      # every bot, up to 24h of game time
npm run sim -- --bot planner --full --hours 12
```

Bots play the game headlessly (thousands of times faster than real time) and
report when they finished, the purchase timeline, how often each node was
running / waiting (and for what), and how full each resource was. Run it after
changing numbers in `data.ts`.

(Until v2.0 the rules were verified to match v1.3.2 exactly by a "golden" replay
test; it was retired when the rules started to change. See git history.)

## Releasing

```bash
git tag v2.0.0
git push origin v2.0.0
```

The GitHub Action (`.github/workflows/build.yml`) then tests and builds the game,
publishes it to GitHub Pages, and creates a GitHub Release with a zip.

One-time setup: in the repository settings, **Pages → Source → GitHub Actions**.

## Legacy version

`legacy/` holds the original Python/Brython version (v1.3.2). To run it:
`cd legacy && python3 -m http.server`, then open http://localhost:8000.
