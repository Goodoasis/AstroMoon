<script>
  import { projectStore } from '../stores/projectStore.svelte.js';

  function triggerDownload() {
    // Basic logic to trigger a canvas download
    const canvas = document.getElementById('main-canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `AstroMoon-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }

  const ratios = [
    { id: '16:9', label: 'Cinématique (16:9)' },
    { id: '1:1', label: 'Carré (1:1)' },
    { id: '4:3', label: 'Classique (4:3)' }
  ];
</script>

<div class="export-panel">
  <div class="export-group">
    <div class="group-label">CONFIGURATION EXPORT</div>
    <div class="ratio-selector">
      {#each ratios as ratio}
        <button 
          class="ratio-btn {projectStore.exportConfig.ratio === ratio.id ? 'active' : ''}"
          onclick={() => projectStore.exportConfig.ratio = ratio.id}
        >
          {ratio.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="divider"></div>

  <div class="export-group">
    <div class="group-label">OPTIONS</div>
    <label class="toggle-control">
      <input type="checkbox" bind:checked={projectStore.exportConfig.texts} />
      <span class="custom-toggle"></span>
      <span class="label-text">Nerd Mode (HUD Metadata)</span>
    </label>
  </div>

  <div class="actions">
    <button class="download-btn" onclick={triggerDownload}>
      <span class="icon">📥</span> TÉLÉCHARGER
    </button>
  </div>
</div>

<style>
  .export-panel {
    position: absolute;
    top: 74px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10, 11, 16, 0.85);
    backdrop-filter: blur(12px);
    padding: 20px 32px;
    border-radius: 20px;
    border: 1px solid #F59E0B;
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.2), 0 4px 15px rgba(0, 0, 0, 0.6);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 32px;
  }

  .export-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .group-label {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #F59E0B;
    opacity: 0.8;
  }

  .ratio-selector {
    display: flex;
    gap: 8px;
  }

  .ratio-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fff;
    padding: 6px 12px;
    border-radius: 9999px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .ratio-btn:hover {
    border-color: #F59E0B;
    background: rgba(245, 158, 11, 0.1);
  }

  .ratio-btn.active {
    background: #F59E0B;
    border-color: #F59E0B;
    color: #000;
    font-weight: bold;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
  }

  .divider {
    width: 1px;
    height: 60px;
    background: rgba(255, 255, 255, 0.1);
  }

  .toggle-control {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }

  .toggle-control input {
    display: none;
  }

  .custom-toggle {
    width: 32px;
    height: 18px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    position: relative;
    transition: background 0.3s;
  }

  .custom-toggle::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.3s;
  }

  input:checked + .custom-toggle {
    background: #F59E0B;
  }

  input:checked + .custom-toggle::after {
    transform: translateX(14px);
  }

  .label-text {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }

  .download-btn {
    background: #F59E0B;
    color: #000;
    border: none;
    padding: 12px 24px;
    border-radius: 9999px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);
  }

  .download-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 25px rgba(245, 158, 11, 0.5);
  }

  .actions {
    margin-left: auto;
  }
</style>
