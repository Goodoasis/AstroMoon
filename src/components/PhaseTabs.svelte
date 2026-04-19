<script>
  import { uiState } from '../stores/uiState.svelte.js';
  import { viewportState } from '../stores/viewportState.svelte.js';
  import { layerState } from '../stores/layerState.svelte.js';
  import { Transform } from '../engine/transform.js';
  import { updateCursor } from '../engine/inputHandler.js';

  const phases = $derived([
    { id: 'IMPORT', label: 'Import', color: '#94a3b8' },
    { 
      id: 'ALIGN', 
      label: (uiState.currentPhase === 'ALIGN' && viewportState.mode === 'anchor') ? 'Anchor' : 'Align', 
      color: (uiState.currentPhase === 'ALIGN' && viewportState.mode === 'anchor') ? '#00FF88' : '#00E5FF' 
    },
    { id: 'STUDIO', label: 'Studio', color: '#FF4081' },
    { id: 'EXPORT', label: 'Export', color: '#F59E0B' }
  ]);

  function setPhase(phaseId) {
    if (phaseId === uiState.currentPhase) return;

    // Désactiver le mode ancrage
    if (viewportState.mode === 'anchor') {
      viewportState.mode = 'navigate';
      updateCursor();
    }

    // Save snapshot of current phase before leaving
    uiState.saveSnapshot(
      uiState.currentPhase,
      viewportState.tx,
      viewportState.ty,
      viewportState.scale
    );

    if (phaseId === 'IMPORT') {
      // Force reset when returning to import
      viewportState.tx = 0;
      viewportState.ty = 0;
      viewportState.scale = 1;
      layerState.layerTransformDirty = true;
    } else {
      // Restore target phase snapshot if it exists, otherwise keep current view
      const snap = uiState.getSnapshot(phaseId);
      if (snap && snap.tx !== null && snap.scale !== null) {
        viewportState.tx = snap.tx;
        viewportState.ty = snap.ty;
        viewportState.scale = snap.scale;
        layerState.layerTransformDirty = true;
      }
    }
    uiState.currentPhase = phaseId;
  }
</script>

<div class="phase-tabs-container">
  {#each phases as phase}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="phase-tab {uiState.currentPhase === phase.id ? 'active' : ''}"
      style:--tab-color={phase.color}
      onclick={() => setPhase(phase.id)}
      data-text={phase.label}
    >
      {phase.label}
    </div>
  {/each}
</div>

<style>
  .phase-tabs-container {
    position: absolute;
    top: 5px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    background: rgba(10, 11, 16, 0.7); /* Deep Obsidian with opacity */
    backdrop-filter: blur(8px);
    padding: 6px;
    border-radius: 9999px; /* Pill-shaped */
    z-index: 10001; /* Above the global glow border (9999) */
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.5s ease;
  }

  .phase-tab {
    padding: 6px 16px;
    border-radius: 9999px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    border: 1px solid transparent; /* Always present to prevent shift */
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 85px; /* Prevent shrinking/expanding during label change */
  }

  /* Trick to reserve space for bold text without shifting layout */
  .phase-tab::after {
    content: attr(data-text);
    height: 0;
    visibility: hidden;
    overflow: hidden;
    user-select: none;
    pointer-events: none;
    font-weight: 700;
  }

  .phase-tab:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .phase-tab.active {
    color: var(--tab-color);
    background: rgba(255, 255, 255, 0.05); /* Flat background */
    box-shadow: 
      0 0 15px rgba(0, 0, 0, 0.4), 
      0 0 10px var(--tab-color); /* The discreet glow */
    text-shadow: 0 0 5px var(--tab-color);
    border: 1px solid var(--tab-color);
    font-weight: 700;
    letter-spacing: 0.5px;
    filter: brightness(1.2);
  }
</style>
