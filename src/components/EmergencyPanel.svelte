<script>
  import { untrack } from "svelte";
  import { uiState } from "@/stores/uiState.svelte.js";
  import { moonState } from "@/stores/moonState.svelte.js";
  import { layerState } from "@/stores/layerState.svelte.js";
  import { viewportState } from "@/stores/viewportState.svelte.js";
  import { EMERGENCY } from "@/engine/config.js";
  import { Transform } from "@/engine/transform.js";
  import { GeoJSON } from "@/engine/geojson.js";
  import { generateTerminator } from "@/engine/ephemeris.js";
  import {
    updateGeoJSONProjection,
    updateCratersProjection,
  } from "@/engine/layerLoader.js";
  import { toggleAnchorMode } from "@/engine/inputHandler.js";

  // Local slider states bound to moonState
  let libLat = $state(moonState.librationLat || 0);
  let libLon = $state(moonState.librationLon || 0);
  let sunLon = $state(moonState.sunLon || 90);
  let rotation = $state(0);
  let barillet = $state(0);
  let refractionSquash = $state(1.0);
  let refractionAngle = $state(0);

  let initialStates = $state({});

  // Sync from moonState when entering emergency mode
  $effect(() => {
    if (uiState.emergencyMode) {
      untrack(() => {
        libLat = moonState.librationLat || 0;
        libLon = moonState.librationLon || 0;
        sunLon = moonState.sunLon || 90;
        const tState = Transform.getState();
        rotation = ((tState.rotation || 0) * 180) / Math.PI;
        barillet = 0; // Barillet starts at 0 relative to current rotation
        refractionSquash = tState.refractionSquash || 1.0;
        refractionAngle = ((tState.zenithAngle || 0) * 180) / Math.PI;

        initialStates = {
          libLat,
          libLon,
          sunLon,
          rotation,
          barillet,
          refractionSquash,
          refractionAngle,
        };
      });
    }
  });

  let pivot = $derived(uiState.pivotAnchor);

  /**
   * Core compensation algorithm:
   * After re-projection, translate the overlay so the pivot crater stays pinned.
   */
  function compensatePivot() {
    const p = uiState.pivotAnchor;
    if (!p) return;

    // 1. Remember where the pivot IS in world space
    const oldWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });

    // 2. Re-project everything with new libration
    updateGeoJSONProjection();
    updateCratersProjection();

    // 3. Get pivot's NEW projected position
    const newProj = GeoJSON.projectPoint(p.geoLon, p.geoLat);
    if (newProj) {
      p.nx = newProj[0];
      p.ny = newProj[1];

      // 4. Compute delta and compensate
      const newWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.translate(oldWorld.x - newWorld.x, oldWorld.y - newWorld.y);
    }

    layerState.layerTransformDirty = true;
    layerState.dirtyEphemeris = true;
  }

  function onLibLatChange(e) {
    libLat = parseFloat(e.target.value);
    moonState.librationLat = libLat;
    compensatePivot();
  }

  function onLibLonChange(e) {
    libLon = parseFloat(e.target.value);
    moonState.librationLon = libLon;
    compensatePivot();
  }

  function onSunLonChange(e) {
    sunLon = parseFloat(e.target.value);
    moonState.sunLon = sunLon;
    generateTerminator(sunLon, 0);
    layerState.dirtyEphemeris = true;
    layerState.layerTransformDirty = true;
  }

  function applyTransformRotation() {
    const totalRotation = ((rotation + barillet) * Math.PI) / 180;
    const p = uiState.pivotAnchor;
    if (p) {
      const oldWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.setRotation(totalRotation);
      const newWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.translate(oldWorld.x - newWorld.x, oldWorld.y - newWorld.y);
    } else {
      Transform.setRotation(totalRotation);
    }
    layerState.layerTransformDirty = true;
  }

  function applyTransformRefraction() {
    const angleRad = (refractionAngle * Math.PI) / 180;
    const p = uiState.pivotAnchor;
    if (p) {
      const oldWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.setRefraction(refractionSquash, angleRad);
      const newWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.translate(oldWorld.x - newWorld.x, oldWorld.y - newWorld.y);
    } else {
      Transform.setRefraction(refractionSquash, angleRad);
    }
    layerState.layerTransformDirty = true;
  }

  function onRotationChange(e) {
    rotation = parseFloat(e.target.value);
    applyTransformRotation();
  }

  function onBarilletChange(e) {
    barillet = parseFloat(e.target.value);
    applyTransformRotation();
  }

  function onRefractionSquashChange(e) {
    refractionSquash = parseFloat(e.target.value);
    applyTransformRefraction();
  }

  function onRefractionAngleChange(e) {
    refractionAngle = parseFloat(e.target.value);
    applyTransformRefraction();
  }

  /**
   * Wheel handler for fine slider control.
   * Normal wheel = 1× step, Shift = 0.1× step (precision mode).
   */
  function wheelSlider(e, getter, setter, step, min, max) {
    e.preventDefault();
    const mult = e.shiftKey ? 0.1 : 1;
    const delta = e.deltaY > 0 ? -step * mult : step * mult;
    const newVal = Math.max(min, Math.min(max, getter() + delta));
    setter(newVal);
  }

  function onLibLatWheel(e) {
    wheelSlider(
      e,
      () => libLat,
      (v) => {
        libLat = v;
        moonState.librationLat = v;
        compensatePivot();
      },
      EMERGENCY.libStep,
      EMERGENCY.libLatMin,
      EMERGENCY.libLatMax,
    );
  }

  function onLibLonWheel(e) {
    wheelSlider(
      e,
      () => libLon,
      (v) => {
        libLon = v;
        moonState.librationLon = v;
        compensatePivot();
      },
      EMERGENCY.libStep,
      EMERGENCY.libLonMin,
      EMERGENCY.libLonMax,
    );
  }

  function onRotationWheel(e) {
    wheelSlider(
      e,
      () => rotation,
      (v) => {
        rotation = v;
        applyTransformRotation();
      },
      EMERGENCY.rotationStep,
      EMERGENCY.rotationMin,
      EMERGENCY.rotationMax,
    );
  }

  function onBarilletWheel(e) {
    wheelSlider(
      e,
      () => barillet,
      (v) => {
        barillet = v;
        applyTransformRotation();
      },
      EMERGENCY.rotationStep,
      EMERGENCY.rotationMin,
      EMERGENCY.rotationMax,
    );
  }

  function onRefractionSquashWheel(e) {
    wheelSlider(
      e,
      () => refractionSquash,
      (v) => {
        refractionSquash = v;
        applyTransformRefraction();
      },
      EMERGENCY.refractionSquashStep,
      EMERGENCY.refractionSquashMin,
      EMERGENCY.refractionSquashMax,
    );
  }

  function onRefractionAngleWheel(e) {
    wheelSlider(
      e,
      () => refractionAngle,
      (v) => {
        refractionAngle = v;
        applyTransformRefraction();
      },
      EMERGENCY.refractionAngleStep,
      EMERGENCY.refractionAngleMin,
      EMERGENCY.refractionAngleMax,
    );
  }

  function onSunLonWheel(e) {
    wheelSlider(
      e,
      () => sunLon,
      (v) => {
        sunLon = v;
        moonState.sunLon = v;
        generateTerminator(v, 0);
        layerState.dirtyEphemeris = true;
        layerState.layerTransformDirty = true;
      },
      EMERGENCY.sunLonStep,
      EMERGENCY.sunLonMin,
      EMERGENCY.sunLonMax,
    );
  }

  // Flip state — read from Transform
  let flipH = $derived.by(() => {
    // Track transform changes via layerTransformDirty
    const _t = layerState.layerTransformDirty;
    return Transform.getState().flipH;
  });
  let flipV = $derived.by(() => {
    const _t = layerState.layerTransformDirty;
    return Transform.getState().flipV;
  });

  function toggleFlipH() {
    const p = uiState.pivotAnchor;
    if (p) {
      const oldWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.toggleFlipH();
      const newWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.translate(oldWorld.x - newWorld.x, oldWorld.y - newWorld.y);
    } else {
      Transform.toggleFlipH();
    }
    layerState.layerTransformDirty = true;
  }

  function toggleFlipV() {
    const p = uiState.pivotAnchor;
    if (p) {
      const oldWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.toggleFlipV();
      const newWorld = Transform.apply(p.nx, p.ny, { x: 0, y: 0 });
      Transform.translate(oldWorld.x - newWorld.x, oldWorld.y - newWorld.y);
    } else {
      Transform.toggleFlipV();
    }
    layerState.layerTransformDirty = true;
  }

  function placePivot() {
    if (viewportState.mode !== "anchor") {
      toggleAnchorMode();
    }
  }

  function removePivot() {
    uiState.pivotAnchor = null;
    layerState.layerTransformDirty = true;
  }

  function validateAndExit() {
    // KEEP current values — user validated the manual alignment
    uiState.emergencyMode = false;
    uiState.emergencyValidated = true;
    uiState.pivotAnchor = null;
    updateGeoJSONProjection();
    updateCratersProjection();
    generateTerminator(moonState.sunLon, 0);
    layerState.dirtyEphemeris = true;
    layerState.layerTransformDirty = true;
    if (viewportState.mode === "anchor") toggleAnchorMode();
  }

  function cancelAndExit() {
    // Revert to the snapshot taken when opening the panel
    moonState.librationLat = initialStates.libLat;
    moonState.librationLon = initialStates.libLon;
    moonState.sunLon = initialStates.sunLon;

    Transform.setRotation((initialStates.rotation * Math.PI) / 180);
    Transform.setRefraction(
      initialStates.refractionSquash,
      (initialStates.refractionAngle * Math.PI) / 180,
    );

    uiState.emergencyMode = false;
    uiState.pivotAnchor = null;

    updateGeoJSONProjection();
    updateCratersProjection();
    generateTerminator(moonState.sunLon, 0);
    layerState.dirtyEphemeris = true;
    layerState.layerTransformDirty = true;
    if (viewportState.mode === "anchor") toggleAnchorMode();
  }
</script>

{#snippet emSlider(
  label,
  value,
  initialValue,
  min,
  max,
  step,
  onChange,
  onWheel,
  isSun = false,
  fixed = 1,
  suffix = "°",
)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="slider-row"
    class:modified={value !== initialValue}
    onwheel={onWheel}
    ondblclick={() => onChange({ target: { value: initialValue } })}
    title="Double-clic pour réinitialiser"
  >
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label>{label}</label>
    <input
      type="range"
      {min}
      {max}
      {step}
      {value}
      oninput={onChange}
      class="em-slider"
      class:em-slider-sun={isSun}
    />
    <div class="slider-val-wrapper">
      <input
        type="number"
        {min}
        {max}
        {step}
        value={Number(value).toFixed(fixed)}
        onchange={onChange}
        class="em-number-input"
      />
      {#if suffix}<span class="suffix">{suffix}</span>{/if}
    </div>
  </div>
{/snippet}

{#if uiState.emergencyMode}
  <aside id="emergency-panel">
    <header class="em-header">
      <div class="em-header-left">
        <svg class="em-icon" viewBox="0 0 20 20" fill="currentColor">
          <path
            d="M10 1L19 18H1L10 1Z"
            stroke="currentColor"
            stroke-width="1"
            fill="none"
          />
          <text
            x="10"
            y="15"
            text-anchor="middle"
            font-size="10"
            font-weight="bold"
            fill="currentColor">!</text
          >
        </svg>
        <h3>Mode Urgence</h3>
      </div>
      <span class="em-badge">MANUAL</span>
    </header>

    <!-- Libration Sliders -->
    <section class="em-section">
      <h4 class="em-section-title">Libration</h4>
      {@render emSlider(
        "Lat",
        libLat,
        initialStates.libLat,
        EMERGENCY.libLatMin,
        EMERGENCY.libLatMax,
        EMERGENCY.libStep,
        onLibLatChange,
        onLibLatWheel,
      )}
      {@render emSlider(
        "Lon",
        libLon,
        initialStates.libLon,
        EMERGENCY.libLonMin,
        EMERGENCY.libLonMax,
        EMERGENCY.libStep,
        onLibLonChange,
        onLibLonWheel,
      )}
    </section>

    <p class="em-hint">Molette — Shift + Molette précis</p>

    <!-- Rotation & Barillet Sliders -->
    <section class="em-section">
      <h4 class="em-section-title">Rotation</h4>
      {@render emSlider(
        "PA",
        rotation,
        initialStates.rotation,
        EMERGENCY.rotationMin,
        EMERGENCY.rotationMax,
        EMERGENCY.rotationStep,
        onRotationChange,
        onRotationWheel,
      )}
      {@render emSlider(
        "Barillet",
        barillet,
        initialStates.barillet,
        EMERGENCY.rotationMin,
        EMERGENCY.rotationMax,
        EMERGENCY.rotationStep,
        onBarilletChange,
        onBarilletWheel,
      )}
    </section>

    <!-- Refraction Sliders -->
    <section class="em-section">
      <h4 class="em-section-title">Réfraction Atmosphérique</h4>
      {@render emSlider(
        "Indice",
        refractionSquash,
        initialStates.refractionSquash,
        EMERGENCY.refractionSquashMin,
        EMERGENCY.refractionSquashMax,
        EMERGENCY.refractionSquashStep,
        onRefractionSquashChange,
        onRefractionSquashWheel,
        false,
        3,
        "",
      )}
      {@render emSlider(
        "Angle Z",
        refractionAngle,
        initialStates.refractionAngle,
        EMERGENCY.refractionAngleMin,
        EMERGENCY.refractionAngleMax,
        EMERGENCY.refractionAngleStep,
        onRefractionAngleChange,
        onRefractionAngleWheel,
      )}
    </section>

    <!-- Flip Buttons -->
    <section class="em-section">
      <h4 class="em-section-title">Miroir</h4>
      <div class="flip-row">
        <button class="flip-btn" class:active={flipH} onclick={toggleFlipH}>
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
            <polyline points="7,6 3,10 7,14" />
            <polyline points="13,6 17,10 13,14" />
          </svg>
          ↔ Gauche / Droite
        </button>
        <button class="flip-btn" class:active={flipV} onclick={toggleFlipV}>
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
            <polyline points="6,7 10,3 14,7" />
            <polyline points="6,13 10,17 14,13" />
          </svg>
          ↕ Haut / Bas
        </button>
      </div>
    </section>

    <!-- Terminator Slider -->
    <section class="em-section">
      <h4 class="em-section-title">Terminateur</h4>
      {@render emSlider(
        "☀",
        sunLon,
        initialStates.sunLon,
        EMERGENCY.sunLonMin,
        EMERGENCY.sunLonMax,
        EMERGENCY.sunLonStep,
        onSunLonChange,
        onSunLonWheel,
        true,
        0,
      )}
    </section>

    <!-- Pivot Anchor -->
    <section class="em-section em-section-pivot">
      <h4 class="em-section-title">Ancre Pivot</h4>
      {#if pivot}
        <div class="pivot-info">
          <svg class="pivot-diamond" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2L14 8L8 14L2 8Z"
              fill="#FF8C00"
              stroke="white"
              stroke-width="1"
            />
          </svg>
          <span class="pivot-name">{pivot.name || "Point inconnu"}</span>
        </div>
        <div class="pivot-coords">
          Lat: {pivot.geoLat.toFixed(2)}° | Lon: {pivot.geoLon.toFixed(2)}°
        </div>
        <button class="em-btn em-btn-remove" onclick={removePivot}
          >Supprimer Pivot</button
        >
      {:else}
        <p class="pivot-hint">
          Activez le mode ancrage (A) puis cliquez sur un cratère
          reconnaissable.
        </p>
        <button class="em-btn em-btn-place" onclick={placePivot}>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="8" cy="8" r="5" />
            <line x1="8" y1="1" x2="8" y2="5" />
            <line x1="8" y1="11" x2="8" y2="15" />
            <line x1="1" y1="8" x2="5" y2="8" />
            <line x1="11" y1="8" x2="15" y2="8" />
          </svg>
          Placer Pivot
        </button>
      {/if}
    </section>

    <!-- Validate & Exit -->
    <div class="em-action-row">
      <button
        class="em-btn em-btn-cancel"
        onclick={cancelAndExit}
        title="Annuler les ajustements en cours"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Quitter
      </button>
      <button class="em-btn em-btn-validate" onclick={validateAndExit}>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <polyline points="3,8 7,12 13,4" />
        </svg>
        Valider
      </button>
    </div>
  </aside>
{/if}

<style>
  #emergency-panel {
    position: fixed;
    top: 74px;
    left: 16px;
    width: 240px;
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    background: rgba(20, 14, 8, 0.85);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid rgba(255, 140, 0, 0.25);
    border-radius: var(--radius-lg);
    box-shadow:
      var(--shadow-card),
      0 0 20px rgba(255, 140, 0, 0.12),
      0 0 6px rgba(255, 140, 0, 0.08);
    z-index: 91;
    padding: 14px;
    animation: slide-in-left 0.3s var(--transition-slow);
  }

  .em-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 140, 0, 0.2);
  }

  .em-header-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .em-icon {
    width: 16px;
    height: 16px;
    color: #ff8c00;
    filter: drop-shadow(0 0 4px rgba(255, 140, 0, 0.6));
  }

  .em-header h3 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #ff8c00;
    margin: 0;
  }

  .em-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    color: #1a1a1a;
    background: #ff8c00;
    padding: 2px 6px;
    border-radius: var(--radius-pill);
    animation: pulse-glow-orange 2s ease-in-out infinite;
  }

  @keyframes pulse-glow-orange {
    0%,
    100% {
      box-shadow: 0 0 4px rgba(255, 140, 0, 0.4);
    }
    50% {
      box-shadow: 0 0 12px rgba(255, 140, 0, 0.8);
    }
  }

  .em-section {
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 140, 0, 0.08);
  }

  .em-section:last-of-type {
    border-bottom: none;
    margin-bottom: 8px;
  }

  .em-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 140, 0, 0.7);
    margin-bottom: 8px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .slider-row label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-dim);
    min-width: 28px;
    text-align: right;
  }

  .em-slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: rgba(255, 140, 0, 0.15);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .em-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff8c00;
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 6px rgba(255, 140, 0, 0.5);
    transition: box-shadow 0.2s;
  }

  .em-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 0 12px rgba(255, 140, 0, 0.8);
    transform: scale(1.1);
  }

  .em-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff8c00;
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 0 6px rgba(255, 140, 0, 0.5);
  }

  .em-slider-sun::-webkit-slider-thumb {
    background: #ffd700;
    box-shadow: 0 0 6px rgba(255, 215, 0, 0.5);
  }

  .em-slider-sun {
    background: rgba(255, 215, 0, 0.12);
  }

  .slider-val-wrapper {
    display: flex;
    align-items: center;
    position: relative;
    width: 48px;
    justify-content: flex-end;
    gap: 2px;
  }

  .em-number-input {
    background: transparent;
    border: none;
    color: #ff8c00;
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

  .em-slider-sun + .slider-val-wrapper .em-number-input,
  .em-slider-sun + .slider-val-wrapper .suffix {
    color: #ffd700;
  }

  .em-number-input::-webkit-outer-spin-button,
  .em-number-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .em-number-input:focus {
    color: #fff;
    background: rgba(255, 140, 0, 0.2);
    border-radius: 2px;
  }

  .suffix {
    color: #ff8c00;
    font-family: var(--font-mono);
    font-size: 10px;
  }

  .slider-row.modified label {
    position: relative;
    color: #ff8c00;
    transition: color 0.2s;
  }

  .slider-row.modified label::before {
    content: "";
    position: absolute;
    left: -10px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #ff8c00;
    box-shadow: 0 0 6px #ff8c00;
    animation: pulse-glow 2s infinite alternate;
  }

  @keyframes pulse-glow {
    from {
      opacity: 0.7;
      box-shadow: 0 0 2px #ff8c00;
    }
    to {
      opacity: 1;
      box-shadow: 0 0 6px #ff8c00;
    }
  }

  .em-section-pivot {
    background: rgba(255, 140, 0, 0.04);
    border-radius: var(--radius-sm);
    padding: 10px;
    border: 1px solid rgba(255, 140, 0, 0.1);
  }

  .pivot-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .pivot-diamond {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    filter: drop-shadow(0 0 4px rgba(255, 140, 0, 0.6));
  }

  .pivot-name {
    font-family: var(--font-main);
    font-size: 13px;
    font-weight: 600;
    color: #ff8c00;
    letter-spacing: 0.3px;
  }

  .pivot-coords {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-dim);
    margin-bottom: 8px;
    margin-left: 24px;
  }

  .pivot-hint {
    font-size: 11px;
    color: var(--color-text-dim);
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .em-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-main);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    cursor: pointer;
    transition: all var(--transition-med);
  }

  .em-btn svg {
    width: 14px;
    height: 14px;
  }

  .em-btn-place {
    background: rgba(255, 140, 0, 0.12);
    color: #ff8c00;
    border: 1px solid rgba(255, 140, 0, 0.25);
  }

  .em-btn-place:hover {
    background: rgba(255, 140, 0, 0.2);
    box-shadow: 0 0 12px rgba(255, 140, 0, 0.3);
    transform: scale(1.02);
  }

  .em-btn-remove {
    background: rgba(255, 59, 92, 0.1);
    color: var(--color-danger);
    border: 1px solid rgba(255, 59, 92, 0.2);
    margin-top: 4px;
  }

  .em-btn-remove:hover {
    background: rgba(255, 59, 92, 0.2);
    box-shadow: 0 0 12px rgba(255, 59, 92, 0.3);
  }

  .em-action-row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .em-btn-cancel {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-dim);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .em-btn-cancel:hover {
    background: rgba(255, 59, 92, 0.1);
    color: var(--color-danger);
    border-color: rgba(255, 59, 92, 0.3);
    box-shadow: 0 0 12px rgba(255, 59, 92, 0.2);
  }

  .em-btn-validate {
    flex: 1;
    background: rgba(0, 255, 136, 0.08);
    color: #00ff88;
    border: 1px solid rgba(0, 255, 136, 0.25);
    font-size: 11px;
  }

  .em-btn-validate:hover {
    background: rgba(0, 255, 136, 0.15);
    border-color: rgba(0, 255, 136, 0.5);
    box-shadow: 0 0 14px rgba(0, 255, 136, 0.2);
    transform: scale(1.02);
  }

  .em-hint {
    font-size: 9px;
    color: rgba(255, 140, 0, 0.35);
    text-align: center;
    margin: 0 0 8px 0;
    letter-spacing: 0.5px;
  }

  /* Flip Buttons */
  .flip-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .flip-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border: 1px solid rgba(255, 140, 0, 0.15);
    border-radius: var(--radius-sm);
    background: rgba(255, 140, 0, 0.04);
    color: var(--color-text-dim);
    font-family: var(--font-main);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-med);
  }

  .flip-btn svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .flip-btn:hover {
    background: rgba(255, 140, 0, 0.1);
    border-color: rgba(255, 140, 0, 0.3);
    color: #ff8c00;
  }

  .flip-btn.active {
    background: rgba(255, 140, 0, 0.15);
    border-color: rgba(255, 140, 0, 0.4);
    color: #ff8c00;
    box-shadow:
      0 0 10px rgba(255, 140, 0, 0.2),
      inset 0 0 8px rgba(255, 140, 0, 0.05);
  }
</style>
