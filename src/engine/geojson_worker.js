/**
 * AstroMoon — GeoJSON Web Worker
 * 
 * Offloads heavy JSON parsing + LOD generation to a background thread.
 * Keeps the main thread responsive, especially on low-end laptops.
 * 
 * Protocol:
 *   Main → Worker:  { type: 'processLayer', url: string, layerIndex: number }
 *   Main → Worker:  { type: 'processAll', layers: [{ url, layerIndex }] }
 *   Worker → Main:  { type: 'layerReady', layerIndex, features, stats }
 *   Worker → Main:  { type: 'allDone', totalStats }
 *   Worker → Main:  { type: 'error', layerIndex, message }
 * 
 * This worker has NO access to DOM, PixiJS, or window.appMoonState.
 * Projection (projectPoint) is done on the main thread after receiving features.
 */

import { GeoJSONLod } from './geojson_lod.js';

// ─── Geometry Normalization (mirrored from geojson.js, kept minimal) ───

function normalizeGeometry(geom) {
  switch (geom.type) {
    case 'Point':
      return { type: 'point', coords: [[[geom.coordinates[0], geom.coordinates[1]]]] };

    case 'MultiPoint':
      return { type: 'point', coords: [geom.coordinates.map(c => [c[0], c[1]])] };

    case 'LineString':
      return { type: 'line', coords: [geom.coordinates.map(c => [c[0], c[1]])] };

    case 'MultiLineString':
      return {
        type: 'line',
        coords: geom.coordinates.map(line => line.map(c => [c[0], c[1]]))
      };

    case 'Polygon':
      return {
        type: 'polygon',
        coords: geom.coordinates.map(ring => ring.map(c => [c[0], c[1]]))
      };

    case 'MultiPolygon':
      return {
        type: 'polygon',
        coords: geom.coordinates.flat().map(ring => ring.map(c => [c[0], c[1]]))
      };

    default:
      return null;
  }
}

function parseGeoJSON(text) {
  const data = JSON.parse(text);
  if (data.type !== 'FeatureCollection') {
    throw new Error('Expected a FeatureCollection');
  }

  const features = [];

  for (const feature of data.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    const normalized = normalizeGeometry(geom);
    if (!normalized) continue;

    features.push({
      type: normalized.type,
      coords: normalized.coords,
      properties: feature.properties || {},
      layerIndex: 0
    });
  }

  return features;
}

// ─── Mathematical Projection (Moved from main thread) ───

function projectPoint(lon, lat, librationLat, librationLon) {
  const lat0 = librationLat * Math.PI / 180;
  const lon0 = librationLon * Math.PI / 180;

  const rLon = lon * Math.PI / 180;
  const rLat = lat * Math.PI / 180;

  const cosC = Math.sin(lat0) * Math.sin(rLat) + Math.cos(lat0) * Math.cos(rLat) * Math.cos(rLon - lon0);
  if (cosC < 0) return null;

  const x = Math.cos(rLat) * Math.sin(rLon - lon0);
  const y = Math.cos(lat0) * Math.sin(rLat) - Math.sin(lat0) * Math.cos(rLat) * Math.cos(rLon - lon0);

  return [(x * 0.5) + 0.5, (-y * 0.5) + 0.5];
}

function _projectRingsToBuffers(rings, librationLat, librationLon, transferables) {
  return rings.map(ring => {
    if (!Array.isArray(ring)) return null;
    const points = Array.isArray(ring[0]) ? ring : [ring];
    const buffer = new Float32Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      if (!pt) {
        buffer[i * 2] = NaN;
        buffer[i * 2 + 1] = NaN;
      } else {
        const p = projectPoint(pt[0], pt[1], librationLat, librationLon);
        if (p) {
          buffer[i * 2] = p[0];
          buffer[i * 2 + 1] = p[1];
        } else {
          buffer[i * 2] = NaN;
          buffer[i * 2 + 1] = NaN;
        }
      }
    }
    transferables.push(buffer.buffer);
    return buffer;
  });
}

// ─── Message Handler ───

const pendingLayers = [];
let totalLayers = 0;
let completedLayers = 0;
let globalStats = { totalOriginal: 0, totalPerLOD: [] };

async function processLayer(url, layerIndex, librationLat, librationLon, epsilons = undefined) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);

    const text = await resp.text();
    const features = parseGeoJSON(text);

    // Assign layer index
    for (const f of features) {
      f.layerIndex = layerIndex;
    }

    // Generate LOD levels (Douglas-Peucker simplification)
    // Use per-layer epsilons if provided, otherwise default from config
    const stats = GeoJSONLod.generateLODs(features, epsilons);

    const transferables = [];

    // Project LOD coords to zero-copy Float32Array explicitly
    for (const f of features) {
      if (f.coords) {
        f.projectedCoords = _projectRingsToBuffers(f.coords, librationLat, librationLon, transferables);
      }
      if (f.lodCoords) {
        f.projectedLodCoords = new Array(f.lodCoords.length);
        for (let level = 0; level < f.lodCoords.length; level++) {
          f.projectedLodCoords[level] = _projectRingsToBuffers(f.lodCoords[level], librationLat, librationLon, transferables);
        }
      }
    }

    // Accumulate global stats
    globalStats.totalOriginal += stats.totalOriginal;
    // Grow totalPerLOD array if needed (handles different epsilon counts)
    while (globalStats.totalPerLOD.length < stats.totalPerLOD.length) {
      globalStats.totalPerLOD.push(0);
    }
    for (let i = 0; i < stats.totalPerLOD.length; i++) {
      globalStats.totalPerLOD[i] += stats.totalPerLOD[i];
    }

    // Send features + LOD data back to main thread
    self.postMessage({
      type: 'layerReady',
      layerIndex,
      features,
      stats
    }, transferables);

  } catch (err) {
    self.postMessage({
      type: 'error',
      layerIndex,
      message: err.message
    });
  }
}

async function processAll(layers, librationLat, librationLon) {
  totalLayers = layers.length;
  completedLayers = 0;
  globalStats = { totalOriginal: 0, totalPerLOD: [] };

  for (const { url, layerIndex, epsilons } of layers) {
    await processLayer(url, layerIndex, librationLat, librationLon, epsilons || undefined);
    completedLayers++;
  }

  self.postMessage({
    type: 'allDone',
    totalStats: globalStats
  });
}

self.onmessage = (e) => {
  const msg = e.data;

  switch (msg.type) {
    case 'processLayer':
      processLayer(msg.url, msg.layerIndex, msg.librationLat, msg.librationLon);
      break;

    case 'processAll':
      processAll(msg.layers, msg.librationLat, msg.librationLon);
      break;

    default:
      console.warn('GeoJSON Worker: unknown message type', msg.type);
  }
};
