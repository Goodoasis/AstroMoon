<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { viewportState } from '@/stores/viewportState.svelte.js';
  import { temporalState } from '@/stores/temporalState.svelte.js';
  import { spatialState } from '@/stores/spatialState.svelte.js';
  import { equipmentState } from '@/stores/equipmentState.svelte.js';
  import { PERF } from '@/engine/config.js';
  import { uiState } from '@/stores/uiState.svelte.js';
  import { moonState } from '@/stores/moonState.svelte.js';
  import { Transform } from '@/engine/transform.js';
  import EquipmentSearch from './EquipmentSearch.svelte';
  import GoToCrater from './GoToCrater.svelte';
  import { tooltip } from '@/actions/tooltip.js';

  const dispatch = createEventDispatcher();

  // --- STATE ---
  let isOpen = $state(true); // Open by default
  let hasAutoCollapsed = $state(false);
  let hoverTimer = null;

  /** True when Monture/Temps/Localisation should be locked (during or after emergency) */
  let isEmergencyLocked = $derived(uiState.emergencyMode || uiState.emergencyValidated);
  let predictionsList = $state([]);
  let showPredictions = $state(false);
  let searchDebounceTimer = null;
  let panelRef = $state(null);
  let scrollContainerRef = $state(null);

  // --- EQUIPMENT DATABASE ---
  let telescopeDb = $state([]);
  let cameraDb = $state([]);
  let barlowDb = $state([]);
  let eqDbLoaded = $state(false);

  onMount(async () => {
    try {
      const [t, c, b] = await Promise.all([
        fetch('/data/equipment/telescopes.json').then(r => r.json()),
        fetch('/data/equipment/cameras.json').then(r => r.json()),
        fetch('/data/equipment/barlows.json').then(r => r.json()),
      ]);
      telescopeDb = t;
      cameraDb = c;
      barlowDb = b;
      eqDbLoaded = true;
    } catch (e) {
      console.warn('Equipment DB load failed:', e);
    }
  });

  // (Moved to stores for persistence)

  // --- PER-SECTION VERIFIED FLAGS ---
  let isMountVerified = $derived(viewportState.isMountVerified);

  let isTimeVerified = $derived(
    temporalState.source === 'exif' || 
    temporalState.source === 'name' || 
    (temporalState.source === 'manual' && temporalState.timeVerified)
  );

  let isLocationVerified = $derived(
    spatialState.source === 'geoloc' || 
    spatialState.source === 'exif-loc' || 
    (spatialState.source === 'ville' && spatialState.cityVerified && spatialState.lat !== 0)
  );

  let isEquipmentVerified = $derived(
    equipmentState.focalVerified && 
    equipmentState.pixelVerified && 
    equipmentState.multiplierVerified && 
    equipmentState.sensorVerified
  );

  // --- AUTO-COLLAPSE LOGIC (DISABLED for now) ---
  /*
  let isComplete = $derived(
    isMountVerified && 
    isTimeVerified && 
    isLocationVerified && 
    isEquipmentVerified
  );

  $effect(() => {
    if (isComplete && !hasAutoCollapsed && isOpen) {
      setTimeout(() => {
        if (isComplete && isOpen) {
          isOpen = false;
          hasAutoCollapsed = true;
        }
      }, 1800);
    }
  });
  */

  // --- INTERACTION ---
  function open() {
    clearTimeout(hoverTimer);
    isOpen = true;
  }

  function close() {
    clearTimeout(hoverTimer);
    isOpen = false;
    showPredictions = false;
  }

  function handleMouseEnter() {
    // Keep "long hover" to open if it was closed
    hoverTimer = setTimeout(() => {
      isOpen = true;
    }, 600);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimer);
    // REMOVED auto-close on leave as requested (manual or auto-collapse only)
  }

  function toggleOpen() {
    isOpen = !isOpen;
    if (!isOpen) showPredictions = false;
    if (isOpen) hasAutoCollapsed = true; // Stop auto-collapsing if manual re-opened
  }

  // --- MOUNT LOGIC ---
  function toggleMount(val) {
    if (val !== undefined) {
      viewportState.isAltAzMode = val;
    } else {
      viewportState.isAltAzMode = !viewportState.isAltAzMode;
    }
    viewportState.isMountVerified = true;
    dispatch('ephemerisUpdate');
  }

  // --- TIME LOGIC ---
  function formatForDatetimeLocal(date) {
    if (!date || isNaN(date.getTime())) return '';
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function setTimeSource(src) {
    if (src === 'name' && !temporalState.parsedNameDate) return;
    if (src === 'exif' && !temporalState.parsedExifDate) return;

    temporalState.source = src;
    if (src === 'manual') {
      temporalState.time = temporalState.userManualDate;
    } else if (src === 'name' && temporalState.parsedNameDate) {
      temporalState.time = temporalState.parsedNameDate;
    } else if (src === 'exif' && temporalState.parsedExifDate) {
      temporalState.time = temporalState.parsedExifDate;
    }
    dispatch('ephemerisUpdate');
  }

  function handleTimeChange(e) {
    if (temporalState.source === 'manual') {
      temporalState.timeVerified = true;
      temporalState.userManualDate = new Date(e.target.value);
      temporalState.time = temporalState.userManualDate;
      dispatch('ephemerisUpdate');
    }
  }

  let timeDisplayValue = $derived(formatForDatetimeLocal(temporalState.time));

  // --- LOCATION LOGIC ---
  let cachedGeolocCity = null;
  let cachedExifCity = null;

  async function resolveCityName(lat, lon, isExif = false) {
    if (isExif && cachedExifCity) { spatialState.city = cachedExifCity; return; }
    if (!isExif && cachedGeolocCity) { spatialState.city = cachedGeolocCity; return; }
    
    try {
      spatialState.city = '...';
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
      const data = await res.json();
      const name = data && data.display_name ? data.display_name.split(',').slice(0, 3).join(',') : (isExif ? "Localisation Exif" : "Position GPS");
      
      if (isExif) cachedExifCity = name;
      else cachedGeolocCity = name;

      if (spatialState.source === (isExif ? 'exif-loc' : 'geoloc')) {
        spatialState.city = name;
      }
    } catch (e) {
      spatialState.city = isExif ? "Localisation Exif" : "Position GPS";
    }
  }

  function setLocSource(src) {
    spatialState.source = src;
    if (src === 'ville') {
      spatialState.lat = spatialState.userManualLocation.lat;
      spatialState.lon = spatialState.userManualLocation.lon;
      spatialState.city = spatialState.userManualLocation.name || '';
    } else if (src === 'geoloc') {
      if (!spatialState.geolocGps) {
        spatialState.city = 'GPS...';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            spatialState.geolocGps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            spatialState.lat = spatialState.geolocGps.lat;
            spatialState.lon = spatialState.geolocGps.lon;
            dispatch('ephemerisUpdate');
            resolveCityName(spatialState.lat, spatialState.lon, false);
          },
          () => { setLocSource(spatialState.parsedExifGps ? 'exif-loc' : 'ville'); }
        );
        return;
      }
      spatialState.lat = spatialState.geolocGps.lat;
      spatialState.lon = spatialState.geolocGps.lon;
      resolveCityName(spatialState.lat, spatialState.lon, false);
    } else if (src === 'exif-loc' && spatialState.parsedExifGps) {
      spatialState.lat = spatialState.parsedExifGps.lat;
      spatialState.lon = spatialState.parsedExifGps.lon;
      resolveCityName(spatialState.lat, spatialState.lon, true);
    }
    dispatch('ephemerisUpdate');
  }

  function handleLocInput(e) {
    if (spatialState.source !== 'ville') return;
    clearTimeout(searchDebounceTimer);
    const query = e.target.value.trim();
    if (query.length < PERF.searchMinChars) {
      showPredictions = false;
      return;
    }
    searchDebounceTimer = setTimeout(() => fetchPredictions(query), PERF.searchDebounceMs);
  }

  async function fetchPredictions(query) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
      const data = await res.json();
      if (data && data.length > 0) {
        predictionsList = data.map(item => ({
          display: item.display_name.split(',').slice(0, 3).join(','),
          lat: item.lat,
          lon: item.lon
        }));
        showPredictions = true;
      } else {
        showPredictions = false;
      }
    } catch (e) { console.warn("Nominatim error:", e); }
  }

  function selectPrediction(pred) {
    spatialState.lat = parseFloat(pred.lat);
    spatialState.lon = parseFloat(pred.lon);
    spatialState.city = pred.display;
    spatialState.userManualLocation = { lat: spatialState.lat, lon: spatialState.lon, name: pred.display };
    spatialState.cityVerified = true; // Persistence
    showPredictions = false;
    dispatch('ephemerisUpdate');
  }

  // --- EQUIPMENT LOGIC ---
  function touchGear(type) {
    if (type === 'focal') equipmentState.focalVerified = true;
    if (type === 'pixel') equipmentState.pixelVerified = true;
    if (type === 'mult') equipmentState.multiplierVerified = true;
    if (type === 'sensor') equipmentState.sensorVerified = true;
  }

  function handleTelescopeSelect(item) {
    equipmentState.applyTelescope(item);
    dispatch('ephemerisUpdate');
  }

  function handleCameraSelect(item) {
    equipmentState.applyCamera(item);
  }

  function handleBarlowSelect(item) {
    equipmentState.applyBarlow(item);
    dispatch('ephemerisUpdate');
  }

  function handleTelescopeManual() {
    equipmentState.selectedTelescope = null;
    equipmentState.customTelescopeName = 'Mon télescope';
  }

  function handleCameraManual() {
    equipmentState.selectedCamera = null;
    equipmentState.customCameraName = 'Ma caméra';
  }

  function handleBarlowManual() {
    equipmentState.selectedBarlow = null;
    equipmentState.customBarlowName = 'Ma barlow';
  }

  function toggleManualMode() {
    equipmentState.setManualMode(!equipmentState.isManualMode);
  }

  const INFO_TEXTS = {
    mount: "Indiquez si vous utilisez une monture équatoriale (compensant la rotation terrestre) ou un simple trépied Alt-Az. Cela détermine l'orientation de la superposition et les corrections de rotation à appliquer.",
    time: "La phase lunaire et la libration changent chaque heure. Renseignez l'heure exacte de votre prise de vue pour que la carte géologique soit orientée correctement et corresponde à ce que vous avez photographié.",
    loc: "Votre position géographique influence légèrement la position apparente de la Lune (parallaxe topocentrique). Indiquez votre lieu d'observation pour affiner la correspondance de la carte.",
    gear: "Votre focale effective et la taille de vos pixels définissent l'échelle de votre photo. Sans ces données, l'outil Go To ne peut pas calculer le bon niveau de zoom pour faire correspondre la carte à votre image.",
    goto: "Recherchez un cratère par son nom pour centrer automatiquement la carte dessus et ajuster le zoom à l'échelle optique réelle de votre photo."
  };

  function activateEmergency() {
    // Save current ephemeris for later restoration
    const tState = Transform.getState();
    uiState.savedEphemeris = {
      librationLon: moonState.librationLon,
      librationLat: moonState.librationLat,
      sunLon: moonState.sunLon,
      rotation: tState.rotation
    };
    uiState.emergencyMode = true;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="panel-layout">

    <div 
      bind:this={panelRef}
      class="context-panel" 
      class:open={isOpen}
      onmouseenter={handleMouseEnter}
      onmouseleave={handleMouseLeave}
    >
      <!-- Summary / Launcher Pill -->
      <div class="panel-trigger" onclick={toggleOpen}>
        <div class="trigger-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="trigger-summary">
          <span class="summary-item">
            {viewportState.isAltAzMode ? 'Alt-Az' : 'Eq'}
          </span>
          {#if !isOpen}
            <span class="summary-sep">|</span>
            <span class="summary-item">{equipmentState.effectiveFocal}mm</span>
            <span class="summary-sep">|</span>
            <span class="summary-item truncate">{spatialState.city || 'Lieu'}</span>
          {/if}
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
        <div 
          class="scroll-container" 
          bind:this={scrollContainerRef}
        >
          <!-- MOUNT / TIME / LOCATION — locked in emergency mode -->
          <div class:emergency-locked={isEmergencyLocked}>
          <!-- MOUNT SECTION -->
          <section class="panel-section">
            <h3 class="section-title" class:verified={isMountVerified} class:emergency={isEmergencyLocked}>
              <span class="status-dot" class:verified={isMountVerified} class:emergency={isEmergencyLocked}></span>
              Monture
              <span class="info-icon" use:tooltip={INFO_TEXTS.mount}>?</span>
            </h3>
            <div class="mount-toggle-group" class:unverified={!isMountVerified}>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="label clickable" class:active={!viewportState.isAltAzMode && isMountVerified} onclick={() => toggleMount(false)}>Équatoriale</span>
              <label class="switch">
                <input type="checkbox" checked={viewportState.isAltAzMode} onchange={() => toggleMount()} />
                <span class="slider"></span>
              </label>
              <span class="label clickable" class:active={viewportState.isAltAzMode && isMountVerified} onclick={() => toggleMount(true)}>Trépied</span>
            </div>
          </section>

          <div class="divider"></div>

          <!-- TIME SECTION -->
          <section class="panel-section">
            <h3 class="section-title" class:verified={isTimeVerified} class:emergency={isEmergencyLocked}>
              <span class="status-dot" class:verified={isTimeVerified} class:emergency={isEmergencyLocked}></span>
              Temps
              <span class="info-icon" use:tooltip={INFO_TEXTS.time}>?</span>
            </h3>
            <div class="source-pills">
              <button class="pill" class:active={temporalState.source === 'name'} class:disabled={!temporalState.parsedNameDate} onclick={() => setTimeSource('name')}>Nom</button>
              <button class="pill" class:active={temporalState.source === 'exif'} class:disabled={!temporalState.parsedExifDate} onclick={() => setTimeSource('exif')}>Exif</button>
              <button class="pill" class:active={temporalState.source === 'manual'} onclick={() => setTimeSource('manual')}>Manuel</button>
            </div>
            <input type="datetime-local" class="panel-input mt-2" class:readonly={temporalState.source !== 'manual'} value={timeDisplayValue} onchange={handleTimeChange} />
          </section>

          <div class="divider"></div>

          <!-- LOCATION SECTION -->
          <section class="panel-section">
            <h3 class="section-title" class:verified={isLocationVerified} class:emergency={isEmergencyLocked}>
              <span class="status-dot" class:verified={isLocationVerified} class:emergency={isEmergencyLocked}></span>
              Localisation
              <span class="info-icon" use:tooltip={INFO_TEXTS.loc}>?</span>
            </h3>
            <div class="source-pills">
              <button class="pill" class:active={spatialState.source === 'geoloc'} onclick={() => setLocSource('geoloc')}>Auto</button>
              <button class="pill" class:active={spatialState.source === 'exif-loc'} class:disabled={!spatialState.parsedExifGps} onclick={() => setLocSource('exif-loc')}>Exif</button>
              <button class="pill" class:active={spatialState.source === 'ville'} onclick={() => setLocSource('ville')}>Ville</button>
            </div>
            <div class="input-with-icon mt-2">
              <span class="icon">📍</span>
              <input 
                type="text" 
                class="panel-input" 
                value={spatialState.city} 
                readonly={spatialState.source !== 'ville'} 
                placeholder="Lieu..." 
                oninput={handleLocInput}
                onclick={(e) => { if (spatialState.source !== 'ville') setLocSource('ville'); e.target.select(); }} 
              />
            </div>
            {#if showPredictions && predictionsList.length > 0}
              <ul class="predictions">
                {#each predictionsList as pred}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <li onclick={() => selectPrediction(pred)} role="presentation">{pred.display}</li>
                {/each}
              </ul>
            {/if}
          </section>
          </div> <!-- end emergency-locked -->

          <div class="divider"></div>

          <!-- EQUIPMENT SECTION -->
          <section class="panel-section">
            <div class="section-header">
              <h3 class="section-title" class:verified={isEquipmentVerified}>
                <span class="status-dot" class:verified={isEquipmentVerified}></span>
                Matériel
                <span class="info-icon" use:tooltip={INFO_TEXTS.gear}>?</span>
              </h3>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="mode-toggle" class:active={equipmentState.isManualMode} onclick={toggleManualMode} title="Basculer saisie manuelle">
                {equipmentState.isManualMode ? '📋 Catalogue' : '✏️ Manuel'}
              </span>
            </div>

            {#if equipmentState.isManualMode}
              <div class="grid-inputs">
                <div class="field">
                  <label for="focal">Focale (mm)</label>
                  <input id="focal" type="number" bind:value={equipmentState.focalLength} oninput={() => touchGear('focal')} />
                </div>
                <div class="field">
                  <label for="aperture">Ouverture (mm)</label>
                  <input id="aperture" type="number" bind:value={equipmentState.aperture} oninput={() => touchGear('focal')} />
                </div>
                <div class="field">
                  <label for="mult">Barlow/Réd.</label>
                  <input id="mult" type="number" step="0.1" bind:value={equipmentState.multiplier} oninput={() => touchGear('mult')} />
                </div>
                <div class="field">
                  <label for="pixel">Pixel (µm)</label>
                  <input id="pixel" type="number" step="0.01" bind:value={equipmentState.pixelSize} oninput={() => touchGear('pixel')} />
                </div>
                <div class="field">
                  <label for="sensorW">Capteur W (px)</label>
                  <input id="sensorW" type="number" bind:value={equipmentState.sensorWidth} oninput={() => touchGear('sensor')} />
                </div>
                <div class="field">
                  <label for="sensorH">Capteur H (px)</label>
                  <input id="sensorH" type="number" bind:value={equipmentState.sensorHeight} oninput={() => touchGear('sensor')} />
                </div>
              </div>
            {:else}
              {#if eqDbLoaded}
                <EquipmentSearch
                  items={telescopeDb}
                  placeholder="Chercher un télescope..."
                  value={equipmentState.selectedTelescope}
                  customName={equipmentState.customTelescopeName}
                  onSelect={handleTelescopeSelect}
                  onManual={handleTelescopeManual}
                  icon="🔭"
                  label="Télescope"
                />
                <EquipmentSearch
                  items={cameraDb}
                  placeholder="Chercher une caméra..."
                  value={equipmentState.selectedCamera}
                  customName={equipmentState.customCameraName}
                  onSelect={handleCameraSelect}
                  onManual={handleCameraManual}
                  icon="📷"
                  label="Caméra"
                />
                <EquipmentSearch
                  items={barlowDb}
                  placeholder="Chercher barlow/réducteur..."
                  value={equipmentState.selectedBarlow}
                  customName={equipmentState.customBarlowName}
                  onSelect={handleBarlowSelect}
                  onManual={handleBarlowManual}
                  icon="🔍"
                  label="Barlow / Réducteur"
                />
              {:else}
                <div class="eq-loading">Chargement catalogue...</div>
              {/if}

              {#if equipmentState.focalVerified || equipmentState.pixelVerified || equipmentState.multiplierVerified}
                <div class="eq-specs">
                  <div class="eq-spec-row"><span class="eq-spec-label">F.eff</span><span class="eq-spec-value">{equipmentState.effectiveFocal}mm</span></div>
                  {#if equipmentState.aperture > 0}<div class="eq-spec-row"><span class="eq-spec-label">F/D</span><span class="eq-spec-value">f/{equipmentState.fRatio}</span></div>{/if}
                  {#if equipmentState.pixelVerified}<div class="eq-spec-row"><span class="eq-spec-label">Pixel</span><span class="eq-spec-value">{equipmentState.pixelSize}µm</span></div>
                  <div class="eq-spec-row"><span class="eq-spec-label">Capteur</span><span class="eq-spec-value">{equipmentState.sensorWidth}×{equipmentState.sensorHeight}</span></div>{/if}
                </div>
              {/if}

              {#if equipmentState.customTelescopeName || equipmentState.customCameraName || equipmentState.customBarlowName}
                <div class="eq-manual-fields">
                  <div class="eq-manual-title">Paramètres manuels</div>
                  {#if equipmentState.customTelescopeName}
                    <div class="grid-inputs">
                      <div class="field"><label for="focal">Focale (mm)</label><input id="focal" type="number" bind:value={equipmentState.focalLength} oninput={() => touchGear('focal')} /></div>
                      <div class="field"><label for="aperture">Ouverture (mm)</label><input id="aperture" type="number" bind:value={equipmentState.aperture} oninput={() => touchGear('focal')} /></div>
                    </div>
                  {/if}
                  {#if equipmentState.customCameraName}
                    <div class="grid-inputs">
                      <div class="field"><label for="pixel">Pixel (µm)</label><input id="pixel" type="number" step="0.01" bind:value={equipmentState.pixelSize} oninput={() => touchGear('pixel')} /></div>
                      <div class="field"><label for="sensorW">W (px)</label><input id="sensorW" type="number" bind:value={equipmentState.sensorWidth} oninput={() => touchGear('sensor')} /></div>
                      <div class="field"><label for="sensorH">H (px)</label><input id="sensorH" type="number" bind:value={equipmentState.sensorHeight} oninput={() => touchGear('sensor')} /></div>
                    </div>
                  {/if}
                  {#if equipmentState.customBarlowName}
                    <div class="grid-inputs">
                      <div class="field"><label for="mult">Multiplicateur</label><input id="mult" type="number" step="0.1" bind:value={equipmentState.multiplier} oninput={() => touchGear('mult')} /></div>
                    </div>
                  {/if}
                </div>
              {/if}
            {/if}
          </section>

          <div class="divider"></div>

          <!-- GO TO CRATER -->
          <section class="panel-section">
            <GoToCrater on:toast />
          </section>

          <!-- EMERGENCY MODE BUTTON -->
          {#if !isEmergencyLocked}
            <div class="divider"></div>
            <section class="panel-section">
              <button class="emergency-btn" onclick={activateEmergency}>
                <span class="emergency-stripes"></span>
                <svg class="emergency-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 1L19 18H1L10 1Z" stroke="currentColor" stroke-width="1" fill="none"/>
                  <text x="10" y="15" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">!</text>
                </svg>
                <span>Mode Urgence</span>
              </button>
            </section>
          {/if}
        </div>
      </div>
    </div>
  </div> <!-- End layout -->

<style>
  /* Layout for Side Dock */
  .panel-layout {
    position: fixed;
    top: 60px;
    right: 16px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    z-index: 1000;
    pointer-events: none;
  }

  .context-panel {
    width: 240px; 
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

  .context-panel.open {
    max-height: 85vh; /* Expanded height */
    border-radius: 16px;
    border-color: rgba(0, 229, 255, 0.3);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 229, 255, 0.15);
    overflow: visible; /* Allow tooltips to show outside */
  }

  /* Trigger / Summary Area */
  .panel-trigger {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    cursor: pointer;
    gap: 12px;
    user-select: none;
  }

  .trigger-icon {
    width: 20px;
    height: 20px;
    color: var(--color-cyan);
    flex-shrink: 0;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .context-panel.open .trigger-icon {
    transform: rotate(90deg);
  }

  .trigger-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-dim);
    overflow: hidden;
  }

  .summary-item { white-space: nowrap; }
  .summary-sep { opacity: 0.3; }
  .truncate { overflow: hidden; text-overflow: ellipsis; }

  /* Content Area */
  .panel-content {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    padding: 0 16px 20px 16px;
  }

  .context-panel.open .panel-content {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 0.5s ease 0.1s;
  }

  .scroll-container {
    max-height: calc(85vh - 60px);
    overflow-y: auto;
    scrollbar-width: none;
  }
  .scroll-container::-webkit-scrollbar { display: none; }

  .panel-section {
    padding: 12px 0;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--color-cyan);
    margin-bottom: 12px;
    opacity: 0.8;
    transition: all 0.4s ease;
  }

  .section-title.verified {
    opacity: 1;
    color: var(--color-cyan);
    text-shadow: 0 0 10px rgba(0, 229, 255, 0.6);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.5);
    transition: all 0.4s ease;
  }

  .status-dot.verified {
    background: var(--color-cyan);
    box-shadow: 0 0 8px var(--color-cyan), 0 0 2px var(--color-cyan);
  }

  /* Emergency Mode — locked sections */
  .emergency-locked {
    position: relative;
    pointer-events: none;
    opacity: 0.5;
    filter: saturate(0.3);
    transition: all 0.4s ease;
  }

  .section-title.emergency {
    color: #FF8C00 !important;
    text-shadow: none !important;
    opacity: 0.7;
  }

  .status-dot.emergency {
    background: #FF8C00 !important;
    box-shadow: 0 0 6px rgba(255, 140, 0, 0.5) !important;
  }

  .divider {
    height: 1px;
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    transition: all 0.4s ease;
    margin: 4px 0;
  }


  /* Components specific to sections */
  .mount-toggle-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .label { font-size: 11px; color: var(--color-text-dim); transition: color 0.3s; }
  .label.clickable { cursor: pointer; }
  .label.clickable:hover { color: #fff; }
  .label.active { color: #fff; font-weight: 600; text-shadow: 0 0 8px var(--color-cyan); }

  .mount-toggle-group.unverified .slider { opacity: 0.5; filter: grayscale(1); }
  .mount-toggle-group.unverified .label.active { text-shadow: none; color: var(--color-text-dim); }

  .switch { position: relative; width: 36px; height: 18px; cursor: pointer; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { 
    position: absolute; 
    inset: 0; 
    background: rgba(255, 255, 255, 0.05); 
    border: 1px solid rgba(255, 255, 255, 0.1); 
    border-radius: 999px; 
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
  }
  
  .mount-toggle-group:not(.unverified) .slider {
    border-color: rgba(0, 229, 255, 0.2);
    box-shadow: 0 0 10px rgba(0, 229, 255, 0.05);
  }

  .slider:before { 
    content: ""; 
    position: absolute; 
    height: 12px; 
    width: 12px; 
    left: 2px; 
    bottom: 2px; 
    background: var(--color-text-dim); 
    border-radius: 50%; 
    transition: 0.3s; 
  }

  /* Verified & Active state */
  .mount-toggle-group:not(.unverified) .slider:before {
    background: #fff;
    box-shadow: 0 0 8px #fff;
  }

  input:checked + .slider { 
    background: rgba(0, 229, 255, 0.1); 
    border-color: var(--color-cyan) !important; 
  }
  
  input:checked + .slider:before { 
    transform: translateX(18px); 
    background: var(--color-cyan) !important;
    box-shadow: 0 0 10px var(--color-cyan) !important;
  }

  .source-pills { display: flex; gap: 4px; background: rgba(0,0,0,0.2); padding: 2px; border-radius: 999px; }
  .pill { flex: 1; border: none; background: transparent; color: var(--color-text-dim); font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 4px; border-radius: 999px; cursor: pointer; transition: all 0.2s; }
  .pill.active { background: rgba(255,255,255,0.1); color: #fff; }
  .pill.disabled { opacity: 0.2; pointer-events: none; }

  .panel-input {
    width: 100%;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 6px;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 6px 8px;
    outline: none;
    box-sizing: border-box;
  }
  .panel-input:focus { border-color: var(--color-cyan); }
  .panel-input.readonly { border: none; background: transparent; color: var(--color-cyan); padding-left: 0; pointer-events: none; }

  .input-with-icon { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 0 8px; }
  .input-with-icon .icon { font-size: 12px; }
  .input-with-icon input { border: none; background: transparent; flex: 1; padding: 6px 0; }

  .grid-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field label { display: block; font-size: 10px; color: var(--color-text-dim); margin-bottom: 4px; }
  .field input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; color: #fff; font-family: var(--font-mono); font-size: 11px; padding: 4px 6px; outline: none; box-sizing: border-box; }

  .predictions { position: absolute; width: calc(100% - 32px); background: #111; border: 1px solid var(--color-border); border-radius: 6px; list-style: none; padding: 0; margin-top: 4px; z-index: 10; max-height: 150px; overflow-y: auto; }
  .predictions li { padding: 6px 10px; font-size: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .predictions li:hover { background: var(--color-cyan); color: #000; }

  .mt-2 { margin-top: 8px; }

  /* Equipment section header with mode toggle */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .section-header .section-title {
    margin-bottom: 0;
  }

  .mode-toggle {
    font-size: 9px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.2);
    transition: all 0.25s;
    user-select: none;
  }

  .mode-toggle:hover {
    color: rgba(255, 255, 255, 0.6);
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
  }

  .mode-toggle.active {
    color: var(--color-cyan);
    border-color: rgba(0, 229, 255, 0.2);
  }

  /* Equipment specs readout */
  .eq-specs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
    margin-top: 10px;
    padding: 8px 10px;
    background: rgba(0, 229, 255, 0.03);
    border: 1px solid rgba(0, 229, 255, 0.08);
    border-radius: 8px;
  }

  .eq-spec-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .eq-spec-label {
    font-size: 9px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.25);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .eq-spec-value {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-cyan);
    font-weight: 500;
  }

  /* Manual fields inside catalogue mode */
  .eq-manual-fields {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(124, 77, 255, 0.12);
  }

  .eq-manual-title {
    font-size: 9px;
    font-weight: 700;
    color: rgba(124, 77, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  /* Loading state */
  .eq-loading {
    text-align: center;
    padding: 16px 0;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    font-style: italic;
  }
  /* Info Icons */
  .info-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-dim);
    font-size: 10px;
    font-family: 'Inter', sans-serif;
    cursor: help;
    margin-left: 8px;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
    border: 1px solid rgba(255, 255, 255, 0.1);
    vertical-align: middle;
    pointer-events: auto !important;
    line-height: 0;
    text-shadow: none;
    padding: 0;
    flex-shrink: 0;
  }

  .info-icon:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  /* Emergency Mode Button */
  .emergency-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    border: 1px solid rgba(255, 140, 0, 0.3);
    border-radius: var(--radius-sm);
    background: linear-gradient(135deg, rgba(30, 15, 0, 0.8), rgba(50, 25, 0, 0.6));
    color: #FF8C00;
    font-family: var(--font-main);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .emergency-stripes {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 4px,
      rgba(255, 140, 0, 0.04) 4px,
      rgba(255, 140, 0, 0.04) 8px
    );
    pointer-events: none;
  }

  .emergency-icon {
    width: 14px;
    height: 14px;
    color: #FF8C00;
    filter: drop-shadow(0 0 3px rgba(255, 140, 0, 0.5));
    z-index: 1;
  }

  .emergency-btn span:last-child {
    z-index: 1;
  }

  .emergency-btn:hover {
    border-color: rgba(255, 140, 0, 0.6);
    background: linear-gradient(135deg, rgba(50, 25, 0, 0.9), rgba(80, 40, 0, 0.7));
    box-shadow: 0 0 16px rgba(255, 140, 0, 0.25), inset 0 0 20px rgba(255, 140, 0, 0.05);
    transform: scale(1.02);
  }

  .emergency-btn:active {
    transform: scale(0.98);
  }
</style>
