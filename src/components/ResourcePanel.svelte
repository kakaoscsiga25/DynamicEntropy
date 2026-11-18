<script lang="ts">
  import { game, ui, selectResource } from '../ui/session.svelte';
  import { whole } from '../ui/format';

  // Stock and bars follow every tick.
  const groups = $derived.by(() => {
    ui.frame;
    const out: { name: string; rows: ReturnType<typeof row>[] }[] = [];
    game.resources.forEach((r, i) => {
      if (!game.isResourceVisible(r)) return;
      let g = out.find((x) => x.name === r.def.group);
      if (!g) out.push((g = { name: r.def.group, rows: [] }));
      g.rows.push(row(i));
    });
    return out;
  });

  function row(i: number) {
    const r = game.resources[i];
    return {
      id: r.id,
      name: r.name,
      icon: r.def.icon,
      color: r.def.color,
      amount: whole(r.amount),
      max: r.max,
      ratio: Math.max(0, Math.min(1, r.amount / r.max)),
    };
  }
</script>

<aside class="panel" aria-label="Resources">
  <h2>Resources</h2>
  {#each groups as g (g.name)}
    <section>
      <h3>{g.name}</h3>
      {#each g.rows as r (r.id)}
        <button
          class="row"
          class:focused={ui.hoverResource === r.id}
          class:selected={ui.selectedResource === r.id}
          onclick={() => selectResource(r.id)}
          onpointerenter={() => (ui.hoverResource = r.id)}
          onpointerleave={() => ui.hoverResource === r.id && (ui.hoverResource = null)}
        >
          <span class="icon">{r.icon}</span>
          <span class="name">{r.name}</span>
          <span class="amount"><b>{r.amount}</b><span class="max">/{r.max}</span></span>
          <span class="bar"><span style="width: {r.ratio * 100}%; background: {r.color}"></span></span>
        </button>
      {/each}
    </section>
  {/each}
</aside>

<style>
  .panel {
    height: 100%;
    overflow-y: auto;
    padding: 12px 12px 20px;
    box-sizing: border-box;
    background: var(--panel);
    border-right: 1px solid var(--border);
  }
  h2 {
    margin: 2px 4px 10px;
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h3 {
    margin: 10px 4px 2px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    opacity: 0.8;
  }
  /*
   * One compact line per resource. Numbers sit in right-aligned columns with
   * equal-width digits and a fixed number of decimals, so nothing shifts while
   * values change. The fill bar is a thin line along the bottom of the row.
   */
  .row {
    position: relative;
    display: grid;
    grid-template-columns: 18px 1fr auto;
    column-gap: 6px;
    align-items: center;
    width: 100%;
    height: 25px;
    padding: 0 6px 2px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
  }
  .row:hover,
  .row.focused {
    background: var(--panel-2);
  }
  .row.selected {
    background: var(--panel-2);
    border-color: var(--border);
  }
  .icon {
    font-size: 14px;
    line-height: 1;
  }
  .name {
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .amount {
    display: flex;
    font-size: 12px;
    white-space: nowrap;
  }
  .amount b {
    min-width: 3ch;
    text-align: right;
    font-weight: 650;
  }
  .max {
    min-width: 4ch;
    color: var(--muted);
  }
  .bar {
    position: absolute;
    left: 30px;
    right: 6px;
    bottom: 2px;
    height: 2px;
    border-radius: 1px;
    background: var(--panel-2);
    overflow: hidden;
  }
  .row:hover .bar,
  .row.focused .bar {
    background: var(--bg);
  }
  .bar span {
    display: block;
    height: 100%;
    transition: width 0.2s linear;
  }
</style>
