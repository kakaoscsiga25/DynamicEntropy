<script lang="ts">
  import { game, ui, select, selectResource, toggleConverter, setPace, setThrottle, setTarget, setShares, setGuard, sharpen } from '../ui/session.svelte';
  import { num, stock } from '../ui/format';
  import { PACE_MIN, PACE_STEP, paceEfficiency, paceOutput, wearFactor, AUTO_SHARPEN_AT } from '../game/engine';
  import { displayLines, type DisplayLine } from '../ui/layout';
  import { recipeText } from './RecipeChip.svelte';
  import UpgradeCard from './UpgradeCard.svelte';
  import PartsBar from './PartsBar.svelte';
  import { STATE_LABEL } from './states';
  import { settleTemp } from './fire';

  let { id }: { id: string } = $props();

  const conv = $derived(game.converter(id));
  const region = $derived(game.data.regions.find((r) => r.id === conv.def.region)!);

  const view = $derived.by(() => {
    ui.frame;
    const c = conv;
    // Inputs that keep the cycle from starting / going on, outputs that don't fit.
    const blocking = c.state === 'noInput' ? c.blockingNeeds() : c.state === 'interrupted' ? c.interruptingNeeds() : [];
    const blockedOut = c.state === 'full' ? c.blockedOutputs() : [];
    const hit = (list: typeof blocking, d: DisplayLine) => list.some((r) => r === d.recipe || (r.resource === d.recipe.resource && r.kind === d.recipe.kind));
    const row = (d: DisplayLine) => {
      const r = d.recipe;
      const res = d.kind === 'heat' ? (r.heat!.find((x) => r.heatOk() && x.amount >= r.atLeast && x.amount <= r.atMost) ?? r.resource) : r.resource;
      return {
        id: res.id,
        icon: res.def.icon,
        name: d.kind === 'heat' ? 'Fire' : res.name,
        unit: res.def.unit ?? '',
        stock: stock(res.amount),
        max: res.max,
        amount: d.amount,
        base: d.base,
        kind: d.kind,
        recipe: r,
        text: recipeText(r, d.kind === 'out' ? 'out' : 'in', d.amount),
        bad: hit(blocking, d),
        full: hit(blockedOut, d),
      };
    };
    const ins = displayLines(c, 'in').map(row);
    const fire = game.fireOf(c);
    return {
      name: c.name,
      state: c.state,
      pace: c.pace,
      outPace: c.cycle?.outPace ?? c.pace,
      pending: c.pacePending,
      paceMax: game.paceMax(),
      cycleSeconds: c.cycleSeconds(),
      blocking: blocking.map((r) => (r.heat ? `a fire at ${num(r.atLeast)}–${num(r.atMost)}°` : r.guard ? `the rule "${r.guard.label}"` : r.resource.name)),
      blockedOut: blockedOut.map((r) => r.resource.name),
      sleeping: c.sleeping,
      progress: c.cycle ? Math.round(c.cycle.progress * 100) : 0,
      inputs: ins.filter((r) => r.kind === 'consume'),
      optional: ins.filter((r) => r.kind === 'optional'),
      catalysts: ins.filter((r) => r.kind === 'catalyst'),
      heat: ins.filter((r) => r.kind === 'heat'),
      conditions: ins.filter((r) => r.kind === 'condition'),
      outputs: displayLines(c, 'out').map(row),
      // What multiplies the outputs now.
      factors: [
        ...(c.growth ? [{ name: `${c.growth.shape === 'logistic' ? 'Breeding' : 'Growth'} (${c.growth.resource.name})`, value: c.growthFactor() }] : []),
        ...(c.needsAwake && game.healthDef ? [{ name: `Health ${Math.round(game.health())}%`, value: game.workFactor() }] : []),
        ...(c.wears ? [{ name: `Tool ${Math.ceil(c.condition)}%`, value: wearFactor(c.condition) }] : []),
        ...(c.pace !== 1 ? [{ name: `Pace ${Math.round(c.pace * 100)}%`, value: paceEfficiency(c.pace) }] : []),
      ],
      growth: c.growth
        ? {
            factor: c.growthFactor(),
            shape: c.growth.shape,
            max: c.growth.maxFactor,
            base: c.growth.base,
            resource: c.growth.resource,
            threshold: c.growthThreshold(),
            perUnit: c.growth.perUnit,
            fullAt: c.growthFullAt(),
            stock: c.growth.resource.amount,
          }
        : null,
      fire: fire
        ? {
            res: fire.resource,
            now: fire.resource.amount,
            settle: settleTemp(game, c),
            fade: fire.resource.fadeRate,
            thermostat: game.has('thermostat'),
            target: c.target,
          }
        : null,
      throttle: c.throttle,
      shares: [...c.shares],
      wears: c.wears,
      willWear: !!c.def.wear && !c.wears,
      condition: c.condition,
      sharpenCost: game.sharpenCost(c),
      maintenance: game.has('maintenance'),
      guards: c.guards.map((g) => ({ label: g.guard!.label, enabled: g.guard!.enabled })),
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
        if (!view.blocking.length) return `Done at ${view.progress}%: its Stamina waits until you wake up.`;
        return `Interrupted at ${view.progress}%: needs ${list(view.blocking)} to go on. The cycle continues when it's back.`;
      case 'full':
        return `Cycle done, but there's no room for: ${list(view.blockedOut)}. It puts the output out as soon as it fits.`;
      case 'stopped':
        return 'Stopped. Start it with the button, or right-click the node. A cycle in progress is kept.';
    }
  });

  /** Moves one crop's share by a step; the others give or take the difference evenly. */
  function nudge(i: number, delta: number) {
    const s = [...view.shares];
    const next = Math.min(1, Math.max(0, Math.round((s[i] + delta) * 20) / 20));
    const change = next - s[i];
    if (Math.abs(change) < 1e-9) return;
    const others = s.map((_, j) => j).filter((j) => j !== i && (change > 0 ? s[j] > 0 : true));
    s[i] = next;
    let left = change;
    for (const j of others) {
      const give = change > 0 ? Math.min(s[j], left / others.length + 1e-9) : left / others.length;
      s[j] -= give;
    }
    setShares(conv.id, s.map((x) => Math.max(0, x)));
  }
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
      <span class="always" title="This node can't be stopped">{conv.nature ? '🌿 Nature' : 'Always on'}</span>
    {:else}
      <button class="toggle" onclick={() => toggleConverter(conv.id)}>
        {view.state === 'stopped' ? '▶ Start' : '❚❚ Stop'}
      </button>
    {/if}
  </div>

  {#if view.fire}
    {@const f = view.fire}
    <section class="box">
      <h3>Fire <small>{f.res.def.icon} {f.res.name} now {Math.round(f.now)}°</small></h3>
      <div class="pace-row">
        <span class="k">🪵</span>
        <input
          type="range"
          min={conv.def.throttle!.min}
          max={conv.def.throttle!.max}
          step={conv.def.throttle!.step}
          value={view.throttle}
          aria-label="Wood per cycle"
          oninput={(e) => setThrottle(conv.id, Number(e.currentTarget.value))}
        />
        <span class="pace-value">{(view.throttle ?? 0).toFixed(2)}</span>
      </div>
      <p class="pace-text">
        Wood per cycle ({num(view.cycleSeconds)} s). The fire cools by {num(f.fade * 100)}% a second, so with this much wood it
        settles at <b>{Math.round(f.settle)}°</b>. More wood, hotter fire; it takes a few minutes to get there.
      </p>
      {#if f.thermostat}
        <div class="pace-row">
          <label class="check"><input type="checkbox" checked={f.target !== null} onchange={(e) => setTarget(conv.id, e.currentTarget.checked ? Math.round(f.now) : null)} /> 🌡 Thermostat</label>
          {#if f.target !== null}
            <input type="range" min="5" max="100" step="1" value={f.target} aria-label="Temperature to keep" oninput={(e) => setTarget(conv.id, Number(e.currentTarget.value))} />
            <span class="pace-value">{f.target}°</span>
          {/if}
        </div>
        <p class="pace-text">{f.target !== null ? 'Adds the wood by itself to keep this temperature. Moving the wood slider turns it off.' : 'Turn it on to keep a temperature without setting the wood by hand.'}</p>
      {/if}
    </section>
  {/if}

  {#if conv.parts.length}
    <section class="box">
      <h3>Crops <small>drag the handles to split the field</small></h3>
      <PartsBar {conv} big />
      <ul class="crops">
        {#each conv.parts as p, i (p.id)}
          <li>
            <span>{p.icon} {p.name}</span>
            <button onclick={() => nudge(i, -0.05)} disabled={view.shares[i] <= 0} aria-label="Less {p.name}">−</button>
            <b>{pct(view.shares[i])}</b>
            <button onclick={() => nudge(i, 0.05)} disabled={view.shares[i] >= 1} aria-label="More {p.name}">+</button>
          </li>
        {/each}
      </ul>
      <p class="pace-text">Wheat and cotton use up the Soil, clover gives it back (and makes Hay). Ash, manure and compost feed the Soil too. A full crop doesn't stop the others: its surplus is lost.</p>
    </section>
  {/if}

  {#if view.wears || view.willWear}
    <section class="box">
      <h3>Tool <small>{view.wears ? (view.condition <= 0 ? 'broken' : `${Math.ceil(view.condition)}%`) : 'none yet'}</small></h3>
      {#if view.wears}
        <div class="growth-bar tool" class:low={view.condition <= 30}><div style="width: {view.condition}%"></div></div>
        <div class="tool-row">
          <p class="pace-text">
            Wears down with every cycle. Worn: makes {pct(wearFactor(Math.max(1, view.condition)))}; broken: 40%.
            {view.maintenance ? `Maintenance sharpens it at ${AUTO_SHARPEN_AT}%.` : 'Sharpen it before it breaks, repairing costs a Tool.'}
          </p>
          <button class="toggle" disabled={view.condition >= 100 || !view.sharpenCost.every((k) => k.resource.canTake(k.amount))} onclick={() => sharpen(conv.id)}>
            {view.condition <= 0 ? 'Repair' : 'Sharpen'}: {view.sharpenCost.map((k) => `${k.resource.def.icon} ${num(k.amount)}`).join(' ')}
          </button>
        </div>
      {:else}
        <p class="pace-text">A tool upgrade makes this node better, but the tool wears out and has to be sharpened.</p>
      {/if}
    </section>
  {/if}

  {#if view.guards.length}
    <section class="box">
      <h3>Rules <small>from the Mind</small></h3>
      {#each view.guards as g, i}
        <label class="check rule"><input type="checkbox" checked={g.enabled} onchange={(e) => setGuard(conv.id, i, e.currentTarget.checked)} /> 🤖 {g.label}</label>
      {/each}
    </section>
  {/if}

  {#if view.paceMax > 0 && conv.pacable}
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
          <tr class:bad={r.bad} title={r.text} onclick={() => selectResource(r.id)} onpointerenter={() => (ui.hoverResource = r.id)} onpointerleave={() => (ui.hoverResource = null)}>
            <td class="icon">{r.icon}</td>
            <td>{r.name}{#if r.recipe.atLeast > r.recipe.amount}<span class="sub"> · min. stock {num(r.recipe.atLeast)}</span>{/if}</td>
            <td class="num neg">−{num(r.amount)}</td>
            <td class="num rate">{num(r.amount / view.cycleSeconds)}/s</td>
            <td class="num stock">{r.stock}</td>
          </tr>
        {/each}
        {#each view.optional as r}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <tr title={r.text} onclick={() => selectResource(r.id)} onpointerenter={() => (ui.hoverResource = r.id)} onpointerleave={() => (ui.hoverResource = null)}>
            <td class="icon">{r.icon}</td>
            <td>{r.name}<span class="sub"> · if there's some{r.recipe.yields ? ` → ${r.recipe.yields.resource.name} ×${num(r.recipe.yields.amount)}` : ''}</span></td>
            <td class="num neg">≤{num(r.amount)}</td>
            <td></td>
            <td class="num stock">{r.stock}</td>
          </tr>
        {/each}
        {#each view.catalysts as r}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <tr class:bad={r.bad} title={r.text} onclick={() => selectResource(r.id)} onpointerenter={() => (ui.hoverResource = r.id)} onpointerleave={() => (ui.hoverResource = null)}>
            <td class="icon">{r.icon}</td>
            <td>{r.name}<span class="sub"> · needs ≥{num(r.recipe.minStock)}, not used</span></td>
            <td class="num">0</td>
            <td></td>
            <td class="num stock">{r.stock}</td>
          </tr>
        {/each}
        {#each view.heat as r}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <tr class:bad={r.bad} title={r.text} onclick={() => selectResource(r.id)}>
            <td class="icon">{r.icon}</td>
            <td>Fire<span class="sub"> · {num(r.recipe.atLeast)}–{num(r.recipe.atMost)}°, any fire</span></td>
            <td class="num">0</td>
            <td></td>
            <td class="num stock">{r.recipe.heat!.map((x) => `${Math.round(x.amount)}°`).join(' / ')}</td>
          </tr>
        {/each}
        {#each view.outputs as r}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <tr class="out" class:full={r.full} title={r.text} onclick={() => selectResource(r.id)} onpointerenter={() => (ui.hoverResource = r.id)} onpointerleave={() => (ui.hoverResource = null)}>
            <td class="icon">{r.icon}</td>
            <td>{r.name}{#if r.recipe.byproduct}<span class="sub"> · side product</span>{/if}</td>
            <td class="num pos" title={Math.abs(r.amount - r.base) > 1e-9 ? `base ${num(r.base)}` : ''}>+{num(r.amount)}</td>
            <td class="num rate">{num(r.amount / view.cycleSeconds)}/s</td>
            <td class="num stock">{r.stock}/{num(r.max)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if view.conditions.length}
      <ul class="conditions">
        {#each view.conditions as r}
          <li class:bad={r.bad}>{r.icon} {r.text}</li>
        {/each}
      </ul>
    {/if}
    {#if view.factors.length}
      <p class="factors">
        Output
        {#each view.factors as f, i}
          <span class:down={f.value < 0.999} class:up={f.value > 1.001}>{i ? ' · ' : ' '}{f.name} ×{f.value.toFixed(2)}</span>
        {/each}
      </p>
    {/if}
    {#if view.growth}
      {@const g = view.growth}
      <div class="growth">
        {#if g.shape === 'logistic'}
          <div class="growth-head"><b>Breeding ×{g.factor.toFixed(2)}</b><span>best at {num(g.fullAt)}</span></div>
          <div class="growth-bar"><div style="width: {g.factor * 100}%"></div></div>
          <p>
            Multiplies fastest when {g.resource.def.icon} {g.resource.name} is half full ({num(g.fullAt)} of {num(g.resource.max)}):
            slow when there are only a few, and none when it's full. Now {num(Math.floor(g.stock))}.
          </p>
        {:else}
          <div class="growth-head">
            <b>Growth ×{g.factor.toFixed(2)}</b>
            <span>max ×{num(g.max)}</span>
          </div>
          <div class="growth-bar"><div style="width: {Math.min(100, ((g.factor - Math.min(g.base, 1)) / Math.max(1e-9, g.max - Math.min(g.base, 1))) * 100)}%"></div></div>
          <p>
            Makes more the more {g.resource.def.icon} {g.resource.name} there is{g.threshold > 0 ? ` above ${num(g.threshold)}` : ''}:
            ×{num(g.base)}{g.threshold > 0 ? ` at ${num(g.threshold)}` : ' at 0'}, +{num(g.perUnit * 100)}% per unit, up to ×{num(g.max)} at {num(g.fullAt)}{g.fullAt >
            g.resource.max
              ? ` (more than you can store: ${num(g.resource.max)})`
              : ''}. Now {num(Math.floor(g.stock))}.
          </p>
        {/if}
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
  .box {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--panel-2);
  }
  .box h3 {
    margin-bottom: 6px;
  }
  .k {
    font-size: 15px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    cursor: pointer;
    white-space: nowrap;
  }
  .check.rule {
    white-space: normal;
    margin-top: 4px;
  }
  .crops {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  .crops li {
    display: grid;
    grid-template-columns: 1fr 24px 5ch 24px;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .crops b {
    text-align: right;
  }
  .crops button {
    height: 22px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    cursor: pointer;
  }
  .crops button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .tool-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tool-row p {
    flex: 1;
  }
  .toggle:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .growth-bar.tool div {
    background: var(--ok);
  }
  .growth-bar.tool.low div {
    background: var(--warn);
  }
  .factors {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .factors .down {
    color: #ffb3ba;
  }
  .factors .up {
    color: #a8f0bc;
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
