<script>
  import { createEventDispatcher } from 'svelte';
  import { spatialState } from '@/stores/spatialState.svelte.js';
  import { viewportState } from '@/stores/viewportState.svelte.js';
  import { PERF } from '@/engine/config.js';

  const dispatch = createEventDispatcher();

  let predictionsList = $state([]);
  let showPredictions = $state(false);
  let debounceTimer = null;

  let cachedGeolocCity = null;
  let cachedExifCity = null;

  async function resolveCityName(lat, lon, isExif = false) {
    if (isExif && cachedExifCity) {
      spatialState.city = cachedExifCity;
      return;
    }
    if (!isExif && cachedGeolocCity) {
      spatialState.city = cachedGeolocCity;
      return;
    }
    try {
      spatialState.city = 'Recherche en cours...';
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
      const data = await res.json();
      const name = data && data.display_name ? data.display_name.split(',').slice(0, 3).join(',') : (isExif ? "Localisation Exif" : "Position GPS");
      
      if (isExif) cachedExifCity = name;
      else cachedGeolocCity = name;

      // Update if user hasn't switched mode during fetch
      if (spatialState.source === (isExif ? 'exif-loc' : 'geoloc')) {
        spatialState.city = name;
      }
    } catch (e) {
      const fallback = isExif ? "Trouvé dans l'image (Exif)" : "Position du navigateur";
      if (isExif) cachedExifCity = fallback;
      else cachedGeolocCity = fallback;
      
      if (spatialState.source === (isExif ? 'exif-loc' : 'geoloc')) {
        spatialState.city = fallback;
      }
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
        spatialState.city = 'Recherche GPS...';
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

  function handleInput(e) {
    if (spatialState.source !== 'ville') return;
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    if (query.length < PERF.searchMinChars) {
      showPredictions = false;
      return;
    }
    debounceTimer = setTimeout(() => fetchPredictions(query), PERF.searchDebounceMs);
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
    showPredictions = false;
    dispatch('ephemerisUpdate');
  }
</script>

<div id="location-bar" class="hud-pill-bar" class:visible={viewportState.appReady}>
  <div class="time-sources">
    <button class="source-btn"
      class:active={spatialState.source === 'geoloc'}
      onclick={() => setLocSource('geoloc')} title="Utiliser la position du navigateur">Auto</button>
    <button class="source-btn"
      class:active={spatialState.source === 'exif-loc'}
      class:disabled={!spatialState.parsedExifGps}
      onclick={() => setLocSource('exif-loc')} title="Trouvé dans l'image">Exif</button>
    <button class="source-btn"
      class:active={spatialState.source === 'ville'}
      onclick={() => setLocSource('ville')} title="Saisie par ville">Ville</button>
  </div>
  <div class="tb-sep"></div>
  <div class="loc-group" style="position: relative;">
    <span class="loc-icon">📍</span>
    <input type="text"
      id="loc-city-input"
      name="locCityInput"
      value={spatialState.city}
      readonly={spatialState.source !== 'ville'}
      placeholder="Lieu..."
      autocomplete="off"
      oninput={handleInput}
      onclick={(e) => { 
        if (spatialState.source !== 'ville') {
          setLocSource('ville');
        }
        e.target.select(); 
      }} />
    {#if showPredictions && predictionsList.length > 0}
      <ul class="loc-predictions-list">
        {#each predictionsList as pred}
          <li onclick={() => selectPrediction(pred)} role="presentation">{pred.display}</li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .hud-pill-bar {
    position: fixed;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--color-surface);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    box-shadow: var(--shadow-card), var(--shadow-hud-glow);
    z-index: 100;
    transform: translateX(350px);
    opacity: 0;
    transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.15s,
                opacity 0.7s ease-out 0.15s;
  }
  .hud-pill-bar.visible { transform: translateX(0); opacity: 1; }
  #location-bar { top: 102px; }
  .time-sources { display: flex; background: rgba(0, 0, 0, 0.3); border-radius: var(--radius-pill); padding: 3px; }
  .source-btn { border: none; background: transparent; color: var(--color-text-dim); font-family: var(--font-main); font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: var(--radius-pill); cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; transition: all var(--transition-fast); }
  .source-btn.disabled { opacity: 0.3; pointer-events: none; }
  .source-btn.active { background: var(--color-surface-hover); color: var(--color-text-bright); box-shadow: 0 0 10px rgba(0, 212, 255, 0.15); border: 1px solid var(--color-border); }
  .tb-sep { width: 1px; height: 24px; background: var(--color-border); margin: 0 4px; }
  .loc-group { display: flex; align-items: center; gap: 6px; }
  .loc-icon { font-size: 14px; opacity: 0.9; }
  .loc-group input[type="text"] { font-family: var(--font-main); font-size: 12px; color: var(--color-text-bright); background: rgba(0, 0, 0, 0.4); border: 1px solid transparent; outline: none; border-radius: var(--radius-sm); padding: 2px 6px; width: 180px; transition: border var(--transition-fast); }
  .loc-group input:not([readonly]):focus { border: 1px solid var(--color-cyan); }
  .loc-group input[readonly] { opacity: 1; pointer-events: none; border: none; background: transparent; padding-left: 0; color: var(--color-cyan); }
  .loc-predictions-list { position: absolute; top: 100%; left: 20px; right: 0; margin-top: 6px; background: rgba(6, 6, 12, 0.9); backdrop-filter: blur(var(--blur)); border: 1px solid var(--color-border); border-radius: var(--radius-sm); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), var(--shadow-hud-glow); list-style: none; padding: 0; max-height: 200px; overflow-y: auto; z-index: 200; }
  .loc-predictions-list li { padding: 8px 12px; font-size: 12px; color: var(--color-text-bright); cursor: pointer; border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background var(--transition-fast); }
  .loc-predictions-list li:last-child { border-bottom: none; }
  .loc-predictions-list li:hover { background: rgba(0, 212, 255, 0.2); }
</style>
