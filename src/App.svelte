<script lang="ts">
  import { ui, start, select, resetGame, toggleConverter, game } from './ui/session.svelte';
  import TopBar from './components/TopBar.svelte';
  import ResourcePanel from './components/ResourcePanel.svelte';
  import GraphView from './components/GraphView.svelte';
  import NodeDrawer from './components/NodeDrawer.svelte';
  import ResourceDrawer from './components/ResourceDrawer.svelte';
  import BuildingsDrawer from './components/BuildingsDrawer.svelte';
  import Modal from './components/Modal.svelte';

  // Load the save and start ticking before the graph mounts (so it can fit the view).
  start();

  function closeModal() {
    ui.modal = null;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (ui.modal) closeModal();
      else if (ui.showResources) ui.showResources = false;
      else select(null);
    } else if (e.key === ' ' && ui.selected && !ui.modal) {
      // Space starts / stops the selected node (unless a button or input has focus).
      const t = e.target as HTMLElement;
      if (t.closest('button, input, textarea, select')) return;
      e.preventDefault();
      if (!game.converter(ui.selected).unstoppable) toggleConverter(ui.selected);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="app" class:has-drawer={ui.selected !== null || ui.selectedResource !== null || ui.showBuildings}>
  <div class="top"><TopBar /></div>
  <div class="resources" class:open={ui.showResources}><ResourcePanel /></div>
  <main class="graph"><GraphView /></main>
  {#if ui.selected || ui.selectedResource || ui.showBuildings}
    <div class="drawer">
      {#key ui.selected ?? ui.selectedResource ?? 'buildings'}
        {#if ui.selected}
          <NodeDrawer id={ui.selected} />
        {:else if ui.selectedResource}
          <ResourceDrawer id={ui.selectedResource} />
        {:else}
          <BuildingsDrawer />
        {/if}
      {/key}
    </div>
  {/if}

  <div class="toasts" aria-live="polite">
    {#each ui.toasts as t (t.id)}
      <div class="toast">{t.text}</div>
    {/each}
  </div>
</div>

{#if ui.modal === 'howto'}
  <Modal title="How to play" onclose={closeModal}>
    <div class="howto">
      <p class="lead">You are dreaming. Build up your dream world until you can finally <b>wake up</b>.</p>
      <ul>
        <li><b>Nodes</b> turn resources into other resources in cycles (1 s, the bar at the bottom of the node): the inputs go in when a cycle starts, the outputs come out when it ends. Their chips show what goes in <span class="muted">→</span> what comes out.</li>
        <li><b>Start / stop</b> a node by clicking the <b>colored strip</b> on its left side (or right-click it, or press Space when it's selected). <b>▶ all / ❚❚ all</b> next to an island's name switches the whole island.</li>
        <li><b>Click</b> a node to see its details and buy its <b>upgrades</b>. A glowing <span class="badge">⬆ 1</span> means you can afford one.</li>
        <li><b>Build</b> (top bar) has your home and storage buildings: a better place to sleep, and room for more of each resource. Later also <b>skills</b>, like setting each node's <b>pace</b>: slower gets more out of each input.</li>
        <li><b>⚡ Stamina</b> only works while you're awake: when it runs out you fall asleep, and the nodes that use it pause until you wake up. <b>Eating bread</b> gives Stamina while you're awake.</li>
        <li>A node's color tells where it is in its cycle: it can't start without its inputs <span class="sw state-noInput"></span>, then it runs <span class="sw state-ok"></span>, may get interrupted, e.g. when you fall asleep <span class="sw state-interrupted"></span>, and at the end waits until its output fits in storage <span class="sw state-full"></span>. Stopped nodes are grey <span class="sw state-stopped"></span>.</li>
        <li><b>Lines</b> show resources flowing between nodes: the icon in the middle tells what flows, the arrow where. Lines of common resources (⚡ Stamina, 💧 Water, 🔥 Fire) only appear while you hover or select a node, to keep the map tidy.</li>
        <li><b>Hover a resource</b> (on the left, or any chip on a node) to light up who makes it <span class="ok">(green)</span> and who uses it <span class="bad">(red)</span>. <b>Click</b> it to see the full list, and start or stop those nodes from there.</li>
        <li><b>Drag</b> the background to move around, <b>scroll</b> or pinch to zoom.</li>
        <li>When nothing seems to work, try twiddling your thumbs to lose your Stamina and fall asleep.</li>
      </ul>
      <p class="goal"><b>Goal:</b> buy the upgrade of the <b>Wake up</b> node.</p>
      <button class="primary" onclick={closeModal}>Let's go</button>
    </div>
  </Modal>
{:else if ui.modal === 'reset'}
  <Modal title="Reset the game?" onclose={closeModal}>
    <p>Your saved progress will be deleted and the game starts over. This can't be undone.</p>
    <div class="actions">
      <button onclick={closeModal}>Cancel</button>
      <button class="danger" onclick={resetGame}>Reset</button>
    </div>
  </Modal>
{:else if ui.modal === 'ending'}
  <Modal title="The End" onclose={closeModal}>
    <div class="ending">
      <img src="./tenor.gif" alt="Finally awake..." />
      <p>Hey, you! You're finally awake.</p>
      <p>You were trying to cross the border, right? Walked right into that imperial ambush, same as us.</p>
      <p class="muted">To be continued...</p>
      <button class="primary" onclick={closeModal}>Thanks for playing</button>
    </div>
  </Modal>
{/if}

<style>
  .app {
    display: grid;
    grid-template-columns: 270px 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'top top'
      'resources graph';
    height: 100dvh;
    overflow: hidden;
  }
  .app.has-drawer {
    grid-template-columns: 270px 1fr 370px;
    grid-template-areas:
      'top top top'
      'resources graph drawer';
  }
  .top {
    grid-area: top;
  }
  .resources {
    grid-area: resources;
    min-height: 0;
  }
  .graph {
    grid-area: graph;
    min-width: 0;
    min-height: 0;
  }
  .drawer {
    grid-area: drawer;
    min-height: 0;
    animation: slide 0.2s ease-out;
  }
  .toasts {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    z-index: 40;
    pointer-events: none;
  }
  .toast {
    padding: 7px 14px;
    border-radius: 999px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
    font-size: 13px;
    animation: toast 2.6s ease-in-out forwards;
  }

  .howto ul {
    padding-left: 18px;
    display: grid;
    gap: 7px;
    font-size: 14px;
    line-height: 1.45;
  }
  .lead {
    font-size: 15px;
  }
  .goal {
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--dream) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--dream) 35%, transparent);
  }
  .badge {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 8px;
    color: #10131f;
    background: var(--upgrade);
  }
  .sw {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--state);
  }
  .ok { color: var(--ok); }
  .bad { color: var(--bad); }
  .muted { color: var(--muted); }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .actions button,
  .primary {
    padding: 8px 16px;
    border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--panel-2);
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
  }
  .primary {
    background: var(--dream);
    border-color: var(--dream);
    color: #140f24;
    font-weight: 650;
  }
  .danger {
    background: var(--bad) !important;
    border-color: var(--bad) !important;
    color: #1a0b0e !important;
    font-weight: 650;
  }
  .ending {
    text-align: center;
  }
  .ending img {
    max-width: 100%;
    border-radius: 10px;
    margin-top: 12px;
  }

  @keyframes slide {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
  }
  @keyframes toast {
    0% {
      opacity: 0;
      transform: translateY(8px);
    }
    10%,
    85% {
      opacity: 1;
      transform: none;
    }
    100% {
      opacity: 0;
    }
  }

  /* Phones / narrow windows: graph full screen, panels slide over it. */
  @media (max-width: 820px) {
    .app,
    .app.has-drawer {
      grid-template-columns: 1fr;
      grid-template-areas:
        'top'
        'graph';
    }
    .resources {
      position: fixed;
      top: 52px;
      bottom: 0;
      left: 0;
      width: min(300px, 85vw);
      z-index: 30;
      transform: translateX(-100%);
      transition: transform 0.2s;
      box-shadow: 10px 0 30px rgb(0 0 0 / 0.4);
    }
    .resources.open {
      transform: none;
    }
    .drawer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      height: 62dvh;
      z-index: 35;
      border-top: 1px solid var(--border);
      border-radius: 16px 16px 0 0;
      overflow: hidden;
      box-shadow: 0 -10px 30px rgb(0 0 0 / 0.4);
      animation: sheet 0.2s ease-out;
    }
    @keyframes sheet {
      from {
        transform: translateY(30px);
        opacity: 0;
      }
    }
  }
</style>
