<script>
  import { Anchors } from '@/engine/anchors.js';
  import { layerState } from '@/stores/layerState.svelte.js';
  import { uiState } from '@/stores/uiState.svelte.js';
  import { RENDER } from '@/engine/config.js';

  let anchors = $derived.by(() => {
    /* eslint-disable-next-line no-unused-vars */
    const _track = layerState.anchorRevision;
    return [...Anchors.getAll()];
  });

  const maxAnchors = RENDER.anchorMaxCount;

  function removeAnchor(id) {
    Anchors.remove(id);
    layerState.layerTransformDirty = true;
    layerState.anchorRevision++;
  }
</script>

{#if anchors.length > 0}
  <aside id="anchor-panel">
    <header class="panel-header">
      <div class="header-left">
        <svg class="header-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="10" cy="10" r="6"/>
          <line x1="10" y1="2" x2="10" y2="6"/>
          <line x1="10" y1="14" x2="10" y2="18"/>
          <line x1="2" y1="10" x2="6" y2="10"/>
          <line x1="14" y1="10" x2="18" y2="10"/>
          <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
        <h3>Ancres</h3>
      </div>
      <span class="counter">{anchors.length}<span class="counter-sep">/</span>{maxAnchors}</span>
    </header>

    <div id="anchor-list">
      {#each anchors as a (a.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="anchor-item"
             onmouseenter={() => uiState.hoveredAnchorId = a.id}
             onmouseleave={() => uiState.hoveredAnchorId = null}>
          <div class="anchor-info">
            <svg class="item-reticle" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <circle cx="8" cy="8" r="4"/>
              <line x1="8" y1="1" x2="8" y2="4"/>
              <line x1="8" y1="12" x2="8" y2="15"/>
              <line x1="1" y1="8" x2="4" y2="8"/>
              <line x1="12" y1="8" x2="15" y2="8"/>
            </svg>
            <span class="anchor-name" class:has-crater={a.name}>
              {a.name || `Ancre #${a.id}`}
            </span>
          </div>
          <button class="anchor-delete" onclick={() => removeAnchor(a.id)} aria-label="Supprimer" title="Supprimer cet ancrage">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      {/each}
    </div>

    {#if anchors.length >= maxAnchors}
      <div class="limit-badge">Limite atteinte</div>
    {/if}
  </aside>
{/if}

<style>
  #anchor-panel {
    position: fixed;
    top: 74px;
    left: 16px;
    width: 220px;
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    background: var(--color-surface);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card), 0 0 16px rgba(0, 255, 136, 0.08), 0 0 4px rgba(0, 255, 136, 0.05);
    z-index: 90;
    padding: 14px;
    animation: slide-in-left 0.3s var(--transition-slow);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .header-icon {
    width: 16px;
    height: 16px;
    color: var(--color-anchor-dst);
    filter: drop-shadow(0 0 4px rgba(0, 255, 136, 0.5));
  }

  .panel-header h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-dim);
    margin: 0;
  }

  .counter {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-anchor-dst);
    background: rgba(0, 255, 136, 0.08);
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    border: 1px solid rgba(0, 255, 136, 0.15);
  }

  .counter-sep {
    color: var(--color-text-dim);
    margin: 0 1px;
  }

  .anchor-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    margin-bottom: 4px;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    transition: all var(--transition-fast);
    cursor: pointer;
  }

  .anchor-item:hover {
    background: rgba(0, 255, 136, 0.04);
    border-color: rgba(0, 255, 136, 0.15);
  }

  .anchor-info {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    min-width: 0;
  }

  .item-reticle {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--color-anchor-dst);
    opacity: 0.7;
    transition: opacity var(--transition-fast), filter var(--transition-fast);
  }

  .anchor-item:hover .item-reticle {
    opacity: 1;
    filter: drop-shadow(0 0 3px rgba(0, 255, 136, 0.6));
  }

  .anchor-name {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color var(--transition-fast);
  }

  .anchor-name.has-crater {
    color: var(--color-anchor-dst);
    font-family: var(--font-main);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: 0.3px;
  }

  .anchor-item:hover .anchor-name {
    color: var(--color-text-bright);
  }

  .anchor-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-dim);
    cursor: pointer;
    flex-shrink: 0;
    transition: all var(--transition-med);
  }

  .anchor-delete svg {
    width: 13px;
    height: 13px;
    stroke: currentColor;
    transition: transform var(--transition-med);
  }

  .anchor-delete:hover {
    background: rgba(255, 59, 92, 0.15);
    color: #ff4d6d;
    box-shadow: 0 0 12px rgba(255, 59, 92, 0.35);
    transform: scale(1.05);
  }

  .anchor-delete:hover svg {
    transform: rotate(90deg) scale(1.1);
  }

  .limit-badge {
    margin-top: 8px;
    padding: 5px 0;
    text-align: center;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-danger);
    background: rgba(255, 59, 92, 0.06);
    border: 1px solid rgba(255, 59, 92, 0.15);
    border-radius: var(--radius-sm);
  }
</style>
