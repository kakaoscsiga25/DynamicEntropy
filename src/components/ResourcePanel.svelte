<script lang="ts">
  import { game, ui, resourceTrend, selectResource, type Trend } from '../ui/session.svelte';
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

  // Rates change only once per second, so they are readable.
  const trends = $derived.by(() => {
    ui.second;
    const map = new Map<string, Trend>();
    game.resources.forEach((r, i) => map.set(r.id, resourceTrend(i)));
    return map;
  });

  function row(i: number) {
    const r = game.resources[i];
    return {
      id: r.id,
      name: r.name,
      icon: r.def.icon,
      color: r.def.color,
      amount: whole(r.amount),
      exact: r.amount.toFixed(2),
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
        {@const t = trends.get(r.id)}
        <button
          class="row"
          class:focused={ui.hoverResource === r.id}
          class:selected={ui.selectedResource === r.id}
          title="{r.name}: {r.exact} / {r.max}. Click to see who makes and uses it."
          onclick={() => selectResource(r.id)}
          onpointerenter={() => (ui.hoverResource = r.id)}
          onpointerleave={() => ui.hoverResource === r.id && (ui.hoverResource = null)}
        >
          <span class="icon">{r.icon}</span>
          <span class="name">{r.name}</span>
          <span class="amount"><b>{r.amount}</b><span class="max">/{r.max}</span></span>
          <span class="bar"><span style="width: {r.ratio * 100}%; background: {r.color}"></span></span>
          <span class="rate {t?.direction ?? ''}">{t?.text ?? ''}</span>
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
    margin: 14px 4px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    opacity: 0.8;
  }
  /*
   * Fixed layout: numbers sit in right-aligned columns with equal-width digits
   * and a fixed number of decimals, so nothing shifts while values change.
   */
  .row {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    grid-template-areas:
      'icon name amount'
      'icon bar rate';
    column-gap: 8px;
    row-gap: 3px;
    align-items: center;
    width: 100%;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
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
    grid-area: icon;
    font-size: 17px;
    align-self: start;
    margin-top: 1px;
  }
  .name {
    grid-area: name;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .amount {
    grid-area: amount;
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
    display: block;
    grid-area: bar;
    height: 5px;
    border-radius: 3px;
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
    border-radius: 3px;
    transition: width 0.45s linear;
  }
  .rate {
    grid-area: rate;
    min-width: 7ch;
    font-size: 11px;
    text-align: right;
    white-space: nowrap;
    color: var(--muted);
    opacity: 0.6;
  }
  .rate.up {
    color: var(--ok);
    opacity: 1;
  }
  .rate.down {
    color: var(--bad);
    opacity: 1;
  }
</style>
