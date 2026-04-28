/**
 * Open-Meteo API Client
 * Fetches elevation-corrected forecast data for a Scottish Munro.
 *
 * Endpoint: https://api.open-meteo.com/v1/forecast
 * Docs:     https://open-meteo.com/en/docs
 *
 * The critical parameter for mountain weather is `elevation`, which tells
 * Open-Meteo to run the ECMWF model with the actual summit altitude rather
 * than the surrounding valley floor. This gives a realistic summit forecast.
 */

const API_BASE = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'relative_humidity_2m',
  'surface_pressure',
  'precipitation_probability',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'relative_humidity_2m',
  'precipitation_probability',
  'visibility',
  'surface_pressure',
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_min',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'precipitation_probability_max',
  'sunrise',
  'sunset',
].join(',');

// ─── Cache layer ─────────────────────────────────────────────────────────────
// L1: session memory Map  — fastest, gone on page close
// L2: localStorage        — survives refresh; auto-expires when date changes
//
// Key format: mw4-wx-<MunroName>
// Value:      JSON { date: "YYYY-MM-DD", data: <API response> }
// Expiry:     lazy — stale if stored date ≠ today (no cron/TTL needed)
const cache = new Map();

const _today = () => new Date().toISOString().slice(0, 10);

function lsGet(name) {
  try {
    const raw = localStorage.getItem('mw4-wx-' + name);
    if (!raw) return null;
    const { date, data } = JSON.parse(raw);
    return date === _today() ? data : null;
  } catch { return null; }
}

function lsSet(name, data) {
  try {
    localStorage.setItem('mw4-wx-' + name, JSON.stringify({ date: _today(), data }));
  } catch { /* storage quota — silent fail */ }
}

export async function fetchWeather(munro) {
  const key = munro.name;
  // L1: session memory
  if (cache.has(key)) return cache.get(key);
  // L2: localStorage (same-day cache survives refresh)
  const lsCached = lsGet(key);
  if (lsCached) { cache.set(key, lsCached); return lsCached; }

  const params = new URLSearchParams({
    latitude: munro.lat,
    longitude: munro.lon,
    elevation: munro.h,
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    wind_speed_unit: 'mph',
    temperature_unit: 'celsius',
    timezone: 'Europe/London',
    forecast_days: 7,
  });

  try {
    const res = await fetch(`${API_BASE}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.current?.temperature_2m == null) {
      throw new Error('Invalid API response');
    }
    cache.set(key, data);
    lsSet(key, data);
    return data;
  } catch (err) {
    console.error('[MW4] Weather fetch failed:', err);
    return null;
  }
}

/**
 * Clear the cache — useful for pull-to-refresh or manual reload.
 */
export function clearWeatherCache() {
  cache.clear();
}
