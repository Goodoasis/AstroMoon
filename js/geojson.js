/**
 * AstroAz — GeoJSON Parser & Projector
 * Handles parsing GeoJSON files and projecting lon/lat to canvas coordinates.
 * Supports multi-layer accumulation with layer index tracking.
 */

const GeoJSON = (() => {
  'use strict';

  /**
   * Parse a GeoJSON string into normalized features.
   * @param {string} text - Raw GeoJSON text
   * @returns {{ features: Array, bounds: {minLon, maxLon, minLat, maxLat}, name: string }}
   */
  function parse(text) {
    const data = JSON.parse(text);
    if (data.type !== 'FeatureCollection') {
      throw new Error('Expected a FeatureCollection');
    }

    const features = [];
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const feature of data.features) {
      const geom = feature.geometry;
      if (!geom) continue;

      const normalized = normalizeGeometry(geom);
      if (!normalized) continue;

      // Compute bounds
      for (const ring of normalized.coords) {
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }

      features.push({
        type: normalized.type,
        coords: normalized.coords,
        properties: feature.properties || {},
        layerIndex: 0 // Will be set during accumulation
      });
    }

    return {
      features,
      bounds: { minLon, maxLon, minLat, maxLat },
      name: data.name || 'unnamed'
    };
  }

  /**
   * Normalize various GeoJSON geometry types into a flat structure.
   */
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
        console.warn('Unsupported geometry type:', geom.type);
        return null;
    }
  }

  /**
   * Project GeoJSON features to [0, 1] normalized space based purely on global 
   * Orthographic projection (Sphere view from Earth).
   * Assumes prime meridian (lon=0, lat=0) is the center of the image.
   */
  /**
   * Project a single point (Lon/Lat) onto normalized [0, 1] orthographic coords.
   */
  function projectPoint(lon, lat) {
    if (!window.appMoonState) return null;
    const lat0 = (window.appMoonState.librationLat || 0) * Math.PI / 180;
    const lon0 = (window.appMoonState.librationLon || 0) * Math.PI / 180;

    const rLon = lon * Math.PI / 180;
    const rLat = lat * Math.PI / 180;

    const cosC = Math.sin(lat0) * Math.sin(rLat) + Math.cos(lat0) * Math.cos(rLat) * Math.cos(rLon - lon0);
    if (cosC < 0) return null; // Hidden side

    const x = Math.cos(rLat) * Math.sin(rLon - lon0);
    const y = Math.cos(lat0) * Math.sin(rLat) - Math.sin(lat0) * Math.cos(rLat) * Math.cos(rLon - lon0);

    return [(x * 0.5) + 0.5, (-y * 0.5) + 0.5];
  }

  function project(features) {
    return features.map(f => ({
      type: f.type,
      properties: f.properties,
      layerIndex: f.layerIndex,
      coords: f.coords,
      projectedCoords: f.coords.map(ring =>
        ring.map(([lon, lat]) => projectPoint(lon, lat))
      )
    }));
  }

  /**
   * Inverse Orthographic Projection with libration support.
   */
  function inverseProject(nx, ny) {
    const x = (nx - 0.5) * 2.0;
    const y = -(ny - 0.5) * 2.0;
    const rho = Math.hypot(x, y);
    if (rho > 1.0) return null;

    const lat0 = (window.appMoonState.librationLat || 0) * Math.PI / 180;
    const lon0 = (window.appMoonState.librationLon || 0) * Math.PI / 180;
    const c = Math.asin(rho);

    const lat = Math.asin(Math.cos(c) * Math.sin(lat0) + (y * Math.sin(c) * Math.cos(lat0)) / rho);
    const lon = lon0 + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(lat0) - y * Math.sin(c) * Math.sin(lat0));

    return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
  }

  /**
   * Count total number of coordinate points.
   */
  function countPoints(features) {
    let total = 0;
    for (const f of features) {
      const coords = f.projectedCoords || f.coords;
      for (const ring of coords) {
        total += ring.length;
      }
    }
    return total;
  }

  return {
    parse,
    project,
    inverseProject,
    projectPoint,
    countPoints
  };
})();
