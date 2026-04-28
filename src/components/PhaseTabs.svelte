<script>
  import { uiState } from '../stores/uiState.svelte.js';
  import { viewportState } from '../stores/viewportState.svelte.js';
  import { layerState } from '../stores/layerState.svelte.js';
  import { studioState } from '../stores/studioState.svelte.js';
  import { Transform } from '../engine/transform.js';
  import { updateCursor } from '../engine/inputHandler.js';
  import AuthModule from './AuthModule.svelte';
  import NeonButton from './NeonButton.svelte';

  const phases = $derived([
    { id: 'IMPORT', label: 'Import', color: '#94a3b8' },
    { 
      id: 'ALIGN', 
      label: (uiState.currentPhase === 'ALIGN' && viewportState.mode === 'anchor') ? 'Ancre' : 'Align', 
      color: (uiState.currentPhase === 'ALIGN' && viewportState.mode === 'anchor') ? '#00FF88' : '#00E5FF' 
    },
    { id: 'STUDIO', label: 'Studio', color: '#FF4081' },
    { id: 'EXPORT', label: 'Export', color: '#FFD700' }
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
      }
      layerState.layerTransformDirty = true;
    }
    
    // Règle spécifique : on masque la lumière de jour lorsqu'on rentre dans Studio
    if (phaseId === 'STUDIO') {
      studioState.dayMaskVisible = false;
      layerState.layerTransformDirty = true;
    }

    uiState.currentPhase = phaseId;
  }
</script>

<header class="app-header">
  <!-- Left: Branding -->
  <div class="header-brand">
    <svg class="logo-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00E5FF" />
          <stop offset="100%" stop-color="#7C4DFF" />
        </linearGradient>
      </defs>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="url(#logo-grad)"/>
    </svg>
    <span class="brand-name">AstroMoon</span>
  </div>

  <!-- Center: Phase Navigation -->
  <nav class="phase-tabs-container">
    {#each phases as phase}
      <NeonButton
        variant="tab"
        label={phase.label}
        color={phase.color}
        active={uiState.currentPhase === phase.id}
        onclick={() => setPhase(phase.id)}
      />
    {/each}
  </nav>

  <!-- Right: Authentication -->
  <div class="header-auth">
    <AuthModule />
  </div>
</header>

<style>
  .app-header {
    position: absolute;
    top: 5px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 780px; /* Large enough for all elements */
    background: rgba(10, 11, 16, 0.7); /* Deep Obsidian with opacity */
    backdrop-filter: blur(8px);
    padding: 4px 12px;
    border-radius: 9999px; /* Pill-shaped */
    z-index: 10001; /* Above the global glow border (9999) */
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.5s ease;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-left: 8px;
    min-width: 150px;
  }

  .logo-svg {
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 0 8px rgba(0, 229, 255, 0.4));
  }

  .brand-name {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 1px;
    text-transform: uppercase;
    background: linear-gradient(90deg, #00E5FF, #7C4DFF);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-auth {
    min-width: 150px;
    display: flex;
    justify-content: flex-end;
    padding-right: 4px;
  }

  .phase-tabs-container {
    display: flex;
    gap: 8px;
    padding: 2px;
  }
</style>
