/**
 * AstroMoon — Layer Loader
 * Manages loading of GeoJSON from worker and craters JSON.
 */

import { layerState } from '../stores/layerState.svelte.js';
import { moonState } from '../stores/moonState.svelte.js';
import { LOD } from './config.js';
import { GeoJSON } from './geojson.js';
import { GeoJSONLod } from './geojson_lod.js';
import { computeNormBounds, updateLayerCache, rebuildScene } from './renderLoop.js';

export async function loadLayersAsync() {
  console.log("Loading layers via Web Worker...");
  try {
    const resp = await fetch('calque_geojson/layers.json');
    if (!resp.ok) throw new Error("Could not load layers.json index");
    const layerEntries = await resp.json();

    const baseUrl = new URL('calque_geojson/', window.location.href).href;
    const layers = layerEntries.map((entry, i) => {
      const fileName = entry;
      return {
        url: `${baseUrl}${fileName}`,
        layerIndex: i,
        fileName,
        epsilons: LOD.layerOverrides && LOD.layerOverrides[fileName] ? LOD.layerOverrides[fileName] : null
      };
    });
    layerState.layerCount = layers.length;
    layerState.loadedLayerNames = layerEntries;

    // Use Vite's native worker import semantics (query ?worker)
    // Wait, dynamic new Worker is fine if we use the right syntax for Vite.
    // It's safer to use the standard syntax that Vite intercepts:
    const WorkerImpl = (await import('./geojson_worker.js?worker')).default;
    const worker = new WorkerImpl();
    
    let receivedCount = 0;

    worker.onmessage = (e) => {
      const msg = e.data;

      if (msg.type === 'layerReady') {
        const features = msg.features;
        layerState.allRawFeatures = layerState.allRawFeatures.concat(features);
        receivedCount++;

        console.log(`Layer loaded: ${layers[msg.layerIndex].fileName} (${features.length} features)`);
        
        // Dispatch toast event from outside if needed
        const event = new CustomEvent('toast', { detail: `Calque ${receivedCount}/${layerState.layerCount} chargé` });
        window.dispatchEvent(event);

        layerState.projectedFeatures = layerState.allRawFeatures;
        layerState.lodEnabled = true;

        updateGeoJSONProjection();
        layerState.layerTransformDirty = true;
        updateLayerCache();
        rebuildScene(true);
      } else if (msg.type === 'allDone') {
        console.log(`All ${layerState.layerCount} layers loaded via Worker.`);
        worker.terminate();
      } else if (msg.type === 'error') {
        console.warn(`Worker error on layer ${msg.layerIndex}: ${msg.message}`);
      }
    };

    worker.onerror = (err) => {
      console.error('GeoJSON Worker fatal error:', err);
      const event = new CustomEvent('toast', { detail: 'Erreur Worker — fallback synchrone...' });
      window.dispatchEvent(event);
      worker.terminate();
      loadLayersFallback(layers);
    };

    const libLat = moonState ? (moonState.librationLat || 0) : 0;
    const libLon = moonState ? (moonState.librationLon || 0) : 0;

    worker.postMessage({
      type: 'processAll',
      layers: layers.map(l => ({ url: l.url, layerIndex: l.layerIndex, epsilons: l.epsilons })),
      librationLat: libLat,
      librationLon: libLon
    });

  } catch (err) {
    console.error("Failed to load layers.json index:", err);
    window.dispatchEvent(new CustomEvent('toast', { detail: 'Erreur chargement calques' }));
  }
}

export async function loadLayersFallback(layers) {
  for (const layer of layers) {
    try {
      const fileResp = await fetch(`calque_geojson/${layer.fileName}`);
      if (!fileResp.ok) continue;
      const text = await fileResp.text();
      const newData = GeoJSON.parse(text);

      const idx = layerState.loadedLayerNames.length;
      newData.features.forEach(f => f.layerIndex = idx);

      const epsilons = layer.epsilons || undefined; 
      GeoJSONLod.generateLODs(newData.features, epsilons);

      layerState.allRawFeatures = layerState.allRawFeatures.concat(newData.features);
      layerState.loadedLayerNames.push(layer.fileName);
      console.log(`[Fallback] Layer loaded: ${layer.fileName}`);
    } catch (err) {
      console.warn(`Error loading layer ${layer.fileName}:`, err);
    }
  }

  if (layerState.allRawFeatures.length > 0) {
    layerState.projectedFeatures = GeoJSON.project(layerState.allRawFeatures);
    layerState.lodEnabled = true;
    updateGeoJSONProjection();
    layerState.layerTransformDirty = true;
    updateLayerCache();
    rebuildScene(true);
  }
}

export function updateGeoJSONProjection() {
  if (!layerState.projectedFeatures) return;
  if (!moonState) return;

  const lat0 = (moonState.librationLat || 0) * Math.PI / 180;
  const lon0 = (moonState.librationLon || 0) * Math.PI / 180;
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);

  function projectInplace(lon, lat) {
    const rLon = lon * Math.PI / 180;
    const rLat = lat * Math.PI / 180;
    const sinRLat = Math.sin(rLat);
    const cosRLat = Math.cos(rLat);
    const cosLonDiff = Math.cos(rLon - lon0);

    const cosC = sinLat0 * sinRLat + cosLat0 * cosRLat * cosLonDiff;
    if (cosC < 0) return null;

    const x = cosRLat * Math.sin(rLon - lon0);
    const y = cosLat0 * sinRLat - sinLat0 * cosRLat * cosLonDiff;

    return { nx: (x * 0.5) + 0.5, ny: (-y * 0.5) + 0.5 };
  }

  for (const feature of layerState.projectedFeatures) {
    if (feature.coords && feature.projectedCoords) {
      for (let r = 0; r < feature.coords.length; r++) {
        const ring = feature.coords[r];
        const buf = feature.projectedCoords[r];
        if (!ring || !buf) continue;
        for (let i = 0; i < ring.length; i++) {
          const pt = ring[i];
          if (!pt) { buf[i * 2] = NaN; buf[i * 2 + 1] = NaN; }
          else {
            const p = projectInplace(pt[0], pt[1]);
            if (p) { buf[i * 2] = p.nx; buf[i * 2 + 1] = p.ny; }
            else { buf[i * 2] = NaN; buf[i * 2 + 1] = NaN; }
          }
        }
      }
    }

    if (feature.lodCoords && feature.projectedLodCoords) {
      for (let l = 0; l < feature.lodCoords.length; l++) {
        const lodRings = feature.lodCoords[l];
        const lodBufs = feature.projectedLodCoords[l];
        if (!lodRings || !lodBufs) continue;
        for (let r = 0; r < lodRings.length; r++) {
          const ring = lodRings[r];
          const buf = lodBufs[r];
          if (!ring || !buf) continue;
          for (let i = 0; i < ring.length; i++) {
            const pt = ring[i];
            if (!pt) { buf[i * 2] = NaN; buf[i * 2 + 1] = NaN; }
            else {
              const p = projectInplace(pt[0], pt[1]);
              if (p) { buf[i * 2] = p.nx; buf[i * 2 + 1] = p.ny; }
              else { buf[i * 2] = NaN; buf[i * 2 + 1] = NaN; }
            }
          }
        }
      }
    }
    computeNormBounds(feature);
  }
}

export function updateCratersProjection() {
  if (!layerState.cratersDB || !moonState) return;
  for (const crater of layerState.cratersDB) {
    const proj = GeoJSON.projectPoint(crater.longitude, crater.latitude);
    if (proj) {
      crater.nx = proj[0];
      crater.ny = proj[1];
    } else {
      crater.nx = null; crater.ny = null;
    }
  }
}

export async function initCraters() {
  if (layerState.cratersDB) return;
  try {
    const res = await fetch('calque_geojson/cratere_nomenclature.geojson');
    if (!res.ok) throw new Error("Could not load cratere_nomenclature.geojson");
    const geojsonData = await res.json();
    
    const array = [];
    const DEG2RAD = Math.PI / 180;
    
    for (const feature of geojsonData.features) {
      if (!feature.properties) continue;
      const props = feature.properties;
      const name = props.name;
      const diameter = props.diameter || 0;
      const lat = props.center_lat;
      const lon = props.center_lon;
      
      if (name === "--" || lat === undefined || lon === undefined) continue;
      
      // Filter out far side (approx > 90 and < 270)
      if (lon > 90 && lon < 270) continue;

      const latRad = lat * DEG2RAD;
      const lonRad = lon * DEG2RAD;
      
      let sortWeight = diameter;
      // Les Statio (Sondes/Bases) passent avant tout le monde
      if (props.type === 'Statio') sortWeight += 10000;
      // Léger bonus pour les autres (Mers, Montagnes) sans cacher les cratères géants
      else if (props.type !== 'Crater, craters' && props.type !== 'Satellite Feature') sortWeight += 10;
      
      array.push({
        name: name,
        diameter: diameter,
        latitude: lat,
        longitude: lon,
        type: props.type,
        sortWeight: sortWeight,
        sinLat: Math.sin(latRad),
        cosLat: Math.cos(latRad),
        lonRad: lonRad,
        nx: null,
        ny: null
      });
    }
    
    // Sort by priority weight descending, so special features & largest appear first
    array.sort((a, b) => b.sortWeight - a.sortWeight);
    layerState.cratersDB = array;
    updateCratersProjection();
  } catch (err) {
    console.error("Failed to init craters:", err);
  }
}
