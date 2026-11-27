<script lang="ts">
  import type { Converter, ConverterState } from '../game/engine';
  import { game, ui, select, toggleConverter, resourceTrend } from '../ui/session.svelte';
  import { num } from '../ui/format';

  let { id }: { id: string } = $props();

  const res = $derived(game.resource(id));

  interface Row {
    conv: Converter;
    name: string;
    state: ConverterState;
    amount: string;
    note: string;
  }

  const view = $derived.by(() => {
    ui.frame;
    const r = res;
    const makers: Row[] = [];
    const users: Row[] = [];
    let hiddenMakers = 0;
    let hiddenUsers = 0;

    for (const c of game.converters) {
      if (c.locked) continue;
      const make = c.makes.find((m) => m.resource === r && m.amount > 0);
      const fertilizer = c.needs.find((n) => n.yields?.resource === r);
      const need = c.needs.find((n) => (n.resource === r || n.heat?.includes(r)) && n.kind !== 'none');
      if (!game.discovered.has(c.id)) {
        if (make) hiddenMakers++;
        if (need) hiddenUsers++;
        continue;
      }
      if (make || fertilizer) {
        const amount = make ? c.makes.filter((m) => m.resource === r).reduce((sum, m) => sum + c.output(m), 0) : 0;
        makers.push({
          conv: c,
          name: c.name,
          state: c.state,
          amount: make ? `+${num(amount)}` : '',
          note: make?.byproduct ? 'side product' : fertilizer && !make ? `from ${fertilizer.resource.name}` : '',
        });
      }
      if (need) {
        let note = '';
        if (need.kind === 'heat') note = `needs a fire at ${num(need.atLeast)}–${num(need.atMost)}°`;
        else if (need.kind === 'catalyst') note = `needs ≥ ${num(need.minStock)} in stock, not used up`;
        else if (need.kind === 'optional') note = `takes some if there is${need.atLeast > 0 ? ` (above ${num(need.atLeast)})` : ''}`;
        else if (need.kind === 'condition') note = need.atMost === 0 ? `only while ${r.name} is 0` : `only while ≤ ${num(need.maxStock)}`;
        else if (need.atLeast > need.amount) note = `only while stock ≥ ${num(need.atLeast)}`;
        const used = c.needs.filter((n) => n.resource === r && (n.kind === 'consume' || n.kind === 'optional')).reduce((sum, n) => sum + c.inAmount(n), 0);
        users.push({
          conv: c,
          name: c.name,
          state: c.state,
          amount: used > 0 ? `${need.kind === 'optional' ? '≤' : '−'}${num(used)}` : '',
          note,
        });
      }
    }

    const upgrades = game.upgrades
      .filter((u) => !u.bought && u.costs.some((k) => k.resource === r))
      .filter((u) => !u.host || game.discovered.has(u.host.id))
      .map((u) => ({
        id: u.id,
        name: u.name,
        host: u.host,
        amount: u.costs.find((k) => k.resource === r)!.amount,
      }));

    const fade = r.def.fade;
    return {
      amount: r.amount.toFixed(1),
      unit: r.def.unit ?? '',
      fade: fade
        ? {
            rate: r.fadeRate,
            into: fade.into ? game.resource(fade.into) : null,
            awakeOnly: !!fade.awakeOnly,
            slowed: r.fadeMult < 1,
          }
        : null,
      rotsFrom: game.resources.filter((x) => x.def.fade?.into === r.id),
      regen: r.def.regen ?? 0,
      prod: game.productivityDef?.res === r.id
        ? {
            parts: game.productivityParts(),
            target: Math.max(game.productivityDef.min, Math.min(100, game.productivityTarget())),
            work: game.workFactor(),
          }
        : null,
      ratio: Math.max(0, Math.min(1, r.amount / r.max)),
      makers,
      users,
      hiddenMakers,
      hiddenUsers,
      upgrades,
      runningUsers: users.filter((u) => u.state !== 'stopped').length,
    };
  });

  // Once per second, so the numbers stay readable.
  const trend = $derived.by(() => {
    ui.second;
    return resourceTrend(game.resources.indexOf(res));
  });
</script>

{#snippet rowList(rows: Row[], hidden: number, empty: string)}
  {#if rows.length === 0 && hidden === 0}
    <p class="empty">{empty}</p>
  {/if}
  <ul class="rows">
    {#each rows as row (row.conv.id)}
      <li
        class="state-{row.state}"
        onpointerenter={() => (ui.hoverNode = row.conv.id)}
        onpointerleave={() => ui.hoverNode === row.conv.id && (ui.hoverNode = null)}
      >
        {#if row.conv.unstoppable}
          <span class="power fixed" title="Always on">∞</span>
        {:else}
          <button
            class="power"
            title={row.state === 'stopped' ? 'Start' : 'Stop'}
            aria-label="{row.state === 'stopped' ? 'Start' : 'Stop'} {row.name}"
            onclick={() => toggleConverter(row.conv.id)}
          >
            {row.state === 'stopped' ? '▶' : '❚❚'}
          </button>
        {/if}
        <button class="link" onclick={() => select(row.conv.id)} title="Open details">
          <span class="name">{row.name}</span>
          {#if row.note}<span class="note">{row.note}</span>{/if}
        </button>
        <span class="amount">{row.amount}</span>
      </li>
    {/each}
  </ul>
  {#if hidden > 0}
    <p class="hidden">+ {hidden} not discovered yet</p>
  {/if}
{/snippet}

<aside class="drawer" aria-label="{res.name} details" style="--c: {res.def.color}">
  <header>
    <div class="title">
      <span class="group">{res.def.group} · resource</span>
      <h2><span class="icon">{res.def.icon}</span> {res.name}</h2>
    </div>
    <button class="close" onclick={() => select(null)} aria-label="Close details" title="Close (Esc)">✕</button>
  </header>

  <div class="stock">
    <div class="numbers">
      <b>{view.amount}{view.unit}</b>{#if view.unit !== '%' && view.unit !== '°'}<span class="max">/ {num(res.max)}</span>{/if}
      <span class="rate {trend.direction}">{trend.text}</span>
    </div>
    <div class="bar"><div style="width: {view.ratio * 100}%"></div></div>
  </div>

  {#if view.prod}
    {@const h = view.prod}
    <section>
      <h3>Where it comes from <small>heading to {Math.round(h.target)}%</small></h3>
      <ul class="health">
        {#each h.parts as p}
          <li class:penalty={p.penalty}>
            <span>{p.name}</span>
            <span class="hbar"><span style="width: {(Math.abs(p.points) / Math.max(1, p.max)) * 100}%"></span></span>
            <b>{p.penalty && Math.round(p.points) !== 0 ? '−' : ''}{Math.abs(Math.round(p.points))}</b><small>/{p.max}</small>
          </li>
        {/each}
      </ul>
      <p class="note-text">
        The good ones together are 110: missing a little still gets you to 100%. 🤒 Disease and 🤕 Injuries take points away.
        Productivity moves slowly towards where it's heading (never below 1%).
        Now everything you make by hand (nodes that use ⚡ Stamina) is ×{h.work.toFixed(2)}.
      </p>
    </section>
  {/if}

  {#if view.fade || view.regen || view.rotsFrom.length}
    <section>
      <h3>Over time</h3>
      {#if view.fade}
        <p class="note-text">
          ⌛ Loses {num(view.fade.rate * 100)}% of its stock every second{view.fade.awakeOnly ? ' while you are awake' : ''}{view.fade.slowed ? ' (slowed down)' : ''}{view.fade.into
            ? `, turning into ${view.fade.into.def.icon} ${view.fade.into.name}`
            : ''}. It settles where what comes in equals what fades.
        </p>
      {/if}
      {#if view.regen}
        <p class="note-text">🌱 Recovers by itself: +{num(view.regen)} a second.</p>
      {/if}
      {#each view.rotsFrom as src}
        <p class="note-text">Comes from {src.def.icon} {src.name} rotting.</p>
      {/each}
    </section>
  {/if}

  {#if !view.prod}
    <section>
      <h3>Made by <small>per cycle</small></h3>
      {@render rowList(view.makers, view.hiddenMakers, view.rotsFrom.length ? 'No node makes this.' : 'Nothing makes this yet.')}
    </section>

    <section>
      <h3>Used by <small>{view.runningUsers} of {view.users.length} running</small></h3>
      {@render rowList(view.users, view.hiddenUsers, 'Nothing uses this yet.')}
    </section>
  {/if}

  {#if view.upgrades.length}
    <section>
      <h3>Needed for upgrades</h3>
      <ul class="rows">
        {#each view.upgrades as u (u.id)}
          <li>
            <button class="link" onclick={() => u.host && select(u.host.id)}>
              <span class="name">{u.name}</span>
              {#if u.host}<span class="note">on {u.host.name}</span>{/if}
            </button>
            <span class="amount" class:ok={res.amount >= u.amount - 1e-9}>{num(u.amount)}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</aside>

<style>
  .drawer {
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    padding: 14px 16px 24px;
    background: var(--panel);
    border-left: 1px solid var(--border);
  }
  header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .title {
    flex: 1;
  }
  .group {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--c);
  }
  h2 {
    margin: 2px 0 0;
    font-size: 20px;
  }
  .close {
    border: none;
    background: none;
    color: var(--muted);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
  }
  .close:hover {
    color: var(--text);
  }
  .stock {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--panel-2);
  }
  .numbers {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .numbers b {
    font-size: 22px;
  }
  .max {
    color: var(--muted);
  }
  .rate {
    margin-left: auto;
    font-size: 13px;
    color: var(--muted);
  }
  .rate.up {
    color: var(--ok);
  }
  .rate.down {
    color: var(--bad);
  }
  .bar {
    height: 6px;
    margin-top: 8px;
    border-radius: 3px;
    background: var(--bg);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: var(--c);
    transition: width 0.45s linear;
  }
  section {
    margin-top: 18px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h3 small {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    margin-left: 6px;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .rows li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px 4px 4px;
    border-radius: 9px;
    background: var(--panel-2);
    border-left: 3px solid var(--state, var(--border));
  }
  .power {
    flex: none;
    width: 30px;
    height: 26px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--state, var(--muted));
    font-size: 10px;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .state-stopped .power {
    color: var(--muted);
  }
  .power:hover {
    border-color: var(--muted);
    color: var(--text);
  }
  .power.fixed {
    cursor: default;
    color: var(--dream);
    font-size: 14px;
  }
  .link {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 2px 0;
    border: none;
    background: none;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .link:hover .name {
    text-decoration: underline;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
  }
  .state-stopped .name {
    color: var(--muted);
  }
  .note {
    font-size: 11.5px;
    color: var(--muted);
  }
  .amount {
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .amount.ok {
    color: var(--ok);
  }
  .note-text {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .health {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 12.5px;
  }
  .health li {
    display: grid;
    grid-template-columns: 9ch 1fr 3ch 3ch;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .health b {
    text-align: right;
  }
  .health .penalty b,
  .health .penalty > span:first-child {
    color: var(--bad);
  }
  .health .penalty .hbar span {
    background: var(--bad);
  }
  .health small {
    color: var(--muted);
  }
  .hbar {
    height: 5px;
    border-radius: 3px;
    background: var(--bg);
    overflow: hidden;
  }
  .hbar span {
    display: block;
    height: 100%;
    background: var(--c);
  }
  .empty,
  .hidden {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .hidden {
    font-style: italic;
  }
</style>
