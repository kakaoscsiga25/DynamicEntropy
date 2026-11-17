<script lang="ts">
  import { ui, save, setFast, APP_VERSION, DEV } from '../ui/session.svelte';
  import { clock } from '../ui/format';
</script>

<header class="bar">
  <button
    class="menu"
    onclick={() => (ui.showResources = !ui.showResources)}
    aria-label="Show resources"
    aria-expanded={ui.showResources}>☰</button
  >
  <h1>Dynamic Entropy <span class="version">{APP_VERSION}</span></h1>

  <div class="info">
    <span title="Playtime">⏱ {clock(ui.playtime)}</span>
    <span class="autosave" title="The game also saves when you close the tab">Autosave in {ui.autosaveIn}s</span>
    {#if DEV}
      <label class="dev"><input type="checkbox" checked={ui.fast} onchange={(e) => setFast(e.currentTarget.checked)} /> 10× speed</label>
    {/if}
  </div>

  <nav>
    <button onclick={() => (ui.modal = 'howto')}><span class="long">How to play</span><span class="short">Help</span></button>
    <button onclick={() => save(true)}>Save</button>
    <button class="danger" onclick={() => (ui.modal = 'reset')}>Reset</button>
  </nav>
</header>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 14px;
    height: 52px;
    box-sizing: border-box;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
  h1 {
    margin: 0;
    font-size: 17px;
    font-weight: 750;
    letter-spacing: 0.02em;
    white-space: nowrap;
    background: linear-gradient(90deg, var(--dream), var(--upgrade));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
  .version {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
    -webkit-text-fill-color: var(--muted);
  }
  .info {
    flex: 1;
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  nav {
    display: flex;
    gap: 6px;
  }
  button {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--panel-2);
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
  }
  button:hover {
    border-color: var(--muted);
  }
  .danger:hover {
    border-color: var(--bad);
    color: var(--bad);
  }
  .menu,
  .short {
    display: none;
  }
  .dev {
    color: var(--warn);
  }
  @media (max-width: 820px) {
    .bar {
      gap: 10px;
      padding: 0 10px;
    }
    .menu {
      display: block;
    }
    .autosave,
    .version,
    .long {
      display: none;
    }
    .short {
      display: inline;
    }
    nav button {
      padding: 6px 8px;
      font-size: 12px;
    }
  }
  @media (max-width: 520px) {
    .info {
      display: none;
    }
    h1 {
      flex: 1;
      font-size: 15px;
    }
  }
</style>
