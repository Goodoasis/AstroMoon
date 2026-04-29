<script>
  import { studioState } from "@/stores/studioState.svelte.js";
  import { layerState } from "@/stores/layerState.svelte.js";
  import { STUDIO } from "@/engine/config.js";
  import { tooltip } from "@/actions/tooltip.js";
  import { untrack } from "svelte";
  import RangeSlider from './RangeSlider.svelte';
  import NeonButton from './NeonButton.svelte';
  import NeonToggle from './NeonToggle.svelte';

  let isOpen = $state(true);

  function toggleOpen() {
    isOpen = !isOpen;
  }


  function resetAll() {
    studioState.brightness = STUDIO.brightnessDefault;
    studioState.contrast = STUDIO.contrastDefault;
    studioState.clarity = STUDIO.clarityDefault;
    studioState.sharpness = STUDIO.sharpnessDefault;
    studioState.denoising = STUDIO.denoisingDefault;
    studioState.grayscale = false;
    studioState.vignette = STUDIO.vignetteDefault;
    studioState.vignetteFeather = STUDIO.vignetteFeatherDefault;
    studioState.rotation = 0;
    studioState.flipH = false;
    studioState.flipV = false;
    studioState.dynamicShadow = false;
    studioState.limbGlow = false;
    studioState.limbGlowIntensity = STUDIO.limbGlowDefault;
    studioState.limbGlowType = "diffraction";
    onParamChange();
  }

  function onParamChange() {
    layerState.layerTransformDirty = true;
  }

  // Auto-refresh Pixi when studioState changes
  $effect(() => {
    // Read all relevant properties to establish dependencies
    const _b = studioState.brightness;
    const _c = studioState.contrast;
    const _cl = studioState.clarity;
    const _sh = studioState.sharpness;
    const _de = studioState.denoising;
    const _gr = studioState.grayscale;
    const _vi = studioState.vignette;
    const _vf = studioState.vignetteFeather;
    const _ro = studioState.rotation;
    const _fh = studioState.flipH;
    const _fv = studioState.flipV;

    untrack(() => {
      layerState.layerTransformDirty = true;
    });
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="sa-layout">
  <div class="sa-panel" class:open={isOpen}>
    <!-- Trigger -->
    <div
      class="sa-trigger"
      onclick={toggleOpen}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === "Enter" && toggleOpen()}
    >
      <div class="sa-trigger-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M12 20h9" /><path
            d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
          />
        </svg>
      </div>
      <div class="sa-trigger-text">
        <span>Studio</span>
        {#if !isOpen}
          <span class="sa-trigger-sep">|</span>
          <span class="sa-trigger-dim"
            >{studioState.brightness.toFixed(1)}b</span
          >
          <span class="sa-trigger-dim">{studioState.contrast.toFixed(1)}c</span>
        {/if}
      </div>
    </div>

    <!-- Content -->
    <div class="sa-content">
      <div class="sa-scroll">
        <!-- IMAGE -->
        <section class="sa-section">
          <h4 class="sa-title">Image</h4>
          <RangeSlider variant="full" label="Luminosité" bind:value={studioState.brightness} initialValue={STUDIO.brightnessDefault} min={STUDIO.brightnessMin} max={STUDIO.brightnessMax} step={STUDIO.brightnessStep} oninput={onParamChange} />
          <RangeSlider variant="full" label="Contraste" bind:value={studioState.contrast} initialValue={STUDIO.contrastDefault} min={STUDIO.contrastMin} max={STUDIO.contrastMax} step={STUDIO.contrastStep} oninput={onParamChange} />
          <RangeSlider variant="full" label="Clarté" bind:value={studioState.clarity} initialValue={STUDIO.clarityDefault} min={STUDIO.clarityMin} max={STUDIO.clarityMax} step={STUDIO.clarityStep} oninput={onParamChange} />
          <RangeSlider variant="full" label="Netteté" bind:value={studioState.sharpness} initialValue={STUDIO.sharpnessDefault} min={STUDIO.sharpnessMin} max={STUDIO.sharpnessMax} step={STUDIO.sharpnessStep} fixed={1} oninput={onParamChange} />
          <RangeSlider variant="full" label="Débruitage" bind:value={studioState.denoising} initialValue={STUDIO.denoisingDefault} min={STUDIO.denoisingMin} max={STUDIO.denoisingMax} step={STUDIO.denoisingStep} oninput={onParamChange} />
          <NeonToggle 
            variant="full"
            label="Niveaux de gris" 
            bind:checked={studioState.grayscale} 
            onchange={onParamChange} 
          />
        </section>

        <div class="sa-div"></div>

        <!-- VIGNETTE -->
        <section class="sa-section">
          <h4 class="sa-title">Vignetage</h4>
          <RangeSlider variant="full" label="Intensité" bind:value={studioState.vignette} initialValue={STUDIO.vignetteDefault} min={STUDIO.vignetteMin} max={STUDIO.vignetteMax} step={STUDIO.vignetteStep} oninput={onParamChange} />
          <RangeSlider variant="full" label="Douceur" bind:value={studioState.vignetteFeather} initialValue={STUDIO.vignetteFeatherDefault} min={STUDIO.vignetteFeatherMin} max={STUDIO.vignetteFeatherMax} step={STUDIO.vignetteFeatherStep} oninput={onParamChange} />
        </section>

        <div class="sa-div"></div>

        <!-- TRANSFORM -->
        <section class="sa-section">
          <h4 class="sa-title">Transformation</h4>
          <RangeSlider variant="full" label="Rotation" bind:value={studioState.rotation} initialValue={0} min={STUDIO.rotationMin} max={STUDIO.rotationMax} step={STUDIO.rotationStep} fixed={1} suffix="°" oninput={onParamChange} />
          <div class="sa-flip-row">
            <NeonButton
              variant="panel"
              label="Miroir H"
              color="#FF4081"
              active={studioState.flipH}
              fullWidth={true}
              onclick={() => {
                studioState.flipH = !studioState.flipH;
                onParamChange();
              }}
              title="Miroir Horizontal"
            >
              {#snippet icon()}
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width: 16px; height: 16px;">
                  <line x1="10" y1="2" x2="10" y2="18" stroke-dasharray="2 2" opacity="0.4" />
                  <polyline points="7,6 3,10 7,14" /><polyline points="13,6 17,10 13,14" />
                </svg>
              {/snippet}
            </NeonButton>

            <NeonButton
              variant="panel"
              label="Miroir V"
              color="#FF4081"
              active={studioState.flipV}
              fullWidth={true}
              onclick={() => {
                studioState.flipV = !studioState.flipV;
                onParamChange();
              }}
              title="Miroir Vertical"
            >
              {#snippet icon()}
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width: 16px; height: 16px;">
                  <line x1="2" y1="10" x2="18" y2="10" stroke-dasharray="2 2" opacity="0.4" />
                  <polyline points="6,7 10,3 14,7" /><polyline points="6,13 10,17 14,13" />
                </svg>
              {/snippet}
            </NeonButton>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="sa-footer">
        <div class="sa-div"></div>
        <NeonButton
          variant="panel"
          label="Réinitialiser"
          color="#FF4081"
          bold={false}
          fullWidth={true}
          onclick={resetAll}
        >
          {#snippet icon()}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width: 16px; height: 16px;">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          {/snippet}
        </NeonButton>
      </div>
    </div>
  </div>
</div>

<style>
  .sa-layout {
    pointer-events: none;
  }

  .sa-panel {
    display: flex;
    flex-direction: column;
    width: 270px;
    max-height: 48px;
    background: rgba(10, 11, 16, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    --nt-panel-color: #FF4081;
  }

  .sa-panel.open {
    flex: 1;
    min-height: 0;
    max-height: none;
    border-radius: 16px;
    border-color: rgba(255, 64, 129, 0.3);
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.6),
      0 0 20px rgba(255, 64, 129, 0.15);
    overflow: visible;
    transition: flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sa-panel.open:hover {
    flex: 3;
  }

  /* Trigger */
  .sa-trigger {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    cursor: pointer;
    gap: 12px;
    user-select: none;
  }

  .sa-trigger-icon {
    width: 20px;
    height: 20px;
    color: #ff4081;
    flex-shrink: 0;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sa-panel.open .sa-trigger-icon {
    transform: rotate(90deg);
  }

  .sa-trigger-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-dim);
  }

  .sa-trigger-sep {
    opacity: 0.3;
  }
  .sa-trigger-dim {
    opacity: 0.6;
  }

  /* Content */
  .sa-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    padding: 0 16px 14px 16px;
  }

  .sa-panel.open .sa-content {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 0.5s ease 0.1s;
  }

  .sa-scroll {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    scrollbar-width: none;
    padding-bottom: 8px;
    max-height: calc(85vh - 120px);
  }
  .sa-scroll::-webkit-scrollbar {
    display: none;
  }

  /* Sections */
  .sa-section {
    padding: 6px 0;
  }

  .sa-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: "Space Grotesk", sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(255, 64, 129, 0.8);
    margin-bottom: 8px;
  }

  .sa-div {
    height: 1px;
    background: rgba(255, 64, 129, 0.08);
    margin: 4px 0;
  }

  /* Slider rows are now handled by RangeSlider component */



  /* Flip buttons */
  .sa-flip-row {
    display: flex;
    gap: 4px;
    margin: 6px 0;
  }

  .sa-footer {
    flex-shrink: 0;
    margin-top: 6px;
  }
</style>
