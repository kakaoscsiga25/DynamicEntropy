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

  /** Stock levels that matter (a node's minimum, a fire's range), as marks on the bar. */
  const marks = $derived.by(() => {
    ui.frame;
    const map = new Map<string, number[]>();
    const add = (id: string, level: number) => {
      const list = map.get(id) ?? [];
      if (!list.some((x) => Math.abs(x - level) < 0.5)) list.push(level);
      map.set(id, list);
    };
    for (const c of game.converters) {
      if (!game.discovered.has(c.id)) continue;
      for (const n of [...c.needs, ...c.guards]) {
        if (n.guard && !n.guard.enabled) continue;
        if (n.heat) {
          for (const f of n.heat) {
            add(f.id, n.atLeast);
            add(f.id, n.atMost);
          }
        } else if (n.atLeast > 0 && !n.optional) add(n.resource.id, n.minStock);
      }
    }
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
      unit: r.def.unit ?? '',
      max: Math.round(r.max),
      ratio: Math.max(0, Math.min(1, r.amount / r.max)),
      fades: r.fadeRate > 0,
      marks: (marks.get(r.id) ?? []).filter((x) => x > 0 && x < r.max).map((x) => x / r.max),
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
          <span class="name">{r.name}{#if r.fades}<span class="fade" title="Fades: loses a share of its stock every second">⌛</span>{/if}</span>
          <span class="amount"><b>{r.amount}{r.unit}</b><span class="max">/{r.max}</span></span>
          <span class="bar"
            ><span class="fill" style="width: {r.ratio * 100}%; background: {r.color}"></span>
            {#each r.marks as m}<i class="mark" style="left: {m * 100}%"></i>{/each}</span
          >
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
    min-width: 4ch;
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
  }
  .row:hover .bar,
  .row.focused .bar {
    background: var(--bg);
  }
  .bar .fill {
    display: block;
    height: 100%;
    transition: width 0.2s linear;
  }
  /* An important level (a node's minimum, a fire's range). */
  .mark {
    position: absolute;
    top: -2px;
    width: 2px;
    height: 4px;
    margin-left: -1px;
    background: var(--text);
    opacity: 0.7;
  }
  .fade {
    margin-left: 4px;
    font-size: 9px;
    opacity: 0.55;
  }
</style>
