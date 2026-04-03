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

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
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
      item.innerHTML = `<span>📌 #${a.id}</span> <button>✕</button>`;
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
