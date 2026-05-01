<script>
  import { onMount } from 'svelte';
  import Starfield from './components/Starfield.svelte';
  import PixiCanvas from './components/PixiCanvas.svelte';
  import AnchorPanel from './components/AnchorPanel.svelte';
  import EmergencyPanel from './components/EmergencyPanel.svelte';
  import AstroContextPanel from './components/AstroContextPanel.svelte';
  import InfoBar from './components/InfoBar.svelte';
  import StatusToast from './components/StatusToast.svelte';
  import WelcomeOverlay from './components/WelcomeOverlay.svelte';
  import { viewportState } from './stores/viewportState.svelte.js';
  import { temporalState } from './stores/temporalState.svelte.js';
  import { spatialState } from './stores/spatialState.svelte.js';
  import { moonState } from './stores/moonState.svelte.js';
  import { layerState } from './stores/layerState.svelte.js';
  import { updateEphemeris } from './engine/ephemeris.js';
  import { Transform } from './engine/transform.js';
  import { renderTick } from './engine/renderLoop.js';
  import { bindInputHandlers } from './engine/inputHandler.js';
  import { handleImageUpload } from './engine/imageLoader.js';
  import { loadLayersAsync, initCraters, updateGeoJSONProjection, updateCratersProjection } from './engine/layerLoader.js';
  import { uiState } from './stores/uiState.svelte.js';
  import PhaseTabs from './components/PhaseTabs.svelte';
  import StudioLayerPanel from './components/StudioLayerPanel.svelte';
  import StudioLabelPanel from './components/StudioLabelPanel.svelte';
  import StudioPinnedPanel from './components/StudioPinnedPanel.svelte';
  import StudioAdjustPanel from './components/StudioAdjustPanel.svelte';

  import { equipmentState } from './stores/equipmentState.svelte.js';

  let toastMessage = $state('');
  let toastVisible = $state(false);
  let toastTimer = null;

  function showToast(message) {
    toastMessage = message;
    toastVisible = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible = false; }, 3000);
  }

  function handlePixiReady(event) {
    const app = event.detail.app;
    bindInputHandlers(app.canvas);
    app.ticker.add(renderTick);
  }

  async function handleFileInput(event) {
    const file = event.target.files[0];
    if (file) {
      await handleImageUpload(file, showToast);
      viewportState.appReady = true;
      document.body.classList.add('app-ready');
      
      // Reset verification states for the new image
      equipmentState.resetVerification();
      temporalState.timeVerified = false;
      spatialState.cityVerified = false;
      viewportState.isMountVerified = false;

      handleEphemerisUpdate(); // Force Svelte à digérer l'Exif immédiatement !
      uiState.currentPhase = 'ALIGN'; // Move to Align phase after import
    }
  }

  function handleEphemerisUpdate() {
    updateEphemeris(viewportState.isAltAzMode);
    updateGeoJSONProjection();
    updateCratersProjection();
    layerState.dirtyEphemeris = true;
    layerState.layerTransformDirty = true;
  }

  onMount(() => {
    viewportState.canvasW = window.innerWidth;
    viewportState.canvasH = window.innerHeight;
    Transform.reset(viewportState.canvasW, viewportState.canvasH);

    // Initial ephemeris calculation
    updateEphemeris(viewportState.isAltAzMode);
    // Force premier calcul (puisque plus de .then())
    updateGeoJSONProjection();
    updateCratersProjection();
    layerState.dirtyEphemeris = true;
    layerState.layerTransformDirty = true;

    loadLayersAsync();
    initCraters();

    const onResize = () => {
      const oldW = viewportState.canvasW;
      const oldH = viewportState.canvasH;
      viewportState.canvasW = window.innerWidth;
      viewportState.canvasH = window.innerHeight;
      Transform.handleResize(oldW, oldH, viewportState.canvasW, viewportState.canvasH);
      layerState.layerTransformDirty = true;
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('ephemeris-async-refresh', handleEphemerisUpdate);

    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('ephemeris-async-refresh', handleEphemerisUpdate);
    };
  });
  let glowColor = $derived(
    uiState.emergencyMode ? '#FF8C00' :  // Emergency orange override
    uiState.currentPhase === 'IMPORT' ? '#94a3b8' :
    (uiState.currentPhase === 'ALIGN' && viewportState.mode === 'anchor') ? '#00FF88' : // Neon Green in anchor mode
    uiState.currentPhase === 'ALIGN' ? '#00E5FF' :
    uiState.currentPhase === 'STUDIO' ? '#FF4081' :
    uiState.currentPhase === 'EXPORT' ? '#FFD700' : 'transparent'
  );

  let isAnchorActive = $derived(uiState.currentPhase === 'ALIGN' && viewportState.mode === 'anchor');

  // Calculates the screen position of the layer center for the rotation guide UI
  let rotCenterScreen = $derived.by(() => {
    if (!viewportState.isRKeyDown) return { x: 0, y: 0 };
    const c = Transform.getLayerCenter();
    return {
      x: c.x * viewportState.scale + viewportState.tx,
      y: c.y * viewportState.scale + viewportState.ty
    };
  });
</script>

<!-- Global Glow Container -->
<main class="app-container" 
  class:anchor-active={isAnchorActive}
  style:--glow-color={glowColor}>

<!-- Persistent Starfield Background -->
<Starfield />

<!-- Hidden file input -->
<input type="file" id="input-image" name="inputImage" class="hidden-input" accept="image/*,.tif,.tiff,.fit,.fits,.heic,.heif" onchange={handleFileInput} />

<!-- Phase Tabs / Navigation -->
<PhaseTabs />

<!-- PixiJS rendering canvas -->
<PixiCanvas
  on:toast={(e) => showToast(e.detail)}
  on:ready={handlePixiReady}
/>

{#if uiState.currentPhase === 'IMPORT'}
  <WelcomeOverlay />
{/if}

{#if uiState.currentPhase === 'ALIGN'}
  <!-- Astro Context Panel (top right, vertical) -->
  <AstroContextPanel on:ephemerisUpdate={handleEphemerisUpdate} />

  <!-- Emergency or Anchor Panel (left side) -->
  {#if uiState.emergencyMode}
    <EmergencyPanel />
  {:else}
    <AnchorPanel />
  {/if}
{/if}

{#if uiState.currentPhase === 'STUDIO'}
  <div class="panel-layout-left">
    <StudioLayerPanel />
    <StudioLabelPanel />
  </div>

  <div class="panel-layout-right">
    <StudioAdjustPanel />
    <StudioPinnedPanel />
  </div>
{/if}



{#if uiState.currentPhase !== 'IMPORT'}
  <!-- Bottom Dock (Global Info & Action Bar) -->
  <InfoBar on:toast={(e) => showToast(e.detail)} />
{/if}

<!-- Status Toast (Global) -->
<StatusToast message={toastMessage} visible={toastVisible} />

{#if uiState.currentPhase === 'ALIGN' && viewportState.isRKeyDown && viewportState.mouseX > 0}
  <svg class="rotation-guide">
    <line 
      x1={rotCenterScreen.x} 
      y1={rotCenterScreen.y} 
      x2={viewportState.mouseX} 
      y2={viewportState.mouseY} 
      stroke="var(--color-cyan)" 
      stroke-width="1.5" 
      stroke-dasharray="6,6" 
    />
    <!-- Center Pivot -->
    <circle cx={rotCenterScreen.x} cy={rotCenterScreen.y} r="4" fill="var(--color-cyan)" />
    <!-- Mouse Pos -->
    <circle cx={viewportState.mouseX} cy={viewportState.mouseY} r="6" fill="transparent" stroke="var(--color-cyan)" stroke-width="1.5" />
  </svg>
{/if}

</main>

<style>
  .app-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
    box-sizing: border-box;
    isolation: isolate;
  }

  .panel-layout-left {
    position: fixed;
    top: 74px;
    left: 16px;
    bottom: 74px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1000;
    pointer-events: none;
  }

  .panel-layout-right {
    position: fixed;
    top: 74px;
    right: 16px;
    bottom: 74px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1000;
    pointer-events: none;
  }

  .rotation-guide {
    position: absolute;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 10;
  }

  /* Glow effect: petite bande fine mais très lumineuse DESSUS le canvas */
  .app-container::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    border: 2px solid var(--glow-color, transparent);
    box-shadow: inset 0 0 20px var(--glow-color, transparent), 
                inset 0 0 5px var(--glow-color, transparent);
    transition: box-shadow 0.6s ease, border-color 0.6s ease;
  }

  .app-container.anchor-active::after {
    border-width: 3px;
  }

  @keyframes border-pulse-anchor {
    0% {
      box-shadow: inset 0 0 15px var(--glow-color), inset 0 0 5px var(--glow-color);
      opacity: 0.7;
    }
    100% {
      box-shadow: inset 0 0 40px var(--glow-color), inset 0 0 15px var(--glow-color);
      opacity: 1;
    }
  }
</style>
