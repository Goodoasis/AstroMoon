<script>
  import { projectStore } from '../stores/projectStore.svelte.js';
  import { PixiRenderer } from '../engine/pixi_renderer.js';

  function handleStyleChange() {
    PixiRenderer.updateStyle(projectStore.style);
  }
</script>

<div class="studio-toolbar">
  <div class="studio-group">
    <div class="group-label">VECTEURS</div>
    <div class="control-row">
      <label for="thickness">Épaisseur</label>
      <input 
        id="thickness"
        type="range" 
        min="0.5" max="5" step="0.1" 
        bind:value={projectStore.style.geojsonThickness}
        oninput={handleStyleChange}
      />
    </div>
    <div class="control-row">
      <label for="glow">Glow</label>
      <input 
        id="glow"
        type="range" 
        min="0" max="1.5" step="0.1" 
        bind:value={projectStore.style.glowIntensity}
        oninput={handleStyleChange}
      />
    </div>
    <div class="control-row">
      <label for="opacity">Opacité</label>
      <input 
        id="opacity"
        type="range" 
        min="0.1" max="1" step="0.05" 
        bind:value={projectStore.style.opacity}
        oninput={handleStyleChange}
      />
    </div>
  </div>

  <div class="divider"></div>

  <div class="studio-group">
    <div class="group-label">IMAGE & FILTRES</div>
    <div class="control-row">
      <label for="brightness">Luminosité</label>
      <input 
        id="brightness"
        type="range" 
        min="0.1" max="3" step="0.1" 
        bind:value={projectStore.style.brightness}
        oninput={handleStyleChange}
      />
    </div>
    <div class="control-row">
      <label for="contrast">Contraste</label>
      <input 
        id="contrast"
        type="range" 
        min="0.1" max="3" step="0.1" 
        bind:value={projectStore.style.contrast}
        oninput={handleStyleChange}
      />
    </div>
  </div>
</div>

<style>
  .studio-toolbar {
    position: absolute;
    top: 74px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10, 11, 16, 0.85);
    backdrop-filter: blur(12px);
    padding: 16px 32px;
    border-radius: 9999px;
    border: 1px solid #FF4081;
    box-shadow: 0 0 20px rgba(255, 64, 129, 0.2), 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .studio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #FF4081;
    opacity: 0.8;
    margin-bottom: 2px;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .control-row label {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.8);
    width: 70px;
  }

  .divider {
    width: 1px;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
  }

  /* Cyber-Vibrant range styles */
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100px;
    background: transparent;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 14px;
    width: 14px;
    border-radius: 50%;
    background: #FF4081;
    cursor: pointer;
    margin-top: -5px;
    box-shadow: 0 0 10px rgba(255, 64, 129, 0.5);
    border: 2px solid #fff;
  }
</style>
