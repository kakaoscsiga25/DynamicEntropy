<script lang="ts">
  // A top-bar panel: Build (home, workshops, gear, storage) or Research (Insight).
  import { game, ui, togglePanel, type PanelKind } from '../ui/session.svelte';
  import UpgradeCard from './UpgradeCard.svelte';

  import type { Upgrade } from '../game/engine';

  let { panel }: { panel: PanelKind } = $props();

  const TEXT = {
    build: {
      kicker: 'Home, workshops & storage',
      title: '🏠 Build',
      intro: "Upgrades that aren't tied to one node: your home, workshops, gear and storage.",
    },
    research: {
      kicker: 'What you learn from your dreams',
      title: '💡 Research',
      intro: 'Paid with 💡 Insight: write your dream fragments in the journal right after waking up.',
    },
  };
  const text = $derived(TEXT[panel]);

  // Buyable first, then the locked ones.
  const ordered = (list: Upgrade[]) => [...list.filter((u) => u.requirementsMet()), ...list.filter((u) => !u.requirementsMet())];

  const view = $derived.by(() => {
    ui.frame;
    const all = panel === 'research' ? game.research : game.buildings;
    const open = all.filter((u) => !u.bought);
    return {
      sections: game.data.sections
        .map((s) => ({ ...s, upgrades: ordered(open.filter((u) => u.def.section === s.id)) }))
        .filter((s) => s.upgrades.length),
      built: all.filter((u) => u.bought),
    };
  });
</script>

<aside class="drawer" aria-label={text.title}>
  <header>
    <div class="title">
      <span class="kicker">{text.kicker}</span>
      <h2>{text.title}</h2>
    </div>
    <button class="close" onclick={() => togglePanel(panel)} aria-label="Close" title="Close (Esc)">✕</button>
  </header>
  <p class="intro">{text.intro}</p>

  {#each view.sections as sec (sec.id)}
    <section>
      <h3>{sec.name}</h3>
      {#if sec.intro}<p class="sec-intro">{sec.intro}</p>{/if}
      <div class="cards">
        {#each sec.upgrades as u (u.id)}
          <UpgradeCard upgrade={u} />
        {/each}
      </div>
    </section>
  {:else}
    <p class="intro">{panel === 'research' ? 'Everything is learned.' : 'Everything is built.'}</p>
  {/each}

  {#if view.built.length}
    <section>
      <h3>Done</h3>
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
  .sec-intro {
    margin: -4px 0 8px;
    font-size: 12px;
    color: var(--muted);
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
