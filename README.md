# Dynamic Entropy

A relaxing idle game in the browser. You are dreaming: build production chains
(water, plants, fire, bricks, bread, tools...) until you can finally wake up.

**Play:** https://kakaoscsiga25.github.io/DynamicEntropy/

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
    content/         ALL game content, in plain data files:
      resources.ts     resources (icons, colors, storage, fading), islands, Health
      nodes.ts         nodes: what they use and make, cycle time, growth, map position
      node-upgrades.ts upgrades shown on a node, grouped by node
      upgrades.ts      Build panel upgrades, in sections (Home, Storage, Mind...)
      index.ts         puts them together
    defs.ts          The shapes of that data, with comments explaining each field
    engine.ts        The simulation: ticks, cycles, recipes, fading, fires, Health...
    save.ts          Save / load (localStorage)
    __tests__/       Tests (engine rules on a small made-up game, content checks, saves)
  sim/               Headless simulator + bots for balancing (npm run sim)
  ui/
    session.svelte.ts  Game loop, autosave, playtime, player actions, UI state
    layout.ts        Graph geometry: connection lines, island boxes, card rows
    format.ts        Number / time formatting
  components/        Svelte components (graph, node cards, panels, modals)
  App.svelte         Page layout
public/              Static files copied as-is (favicon, ending gif)
legacy/              The original v1.3.2 Brython version (reference only)
```

### Changing game content

Everything lives in `src/game/content/`; every field is explained in
`src/game/defs.ts`. Nodes run in the order they are listed in `nodes.ts`
(earlier ones get shared inputs first). `x`/`y` place the node on the map,
`region` puts it on an island. `npm test` checks the content for typos,
unreachable resources and costs that can never be paid.

Each node works in its own loop, a **cycle**: it takes the inputs when it starts
(or waits for them), runs (and may be interrupted, e.g. by falling asleep), and
at the end puts the outputs into storage once they fit (byproducts, the Field's
crops and Sleep / Wake up / nature fill up to the limit instead of waiting).
`cycle` sets its length in seconds (default 1 s; the game clock ticks every
0.1 s). Nodes that use a resource marked `awake` (Stamina) pause while you're
asleep.

The mechanics, in short:

- **Fading** (`fade` on a resource): it loses a share of its stock every second
  (food rots, fires cool, dreams are forgotten), so it settles where what comes
  in equals what fades. `into` turns the lost part into something else (Fruit →
  Compost). Preservation buildings slow it down.
- **Fires** are resources marked `heat` (temperatures). A fireplace has a
  `throttle` (wood per cycle, set by the player): more wood, hotter fire. Nodes
  with `heat: [min, max]` work while any fire is in that range.
- **The Field** has `parts` (crops) whose shares the player sets; `optional`
  inputs take what's there (fertilizer) and can `yield` something (Soil).
- **Growth**: output grows with a stock (linear, with an optional floor `base`),
  or `logistic` for living stocks (fish, sheep): fastest when half full.
- **Health** (`HEALTH` in resources.ts) follows the sum of its sources (food,
  warmth, home, hygiene: 110 together) and sets the Stamina limit and how much
  manual work makes.
- **Wear**: after a `tool` upgrade a node's tool wears out; sharpen it in time.
- **Mind** upgrades (paid with Insight from the dream journal) add skills
  (pace, thermostat, maintenance) and automatic rules (`guard`) to nodes.
- **Nature** nodes run by themselves and can't be stopped (fish spawning, water
  seeping into the mine).

### Balancing with the simulator

```bash
npm run sim                      # every bot, up to 24h of game time
npm run sim -- --bot micro --full --hours 12
```

Bots play the game headlessly (thousands of times faster than real time) and
report when they finished, the purchase timeline, how often each node was
running / waiting (and for what), and how full each resource was. Run it after
changing numbers in `content/`. Bots: `micro` (micromanages every tick),
`planner` (sensible, no micromanagement), `visit-10m` / `visit-30m` (check in
every 10 / 30 minutes), `idle` (turns everything on once; doesn't have to
finish). The visitors need longer limits: `--hours 30 --stuck 4`.

(Until v2.0 the rules were verified to match v1.3.2 exactly by a "golden" replay
test; it was retired when the rules started to change. See git history.)

## Releasing

Every push to `main` is tested, built and published to GitHub Pages by the
GitHub Action (`.github/workflows/build.yml`); "Run workflow" on the Actions page
does the same. A version tag also creates a GitHub Release with a zip:

```bash
git tag -a v2.1 -m "Dynamic Entropy v2.1"
git push origin main v2.1
```

One-time setup: in the repository settings, **Pages → Source → GitHub Actions**
(otherwise GitHub keeps publishing the raw repository, which shows a blank page).

## Legacy version

`legacy/` holds the original Python/Brython version (v1.3.2). To run it:
`cd legacy && python3 -m http.server`, then open http://localhost:8000.
