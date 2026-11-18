<script lang="ts">
  import { game, ui, select, selectResource, toggleConverter, setPace } from '../ui/session.svelte';
  import { num, stock } from '../ui/format';
  import { PACE_MIN, PACE_STEP, paceEfficiency, paceOutput, type Recipe } from '../game/engine';
  import { recipeText } from './RecipeChip.svelte';
  import UpgradeCard from './UpgradeCard.svelte';
  import { STATE_LABEL } from './states';

  let { id }: { id: string } = $props();

  const conv = $derived(game.converter(id));
  const region = $derived(game.data.regions.find((r) => r.id === conv.def.region)!);

  const view = $derived.by(() => {
    ui.frame;
    const c = conv;
    // Inputs that keep the cycle from starting / going on, outputs that don't fit.
    const blocking = c.state === 'noInput' ? c.blockingNeeds() : c.state === 'interrupted' ? c.interruptingNeeds() : [];
    const blockedOut = c.state === 'full' ? c.blockedOutputs() : [];
    const res = (r: Recipe) => ({
      id: r.resource.id,
      icon: r.resource.def.icon,
      name: r.resource.name,
      color: r.resource.def.color,
      stock: stock(r.resource.amount),
      max: r.resource.max,
      ok: !blocking.includes(r),
      text: recipeText(r, 'in'),
    });
    return {
      name: c.name,
      state: c.state,
      pace: c.pace,
      outPace: c.cycle?.outPace ?? c.pace,
      pending: c.pacePending,
      paceMax: game.paceMax(),
      cycleSeconds: c.cycleSeconds(),
      blocking: blocking.map((r) => r.resource.name),
      blockedOut: blockedOut.map((r) => r.resource.name),
      sleeping: c.sleeping,
      progress: c.cycle ? Math.round(c.cycle.progress * 100) : 0,
      inputs: c.needs.filter((r) => r.kind === 'consume').map((r) => ({ ...res(r), amount: r.amount, atLeast: r.atLeast })),
      catalysts: c.needs.filter((r) => r.kind === 'catalyst').map((r) => ({ ...res(r), atLeast: r.atLeast })),
      conditions: c.needs.filter((r) => r.kind === 'condition').map(res),
      outputs: c.makes.map((r) => ({
        ...res(r),
        amount: c.output(r),
        base: r.amount,
        grows: !!c.growth && !r.byproduct,
        paced: c.pace !== 1 && !r.byproduct,
        ok: !blockedOut.includes(r),
      })),
      growth: c.growth
        ? {
            factor: c.growthFactor(),
            max: c.growth.maxFactor,
            resource: c.growth.resource,
            threshold: c.growthThreshold(),
            perUnit: c.growth.perUnit,
            fullAt: c.growthFullAt(),
            stock: c.growth.resource.amount,
          }
        : null,
      available: c.upgrades.filter((u) => !u.bought && u.requirementsMet()),
      locked: c.upgrades.filter((u) => !u.bought && !u.requirementsMet()),
      owned: c.upgrades.filter((u) => u.bought),
    };
  });

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  const paceText = $derived.by(() => {
    const p = view.pace;
    if (p === 1) {
      return view.paceMax > 1
        ? 'Normal pace. Slower gets more out of each input; faster makes more per second, but wastes inputs.'
        : 'Normal pace. Slower makes less per second, but gets more out of each input.';
    }
    const extra = Math.round((paceEfficiency(p) - 1) * 100);
    return `Uses ${pct(p)} of the inputs per second, makes ${pct(paceOutput(p))} of the outputs: ${extra > 0 ? '+' : '−'}${Math.abs(extra)}% from each input.`;
  });

  // What the node is doing in its cycle: start (take inputs) → run → end (put out outputs).
  const status = $derived.by(() => {
    const list = (names: string[]) => names.join(', ');
    switch (view.state) {
      case 'noInput':
        if (view.sleeping) return "Can't start a cycle while you sleep: it uses Stamina, which only works while you're awake.";
        return view.blocking.length ? `Can't start the next cycle, waiting for: ${list(view.blocking)}.` : 'Waiting for input.';
      case 'ok':
        return `Cycle running (${view.progress}%): the inputs are in, the outputs come out when it ends.`;
      case 'interrupted':
        if (view.sleeping) return `Interrupted at ${view.progress}%: you fell asleep. The cycle goes on when you wake up.`;
        return `Interrupted at ${view.progress}%: needs ${list(view.blocking)} to go on. The cycle continues when it's back.`;
      case 'full':
        return `Cycle done, but there's no room for: ${list(view.blockedOut)}. It puts the output out as soon as it fits.`;
      case 'stopped':
        return 'Stopped. Start it with the button, or right-click the node. A cycle in progress is kept.';
    }
  });
</script>

<aside class="drawer" aria-label="{view.name} details" style="--accent: {region.color}">
  <header>
    <div class="title">
      <span class="region">{region.name}</span>
      <h2>{view.name}</h2>
    </div>
    <button class="close" onclick={() => select(null)} aria-label="Close details" title="Close (Esc)">✕</button>
  </header>

  <div class="status state-{view.state}">
    <span class="dot"></span>
    <div>
      <b>{STATE_LABEL[view.state]}</b>
      <p>{status}</p>
    </div>
    {#if conv.unstoppable}
      <span class="always" title="This node can't be stopped">Always on</span>
    {:else}
      <button class="toggle" onclick={() => toggleConverter(conv.id)}>
        {view.state === 'stopped' ? '▶ Start' : '❚❚ Stop'}
      </button>
    {/if}
  </div>

  {#if view.paceMax > 0 && !conv.unstoppable}
    <section class="pace">
      <h3>Pace <small>how hard this node works</small></h3>
      <div class="pace-row">
        <input
          type="range"
          min={PACE_MIN}
          max={view.paceMax}
          step={PACE_STEP}
          value={view.pace}
          list="pace-marks"
          aria-label="Pace"
          oninput={(e) => setPace(conv.id, Number(e.currentTarget.value))}
        />
        <datalist id="pace-marks"><option value="1"></option></datalist>
        <span class="pace-value" class:pending={view.pending} class:over={view.pace > 1}
          >{view.pending ? '⏳' : ''}{pct(view.pace)}</span
        >
        <button class="reset" disabled={view.pace === 1} onclick={() => setPace(conv.id, 1)} title="Back to 100%">↺</button>
      </div>
      <p class="pace-text">{paceText}</p>
      {#if view.pending}
        <p class="pace-pending">
          ⏳ The new speed applies now. This cycle still gives the output of {pct(view.outPace)} (the faster pace, so slowing
          down mid-cycle isn't a trick); from the next cycle it's {pct(view.pace)}.
        </p>
      {/if}
    </section>
  {/if}

  <section>
    <h3>Recipe <small>1 cycle = {num(view.cycleSeconds)}s · click a resource for details</small></h3>
    <table>
      <thead>
        <tr><th></th><th></th><th>cycle</th><th>per sec</th><th>stock</th></tr>
      </thead>
      <tbody>
        {#each view.inputs as r}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <tr class:bad={!r.ok} onclick={() => selectResource(r.id)} onpointerenter={() => (ui.hoverResource = r.id)} onpointerleave={() => (ui.hoverResource = null)}>
            <td class="icon">{r.icon}</td>
            <td>{r.name}{#if r.atLeast > r.amount}<span class="sub"> · min. stock {num(r.atLeast)}</span>{/if}</td>
            <td class="num neg">−{num(r.amount)}</td>
            <td class="num rate">{num(r.amount / view.cycleSeconds)}/s</td>
            <td class="num stock">{r.stock}</td>
          </tr>
        {/each}
        {#each view.catalysts as r}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <tr class:bad={!r.ok} title={r.text} onclick={() => selectResource(r.id)} onpointerenter={() => (ui.hoverResource = r.id)} onpointerleave={() => (ui.hoverResource = null)}>
            <td class="icon">{r.icon}</td>
            <td>{r.name}<span class="sub"> · needs ≥{num(r.atLeast)}, not used</span></td>
            <td class="num">0</td>
            <td></td>
            <td class="num stock">{r.stock}</td>
          </tr>
        {/each}
        {#each view.outputs as r}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <tr class="out" class:full={!r.ok} onclick={() => selectResource(r.id)} onpointerenter={() => (ui.hoverResource = r.id)} onpointerleave={() => (ui.hoverResource = null)}>
            <td class="icon">{r.icon}</td>
            <td>{r.name}</td>
            <td class="num pos" title={r.grows || r.paced ? `base ${num(r.base)}${r.grows ? ' × growth' : ''}${r.paced ? ' × pace' : ''}` : ''}
              >+{r.grows ? r.amount.toFixed(1) : num(r.amount)}</td
            >
            <td class="num rate">{r.grows ? (r.amount / view.cycleSeconds).toFixed(1) : num(r.amount / view.cycleSeconds)}/s</td>
            <td class="num stock">{r.stock}/{r.max}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if view.conditions.length}
      <ul class="conditions">
        {#each view.conditions as r}
          <li class:bad={!r.ok}>{r.icon} {r.text}</li>
        {/each}
      </ul>
    {/if}
    {#if view.growth}
      {@const g = view.growth}
      <div class="growth">
        <div class="growth-head">
          <b>Growth ×{g.factor.toFixed(1)}</b>
          <span>max ×{g.max}</span>
        </div>
        <div class="growth-bar"><div style="width: {Math.min(100, ((g.factor - 1) / Math.max(1e-9, g.max - 1)) * 100)}%"></div></div>
        <p>
          Makes more the more {g.resource.def.icon} {g.resource.name} there is above {num(g.threshold)}:
          +{Math.round(g.perUnit * 100)}% per unit, up to ×{g.max} at {num(g.fullAt)}{g.fullAt > g.resource.max
            ? ` (more than you can store: ${g.resource.max})`
            : ''}. Now {num(Math.floor(g.stock))}.
        </p>
      </div>
    {/if}
    {#if view.inputs.length === 0 && view.catalysts.length === 0 && view.outputs.length === 0}
      <p class="empty">Nothing in, nothing out.</p>
    {/if}
  </section>

  {#if view.available.length || view.locked.length}
    <section>
      <h3>Upgrades</h3>
      <div class="cards">
        {#each view.available as u (u.id)}
          <UpgradeCard upgrade={u} />
        {/each}
        {#each view.locked as u (u.id)}
          <UpgradeCard upgrade={u} />
        {/each}
      </div>
    </section>
  {/if}

  {#if view.owned.length}
    <section>
      <h3>Owned</h3>
      <ul class="owned">
        {#each view.owned as u (u.id)}
          <li>✓ {u.name}</li>
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
  .region {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
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
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--panel-2);
    border-left: 4px solid var(--state);
  }
  .status > div {
    flex: 1;
  }
  .status b {
    font-size: 13px;
  }
  .status p {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .dot {
    display: none;
  }
  .toggle {
    flex: none;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .toggle:hover {
    border-color: var(--muted);
  }
  .always {
    font-size: 12px;
    color: var(--dream);
  }
  section {
    margin-top: 18px;
  }
  h3 {
    margin: 0 0 8px;
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
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  td {
    padding: 5px 4px;
    border-bottom: 1px solid var(--border);
  }
  th {
    padding: 0 4px 3px;
    font-size: 10.5px;
    font-weight: 500;
    text-align: right;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
  }
  tr.out:first-of-type td,
  tr:not(.out) + tr.out td {
    border-top: 1px solid var(--muted);
  }
  .icon {
    width: 22px;
    font-size: 15px;
  }
  .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .neg {
    color: #ffb3ba;
  }
  .pos {
    color: #a8f0bc;
  }
  .rate,
  .stock {
    color: var(--muted);
    font-size: 12px;
  }
  .sub {
    color: var(--muted);
    font-size: 11.5px;
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover td {
    background: var(--panel-2);
  }
  tr.bad td {
    background: color-mix(in srgb, var(--bad) 14%, transparent);
  }
  tr.full td {
    background: color-mix(in srgb, var(--st-full) 16%, transparent);
  }
  .pace-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pace-row input {
    flex: 1;
    min-width: 0;
    accent-color: var(--accent);
  }
  .pace-value {
    min-width: 6ch;
    text-align: right;
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #bfe3ff;
  }
  .pace-value.over {
    color: #ffd2b0;
  }
  .pace-value.pending {
    color: var(--muted);
  }
  .reset {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--panel-2);
    color: var(--text);
    cursor: pointer;
  }
  .reset:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .pace-text,
  .pace-pending {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .pace-pending {
    color: var(--warn);
  }
  .growth {
    margin-top: 10px;
    padding: 9px 11px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--ok) 8%, var(--panel-2));
    border: 1px solid color-mix(in srgb, var(--ok) 25%, transparent);
  }
  .growth-head {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .growth-head span {
    color: var(--muted);
    font-size: 12px;
  }
  .growth-bar {
    height: 5px;
    margin: 6px 0;
    border-radius: 3px;
    background: var(--bg);
    overflow: hidden;
  }
  .growth-bar div {
    height: 100%;
    background: var(--ok);
    transition: width 0.45s linear;
  }
  .growth p {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .conditions {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    font-size: 12.5px;
    color: var(--muted);
  }
  .conditions li.bad {
    color: var(--warn);
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
  }
  .cards {
    display: grid;
    gap: 8px;
  }
  .owned {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    display: grid;
    gap: 3px;
  }
</style>
