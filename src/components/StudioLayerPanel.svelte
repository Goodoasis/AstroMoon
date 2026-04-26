<script>
  import { studioState } from '@/stores/studioState.svelte.js';
  import { layerState } from '@/stores/layerState.svelte.js';
  import { STUDIO, LAYER_PALETTE } from '@/engine/config.js';
  import { tooltip } from '@/actions/tooltip.js';
  import { untrack } from 'svelte';

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

</script>

<aside id="studio-layer-panel">
  <!-- Header -->
  <header class="sl-header">
    <div class="sl-header-left">
      <svg class="sl-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <rect x="2" y="3" width="16" height="3" rx="1"/>
        <rect x="2" y="9" width="16" height="3" rx="1"/>
        <rect x="2" y="15" width="16" height="3" rx="1"/>
      </svg>
      <h3>Calques</h3>
    </div>
    <div class="sl-header-right">
      <span class="sl-hq-label" class:active={studioState.useShaderGlow}>HQ</span>
      <div class="sl-help-icon" title="La Haute Qualité (LOD maximum et Shader Glow) sera automatiquement forcée lors de l'exportation. Ces paramètres servent uniquement à fluidifier la prévisualisation.">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <label class="sl-mini-toggle">
        <input type="checkbox" bind:checked={studioState.useShaderGlow} onchange={() => layerState.layerTransformDirty = true} />
        <span class="sl-toggle-track"><span class="sl-toggle-thumb"></span></span>
      </label>
    </div>
  </header>

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
            <input
              type="range"
              class="sl-mini-slider"
              min="0" max="1" step="0.05"
              value={opacity}
              onclick={(e) => e.stopPropagation()}
              oninput={(e) => studioState.layerOpacity[layerName] = parseFloat(e.target.value)}
              style:--slider-color={getColorHex(colorIdx)}
            />

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
                <span class="sl-detail-label">Épaisseur</span>
                <input type="range" class="sl-detail-slider" min={STUDIO.layerFineMin} max={STUDIO.layerFineMax} step={STUDIO.layerFineStep} bind:value={studioState.layerFine[layerName]} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(colorIdx)} />
                <span class="sl-detail-val">{(studioState.layerFine[layerName] ?? 1.5).toFixed(1)}</span>
              </div>
              <!-- Glow -->
              <div class="sl-detail-row">
                <span class="sl-detail-label">Glow</span>
                <input type="range" class="sl-detail-slider" min={STUDIO.layerGlowMin} max={STUDIO.layerGlowMax} step={STUDIO.layerGlowStep} bind:value={studioState.layerGlow[layerName]} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(colorIdx)} />
                <span class="sl-detail-val">{(studioState.layerGlow[layerName] ?? 0.5).toFixed(1)}</span>
              </div>
              <!-- Blend mode -->
              <div class="sl-detail-row">
                <span class="sl-detail-label">Incrustation</span>
                <select class="sl-select" bind:value={studioState.layerBlendMode[layerName]}>
                  {#each STUDIO.blendModes as mode}
                    <option value={mode}>{STUDIO.blendModeLabels[mode]}</option>
                  {/each}
                </select>
              </div>
              <!-- Smooth -->
              <div class="sl-detail-row">
                <label class="sl-toggle-row">
                  <input type="checkbox" bind:checked={studioState.layerSmooth[layerName]} onchange={() => {
                    layerState.layerTransformDirty = true;
                  }} />
                  <span class="sl-toggle-track"><span class="sl-toggle-thumb"></span></span>
                </label>
                <span class="sl-detail-label">Adoucir</span>
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
          
          <input type="range" class="sl-mini-slider" min="0" max="1" step="0.05" value={studioState.gridOpacity} onclick={(e) => e.stopPropagation()} oninput={(e) => { studioState.gridOpacity = parseFloat(e.target.value); layerState.layerTransformDirty = true; }} style:--slider-color={getColorHex(studioState.gridColor)} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'grid'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'grid'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <span class="sl-detail-label">Épaisseur</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.gridThicknessMin} max={STUDIO.gridThicknessMax} step={STUDIO.gridThicknessStep} bind:value={studioState.gridThickness} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(studioState.gridColor)} />
              <span class="sl-detail-val">{studioState.gridThickness.toFixed(1)}</span>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Glow</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.layerGlowMin} max={STUDIO.layerGlowMax} step={STUDIO.layerGlowStep} bind:value={studioState.gridGlow} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(studioState.gridColor)} />
              <span class="sl-detail-val">{studioState.gridGlow.toFixed(1)}</span>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Incrustation</span>
              <select class="sl-select" bind:value={studioState.gridBlendMode} onchange={() => layerState.layerTransformDirty = true}>
                {#each STUDIO.blendModes as mode}
                  <option value={mode}>{STUDIO.blendModeLabels[mode]}</option>
                {/each}
              </select>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Intervalle</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.gridIntervalMin} max={STUDIO.gridIntervalMax} step={STUDIO.gridIntervalStep} bind:value={studioState.gridInterval} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(studioState.gridColor)} />
              <span class="sl-detail-val">{studioState.gridInterval}°</span>
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
          
          <input type="range" class="sl-mini-slider" min="0" max="1" step="0.05" value={studioState.terminatorOpacity} onclick={(e) => e.stopPropagation()} oninput={(e) => { studioState.terminatorOpacity = parseFloat(e.target.value); layerState.layerTransformDirty = true; }} style:--slider-color={getColorHex(studioState.terminatorColor)} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'terminator'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'terminator'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <span class="sl-detail-label">Épaisseur</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.terminatorThicknessMin} max={STUDIO.terminatorThicknessMax} step={STUDIO.terminatorThicknessStep} bind:value={studioState.terminatorThickness} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(studioState.terminatorColor)} />
              <span class="sl-detail-val">{studioState.terminatorThickness.toFixed(1)}</span>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Glow</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.layerGlowMin} max={STUDIO.layerGlowMax} step={STUDIO.layerGlowStep} bind:value={studioState.terminatorGlow} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(studioState.terminatorColor)} />
              <span class="sl-detail-val">{studioState.terminatorGlow.toFixed(1)}</span>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Incrustation</span>
              <select class="sl-select" bind:value={studioState.terminatorBlendMode} onchange={() => layerState.layerTransformDirty = true}>
                {#each STUDIO.blendModes as mode}
                  <option value={mode}>{STUDIO.blendModeLabels[mode]}</option>
                {/each}
              </select>
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
          
          <input type="range" class="sl-mini-slider" min={STUDIO.nightMaskOpacityMin} max={STUDIO.nightMaskOpacityMax} step={STUDIO.nightMaskOpacityStep} value={studioState.nightMaskOpacity} onclick={(e) => e.stopPropagation()} oninput={(e) => { studioState.nightMaskOpacity = parseFloat(e.target.value); layerState.layerTransformDirty = true; }} style:--slider-color={getColorHex(studioState.nightMaskColor)} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'nightMask'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'nightMask'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <span class="sl-detail-label">Incrustation</span>
              <select class="sl-select" bind:value={studioState.nightMaskBlendMode} onchange={() => layerState.layerTransformDirty = true}>
                {#each STUDIO.blendModes as mode}
                  <option value={mode}>{STUDIO.blendModeLabels[mode]}</option>
                {/each}
              </select>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Flou (Gradient)</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.nightMaskBlurMin} max={STUDIO.nightMaskBlurMax} step={STUDIO.nightMaskBlurStep} bind:value={studioState.nightMaskBlur} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(studioState.nightMaskColor)} />
              <span class="sl-detail-val">{studioState.nightMaskBlur}</span>
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
          
          <input type="range" class="sl-mini-slider" min={STUDIO.nightMaskOpacityMin} max={STUDIO.nightMaskOpacityMax} step={STUDIO.nightMaskOpacityStep} value={studioState.dayMaskOpacity} onclick={(e) => e.stopPropagation()} oninput={(e) => { studioState.dayMaskOpacity = parseFloat(e.target.value); layerState.layerTransformDirty = true; }} style:--slider-color={getColorHex(studioState.dayMaskColor)} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'dayMask'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'dayMask'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <span class="sl-detail-label">Incrustation</span>
              <select class="sl-select" bind:value={studioState.dayMaskBlendMode} onchange={() => layerState.layerTransformDirty = true}>
                {#each STUDIO.blendModes as mode}
                  <option value={mode}>{STUDIO.blendModeLabels[mode]}</option>
                {/each}
              </select>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Flou (Gradient)</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.nightMaskBlurMin} max={STUDIO.nightMaskBlurMax} step={STUDIO.nightMaskBlurStep} bind:value={studioState.dayMaskBlur} oninput={() => layerState.layerTransformDirty = true} style:--slider-color={getColorHex(studioState.dayMaskColor)} />
              <span class="sl-detail-val">{studioState.dayMaskBlur}</span>
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
          
          <input type="range" class="sl-mini-slider" min={STUDIO.limbGlowOpacityMin} max={STUDIO.limbGlowOpacityMax} step={STUDIO.limbGlowOpacityStep} value={studioState.limbGlowOpacity} onclick={(e) => e.stopPropagation()} oninput={(e) => { studioState.limbGlowOpacity = parseFloat(e.target.value); layerState.layerTransformDirty = true; layerState.dirtyEphemeris = true; }} style:--slider-color={getColorHex(studioState.limbGlowColor)} />
          
          <span class="sl-expand-indicator" class:expanded={expandedLayer === 'limbGlow'}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,4 10,8 6,12"/></svg>
          </span>
        </div>

        {#if expandedLayer === 'limbGlow'}
          <div class="sl-layer-details">
            <div class="sl-detail-row">
              <span class="sl-detail-label">Intensité</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.limbGlowThicknessMin} max={STUDIO.limbGlowThicknessMax} step={STUDIO.limbGlowThicknessStep} bind:value={studioState.limbGlowThickness} oninput={() => { layerState.layerTransformDirty = true; layerState.dirtyEphemeris = true; }} style:--slider-color={getColorHex(studioState.limbGlowColor)} />
              <span class="sl-detail-val">{studioState.limbGlowThickness.toFixed(1)}</span>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Étendue</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.limbGlowSpreadMin} max={STUDIO.limbGlowSpreadMax} step={STUDIO.limbGlowSpreadStep} bind:value={studioState.limbGlowSpread} oninput={() => { layerState.layerTransformDirty = true; layerState.dirtyEphemeris = true; }} style:--slider-color={getColorHex(studioState.limbGlowColor)} />
              <span class="sl-detail-val">{studioState.limbGlowSpread}</span>
            </div>
            <div class="sl-detail-row">
              <span class="sl-detail-label">Flou</span>
              <input type="range" class="sl-detail-slider" min={STUDIO.limbGlowBlurMin} max={STUDIO.limbGlowBlurMax} step={STUDIO.limbGlowBlurStep} bind:value={studioState.limbGlowBlur} oninput={() => { layerState.layerTransformDirty = true; layerState.dirtyEphemeris = true; }} style:--slider-color={getColorHex(studioState.limbGlowColor)} />
              <span class="sl-detail-val">{studioState.limbGlowBlur}</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </section>

</aside>

<style>
  #studio-layer-panel {
    position: fixed;
    top: 74px;
    left: 16px;
    width: 260px;
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    background: var(--color-surface);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid rgba(255, 64, 129, 0.2);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card), 0 0 20px rgba(255, 64, 129, 0.1), 0 0 6px rgba(255, 64, 129, 0.06);
    z-index: 90;
    padding: 14px;
    animation: slide-in-left 0.3s var(--transition-slow);
  }

  /* ── Header ── */
  .sl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 64, 129, 0.15);
  }

  .sl-header-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .sl-icon {
    width: 16px;
    height: 16px;
    color: #FF4081;
    filter: drop-shadow(0 0 4px rgba(255, 64, 129, 0.5));
  }

  .sl-header h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-text-dim);
    margin: 0;
  }

  .sl-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sl-hq-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--color-text-dim);
    opacity: 0.6;
    letter-spacing: 0.5px;
  }

  .sl-hq-label.active {
    color: #FF4081;
    opacity: 1;
    text-shadow: 0 0 8px rgba(255, 64, 129, 0.4);
  }

  .sl-mini-toggle {
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .sl-mini-toggle input {
    display: none;
  }

  /* ── Sections ── */
  .sl-section {
    margin-bottom: 8px;
  }

  .sl-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .sl-help-icon {
    color: rgba(255, 255, 255, 0.4);
    cursor: help;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }
  
  .sl-help-icon:hover {
    color: rgba(255, 64, 129, 0.9);
  }
  
  .sl-help-icon svg {
    width: 12px;
    height: 12px;
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

  /* Mini opacity slider */
  .sl-mini-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 60px;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    flex-shrink: 0;
  }

  .sl-mini-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--slider-color, #FF4081);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 4px var(--slider-color, rgba(255, 64, 129, 0.4));
    transition: box-shadow 0.2s;
  }

  .sl-mini-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 8px var(--slider-color, rgba(255, 64, 129, 0.7));
  }

  .sl-mini-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--slider-color, #FF4081);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
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

  .sl-detail-slider {
    flex: 1;
    min-width: 0;
    -webkit-appearance: none;
    appearance: none;
    height: 3px;
    background: rgba(255, 64, 129, 0.12);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .sl-detail-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--slider-color, #FF4081);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 4px rgba(255, 64, 129, 0.4);
  }

  .sl-detail-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--slider-color, #FF4081);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
  }

  .sl-detail-val {
    font-family: var(--font-mono);
    font-size: 10px;
    color: #FF4081;
    min-width: 24px;
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Select dropdown ── */
  .sl-select {
    flex: 1;
    background: rgba(255, 64, 129, 0.06);
    border: 1px solid rgba(255, 64, 129, 0.15);
    border-radius: var(--radius-sm);
    color: var(--color-text-dim);
    font-family: var(--font-main);
    font-size: 10px;
    padding: 3px 6px;
    outline: none;
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }

  .sl-select:hover, .sl-select:focus {
    border-color: rgba(255, 64, 129, 0.4);
  }

  .sl-select option {
    background: #0A0B10;
    color: var(--color-text);
  }

  /* ── Toggle ── */
  .sl-toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin-bottom: 6px;
  }

  .sl-toggle-row input[type="checkbox"] {
    display: none;
  }

  .sl-toggle-track {
    position: relative;
    width: 28px;
    height: 14px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    transition: all 0.3s;
    flex-shrink: 0;
  }

  .sl-toggle-thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-text-dim);
    transition: all 0.3s;
  }

  .sl-toggle-row input:checked + .sl-toggle-track,
  .sl-mini-toggle input:checked + .sl-toggle-track {
    background: rgba(255, 64, 129, 0.2);
    border-color: rgba(255, 64, 129, 0.4);
  }

  .sl-toggle-row input:checked + .sl-toggle-track .sl-toggle-thumb,
  .sl-mini-toggle input:checked + .sl-toggle-track .sl-toggle-thumb {
    transform: translateX(14px);
    background: #FF4081;
    box-shadow: 0 0 6px rgba(255, 64, 129, 0.5);
  }



</style>
