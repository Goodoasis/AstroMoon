<script>
  import { onMount } from 'svelte';
  import PixiCanvas from './components/PixiCanvas.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import TimeBar from './components/TimeBar.svelte';
  import LocationBar from './components/LocationBar.svelte';
  import MountSwitch from './components/MountSwitch.svelte';
  import AnchorPanel from './components/AnchorPanel.svelte';
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
  import { PixiRenderer } from './engine/pixi_renderer.js';

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

    return () => {
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<!-- Hidden file input -->
<input type="file" id="input-image" name="inputImage" class="hidden-input" accept="image/*" onchange={handleFileInput} />

<!-- PixiJS rendering canvas -->
<PixiCanvas
  on:toast={(e) => showToast(e.detail)}
  on:ready={handlePixiReady}
/>

<!-- Toolbar (top center) -->
<Toolbar on:toast={(e) => showToast(e.detail)} />

<!-- HUD Pill Bars (top right) -->
<MountSwitch on:ephemerisUpdate={handleEphemerisUpdate} />
<TimeBar on:ephemerisUpdate={handleEphemerisUpdate} />
<LocationBar on:ephemerisUpdate={handleEphemerisUpdate} />

<!-- Anchor Panel (right side) -->
<AnchorPanel />

<!-- Info Bar (bottom) -->
<InfoBar />

<!-- Status Toast -->
<StatusToast message={toastMessage} visible={toastVisible} />

<!-- Welcome Overlay -->
<WelcomeOverlay />
