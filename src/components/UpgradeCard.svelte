<script lang="ts">
  import type { Upgrade } from '../game/engine';
  import { ui, buyUpgrade } from '../ui/session.svelte';
  import { num, stock } from '../ui/format';

  let { upgrade }: { upgrade: Upgrade } = $props();

  const view = $derived.by(() => {
    ui.frame;
    const u = upgrade;
    const unlocked = u.requirementsMet();
    return {
      unlocked,
      buyable: u.isBuyable(),
      costs: u.costs.map((c) => ({
        icon: c.resource.def.icon,
        name: c.resource.name,
        need: c.amount,
        have: c.resource.amount,
        ok: c.resource.canTake(c.amount),
      })),
      requires: u.requires.map((r) => ({ name: r.name, ok: r.bought })),
      effects: u.def.final ? [] : u.effects(),
      capacity: u.capacityEffects(),
    };
  });

  function line(kind: 'need' | 'make', amountBefore: number, amountAfter: number) {
    const what = kind === 'need' ? 'uses' : 'makes';
    return `${what} ${num(amountBefore)} → ${num(amountAfter)}`;
  }
</script>

<article class="card" class:locked={!view.unlocked} class:ready={view.buyable}>
  <header>
    <h4>{upgrade.name}</h4>
    <button class="buy" disabled={!view.buyable} onclick={() => buyUpgrade(upgrade.id)}>
      {view.buyable ? 'Buy' : view.unlocked ? 'Not enough' : 'Locked'}
    </button>
  </header>

  {#if !view.unlocked}
    <p class="requires">
      Requires:
      {#each view.requires as r, i}
        <span class:ok={r.ok}>{r.ok ? '✓' : '✗'} {r.name}</span>{i < view.requires.length - 1 ? ', ' : ''}
      {/each}
    </p>
  {/if}

  <ul class="effects">
    {#if upgrade.def.final}
      <li class="secret">Effect: ???</li>
    {/if}
    {#if upgrade.def.unlocks === 'pace'}
      <li>Unlocks the <b>pace</b> slider on every node (10–100%): slower makes less per second, but gets up to 30% more out of each input.</li>
    {:else if upgrade.def.unlocks === 'overclock'}
      <li>Pace can go up to <b>200%</b>: more per second, but each input gives less (down to 70%).</li>
    {/if}
    {#each view.capacity as c}
      <li>
        <span class="icon">{c.resource.def.icon}</span>
        {c.resource.name} storage {num(c.before)} → {num(c.after)}
        <span class="tag good">▲</span>
      </li>
    {/each}
    {#each view.effects as fx}
      {#if fx.rename}
        <li>Renames <b>{fx.converter.name}</b> to <b>{fx.rename}</b></li>
      {/if}
      {#if fx.growthMax}
        <li>
          {#if !upgrade.host}<b>{fx.converter.name}:</b>{/if}
          Size (max growth) ×{num(fx.growthMax.before)} → ×{num(fx.growthMax.after)}
          <span class="tag good">▲</span>
        </li>
      {/if}
      {#each fx.recipes as r}
        {@const better = r.kind === 'need' ? r.after.amount < r.before.amount : r.after.amount > r.before.amount}
        <li>
          <span class="icon">{r.resource.def.icon}</span>
          {#if !upgrade.host}<b>{fx.converter.name}:</b>{/if}
          {r.resource.name} {line(r.kind, r.before.amount, r.after.amount)}
          {#if r.after.amount !== r.before.amount}
            <span class="tag" class:good={better} class:worse={!better}>{better ? '▲' : '▼'}</span>
          {/if}
          {#if r.after.atLeast !== r.before.atLeast}
            <span class="sub">(min. stock {num(r.before.atLeast)} → {num(r.after.atLeast)})</span>
          {/if}
        </li>
      {/each}
    {/each}
  </ul>

  <div class="costs">
    {#each view.costs as c}
      <span class="cost" class:ok={c.ok} title="{c.name}: have {stock(c.have)}, need {num(c.need)}">
        {c.icon} <b>{num(c.need)}</b>
        {#if !c.ok}<small>({stock(c.have)})</small>{/if}
      </span>
    {/each}
  </div>
</article>

<style>
  .card {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--panel-2);
    border: 1px solid var(--border);
  }
  .card.ready {
    border-color: color-mix(in srgb, var(--upgrade) 60%, transparent);
  }
  .card.locked {
    opacity: 0.6;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h4 {
    flex: 1;
    margin: 0;
    font-size: 14px;
  }
  .buy {
    padding: 4px 12px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .buy:not(:disabled) {
    cursor: pointer;
    color: #0f1220;
    background: var(--upgrade);
    border-color: var(--upgrade);
  }
  .buy:not(:disabled):hover {
    filter: brightness(1.1);
  }
  .requires {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .requires span {
    color: var(--bad);
  }
  .requires span.ok {
    color: var(--ok);
  }
  .effects {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    font-size: 12.5px;
    display: grid;
    gap: 3px;
  }
  .effects .icon {
    margin-right: 2px;
  }
  .secret {
    color: var(--dream);
    font-style: italic;
  }
  .tag {
    font-size: 10px;
    margin-left: 3px;
  }
  .tag.good {
    color: var(--ok);
  }
  .tag.worse {
    color: var(--bad);
  }
  .sub {
    color: var(--muted);
  }
  .costs {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
  }
  .cost {
    font-size: 12px;
    padding: 2px 7px;
    border-radius: 7px;
    border: 1px solid color-mix(in srgb, var(--bad) 50%, transparent);
    color: var(--muted);
  }
  .cost b {
    color: var(--text);
  }
  .cost.ok {
    border-color: color-mix(in srgb, var(--ok) 50%, transparent);
  }
  .cost small {
    color: var(--bad);
  }
</style>
