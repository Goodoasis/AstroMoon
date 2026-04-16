/**
 * AstroMoon — Ephemeris Calculator
 * Extracted from app.js — pure computation module with zero DOM dependencies.
 * Computes libration, moon phase, rotation, terminator from date + location.
 */

import {
  Observer, AstroTime, Body, Libration, MoonPhase,
  Equator, RotationAxis, SiderealTime,
  DEG2RAD, RAD2DEG, HOUR2RAD
} from './astronomy.js';
import { moonState } from '@/stores/moonState.svelte.js';
import { temporalState } from '@/stores/temporalState.svelte.js';
import { spatialState } from '@/stores/spatialState.svelte.js';
import { Transform } from './transform.js';

/**
 * Recalculate all ephemeris from current temporal + spatial state.
 * Updates moonState store in-place.
 * @param {boolean} isAltAzMode - Whether Alt-Az mount mode is active
 */
export function updateEphemeris(isAltAzMode = false) {
  const obs = new Observer(
    spatialState.lat || 0,
    spatialState.lon || 0,
    0
  );
  const rawDate = temporalState.time || new Date();
  const validDate = (rawDate instanceof Date && !isNaN(rawDate.getTime())) ? rawDate : new Date();
  const time = new AstroTime(validDate);
  let moonEq = null;

  // 1. Libration
  try {
    const lib = Libration(time);
    if (lib) {
      moonState.librationLon = lib.elon;
      moonState.librationLat = lib.elat;
    }
  } catch (e) { console.warn("Ephemeris [Libration]:", e.message); }

  // 2. Moon Phase (0-360)
  try {
    moonState.moonPhase360 = MoonPhase(time);
  } catch (e) { console.warn("Ephemeris [MoonPhase]:", e.message); }

  // 3. Moon equatorial coords
  try {
    moonEq = Equator(Body.Moon, time, obs, false, false);
  } catch (e) { console.warn("Ephemeris [MoonEquator]:", e.message); }

  // 4. Orientation / Rotation (PA + Q)
  try {
    const pole = RotationAxis(Body.Moon, time);
    if (pole && moonEq) {
      const raP = pole.ra * DEG2RAD;
      const decP = pole.dec * DEG2RAD;
      const raM = moonEq.ra * HOUR2RAD;
      const decM = moonEq.dec * DEG2RAD;
      const y = Math.cos(decP) * Math.sin(raP - raM);
      const x = Math.sin(decP) * Math.cos(decM) - Math.cos(decP) * Math.sin(decM) * Math.cos(raP - raM);
      const pa = Math.atan2(y, x) * RAD2DEG;

      const gast = SiderealTime(time);
      const lon = spatialState.lon || 0;
      const lat = spatialState.lat || 0;
      const last = (gast + lon / 15.0 + 24.0) % 24.0;
      const lha = (last - moonEq.ra + 24.0) % 24.0 * 15.0 * DEG2RAD;
      const phi = lat * DEG2RAD;
      const delta = moonEq.dec * DEG2RAD;

      const yQ = Math.sin(lha);
      const xQ = Math.tan(phi) * Math.cos(delta) - Math.sin(delta) * Math.cos(lha);
      const q = Math.atan2(yQ, xQ) * RAD2DEG;

      const rotationPA = isAltAzMode ? (pa + q) : pa;
      Transform.setRotation(rotationPA * Math.PI / 180);
    }
  } catch (e) { console.warn("Ephemeris [Rotation]:", e.message); }

  // 5. Bright Limb PA
  try {
    const sunEq = Equator(Body.Sun, time, obs, false, false);
    if (sunEq && moonEq) {
      const raS = sunEq.ra * HOUR2RAD;
      const decS = sunEq.dec * DEG2RAD;
      const raM = moonEq.ra * HOUR2RAD;
      const decM = moonEq.dec * DEG2RAD;
      const yS = Math.cos(decS) * Math.sin(raS - raM);
      const xS = Math.sin(decS) * Math.cos(decM) - Math.cos(decS) * Math.sin(decM) * Math.cos(raS - raM);
      moonState.brightLimbPA = Math.atan2(yS, xS) * RAD2DEG;
    }
  } catch (e) { console.warn("Ephemeris [BrightLimb]:", e.message); }

  // 6. Terminator
  const phase360 = moonState.moonPhase360 || 0;
  const sLon = (180 - phase360) + (moonState.librationLon || 0);
  moonState.sunLon = sLon;
  moonState.sunLat = 0;
  generateTerminator(sLon, 0);
}

/**
 * Generate terminator great-circle points from sub-solar coordinates.
 */
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
  moonState.terminatorGeoPoints = points;
}
