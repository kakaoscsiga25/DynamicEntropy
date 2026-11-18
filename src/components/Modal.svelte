<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    onclose,
    children,
  }: { title: string; onclose: () => void; children: Snippet } = $props();
</script>

<div class="backdrop" role="presentation" onclick={onclose}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <header>
      <h2>{title}</h2>
      <button class="close" onclick={onclose} aria-label="Close" title="Close (Esc)">✕</button>
    </header>
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(5 6 14 / 0.65);
    backdrop-filter: blur(3px);
    animation: fade 0.25s ease-out;
  }
  .modal {
    width: min(560px, 100%);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 18px 22px 22px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--border);
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
    animation: rise 0.3s ease-out;
  }
  header {
    display: flex;
    align-items: center;
  }
  h2 {
    flex: 1;
    margin: 0;
    font-size: 20px;
  }
  .close {
    border: none;
    background: none;
    color: var(--muted);
    font-size: 16px;
    cursor: pointer;
  }
  .close:hover {
    color: var(--text);
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
</style>
