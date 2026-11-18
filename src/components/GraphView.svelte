<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { game, ui, select, setRegionRunning } from '../ui/session.svelte';
  import { NODE_H, NODE_W, buildEdges, neighborMap, regionBoxes, worldBounds, type Edge } from '../ui/layout';
  import NodeCard from './NodeCard.svelte';
  import { STATE_LABEL, STATE_ORDER } from './states';

  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 1.8;
  /** Below this zoom the cards switch to a simplified, bigger-text "overview" look. */
  /** Below this zoom the cards collapse to big names (overview); detailed above it. */
  const FAR_ZOOM = 0.42;

  const edges = buildEdges(game);
  const neighbors = neighborMap(edges);
  const regionColor = Object.fromEntries(game.data.regions.map((r) => [r.id, r.color]));

  let viewport: HTMLDivElement;
  let view = $state({ x: 0, y: 0, k: 1 });

  // Same array until something new is discovered, so the islands aren't recomputed every tick.
  let discoveredCache: typeof game.converters = [];
  const discovered = $derived.by(() => {
    ui.frame;
    if (discoveredCache.length !== game.discovered.size) {
      discoveredCache = game.converters.filter((c) => game.discovered.has(c.id));
    }
    return discoveredCache;
  });
  const boxes = $derived(
    regionBoxes(game, discovered).map((b) => ({
      ...b,
      stoppable: discovered.filter((c) => c.def.region === b.id && !c.unstoppable).length,
    })),
  );

  // ------------------------------------------------------------ focus / highlight

  /**
   * What the map is focused on. Hovering is a "strong" focus (dims everything
   * unrelated); a selection is a "weak" one (only highlights).
   */
  const focus = $derived.by(() => {
    if (ui.hoverResource) return { kind: 'res' as const, id: ui.hoverResource, strong: true };
    if (ui.hoverNode) return { kind: 'node' as const, id: ui.hoverNode, strong: true };
    if (ui.selectedResource) return { kind: 'res' as const, id: ui.selectedResource, strong: false };
    if (ui.selected) return { kind: 'node' as const, id: ui.selected, strong: false };
    return null;
  });

  const nodeFocus = $derived.by(() => {
    ui.frame;
    const map = new Map<string, string>();
    if (!focus) return map;
    for (const c of discovered) {
      if (focus.kind === 'node') {
        const related = c.id === focus.id || neighbors.get(focus.id)?.has(c.id);
        map.set(c.id, related || !focus.strong ? '' : 'dim');
      } else {
        const uses = c.needs.some((n) => n.resource.id === focus.id && n.kind !== 'none');
        const makes = c.makes.some((m) => m.resource.id === focus.id && m.amount > 0);
        const cls = uses && makes ? 'both' : uses ? 'consumer' : makes ? 'producer' : focus.strong ? 'dim' : 'faint';
        map.set(c.id, cls);
      }
    }
    return map;
  });

  function edgeActive(e: Edge): boolean {
    if (e.catalyst) {
      const need = e.to.needs.find((n) => n.resource === e.resource);
      return !!need && e.resource.amount >= need.atLeast && e.resource.amount < need.atMost;
    }
    return e.from.state === 'ok';
  }

  function related(e: Edge): boolean {
    if (!focus) return false;
    return focus.kind === 'node' ? e.from.id === focus.id || e.to.id === focus.id : e.resource.id === focus.id;
  }

  const visibleEdges = $derived.by(() => {
    ui.frame;
    return edges
      .filter((e) => game.discovered.has(e.from.id) && game.discovered.has(e.to.id))
      .filter((e) => !e.onDemand || related(e))
      .map((e) => {
        const emphasis = !focus ? '' : related(e) ? 'hi' : focus.strong ? 'lo' : '';
        return { e, active: edgeActive(e), emphasis };
      });
  });

  // ------------------------------------------------------------ pan & zoom

  const pointers = new Map<number, { x: number; y: number }>();
  let dragDistance = 0;
  let pinchDistance = 0;

  function zoomAt(px: number, py: number, factor: number) {
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
    const f = k / view.k;
    view = { x: px - (px - view.x) * f, y: py - (py - view.y) * f, k };
  }

  function localPoint(clientX: number, clientY: number) {
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as Element).closest('.node, .controls, .legend, .rbtn')) return;
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragDistance = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragDistance += Math.abs(dx) + Math.abs(dy);

    if (pointers.size === 1) {
      // Screen pixels map 1:1 to the translation, so panning speed is right at any zoom.
      view = { ...view, x: view.x + dx, y: view.y + dy };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = localPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (pinchDistance > 0) zoomAt(mid.x, mid.y, dist / pinchDistance);
      pinchDistance = dist;
      view = { ...view, x: view.x + dx / 2, y: view.y + dy / 2 };
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    pinchDistance = 0;
    // A click (not a drag) on empty space closes the details panel.
    if (pointers.size === 0 && dragDistance < 5) select(null);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const p = localPoint(e.clientX, e.clientY);
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * unit * 0.0015));
  }

  function zoomButton(factor: number) {
    zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, factor);
  }

  /** Fits everything discovered so far into the view. */
  export function fit() {
    const b = worldBounds(discovered);
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const margin = 48;
    const k = Math.min(1, Math.max(MIN_ZOOM, Math.min((vw - margin * 2) / b.w, (vh - margin * 2) / b.h)));
    view = { x: (vw - b.w * k) / 2 - b.x * k, y: (vh - b.h * k) / 2 - b.y * k, k };
  }

  /** When a node gets selected, make sure it isn't hidden (e.g. behind the mobile details sheet). */
  $effect(() => {
    const id = ui.selected;
    if (!id) return;
    tick().then(() => {
      const c = game.converter(id);
      const vw = viewport.clientWidth;
      // On phones the details sheet covers the bottom 62% of the screen.
      const vh = window.innerWidth <= 820 ? viewport.clientHeight - window.innerHeight * 0.62 : viewport.clientHeight;
      const x = view.x + (c.def.x + NODE_W / 2) * view.k;
      const y = view.y + (c.def.y + NODE_H / 2) * view.k;
      const m = 60;
      if (x < m || x > vw - m || y < m || y > vh - m) {
        view = { ...view, x: view.x + vw / 2 - x, y: view.y + Math.max(m, vh / 2) - y };
      }
    });
  });

  onMount(() => {
    fit();
    // Non-passive listener, so the page itself doesn't scroll while zooming.
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  });
</script>

<div
  class="viewport"
  bind:this={viewport}
  role="application"
  aria-label="Production graph. Drag to move, scroll or pinch to zoom."
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  style="background-position: {view.x}px {view.y}px; background-size: {32 * view.k}px {32 * view.k}px"
>
  <div class="world" class:far={view.k < FAR_ZOOM} style="transform: translate({view.x}px, {view.y}px) scale({view.k})">
    {#each boxes as r (r.id)}
      <div
        class="region"
        style="left: {r.x}px; top: {r.y}px; width: {r.w}px; height: {r.h}px; --rc: {r.color}"
      >
        <div class="region-head">
          <span class="region-name">{r.name}</span>
          {#if r.stoppable > 0}
            <button class="rbtn" title="Start every node on {r.name}" onclick={() => setRegionRunning(r.id, true)}>▶ all</button>
            <button class="rbtn" title="Stop every node on {r.name}" onclick={() => setRegionRunning(r.id, false)}>❚❚ all</button>
          {/if}
        </div>
      </div>
    {/each}

    <svg class="edges" width="1" height="1" aria-hidden="true">
      {#each visibleEdges as { e, active, emphasis } (e.id)}
        <g
          class="edge {emphasis}"
          class:active
          class:catalyst={e.catalyst}
          class:ondemand={e.onDemand}
          style="--c: {e.resource.def.color}"
        >
          <path class="line" d={e.d} />
          {#if active && !e.catalyst}
            <path class="flow" d={e.d} />
          {/if}
          <circle class="port" cx={e.start[0]} cy={e.start[1]} r="3.5" />
          <polygon class="arrow" points={e.arrow} />
          <g transform="translate({e.mid[0]} {e.mid[1]})">
            <g class="tag">
              <circle r="11" />
              <text text-anchor="middle" dominant-baseline="central" y="1">{e.resource.def.icon}</text>
            </g>
          </g>
        </g>
      {/each}
    </svg>

    {#each discovered as c (c.id)}
      <NodeCard conv={c} accent={regionColor[c.def.region]} focus={nodeFocus.get(c.id) ?? ''} />
    {/each}
  </div>

  <div class="controls">
    <button onclick={() => zoomButton(1.25)} title="Zoom in" aria-label="Zoom in">+</button>
    <button onclick={() => zoomButton(0.8)} title="Zoom out" aria-label="Zoom out">−</button>
    <button onclick={fit} title="Fit to screen" aria-label="Fit to screen">⤢</button>
  </div>

  <div class="legend" aria-label="Legend">
    {#each STATE_ORDER as s}
      <span><i class="sw state-{s}"></i>{STATE_LABEL[s]}</span>
    {/each}
    <span class="sep"></span>
    <span><i class="ln"></i>Flow</span>
    <span><i class="ln dashed"></i>Needs stock</span>
    <span class="sep"></span>
    <span>⚡💧🔥 lines appear on hover</span>
  </div>
</div>

<style>
  .viewport {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
    background-color: var(--bg);
    background-image: radial-gradient(circle, var(--grid) 1px, transparent 1.2px);
  }
  .viewport:active {
    cursor: grabbing;
  }
  .world {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
  }
  .region {
    position: absolute;
    box-sizing: border-box;
    border-radius: 22px;
    background: color-mix(in srgb, var(--rc) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--rc) 22%, transparent);
    animation: reveal 0.6s ease-out;
    transition: left 0.4s, top 0.4s, width 0.4s, height 0.4s;
  }
  .region-head {
    position: absolute;
    left: 18px;
    top: 7px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .region-name {
    margin-right: 4px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--rc) 75%, var(--text));
  }
  .rbtn {
    padding: 1px 7px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--rc) 30%, transparent);
    background: transparent;
    color: color-mix(in srgb, var(--rc) 60%, var(--muted));
    font-size: 10px;
    cursor: pointer;
    opacity: 0.75;
  }
  .rbtn:hover {
    opacity: 1;
    color: var(--text);
    background: color-mix(in srgb, var(--rc) 22%, transparent);
  }
  .far .region-head {
    top: -40px;
    left: 8px;
    gap: 10px;
  }
  .far .region-name {
    font-size: 22px;
  }
  .far .rbtn {
    font-size: 16px;
    padding: 2px 10px;
    border-radius: 8px;
  }
  .edges {
    position: absolute;
    left: 0;
    top: 0;
    overflow: visible;
    pointer-events: none;
  }
  .edge {
    transition: opacity 0.15s;
    opacity: 0.45;
  }
  .edge.active {
    opacity: 0.85;
  }
  .edge.hi {
    opacity: 1;
  }
  .edge.lo {
    opacity: 0.08;
  }
  .line {
    fill: none;
    stroke: var(--c);
    stroke-width: 2;
  }
  .edge.hi .line {
    stroke-width: 3;
  }
  .catalyst .line {
    stroke-dasharray: 4 5;
    stroke-width: 1.5;
  }
  .flow {
    fill: none;
    stroke: var(--text);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-dasharray: 1 13;
    opacity: 0.8;
    animation: flow 0.9s linear infinite;
  }
  .port,
  .arrow {
    fill: var(--c);
  }
  .tag circle {
    fill: var(--node-bg);
    stroke: var(--c);
    stroke-width: 1.5;
  }
  .tag text {
    font-size: 12px;
  }
  .far .tag {
    transform: scale(1.7);
  }
  .ondemand .line {
    stroke-width: 1.5;
  }
  .controls {
    position: absolute;
    right: 14px;
    bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .controls button {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    font-size: 18px;
    cursor: pointer;
  }
  .controls button:hover {
    border-color: var(--muted);
  }
  .legend {
    position: absolute;
    left: 14px;
    bottom: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    max-width: calc(100% - 90px);
    padding: 7px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 85%, transparent);
    border: 1px solid var(--border);
    font-size: 11px;
    color: var(--muted);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .legend .sep {
    width: 1px;
    align-self: stretch;
    background: var(--border);
  }
  .sw {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .sw {
    background: var(--state);
  }
  .ln {
    width: 18px;
    border-top: 2px solid var(--muted);
  }
  .ln.dashed {
    border-top-style: dashed;
  }
  @keyframes flow {
    to {
      stroke-dashoffset: -14;
    }
  }
  @keyframes reveal {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flow {
      animation: none;
    }
  }
  @media (max-width: 820px) {
    .legend {
      display: none;
    }
  }
</style>
