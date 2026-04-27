<script>
  import { studioState } from "@/stores/studioState.svelte.js";
  import { layerState } from "@/stores/layerState.svelte.js";
  import { STUDIO } from "@/engine/config.js";
  import { tooltip } from "@/actions/tooltip.js";
  import { untrack } from "svelte";

  let isOpen = $state(true);

  function toggleOpen() {
    isOpen = !isOpen;
  }

  // Label search
  let labelSearch = $state("");
  let newLabelText = $state("");

  const cropLabels = {
    free: "Libre",
    "16:9": "16:9",
    "4:3": "4:3",
    "1:1": "1:1",
    "3:2": "3:2",
  };

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
    studioState.cropRatio = "free";
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
    const _cr = studioState.cropRatio;

    untrack(() => {
      layerState.layerTransformDirty = true;
    });
  });
</script>

{#snippet stSlider(
  label,
  value,
  initialValue,
  min,
  max,
  step,
  onChange,
  fixed = 2,
  suffix = "",
)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sa-slider-row"
    class:modified={value !== initialValue}
    onwheel={(e) => {
      e.preventDefault();
      const mult = e.shiftKey ? 0.1 : 1;
      const delta = e.deltaY > 0 ? -step * mult : step * mult;
      const newVal = Math.max(min, Math.min(max, value + delta));
      onChange({ target: { value: newVal } });
      onParamChange();
    }}
    ondblclick={() => {
      onChange({ target: { value: initialValue } });
      onParamChange();
    }}
    title="Double-clic pour réinitialiser"
  >
    <span class="sa-slider-label">{label}</span>
    <input
      type="range"
      class="sa-slider"
      {min}
      {max}
      {step}
      {value}
      oninput={(e) => {
        onChange(e);
        onParamChange();
      }}
    />
    <div class="sa-slider-val-wrapper">
      <input
        type="number"
        {min}
        {max}
        {step}
        value={Number(value).toFixed(fixed)}
        onchange={(e) => {
          onChange(e);
          onParamChange();
        }}
        class="sa-number-input"
      />
      {#if suffix}<span class="sa-suffix">{suffix}</span>{/if}
    </div>
  </div>
{/snippet}

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
          {@render stSlider(
            "Luminosité",
            studioState.brightness,
            STUDIO.brightnessDefault,
            STUDIO.brightnessMin,
            STUDIO.brightnessMax,
            STUDIO.brightnessStep,
            (e) => (studioState.brightness = +e.target.value),
          )}
          {@render stSlider(
            "Contraste",
            studioState.contrast,
            STUDIO.contrastDefault,
            STUDIO.contrastMin,
            STUDIO.contrastMax,
            STUDIO.contrastStep,
            (e) => (studioState.contrast = +e.target.value),
          )}
          {@render stSlider(
            "Clarté",
            studioState.clarity,
            STUDIO.clarityDefault,
            STUDIO.clarityMin,
            STUDIO.clarityMax,
            STUDIO.clarityStep,
            (e) => (studioState.clarity = +e.target.value),
          )}
          {@render stSlider(
            "Netteté",
            studioState.sharpness,
            STUDIO.sharpnessDefault,
            STUDIO.sharpnessMin,
            STUDIO.sharpnessMax,
            STUDIO.sharpnessStep,
            (e) => (studioState.sharpness = +e.target.value),
            1,
          )}
          {@render stSlider(
            "Débruitage",
            studioState.denoising,
            STUDIO.denoisingDefault,
            STUDIO.denoisingMin,
            STUDIO.denoisingMax,
            STUDIO.denoisingStep,
            (e) => (studioState.denoising = +e.target.value),
          )}
          <label class="sa-toggle">
            <input
              type="checkbox"
              bind:checked={studioState.grayscale}
              onchange={onParamChange}
            />
            <span class="sa-ttrack"><span class="sa-tthumb"></span></span>
            <span class="sa-toggle-label">Niveaux de gris</span>
          </label>
        </section>

        <div class="sa-div"></div>

        <!-- VIGNETTE -->
        <section class="sa-section">
          <h4 class="sa-title">Vignetage</h4>
          {@render stSlider(
            "Intensité",
            studioState.vignette,
            STUDIO.vignetteDefault,
            STUDIO.vignetteMin,
            STUDIO.vignetteMax,
            STUDIO.vignetteStep,
            (e) => (studioState.vignette = +e.target.value),
          )}
          {@render stSlider(
            "Douceur",
            studioState.vignetteFeather,
            STUDIO.vignetteFeatherDefault,
            STUDIO.vignetteFeatherMin,
            STUDIO.vignetteFeatherMax,
            STUDIO.vignetteFeatherStep,
            (e) => (studioState.vignetteFeather = +e.target.value),
          )}
        </section>

        <div class="sa-div"></div>

        <!-- TRANSFORM -->
        <section class="sa-section">
          <h4 class="sa-title">Transformation</h4>
          {@render stSlider(
            "Rotation",
            studioState.rotation,
            0,
            STUDIO.rotationMin,
            STUDIO.rotationMax,
            STUDIO.rotationStep,
            (e) => (studioState.rotation = +e.target.value),
            1,
            "°",
          )}
          <div class="sa-flip-row">
            <button
              class="sa-flip"
              class:active={studioState.flipH}
              onclick={() => {
                studioState.flipH = !studioState.flipH;
                onParamChange();
              }}
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              >
                <line
                  x1="10"
                  y1="2"
                  x2="10"
                  y2="18"
                  stroke-dasharray="2 2"
                  opacity="0.4"
                />
                <polyline points="7,6 3,10 7,14" /><polyline
                  points="13,6 17,10 13,14"
                />
              </svg>
              ↔ H
            </button>
            <button
              class="sa-flip"
              class:active={studioState.flipV}
              onclick={() => {
                studioState.flipV = !studioState.flipV;
                onParamChange();
              }}
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              >
                <line
                  x1="2"
                  y1="10"
                  x2="18"
                  y2="10"
                  stroke-dasharray="2 2"
                  opacity="0.4"
                />
                <polyline points="6,7 10,3 14,7" /><polyline
                  points="6,13 10,17 14,13"
                />
              </svg>
              ↕ V
            </button>
          </div>
          <div class="sa-crop-row">
            <span class="sa-slider-label">Recadrage</span>
            <div class="sa-crop-pills">
              {#each STUDIO.cropRatios as ratio}
                <button
                  class="sa-pill"
                  class:active={studioState.cropRatio === ratio}
                  onclick={() => {
                    studioState.cropRatio = ratio;
                    onParamChange();
                  }}>{cropLabels[ratio]}</button
                >
              {/each}
            </div>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="sa-footer">
        <div class="sa-div"></div>
        <button class="sa-reset-btn" onclick={resetAll}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path
              d="M3 3v5h5"
            />
          </svg>
          Réinitialiser
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .sa-layout {
    position: fixed;
    top: 74px;
    right: 16px;
    z-index: 1000;
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
  }

  .sa-panel.open {
    max-height: 85vh;
    border-radius: 16px;
    border-color: rgba(255, 64, 129, 0.3);
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.6),
      0 0 20px rgba(255, 64, 129, 0.15);
    overflow: visible;
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

  /* Slider row */
  .sa-slider-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    padding-left: 8px; /* space for glow */
  }

  .sa-slider-row.modified .sa-slider-label {
    position: relative;
    color: #ff4081;
    transition: color 0.2s;
  }

  .sa-slider-row.modified .sa-slider-label::before {
    content: "";
    position: absolute;
    left: -10px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #ff4081;
    box-shadow: 0 0 6px #ff4081;
    animation: sa-pulse-glow 2s infinite alternate;
  }

  @keyframes sa-pulse-glow {
    from {
      opacity: 0.7;
      box-shadow: 0 0 2px #ff4081;
    }
    to {
      opacity: 1;
      box-shadow: 0 0 6px #ff4081;
    }
  }

  .sa-slider-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-dim);
    min-width: 58px;
    max-width: 62px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .sa-slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: rgba(255, 64, 129, 0.15);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .sa-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff4081;
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 6px rgba(255, 64, 129, 0.5);
    transition: box-shadow 0.2s;
  }

  .sa-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 12px rgba(255, 64, 129, 0.8);
  }

  .sa-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff4081;
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 6px rgba(255, 64, 129, 0.5);
  }

  .sa-slider-val-wrapper {
    display: flex;
    align-items: center;
    position: relative;
    width: 38px;
    justify-content: flex-end;
    gap: 2px;
  }

  .sa-number-input {
    background: transparent;
    border: none;
    color: #ff4081;
    font-family: var(--font-mono);
    font-size: 10px;
    width: 100%;
    text-align: right;
    padding: 0;
    margin: 0;
    outline: none;
    line-height: 1;
    -moz-appearance: textfield;
    appearance: textfield;
    transition:
      background 0.2s,
      color 0.2s;
  }

  .sa-number-input::-webkit-outer-spin-button,
  .sa-number-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .sa-number-input:focus {
    color: #fff;
    background: rgba(255, 64, 129, 0.2);
    border-radius: 2px;
  }

  .sa-suffix {
    color: #ff4081;
    font-family: var(--font-mono);
    font-size: 10px;
  }

  /* Toggle */
  .sa-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin: 6px 0;
  }

  .sa-toggle input {
    display: none;
  }

  .sa-ttrack {
    position: relative;
    width: 28px;
    height: 14px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    transition: all 0.3s;
    flex-shrink: 0;
  }

  .sa-tthumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-text-dim);
    transition: all 0.3s;
  }

  .sa-toggle input:checked + .sa-ttrack {
    background: rgba(255, 64, 129, 0.2);
    border-color: rgba(255, 64, 129, 0.4);
  }

  .sa-toggle input:checked + .sa-ttrack .sa-tthumb {
    transform: translateX(14px);
    background: #ff4081;
    box-shadow: 0 0 6px rgba(255, 64, 129, 0.5);
  }

  .sa-toggle-label {
    font-size: 11px;
    color: var(--color-text-dim);
  }

  /* Flip buttons */
  .sa-flip-row {
    display: flex;
    gap: 6px;
    margin: 6px 0;
  }

  .sa-flip {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    padding: 7px 10px;
    border: 1px solid rgba(255, 64, 129, 0.15);
    border-radius: var(--radius-sm);
    background: rgba(255, 64, 129, 0.04);
    color: var(--color-text-dim);
    font-family: var(--font-main);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-med);
  }

  .sa-flip svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .sa-flip:hover {
    background: rgba(255, 64, 129, 0.1);
    border-color: rgba(255, 64, 129, 0.3);
    transform: scale(1.02);
  }

  .sa-flip.active {
    background: rgba(255, 64, 129, 0.15);
    border-color: rgba(255, 64, 129, 0.5);
    color: #ff4081;
    box-shadow: 0 0 10px rgba(255, 64, 129, 0.2);
  }

  /* Crop pills */
  .sa-crop-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;
  }

  .sa-crop-pills {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .sa-pill {
    padding: 3px 10px;
    border: 1px solid rgba(255, 64, 129, 0.2);
    border-radius: var(--radius-pill);
    background: rgba(255, 64, 129, 0.04);
    color: var(--color-text-dim);
    font-family: var(--font-main);
    font-size: 10px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .sa-pill:hover {
    border-color: rgba(255, 64, 129, 0.4);
    background: rgba(255, 64, 129, 0.08);
  }

  .sa-pill.active {
    background: #ff4081;
    color: #fff;
    border-color: #ff4081;
    box-shadow: 0 0 8px rgba(255, 64, 129, 0.4);
    font-weight: 600;
  }

  /* Search */
  .sa-search {
    width: 100%;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 64, 129, 0.12);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-family: var(--font-main);
    font-size: 11px;
    outline: none;
    transition: border-color var(--transition-fast);
    margin-bottom: 6px;
  }

  .sa-search:focus {
    border-color: rgba(255, 64, 129, 0.4);
  }

  .sa-search::placeholder {
    color: var(--color-text-dim);
    opacity: 0.5;
  }

  .sa-crater-list {
    max-height: 120px;
    overflow-y: auto;
    scrollbar-width: none;
    margin-bottom: 8px;
  }
  .sa-crater-list::-webkit-scrollbar {
    display: none;
  }

  .sa-crater-empty {
    font-size: 10px;
    color: var(--color-text-dim);
    opacity: 0.4;
    text-align: center;
    padding: 12px 0;
  }

  /* Footer */
  .sa-footer {
    flex-shrink: 0;
  }

  .sa-reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    margin-top: 6px;
    border: 1px solid rgba(255, 64, 129, 0.15);
    border-radius: var(--radius-sm);
    background: rgba(255, 64, 129, 0.04);
    color: var(--color-text-dim);
    font-family: var(--font-main);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    cursor: pointer;
    transition: all var(--transition-med);
  }

  .sa-reset-btn svg {
    width: 14px;
    height: 14px;
  }

  .sa-reset-btn:hover {
    background: rgba(255, 64, 129, 0.1);
    color: #ff4081;
    border-color: rgba(255, 64, 129, 0.3);
    box-shadow: 0 0 12px rgba(255, 64, 129, 0.15);
    transform: scale(1.02);
  }
</style>
