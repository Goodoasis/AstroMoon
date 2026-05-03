<script>
  import { projectStore } from '../stores/projectStore.svelte.js';
  import { exportState } from '../stores/exportState.svelte.js';
  import NeonButton from './NeonButton.svelte';

  let isOpen = $state(true);

  function toggleOpen() {
    isOpen = !isOpen;
  }

  function triggerDownload() {
    const canvas = document.getElementById('main-canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `AstroMoon-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }

  function handleDragStart(e, card) {
    exportState.draggedCardData = card;
    e.dataTransfer.setData('text/plain', JSON.stringify(card));
    // Optionnel : donner un feedback visuel au drag
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleDragEnd() {
    exportState.draggedCardData = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="ep-layout">
  <div class="ep-panel" class:open={isOpen && !exportState.isDraggingCard} class:trash-mode={exportState.isDraggingCard} id="export-panel-html">
    {#if exportState.isDraggingCard}
      <div class="trash-overlay">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="trash-icon">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <div class="trash-text">GLISSER ICI POUR SUPPRIMER</div>
      </div>
    {:else}
      <!-- Trigger -->
      <div
        class="ep-trigger"
        onclick={toggleOpen}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Enter" && toggleOpen()}
      >
        <div class="ep-trigger-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M12 20h9" /><path
              d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            />
          </svg>
        </div>
        <div class="ep-trigger-text">
          <span>Layout</span>
        </div>
      </div>

      <!-- Content -->
      <div class="ep-content">
        <div class="ep-scroll">
          <section class="ep-section">
            <h4 class="ep-title">Blocs d'information</h4>
            <p class="ep-subtitle">Glissez ces cartes sur l'image</p>
            
            <div class="ep-cards-list">
              {#each exportState.availableCards as card}
                <div 
                  class="ep-card" 
                  draggable="true" 
                  ondragstart={(e) => handleDragStart(e, card)}
                  ondragend={handleDragEnd}
                >
                  <div class="ep-card-title">{card.title}</div>
                  <div class="ep-card-content">{card.content}</div>
                </div>
              {/each}
            </div>
          </section>

          <div class="ep-div"></div>

          <section class="ep-section">
            <h4 class="ep-title">Recadrage</h4>
            <div class="ratio-selector">
                <NeonButton variant="tab" label="Libre" active={projectStore.exportConfig.ratio === 'Free' || !projectStore.exportConfig.ratio} onclick={() => projectStore.exportConfig.ratio = 'Free'} />
                <NeonButton variant="tab" label="1:1" active={projectStore.exportConfig.ratio === '1:1'} onclick={() => projectStore.exportConfig.ratio = '1:1'} />
                <NeonButton variant="tab" label="4:3" active={projectStore.exportConfig.ratio === '4:3'} onclick={() => projectStore.exportConfig.ratio = '4:3'} />
                <NeonButton variant="tab" label="16:9" active={projectStore.exportConfig.ratio === '16:9'} onclick={() => projectStore.exportConfig.ratio = '16:9'} />
            </div>
          </section>
        </div>

        <!-- Footer -->
        <div class="ep-footer">
          <div class="ep-div"></div>
          <NeonButton
            variant="primary"
            label="EXPORTER"
            color="#FFD700"
            fullWidth={true}
            onclick={triggerDownload}
          >
            {#snippet icon()}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width: 16px; height: 16px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            {/snippet}
          </NeonButton>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .ep-layout {
    pointer-events: none;
  }

  .ep-panel {
    display: flex;
    flex-direction: column;
    width: 270px;
    max-height: 48px;
    background: rgba(10, 11, 16, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    --nt-panel-color: #FFD700;
  }

  .ep-panel.open {
    flex: 1;
    min-height: 0;
    max-height: none;
    border-radius: 16px;
    border-color: rgba(255, 215, 0, 0.3);
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.6),
      0 0 20px rgba(255, 215, 0, 0.15);
    overflow: visible;
    transition: flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ep-panel.open:hover {
    flex: 3;
  }

  .ep-panel.trash-mode {
    background: rgba(255, 0, 0, 0.1);
    border-color: rgba(255, 0, 0, 0.5);
    box-shadow: 0 0 30px rgba(255, 0, 0, 0.3);
    justify-content: center;
    align-items: center;
  }

  .trash-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px;
  }

  .trash-icon {
    width: 48px;
    height: 48px;
    color: #ff4444;
  }

  .trash-text {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #ff4444;
    letter-spacing: 2px;
    text-align: center;
  }

  /* Trigger */
  .ep-trigger {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    cursor: pointer;
    gap: 12px;
    user-select: none;
  }

  .ep-trigger-icon {
    width: 20px;
    height: 20px;
    color: #FFD700;
    flex-shrink: 0;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ep-panel.open .ep-trigger-icon {
    transform: rotate(90deg);
  }

  .ep-trigger-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-dim);
  }

  /* Content */
  .ep-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    padding: 0 16px 14px 16px;
  }

  .ep-panel.open .ep-content {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 0.5s ease 0.1s;
  }

  .ep-scroll {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    scrollbar-width: none;
    padding-bottom: 8px;
    max-height: calc(85vh - 120px);
  }
  .ep-scroll::-webkit-scrollbar {
    display: none;
  }

  /* Sections */
  .ep-section {
    padding: 6px 0;
  }

  .ep-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: "Space Grotesk", sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(255, 215, 0, 0.8);
    margin-bottom: 4px;
  }

  .ep-subtitle {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-dim);
    margin-bottom: 12px;
    opacity: 0.6;
  }

  .ep-div {
    height: 1px;
    background: rgba(255, 215, 0, 0.08);
    margin: 4px 0;
  }

  /* Cards List */
  .ep-cards-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ep-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px;
    cursor: grab;
    transition: all 0.2s ease;
  }

  .ep-card:hover {
    background: rgba(255, 215, 0, 0.05);
    border-color: rgba(255, 215, 0, 0.3);
    transform: translateY(-1px);
  }

  .ep-card:active {
    cursor: grabbing;
    transform: scale(0.98);
  }

  .ep-card-title {
    font-family: "Space Grotesk", sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }

  .ep-card-content {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-dim);
    white-space: pre-line;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ratio-selector {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }

  .ep-footer {
    flex-shrink: 0;
    margin-top: 6px;
  }
</style>
