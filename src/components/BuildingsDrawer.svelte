<script lang="ts">
  import { game, ui, toggleBuildings } from '../ui/session.svelte';
  import UpgradeCard from './UpgradeCard.svelte';

  const view = $derived.by(() => {
    ui.frame;
    const open = game.buildings.filter((u) => !u.bought);
    return {
      available: open.filter((u) => u.requirementsMet()),
      locked: open.filter((u) => !u.requirementsMet()),
      built: game.buildings.filter((u) => u.bought),
    };
  });
</script>

<aside class="drawer" aria-label="Build">
  <header>
    <div class="title">
      <span class="kicker">Home & storage</span>
      <h2>🏠 Build</h2>
    </div>
    <button class="close" onclick={toggleBuildings} aria-label="Close" title="Close (Esc)">✕</button>
  </header>
  <p class="intro">Buildings that aren't tied to one node: a better place to sleep, and storage that raises how much of a resource you can keep.</p>

  {#if view.available.length || view.locked.length}
    <div class="cards">
      {#each view.available as u (u.id)}
        <UpgradeCard upgrade={u} />
      {/each}
      {#each view.locked as u (u.id)}
        <UpgradeCard upgrade={u} />
      {/each}
    </div>
  {:else}
    <p class="intro">Everything is built.</p>
  {/if}

  {#if view.built.length}
    <section>
      <h3>Built</h3>
      <ul class="built">
        {#each view.built as u (u.id)}
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
  .kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--dream);
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
  .intro {
    margin: 8px 0 14px;
    font-size: 12.5px;
    color: var(--muted);
  }
  .cards {
    display: grid;
    gap: 8px;
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
  .built {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    display: grid;
    gap: 3px;
  }
</style>
