<script>
  import { uiState } from '@/stores/uiState.svelte.js';
  import { studioState } from '@/stores/studioState.svelte.js';
  import { layerState } from '@/stores/layerState.svelte.js';
  import { STUDIO, LAYER_PALETTE } from '@/engine/config.js';
  import { tooltip } from '@/actions/tooltip.js';
  import { untrack } from 'svelte';
  import { PixiRenderer } from '@/engine/pixi_renderer.js';

  let isOpen = $state(true);
  
  // Synchronisation : si on ouvre le panel, on active les labels. 
  // Si on désactive les labels (touche L), on ferme le panel.
  $effect(() => {
    if (!uiState.showLabels) {
      isOpen = false;
    }
  });

  $effect(() => {
    if (isOpen && !uiState.showLabels) {
      untrack(() => {
        uiState.showLabels = true;
        PixiRenderer.setLabelsEnabled(true);
      });
    }
  });

  function toggleOpen() {
    isOpen = !isOpen;
  }

  // Extract unique types from crater DB
  let availableTypes = $derived.by(() => {
    if (!layerState.cratersDB) return [];
    const types = new Set();
    for (const c of layerState.cratersDB) {
      if (c.type) types.add(c.type);
    }
    return Array.from(types).sort();
  });

  function toggleType(type) {
    if (studioState.labelHiddenTypes.has(type)) {
      studioState.labelHiddenTypes.delete(type);
    } else {
      studioState.labelHiddenTypes.add(type);
    }
    // Svelte 5 reactivity trigger for Set
    studioState.labelHiddenTypes = new Set(studioState.labelHiddenTypes);
    layerState.layerTransformDirty = true;
  }

  function cycleColorPoints() {
    studioState.labelColorPoints = (studioState.labelColorPoints + 1) % LAYER_PALETTE.length;
    layerState.layerTransformDirty = true;
  }

  function cycleColorText() {
    studioState.labelColorText = (studioState.labelColorText + 1) % LAYER_PALETTE.length;
    layerState.layerTransformDirty = true;
  }

  function getColorHex(index) {
    const color = LAYER_PALETTE[index % LAYER_PALETTE.length];
    return '#' + color.stroke.toString(16).padStart(6, '0');
  }

  function onParamChange() {
    layerState.layerTransformDirty = true;
  }
</script>

<div class="context-panel" class:open={isOpen && uiState.showLabels} class:disabled={!uiState.showLabels}>
  <!-- Trigger -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="panel-trigger" onclick={toggleOpen}>
    <div class="trigger-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
        <line x1="7" y1="7" x2="7.01" y2="7"></line>
      </svg>
    </div>
    <div class="trigger-summary">
      <span class="summary-item">Labels</span>
      {#if !uiState.showLabels}
        <span class="summary-sep">|</span>
        <span class="summary-item" style="color: #FF4081;">Désactivés</span>
      {/if}
    </div>
  </div>

  <!-- Content -->
  <div class="panel-content">
    <div class="scroll-container">
      
      <!-- Font Size & Count -->
      <section class="panel-section">
        <div class="sl-detail-row">
          <span class="sl-detail-label">Taille Police</span>
          <input type="range" class="sl-detail-slider" 
                 min={STUDIO.labelFontSizeMin} max={STUDIO.labelFontSizeMax} step={STUDIO.labelFontSizeStep} 
                 bind:value={studioState.labelFontSize} oninput={onParamChange} />
          <span class="sl-detail-val">{studioState.labelFontSize}</span>
        </div>
        <div class="sl-detail-row" style="margin-top: 6px;">
          <span class="sl-detail-label">Nombre max</span>
          <input type="range" class="sl-detail-slider" 
                 min={STUDIO.labelCountMin} max={STUDIO.labelCountMax} step={STUDIO.labelCountStep} 
                 bind:value={studioState.labelCount} oninput={onParamChange} />
          <span class="sl-detail-val">{studioState.labelCount}</span>
        </div>
      </section>

      <div class="divider"></div>

      <!-- Size Filters -->
      <section class="panel-section">
        <h3 class="section-title">Diamètre Cratère</h3>
        <div class="sl-detail-row">
          <span class="sl-detail-label">Min (km)</span>
          <input type="range" class="sl-detail-slider" 
                 min={STUDIO.labelSizeMin} max={STUDIO.labelSizeMax} step={STUDIO.labelSizeStep} 
                 bind:value={studioState.labelMinSize} oninput={onParamChange} />
          <span class="sl-detail-val">{studioState.labelMinSize}</span>
        </div>
        <div class="sl-detail-row" style="margin-top: 6px;">
          <span class="sl-detail-label">Max (km)</span>
          <input type="range" class="sl-detail-slider" 
                 min={STUDIO.labelSizeMin} max={STUDIO.labelSizeMax} step={STUDIO.labelSizeStep} 
                 bind:value={studioState.labelMaxSize} oninput={onParamChange} />
          <span class="sl-detail-val">{studioState.labelMaxSize}</span>
        </div>
      </section>

      <div class="divider"></div>

      <!-- Type Filters -->
      <section class="panel-section">
        <h3 class="section-title">Affichage par Type</h3>
        <div class="type-grid">
          {#each availableTypes as type}
            {@const isHidden = studioState.labelHiddenTypes.has(type)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="type-item" class:disabled={isHidden} onclick={() => toggleType(type)}>
              <div class="type-checkbox">
                {#if !isHidden}
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 7 6 10 11 4"></polyline></svg>
                {/if}
              </div>
              <span class="type-name">{type}</span>
            </div>
          {/each}
        </div>
      </section>

      <div class="divider"></div>

      <!-- Colors -->
      <section class="panel-section">
        <h3 class="section-title">Couleurs</h3>
        <div class="color-row">
          <span class="sl-detail-label">Points</span>
          <button class="color-swatch" style="background-color: {getColorHex(studioState.labelColorPoints)}" onclick={cycleColorPoints} title="Changer la couleur du point"></button>
        </div>
        <div class="color-row" style="margin-top: 6px;">
          <span class="sl-detail-label">Texte</span>
          <button class="color-swatch" style="background-color: {getColorHex(studioState.labelColorText)}" onclick={cycleColorText} title="Changer la couleur du texte"></button>
        </div>
      </section>

    </div>
  </div>
</div>

<style>
  .context-panel {
    display: flex;
    flex-direction: column;
    width: 270px;
    max-height: 48px;
    flex: 0 0 auto;
    background: rgba(10, 11, 16, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
  }

  .context-panel.open {
    max-height: 100%;
    flex: 1 1 auto;
    border-radius: 16px;
    border-color: rgba(255, 64, 129, 0.3);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 64, 129, 0.15);
  }

  .context-panel.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  .context-panel.disabled .panel-trigger { pointer-events: auto; }

  .panel-trigger {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    cursor: pointer;
    gap: 12px;
    user-select: none;
  }

  .trigger-icon {
    width: 20px;
    height: 20px;
    color: #FF4081;
    flex-shrink: 0;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .context-panel.open .trigger-icon {
    transform: rotate(90deg);
  }

  .trigger-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-dim);
  }

  .summary-sep { opacity: 0.3; }

  .panel-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    padding: 0 16px 16px 16px;
  }

  .context-panel.open .panel-content {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 0.5s ease 0.1s;
  }

  .scroll-container {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .scroll-container::-webkit-scrollbar { display: none; }

  .panel-section { padding: 6px 0; }

  .section-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #FF4081;
    margin-bottom: 12px;
    opacity: 0.9;
  }

  .divider {
    height: 1px; width: 100%;
    background: rgba(255, 255, 255, 0.05);
    margin: 8px 0;
  }

  .sl-detail-row {
    display: flex; align-items: center; gap: 8px;
  }

  .sl-detail-label {
    font-size: 10px; font-weight: 500; color: var(--color-text-dim); min-width: 60px;
  }

  .sl-detail-slider {
    flex: 1; min-width: 0; height: 3px;
    background: rgba(255, 64, 129, 0.12); border-radius: 2px;
    appearance: none; -webkit-appearance: none; outline: none; cursor: pointer;
  }
  .sl-detail-slider::-webkit-slider-thumb {
    appearance: none; -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%;
    background: #FF4081; border: 1.5px solid rgba(255, 255, 255, 0.3);
  }

  .sl-detail-val {
    font-family: var(--font-mono); font-size: 10px; color: #FF4081; min-width: 24px; text-align: right;
  }

  .type-grid {
    display: flex; flex-direction: column; gap: 6px;
  }

  .type-item {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 6px; border-radius: 6px;
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer; transition: background 0.2s;
  }
  .type-item:hover { background: rgba(255, 64, 129, 0.1); }
  .type-item.disabled { opacity: 0.5; }

  .type-checkbox {
    width: 14px; height: 14px; border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex; align-items: center; justify-content: center;
    color: #FF4081;
  }
  .type-item:not(.disabled) .type-checkbox {
    background: rgba(255, 64, 129, 0.2);
    border-color: #FF4081;
  }

  .type-name {
    font-size: 11px; color: var(--color-text);
  }

  .color-row {
    display: flex; align-items: center; justify-content: space-between;
  }

  .color-swatch {
    width: 24px; height: 24px; border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    cursor: pointer; transition: transform 0.2s;
  }
  .color-swatch:hover {
    transform: scale(1.1); border-color: #fff;
  }
</style>
