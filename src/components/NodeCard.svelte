<script lang="ts">
  import type { Converter, Recipe } from '../game/engine';
  import { ui, select, toggleConverter } from '../ui/session.svelte';
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
      buyable: conv.upgrades.filter((u) => u.isBuyable()).length,
      open: conv.upgrades.filter((u) => !u.bought).length,
    };
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
  <!-- The colored strip on the left is the on/off switch. -->
  {#if conv.unstoppable}
    <span class="power fixed" title="Always on, can't be stopped">∞</span>
  {:else}
    <button
      class="power"
      class:on={running}
      tabindex="-1"
      title={running ? `${STATE_LABEL[view.state]} · click to stop` : 'Stopped · click to start'}
      aria-label={running ? 'Stop' : 'Start'}
      onclick={onPower}
    >
      <span class="icon">{running ? '❚❚' : '▶'}</span>
    </button>
  {/if}

  <div class="body">
    <div class="head">
      <span class="name">{view.name}</span>
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
          <RecipeChip recipe={r} side="out" full={view.state === 'full'} />
        {/each}
      {/if}
    </div>
  </div>
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
    display: grid;
    place-items: center;
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
