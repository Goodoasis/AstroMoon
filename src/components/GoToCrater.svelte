<script>
  /**
   * GoToCrater — Autocomplete search to navigate to a lunar crater.
   * 
   * Searches the in-memory cratersDB, computes the Transform.scale so
   * the crater fills the viewport at the correct optical size, then
   * translates the Transform to center the crater on screen.
   * 
   * IMPORTANT: This adjusts Transform (the vector/overlay layer),
   * NOT viewportState (the global pan/zoom).
   */

  import { layerState } from '@/stores/layerState.svelte.js';
  import { viewportState } from '@/stores/viewportState.svelte.js';
  import { equipmentState } from '@/stores/equipmentState.svelte.js';
  import { Transform } from '@/engine/transform.js';
  import { GeoJSON } from '@/engine/geojson.js';
  import { PixiRenderer } from '@/engine/pixi_renderer.js';
  import { GOTO } from '@/engine/config.js';
  import { AstroTime, Equator, Body } from '@/engine/astronomy.js';
  import { temporalState } from '@/stores/temporalState.svelte.js';
  import { spatialState } from '@/stores/spatialState.svelte.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let query = $state('');
  let isOpen = $state(false);
  let highlightIdx = $state(-1);
  let inputRef = $state(null);
  let dropdownRef = $state(null);
  let wrapperRef = $state(null);

  // Filter craters by query — substring match, case-insensitive
  let filtered = $derived.by(() => {
    if (!layerState.cratersDB || layerState.cratersDB.length === 0) return [];
    if (!query || query.length < GOTO.searchMinChars) return [];
    const q = query.toLowerCase();
    const results = [];
    for (const crater of layerState.cratersDB) {
      if (crater.name === '--') continue;
      if (crater.name.toLowerCase().includes(q)) {
        results.push(crater);
        if (results.length >= GOTO.searchMaxResults) break;
      }
    }
    return results;
  });

  /**
   * Portal action — teleport dropdown to document.body to escape overflow.
   */
  function portal(node) {
    document.body.appendChild(node);
    positionDropdown(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

  function positionDropdown(node) {
    if (!wrapperRef || !node) return;
    const rect = wrapperRef.getBoundingClientRect();
    // Position to the left of the panel to avoid going offscreen
    node.style.top = `${rect.bottom + 6}px`;
    node.style.right = `${window.innerWidth - rect.right}px`;
    node.style.left = 'auto';
    node.style.width = `${Math.max(rect.width, 240)}px`;
  }

  function handleFocus() {
    query = '';
    isOpen = true;
    highlightIdx = -1;
  }

  function handleBlur() {
    setTimeout(() => {
      if (dropdownRef && dropdownRef.contains(document.activeElement)) return;
      isOpen = false;
    }, 200);
  }

  function handleInput(e) {
    query = e.target.value;
    isOpen = true;
    highlightIdx = -1;
  }

  function handleKeydown(e) {
    if (!isOpen || filtered.length === 0) {
      if (e.key === 'ArrowDown') {
        isOpen = true;
        highlightIdx = -1;
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightIdx = (highlightIdx + 1) % filtered.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIdx = highlightIdx <= 0 ? filtered.length - 1 : highlightIdx - 1;
    } else if (e.key === 'Enter' && highlightIdx >= 0 && filtered[highlightIdx]) {
      e.preventDefault();
      selectCrater(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      isOpen = false;
      query = '';
      inputRef?.blur();
    }
  }

  /**
   * Compute Transform.scale and translate to center the crater.
   * 
   * Pipeline:
   *   1. Project crater (lon, lat) → normalized (nx, ny) via orthographic
   *   2. Compute target Transform.scale so crater fills GOTO.fillFactor of screen
   *   3. Update Transform state
   *   4. Compute world position of crater and translate to center it on screen
   *   5. Mark dirty for rebuild
   */
  function selectCrater(crater) {
    isOpen = false;
    query = '';
    highlightIdx = -1;

    // 1. Project crater position to normalized [0,1] coords
    const proj = GeoJSON.projectPoint(crater.longitude, crater.latitude);
    if (!proj) {
      dispatch('toast', `${crater.name} n'est pas visible (face cachée)`);
      return;
    }
    const [nx, ny] = proj;

    // 2. Compute Moon distance at target time/location
    const distKm = computeMoonDistance();

    // 3. Compute target Transform.scale
    const targetScale = computeLayerScale(crater.diameter, distKm);

    // 4. Apply the new scale to Transform
    const tState = Transform.getState();
    Transform.setState({
      ...tState,
      scale: targetScale
    });

    // 4. Center the crater on screen
    //    After setState, Transform.apply(nx, ny) gives world coords.
    //    Screen position = worldPos * vpScale + vpTx
    //    We want screen center = (canvasW/2, canvasH/2)
    //    ⇒ translate by delta in world space
    const world = Transform.apply(nx, ny, { x: 0, y: 0 });
    const screenX = world.x * viewportState.scale + viewportState.tx;
    const screenY = world.y * viewportState.scale + viewportState.ty;
    const centerX = viewportState.canvasW / 2;
    const centerY = viewportState.canvasH / 2;

    // Delta in Transform's own coordinate space
    // A shift of dtx in Transform.tx shifts world output by dtx,
    // which shifts screen output by dtx * vpScale.
    const dtx = (centerX - screenX) / viewportState.scale;
    const dty = (centerY - screenY) / viewportState.scale;
    Transform.translate(dtx, dty);

    // 5. Mark dirty for full rebuild
    layerState.layerTransformDirty = true;
    layerState.dirtyGrid = true;

    // 6. Toast with debug info
    const info = computeDebugInfo(crater.diameter);
    dispatch('toast', `🎯 ${crater.name} — Ø${crater.diameter.toFixed(1)} km${info}`);
  }

  /**
   * Compute the Transform.scale so the overlay crater matches
   * the crater's EXACT pixel size on the user's photo.
   */
  function computeLayerScale(craterDiameterKm, distKm) {
    const tState = Transform.getState();
    const vpScale = viewportState.scale;
    const fractionOfDisc = craterDiameterKm / GOTO.lunarDiamKm;

    // --- Try equipment-based pixel-accurate matching ---
    const focalEff = equipmentState.effectiveFocal;  // mm
    const pixelSize = equipmentState.pixelSize;       // µm
    const bgSize = PixiRenderer.getBackgroundDisplaySize();

    if (focalEff > 0 && pixelSize > 0 && bgSize && viewportState.backgroundImage) {
      // 1. Taille angulaire du cratère (radians) avec la distance RÉELLE
      const thetaRad = 2 * Math.atan(craterDiameterKm / (2 * distKm));

      // 2. Taille du cratère en pixels "capteur" réels
      const craterSensorPx = (thetaRad * focalEff * 1000) / pixelSize;

      // 3. Largeur réelle de l'image source en pixels
      const sourceImageWidth = viewportState.backgroundImage.naturalWidth;

      // 4. Largeur affichée de la photo sur le canvas
      const drawW = bgSize.width;

      // 5. Calcul de Transform.scale
      const tScale = (craterSensorPx * drawW) / (sourceImageWidth * fractionOfDisc * tState.layerSize);

      return Math.max(GOTO.minZoom, Math.min(GOTO.maxZoom, tScale));
    }

    // --- Fallback: geometric fill ---
    const canvasW = viewportState.canvasW;
    const targetScreenPx = canvasW * GOTO.fillFactor;
    const tScale = targetScreenPx / (vpScale * tState.layerSize * fractionOfDisc);
    return Math.max(GOTO.minZoom, Math.min(GOTO.maxZoom, tScale));
  }

  /**
   * Use Astronomy.js to get the geocentric distance to the moon in km.
   */
  function computeMoonDistance() {
    try {
      const date = temporalState.time || new Date();
      const time = new AstroTime(date);
      // Equator returns geometric and topocentric coords. 
      // dist is the distance in Astronomical Units (AU).
      const pos = Equator(Body.Moon, time, { 
        lat: spatialState.lat || 0, 
        lon: spatialState.lon || 0, 
        height: 0 
      });
      return pos.dist * 149597870.7; // AU to km
    } catch (e) {
      console.warn("Astronomy distance failed, using mean:", e);
      return GOTO.lunarDistKm; // Fallback 384400
    }
  }

  /**
   * Compute debug info string for the toast (pixel size if equipment available)
   */
  function computeDebugInfo(craterDiameterKm) {
    const focalEff = equipmentState.effectiveFocal;
    const pixelSize = equipmentState.pixelSize;
    if (focalEff > 0 && pixelSize > 0) {
      const distKm = computeMoonDistance();
      const thetaRad = 2 * Math.atan(craterDiameterKm / (2 * distKm));
      const craterSensorPx = (thetaRad * focalEff * 1000) / pixelSize;
      return ` (${Math.round(craterSensorPx)}px sur capteur, D=${Math.round(distKm)}km)`;
    }
    return '';
  }

  /**
   * Format coordinates for display
   */
  function formatCoords(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(1)}°${latDir} ${Math.abs(lon).toFixed(1)}°${lonDir}`;
  }
</script>

<div class="goto-section" bind:this={wrapperRef}>
  <div class="goto-header">
    <h3 class="goto-title">
      Aller à un cratère
      <span class="info-icon" data-tooltip="Localise un cratère et ajuste le zoom à l'échelle optique attendue.">?</span>
    </h3>
  </div>
  <div class="goto-input-group">
    <span class="goto-icon-input">⌕</span>
    <input
      bind:this={inputRef}
      type="text"
      class="goto-input"
      placeholder="Rechercher un cratère…"
      value={query}
      onfocus={handleFocus}
      onblur={handleBlur}
      oninput={handleInput}
      onkeydown={handleKeydown}
      autocomplete="off"
      id="goto-crater-search"
    />
  </div>

  {#if isOpen && filtered.length > 0}
    <div class="goto-dropdown" bind:this={dropdownRef} use:portal>
      <div class="goto-scroll">
        {#each filtered as crater, i}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="goto-item"
            class:highlighted={highlightIdx === i}
            onclick={() => selectCrater(crater)}
            onmouseenter={() => highlightIdx = i}
          >
            <div class="goto-item-main">
              <span class="goto-item-name">{crater.name}</span>
              <span class="goto-item-diam">Ø {crater.diameter.toFixed(1)} km</span>
            </div>
            <div class="goto-item-coords">{formatCoords(crater.latitude, crater.longitude)}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .goto-section {
    position: relative;
    padding-top: 4px;
  }

  .goto-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-pink, #FF4081);
    margin-bottom: 10px;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 8px;
  }


  .goto-input-group {
    position: relative;
    display: flex;
    align-items: center;
  }

  .goto-icon-input {
    position: absolute;
    left: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.15);
    pointer-events: none;
    z-index: 1;
  }

  .goto-input {
    width: 100%;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 64, 129, 0.12);
    border-radius: 8px;
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 500;
    padding: 8px 10px 8px 28px;
    outline: none;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-sizing: border-box;
  }

  .goto-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
    font-style: italic;
  }

  .goto-input:focus {
    border-color: rgba(255, 64, 129, 0.4);
    box-shadow: 0 0 14px rgba(255, 64, 129, 0.1), inset 0 0 6px rgba(255, 64, 129, 0.03);
    background: rgba(0, 0, 0, 0.5);
  }

  /* Dropdown — portaled to body, must be :global */
  :global(.goto-dropdown) {
    position: fixed;
    z-index: 9999;
    background: rgba(10, 11, 16, 0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 64, 129, 0.18);
    border-radius: 12px;
    box-shadow: 
      0 12px 40px rgba(0, 0, 0, 0.7),
      0 0 1px rgba(255, 64, 129, 0.3),
      0 0 20px rgba(255, 64, 129, 0.06);
    overflow: hidden;
    animation: gotoDropIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes -global-gotoDropIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  :global(.goto-scroll) {
    max-height: 260px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 64, 129, 0.15) transparent;
  }

  :global(.goto-scroll::-webkit-scrollbar) {
    width: 4px;
  }

  :global(.goto-scroll::-webkit-scrollbar-thumb) {
    background: rgba(255, 64, 129, 0.2);
    border-radius: 4px;
  }

  :global(.goto-item) {
    padding: 9px 14px;
    cursor: pointer;
    transition: all 0.15s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    border-left: 2px solid transparent;
  }

  :global(.goto-item:last-child) {
    border-bottom: none;
  }

  :global(.goto-item:hover),
  :global(.goto-item.highlighted) {
    background: rgba(255, 64, 129, 0.07);
  }

  :global(.goto-item.highlighted) {
    border-left-color: #FF4081;
  }

  :global(.goto-item-main) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  :global(.goto-item-name) {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.3px;
  }

  :global(.goto-item.highlighted .goto-item-name) {
    color: #FF4081;
  }

  :global(.goto-item-diam) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    color: #FF4081;
    background: rgba(255, 64, 129, 0.08);
    padding: 2px 7px;
    border-radius: 6px;
    white-space: nowrap;
    letter-spacing: 0.4px;
  }

  :global(.goto-item-coords) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.28);
    margin-top: 2px;
    letter-spacing: 0.3px;
  }
</style>
