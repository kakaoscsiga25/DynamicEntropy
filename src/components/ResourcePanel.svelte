<script lang="ts">
  import { game, ui, ratePerSecond } from '../ui/session.svelte';
  import { duration, rate, stock } from '../ui/format';

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
    const perSec = ratePerSecond(i);
    let eta = '';
    if (perSec > 0.005 && r.amount < r.max - 1e-9) eta = `full in ${duration((r.max - r.amount) / perSec)}`;
    else if (perSec < -0.005 && r.amount > 1e-9) eta = `empty in ${duration(r.amount / -perSec)}`;
    else if (r.amount >= r.max - 1e-9) eta = 'full';
    return {
      id: r.id,
      name: r.name,
      icon: r.def.icon,
      color: r.def.color,
      amount: stock(r.amount),
      max: r.max,
      ratio: Math.max(0, Math.min(1, r.amount / r.max)),
      rate: rate(perSec),
      trend: perSec > 0.005 ? 'up' : perSec < -0.005 ? 'down' : '',
      eta,
    };
  }
</script>

<aside class="panel" aria-label="Resources">
  <h2>Resources</h2>
  {#each groups as g (g.name)}
    <section>
      <h3>{g.name}</h3>
      {#each g.rows as r (r.id)}
        <div
          class="row"
          class:focused={ui.hoverResource === r.id}
          role="listitem"
          title="Hover to see which nodes make (green) and use (red) {r.name}"
          onpointerenter={() => (ui.hoverResource = r.id)}
          onpointerleave={() => ui.hoverResource === r.id && (ui.hoverResource = null)}
        >
          <span class="icon">{r.icon}</span>
          <span class="name">{r.name}</span>
          <span class="amount"><b>{r.amount}</b>/{r.max}</span>
          <div class="bar"><div style="width: {r.ratio * 100}%; background: {r.color}"></div></div>
          <span class="rate {r.trend}">{r.rate}</span>
          <span class="eta">{r.eta}</span>
        </div>
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
    padding: 6px 8px;
    border-radius: 9px;
    cursor: default;
  }
  .row:hover,
  .row.focused {
    background: var(--panel-2);
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
  .bar div {
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
