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
import { viewportState } from '@/stores/viewportState.svelte.js';
import { Transform } from './transform.js';
import { WeatherProvider } from './WeatherProvider.js';

// Cache en RAM pour éviter d'appeler asynchronement le cache du moteur ou de ping l'API
let lastWeatherFetch = { lat: null, lon: null, time: null, data: null };
let weatherDebounceTimer = null;
let isApplyingWeatherRefresh = false; // LATCH ANTI-INFINILOOP
let lastLoggedSquashY = null; // Suivi pour affichage sélectif de la réfraction

/**
 * Calcule la réfraction atmosphérique (Formule empirique de Bennett).
 * Retourne la réfraction en degrés.
 */
function getRefractionDegrees(altitudeDeg, tempC, pressureHpa) {
  if (altitudeDeg <= -0.5) return 0; // Sous l'horizon
  const h = Math.max(0, altitudeDeg); // Clamped pour Bennett
  // Formule de Bennett pour l'angle de réfraction en arcminutes (cotangente = 1 / tan)
  const rArcmin = 1.0 / Math.tan((h + 7.31 / (h + 4.4)) * Math.PI / 180);
  
  // Correction météo de Saastamoinen (Pression atmosphérique standard = 1013.25 hPa)
  const cW = (pressureHpa / 1013.25) * (283.15 / (273.15 + tempC));
  const R_actual = rArcmin * cW;
  
  return R_actual / 60.0; // Conversion en degrés
}

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

      // Calcul de l'altitude vraie
      const sinH = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(lha);
      const hTrueDeg = Math.asin(sinH) * RAD2DEG;

      // 4b. Refraction Atmosphérique & Écrasement
      let squashY = 1.0;
      
      const dt = validDate.getTime();
      let weather = lastWeatherFetch.data;
      
      const latState = Number(spatialState.lat) || 0;
      const lonState = Number(spatialState.lon) || 0;
      
      const timeDiff = Math.abs((lastWeatherFetch.time || 0) - dt);
      const latDiff = Math.abs((lastWeatherFetch.lat || 0) - latState);
      const lonDiff = Math.abs((lastWeatherFetch.lon || 0) - lonState);
      
      // La tolérance de l'utilisateur : 5 heures (18 000 000 ms) et ~50km (0.5 degrés)
      const needsWeatherUpdate = (latDiff > 0.5 || lonDiff > 0.5 || timeDiff > 18000000);
      
      if (isApplyingWeatherRefresh) {
          // INTERCEPTION STADIQUE POUR EMPÊCHER LE INFINILOOP
          isApplyingWeatherRefresh = false; // On reset le lock
      } else if (needsWeatherUpdate) { 
          
          if (weatherDebounceTimer) clearTimeout(weatherDebounceTimer);
          
          weatherDebounceTimer = setTimeout(async () => {
              // L'API ne se déclenche QUE si la localisation provient d'une source vérifiée :
              // - EXIF détecté ('exif-loc')
              // - GPS du navigateur ('geoloc')
              // - Ville sélectionnée via la barre de recherche Nominatim (city n'est ni vide, ni la tour eiffel par defaut)
              const hasExplicitLocation = (
                  spatialState.source === 'geoloc' || 
                  spatialState.source === 'exif-loc' || 
                  (spatialState.source === 'ville' && spatialState.city && spatialState.city !== 'Eiffel Tower, Paris')
              );

              if (!viewportState.appReady || !hasExplicitLocation) {
                  console.log("[Réfraction] Appel API en attente : L'utilisateur n'a pas encore défini son lieu.");
                  lastWeatherFetch = { lat: latState, lon: lonState, time: dt, data: null };
              } else {
                  console.log("[Réfraction] Fin du Debounce, évaluation de la Météo...");
                  const newWeather = await WeatherProvider.getWeatherData(latState, lonState, dt);
                  lastWeatherFetch = { lat: latState, lon: lonState, time: dt, data: newWeather };
                  
                  if (newWeather) {
                      if (newWeather.isFromCache) {
                          console.log(`[Réfraction] ⚡ INSTANTANÉ: Données piochées dans le Cache Navigateur. (Redraw)`);
                      } else {
                          console.log(`[Réfraction] 🌍 API RÉSEAU APPELÉE avec succès -> Mise en Cache RAM. (Redraw)`);
                      }
                      isApplyingWeatherRefresh = true; // ON LOCK LE PROCHAIN PASSAGE DE LA FONCTION
                      document.dispatchEvent(new CustomEvent('ephemeris-async-refresh'));
                  }
              }
          }, 1500); // 1.5s de DELAI pour laisser le temps de taper une date complète au clavier
      }
      
      if (weather && hTrueDeg > 0 && hTrueDeg < 80) {
        // La taille apparente de la lune est ~0.5°
        const hTop = hTrueDeg + 0.25;
        const hBottom = hTrueDeg - 0.25;
        
        const rTop = getRefractionDegrees(hTop, weather.temperature, weather.pressure);
        const rBottom = getRefractionDegrees(hBottom, weather.temperature, weather.pressure);
        
        const angularDiameter = 0.5;
        const apparentDiameter = angularDiameter + rTop - rBottom;
        squashY = Math.max(0.5, Math.min(1.0, apparentDiameter / angularDiameter));
      }

      // Appliquer la déformation.
      // - L'axe de Zénith (celui écrasé par l'atmosphère) a un angle -q en mode équatorial, 
      // ou 0 en mode Alt-Az (car on a déjà tourné la lune de q).
      const zenithAngle = isAltAzMode ? 0 : -q * Math.PI / 180;
      
      // Log de debug uniquement en cas de changement notable (évite le spam)
      if (Math.abs((lastLoggedSquashY || 0) - squashY) > 0.0001) {
          lastLoggedSquashY = squashY;
          if (squashY < 1.0) {
              const squashPercent = ((1.0 - squashY) * 100).toFixed(4);
              console.log(`[Physique] Écrasement Atmosphérique mis à jour : Ratio k = ${squashY.toFixed(5)} (-${squashPercent}%)`);
          } else {
              console.log(`[Physique] Écrasement Atmosphérique Inactif (Altitude négative ou absence de météo). Ratio k = 1.0`);
          }
      }
      
      Transform.setRefraction(squashY, zenithAngle);

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
