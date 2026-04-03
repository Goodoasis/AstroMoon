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
  function project(features) {
    return features.map(f => ({
      type: f.type,
      properties: f.properties,
      layerIndex: f.layerIndex,
      projectedCoords: f.coords.map(ring =>
        ring.map(([lon, lat]) => {
          // If the point is on the far side of the moon, project as null (clipped)
          if (lon < -90 || lon > 90) return null;

          // Convert to radians
          const rLon = lon * Math.PI / 180;
          const rLat = lat * Math.PI / 180;

          // Pure Orthographic Projection mathematics
          // Sphere radius = 0.5 to fit nicely inside [0, 1]
          let x = 0.5 * Math.cos(rLat) * Math.sin(rLon);
          let y = -0.5 * Math.sin(rLat); // Invert Y for canvas

          // Center on [0.5, 0.5]
          return [x + 0.5, y + 0.5];
        })
      )
    }));
  }

  /**
   * Inverse Orthographic Projection.
   * Converts [nx, ny] back to geographical [lon, lat].
   * @param {number} nx - Normalized X [0, 1]
   * @param {number} ny - Normalized Y [0, 1]
   * @returns {{lon: number, lat: number}|null} Returns null if point is outside the moon's visible disk.
   */
  function inverseProject(nx, ny) {
    const dx = (nx - 0.5) * 2.0;
    const dy = (0.5 - ny) * 2.0; // Y is inverted back
    const rho2 = dx * dx + dy * dy;

    if (rho2 > 1.0) return null; // Outside the spherical horizon

    const latRad = Math.asin(dy);
    const lonRad = Math.atan2(dx, Math.sqrt(1 - rho2));

    return {
      lon: lonRad * 180 / Math.PI,
      lat: latRad * 180 / Math.PI
    };
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
    countPoints
  };
})();
