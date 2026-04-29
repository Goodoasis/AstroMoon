<script>
  import { studioState } from '@/stores/studioState.svelte.js';
  import { layerState } from '@/stores/layerState.svelte.js';
  import { uiState } from '@/stores/uiState.svelte.js';
  import { STUDIO, LAYER_PALETTE } from '@/engine/config.js';
  import { tooltip } from '@/actions/tooltip.js';
  import { untrack } from 'svelte';
  import RangeSlider from './RangeSlider.svelte';
  import NeonToggle from './NeonToggle.svelte';
  import NeonSelect from './NeonSelect.svelte';

  const blendOptions = STUDIO.blendModes.map(m => ({ value: m, label: STUDIO.blendModeLabels[m] }));

  let isDropdownActive = $state(false);

  // Human-readable layer names derived from filenames
  const LAYER_LABELS = {
    'marias.geojson': 'Mers',
    'basin ring_500_15.geojson': 'Bassins',
    'crest_of_buried_crater_500_15.geojson': 'Cratères Enfouis',
    'crest_of_crater_rim_500_15.geojson': 'Cratères',
  };

  function getLayerLabel(filename) {
    return LAYER_LABELS[filename] || filename.replace('.geojson', '').replace(/_/g, ' ');
  }

  // Get loaded layers from layerState
  let layers = $derived(layerState.loadedLayerNames || []);

  // Init layer maps when layers arrive
  $effect(() => {
    if (layers.length > 0) {
      untrack(() => studioState.initLayers(layers));
    }
  });

  // Track layer settings to trigger redraw
  $effect(() => {
    const _c = JSON.stringify(studioState.layerColor);
    const _v = JSON.stringify(studioState.layerVisibility);
    const _o = JSON.stringify(studioState.layerOpacity);
    const _f = JSON.stringify(studioState.layerFine);
    const _b = JSON.stringify(studioState.layerBlendMode);
    const _g = JSON.stringify(studioState.layerGlow);
    const _s = JSON.stringify(studioState.layerSmooth);
    
    console.log('Studio Layer Effect triggered. layerSmooth:', _s);

    const _gv = studioState.gridVisible;
    const _gi = studioState.gridInterval;
    const _gt = studioState.gridThickness;
    const _gc = studioState.gridColor;
    const _go = studioState.gridOpacity;
    const _gb = studioState.gridBlendMode;
    const _gg = studioState.gridGlow;
    
    const _tv = studioState.terminatorVisible;
    const _tt = studioState.terminatorThickness;
    const _tc = studioState.terminatorColor;
    const _to = studioState.terminatorOpacity;
    const _tb = studioState.terminatorBlendMode;
    const _tg = studioState.terminatorGlow;

    const _nv = studioState.nightMaskVisible;
    const _nc = studioState.nightMaskColor;
    const _no = studioState.nightMaskOpacity;
    const _nb = studioState.nightMaskBlendMode;
    const _nbl = studioState.nightMaskBlur;

    const _dv = studioState.dayMaskVisible;
    const _dc = studioState.dayMaskColor;
    const _do = studioState.dayMaskOpacity;
    const _db = studioState.dayMaskBlendMode;
    const _dbl = studioState.dayMaskBlur;

    const _lg = studioState.limbGlow;
    const _lgc = studioState.limbGlowColor;
    const _lgo = studioState.limbGlowOpacity;
    const _lgt = studioState.limbGlowThickness;
    const _lgs = studioState.limbGlowSpread;
    const _lgb = studioState.limbGlowBlur;

    untrack(() => {
      layerState.layerTransformDirty = true;
      layerState.dirtyGrid = true;
      layerState.dirtyEphemeris = true;
    });
  });

  // Expanded layer details
  let expandedLayer = $state(null);

  function toggleExpand(name) {
    expandedLayer = expandedLayer === name ? null : name;
  }

  function toggleLayerVisibility(name) {
    studioState.layerVisibility[name] = !studioState.layerVisibility[name];
  }

  function cycleLayerColor(name) {
    const current = studioState.layerColor[name] || 0;
    studioState.layerColor[name] = (current + 1) % LAYER_PALETTE.length;
  }

    function getColorHex(paletteIndex) {
      const color = LAYER_PALETTE[paletteIndex % LAYER_PALETTE.length];
      return '#' + color.stroke.toString(16).padStart(6, '0');
    }

    let isOpen = $state(true);

    function toggleOpen() {
      isOpen = !isOpen;
    }
  </script>

<div class="context-panel" class:open={isOpen} class:select-open={isDropdownActive}>
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
      <span class="summary-item">Calques</span>
    </div>
    <div style="margin-left: auto; display: flex;">
      <NeonToggle 
        label="HQ"
        variant="detail"
        bind:checked={studioState.useShaderGlow} 
        onchange={() => layerState.layerTransformDirty = true} 
      />
    </div>
  </div>

  <!-- Content -->
  <div class="panel-content">
    <div class="scroll-container">
      
  <!-- GeoJSON Layers -->
  <section class="sl-section">
    <h4 class="sl-section-title">Couches</h4>
    <div class="sl-layer-list">
      {#each layers as layerName, i (layerName)}
        {@const isVisible = studioState.layerVisibility[layerName] ?? true}
        {@const colorIdx = studioState.layerColor[layerName] ?? i}
        {@const opacity = studioState.layerOpacity[layerName] ?? 1.0}
        {@const isExpanded = expandedLayer === layerName}

        <div class="sl-layer-item" class:collapsed={!isVisible}>
          <!-- Main row -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="sl-layer-row" onclick={() => toggleExpand(layerName)}>
            <!-- Eye toggle -->
            <button class="sl-eye-btn" class:hidden={!isVisible} onclick={(e) => { e.stopPropagation(); toggleLayerVisibility(layerName); }} title={isVisible ? 'Masquer' : 'Afficher'}>
              {#if isVisible}
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/>
                  <circle cx="10" cy="10" r="3"/>
                </svg>
              {:else}
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/>
                  <line x1="3" y1="3" x2="17" y2="17"/>
                </svg>
              {/if}
            </button>

            <!-- Color swatch -->
            <button
              class="sl-color-swatch"
              style:background={getColorHex(colorIdx)}
              style:box-shadow="0 0 6px {getColorHex(colorIdx)}44"
              onclick={(e) => { e.stopPropagation(); cycleLayerColor(layerName); }}
              title="Changer la couleur"
            ></button>

            <!-- Layer name -->
            <span class="sl-layer-name" class:dimmed={!isVisible} title={getLayerLabel(layerName)}>
              {getLayerLabel(layerName)}
            </span>

            <!-- Mini opacity slider -->
            <RangeSlider variant="mini" min={0} max={1} step={0.05} value={opacity} color={getColorHex(colorIdx)} stopPropagation={true} oninput={(v) => studioState.layerOpacity[layerName] = v} />

            <!-- Expand chevron -->
            <span class="sl-expand-indicator" class:expanded={isExpanded}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="6,4 10,8 6,12"/>
              </svg>
            </span>
          </div>

          <!-- Expanded details -->
          {#if isExpanded}
            <div class="sl-layer-details">
              <!-- Épaisseur -->
              <div class="sl-detail-row">
                <RangeSlider variant="detail" label="Épaisseur" min={STUDIO.layerFineMin} max={STUDIO.layerFineMax} step={STUDIO.layerFineStep} bind:value={studioState.layerFine[layerName]} initialValue={1.5} color={getColorHex(colorIdx)} fixed={1} oninput={() => layerState.layerTransformDirty = true} />
              </div>
              <!-- Glow -->
              <div class="sl-detail-row">
                <RangeSlider variant="detail" label="Glow" min={STUDIO.layerGlowMin} max={STUDIO.layerGlowMax} step={STUDIO.layerGlowStep} bind:value={studioState.layerGlow[layerName]} initialValue={0} color={getColorHex(colorIdx)} fixed={1} oninput={() => layerState.layerTransformDirty = true} />
              </div>
              <div class="sl-detail-row">
                <RangeSlider variant="detail" label="Flou" min={STUDIO.layerBlurMin} max={STUDIO.layerBlurMax} step={STUDIO.layerBlurStep} bind:value={studioState.layerBlur[layerName]} initialValue={STUDIO.layerBlurDefault} color={getColorHex(colorIdx)} fixed={0} oninput={() => layerState.layerTransformDirty = true} />
              </div>
              <!-- Blend mode -->
              <div class="sl-detail-row">
                <span class="sl-detail-label">Incrustation</span>
                  <NeonSelect 
                    options={blendOptions} 
                    bind:value={studioState.layerBlendMode[layerName]} 
                    color={getColorHex(colorIdx)}
                    ontoggle={(v) => isDropdownActive = v}
                  />
              </div>
              <!-- Smooth -->
              <div class="sl-detail-row">
                <NeonToggle 
                  variant="mini"
                  label="Adoucir" 
                  labelLeft={true}
                  color={getColorHex(colorIdx)} 
                  bind:checked={studioState.layerSmooth[layerName]} 
                  onchange={() => layerState.layerTransformDirty = true} 
                />
              </div>
            </div>
          {/if}
        </div>
      {/each}

      <!-- Grid (same section) -->
      <div class="sl-layer-item" class:collapsed={!studioState.gridVisible}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sl-layer-row" onclick={() => toggleExpand('grid')}>
          <button class="sl-eye-btn" class:hidden={!studioState.gridVisible} onclick={(e) => { e.stopPropagation(); studioState.gridVisible = !studioState.gridVisible; }} title={studioState.gridVisible ? 'Masquer' : 'Afficher'}>
            {#if studioState.gridVisible}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/>
                <circle cx="10" cy="10" r="3"/>
              </svg>
            {:else}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/>
                <line x1="3" y1="3" x2="17" y2="17"/>
              </svg>
            {/if}
          </button>
          
          <button class="sl-color-swatch" style:background={getColorHex(studioState.gridColor)} style:box-shadow="0 0 6px {getColorHex(studioState.gridColor)}44" onclick={(e) => { e.stopPropagation(); studioState.gridColor = (studioState.gridColor + 1) % LAYER_PALETTE.length; }} title="Changer la couleur"></button>
          
          <span class="sl-layer-name" class:dimmed={!studioState.gridVisible} title="Grille Sélénographique">Grille Sélénographique</span>
          
          <RangeSlider variant="mini" min={0} max={1} step={0.05} value={studioState.gridOpacity} color={getColorHex(studioState.gridColor)} stopPropagation={true} oninput={(v) => { studioState.gridOpacity = v; layerState.layerTransformDirty = true; }} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'grid'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'grid'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Épaisseur" min={STUDIO.gridThicknessMin} max={STUDIO.gridThicknessMax} step={STUDIO.gridThicknessStep} bind:value={studioState.gridThickness} initialValue={1.5} color={getColorHex(studioState.gridColor)} fixed={1} oninput={() => layerState.layerTransformDirty = true} />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Glow" min={STUDIO.layerGlowMin} max={STUDIO.layerGlowMax} step={STUDIO.layerGlowStep} bind:value={studioState.gridGlow} initialValue={0} color={getColorHex(studioState.gridColor)} fixed={1} oninput={() => layerState.layerTransformDirty = true} />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Flou" min={STUDIO.layerBlurMin} max={STUDIO.layerBlurMax} step={STUDIO.layerBlurStep} bind:value={studioState.gridBlur} initialValue={0} color={getColorHex(studioState.gridColor)} fixed={0} oninput={() => layerState.layerTransformDirty = true} />
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Incrustation</span>
              <NeonSelect 
                options={blendOptions} 
                bind:value={studioState.gridBlendMode} 
                color={getColorHex(studioState.gridColor)}
                ontoggle={(v) => isDropdownActive = v}
                onchange={() => layerState.layerTransformDirty = true}
              />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Intervalle" min={STUDIO.gridIntervalMin} max={STUDIO.gridIntervalMax} step={STUDIO.gridIntervalStep} bind:value={studioState.gridInterval} initialValue={10} color={getColorHex(studioState.gridColor)} fixed={0} suffix="°" oninput={() => layerState.layerTransformDirty = true} />
            </div>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <div class="sl-divider"></div>

  <!-- Éphémérides Section (Terminator + Masks) -->
  <section class="sl-section">
    <h4 class="sl-section-title">Éphémérides</h4>
    <div class="sl-layer-list">
      <div class="sl-layer-item" class:collapsed={!studioState.terminatorVisible}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sl-layer-row" onclick={() => toggleExpand('terminator')}>
          <button class="sl-eye-btn" class:hidden={!studioState.terminatorVisible} onclick={(e) => { e.stopPropagation(); studioState.terminatorVisible = !studioState.terminatorVisible; }} title={studioState.terminatorVisible ? 'Masquer' : 'Afficher'}>
            {#if studioState.terminatorVisible}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/>
                <circle cx="10" cy="10" r="3"/>
              </svg>
            {:else}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/>
                <line x1="3" y1="3" x2="17" y2="17"/>
              </svg>
            {/if}
          </button>
          
          <button class="sl-color-swatch" style:background={getColorHex(studioState.terminatorColor)} style:box-shadow="0 0 6px {getColorHex(studioState.terminatorColor)}44" onclick={(e) => { e.stopPropagation(); studioState.terminatorColor = (studioState.terminatorColor + 1) % LAYER_PALETTE.length; }} title="Changer la couleur"></button>
          
          <span class="sl-layer-name" class:dimmed={!studioState.terminatorVisible} title="Terminateur">Terminateur</span>
          
          <RangeSlider variant="mini" min={0} max={1} step={0.05} value={studioState.terminatorOpacity} color={getColorHex(studioState.terminatorColor)} stopPropagation={true} oninput={(v) => { studioState.terminatorOpacity = v; layerState.layerTransformDirty = true; }} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'terminator'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'terminator'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Épaisseur" min={STUDIO.terminatorThicknessMin} max={STUDIO.terminatorThicknessMax} step={STUDIO.terminatorThicknessStep} bind:value={studioState.terminatorThickness} initialValue={2.0} color={getColorHex(studioState.terminatorColor)} fixed={1} oninput={() => layerState.layerTransformDirty = true} />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Glow" min={STUDIO.layerGlowMin} max={STUDIO.layerGlowMax} step={STUDIO.layerGlowStep} bind:value={studioState.terminatorGlow} initialValue={0} color={getColorHex(studioState.terminatorColor)} fixed={1} oninput={() => layerState.layerTransformDirty = true} />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Flou" min={STUDIO.layerBlurMin} max={STUDIO.layerBlurMax} step={STUDIO.layerBlurStep} bind:value={studioState.terminatorBlur} initialValue={0} color={getColorHex(studioState.terminatorColor)} fixed={0} oninput={() => layerState.layerTransformDirty = true} />
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Incrustation</span>
              <NeonSelect 
                options={blendOptions} 
                bind:value={studioState.terminatorBlendMode} 
                color={getColorHex(studioState.terminatorColor)}
                ontoggle={(v) => isDropdownActive = v}
                onchange={() => layerState.layerTransformDirty = true}
              />
            </div>
          </div>
        {/if}
      </div>

      <!-- Night Mask -->
      <div class="sl-layer-item" class:collapsed={!studioState.nightMaskVisible}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sl-layer-row" onclick={() => toggleExpand('nightMask')}>
          <button class="sl-eye-btn" class:hidden={!studioState.nightMaskVisible} onclick={(e) => { e.stopPropagation(); studioState.nightMaskVisible = !studioState.nightMaskVisible; }} title={studioState.nightMaskVisible ? 'Masquer' : 'Afficher'}>
            {#if studioState.nightMaskVisible}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/>
                <circle cx="10" cy="10" r="3"/>
              </svg>
            {:else}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/>
                <line x1="3" y1="3" x2="17" y2="17"/>
              </svg>
            {/if}
          </button>
          
          <button class="sl-color-swatch" style:background={getColorHex(studioState.nightMaskColor)} style:box-shadow="0 0 6px {getColorHex(studioState.nightMaskColor)}44" onclick={(e) => { e.stopPropagation(); studioState.nightMaskColor = (studioState.nightMaskColor + 1) % LAYER_PALETTE.length; }} title="Changer la couleur"></button>
          
          <span class="sl-layer-name" class:dimmed={!studioState.nightMaskVisible} title="Ombre (Nuit)">Ombre (Nuit)</span>
          
          <RangeSlider variant="mini" min={STUDIO.nightMaskOpacityMin} max={STUDIO.nightMaskOpacityMax} step={STUDIO.nightMaskOpacityStep} value={studioState.nightMaskOpacity} color={getColorHex(studioState.nightMaskColor)} stopPropagation={true} oninput={(v) => { studioState.nightMaskOpacity = v; layerState.layerTransformDirty = true; }} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'nightMask'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'nightMask'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <span class="sl-detail-label">Incrustation</span>
              <NeonSelect 
                options={blendOptions} 
                bind:value={studioState.nightMaskBlendMode} 
                color={getColorHex(studioState.nightMaskColor)}
                ontoggle={(v) => isDropdownActive = v}
                onchange={() => layerState.layerTransformDirty = true}
              />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Flou" min={STUDIO.nightMaskBlurMin} max={STUDIO.nightMaskBlurMax} step={STUDIO.nightMaskBlurStep} bind:value={studioState.nightMaskBlur} initialValue={STUDIO.nightMaskBlurMin} color={getColorHex(studioState.nightMaskColor)} fixed={0} oninput={() => layerState.layerTransformDirty = true} />
            </div>
          </div>
        {/if}
      </div>

      <!-- Day Mask -->
      <div class="sl-layer-item" class:collapsed={!studioState.dayMaskVisible}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sl-layer-row" onclick={() => toggleExpand('dayMask')}>
          <button class="sl-eye-btn" class:hidden={!studioState.dayMaskVisible} onclick={(e) => { e.stopPropagation(); studioState.dayMaskVisible = !studioState.dayMaskVisible; }} title={studioState.dayMaskVisible ? 'Masquer' : 'Afficher'}>
            {#if studioState.dayMaskVisible}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/>
                <circle cx="10" cy="10" r="3"/>
              </svg>
            {:else}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/>
                <line x1="3" y1="3" x2="17" y2="17"/>
              </svg>
            {/if}
          </button>
          
          <button class="sl-color-swatch" style:background={getColorHex(studioState.dayMaskColor)} style:box-shadow="0 0 6px {getColorHex(studioState.dayMaskColor)}44" onclick={(e) => { e.stopPropagation(); studioState.dayMaskColor = (studioState.dayMaskColor + 1) % LAYER_PALETTE.length; }} title="Changer la couleur"></button>
          
          <span class="sl-layer-name" class:dimmed={!studioState.dayMaskVisible} title="Lumière (Jour)">Lumière (Jour)</span>
          
          <RangeSlider variant="mini" min={STUDIO.dayMaskOpacityMin} max={STUDIO.dayMaskOpacityMax} step={STUDIO.dayMaskOpacityStep} value={studioState.dayMaskOpacity} color={getColorHex(studioState.dayMaskColor)} stopPropagation={true} oninput={(v) => { studioState.dayMaskOpacity = v; layerState.layerTransformDirty = true; }} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'dayMask'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'dayMask'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <span class="sl-detail-label">Incrustation</span>
              <NeonSelect 
                options={blendOptions} 
                bind:value={studioState.dayMaskBlendMode} 
                color={getColorHex(studioState.dayMaskColor)}
                ontoggle={(v) => isDropdownActive = v}
                onchange={() => layerState.layerTransformDirty = true}
              />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Flou" min={STUDIO.dayMaskBlurMin} max={STUDIO.dayMaskBlurMax} step={STUDIO.dayMaskBlurStep} bind:value={studioState.dayMaskBlur} initialValue={STUDIO.dayMaskBlurMin} color={getColorHex(studioState.dayMaskColor)} fixed={0} oninput={() => layerState.layerTransformDirty = true} />
            </div>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <div class="sl-divider"></div>

  <!-- Limb Glow Section -->
  <section class="sl-section">
    <div class="sl-layer-list">
      <div class="sl-layer-item" class:collapsed={!studioState.limbGlow}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="sl-layer-row" onclick={() => toggleExpand('limbGlow')}>
          <button class="sl-eye-btn" class:hidden={!studioState.limbGlow} onclick={(e) => { e.stopPropagation(); studioState.limbGlow = !studioState.limbGlow; }} title={studioState.limbGlow ? 'Masquer' : 'Afficher'}>
            {#if studioState.limbGlow}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/>
                <circle cx="10" cy="10" r="3"/>
              </svg>
            {:else}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" opacity="0.3"/>
                <line x1="3" y1="3" x2="17" y2="17"/>
              </svg>
            {/if}
          </button>
          
          <button class="sl-color-swatch" style:background={getColorHex(studioState.limbGlowColor)} style:box-shadow="0 0 6px {getColorHex(studioState.limbGlowColor)}44" onclick={(e) => { e.stopPropagation(); studioState.limbGlowColor = (studioState.limbGlowColor + 1) % LAYER_PALETTE.length; }} title="Changer la couleur"></button>
          
          <span class="sl-layer-name" class:dimmed={!studioState.limbGlow} title="Lueur de limbe">Lueur de limbe</span>
          
          <RangeSlider variant="mini" min={STUDIO.limbGlowOpacityMin} max={STUDIO.limbGlowOpacityMax} step={STUDIO.limbGlowOpacityStep} value={studioState.limbGlowOpacity} color={getColorHex(studioState.limbGlowColor)} stopPropagation={true} oninput={(v) => { studioState.limbGlowOpacity = v; layerState.layerTransformDirty = true; layerState.dirtyEphemeris = true; }} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'limbGlow'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'limbGlow'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Intensité" min={STUDIO.limbGlowThicknessMin} max={STUDIO.limbGlowThicknessMax} step={STUDIO.limbGlowThicknessStep} bind:value={studioState.limbGlowThickness} initialValue={STUDIO.limbGlowThicknessDefault} color={getColorHex(studioState.limbGlowColor)} fixed={1} oninput={() => { layerState.layerTransformDirty = true; layerState.dirtyEphemeris = true; }} />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Étendue" min={STUDIO.limbGlowSpreadMin} max={STUDIO.limbGlowSpreadMax} step={STUDIO.limbGlowSpreadStep} bind:value={studioState.limbGlowSpread} initialValue={STUDIO.limbGlowSpreadDefault} color={getColorHex(studioState.limbGlowColor)} fixed={0} oninput={() => { layerState.layerTransformDirty = true; layerState.dirtyEphemeris = true; }} />
            </div>
            <div class="sl-detail-row">
              <RangeSlider variant="detail" label="Flou" min={STUDIO.limbGlowBlurMin} max={STUDIO.limbGlowBlurMax} step={STUDIO.limbGlowBlurStep} bind:value={studioState.limbGlowBlur} initialValue={STUDIO.limbGlowBlurDefault} color={getColorHex(studioState.limbGlowColor)} fixed={0} oninput={() => { layerState.layerTransformDirty = true; layerState.dirtyEphemeris = true; }} />
            </div>
          </div>
        {/if}
      </div>
    </div>
  </section>

    </div>
  </div>
</div>


<style>
  /* ── Context Panel Base ── */
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
    --nt-panel-color: #FF4081;
  }

  .context-panel.open {
    flex: 1;
    min-height: 0;
    max-height: none;
    border-radius: 16px;
    border-color: rgba(255, 64, 129, 0.3);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 64, 129, 0.15);
    transition: flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .context-panel.open:hover,
  .context-panel.select-open {
    flex: 3;
  }

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

  .summary-item { white-space: nowrap; }

  .panel-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    padding: 0 16px 20px 16px;
  }

  .context-panel.open .panel-content {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 0.5s ease 0.1s;
  }

  .scroll-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    scrollbar-width: none;
  }
  .scroll-container::-webkit-scrollbar { display: none; }

  /* ── Header overrides ── */


  /* ── Sections ── */
  .sl-section {
    margin-bottom: 8px;
  }

  .sl-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 64, 129, 0.7);
    margin-bottom: 0;
  }

  .sl-divider {
    height: 1px;
    background: rgba(255, 64, 129, 0.08);
    margin: 8px 0;
  }

  /* ── Layer List ── */
  .sl-layer-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sl-layer-item {
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    transition: all var(--transition-fast);
    overflow: hidden;
  }

  .sl-layer-item:hover {
    background: rgba(255, 64, 129, 0.03);
    border-color: rgba(255, 64, 129, 0.1);
  }

  .sl-layer-item.collapsed {
    opacity: 0.5;
  }

  .sl-layer-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    cursor: pointer;
  }

  /* Eye button */
  .sl-eye-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #FF4081;
    cursor: pointer;
    flex-shrink: 0;
    transition: all var(--transition-fast);
    padding: 0;
  }

  .sl-eye-btn svg {
    width: 14px;
    height: 14px;
  }

  .sl-eye-btn.hidden {
    color: var(--color-text-dim);
    opacity: 0.4;
  }

  .sl-eye-btn:hover {
    background: rgba(255, 64, 129, 0.1);
    transform: scale(1.1);
  }

  /* Color swatch */
  .sl-color-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    flex-shrink: 0;
    transition: all var(--transition-fast);
  }

  .sl-color-swatch:hover {
    transform: scale(1.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  /* Layer name */
  .sl-layer-name {
    font-family: var(--font-main);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-dim);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color var(--transition-fast);
  }

  .sl-layer-item:hover .sl-layer-name {
    color: var(--color-text-bright);
  }

  .sl-layer-name.dimmed {
    opacity: 0.4;
  }

  /* Expand indicator */
  .sl-expand-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: var(--color-text-dim);
    flex-shrink: 0;
  }

  .sl-expand-indicator svg {
    width: 12px;
    height: 12px;
    transition: transform var(--transition-med);
  }

  .sl-expand-indicator.expanded svg {
    transform: rotate(90deg);
  }

  .sl-layer-row:hover .sl-expand-indicator {
    color: #FF4081;
  }

  /* ── Layer Details (expanded) ── */
  .sl-layer-details {
    padding: 4px 8px 8px 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: detail-expand 0.2s ease-out;
    border-top: 1px solid rgba(255, 64, 129, 0.06);
  }

  @keyframes detail-expand {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Slider styles are now handled by RangeSlider component */

  .sl-detail-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sl-detail-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-dim);
    min-width: 72px;
  }

  /* ── Select dropdown ── */





</style>
