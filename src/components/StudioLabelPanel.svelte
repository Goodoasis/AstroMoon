<script>
  import { uiState } from '@/stores/uiState.svelte.js';
  import { studioState } from '@/stores/studioState.svelte.js';
  import { layerState } from '@/stores/layerState.svelte.js';
  import { STUDIO, LAYER_PALETTE } from '@/engine/config.js';
  import { untrack } from 'svelte';
  import { PixiRenderer } from '@/engine/pixi_renderer.js';
  import RangeSlider from './RangeSlider.svelte';
  import NeonToggle from './NeonToggle.svelte';

  let isOpen = $state(true);
  let expandedSection = $state(null);

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

  function toggleExpand(section) {
    expandedSection = expandedSection === section ? null : section;
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
    <div style="margin-left: auto; display: flex;">
      <NeonToggle 
        label="HQ"
        labelLeft={true}
        size="md"
        color="#FF4081" 
        bind:checked={studioState.labelHQ} 
        onchange={onParamChange} 
      />
    </div>
  </div>

  <!-- Content -->
  <div class="panel-content">
    <div class="scroll-container">
      
      <!-- Size Filters -->
      <section class="panel-section">
        <h3 class="section-title">Filtre d'affichage</h3>
        <div class="sl-detail-row">
          <RangeSlider variant="detail" label="Min (km)" min={STUDIO.labelSizeMin} max={STUDIO.labelSizeMax} step={STUDIO.labelSizeStep} bind:value={studioState.labelMinSize} initialValue={STUDIO.labelSizeDefaultMin} fixed={0} oninput={onParamChange} />
        </div>
        <div class="sl-detail-row" style="margin-top: 6px;">
          <RangeSlider variant="detail" label="Max (km)" min={STUDIO.labelSizeMin} max={STUDIO.labelSizeMax} step={STUDIO.labelSizeStep} bind:value={studioState.labelMaxSize} initialValue={STUDIO.labelSizeDefaultMax} fixed={0} oninput={onParamChange} />
        </div>
      </section>

      <div class="divider"></div>

      <!-- Advanced Style Sections -->
      <section class="panel-section">
        <h3 class="section-title">Style Avancé</h3>
        
        <div class="sl-layer-list">
          
          <!-- ── POLICE (TEXT) ── -->
          <div class="sl-layer-item" class:collapsed={!studioState.labelPoliceVisible}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="sl-layer-row" role="button" tabindex="0" onclick={() => toggleExpand('police')}>
              <button class="sl-eye-btn" class:hidden={!studioState.labelPoliceVisible} onclick={(e) => { e.stopPropagation(); studioState.labelPoliceVisible = !studioState.labelPoliceVisible; onParamChange(); }} title={studioState.labelPoliceVisible ? 'Masquer' : 'Afficher'}>
                {#if studioState.labelPoliceVisible}
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
                {:else}
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
                {/if}
              </button>
              <button class="sl-color-swatch" style:background={getColorHex(studioState.labelColorText)} onclick={(e) => { e.stopPropagation(); cycleColorText(); }} title="Changer la couleur du texte"></button>
              <span class="sl-layer-name">Police</span>
              <RangeSlider variant="mini" min={0} max={1} step={0.05} bind:value={studioState.labelPoliceOpacity} initialValue={1.0} color={getColorHex(studioState.labelColorText)} stopPropagation={true} oninput={onParamChange} />
              <span class="sl-expand-indicator" class:expanded={expandedSection === 'police'}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,4 10,8 6,12"/></svg>
              </span>
            </div>
            {#if expandedSection === 'police'}
              <div class="sl-layer-details">
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Taille" min={STUDIO.labelFontSizeMin} max={STUDIO.labelFontSizeMax} step={1} bind:value={studioState.labelFontSize} initialValue={STUDIO.labelFontSizeDefault} color={getColorHex(studioState.labelColorText)} oninput={onParamChange} />
                </div>
                <div class="sl-detail-row" class:sl-disabled={!studioState.labelHQ}>
                  <span class="sl-detail-label">Typo</span>
                  <select class="sl-select" bind:value={studioState.labelPoliceFont} onchange={onParamChange} disabled={!studioState.labelHQ}>
                    {#each STUDIO.labelPoliceFonts as f}
                      <option value={f}>{f}</option>
                    {/each}
                  </select>
                </div>
                <div class="sl-detail-row" class:sl-disabled={!studioState.labelHQ}>
                  <RangeSlider variant="detail" label="Graisse" min={STUDIO.labelWeightMin} max={STUDIO.labelWeightMax} step={STUDIO.labelWeightStep} bind:value={studioState.labelPoliceWeight} initialValue={STUDIO.labelPoliceWeightDefault} color={getColorHex(studioState.labelColorText)} oninput={onParamChange} disabled={!studioState.labelHQ} />
                </div>
              </div>
            {/if}
          </div>

          <!-- ── FOND (BACKGROUND) ── -->
          <div class="sl-layer-item" class:collapsed={!studioState.labelFondVisible}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="sl-layer-row" role="button" tabindex="0" onclick={() => toggleExpand('fond')}>
              <button class="sl-eye-btn" class:hidden={!studioState.labelFondVisible} onclick={(e) => { e.stopPropagation(); studioState.labelFondVisible = !studioState.labelFondVisible; onParamChange(); }} title={studioState.labelFondVisible ? 'Masquer' : 'Afficher'}>
                {#if studioState.labelFondVisible}
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
                {:else}
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
                {/if}
              </button>
              <button class="sl-color-swatch" style:background={getColorHex(studioState.labelFondColor)} onclick={(e) => { e.stopPropagation(); studioState.labelFondColor = (studioState.labelFondColor + 1) % LAYER_PALETTE.length; onParamChange(); }} title="Changer la couleur du fond"></button>
              <span class="sl-layer-name">Fond</span>
              <RangeSlider variant="mini" min={0} max={1} step={0.05} bind:value={studioState.labelFondOpacity} initialValue={0.8} color={getColorHex(studioState.labelFondColor)} stopPropagation={true} oninput={onParamChange} />
              <span class="sl-expand-indicator" class:expanded={expandedSection === 'fond'}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,4 10,8 6,12"/></svg>
              </span>
            </div>
            {#if expandedSection === 'fond'}
              <div class="sl-layer-details">
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Taille X" min={STUDIO.labelFondSizeXMin} max={STUDIO.labelFondSizeXMax} step={1} bind:value={studioState.labelFondSizeX} initialValue={STUDIO.labelFondSizeXDefault} color={getColorHex(studioState.labelFondColor)} oninput={onParamChange} />
                </div>
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Taille Y" min={STUDIO.labelFondSizeYMin} max={STUDIO.labelFondSizeYMax} step={1} bind:value={studioState.labelFondSizeY} initialValue={STUDIO.labelFondSizeYDefault} color={getColorHex(studioState.labelFondColor)} oninput={onParamChange} />
                </div>
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Glow" min={0} max={STUDIO.labelFondGlowMax} step={0.5} bind:value={studioState.labelFondGlow} initialValue={STUDIO.labelFondGlowDefault} color={getColorHex(studioState.labelFondColor)} oninput={onParamChange} />
                </div>
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Flou" min={0} max={STUDIO.labelFondBlurMax} step={0.5} bind:value={studioState.labelFondBlur} initialValue={STUDIO.labelFondBlurDefault} color={getColorHex(studioState.labelFondColor)} oninput={onParamChange} />
                </div>
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Arrondi" min={0} max={STUDIO.labelFondRadiusMax} step={1} bind:value={studioState.labelFondRadius} initialValue={STUDIO.labelFondRadiusDefault} color={getColorHex(studioState.labelFondColor)} oninput={onParamChange} />
                </div>
                <div class="sl-detail-row">
                  <span class="sl-detail-label">Surbrillance</span>
                  <NeonToggle size="md" color="#00E5FF" bind:checked={studioState.labelShowLockHighlight} onchange={onParamChange} />
                </div>
                <div class="sl-detail-row">
                  <span class="sl-detail-label">Ombre Portée ⚠️</span>
                  <NeonToggle size="md" color={getColorHex(studioState.labelFondColor)} bind:checked={studioState.labelFondShadow} onchange={onParamChange} />
                </div>
              </div>
            {/if}
          </div>

          <!-- ── POINT (INDICATOR) ── -->
          <div class="sl-layer-item" class:collapsed={!studioState.labelPointVisible}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="sl-layer-row" role="button" tabindex="0" onclick={() => toggleExpand('point')}>
              <button class="sl-eye-btn" class:hidden={!studioState.labelPointVisible} onclick={(e) => { e.stopPropagation(); studioState.labelPointVisible = !studioState.labelPointVisible; onParamChange(); }} title={studioState.labelPointVisible ? 'Masquer' : 'Afficher'}>
                {#if studioState.labelPointVisible}
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></svg>
                {:else}
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
                {/if}
              </button>
              <button class="sl-color-swatch" style:background={getColorHex(studioState.labelColorPoints)} onclick={(e) => { e.stopPropagation(); cycleColorPoints(); }} title="Changer la couleur du point"></button>
              <span class="sl-layer-name">Point</span>
              <RangeSlider variant="mini" min={0} max={1} step={0.05} bind:value={studioState.labelPointOpacity} initialValue={1.0} color={getColorHex(studioState.labelColorPoints)} stopPropagation={true} oninput={onParamChange} />
              <span class="sl-expand-indicator" class:expanded={expandedSection === 'point'}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,4 10,8 6,12"/></svg>
              </span>
            </div>
            {#if expandedSection === 'point'}
              <div class="sl-layer-details">
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Taille" min={STUDIO.labelPointSizeMin} max={STUDIO.labelPointSizeMax} step={STUDIO.labelPointSizeStep} bind:value={studioState.labelPointSize} initialValue={STUDIO.labelPointSizeDefault} color={getColorHex(studioState.labelColorPoints)} oninput={onParamChange} />
                </div>
                <div class="sl-detail-row">
                  <span class="sl-detail-label">Forme</span>
                  <select class="sl-select" bind:value={studioState.labelPointShape} onchange={onParamChange}>
                    {#each STUDIO.labelPointShapes as s}
                      <option value={s}>{s}</option>
                    {/each}
                  </select>
                </div>
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Glow" min={0} max={STUDIO.labelPointGlowMax} step={0.5} bind:value={studioState.labelPointGlow} initialValue={STUDIO.labelPointGlowDefault} color={getColorHex(studioState.labelColorPoints)} oninput={onParamChange} />
                </div>
                <div class="sl-detail-row">
                  <RangeSlider variant="detail" label="Flou" min={0} max={STUDIO.labelPointBlurMax} step={0.5} bind:value={studioState.labelPointBlur} initialValue={STUDIO.labelPointBlurDefault} color={getColorHex(studioState.labelColorPoints)} oninput={onParamChange} />
                </div>
              </div>
            {/if}
          </div>

        </div>
      </section>

      <div class="divider"></div>

      <!-- Count Control -->
      <section class="panel-section">
        <div class="sl-detail-row">
          <RangeSlider variant="detail" label="Nombre max" min={STUDIO.labelCountMin} max={STUDIO.labelCountMax} step={STUDIO.labelCountStep} bind:value={studioState.labelCount} initialValue={STUDIO.labelCountDefault} fixed={0} oninput={onParamChange} />
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

    </div>
  </div>
</div>

<style>
  .context-panel {
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
  }

  .context-panel.open {
    max-height: 100%;
    flex: 1 1 auto;
    border-radius: 16px;
    border-color: rgba(255, 64, 129, 0.3);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 64, 129, 0.15);
  }

  .context-panel.disabled { opacity: 0.6; pointer-events: none; }
  .context-panel.disabled .panel-trigger { pointer-events: auto; }

  .panel-trigger {
    height: 48px; display: flex; align-items: center; padding: 0 16px; cursor: pointer; gap: 12px; user-select: none;
  }

  .trigger-icon {
    width: 20px; height: 20px; color: #FF4081; transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .context-panel.open .trigger-icon { transform: rotate(90deg); }

  .trigger-summary {
    display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 11px; color: var(--color-text-dim);
  }
  .summary-sep { opacity: 0.3; }

  .panel-content {
    display: flex; flex-direction: column; flex: 1; min-height: 0; opacity: 0; pointer-events: none;
    transition: opacity 0.3s ease; padding: 0 16px 16px 16px;
  }
  .context-panel.open .panel-content { opacity: 1; pointer-events: auto; transition: opacity 0.5s ease 0.1s; }

  .scroll-container { flex: 1; overflow-y: auto; scrollbar-width: none; }
  .scroll-container::-webkit-scrollbar { display: none; }

  .panel-section { padding: 6px 0; }

  .section-title {
    font-family: 'Space Grotesk', sans-serif; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px; color: #FF4081; margin-bottom: 12px;
  }

  .divider { height: 1px; width: 100%; background: rgba(255, 255, 255, 0.05); margin: 8px 0; }

  .sl-detail-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .sl-detail-label { font-size: 10px; font-weight: 500; color: var(--color-text-dim); min-width: 65px; }

  .sl-layer-list { display: flex; flex-direction: column; gap: 4px; }
  .sl-layer-item {
    border-radius: 8px; background: rgba(255, 255, 255, 0.02); border: 1px solid transparent;
    transition: all 0.2s; overflow: hidden;
  }
  .sl-layer-item:hover { background: rgba(255, 64, 129, 0.03); border-color: rgba(255, 64, 129, 0.1); }
  .sl-layer-item.collapsed { opacity: 0.5; }

  .sl-layer-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px; cursor: pointer; }

  .sl-eye-btn {
    display: flex; align-items: center; justify-content: center; width: 22px; height: 22px;
    background: transparent; color: #FF4081; cursor: pointer; border: none;
  }
  .sl-eye-btn svg { width: 14px; height: 14px; }
  .sl-eye-btn.hidden { color: var(--color-text-dim); opacity: 0.4; }

  .sl-color-swatch {
    width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer;
  }

  .sl-layer-name { font-size: 11px; font-weight: 500; color: var(--color-text-dim); flex: 1; }

  .sl-expand-indicator { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: var(--color-text-dim); }
  .sl-expand-indicator svg { width: 12px; height: 12px; transition: transform 0.3s; }
  .sl-expand-indicator.expanded svg { transform: rotate(90deg); }

  .sl-layer-details {
    padding: 8px 8px 8px 12px; display: flex; flex-direction: column; gap: 6px;
    border-top: 1px solid rgba(255, 64, 129, 0.06); background: rgba(0,0,0,0.2);
  }

  .sl-select {
    flex: 1; background: rgba(255, 64, 129, 0.06); border: 1px solid rgba(255, 64, 129, 0.15);
    border-radius: 4px; color: var(--color-text-dim); font-size: 10px; padding: 2px 4px; outline: none;
  }

  .sl-select:disabled { opacity: 0.5; cursor: not-allowed; }

  .sl-disabled { opacity: 0.4; pointer-events: none; filter: grayscale(1); }

  .type-grid { display: flex; flex-direction: column; gap: 4px; }
  .type-item {
    display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 6px;
    background: rgba(255, 255, 255, 0.03); cursor: pointer;
  }
  .type-item:hover { background: rgba(255, 64, 129, 0.1); }
  .type-item.disabled { opacity: 0.5; }
  .type-checkbox {
    width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex; align-items: center; justify-content: center; color: #FF4081;
  }
  .type-item:not(.disabled) .type-checkbox { background: rgba(255, 64, 129, 0.2); border-color: #FF4081; }
  .type-name { font-size: 10px; color: var(--color-text); }
</style>
