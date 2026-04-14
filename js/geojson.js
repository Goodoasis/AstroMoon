/**
 * AstroMoon — GeoJSON Projector
 * Contains purely mathematical projections (orthographic with libration).
 * Note: Parsing and LOD generation is now completely offloaded to geojson_worker.js!
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
  if (cosC < 0) return null;

  const x = Math.cos(rLat) * Math.sin(rLon - lon0);
  const y = Math.cos(lat0) * Math.sin(rLat) - Math.sin(lat0) * Math.cos(rLat) * Math.cos(rLon - lon0);

  return [(x * 0.5) + 0.5, (-y * 0.5) + 0.5];
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

export const GeoJSON = {
  projectPoint,
  inverseProject
};
