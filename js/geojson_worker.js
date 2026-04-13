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

// ─── Message Handler ───

const pendingLayers = [];
let totalLayers = 0;
let completedLayers = 0;
let globalStats = { totalOriginal: 0, totalPerLOD: [0, 0, 0] };

async function processLayer(url, layerIndex) {
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
    const stats = GeoJSONLod.generateLODs(features);

    // Accumulate global stats
    globalStats.totalOriginal += stats.totalOriginal;
    for (let i = 0; i < stats.totalPerLOD.length; i++) {
      globalStats.totalPerLOD[i] += stats.totalPerLOD[i];
    }

    // Send features + LOD data back to main thread
    self.postMessage({
      type: 'layerReady',
      layerIndex,
      features,
      stats
    });

  } catch (err) {
    self.postMessage({
      type: 'error',
      layerIndex,
      message: err.message
    });
  }
}

async function processAll(layers) {
  totalLayers = layers.length;
  completedLayers = 0;
  globalStats = { totalOriginal: 0, totalPerLOD: [0, 0, 0] };

  for (const { url, layerIndex } of layers) {
    await processLayer(url, layerIndex);
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
      processLayer(msg.url, msg.layerIndex);
      break;

    case 'processAll':
      processAll(msg.layers);
      break;

    default:
      console.warn('GeoJSON Worker: unknown message type', msg.type);
  }
};
