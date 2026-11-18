<script lang="ts">
  import type { Converter, Recipe } from '../game/engine';
  import { game, ui, select, toggleConverter } from '../ui/session.svelte';
  import { NODE_W, NODE_H } from '../ui/layout';
  import RecipeChip from './RecipeChip.svelte';
  import { STATE_LABEL } from './states';

  let {
    conv,
    accent,
    focus = '',
  }: {
    conv: Converter;
    accent: string;
    /** '', 'dim', 'faint', 'producer', 'consumer' or 'both' (set by the graph when something is focused). */
    focus?: string;
  } = $props();

  // Engine objects aren't reactive: re-read them whenever ui.frame changes.
  const view = $derived.by(() => {
    ui.frame;
    return {
      name: conv.name,
      state: conv.state,
      needs: [...conv.needs],
      makes: [...conv.makes],
      blocking: new Set<Recipe>(conv.state === 'noInput' ? conv.blockingNeeds() : []),
      factor: conv.growthFactor(),
      buyable: conv.upgrades.filter((u) => u.isBuyable()).length,
      open: conv.upgrades.filter((u) => !u.bought).length,
      pace: conv.pace,
      pending: conv.pacePending,
      showPace: !conv.unstoppable && game.paceMax() > 0 && (conv.pace !== 1 || conv.pacePending),
    };
  });

  // Cycle progress, shown for cycles of 1 s or longer (slow pace or a long cycle).
  let lastProgress = 0;
  const bar = $derived.by(() => {
    ui.frame;
    const pace = conv.cycle?.pace ?? conv.activePace;
    if (conv.cycleTicks / pace < 2) return null;
    // No cycle but running: one just ended this tick.
    const progress = conv.cycle ? conv.cycle.progress : conv.state === 'ok' ? 1 : 0;
    const restarted = progress < lastProgress; // jump back without animating
    lastProgress = progress;
    return { progress, restarted, paused: conv.state !== 'ok' };
  });

  const running = $derived(view.state !== 'stopped');

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    toggleConverter(conv.id);
  }

  function onPower(e: MouseEvent) {
    e.stopPropagation();
    toggleConverter(conv.id);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      select(conv.id);
    } else if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      toggleConverter(conv.id);
    }
  }
</script>

<div
  class="node state-{view.state} {focus}"
  class:selected={ui.selected === conv.id}
  style="left: {conv.def.x}px; top: {conv.def.y}px; width: {NODE_W}px; min-height: {NODE_H}px; --accent: {accent}"
  role="button"
  tabindex="0"
  aria-label="{view.name}, {STATE_LABEL[view.state]}. Enter: details, Space: start or stop."
  onclick={() => select(conv.id)}
  onkeydown={onKey}
  oncontextmenu={onContextMenu}
  onpointerenter={() => (ui.hoverNode = conv.id)}
  onpointerleave={() => ui.hoverNode === conv.id && (ui.hoverNode = null)}
>
  <!-- The colored strip on the left is the on/off switch; it also shows the pace when it isn't 100%. -->
  {#if conv.unstoppable}
    <span class="power fixed" title="Always on, can't be stopped">∞</span>
  {:else}
    {@const paceText = view.showPace ? ` · pace ${Math.round(view.pace * 100)}%${view.pending ? ', applies when the next cycle starts' : ''}` : ''}
    <button
      class="power"
      class:on={running}
      tabindex="-1"
      title={(running ? `${STATE_LABEL[view.state]} · click to stop` : 'Stopped · click to start') + paceText}
      aria-label={running ? 'Stop' : 'Start'}
      onclick={onPower}
    >
      <span class="icon">{running ? '❚❚' : '▶'}</span>
      {#if view.showPace}
        <span class="pace" class:over={view.pace > 1} class:pending={view.pending}>{Math.round(view.pace * 100)}%</span>
        {#if view.pending}<span class="wait">⏳</span>{/if}
      {/if}
    </button>
  {/if}

  <div class="body">
    <div class="head">
      <span class="name">{view.name}</span>
      {#if conv.growth}
        <span
          class="growth"
          class:max={view.factor >= conv.growth.maxFactor - 1e-9}
          title="Output ×{view.factor.toFixed(1)} (max ×{conv.growth.maxFactor}): grows with {conv.growth.resource.name} above {conv.growthThreshold()}"
          >×{view.factor.toFixed(1)}</span
        >
      {/if}
      {#if view.buyable > 0}
        <span class="badge ready" title="{view.buyable} upgrade(s) can be bought">⬆ {view.buyable}</span>
      {:else if view.open > 0}
        <span class="badge" title="{view.open} upgrade(s) available later">⬆ {view.open}</span>
      {/if}
    </div>
    <div class="io">
      {#each view.needs as r (r)}
        <RecipeChip recipe={r} side="in" bad={view.blocking.has(r)} />
      {/each}
      {#if view.makes.length > 0}
        <span class="arrow">→</span>
        {#each view.makes as r (r)}
          <RecipeChip
            recipe={r}
            side="out"
            full={view.state === 'full'}
            value={!r.byproduct && (conv.growth || view.pace !== 1) ? conv.output(r, view.factor) : undefined}
          />
        {/each}
      {/if}
    </div>
  </div>
  {#if bar}
    <span class="cycle" class:paused={bar.paused} aria-hidden="true">
      <span class:restarted={bar.restarted} style="width: {bar.progress * 100}%"></span>
    </span>
  {/if}
</div>

<style>
  .node {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    border-radius: 12px;
    background: var(--node-bg);
    border: 1px solid var(--border);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
    cursor: pointer;
    user-select: none;
    transition: opacity 0.15s, border-color 0.15s, box-shadow 0.15s;
    overflow: hidden;
  }
  .node:hover,
  .node:focus-visible {
    border-color: var(--accent);
    outline: none;
  }
  .node.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent), 0 6px 18px rgb(0 0 0 / 0.35);
  }
  .node.dim {
    opacity: 0.28;
  }
  .node.faint {
    opacity: 0.55;
  }
  .node.producer {
    box-shadow: 0 0 0 2px var(--ok), 0 0 18px color-mix(in srgb, var(--ok) 45%, transparent);
  }
  .node.consumer {
    box-shadow: 0 0 0 2px var(--bad), 0 0 18px color-mix(in srgb, var(--bad) 45%, transparent);
  }
  .node.both {
    box-shadow: 0 0 0 2px var(--warn), 0 0 18px color-mix(in srgb, var(--warn) 45%, transparent);
  }

  .state-ok { --state: var(--ok); }
  .state-stopped { --state: var(--stopped); }
  .state-noInput { --state: var(--warn); }
  .state-full { --state: var(--full); }

  /* ---- on/off strip */
  .power {
    flex: none;
    width: 30px;
    padding: 0;
    border: none;
    border-right: 1px solid color-mix(in srgb, var(--state) 40%, transparent);
    background: color-mix(in srgb, var(--state) 22%, transparent);
    color: var(--state);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: background 0.15s, color 0.15s;
  }
  .power:hover {
    background: color-mix(in srgb, var(--state) 45%, transparent);
    color: var(--text);
  }
  .power.on .icon {
    animation: pulse 1.6s ease-in-out infinite;
  }
  .state-stopped .power {
    color: var(--muted);
  }
  .state-stopped .power:hover {
    background: color-mix(in srgb, var(--ok) 35%, transparent);
    color: var(--text);
  }
  .power.fixed {
    cursor: default;
    font-size: 15px;
    color: var(--dream);
  }

  /* ---- content */
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    padding: 8px 8px 9px 9px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-weight: 650;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .state-stopped .name {
    color: var(--muted);
  }
  .growth {
    flex: none;
    min-width: 3.2ch;
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: #a8f0bc;
  }
  .growth.max {
    color: var(--ok);
  }
  :global(.far) .growth {
    display: none; /* overview: the name matters more */
  }
  /* pace shown in the strip, under the on/off icon */
  .pace {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    color: #bfe3ff;
  }
  .pace.over {
    color: #ffd2b0;
  }
  .pace.pending {
    color: var(--muted);
  }
  .wait {
    font-size: 10px;
    line-height: 1;
  }
  :global(.far) .pace {
    font-size: 13px;
  }
  .cycle {
    position: absolute;
    left: 30px;
    right: 0;
    bottom: 0;
    height: 3px;
    background: color-mix(in srgb, var(--state) 15%, transparent);
  }
  .cycle span {
    display: block;
    height: 100%;
    background: var(--state);
    transition: width 0.5s linear;
  }
  .cycle span.restarted {
    transition: none;
  }
  .cycle.paused span {
    opacity: 0.5;
  }
  :global(.far) .cycle {
    left: 46px;
    height: 5px;
  }
  .badge {
    flex: none;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 8px;
    color: var(--muted);
    border: 1px solid var(--border);
  }
  .badge.ready {
    color: #10131f;
    background: var(--upgrade);
    border-color: var(--upgrade);
    box-shadow: 0 0 10px color-mix(in srgb, var(--upgrade) 60%, transparent);
  }
  .io {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-wrap: wrap;
  }
  .arrow {
    color: var(--muted);
    margin: 0 1px;
    font-size: 12px;
  }

  /* ---- Overview ("far") zoom: no chips, big names, state shown as card color. */
  :global(.far) .node {
    background: color-mix(in srgb, var(--state) 16%, var(--node-bg));
    border-color: color-mix(in srgb, var(--state) 45%, var(--border));
  }
  :global(.far) .power {
    width: 46px;
    font-size: 18px;
  }
  :global(.far) .power.fixed {
    font-size: 24px;
  }
  :global(.far) .body {
    justify-content: center;
  }
  :global(.far) .io {
    display: none;
  }
  :global(.far) .name {
    font-size: 22px;
    line-height: 1.15;
    white-space: normal;
    text-align: center;
  }
  :global(.far) .badge {
    font-size: 16px;
    padding: 2px 8px;
  }

  @keyframes pulse {
    50% {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .power.on .icon {
      animation: none;
    }
  }
</style>
