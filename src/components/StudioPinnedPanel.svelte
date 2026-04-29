<script>
  import { uiState } from '@/stores/uiState.svelte.js';
  import { studioState } from '@/stores/studioState.svelte.js';
  import { layerState } from '@/stores/layerState.svelte.js';
  import { PixiRenderer } from '@/engine/pixi_renderer.js';

  let isOpen = $state(true);
  
  $effect(() => {
    if (studioState.pinnedCraters.size > 0) {
      isOpen = true;
    } else if (studioState.pinnedCraters.size === 0) {
      isOpen = false;
    }
  });

  function toggleOpen() {
    isOpen = !isOpen;
  }

  function unpinCrater(name) {
    studioState.togglePinnedCrater(name);
    layerState.layerTransformDirty = true;
  }

  function unpinAll() {
    studioState.pinnedCraters = new Set();
    layerState.layerTransformDirty = true;
  }
</script>

<div class="context-panel" class:open={isOpen} class:disabled={studioState.pinnedCraters.size === 0}>
  <!-- Trigger -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="panel-trigger" onclick={toggleOpen}>
    <div class="trigger-icon" style="color: #00E5FF; filter: drop-shadow(0 0 4px rgba(0,229,255,0.5));">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
    </div>
    <div class="trigger-summary">
      <span class="summary-item">Verrouillés</span>
      <span class="summary-sep">|</span>
      <span class="summary-item" style={studioState.pinnedCraters.size > 0 ? "color: #00E5FF;" : ""}>{studioState.pinnedCraters.size}</span>
    </div>

    {#if studioState.pinnedCraters.size > 0}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="clear-all-btn-header" onclick={(e) => { e.stopPropagation(); unpinAll(); }} title="Vider la liste">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </div>
    {/if}
  </div>

  <!-- Content -->
  <div class="panel-content">
    <div class="scroll-container">
      
      <section class="panel-section">
        <div class="section-header">
          <h3 class="section-title">Labels Verrouillés</h3>
        </div>

        {#if studioState.pinnedCraters.size === 0}
          <div class="empty-state">
            Aucun label verrouillé.<br/>Cliquez sur un label pour le garder visible.
          </div>
        {:else}
          <div class="pinned-list">
            {#each Array.from(studioState.pinnedCraters) as name}
              <div class="pinned-item">
                <span class="pinned-name">{name}</span>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="unpin-btn" onclick={() => unpinCrater(name)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

    </div>
  </div>
</div>

<style>
  /* Base Glassmorphism Panel styles imported from global context-panel or defined here */
  .context-panel {
    width: 270px;
    background: rgba(10, 11, 16, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    flex-shrink: 0;
    pointer-events: auto;
  }

  .context-panel.disabled {
    opacity: 0.5;
    filter: grayscale(0.5);
  }
  .context-panel.disabled .panel-trigger { pointer-events: auto; }

  /* Trigger Header */
  .panel-trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.02);
    user-select: none;
  }

  .panel-trigger:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .trigger-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-dim);
  }

  .trigger-icon svg {
    width: 18px;
    height: 18px;
  }

  .trigger-summary {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .summary-item {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-text);
  }

  .summary-sep {
    color: rgba(255, 255, 255, 0.2);
    font-size: 10px;
  }

  /* Content Area */
  .panel-content {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .context-panel.open {
    flex: 1;
    min-height: 0;
    border-color: rgba(0, 229, 255, 0.3);
    box-shadow: 
      0 10px 40px rgba(0, 0, 0, 0.6),
      0 0 20px rgba(0, 229, 255, 0.15);
  }

  .context-panel.open .panel-content {
    grid-template-rows: 1fr;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    min-height: 0;
    overflow: hidden;
  }

  .scroll-container {
    overflow: hidden;
    padding: 0 16px;
    display: flex;
    flex-direction: column;
  }

  .context-panel.open .scroll-container {
    padding: 16px;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .scroll-container::-webkit-scrollbar { display: none; }

  /* Sections */
  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #00E5FF;
    margin: 0;
  }

  .clear-all-btn-header {
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    margin: -8px;
    border-radius: 50%;
  }

  .clear-all-btn-header:hover {
    color: #FF4081;
    background: rgba(255, 64, 129, 0.1);
  }

  .clear-all-btn-header svg {
    width: 14px;
    height: 14px;
  }

  .empty-state {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    text-align: center;
    padding: 16px 0;
    line-height: 1.5;
  }

  .pinned-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pinned-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 229, 255, 0.2);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
  }

  .pinned-item:hover {
    background: rgba(0, 229, 255, 0.05);
    border-color: rgba(0, 229, 255, 0.4);
  }

  .pinned-name {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text);
  }

  .unpin-btn {
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .unpin-btn:hover {
    color: #FF4081;
  }

  .unpin-btn svg {
    width: 14px;
    height: 14px;
  }
</style>
