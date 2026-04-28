<script>
  import { projectStore } from '../stores/projectStore.svelte.js';
  import NeonButton from './NeonButton.svelte';
  import NeonToggle from './NeonToggle.svelte';

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
        <NeonButton
          variant="tab"
          label={ratio.id}
          color="#FF4081"
          active={projectStore.exportConfig.ratio === ratio.id}
          onclick={() => projectStore.exportConfig.ratio = ratio.id}
        />
      {/each}
    </div>
  </div>

  <div class="divider"></div>

  <div class="export-group">
    <div class="group-label">OPTIONS</div>
    <NeonToggle 
      label="Nerd Mode (HUD Metadata)" 
      bind:checked={projectStore.exportConfig.texts} 
      color="#FF4081"
    />
  </div>

  <div class="actions">
    <NeonButton
      variant="primary"
      label="TÉLÉCHARGER"
      color="#FF4081"
      onclick={triggerDownload}
    >
      {#snippet icon()}
        <span class="icon">📥</span>
      {/snippet}
    </NeonButton>
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
    border: 1px solid #FF4081;
    box-shadow: 0 0 20px rgba(255, 64, 129, 0.2), 0 4px 15px rgba(0, 0, 0, 0.6);
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
    color: #FF4081;
    opacity: 0.8;
  }

  .ratio-selector {
    display: flex;
    gap: 6px;
  }

  .divider {
    width: 1px;
    height: 60px;
    background: rgba(255, 255, 255, 0.1);
  }



  .icon {
    font-size: 16px;
  }

  .actions {
    margin-left: auto;
  }
</style>
