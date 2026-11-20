<script lang="ts">
  // The Field's crops as one bar: drag the handles between them to change the shares.
  import type { Converter } from '../game/engine';
  import { ui, setShares } from '../ui/session.svelte';

  let { conv, big = false }: { conv: Converter; big?: boolean } = $props();

  /** Shares move in 5% steps. */
  const STEP = 0.05;

  const shares = $derived.by(() => {
    ui.frame;
    return [...conv.shares];
  });
  /** Where each handle is: the running sum of the shares before it. */
  const cuts = $derived(shares.slice(0, -1).map((_, i) => shares.slice(0, i + 1).reduce((a, b) => a + b, 0)));

  let bar: HTMLDivElement;
  let dragging = $state(-1);

  function onDown(i: number, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    dragging = i;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (dragging < 0) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width / STEP) * STEP;
    const c = [...cuts];
    const lo = dragging > 0 ? c[dragging - 1] : 0;
    const hi = dragging < c.length - 1 ? c[dragging + 1] : 1;
    c[dragging] = Math.min(hi, Math.max(lo, x));
    const next = c.map((v, i) => v - (i > 0 ? c[i - 1] : 0));
    next.push(1 - c[c.length - 1]);
    setShares(conv.id, next);
  }

  const pct = (x: number) => `${Math.round(x * 100)}%`;
</script>

<div class="parts" class:big role="group" aria-label="Crop shares">
  <div class="bar" bind:this={bar}>
    {#each conv.parts as p, i (p.id)}
      <span
        class="seg"
        style="flex: {Math.max(shares[i], 0.0001)}; --pc: {p.color}"
        title="{p.name}: {pct(shares[i])} of the field">
        {#if shares[i] >= (big ? 0.12 : 0.2)}<span class="lbl">{p.icon} {pct(shares[i])}</span>{/if}
      </span>
    {/each}
    {#each cuts as c, i}
      <span
        class="handle"
        class:active={dragging === i}
        style="left: {c * 100}%"
        role="slider"
        tabindex="-1"
        aria-label="Border between {conv.parts[i].name} and {conv.parts[i + 1].name}"
        aria-valuenow={Math.round(c * 100)}
        onpointerdown={(e) => onDown(i, e)}
        onpointermove={onMove}
        onpointerup={() => (dragging = -1)}
        onpointercancel={() => (dragging = -1)}
      ></span>
    {/each}
  </div>
</div>

<style>
  .parts {
    padding: 2px 0;
  }
  .bar {
    position: relative;
    display: flex;
    height: 18px;
    border-radius: 6px;
    overflow: visible;
    background: var(--bg);
  }
  .big .bar {
    height: 26px;
  }
  .seg {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: color-mix(in srgb, var(--pc) 30%, transparent);
    border-top: 1px solid color-mix(in srgb, var(--pc) 55%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--pc) 55%, transparent);
    font-size: 10.5px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .big .seg {
    font-size: 12px;
  }
  .seg:first-child {
    border-radius: 6px 0 0 6px;
  }
  .seg:nth-child(3) {
    border-radius: 0 6px 6px 0;
  }
  .lbl {
    pointer-events: none;
  }
  .handle {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 10px;
    margin-left: -5px;
    border-radius: 4px;
    background: var(--text);
    border: 2px solid var(--panel);
    box-sizing: border-box;
    cursor: ew-resize;
    touch-action: none;
  }
  .handle:hover,
  .handle.active {
    background: var(--upgrade);
  }
</style>
