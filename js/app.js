/**
 * AstroMoon — Main Application Orchestrator (PixiJS v8)
 * Handles interaction, file uploads, and the main render loop.
 */

import { PixiRenderer } from './pixi_renderer.js';
import { GeoJSON } from './geojson.js';
import { Transform } from './transform.js';
import { Anchors } from './anchors.js';
import { MiniExif } from './exif.js';
// TPS is used internally by Anchors, no direct import needed here.

// ─── State ───
let canvasW = 0, canvasH = 0;

let backgroundImage = null;
let projectedFeatures = null;
let layerTransformDirty = true;
let dirtyEphemeris = true;  // nightmask, terminator, projections
let dirtyGrid = false;      // grid only

let allRawFeatures = [];
let mergedBounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
let loadedLayerNames = [];
let layerCount = 0;

let viewport = { tx: 0, ty: 0, scale: 1 };
let lastViewportScale = 1; // Used to detect zoom changes and rebuild sharp lines

let mode = 'navigate'; // 'navigate' | 'anchor'
let isDragging = false;
let dragType = null;
let dragStart = { x: 0, y: 0 };
let dragAnchorId = null;
let dragAnchorOffset = { x: 0, y: 0 };
let lastRotationAngle = 0;
let isAltAzMode = false;

let frameCount = 0;
let fpsTime = 0;
let fps = 0;
let lastInteractionTime = 0;
let sceneRebuildPending = false;
let _lastPanZoomTime = 0;
let _lastViewportTx = 0;
let _lastViewportTy = 0;

// Coordonnées hover UI
let mouseX = -1000;
let mouseY = -1000;

// ─── Time Widget State ───
window.appTemporalTime = new Date();
window.appMoonState = {
  librationLon: 0,
  librationLat: 0,
  moonPhase360: 0,
  sunLon: 0,
  sunLat: 0,
  terminatorGeoPoints: []
};
let timeSource = 'manual';
let userManualDate = new Date();
let parsedNameDate = null;
let parsedExifDate = null;

// ─── Location Widget State ───
window.appSpatialLocation = { lat: 0, lon: 0 };
let locSource = 'ville';
let userManualLocation = { lat: 48.85, lon: 2.35, name: "" };
let parsedExifGps = null;
let geolocGps = null;
let locDebounceTimer = null;

// ─── DOM References ───
const imageInput = document.getElementById('input-image');
const btnImage = document.getElementById('btn-upload-image');
const btnAnchorMode = document.getElementById('btn-anchor-mode');
const btnReset = document.getElementById('btn-reset');
const btnGrid = document.getElementById('btn-grid');
const fpsDisplay = document.getElementById('fps-display');
const anchorPanel = document.getElementById('anchor-panel');
const anchorList = document.getElementById('anchor-list');
const statusToast = document.getElementById('status-toast');
const welcomeOverlay = document.getElementById('welcome-overlay');
const btnWelcomeImage = document.getElementById('btn-welcome-image');
const btnLabels = document.getElementById('btn-labels');
const starfield = document.getElementById('starfield');

async function init() {
  // Initialize PixiJS
  const pixiContainer = document.getElementById('pixi-container');
  const app = await PixiRenderer.init(pixiContainer);

  canvasW = window.innerWidth;
  canvasH = window.innerHeight;

  // Input events are bound to the PixiJS canvas
  const canvas = app.canvas;

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);

  btnImage.addEventListener('click', () => imageInput.click());
  btnAnchorMode.addEventListener('click', toggleAnchorMode);
  btnReset.addEventListener('click', resetAll);
  btnGrid.addEventListener('click', () => {
    const on = PixiRenderer.toggleGrid();
    btnGrid.classList.toggle('active', on);
    if (on) { dirtyGrid = true; layerTransformDirty = true; }
  });
  btnLabels.addEventListener('click', () => {
    const on = PixiRenderer.toggleLabels();
    btnLabels.classList.toggle('active', on);
    if (on) {
      if (!window.cratersDB) initCraters();
      else updateCratersProjection();
      layerTransformDirty = true;
    }
  });

  const mountToggle = document.getElementById('mount-toggle');
  mountToggle.addEventListener('change', () => {
    isAltAzMode = mountToggle.checked;
    updateMountUI();
    updateEphemeris();
  });
  updateMountUI();

  btnWelcomeImage.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', handleImageUpload);

  // --- Drag & Drop ---
  document.addEventListener('dragover', (e) => { e.preventDefault(); welcomeOverlay.classList.add('drag-over'); });
  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null || !document.contains(e.relatedTarget)) welcomeOverlay.classList.remove('drag-over');
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    welcomeOverlay.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      imageInput.files = dt.files;
      imageInput.dispatchEvent(new Event('change'));
    }
  });

  // --- Generate Starfield ---
  generateStarfield();

  // --- Time Widget ---
  document.getElementById('time-input').addEventListener('change', (e) => {
    if (timeSource === 'manual') {
      userManualDate = new Date(e.target.value);
      window.appTemporalTime = userManualDate;
      console.log("Manuel : temps mis à jour =>", window.appTemporalTime);
      updateEphemeris();
    }
  });

  ['name', 'exif', 'manual'].forEach(src => {
    document.getElementById(`src-${src}`).addEventListener('click', (e) => {
      if (!e.target.classList.contains('disabled')) setTimeSource(src);
    });
  });

  setTimeSource('manual');

  // --- Location Widget ---
  const cityInput = document.getElementById('loc-city-input');
  const predictionsList = document.getElementById('loc-predictions');

  cityInput.addEventListener('input', (e) => {
    if (locSource !== 'ville') return;
    clearTimeout(locDebounceTimer);
    const query = e.target.value.trim();
    if (query.length < 3) {
      predictionsList.innerHTML = '';
      predictionsList.classList.add('hidden');
      return;
    }
    locDebounceTimer = setTimeout(() => fetchPredictions(query), 400);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#loc-search-container')) {
      predictionsList.classList.add('hidden');
    }
  });

  // -- Default Location (Eiffel Tower, Paris) --
  window.appSpatialLocation = { lat: 48.8584, lon: 2.2945, city: 'Eiffel Tower, Paris' };
  cityInput.value = window.appSpatialLocation.city;

  // -- Default Time (Now) --
  const now = new Date();
  window.appTemporalTime = now;
  userManualDate = now;
  
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().substring(0, 16);
  document.getElementById('time-input').value = localISO;

  setLocSource('ville');

  Transform.reset(canvasW, canvasH);

  updateEphemeris();

  // Load GeoJSON layers dynamically via fetch
  loadLayersAsync();

  // Use PixiJS ticker for the render loop
  app.ticker.add(renderTick);
  updateCursor();
}

function onResize() {
  const oldW = canvasW, oldH = canvasH;
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  Transform.handleResize(oldW, oldH, canvasW, canvasH);
  if (backgroundImage) {
    PixiRenderer.setBackgroundImage(backgroundImage, canvasW, canvasH);
  }
  layerTransformDirty = true;
}

function updateLayerCache() {
  if (!projectedFeatures) return;
  for (const feature of projectedFeatures) {
    if (!feature.renderedCoords) {
      feature.renderedCoords = new Array(feature.projectedCoords.length);
    }
    
    // Initialiser les bounds pour l'optimisation (culling)
    feature.worldBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    
    for (let r = 0; r < feature.projectedCoords.length; r++) {
      const ring = feature.projectedCoords[r];
      // Reuse or allocate Float32Array (2 floats per point)
      if (!feature.renderedCoords[r] || feature.renderedCoords[r].length !== ring.length * 2) {
        feature.renderedCoords[r] = new Float32Array(ring.length * 2);
      }
      const cachedRing = feature.renderedCoords[r];
      
      // Step 1: Copy raw protected coords into buffer flat floats
      for (let i = 0; i < ring.length; i++) {
        if (ring[i] === null) {
          cachedRing[i * 2] = NaN; // Use NaN for separators
          cachedRing[i * 2 + 1] = NaN;
        } else {
          cachedRing[i * 2] = ring[i][0];
          cachedRing[i * 2 + 1] = ring[i][1];
        }
      }
      
      // Step 2: Apply the full TPS and Transform pipeline in-place (Zero Allocation!)
      Anchors.applyBuffer(cachedRing);
      
      // Step 3: Compute World Bounds for fast geometry culling
      const bounds = feature.worldBounds;
      for (let i = 0; i < cachedRing.length; i += 2) {
        const x = cachedRing[i];
        const y = cachedRing[i + 1];
        if (isNaN(x)) continue;
        if (x < bounds.minX) bounds.minX = x;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (y > bounds.maxY) bounds.maxY = y;
      }
    }
  }
  layerTransformDirty = false;
}

function screenToWorld(sx, sy) {
  return { x: (sx - viewport.tx) / viewport.scale, y: (sy - viewport.ty) / viewport.scale };
}
function screenToNormalized(sx, sy) {
  const world = screenToWorld(sx, sy);
  return Transform.inverse(world.x, world.y);
}

function formatForDatetimeLocal(date) {
  if (!date || isNaN(date.getTime())) return '';
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setTimeSource(src) {
  timeSource = src;
  ['name', 'exif', 'manual'].forEach(s => document.getElementById(`src-${s}`).classList.remove('active'));
  document.getElementById(`src-${src}`).classList.add('active');

  const input = document.getElementById('time-input');
  if (src === 'manual') {
    input.classList.remove('readonly');
    window.appTemporalTime = userManualDate;
    input.value = formatForDatetimeLocal(userManualDate);
  } else {
    input.classList.add('readonly');
    if (src === 'name' && parsedNameDate) {
      window.appTemporalTime = parsedNameDate;
      input.value = formatForDatetimeLocal(parsedNameDate);
    } else if (src === 'exif' && parsedExifDate) {
      window.appTemporalTime = parsedExifDate;
      input.value = formatForDatetimeLocal(parsedExifDate);
    }
  }
  updateEphemeris();
}

function extractDateFromName(filename) {
  const rx1 = /(\d{4})[-_]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})?[-_]?(\d{2})?[-_]?(\d{2})?/;
  const m = filename.match(rx1);
  if (m && m[1] >= 1900 && m[1] <= 2100 && m[2] >= 1 && m[2] <= 12 && m[3] >= 1 && m[3] <= 31) {
    const d = new Date(m[1], m[2] - 1, m[3], m[4] || 0, m[5] || 0, m[6] || 0);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function updateLocation(lat, lon, displayName) {
  window.appSpatialLocation.lat = parseFloat(lat);
  window.appSpatialLocation.lon = parseFloat(lon);

  if (locSource === 'ville') {
    userManualLocation = { lat: parseFloat(lat), lon: parseFloat(lon), name: displayName };
  }

  if (displayName) {
    document.getElementById('loc-city-input').value = displayName;
  } else {
    reverseGeocode(lat, lon);
  }
  updateEphemeris();
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
    const data = await res.json();
    if (data && data.name) {
      document.getElementById('loc-city-input').value = data.name;
      if (locSource === 'ville') userManualLocation.name = data.name;
    } else {
      document.getElementById('loc-city-input').value = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    }
  } catch (e) {
    document.getElementById('loc-city-input').value = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
}

async function fetchPredictions(query) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
    const data = await res.json();
    const list = document.getElementById('loc-predictions');
    list.innerHTML = '';
    if (data && data.length > 0) {
      data.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.display_name.split(',').slice(0, 3).join(',');
        li.addEventListener('click', () => {
          updateLocation(item.lat, item.lon, li.textContent);
          list.classList.add('hidden');
        });
        list.appendChild(li);
      });
      list.classList.remove('hidden');
    } else {
      list.classList.add('hidden');
    }
  } catch (e) {
    console.warn("Erreur Nominatim:", e);
  }
}

function updateEphemeris() {
  if (!window.Astronomy) {
    console.warn("Astronomy library not loaded yet.");
    return;
  }
  if (!window.appSpatialLocation) return;
  const obs = new Astronomy.Observer(
    window.appSpatialLocation.lat || 0,
    window.appSpatialLocation.lon || 0,
    0
  );
  const rawDate = window.appTemporalTime || new Date();
  const validDate = (rawDate instanceof Date && !isNaN(rawDate.getTime())) ? rawDate : new Date();
  const time = new Astronomy.AstroTime(validDate);
  let moonEq = null;

  // 1. Libration
  try {
    const lib = Astronomy.Libration(time);
    if (lib) {
      window.appMoonState.librationLon = lib.elon;
      window.appMoonState.librationLat = lib.elat;
    }
  } catch (e) { console.warn("Ephemeris [Libration]:", e.message); }

  // 2. Moon Phase (0-360)
  try {
    window.appMoonState.moonPhase360 = Astronomy.MoonPhase(time);
  } catch (e) { console.warn("Ephemeris [MoonPhase]:", e.message); }

  // 3. Moon equatorial coords
  try {
    moonEq = Astronomy.Equator(Astronomy.Body.Moon, time, obs, false, false);
  } catch (e) { console.warn("Ephemeris [MoonEquator]:", e.message); }

  // 4. Orientation / Rotation (PA + Q)
  try {
    const pole = Astronomy.RotationAxis(Astronomy.Body.Moon, time);
    if (pole && moonEq) {
      const raP = pole.ra * Astronomy.DEG2RAD;
      const decP = pole.dec * Astronomy.DEG2RAD;
      const raM = moonEq.ra * Astronomy.HOUR2RAD;
      const decM = moonEq.dec * Astronomy.DEG2RAD;
      const y = Math.cos(decP) * Math.sin(raP - raM);
      const x = Math.sin(decP) * Math.cos(decM) - Math.cos(decP) * Math.sin(decM) * Math.cos(raP - raM);
      const pa = Math.atan2(y, x) * Astronomy.RAD2DEG;

      const gast = Astronomy.SiderealTime(time);
      const lon = window.appSpatialLocation.lon || 0;
      const lat = window.appSpatialLocation.lat || 0;
      const last = (gast + lon / 15.0 + 24.0) % 24.0;
      const lha = (last - moonEq.ra + 24.0) % 24.0 * 15.0 * Astronomy.DEG2RAD;
      const phi = lat * Astronomy.DEG2RAD;
      const delta = moonEq.dec * Astronomy.DEG2RAD;

      const yQ = Math.sin(lha);
      const xQ = Math.tan(phi) * Math.cos(delta) - Math.sin(delta) * Math.cos(lha);
      const q = Math.atan2(yQ, xQ) * Astronomy.RAD2DEG;

      const rotationPA = isAltAzMode ? (pa + q) : pa;
      Transform.setRotation(rotationPA * Math.PI / 180);
    }
  } catch (e) { console.warn("Ephemeris [Rotation]:", e.message); }

  // 5. Bright Limb PA
  try {
    const sunEq = Astronomy.Equator(Astronomy.Body.Sun, time, obs, false, false);
    if (sunEq && moonEq) {
      const raS = sunEq.ra * Astronomy.HOUR2RAD;
      const decS = sunEq.dec * Astronomy.DEG2RAD;
      const raM = moonEq.ra * Astronomy.HOUR2RAD;
      const decM = moonEq.dec * Astronomy.DEG2RAD;
      const yS = Math.cos(decS) * Math.sin(raS - raM);
      const xS = Math.sin(decS) * Math.cos(decM) - Math.cos(decS) * Math.sin(decM) * Math.cos(raS - raM);
      window.appMoonState.brightLimbPA = Math.atan2(yS, xS) * Astronomy.RAD2DEG;
    }
  } catch (e) { console.warn("Ephemeris [BrightLimb]:", e.message); }

  // 6. Terminator
  const phase360 = window.appMoonState.moonPhase360 || 0;
  const sLon = (180 - phase360) + (window.appMoonState.librationLon || 0);
  window.appMoonState.sunLon = sLon;
  window.appMoonState.sunLat = 0;
  generateTerminator(sLon, 0);

  // Update projections
  updateGeoJSONProjection();
  if (PixiRenderer.showLabels && PixiRenderer.showLabels()) updateCratersProjection();
  layerTransformDirty = true;
  dirtyEphemeris = true;
}

function generateTerminator(sunLon, sunLat) {
  const points = [];
  const λ0 = sunLon * Math.PI / 180;
  const φ0 = (sunLat || 0) * Math.PI / 180;

  const sx = Math.cos(φ0) * Math.cos(λ0);
  const sy = Math.cos(φ0) * Math.sin(λ0);
  const sz = Math.sin(φ0);

  let e1x = sy, e1y = -sx, e1z = 0;
  let norm = Math.hypot(e1x, e1y);
  if (norm < 1e-10) { e1x = 1; e1y = 0; norm = 1; }
  e1x /= norm; e1y /= norm;

  const e2x = sy * e1z - sz * e1y;
  const e2y = sz * e1x - sx * e1z;
  const e2z = sx * e1y - sy * e1x;

  for (let i = 0; i <= 360; i++) {
    const θ = i * Math.PI / 180;
    const px = Math.cos(θ) * e1x + Math.sin(θ) * e2x;
    const py = Math.cos(θ) * e1y + Math.sin(θ) * e2y;
    const pz = Math.cos(θ) * e1z + Math.sin(θ) * e2z;

    const lat = Math.asin(Math.max(-1, Math.min(1, pz))) * 180 / Math.PI;
    const lon = Math.atan2(py, px) * 180 / Math.PI;
    points.push([lon, lat]);
  }
  window.appMoonState.terminatorGeoPoints = points;
}

function updateGeoJSONProjection() {
  if (!projectedFeatures) return;
  for (const feature of projectedFeatures) {
    if (!feature.coords) continue;
    feature.projectedCoords = feature.coords.map(ring => {
      if (!Array.isArray(ring)) return null;
      if (!Array.isArray(ring[0])) {
        return GeoJSON.projectPoint(ring[0], ring[1]);
      }
      return ring.map(c => GeoJSON.projectPoint(c[0], c[1]));
    });
  }
}

function updateCratersProjection() {
  if (!window.cratersDB || !window.appMoonState) return;
  for (const crater of window.cratersDB) {
    const proj = GeoJSON.projectPoint(crater.longitude, crater.latitude);
    if (proj) {
      crater.nx = proj[0];
      crater.ny = proj[1];
    } else {
      crater.nx = null; crater.ny = null;
    }
  }
}

function initCraters() {
  if (!window.CRATERS_RAW_DATA) return;
  const array = [];
  const DEG2RAD = Math.PI / 180;
  for (const name in window.CRATERS_RAW_DATA) {
    if (name === "--") continue;
    const c = window.CRATERS_RAW_DATA[name];
    const latRad = c.latitude * DEG2RAD;
    const lonRad = c.longitude * DEG2RAD;
    array.push({
      name: name,
      diameter: c.diameter,
      latitude: c.latitude,
      longitude: c.longitude,
      // Pre-computed trig for sun incidence (immutable)
      sinLat: Math.sin(latRad),
      cosLat: Math.cos(latRad),
      lonRad: lonRad,
      nx: null,
      ny: null
    });
  }
  // Pre-sort by diameter descending ONCE (avoids per-rebuild sort in renderer)
  array.sort((a, b) => b.diameter - a.diameter);
  window.cratersDB = array;
  updateCratersProjection();
}

function setLocSource(src) {
  locSource = src;
  ['geoloc', 'exif-loc', 'ville'].forEach(s => document.getElementById(`src-${s}`).classList.remove('active'));
  document.getElementById(`src-${src}`).classList.add('active');

  const input = document.getElementById('loc-city-input');
  const predictionsList = document.getElementById('loc-predictions');

  if (src === 'ville') {
    input.removeAttribute('readonly');
    input.placeholder = "Lieu...";
    input.value = userManualLocation.name;
    window.appSpatialLocation.lat = userManualLocation.lat;
    window.appSpatialLocation.lon = userManualLocation.lon;
  } else {
    input.setAttribute('readonly', 'true');
    predictionsList.classList.add('hidden');

    if (src === 'geoloc') {
      if (!geolocGps) {
        input.value = "Géolocalisation...";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            geolocGps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            updateLocation(geolocGps.lat, geolocGps.lon);
            showToast("Position GPS acquise !");
          },
          (err) => {
            input.value = "Rejeté/Indisponible";
            document.getElementById('src-geoloc').classList.add('disabled');
            setTimeout(() => setLocSource(parsedExifGps ? 'exif-loc' : 'ville'), 1000);
          }
        );
      } else {
        updateLocation(geolocGps.lat, geolocGps.lon);
      }
    } else if (src === 'exif-loc' && parsedExifGps) {
      input.value = "Calcul...";
      updateLocation(parsedExifGps.lat, parsedExifGps.lon);
    }
  }
  updateEphemeris();
}

async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  parsedNameDate = extractDateFromName(file.name);
  try {
    const meta = await MiniExif.extractMetaData(file);
    parsedExifDate = meta.date;
    parsedExifGps = meta.gps;
  } catch (err) {
    parsedExifDate = null;
    parsedExifGps = null;
  }

  const btnName = document.getElementById('src-name');
  const btnExif = document.getElementById('src-exif');
  const btnExifLoc = document.getElementById('src-exif-loc');

  btnName.classList.toggle('disabled', !parsedNameDate);
  btnExif.classList.toggle('disabled', !parsedExifDate);
  btnExifLoc.classList.toggle('disabled', !parsedExifGps);

  if (parsedNameDate) setTimeSource('name');
  else if (parsedExifDate) setTimeSource('exif');
  else {
    setTimeSource('manual');
    document.getElementById('time-input').value = formatForDatetimeLocal(new Date());
  }

  if (parsedExifGps) setLocSource('exif-loc');
  else setLocSource('ville');

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      backgroundImage = img;
      PixiRenderer.setBackgroundImage(img, canvasW, canvasH);
      showToast(`Image: ${file.name}`);
      enterApp();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

async function loadLayersAsync() {
  console.log("Loading layers via fetch...");
  try {
    const resp = await fetch('calque_geojson/layers.json');
    if (!resp.ok) throw new Error("Could not load layers.json index");
    const layerFiles = await resp.json();

    for (const fileName of layerFiles) {
      try {
        const fileResp = await fetch(`calque_geojson/${fileName}`);
        if (!fileResp.ok) {
          console.warn(`Could not fetch layer file: ${fileName}`);
          continue;
        }
        const text = await fileResp.text();
        const newData = GeoJSON.parse(text);

        const idx = layerCount++;
        newData.features.forEach(f => f.layerIndex = idx);
        allRawFeatures = allRawFeatures.concat(newData.features);
        
        mergedBounds.minLon = Math.min(mergedBounds.minLon, newData.bounds.minLon);
        mergedBounds.maxLon = Math.max(mergedBounds.maxLon, newData.bounds.maxLon);
        mergedBounds.minLat = Math.min(mergedBounds.minLat, newData.bounds.minLat);
        mergedBounds.maxLat = Math.max(mergedBounds.maxLat, newData.bounds.maxLat);
        
        loadedLayerNames.push(fileName);
        console.log(`Layer loaded: ${fileName} (${newData.features.length} features)`);
      } catch (err) {
        console.warn(`Error loading layer ${fileName}:`, err);
      }
    }

    if (allRawFeatures.length > 0) {
      projectedFeatures = GeoJSON.project(allRawFeatures);
      layerTransformDirty = true;
      console.log(`Total: ${layerCount} layers loaded via fetch.`);
    }
  } catch (err) {
    console.error("Failed to load layers.json index:", err);
    showToast("Erreur lors du chargement des calques (Vérifiez le serveur)");
  }
}

function toggleAnchorMode() {
  mode = mode === 'anchor' ? 'navigate' : 'anchor';
  btnAnchorMode.classList.toggle('active', mode === 'anchor');
  updateCursor();
  showToast(mode === 'anchor' ? '📌 Mode Ancrage' : '🧭 Mode Navigation');
}

function updateCursor() {
  document.body.classList.remove('cursor-grab', 'cursor-grabbing', 'cursor-crosshair', 'cursor-rotate');
  if (isDragging) document.body.classList.add(dragType === 'rotate' ? 'cursor-rotate' : 'cursor-grabbing');
  else if (mode === 'anchor') document.body.classList.add('cursor-crosshair');
  else document.body.classList.add('cursor-grab');
}

function onMouseDown(e) {
  lastInteractionTime = Date.now();
  if (!backgroundImage) return;
  const mx = e.clientX, my = e.clientY;
  isDragging = true; dragStart = { x: mx, y: my };
  const locked = Anchors.count() > 0;
  if (e.button === 2 || (e.button === 0 && e.ctrlKey) || (e.button === 0 && mode === 'navigate' && locked)) {
    dragType = 'viewport'; updateCursor(); return;
  }
  if (e.button !== 0) { isDragging = false; return; }
  if (mode === 'anchor') {
    const near = Anchors.findNear(mx, my, viewport);
    if (near) {
      dragType = 'anchor'; dragAnchorId = near.id;
      const w = Transform.apply(near.dx, near.dy);
      dragAnchorOffset = { x: mx - (w.x * viewport.scale + viewport.tx), y: my - (w.y * viewport.scale + viewport.ty) };
    } else if (projectedFeatures) {
      const norm = screenToNormalized(mx, my);
      const src = Anchors.inverseTPS(norm.x, norm.y);
      dragAnchorId = Anchors.add(src.x, src.y, norm.x, norm.y);
      dragType = 'anchor'; layerTransformDirty = true; updateAnchorPanel();
    }
  } else {
    if (e.shiftKey && !locked) {
      dragType = 'rotate';
      const c = Transform.getLayerCenter();
      lastRotationAngle = Math.atan2(my - (c.y * viewport.scale + viewport.ty), mx - (c.x * viewport.scale + viewport.tx));
    } else if (e.shiftKey && locked) { isDragging = false; }
    else dragType = 'translate';
  }
  updateCursor();
}

function onMouseMove(e) {
  if (!backgroundImage) return;
  lastInteractionTime = Date.now();
  const mx = e.clientX, my = e.clientY;
  mouseX = mx; mouseY = my;
  if (projectedFeatures) {
    const norm = screenToNormalized(mx, my);
    const src = Anchors.inverseTPS(norm.x, norm.y);
    const geo = GeoJSON.inverseProject(src.x, src.y);
    const display = document.getElementById('coords-display');
    if (display) display.textContent = geo ? `Lat: ${geo.lat.toFixed(4)}° | Lon: ${geo.lon.toFixed(4)}°` : '---';
  }
  if (!isDragging) return;
  const dx = mx - dragStart.x, dy = my - dragStart.y;
  if (dragType === 'viewport') { viewport.tx += dx; viewport.ty += dy; }
  else if (dragType === 'translate') { Transform.translate(dx / viewport.scale, dy / viewport.scale); layerTransformDirty = true; }
  else if (dragType === 'rotate') {
    const c = Transform.getLayerCenter();
    const angle = Math.atan2(my - (c.y * viewport.scale + viewport.ty), mx - (c.x * viewport.scale + viewport.tx));
    Transform.rotate(angle - lastRotationAngle); lastRotationAngle = angle; layerTransformDirty = true;
  } else if (dragType === 'anchor' && dragAnchorId !== null) {
    const norm = screenToNormalized(mx - dragAnchorOffset.x, my - dragAnchorOffset.y);
    Anchors.moveDestination(dragAnchorId, norm.x, norm.y); layerTransformDirty = true;
  }
  dragStart = { x: mx, y: my };
}

function onMouseUp() { if (!backgroundImage) return; isDragging = false; dragType = null; updateCursor(); }

function onWheel(e) {
  if (!backgroundImage) return;
  lastInteractionTime = Date.now();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  if (e.ctrlKey || Anchors.count() > 0) {
    viewport.tx = e.clientX - (e.clientX - viewport.tx) * factor;
    viewport.ty = e.clientY - (e.clientY - viewport.ty) * factor;
    viewport.scale *= factor;
  } else {
    const w = screenToWorld(e.clientX, e.clientY);
    Transform.zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08, w.x, w.y); layerTransformDirty = true;
  }
  e.preventDefault();
}

function onDoubleClick(e) {
  if (!backgroundImage) return;
  if (mode === 'anchor') {
    const near = Anchors.findNear(e.clientX, e.clientY, viewport);
    if (near) { Anchors.remove(near.id); layerTransformDirty = true; updateAnchorPanel(); }
  }
}

function onKeyDown(e) {
  if (!backgroundImage) return;
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'a' || e.key === 'A') toggleAnchorMode();
  if (e.key === 'g' || e.key === 'G') {
    const on = PixiRenderer.toggleGrid();
    btnGrid.classList.toggle('active', on);
    if (on) { dirtyGrid = true; layerTransformDirty = true; }
  }
  if (e.key === 'l' || e.key === 'L') {
    const on = PixiRenderer.toggleLabels();
    btnLabels.classList.toggle('active', on);
    if (on) {
      if (!window.cratersDB) initCraters();
      layerTransformDirty = true;
    }
  }
  if (e.key === 'o' || e.key === 'O') {
    isAltAzMode = !isAltAzMode;
    document.getElementById('mount-toggle').checked = isAltAzMode;
    updateMountUI();
    updateEphemeris();
  }
  if (e.key === 'f' || e.key === 'F') viewport = { tx: 0, ty: 0, scale: 1 };
  if (e.key === 'Escape' && mode === 'anchor') toggleAnchorMode();
}

function updateMountUI() {
  document.getElementById('mount-label-eq').classList.toggle('active', !isAltAzMode);
  document.getElementById('mount-label-az').classList.toggle('active', isAltAzMode);
}

function resetAll() {
  Transform.reset(canvasW, canvasH); viewport = { tx: 0, ty: 0, scale: 1 };
  Anchors.clear(); layerTransformDirty = true; updateAnchorPanel();
}

function updateAnchorPanel() {
  const anchors = Anchors.getAll();
  anchorPanel.classList.toggle('visible', anchors.length > 0);
  anchorList.innerHTML = '';
  anchors.forEach(a => {
    const item = document.createElement('div');
    item.className = 'anchor-item';
    item.innerHTML = `
      <span class="anchor-id">📌 #${a.id}</span>
      <button class="anchor-delete" aria-label="Supprimer" title="Supprimer cet ancrage">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    item.querySelector('button').onclick = () => { Anchors.remove(a.id); layerTransformDirty = true; updateAnchorPanel(); };
    anchorList.appendChild(item);
  });
}

function showToast(m) { statusToast.textContent = m; statusToast.classList.add('show'); setTimeout(() => statusToast.classList.remove('show'), 3000); }

function generateStarfield() {
  const count = 90;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span');
    star.className = 'star' + (Math.random() < 0.12 ? ' bright' : '');
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--twinkle-dur', (2 + Math.random() * 4).toFixed(1) + 's');
    star.style.setProperty('--twinkle-delay', (Math.random() * 5).toFixed(1) + 's');
    star.style.setProperty('--twinkle-peak', (0.3 + Math.random() * 0.5).toFixed(2));
    starfield.appendChild(star);
  }
}

function enterApp() {
  welcomeOverlay.classList.add('hidden');
  document.body.classList.add('app-ready');
}

/**
 * Rebuild scene graphics with granular dirty flags.
 * Only rebuilds subsystems that actually changed.
 */
function rebuildScene(forceAll = false, hadTransformChange = false) {
  const transformFn = Anchors.getTransformFunction();
  const rebuildEphemeris = forceAll || dirtyEphemeris;
  const rebuildTransform = forceAll || hadTransformChange;

  // GeoJSON: rebuild when transform or viewport changes (line widths depend on scale)
  if (projectedFeatures) {
    PixiRenderer.rebuildGeoJSON(projectedFeatures, viewport);
  }

  // Nightmask + Terminator: ONLY when ephemeris or layer transform changes
  // (they live inside viewportContainer → GPU-transformed on pan/zoom)
  if (rebuildEphemeris || rebuildTransform) {
    PixiRenderer.rebuildNightMask(transformFn);
    PixiRenderer.rebuildTerminator(transformFn, viewport);
  }

  // Grid: only on toggle or transform change
  if (dirtyGrid || rebuildTransform) {
    PixiRenderer.rebuildGrid(transformFn, viewport);
    dirtyGrid = false;
  }

  // Anchors: always (cheap, few items)
  PixiRenderer.rebuildAnchors(Anchors.getAll(), viewport, dragAnchorId);

  // Annotations: rebuild on any scene change
  if (window.cratersDB) {
    PixiRenderer.rebuildAnnotations(transformFn, window.cratersDB, viewport, canvasW, canvasH);
  }

  dirtyEphemeris = false;
}

/**
 * PixiJS ticker callback — replaces the old requestAnimationFrame renderLoop.
 */
function renderTick(ticker) {
  // FPS counter
  frameCount++;
  const now = performance.now();
  if (now - fpsTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    fpsTime = now;
    if (fpsDisplay) fpsDisplay.textContent = `${fps} FPS`;
  }

  const timeSinceLastInteraction = Date.now() - lastInteractionTime;
  const viewportZoomChanged = Math.abs(viewport.scale - lastViewportScale) > 0.001;
  const viewportPanChanged = Math.abs(viewport.tx - _lastViewportTx) > 1 || Math.abs(viewport.ty - _lastViewportTy) > 1;

  if (viewportZoomChanged || viewportPanChanged) {
    _lastPanZoomTime = Date.now();
  }
  const timeSincePanZoom = Date.now() - _lastPanZoomTime;

  // ─── 1. FAST UPDATE (Every frame) ───
  // Update viewport container (GPU-fast transform)
  PixiRenderer.updateViewport(viewport);
  
  // Utiliser uniquement les vrais pan/zoom pour masquer les textes
  const isInteracting = isDragging || timeSincePanZoom < 150;

  // Update labels scales immediately so they remain readable during zoom
  if (PixiRenderer.showLabels && PixiRenderer.showLabels()) {
    PixiRenderer.updateAnnotationsTransform(viewport, isInteracting, mouseX, mouseY);
  }

  // ─── 2. SLOW QUALITY REBUILD (Debounced) ───
  // If we are idle for 150ms and a change occurred, we rebuild the sharp lines (CPU-heavy)
  if ((layerTransformDirty || viewportZoomChanged || viewportPanChanged) && projectedFeatures) {
    if (timeSinceLastInteraction > 150 || layerTransformDirty) {
      // Snapshot dirty flag BEFORE updateLayerCache() clears it
      const hadTransformChange = layerTransformDirty;
      if (layerTransformDirty) updateLayerCache();
      rebuildScene(false, hadTransformChange);
      lastViewportScale = viewport.scale;
      _lastViewportTx = viewport.tx;
      _lastViewportTy = viewport.ty;
    }
  }
}

// ─── Bootstrap ───
document.addEventListener('DOMContentLoaded', init);
