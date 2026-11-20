<script lang="ts" module>
  import type { Recipe } from '../game/engine';
  import { num } from '../ui/format';

  /** A stock limit as text: "80%" of the storage limit, or a number. */
  export function limitText(r: Recipe, value: number): string {
    return r.ofMax ? `${Math.round(value * 100)}%` : num(value);
  }

  /** Human readable explanation of a recipe line (used for tooltips and the details panel). */
  export function recipeText(r: Recipe, side: 'in' | 'out', amount = r.amount): string {
    const name = r.resource.name;
    if (side === 'out') return `${name}: makes ${num(amount)} per cycle${r.byproduct ? ' (side product, never waits for room)' : ''}`;
    switch (r.kind) {
      case 'consume':
        return r.atLeast > r.amount
          ? `${name}: uses ${num(amount)} per cycle, only while stock is at least ${num(r.atLeast)}`
          : `${name}: uses ${num(amount)} per cycle`;
      case 'optional': {
        const extra = r.atLeast > 0 ? ` above ${num(r.atLeast)}` : '';
        const gives = r.yields ? `, each gives ${num(r.yields.amount)} ${r.yields.resource.name}` : '';
        return `${name}: takes what's there${extra}, up to ${num(amount)} per cycle${gives}. Never waits for it.`;
      }
      case 'catalyst':
        return `${name}: needs at least ${limitText(r, r.atLeast)} in stock (not used up)`;
      case 'condition':
        return r.atMost === 0 ? `Only while ${name} is 0` : `Only while ${name} is at most ${limitText(r, r.atMost)}`;
      case 'heat':
        return `Needs a fire at ${num(r.atLeast)}–${num(r.atMost)}° (any fire will do)`;
      default:
        return name;
    }
  }
</script>

<script lang="ts">
  import { ui, selectResource } from '../ui/session.svelte';

  let {
    recipe,
    side,
    bad = false,
    full = false,
    value,
  }: {
    recipe: Recipe;
    side: 'in' | 'out';
    bad?: boolean;
    full?: boolean;
    /** Current amount when it differs from the recipe (growth, pace). One decimal (two below 1). */
    value?: number;
  } = $props();

  const kind = $derived(side === 'out' ? 'out' : recipe.kind);
  const id = $derived(recipe.resource.id);
  /** Heat lines: the fire in range (or the first one). */
  const heatRes = $derived.by(() => {
    ui.frame;
    return recipe.heat?.find((r) => r.amount >= recipe.atLeast && r.amount <= recipe.atMost) ?? recipe.resource;
  });

  function onClick(e: MouseEvent) {
    e.stopPropagation(); // don't also select the node
    selectResource(kind === 'heat' ? heatRes.id : id);
  }
</script>

{#if kind !== 'none'}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <span
    class="chip {kind}"
    class:bad
    class:full
    style="--c: {recipe.resource.def.color}"
    title="{recipeText(recipe, side, value ?? recipe.amount)} · click for details"
    role="button"
    tabindex="-1"
    onclick={onClick}
    onpointerenter={() => (ui.hoverResource = kind === 'heat' ? heatRes.id : id)}
    onpointerleave={() => ui.hoverResource === (kind === 'heat' ? heatRes.id : id) && (ui.hoverResource = null)}
  >
    <span class="icon">{kind === 'heat' ? heatRes.def.icon : recipe.resource.def.icon}</span>
    <span class="val">
      {#if kind === 'catalyst'}
        <span class="op">≥</span>{limitText(recipe, recipe.atLeast)}
      {:else if kind === 'condition'}
        <span class="op">{recipe.atMost === 0 ? '=' : '≤'}</span>{limitText(recipe, recipe.atMost)}
      {:else if kind === 'heat'}
        {num(recipe.atLeast)}–{num(recipe.atMost)}<span class="op">°</span>
      {:else if kind === 'optional'}
        <span class="op">≤</span>{num(value ?? recipe.amount)}
      {:else if value !== undefined}
        <span class="grown">{value.toFixed(value < 1 ? 2 : 1)}</span>
      {:else}
        {#if side === 'in' && recipe.atLeast > recipe.amount}
          <span class="min">≥{num(recipe.atLeast)}</span>
        {/if}
        {num(recipe.amount)}
      {/if}
    </span>
  </span>
{/if}

<style>
  /* One row of a node's input or output table: icon left, number right. */
  .chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    box-sizing: border-box;
    width: 100%;
    height: 19px;
    padding: 0 6px 0 4px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--text);
    background: color-mix(in srgb, var(--c) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
    cursor: pointer;
    transition: background 0.12s;
  }
  .chip:hover {
    background: color-mix(in srgb, var(--c) 38%, transparent);
  }
  .icon {
    font-size: 13px;
    line-height: 1;
  }
  .grown {
    color: #c8f7d4;
  }
  .op,
  .min {
    color: var(--muted);
    font-weight: 500;
  }
  .val {
    white-space: nowrap;
  }
  .min {
    font-size: 10px;
    margin-right: 3px;
  }
  .catalyst {
    background: transparent;
    border-style: dashed;
  }
  .condition {
    background: transparent;
    border-style: dotted;
    color: var(--muted);
  }
  .optional {
    background: color-mix(in srgb, var(--c) 8%, transparent);
    border-style: dotted;
  }
  .heat {
    background: transparent;
    border-style: dashed;
  }
  .bad {
    border-color: var(--bad);
    background: color-mix(in srgb, var(--bad) 22%, transparent);
    box-shadow: 0 0 0 1px var(--bad);
  }
  .full {
    border-color: var(--st-full);
    background: color-mix(in srgb, var(--st-full) 22%, transparent);
    box-shadow: 0 0 0 1px var(--st-full);
  }
</style>
