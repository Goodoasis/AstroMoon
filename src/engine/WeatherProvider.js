import { WEATHER } from './config.js';

/**
 * Service pour récupérer la météo historique (Température et Pression) 
 * afin de permettre le calcul futur de l'indice de réfraction.
 */
export class WeatherProvider {
  /**
   * Récupère la température et la pression pour une coordonnée et un timestamp.
   * Stratégie de fallback : OWM (si < 45 jours) -> Visual Crossing.
   * Utilise le LocalStorage pour économiser les requêtes API (sauvegarde sans limite).
   * 
   * @param {number} lat Latitude
   * @param {number} lon Longitude
   * @param {number} timestamp Timestamp en millisecondes (ex: pris depuis l'EXIF)
   * @returns {Promise<{temperature: number, pressure: number, source: string} | null>}
   */
  static async getWeatherData(lat, lon, timestamp) {
    // Clé de cache lissant spatialement (arrondi à 0.5 degrés = ~55km) 
    // et temporellement (discrétisé par palier de 5 HEURES).
    // Répond strictement à la consigne : "(moins de 50km ou sur la meme soirée(5heures?)"
    const latRounding = (Math.round(lat * 2) / 2).toFixed(1);
    const lonRounding = (Math.round(lon * 2) / 2).toFixed(1);
    const timeChunk = Math.floor(timestamp / 18000000); // 18000000 ms = 5h
    
    const cacheKey = `weather_cache_${latRounding}_${lonRounding}_${timeChunk}`;
    
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        parsed.isFromCache = true;
        return parsed;
      } catch (e) {
        console.warn('WeatherProvider: Cache invalide, on ignore.', e);
      }
    }

    const now = Date.now();
    const ageMs = now - timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    let result = null;

    // 2. Logique de routage : OWM vs Visual Crossing
    // Règle 1: Si l'âge est < 45 jours -> Tentative via OWM.
    if (ageDays < WEATHER.owmMaxAgeDays) {
      result = await this.fetchFromOWM(lat, lon, timestamp);
      
      // Règle 2: Erreur OWM ou âge entre 45 et 47 (traité dans le else) -> Bascule sur VC
      if (!result) {
        console.log("WeatherProvider: Bascule sur Visual Crossing suite à l'échec d'OWM.");
        result = await this.fetchFromVisualCrossing(lat, lon, timestamp);
      }
    } else {
      // Règle 3: Si > 47 jours (on englobe tout ce qui est >= 45) -> Bascule sur Visual Crossing
      console.log(`WeatherProvider: Photo trop ancienne (${ageDays.toFixed(1)} jours), bascule directe vers Visual Crossing.`);
      result = await this.fetchFromVisualCrossing(lat, lon, timestamp);
    }

    // 3. Règle 4: Si échec global, on fait sans (retour null). Sinon, mise en cache.
    if (result) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (e) {
        console.warn('WeatherProvider: Impossible de sauvegarder dans le LocalStorage (Quota dépassé ?).');
      }
    }
    
    return result;
  }

  /**
   * Fetch historique via OpenWeatherMap (API OneCall 3.0 / TimeMachine).
   */
  static async fetchFromOWM(lat, lon, timestamp) {
    if (!WEATHER.owmApiKey || WEATHER.owmApiKey === 'VOTRE_CLE_OWM_ICI') {
      console.warn("WeatherProvider: Clé OWM manquante.");
      return null;
    }
    
    const dt = Math.round(timestamp / 1000); // Unix timestamp (secondes)
    
    // Essai 1 : One Call 3.0 (Nouveau standard)
    const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${dt}&units=metric&appid=${WEATHER.owmApiKey.trim()}`;
    
    try {
      console.log(`[WeatherProvider Debug] OWM URL 3.0 (sans clef): https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${dt}&units=metric`);
      const response = await fetch(url);

      if (!response.ok) {
          const errText = await response.text();
          console.error(`[WeatherProvider Debug] OWM HTTP ${response.status}: ${errText}`);
          return null;
      }
      const data = await response.json();
      console.log(`[WeatherProvider Debug] OWM Data reçue:`, data);
      
      if (data && data.data && data.data.length > 0) {
        return {
          temperature: data.data[0].temp,
          pressure: data.data[0].pressure,
          source: 'OpenWeatherMap 3.0'
        };
      } else {
        console.warn(`[WeatherProvider Debug] OWM n'a pas retourné le format attendu.`);
      }
    } catch (e) {
      console.error('[WeatherProvider Debug] Échec critique OWM :', e.message);
    }
    return null;
  }

  /**
   * Fetch historique via Visual Crossing (Timeline API).
   */
  static async fetchFromVisualCrossing(lat, lon, timestamp) {
    if (!WEATHER.visualCrossingApiKey || WEATHER.visualCrossingApiKey === 'VOTRE_CLE_VISUAL_CROSSING_ICI') {
      console.warn("WeatherProvider: Clé Visual Crossing manquante.");
      return null;
    }

    const dt = Math.round(timestamp / 1000);
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/${dt}?key=${WEATHER.visualCrossingApiKey}&unitGroup=metric&include=current`;

    try {
      console.log(`[WeatherProvider Debug] VC URL (sans clef): https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/${dt}?unitGroup=metric&include=current`);
      const response = await fetch(url);
      if (!response.ok) {
          const errText = await response.text();
          console.error(`[WeatherProvider Debug] VC HTTP ${response.status}: ${errText}`);
          return null;
      }
      const data = await response.json();
      console.log(`[WeatherProvider Debug] VC Data reçue:`, data);

      // On tente d'abord de récupérer les conditions actuelles exactes, sinon on prend la moyenne journalière
      if (data && data.currentConditions) {
        return {
          temperature: data.currentConditions.temp,
          pressure: data.currentConditions.pressure, 
          source: 'VisualCrossing'
        };
      } else if (data && data.days && data.days.length > 0) {
        return {
          temperature: data.days[0].temp,
          pressure: data.days[0].pressure,
          source: 'VisualCrossing (Daily Avg)'
        };
      } else {
        console.warn(`[WeatherProvider Debug] VC n'a pas retourné currentConditions ni days.`);
      }
    } catch (e) {
      console.error('[WeatherProvider Debug] Échec critique VC :', e.message);
    }
    return null;
  }
}
