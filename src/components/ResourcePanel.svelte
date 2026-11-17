<script lang="ts">
  import { game, ui, resourceTrend, selectResource } from '../ui/session.svelte';
  import { stock } from '../ui/format';

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
      amount: stock(r.amount),
      max: r.max,
      ratio: Math.max(0, Math.min(1, r.amount / r.max)),
      trend: resourceTrend(i),
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
          title="Click to see who makes and uses {r.name}"
          onclick={() => selectResource(r.id)}
          onpointerenter={() => (ui.hoverResource = r.id)}
          onpointerleave={() => ui.hoverResource === r.id && (ui.hoverResource = null)}
        >
          <span class="icon">{r.icon}</span>
          <span class="name">{r.name}</span>
          <span class="amount"><b>{r.amount}</b>/{r.max}</span>
          <span class="bar"><span style="width: {r.ratio * 100}%; background: {r.color}"></span></span>
          <span class="rate {r.trend.direction}">{r.trend.text}</span>
          <span class="eta">{r.trend.eta}</span>
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
  .row {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    grid-template-areas:
      'icon name amount'
      'icon bar bar'
      'icon rate eta';
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
  }
  .amount {
    grid-area: amount;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .amount b {
    color: var(--text);
    font-weight: 650;
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
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    min-height: 13px;
  }
  .rate.up {
    color: var(--ok);
  }
  .rate.down {
    color: var(--bad);
  }
  .eta {
    grid-area: eta;
    font-size: 11px;
    color: var(--muted);
    text-align: right;
  }
</style>
