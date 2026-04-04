/**
 * AstroAz — Main Application Orchestrator
 * Handles interaction, file uploads, and the main render loop.
 */

(() => {
  'use strict';

  // ─── State ───
  let canvas, ctx;
  let canvasW = 0, canvasH = 0;
  let dpr = 1;

  let backgroundImage = null;
  let projectedFeatures = null;
  let layerTransformDirty = true; 

  let allRawFeatures = [];
  let mergedBounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  let loadedLayerNames = [];
  let layerCount = 0;

  let viewport = { tx: 0, ty: 0, scale: 1 };

  let mode = 'navigate'; // 'navigate' | 'anchor'
  let isDragging = false;
  let dragType = null;
  let dragStart = { x: 0, y: 0 };
  let dragAnchorId = null;
  let dragAnchorOffset = { x: 0, y: 0 };
  let lastRotationAngle = 0;

  let frameCount = 0;
  let fpsTime = 0;
  let fps = 0;

  // ─── Time Widget State ───
  window.appTemporalTime = new Date();
  let timeSource = 'manual'; // 'name', 'exif', 'manual'
  let userManualDate = new Date();
  let parsedNameDate = null;
  let parsedExifDate = null;

  // ─── Location Widget State ───
  window.appSpatialLocation = { lat: 0, lon: 0 };
  let locSource = 'ville'; // 'geoloc', 'exif-loc', 'ville'
  let userManualLocation = { lat: 48.85, lon: 2.35, name: "" };
  let parsedExifGps = null;
  let geolocGps = null;
  let locDebounceTimer = null;

  // ─── DOM References ───
  const imageInput = document.getElementById('input-image');
  const geojsonInput = document.getElementById('input-geojson');
  const btnImage = document.getElementById('btn-upload-image');
  const btnGeoJSON = document.getElementById('btn-upload-geojson');
  const btnAnchorMode = document.getElementById('btn-anchor-mode');
  const btnReset = document.getElementById('btn-reset');
  const btnGrid = document.getElementById('btn-grid');
  const fpsDisplay = document.getElementById('fps-display');
  const anchorPanel = document.getElementById('anchor-panel');
  const anchorList = document.getElementById('anchor-list');
  const statusToast = document.getElementById('status-toast');
  const welcomeOverlay = document.getElementById('welcome-overlay');
  const btnWelcomeImage = document.getElementById('btn-welcome-image');
  const btnWelcomeGeoJSON = document.getElementById('btn-welcome-geojson');
  const btnLabels = document.getElementById('btn-labels');

  function init() {
    canvas = document.getElementById('main-canvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);

    btnImage.addEventListener('click', () => imageInput.click());
    btnGeoJSON.addEventListener('click', () => geojsonInput.click());
    btnAnchorMode.addEventListener('click', toggleAnchorMode);
    btnReset.addEventListener('click', resetAll);
    btnGrid.addEventListener('click', () => {
      const on = Renderer.toggleGrid();
      btnGrid.classList.toggle('active', on);
    });
    btnLabels.addEventListener('click', () => {
      const on = Renderer.toggleLabels();
      btnLabels.classList.toggle('active', on);
    });

    btnWelcomeImage.addEventListener('click', () => imageInput.click());
    btnWelcomeGeoJSON.addEventListener('click', () => geojsonInput.click());
    imageInput.addEventListener('change', handleImageUpload);
    geojsonInput.addEventListener('change', handleGeoJSONUpload);

    // --- Time Widget ---
    document.getElementById('time-input').addEventListener('change', (e) => {
      if (timeSource === 'manual') {
        userManualDate = new Date(e.target.value);
        window.appTemporalTime = userManualDate;
        console.log("Manuel : temps mis à jour =>", window.appTemporalTime);
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

    ['geoloc', 'exif-loc', 'ville'].forEach(src => {
      document.getElementById(`src-${src}`).addEventListener('click', (e) => {
        if (!e.target.classList.contains('disabled')) setLocSource(src);
      });
    });

    setLocSource('ville');

    Transform.reset(canvasW, canvasH);
    requestAnimationFrame(renderLoop);
    updateCursor();

    if (window.CRATERS_RAW_DATA) {
      const data = window.CRATERS_RAW_DATA;
      const craters = [];
      for (const [name, props] of Object.entries(data)) {
        let lon = props.longitude;
        let lat = props.latitude;
        if (lon > 180) lon -= 360;
        if (lon < -90 || lon > 90) continue; 
        let rLon = lon * Math.PI / 180;
        let rLat = lat * Math.PI / 180;
        let x = 0.5 * Math.cos(rLat) * Math.sin(rLon) + 0.5;
        let y = -0.5 * Math.sin(rLat) + 0.5;
        craters.push({ name: name, diameter: props.diameter, nx: x, ny: y });
      }
      window.cratersDB = craters;
      console.log(`Loaded ${craters.length} craters`);
    } else {
      console.error("Crater DB Error: window.CRATERS_RAW_DATA is missing.");
    }
  }

  function updateLayerCache() {
    if (!projectedFeatures) return;
    const transformFn = Anchors.getTransformFunction();
    for (const feature of projectedFeatures) {
      if (!feature.renderedCoords) {
        feature.renderedCoords = new Array(feature.projectedCoords.length);
      }
      for (let r = 0; r < feature.projectedCoords.length; r++) {
        const ring = feature.projectedCoords[r];
        if (!feature.renderedCoords[r] || feature.renderedCoords[r].length !== ring.length) {
          feature.renderedCoords[r] = ring.map(() => ({ x: 0, y: 0 }));
        }
        const cachedRing = feature.renderedCoords[r];
        for (let i = 0; i < ring.length; i++) {
          if (ring[i] === null) {
            cachedRing[i].x = null; cachedRing[i].y = null;
          } else {
            const pt = transformFn(ring[i][0], ring[i][1]);
            cachedRing[i].x = pt.x; cachedRing[i].y = pt.y;
          }
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

  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    const oldW = canvasW, oldH = canvasH;
    canvasW = window.innerWidth; canvasH = window.innerHeight;
    canvas.width = canvasW * dpr; canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + 'px'; canvas.style.height = canvasH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Transform.handleResize(oldW, oldH, canvasW, canvasH);
    layerTransformDirty = true;
  }

  function formatForDatetimeLocal(date) {
    if (!date || isNaN(date.getTime())) return '';
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  }

  function extractDateFromName(filename) {
    const rx1 = /(\d{4})[-_]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})?[-_]?(\d{2})?[-_]?(\d{2})?/;
    const m = filename.match(rx1);
    if (m && m[1] >= 1900 && m[1] <= 2100 && m[2] >= 1 && m[2] <= 12 && m[3] >= 1 && m[3] <= 31) {
      const d = new Date(m[1], m[2]-1, m[3], m[4]||0, m[5]||0, m[6]||0);
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
    } catch(e) {
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
    } catch(e) {
      console.warn("Erreur Nominatim:", e);
    }
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
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Parse les données temporelles et spatiales (EXIF complet)
    parsedNameDate = extractDateFromName(file.name);
    try {
      if (window.MiniExif) {
        const meta = await MiniExif.extractMetaData(file);
        parsedExifDate = meta.date;
        parsedExifGps = meta.gps;
      }
    } catch(err) {
      parsedExifDate = null;
      parsedExifGps = null;
    }

    const btnName = document.getElementById('src-name');
    const btnExif = document.getElementById('src-exif');
    const btnExifLoc = document.getElementById('src-exif-loc');
    
    btnName.classList.toggle('disabled', !parsedNameDate);
    btnExif.classList.toggle('disabled', !parsedExifDate);
    btnExifLoc.classList.toggle('disabled', !parsedExifGps);

    // Priorité Nom > Exif > Manuel
    if (parsedNameDate) setTimeSource('name');
    else if (parsedExifDate) setTimeSource('exif');
    else {
      setTimeSource('manual');
      document.getElementById('time-input').value = formatForDatetimeLocal(new Date());
    }

    // Priorité EXIF > Ville (On ne force pas géoloc auto pour ne pas poper à l'upload sans consentement)
    if (parsedExifGps) setLocSource('exif-loc');
    else setLocSource('ville');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => { backgroundImage = img; showToast(`Image: ${file.name}`); hideWelcome(); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleGeoJSONUpload(e) {
    const files = Array.from(e.target.files);
    let processed = 0, newCount = 0;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const newData = GeoJSON.parse(ev.target.result);
          const idx = layerCount++; newCount++;
          newData.features.forEach(f => f.layerIndex = idx);
          allRawFeatures = allRawFeatures.concat(newData.features);
          mergedBounds.minLon = Math.min(mergedBounds.minLon, newData.bounds.minLon);
          mergedBounds.maxLon = Math.max(mergedBounds.maxLon, newData.bounds.maxLon);
          mergedBounds.minLat = Math.min(mergedBounds.minLat, newData.bounds.minLat);
          mergedBounds.maxLat = Math.max(mergedBounds.maxLat, newData.bounds.maxLat);
        } catch(e){}
        if (++processed === files.length) {
          projectedFeatures = GeoJSON.project(allRawFeatures, mergedBounds);
          layerTransformDirty = true; hideWelcome();
          if (layerCount === newCount) Transform.reset(canvasW, canvasH);
          showToast(`${layerCount} calques actifs`);
        }
      };
      reader.readAsText(file);
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
    const mx = e.clientX, my = e.clientY;
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

  function onMouseUp() { isDragging = false; dragType = null; updateCursor(); }

  function onWheel(e) {
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
    if (mode === 'anchor') {
      const near = Anchors.findNear(e.clientX, e.clientY, viewport);
      if (near) { Anchors.remove(near.id); layerTransformDirty = true; updateAnchorPanel(); }
    }
  }

  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'a' || e.key === 'A') toggleAnchorMode();
    if (e.key === 'g' || e.key === 'G') btnGrid.classList.toggle('active', Renderer.toggleGrid());
    if (e.key === 'l' || e.key === 'L') btnLabels.classList.toggle('active', Renderer.toggleLabels());
    if (e.key === 'f' || e.key === 'F') viewport = { tx: 0, ty: 0, scale: 1 };
    if (e.key === 'Escape' && mode === 'anchor') toggleAnchorMode();
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
  function hideWelcome() { if (backgroundImage || projectedFeatures) welcomeOverlay.classList.add('hidden'); }

  function renderLoop(timestamp) {
    frameCount++;
    if (timestamp - fpsTime >= 1000) { fps = frameCount; frameCount = 0; fpsTime = timestamp; fpsDisplay.textContent = `${fps} FPS`; }
    if (layerTransformDirty && projectedFeatures) updateLayerCache();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);
    const transformFn = Anchors.getTransformFunction();
    if (backgroundImage) Renderer.drawBackground(ctx, backgroundImage, canvasW, canvasH, viewport);
    Renderer.drawGrid(ctx, transformFn, viewport);
    if (projectedFeatures) Renderer.drawGeoJSON(ctx, projectedFeatures, viewport, Anchors.count() > 0);
    Renderer.drawAnchors(ctx, Anchors.getAll(), viewport, dragAnchorId);
    if (window.cratersDB) Renderer.drawAnnotations(ctx, transformFn, viewport, window.cratersDB, canvasW, canvasH);
    requestAnimationFrame(renderLoop);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
