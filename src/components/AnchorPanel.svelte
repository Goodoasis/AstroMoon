<script>
  import { Anchors } from '@/engine/anchors.js';
  import { layerState } from '@/stores/layerState.svelte.js';

  let anchors = $derived.by(() => {
    /* eslint-disable-next-line no-unused-vars */
    const _track = layerState.anchorRevision;
    return [...Anchors.getAll()];
  });

  function removeAnchor(id) {
    Anchors.remove(id);
    layerState.layerTransformDirty = true;
    layerState.anchorRevision++;
  }
</script>

{#if anchors.length > 0}
  <aside id="anchor-panel">
    <h3>📌 Punaises</h3>
    <div id="anchor-list">
      {#each anchors as a (a.id)}
        <div class="anchor-item">
          <span class="anchor-id">📌 #{a.id}</span>
          <button class="anchor-delete" onclick={() => removeAnchor(a.id)} aria-label="Supprimer" title="Supprimer cet ancrage">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  </aside>
{/if}

<style>
  #anchor-panel {
    position: fixed; top: 110px; right: 16px; width: 220px; max-height: calc(100vh - 150px); overflow-y: auto;
    background: var(--color-surface); backdrop-filter: blur(var(--blur)); -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--color-border); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card), var(--shadow-hud-glow); z-index: 90; padding: 14px;
    animation: slide-in-right 0.3s var(--transition-slow);
  }
  #anchor-panel h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-text-dim); margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border); }
  .anchor-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; margin-bottom: 4px; border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.03); border: 1px solid transparent; transition: all var(--transition-fast); cursor: pointer; }
  .anchor-item:hover { background: rgba(255, 255, 255, 0.06); border-color: var(--color-border); }
  .anchor-item .anchor-id { font-family: var(--font-mono); font-size: 12px; color: var(--color-cyan); }
  .anchor-item .anchor-delete { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: none; border-radius: 50%; background: transparent; color: var(--color-text-dim); cursor: pointer; transition: all var(--transition-med); }
  .anchor-item .anchor-delete svg { width: 14px; height: 14px; stroke: currentColor; transition: transform var(--transition-med); }
  .anchor-item .anchor-delete:hover { background: rgba(255, 59, 92, 0.15); color: #ff4d6d; box-shadow: 0 0 12px rgba(255, 59, 92, 0.35); transform: scale(1.05); }
  .anchor-item .anchor-delete:hover svg { transform: rotate(90deg) scale(1.1); }
</style>
