<script>
  import { createEventDispatcher } from 'svelte';
  import { uiState } from '@/stores/uiState.svelte.js';
  import { viewportState } from '@/stores/viewportState.svelte.js';
  import { layerState } from '@/stores/layerState.svelte.js';
  import { PixiRenderer } from '@/engine/pixi_renderer.js';
  import { updateCursor } from '@/engine/inputHandler.js';
  import { Transform } from '@/engine/transform.js';
  import { Anchors } from '@/engine/anchors.js';

  import { studioState } from '@/stores/studioState.svelte.js';
  import NeonButton from './NeonButton.svelte';

  const dispatch = createEventDispatcher();

  function toggleAnchorMode() {
    viewportState.mode = viewportState.mode === 'anchor' ? 'navigate' : 'anchor';
    updateCursor();
    dispatch('toast', viewportState.mode === 'anchor' ? '📌 Mode Ancrage' : '🧭 Mode Navigation');
  }

  function toggleGrid() {
    const isVisible = PixiRenderer.toggleGrid();
    if (isVisible) {
      layerState.dirtyGrid = true;
      layerState.layerTransformDirty = true;
    }
  }

  function toggleLabels() {
    uiState.showLabels = !uiState.showLabels;
    PixiRenderer.setLabelsEnabled(uiState.showLabels);
    if (uiState.showLabels) {
      layerState.layerTransformDirty = true;
    }
  }

  function handleReset() {
    Transform.reset(viewportState.canvasW, viewportState.canvasH);
    viewportState.tx = 0;
    viewportState.ty = 0;
    viewportState.scale = 1;
    Anchors.clear();
    layerState.layerTransformDirty = true;
    layerState.anchorRevision++;
    dispatch('toast', 'Calque réinitialisé');
  }

  // Phase colored glow for the dock border
  let dockGlow = $derived(
    uiState.currentPhase === 'ALIGN' && viewportState.mode === 'anchor' ? '#00FF88' :
    uiState.currentPhase === 'ALIGN' ? '#00E5FF' :
    uiState.currentPhase === 'STUDIO' ? '#FF4081' :
    uiState.currentPhase === 'EXPORT' ? '#FFD700' : 
    'rgba(255, 255, 255, 0.1)'
  );
</script>

<div id="bottom-dock" class="visible" style="--dock-glow: {dockGlow}">

  <!-- GAUCHE : Boutons d'Action Rapide (Uniquement en phase ALIGN) -->
  {#if uiState.currentPhase === 'ALIGN'}
    <div class="dock-section dock-actions">
      <NeonButton
        variant="icon"
        color={dockGlow}
        active={viewportState.mode === 'anchor'}
        onclick={toggleAnchorMode}
        title="Mode Ancrage (A)"
      >
        {#snippet icon()}
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        {/snippet}
      </NeonButton>

      <NeonButton
        variant="icon"
        color={dockGlow}
        active={studioState.gridVisible}
        onclick={toggleGrid}
        title="Grille Debug (G)"
      >
        {#snippet icon()}
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
        {/snippet}
      </NeonButton>

      <NeonButton
        variant="icon"
        color={dockGlow}
        onclick={handleReset}
        title="Reset Position"
      >
        {#snippet icon()}
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
        {/snippet}
      </NeonButton>

      <NeonButton
        variant="icon"
        color={dockGlow}
        active={uiState.showLabels}
        onclick={toggleLabels}
        title="Noms des cratères (L)"
      >
        {#snippet icon()}
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
        {/snippet}
      </NeonButton>
    </div>
    <div class="dock-sep"></div>
  {/if}

  <!-- CENTRE : Raccourcis Clavier Contextuels -->
  <div class="dock-section dock-shortcuts">
    {#if uiState.currentPhase === 'ALIGN'}
      <!-- VUE -->
      <div class="info-hint" title="Naviguer dans la vue sans déplacer le calque"><kbd>Ctrl</kbd> Caméra</div>
      <div class="info-hint"><kbd>Scroll</kbd> Zoom</div>
      <div class="info-hint" title="Recentrer la vue"><kbd>F</kbd> Centrer</div>

      <div class="info-divider"></div>

      <!-- CALQUE -->
      <div class="info-hint" title="Cliquer glisser sur un cratère"><kbd>Drag</kbd> Calque</div>
      <div class="info-hint" title="Maintenir R et bouger la souris"><kbd>R</kbd> Rotation</div>

      <div class="info-divider"></div>

      <!-- UNIVERSEL -->
      <div class="info-hint" title="Maintenir pour affiner au millimètre (Drag, Zoom & Rotation)"><kbd>Shift</kbd> Précision</div>
    {:else if uiState.currentPhase === 'STUDIO'}
      <div class="info-hint" title="Naviguer sur la photo"><kbd>Drag</kbd> Naviguer Photo</div>
      <div class="info-hint" title="Zoomer pour apprécier les détails"><kbd>Scroll</kbd> Zoom Image</div>
      <div class="info-hint" title="Masquer l'interface pour le rendu final"><kbd>H</kbd> Cacher l'UI</div>
      <div class="info-hint" title="Afficher la grille sélénographique"><kbd>G</kbd> Grille</div>
    {:else if uiState.currentPhase === 'EXPORT'}
      <div class="info-hint">Ajustez le ratio et les options avant de sauvegarder.</div>
    {/if}
  </div>

  <div class="dock-sep"></div>

  <!-- DROITE : Télémétrie -->
  <div class="dock-section dock-telemetry">
    <span class="fps-display">{viewportState.fps || '--'} FPS</span>
    <div class="coords-display" id="coords-display">
      {#if uiState.currentPhase === 'ALIGN' || uiState.currentPhase === 'STUDIO'}
Lat: --------°
Lon: --------°
      {:else}
En attente
      {/if}
    </div>
  </div>

</div>

<style>
  #bottom-dock {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 8px;
    background: rgba(10, 11, 16, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--dock-glow, var(--color-border));
    border-radius: var(--radius-pill);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(0, 0, 0, 0.1);
    opacity: 0;
    z-index: 100;
    transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, opacity 0.6s ease-out 0.1s, border-color 0.4s ease, box-shadow 0.4s ease;
  }

  #bottom-dock.visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }

  /* Glow effect adapting to phase color */
  #bottom-dock:hover {
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.6), inset 0 0 16px rgba(255, 255, 255, 0.05), 0 0 12px var(--dock-glow, transparent);
  }

  .dock-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
  }
  
  .dock-shortcuts {
    gap: 10px;
  }

  .info-divider {
    width: 1px;
    height: 12px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 2px;
    border-radius: 1px;
  }

  .dock-sep {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
  }

  /* -- ACTIONS GAUCHE -- */
  .dock-actions { gap: 4px; }

  .btn-icon {
    width: 16px; 
    height: 16px;
    display: block;
  }

  /* -- RACCOURCIS CENTRE -- */
  .info-hint { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-dim); }
  
  .info-hint kbd {
    display: inline-flex; align-items: center; justify-content: center; 
    padding: 2px 6px; background: rgba(255, 255, 255, 0.05); 
    border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 4px; 
    font-family: var(--font-mono); font-size: 10px; font-weight: 600; 
    color: var(--color-text); letter-spacing: 0.5px;
    box-shadow: 0 2px 0 rgba(0,0,0,0.3);
  }

  /* -- TÉLÉMÉTRIE DROITE -- */
  .fps-display {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; 
    color: var(--color-text-dim); min-width: 48px; text-align: right;
  }

  .coords-display {
    font-family: var(--font-mono); font-size: 10px; color: var(--color-text-dim); 
    width: 100px; text-align: left; letter-spacing: 0.3px; white-space: pre;
    line-height: 1.3;
  }
</style>
