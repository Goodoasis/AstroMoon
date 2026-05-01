<script>
  import NeonSelect from './NeonSelect.svelte';
  import RangeSlider from './RangeSlider.svelte';
  import NeonButton from './NeonButton.svelte';
  import { projectStore } from '../stores/projectStore.svelte.js';

  const handwritingStyles = [
    { value: 44, label: 'Style 1' },
    { value: 54, label: 'Style 2' },
    { value: 23, label: 'Style 3' },
    { value: 1, label: 'Style 4' },
    { value: 19, label: 'Style 5' },
    { value: 6, label: 'Style 6' },
    { value: 30, label: 'Style 7' },
    { value: 11, label: 'Style 8' },
    { value: 21, label: 'Style 9' }
  ];

  function triggerHandwriting() {
    projectStore.signature.activeText = projectStore.signature.text;
    projectStore.signature.activeStyle = projectStore.signature.styleId;
    projectStore.signature.activeBias = projectStore.signature.bias;
    projectStore.signature.activeStrokeWidth = projectStore.signature.strokeWidth;
    projectStore.signature.triggerSeed++;
  }
</script>

<div class="signature-panel">
  <div class="panel-header">
    <span class="panel-title">SIGNATURE MANUSCRITE</span>
  </div>

  <div class="panel-content">
    <div class="input-group">
      <span class="group-label">TEXTE</span>
      <input 
        type="text" 
        bind:value={projectStore.signature.text} 
        class="cyber-input"
        placeholder="Saisissez votre texte..." 
      />
    </div>
    
    <div class="controls-row">
      <div class="control-col" style="flex: 1;">
        <span class="group-label">STYLE</span>
        <NeonSelect 
          options={handwritingStyles} 
          bind:value={projectStore.signature.styleId} 
          color="#00E5FF" 
          fullWidth={true} 
        />
      </div>
      <div class="control-col" style="flex: 1.5;">
        <RangeSlider variant="detail" label="LISIBILITÉ" bind:value={projectStore.signature.bias} min={0.15} max={2.5} step={0.02} color="#00E5FF" initialValue={0.75} fixed={2} />
        <RangeSlider variant="detail" label="ÉPAISSEUR" bind:value={projectStore.signature.strokeWidth} min={0.1} max={1.5} step={0.02} color="#00E5FF" initialValue={0.75} fixed={2} />
      </div>
    </div>

    <NeonButton 
      variant="primary" 
      label="GÉNÉRER LE TRACÉ" 
      onclick={triggerHandwriting} 
      style="width: 100%; margin-top: 4px;" 
    >
      {#snippet icon()}
        <span class="icon">✍️</span>
      {/snippet}
    </NeonButton>
  </div>
</div>

<style>
  .signature-panel {
    position: fixed;
    bottom: 74px;
    right: 16px;
    width: 340px;
    background: rgba(10, 11, 16, 0.85);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(0, 229, 255, 0.2);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7), 0 0 15px rgba(0, 229, 255, 0.05);
    z-index: 1000;
    overflow: visible; /* Important for portals like NeonSelect if needed locally */
  }

  .panel-header {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    background: linear-gradient(90deg, rgba(0, 229, 255, 0.05) 0%, transparent 100%);
    border-radius: 12px 12px 0 0;
  }

  .panel-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #00E5FF;
  }

  .panel-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .group-label {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: rgba(255, 255, 255, 0.5);
  }

  .cyber-input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 229, 255, 0.3);
    color: white;
    padding: 8px 12px;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    border-radius: 6px;
    outline: none;
    width: 100%;
    transition: all 0.2s ease;
  }

  .cyber-input:focus {
    border-color: #00E5FF;
    background: rgba(0, 229, 255, 0.05);
    box-shadow: 0 0 8px rgba(0, 229, 255, 0.2);
  }

  .controls-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .control-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .icon {
    font-size: 14px;
    filter: sepia(1) hue-rotate(180deg) saturate(3); /* Trick to tint emoji cyan if supported, or just use it */
  }
</style>
