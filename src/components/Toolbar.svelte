<script>
  import { createEventDispatcher } from 'svelte';
  import { viewportState } from '@/stores/viewportState.svelte.js';
  import { layerState } from '@/stores/layerState.svelte.js';
  import { PixiRenderer } from '@/engine/pixi_renderer.js';
  import { updateCursor } from '@/engine/inputHandler.js';
  import { Transform } from '@/engine/transform.js';
  import { Anchors } from '@/engine/anchors.js';

  const dispatch = createEventDispatcher();

  let showGrid = $state(false);
  let showLabels = $state(false);

  function handleUpload() {
    document.getElementById('input-image').click();
  }

  function toggleAnchorMode() {
    viewportState.mode = viewportState.mode === 'anchor' ? 'navigate' : 'anchor';
    updateCursor();
    dispatch('toast', viewportState.mode === 'anchor' ? '📌 Mode Ancrage' : '🧭 Mode Navigation');
  }

  function toggleGrid() {
    showGrid = PixiRenderer.toggleGrid();
    if (showGrid) {
      layerState.dirtyGrid = true;
      layerState.layerTransformDirty = true;
    }
  }

  function toggleLabels() {
    showLabels = PixiRenderer.toggleLabels();
    if (showLabels) {
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
</script>

<div id="toolbar" class="visible" role="toolbar" aria-label="Outils">
  <button class="tb-btn" onclick={handleUpload} aria-label="Charger une image">
    🖼️
    <span class="tooltip">Charger image</span>
  </button>

  <div class="tb-sep"></div>

  <button class="tb-btn" class:active={viewportState.mode === 'anchor'} onclick={toggleAnchorMode} aria-label="Mode ancrage">
    📌
    <span class="tooltip">Mode Ancrage (A)</span>
  </button>

  <button class="tb-btn" class:active={showGrid} onclick={toggleGrid} aria-label="Grille">
    🔲
    <span class="tooltip">Grille debug (G)</span>
  </button>

  <div class="tb-sep"></div>

  <button class="tb-btn" onclick={handleReset} aria-label="Réinitialiser">
    ↺
    <span class="tooltip">Reset</span>
  </button>

  <div class="tb-sep"></div>

  <button class="tb-btn" class:active={showLabels} onclick={toggleLabels} aria-label="Noms des cratères">
    🏷️
    <span class="tooltip">Noms Cratères (L)</span>
  </button>

  <div class="tb-sep"></div>

  <span id="fps-display">{viewportState.fps || '--'} FPS</span>

  <div class="tb-sep"></div>
  <span id="coords-display">Lat: --- | Lon: ---</span>
</div>

<style>
  #toolbar {
    position: fixed;
    top: 74px; /* Déplacé sous les PhaseTabs */
    left: 50%;
    transform: translateX(-50%) translateY(0);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--color-surface);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    box-shadow: var(--shadow-card), var(--shadow-hud-glow);
    z-index: 100;
    opacity: 1;
    transition: box-shadow var(--transition-med);
  }

  #toolbar:hover {
    box-shadow: var(--shadow-card), var(--shadow-glow-violet);
    border-color: var(--color-border-hover);
  }

  .tb-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-dim);
    font-size: 18px;
    cursor: pointer;
    transition: all var(--transition-fast);
    outline: none;
  }

  .tb-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
    border-color: var(--color-border);
    transform: translateY(-1px);
  }

  .tb-btn:active { transform: translateY(0); }

  .tb-btn.active {
    background: rgba(0, 212, 255, 0.12);
    color: var(--color-cyan);
    border-color: rgba(0, 212, 255, 0.3);
    box-shadow: 0 0 12px rgba(0, 212, 255, 0.15);
  }

  .tb-btn.active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 16px;
    height: 3px;
    background: var(--color-cyan);
    border-radius: var(--radius-pill);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .tb-btn .tooltip {
    position: absolute;
    bottom: -34px;
    left: 50%;
    transform: translateX(-50%) scale(0.9);
    padding: 4px 10px;
    background: rgba(10, 10, 20, 0.92);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: all var(--transition-fast);
    z-index: 200;
  }

  .tb-btn:hover .tooltip {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }

  .tb-sep {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    margin: 0 4px;
  }

  #fps-display {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-dim);
    padding: 0 8px;
    min-width: 56px;
    text-align: right;
    letter-spacing: 0.5px;
  }

  #coords-display {
    display: inline-block;
    font-family: monospace;
    font-size: 13px;
    color: var(--color-text-dim);
    width: 240px;
    text-align: left;
  }
</style>
