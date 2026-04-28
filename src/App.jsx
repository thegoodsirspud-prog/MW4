import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense, useId } from 'react';
import { MUNROS } from './munros.js';
import { lookupWMO } from './weather-codes.js';
import { fetchWeather } from './weather-api.js';
import { calcRisk, riskTitle, riskDescription, calcOverallRisk, RISK_LABELS, RISK_COLORS } from './risk.js';
import { calcMidge } from './midge.js';
import MunroHero from './MunroHero.jsx';
// MunroTileMap pulls in MapLibre (~200KB gzipped) — code-split so the home
// page stays tiny. Only users who open /map pay the download cost.
const MunroTileMap = lazy(() => import('./MunroTileMap.jsx'));
const MunroWindMap = lazy(() => import('./MunroWindMap.jsx'));
import './App.css';
import './MunroHero.css';

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────
const COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const GAUGE_CIRC = 119.4;

// Unique regions for filter chips
const REGIONS = [...new Set(MUNROS.map(m => m.region))].sort();

// ─── Daily featured Munro ────────────────────────────────────────────────────
// Same peak all day; rotates at midnight. Deterministic hash of date string
// so every device shows the same mountain on the same day.
function getDailyMunro(munros) {
  const dateStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) & 0xffff;
  }
  return munros[hash % munros.length];
}

// ────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ────────────────────────────────────────────────────────────────────────────
const compassDir = (deg) => COMPASS_DIRS[Math.round(deg / 45) % 8];
const toFahrenheit = (c) => Math.round((c * 9) / 5 + 32);

const formatHour = (iso) => {
  const h = new Date(iso).getHours();
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h > 12 ? `${h - 12}pm` : `${h}am`;
};

const formatDay = (iso) => {
  // Append local noon to avoid UTC-midnight parsing (date-only ISO = UTC,
  // which in BST shifts the day back by 1h and gives wrong toDateString).
  const d = new Date(iso + 'T12:00:00'), today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const tmrw = new Date(today); tmrw.setDate(today.getDate() + 1);
  if (d.toDateString() === tmrw.toDateString()) return 'Tmrw';
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
};

const visibilityLabel = (km) =>
  km == null ? '—' :
  km < 1 ? 'Whiteout' :
  km < 4 ? 'Poor · low cloud' :
  km < 10 ? 'Moderate' :
  km < 20 ? 'Good' : 'Excellent';

const humidityLabel = (h) =>
  h > 90 ? 'Very damp · fog likely' :
  h > 75 ? 'Humid · cloud base low' :
  h > 60 ? 'Comfortable' : 'Dry';

const pressureLabel = (p) =>
  p < 990 ? 'Very low · storm' :
  p < 1000 ? 'Low · unsettled' :
  p < 1015 ? 'Moderate' :
  p < 1025 ? 'High · settled' : 'Very high · stable';

const precipLabel = (p) =>
  p > 80 ? 'Very likely' :
  p > 60 ? 'Likely' :
  p > 30 ? 'Possible' : 'Low chance';

// ────────────────────────────────────────────────────────────────────────────
// WeatherIcon — hand-built SVG per sky type
// ────────────────────────────────────────────────────────────────────────────
// useId() gives each instance a unique ID so SVG <mask> elements don't
// collide when the hourly strip renders 12 icons at the same size.
function WeatherIcon({ type, size = 20, night = false }) {
  const uid = useId();
  const attrs = {
    viewBox: '0 0 20 20', width: size, height: size,
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  // Clear: sun by day, moon by night. The crescent is a circle minus an
  // offset circle — clean, recognisable at small sizes.
  if (type === 'clear') {
    if (night) return (
      <svg {...attrs}>
        <defs>
          <mask id={`moon-mask-${uid}`}>
            <rect width="20" height="20" fill="white" />
            <circle cx="13" cy="8" r="5" fill="black" />
          </mask>
        </defs>
        <circle cx="10" cy="10" r="5.5" fill="#dce6f5" stroke="#dce6f5" mask={`url(#moon-mask-${uid})`} />
      </svg>
    );
    return (
      <svg {...attrs}>
        <circle cx="10" cy="10" r="3.5" fill="#fbbf24" stroke="#fbbf24" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={10 + Math.cos(r) * 5.5} y1={10 + Math.sin(r) * 5.5} x2={10 + Math.cos(r) * 7.5} y2={10 + Math.sin(r) * 7.5} stroke="#fbbf24" />;
        })}
      </svg>
    );
  }
  // Cloudy at night: moon-behind-cloud composition
  if (type === 'cloudy') {
    if (night) return (
      <svg {...attrs}>
        <defs>
          <mask id={`night-cloud-mask-${uid}`}>
            <rect width="20" height="20" fill="white" />
            <circle cx="9" cy="6" r="2.8" fill="black" />
          </mask>
        </defs>
        <circle cx="6" cy="7" r="3" fill="#dce6f5" mask={`url(#night-cloud-mask-${uid})`} />
        <path d="M5.5 13 a3 3 0 0 1 .5-5.9 a4 4 0 0 1 7.8.5 a2.5 2.5 0 0 1-.3 5.4Z" fill="rgba(255,255,255,.25)" stroke="rgba(255,255,255,.8)" />
      </svg>
    );
    return <svg {...attrs}><path d="M5.5 13 a3 3 0 0 1 .5-5.9 a4 4 0 0 1 7.8.5 a2.5 2.5 0 0 1-.3 5.4Z" fill="rgba(255,255,255,.25)" stroke="rgba(255,255,255,.8)" /></svg>;
  }
  if (type === 'rain') return <svg {...attrs}><path d="M5.5 10 a3 3 0 0 1 .5-5.9 a4 4 0 0 1 7.8.5 a2.5 2.5 0 0 1-.3 5.4Z" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.8)" /><line x1="7" y1="13" x2="6" y2="17" stroke="#60a5fa" strokeWidth="1.3" /><line x1="10" y1="13" x2="9" y2="17" stroke="#60a5fa" strokeWidth="1.3" /><line x1="13" y1="13" x2="12" y2="17" stroke="#60a5fa" strokeWidth="1.3" /></svg>;
  if (type === 'snow') return <svg {...attrs}><path d="M5.5 10 a3 3 0 0 1 .5-5.9 a4 4 0 0 1 7.8.5 a2.5 2.5 0 0 1-.3 5.4Z" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.8)" /><circle cx="7" cy="15.5" r=".7" fill="#e0f2fe" /><circle cx="10" cy="16.5" r=".7" fill="#e0f2fe" /><circle cx="13" cy="15.5" r=".7" fill="#e0f2fe" /></svg>;
  if (type === 'storm') return <svg {...attrs}><path d="M5.5 10 a3 3 0 0 1 .5-5.9 a4 4 0 0 1 7.8.5 a2.5 2.5 0 0 1-.3 5.4Z" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.75)" /><path d="M10 12 L8 16 L10.5 16 L9 19" fill="#fbbf24" stroke="#fbbf24" /></svg>;
  if (type === 'fog') return <svg {...attrs}><line x1="3" y1="7" x2="17" y2="7" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" /><line x1="4" y1="10" x2="16" y2="10" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" /><line x1="3" y1="13" x2="17" y2="13" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" /></svg>;
  return null;
}

function MidgeIcon({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="13" rx="4.5" ry="5.5" fill={color} opacity="0.25" stroke={color} strokeWidth="1.2" />
      <ellipse cx="12" cy="13" rx="2.8" ry="3.5" fill={color} opacity="0.45" />
      <circle cx="12" cy="8.5" r="2.2" fill={color} opacity="0.6" stroke={color} strokeWidth="0.8" />
      <line x1="12" y1="6" x2="10.5" y2="3" stroke={color} strokeWidth="0.9" strokeLinecap="round" />
      <line x1="12" y1="6" x2="13.5" y2="3" stroke={color} strokeWidth="0.9" strokeLinecap="round" />
      <line x1="7.5" y1="11" x2="4" y2="8.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" opacity="0.6" />
      <line x1="16.5" y1="11" x2="20" y2="8.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function MountainIcon({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 19 L9 9 L13 14 L16 10 L21 19 Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={`${color}22`} />
      <path d="M9 9 L10.5 11 L12 9" stroke={color} strokeWidth="0.8" opacity="0.7" strokeLinejoin="round" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Weather FX particle engine
// ────────────────────────────────────────────────────────────────────────────
function useWeatherFx(type) {
  const fxRef = useRef(null);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const fx = fxRef.current;
    if (!fx || reduced.current) return;
    while (fx.firstChild) fx.removeChild(fx.firstChild);
    const r = (a, b) => Math.random() * (b - a) + a;
    const frag = document.createDocumentFragment();

    // Rain: near layer (wider, faster, closer to camera) and far layer
    // (thinner, slower, softer). Gives precipitation a sense of depth.
    const rain = (nearCount, farCount) => {
      for (let i = 0; i < nearCount; i++) {
        const d = document.createElement('div');
        d.className = 'wx-rain wx-near';
        d.style.height = r(18, 34) + 'px';
        d.style.left = r(-5, 105) + '%';
        const dur = r(0.55, 0.95);
        d.style.animationDuration = dur + 's';
        d.style.animationDelay = -r(0, dur) + 's';
        d.style.opacity = r(0.55, 0.85);
        frag.appendChild(d);
      }
      for (let i = 0; i < farCount; i++) {
        const d = document.createElement('div');
        d.className = 'wx-rain wx-far';
        d.style.height = r(10, 20) + 'px';
        d.style.left = r(-5, 105) + '%';
        const dur = r(1.1, 1.8);
        d.style.animationDuration = dur + 's';
        d.style.animationDelay = -r(0, dur) + 's';
        d.style.opacity = r(0.3, 0.55);
        frag.appendChild(d);
      }
    };

    // Snow: near (larger, faster, crisper) + far (smaller, slower, blurred).
    const snow = (nearCount, farCount) => {
      for (let i = 0; i < nearCount; i++) {
        const d = document.createElement('div');
        d.className = 'wx-snow wx-near';
        const s = r(3.5, 6);
        d.style.width = s + 'px';
        d.style.height = s + 'px';
        d.style.left = r(0, 100) + '%';
        d.style.setProperty('--drift', r(-40, 40) + 'px');
        const dur = r(5, 9);
        d.style.animationDuration = dur + 's';
        d.style.animationDelay = -r(0, dur) + 's';
        d.style.opacity = r(0.7, 1);
        frag.appendChild(d);
      }
      for (let i = 0; i < farCount; i++) {
        const d = document.createElement('div');
        d.className = 'wx-snow wx-far';
        const s = r(1.5, 3);
        d.style.width = s + 'px';
        d.style.height = s + 'px';
        d.style.left = r(0, 100) + '%';
        d.style.setProperty('--drift', r(-30, 30) + 'px');
        const dur = r(9, 14);
        d.style.animationDuration = dur + 's';
        d.style.animationDelay = -r(0, dur) + 's';
        d.style.opacity = r(0.4, 0.75);
        frag.appendChild(d);
      }
    };

    // Clouds: soft volumetric ellipses at varied depths/speeds. Wider
    // than tall, drifting very slowly. opacity ranges chosen to read on
    // the brighter sky palette without feeling murky.
    const clouds = (n, opMin = 0.25, opMax = 0.6) => {
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.className = 'wx-cloud';
        const w = r(220, 420);
        d.style.width = w + 'px';
        d.style.height = w * r(0.28, 0.42) + 'px';  // wide ellipse
        d.style.top = r(2, 45) + '%';
        const drift = r(55, 110);
        const bob = r(6, 11);
        d.style.animationDuration = `${drift}s, ${bob}s`;
        d.style.animationDelay = `${-r(0, drift)}s, ${-r(0, bob)}s`;
        d.style.opacity = r(opMin, opMax);
        frag.appendChild(d);
      }
    };

    // Fog layers — soft drifting bands at different heights
    const fog = (n) => {
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.className = 'wx-fog-layer';
        d.style.top = 15 + i * 22 + '%';
        const dur = r(28, 48);
        d.style.animationDuration = dur + 's';
        d.style.animationDelay = -r(0, dur) + 's';
        frag.appendChild(d);
      }
    };

    switch (type) {
      case 'rain':   clouds(5, 0.2, 0.45); rain(38, 24); break;
      case 'storm':  clouds(6, 0.22, 0.5); rain(55, 35); break;
      case 'snow':   clouds(4, 0.18, 0.35); snow(26, 18); break;
      case 'clear':  clouds(2, 0.12, 0.28); break;
      case 'fog':    fog(4); clouds(3, 0.15, 0.3); break;
      default:       clouds(6, 0.25, 0.5); break;
    }
    fx.appendChild(frag);
    return () => { while (fx.firstChild) fx.removeChild(fx.firstChild); };
  }, [type]);

  return fxRef;
}

// ────────────────────────────────────────────────────────────────────────────
// View model builders
// ────────────────────────────────────────────────────────────────────────────
function buildCurrentView(wx) {
  if (!wx?.current) return null;
  const c = wx.current;
  const wmo = lookupWMO(c.weather_code);
  const risk = calcRisk(c);

  // Visibility from hourly (nearest hour)
  const vis = nearestHourlyValue(wx, 'visibility');

  // Sunrise/sunset from today's daily forecast
  const sunrise = wx?.daily?.sunrise?.[0] || null;
  const sunset = wx?.daily?.sunset?.[0] || null;

  return {
    viewKey: 'current', label: 'Now',
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    cond: wmo.label, type: wmo.type,
    wind: Math.round(c.wind_speed_10m),
    gust: Math.round(c.wind_gusts_10m || c.wind_speed_10m * 1.4),
    windDirLabel: compassDir(c.wind_direction_10m),
    bearing: c.wind_direction_10m,
    humidity: c.relative_humidity_2m,
    pressure: Math.round(c.surface_pressure),
    precip: c.precipitation_probability || 0,
    visibility: vis != null ? Math.round((vis / 1000) * 10) / 10 : null,
    risk, riskTitle: riskTitle(risk.band), riskDesc: riskDescription(risk.detail),
    rawTemp: c.temperature_2m, rawWind: c.wind_speed_10m, rawHumidity: c.relative_humidity_2m,
    rawHour: new Date().getHours(),
    sunrise, sunset,
  };
}

function buildDailyViews(wx) {
  if (!wx?.daily) return [];
  const d = wx.daily;
  const days = [];

  for (let i = 0; i < d.time.length; i++) {
    const wc = d.weather_code[i];
    const wmo = lookupWMO(wc);
    const feelsMin = d.apparent_temperature_min?.[i] ?? d.temperature_2m_min[i];

    // Best humidity estimate: average of hourly humidity across that day
    const dayHum = averageHourlyForDay(wx, d.time[i], 'relative_humidity_2m', 75);
    // Best pressure estimate: mid-day hourly pressure
    const dayPress = midDayHourlyForDay(wx, d.time[i], 'surface_pressure', 1013);
    // Best visibility estimate: mid-day hourly visibility
    const dayVis = midDayHourlyForDay(wx, d.time[i], 'visibility', 20000);

    const syntheticWx = {
      wind_speed_10m: d.wind_speed_10m_max?.[i] || 0,
      apparent_temperature: feelsMin,
      weather_code: wc,
      precipitation_probability: d.precipitation_probability_max?.[i] || 0,
      relative_humidity_2m: dayHum,
    };
    const risk = calcRisk(syntheticWx);

    days.push({
      viewKey: `day-${i}`, date: d.time[i], label: formatDay(d.time[i]),
      temp: Math.round(d.temperature_2m_max[i]),
      tempMin: Math.round(d.temperature_2m_min[i]),
      feels: Math.round(feelsMin),
      cond: wmo.label, type: wmo.type,
      wind: Math.round(d.wind_speed_10m_max?.[i] || 0),
      gust: Math.round(d.wind_gusts_10m_max?.[i] || 0),
      windDirLabel: compassDir(d.wind_direction_10m_dominant?.[i] || 0),
      bearing: d.wind_direction_10m_dominant?.[i] || 0,
      humidity: Math.round(dayHum),
      pressure: Math.round(dayPress),
      visibility: dayVis != null ? Math.round((dayVis / 1000) * 10) / 10 : null,
      precip: d.precipitation_probability_max?.[i] || 0,
      risk, riskTitle: riskTitle(risk.band), riskDesc: riskDescription(risk.detail),
      rawTemp: (d.temperature_2m_max[i] + d.temperature_2m_min[i]) / 2,
      rawWind: d.wind_speed_10m_max?.[i] || 0,
      rawHumidity: dayHum,
      rawHour: 12,
      sunrise: d.sunrise?.[i] || null,
      sunset: d.sunset?.[i] || null,
    });
  }

  return days;
}

function buildHourlyViews(wx) {
  if (!wx?.hourly) return [];
  const h = wx.hourly;
  const now = new Date();
  const start = Math.max(0, h.time.findIndex(t => new Date(t) >= now));
  const hrs = [];

  for (let i = start; i < Math.min(start + 12, h.time.length); i++) {
    const wmo = lookupWMO(h.weather_code[i]);
    const syntheticWx = {
      wind_speed_10m: h.wind_speed_10m[i],
      apparent_temperature: h.apparent_temperature[i],
      weather_code: h.weather_code[i],
      precipitation_probability: h.precipitation_probability[i],
      relative_humidity_2m: h.relative_humidity_2m[i],
    };
    const risk = calcRisk(syntheticWx);
    const hour = new Date(h.time[i]).getHours();

    // Find the matching day's sunrise/sunset so the hero's pill keeps
    // showing times when the user previews a specific hour.
    const dayStr = h.time[i].slice(0, 10);
    const dayIdx = wx?.daily?.time?.findIndex((t) => t.startsWith(dayStr)) ?? -1;
    const sunrise = dayIdx >= 0 ? wx.daily.sunrise?.[dayIdx] : null;
    const sunset = dayIdx >= 0 ? wx.daily.sunset?.[dayIdx] : null;

    hrs.push({
      viewKey: `hour-${i}`,
      label: i === start ? 'Now' : formatHour(h.time[i]),
      hour,
      temp: Math.round(h.temperature_2m[i]),
      feels: Math.round(h.apparent_temperature[i]),
      cond: wmo.label, type: wmo.type,
      wind: Math.round(h.wind_speed_10m[i]),
      gust: Math.round(h.wind_gusts_10m[i] || h.wind_speed_10m[i] * 1.4),
      windDirLabel: compassDir(h.wind_direction_10m[i]),
      bearing: h.wind_direction_10m[i],
      humidity: h.relative_humidity_2m[i],
      pressure: h.surface_pressure?.[i] != null ? Math.round(h.surface_pressure[i]) : null,
      precip: h.precipitation_probability[i],
      visibility: h.visibility?.[i] ? Math.round((h.visibility[i] / 1000) * 10) / 10 : null,
      risk, riskTitle: riskTitle(risk.band), riskDesc: riskDescription(risk.detail),
      rawTemp: h.temperature_2m[i], rawWind: h.wind_speed_10m[i], rawHumidity: h.relative_humidity_2m[i],
      rawHour: hour,
      isNow: i === start,
      sunrise, sunset,
    });
  }

  return hrs;
}

/**
 * Convert a Munro name to a WalkHighlands URL slug.
 * Pattern: lowercase, strip diacritics, remove apostrophes,
 * replace spaces/non-alphanum with hyphens, collapse consecutive hyphens.
 * Covers all 282 names without a lookup table.
 * Verified against: ben-nevis, cairn-gorm, sgurr-choinnich-mor,
 *   carn-mor-dearg, aonach-beag-nevis-range, beinn-a-bhuird.
 */
function munroToSlug(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .toLowerCase()
    .replace(/'/g, '')                // remove apostrophes (Beinn a'Bhuird → beinn-abhuird)
    .replace(/[^a-z0-9]+/g, '-')     // non-alphanum → hyphen
    .replace(/^-|-$/g, '');          // trim leading/trailing hyphens
}

// Helper: nearest hourly reading
function nearestHourlyValue(wx, key) {
  if (!wx?.hourly?.[key]) return null;
  const idx = Math.max(0, wx.hourly.time.findIndex(t => new Date(t) >= new Date()));
  return wx.hourly[key][idx];
}

function averageHourlyForDay(wx, dateIso, key, fallback) {
  if (!wx?.hourly?.[key]) return fallback;
  const dateStr = dateIso.slice(0, 10);
  const values = [];
  for (let i = 0; i < wx.hourly.time.length; i++) {
    if (wx.hourly.time[i].startsWith(dateStr) && wx.hourly[key][i] != null) {
      values.push(wx.hourly[key][i]);
    }
  }
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : fallback;
}

function midDayHourlyForDay(wx, dateIso, key, fallback) {
  if (!wx?.hourly?.[key]) return fallback;
  const dateStr = dateIso.slice(0, 10);
  for (let i = 0; i < wx.hourly.time.length; i++) {
    if (wx.hourly.time[i].startsWith(dateStr) && new Date(wx.hourly.time[i]).getHours() === 12 && wx.hourly[key][i] != null) {
      return wx.hourly[key][i];
    }
  }
  return fallback;
}

// ════════════════════════════════════════════════════════════════════════════
// Risk Hub Section — Overall + Mountain Safety + Midge, all expandable
// ════════════════════════════════════════════════════════════════════════════
function RiskHub({ activeView, midge, unitF, midgeRef }) {
  const [expandedId, setExpandedId] = useState(null);
  const toggle = (id) => setExpandedId(expandedId === id ? null : id);

  const overall = calcOverallRisk(activeView.risk, midge);
  const mountainExpanded = expandedId === 'mountain';

  return (
    <div className="risk-hub">
      {/* MERGED: Ascent Rating + Mountain Safety in one card.
          The header shows score/bar/bands (the at-a-glance summary).
          A tap on the header expands to reveal the factor-by-factor
          breakdown (wind, rain, temperature, etc) — the "why". */}
      <section
        className={`risk-card overall-card glass ${mountainExpanded ? 'expanded' : ''}`}
        style={{
          background: `linear-gradient(135deg, rgba(15, 25, 40, 0.32), ${overall.riskColor}28)`,
          borderColor: `${overall.riskColor}70`,
        }}
      >
        <button
          className="overall-head-button"
          onClick={() => toggle('mountain')}
          aria-expanded={mountainExpanded}
          aria-label={mountainExpanded ? 'Hide details' : 'Show details'}
        >
          <div className="overall-head">
            <div className="overall-label">Mountain Safety · Ascent Rating</div>
            <div className="overall-score" style={{ color: overall.riskColor }}>{overall.score}<span>/100</span></div>
          </div>
          <div className="overall-headline">{overall.headline}</div>
          <div className="overall-context">
            {activeView.cond} · {activeView.wind} mph {activeView.windDirLabel} · Feels {unitF ? Math.round((activeView.feels * 9) / 5 + 32) : activeView.feels}°{unitF ? 'F' : 'C'}
          </div>
          <div className="overall-bar-track">
            <div
              className="overall-bar-fill"
              style={{
                width: `${overall.score}%`,
                background: `linear-gradient(90deg, #22c55e 0%, #84cc16 25%, #f59e0b 50%, #f97316 75%, #dc2626 100%)`,
              }}
            />
            <div className="overall-bar-indicator" style={{ left: `${overall.score}%` }} />
          </div>
          <div className="overall-bands">
            {RISK_LABELS.map((label, i) => (
              <div key={label} className={`overall-band ${i === overall.band ? 'active' : ''}`} style={{ color: i === overall.band ? RISK_COLORS[i] : undefined }}>
                {label}
              </div>
            ))}
          </div>
          <div className="overall-expand-hint">
            <span>{mountainExpanded ? 'Hide' : 'Show'} factor breakdown</span>
            <svg className={`overall-chevron ${mountainExpanded ? 'rotated' : ''}`} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="M3 5 L6 8 L9 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {mountainExpanded && (
          <div className="overall-body">
            <div className="factor-eyebrow">How this is calculated</div>
            {activeView.risk.detail.map((f) => {
              const pct = (f.score / f.max) * 100;
              const barColor = pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#3b82f6';
              return (
                <div key={f.factor} className="factor-row">
                  <div className="factor-head">
                    <span className="factor-label">{f.factor}</span>
                    <span className="factor-value">
                      {f.value}
                      <span className="factor-score" style={{ color: barColor }}>{f.score}/{f.max}</span>
                    </span>
                  </div>
                  <div className="factor-bar"><div className="factor-fill" style={{ width: `${pct}%`, background: barColor }} /></div>
                  <div className="factor-explain">{f.explain}</div>
                </div>
              );
            })}
            <div className="factor-footnote">Model based on MWIS (Mountain Weather Information Service) guidance and Mountaineering Scotland training material.</div>
          </div>
        )}
      </section>

      {/* MIDGE — single unified card */}
      <div ref={midgeRef}>
        <ExpandableRiskCard
          icon={<MidgeIcon size={22} color="#ffffff" />}
          eyebrow="Midge Forecast"
          title={midge.dormant ? 'Dormant season · no activity' : `Level ${midge.level} of 5 · ${midge.label}`}
          desc={midge.desc}
          color="#ffffff"
          gaugeValue={midge.level}
          gaugeMax={5}
          segments={5}
          expanded={expandedId === 'midge'}
          onToggle={() => toggle('midge')}
        >
          <div className="midge-segments">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="midge-segment" style={{
                background: i <= midge.level ? '#ffffff' : 'rgba(255,255,255,0.18)',
                opacity: 1,
                border: '1px solid rgba(255,255,255,0.3)',
            }} />
          ))}
          ))}
        </div>
        {midge.factors.length > 0 ? (
          <>
            <div className="factor-eyebrow" style={{ marginTop: 14 }}>How this is calculated</div>
            {midge.factors.map(f => (
              <div key={f.label} className="factor-row">
                <div className="factor-head">
                  <span className="factor-label">{f.label}</span>
                  <span className="factor-value">{f.desc}</span>
                </div>
                <div className="factor-bar">
                  <div className="factor-fill" style={{
                    width: `${f.pct}%`,
                    background: f.pct > 60 ? midge.color : 'rgba(255,255,255,0.3)',
                    opacity: 0.85,
                  }} />
                </div>
              </div>
            ))}
            <div className="factor-footnote">Model based on APS Biocontrol (Smidge™) research. Wind is by far the strongest suppressor of the Highland midge (Culicoides impunctatus).</div>
          </>
        ) : (
          <div className="midge-dormant">
            The Highland midge enters dormancy from November through March.
            Adults return in late April, with peak swarming through July and August.
            For active-season forecasts, return in spring.
          </div>
        )}
        </ExpandableRiskCard>
      </div>
    </div>
  );
}

function ExpandableRiskCard({ icon, eyebrow, title, desc, color, gaugeValue, gaugeMax, segments, expanded, onToggle, children }) {
  const offset = GAUGE_CIRC - (gaugeValue / gaugeMax) * GAUGE_CIRC;
  return (
    <section
      className={`risk-card glass ${expanded ? 'expanded' : ''}`}
      style={{
        background: `linear-gradient(135deg, rgba(15, 25, 40, 0.32), ${color}24)`,
        borderColor: `${color}65`,
      }}
    >
      <button className="risk-card-head" onClick={onToggle} aria-expanded={expanded}>
        <div className="gauge" role="meter" aria-valuemin="0" aria-valuemax={gaugeMax} aria-valuenow={gaugeValue}>
          <svg viewBox="0 0 46 46" width="46" height="46">
            <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <circle cx="23" cy="23" r="19" fill="none"
              stroke={color} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={GAUGE_CIRC} strokeDashoffset={offset.toFixed(1)}
              className="gauge-arc" />
          </svg>
          <div className="gauge-value">
            {segments ? icon : gaugeValue}
          </div>
        </div>
        <div className="risk-card-info">
          <div className="risk-card-eyebrow">{eyebrow}</div>
          <div className="risk-card-title">{title}</div>
          <div className="risk-card-desc">{desc}</div>
        </div>
        <div className={`risk-card-chevron ${expanded ? 'rotated' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 12 12" width="14" height="14"><path d="M3 5 L6 8 L9 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </button>
      {expanded && <div className="risk-card-body">{children}</div>}
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main App
// ════════════════════════════════════════════════════════════════════════════
/*export_default*/ export default function App() {
  const sortedMunros = useMemo(() => [...MUNROS].sort((a, b) => b.h - a.h), []);
  const [munro, setMunro] = useState(() => {
    // Same peak all day — changes at midnight. Every device shows the same
    // featured Munro for a given calendar date (great for sharing).
    // Users can still navigate to any peak via search or map.
    return getDailyMunro(sortedMunros);
  });
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState('current');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [useFahrenheit, setUseFahrenheit] = useState(false);
  // Navigation
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState('home'); // home | peaks | map | wind

  // Scroll targets for hero ring taps — each ring deep-links to the
  // section whose info it summarises. Refs kept at App scope so the
  // hero can fire onRingClick('wind' | 'ascent' | 'midge') without
  // prop-drilling the refs themselves.
  const conditionsRef = useRef(null);
  const riskHubRef = useRef(null);
  const midgeRef = useRef(null);
  const handleRingClick = (kind) => {
    const target = kind === 'wind' ? conditionsRef.current
                 : kind === 'ascent' ? riskHubRef.current
                 : kind === 'midge' ? midgeRef.current
                 : null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Search & region filter for home screen
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedMode('current');
    setSelectedIndex(0);
    fetchWeather(munro).then(data => {
      if (!cancelled) { setWx(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [munro]);
  
  
  const currentView = useMemo(() => buildCurrentView(wx), [wx]);
  const dailyViews = useMemo(() => buildDailyViews(wx), [wx]);
  const hourlyViews = useMemo(() => buildHourlyViews(wx), [wx]);

  const activeView = useMemo(() => {
    if (selectedMode === 'hour' && hourlyViews[selectedIndex]) return hourlyViews[selectedIndex];
    if (selectedMode === 'day' && dailyViews[selectedIndex]) {
      if (selectedIndex === 0 && currentView) return currentView;
      return dailyViews[selectedIndex];
    }
    return currentView;
  }, [selectedMode, selectedIndex, currentView, dailyViews, hourlyViews]);

  const midge = useMemo(() => {
    if (!activeView) return calcMidge(null, new Date().getHours());
    return calcMidge({
      temperature_2m: activeView.rawTemp,
      wind_speed_10m: activeView.rawWind,
      relative_humidity_2m: activeView.rawHumidity,
    }, activeView.rawHour);
  }, [activeView]);

  const skyType = activeView?.type || 'cloudy';

  // Time-of-day band drives the sky overlay. Uses the active view's hour
  // if we're previewing a forecast hour, otherwise the current wall-clock
  // hour. Result: preview tomorrow 3am → sky goes night; now at 2pm → midday.
  const timeBand = (() => {
    const h = activeView?.rawHour ?? activeView?.hour ?? new Date().getHours();
    if (h >= 22 || h < 4)  return 'night';
    if (h < 6)             return 'dawn';
    if (h < 8)             return 'golden';
    if (h < 11)            return 'morning';
    if (h < 17)            return 'midday';
    if (h < 18)            return 'evening';
    if (h < 20)            return 'golden';
    return 'dusk';
  })();
  const fxRef = useWeatherFx(skyType);

  const filteredMunros = useMemo(() => {
    let list = sortedMunros;
    if (regionFilter) list = list.filter(m => m.region === regionFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.region.toLowerCase().includes(q));
    }
    return list;
  }, [sortedMunros, regionFilter, search]);

  const displayTemp = (c) => useFahrenheit ? toFahrenheit(c) : c;

  const navTo = (p) => { setPage(p); setMenuOpen(false); };

  // ────── Map views
  if (page === 'map') {
    // Provide at least the active peak's risk colour for its map dot.
    // Full batch-fetch removed; tile map handles lazy risk colouring.
    return (
      <Suspense fallback={<div className="map-overlay"><div className="map-header"><div className="map-title"><div className="map-eyebrow">Scottish Munros</div><div className="map-subtitle">Loading...</div></div></div></div>}>
        <MunroTileMap
          onSelectMunro={(m) => { setMunro(m); setPage('home'); }}
          selectedMunro={munro}
          onClose={() => setPage('home')}
        />
      </Suspense>
    );
  }
  if (page === 'wind') {
    return (
      <Suspense fallback={<div className="map-overlay"><div className="map-header"><div className="map-title"><div className="map-eyebrow">Live Wind Map</div><div className="map-subtitle">Loading…</div></div><button className="map-close" onClick={() => setPage('home')} aria-label="Close map">✕</button></div></div>}>
        <MunroWindMap onClose={() => setPage('home')} />
      </Suspense>
    );
  }

  // ────── Peaks full list view
  if (page === 'peaks') {
    return (
      <PeaksPage
        munros={sortedMunros}
        currentMunro={munro}
        regions={REGIONS}
        onSelect={(m) => { setMunro(m); setPage('home'); }}
        onClose={() => setPage('home')}
      />
    );
  }

  // ────── Loading state
  if (loading || !activeView) {
    return (
      <div className="app sky-cloudy">
        <div className="sky" />
        <main className="content">
          <div className="mhero mhero-loading">
            <div className="mhero-content">
              <div className="mhero-top">
                <div className="mhero-eyebrow">
                  <span className="mhero-dot" />
                  Loading forecast…
                </div>
                <h1 className="mhero-peak-name">{munro.name}</h1>
                <div className="mhero-peak-meta">
                  <span>{munro.region}</span>
                  <span className="mhero-peak-sep" aria-hidden="true">·</span>
                  <span>{munro.h.toLocaleString()}m</span>
                </div>
              </div>
              <div className="mhero-bottom">
                <div className="mhero-temp-wrap">
                  <div className="mhero-temp">
                    <span className="mhero-temp-primary">
                      <span className="mhero-temp-number">—</span>
                      <span className="mhero-temp-unit">°</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ────── Main home page
  return (
    <div className={`app sky-${skyType} time-${timeBand}`}>
      <div className="sky" />
      <div className="fx" ref={fxRef} />

      <div className="mountains" aria-hidden="true">
        <svg viewBox="0 0 480 180" preserveAspectRatio="none">
          <path d="M0 180 L0 130 L50 90 L90 110 L140 60 L200 95 L250 70 L310 100 L370 55 L430 85 L480 70 L480 180 Z" fill="rgba(10,13,20,0.55)" />
          <path d="M0 180 L0 150 L60 120 L120 140 L180 105 L240 130 L300 115 L370 135 L430 120 L480 130 L480 180 Z" fill="rgba(10,13,20,0.85)" />
        </svg>
      </div>

      {/* HAMBURGER MENU BUTTON */}
      <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
        <span /><span /><span />
      </button>

      {/* MENU DRAWER */}
      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="menu-drawer glass">
            <div className="menu-head">
              <div className="menu-title">Munro Weather</div>
              <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
            </div>
            <button className={`menu-item ${page === 'home' ? 'menu-item-active' : ''}`} onClick={() => navTo('home')}>
              <div className="menu-icon">🏔️</div>
              <div>
                <div className="menu-item-title">Today</div>
                <div className="menu-item-sub">Current forecast</div>
              </div>
            </button>
            <button className={`menu-item ${page === 'peaks' ? 'menu-item-active' : ''}`} onClick={() => navTo('peaks')}>
              <div className="menu-icon">🗻</div>
              <div>
                <div className="menu-item-title">All {sortedMunros.length} Peaks</div>
                <div className="menu-item-sub">Browse and filter by region</div>
              </div>
            </button>
            <button className={`menu-item ${page === 'map' ? 'menu-item-active' : ''}`} onClick={() => navTo('map')}>
              <div className="menu-icon">🗺️</div>
              <div>
                <div className="menu-item-title">Munro Map</div>
                <div className="menu-item-sub">All 282 peaks on Scotland</div>
              </div>
            </button>
            <button className={`menu-item ${page === 'wind' ? 'menu-item-active' : ''}`} onClick={() => navTo('wind')}>
              <div className="menu-icon">🌬️</div>
              <div>
                <div className="menu-item-title">Live Wind</div>
                <div className="menu-item-sub">Animated wind across Scotland</div>
              </div>
            </button>
            <div className="menu-footer">
              Summit data: Open-Meteo<br/>
              Risk model: MWIS methodology<br/>
              Midge model: APS Biocontrol research
            </div>
          </nav>
        </>
      )}

      <main className="content">
        {/* SEARCH — region filter has moved to the All 282 Peaks page,
            keeping the home page focused on the active forecast. */}
        <div className="home-search">
          <div className="search-row">
            <input
              className="search-input"
              placeholder="Search 282 Munros..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          {search && filteredMunros.length > 0 && (
            <div className="search-results glass">
              {filteredMunros.slice(0, 8).map(m => (
                <button key={m.name} className={`search-item ${m.name === munro.name ? 'active' : ''}`}
                  onClick={() => { setMunro(m); setSearch(''); }}>
                  <span className="search-name">{m.name}</span>
                  <span className="search-meta">{m.h}m · {m.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* HERO — cinematic Highland panorama */}
        <MunroHero
          view={activeView}
          munro={munro}
          useF={useFahrenheit}
          onUnitToggle={() => setUseFahrenheit(!useFahrenheit)}
          skyType={skyType}
          midge={midge}
          onPeakNameClick={() => setPage('map')}
          onRingClick={handleRingClick}
          hourBanner={
            selectedMode === 'hour' ? (
              <div className="mhero-hour-banner">
                <span>Previewing {activeView.label}</span>
                <button onClick={() => { setSelectedMode('current'); setSelectedIndex(0); }}>
                  Back to now ×
                </button>
              </div>
            ) : null
          }
        />

        {/* ALERT for elevated risk — placed immediately after the hero so
            safety information is the very first thing after the active
            forecast, not buried at the bottom of the page. */}
        {activeView.risk.band >= 2 && (
          <div className="alert" role="alert">
            <div className="alert-icon">⚠️</div>
            <div className="alert-body">
              <div className="alert-title">Mountain Safety · {RISK_LABELS[activeView.risk.band]} risk</div>
              <div className="alert-text">
                {activeView.riskDesc} Always check MWIS (mwis.org.uk) for the
                full regional summit forecast before departure.
              </div>
            </div>
          </div>
        )}

        {/* HOURLY — clickable (placed above daily for tap-to-preview-first flow) */}
        {hourlyViews.length > 0 && (
          <section className="section">
            <h2 className="section-title"><span>Hourly · tap to preview</span></h2>
            <div className="hourly-scroll">
              {hourlyViews.map((h, i) => {
                const active = selectedMode === 'hour' && selectedIndex === i;
                const isCurrent = h.isNow && selectedMode !== 'hour';
                return (
                  <button key={h.viewKey}
                    className={`hourly-cell glass ${active ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
                    onClick={() => { setSelectedMode('hour'); setSelectedIndex(i); }}>
                    <div className="hourly-time">{h.label}</div>
                    <div className="hourly-icon"><WeatherIcon type={h.type} size={20} night={h.hour < 6 || h.hour >= 20} /></div>
                    <div className="hourly-temp">{displayTemp(h.temp)}°</div>
                    <div className="hourly-risk-dot" style={{ background: h.risk.riskColor, boxShadow: `0 0 6px ${h.risk.riskColor}` }} />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* DAILY STRIP — wrapped as a proper section with matching heading */}
        <section className="section">
          <h2 className="section-title"><span>Daily · tap to preview</span></h2>
          <nav className="forecast-strip glass" aria-label="7-day forecast">
            {dailyViews.slice(0, 7).map((day, i) => {
              const active = (selectedMode === 'day' && selectedIndex === i) ||
                             (selectedMode === 'current' && i === 0);
              return (
                <button key={day.viewKey}
                  className={`strip-cell ${active ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMode(i === 0 ? 'current' : 'day');
                    setSelectedIndex(i);
                  }}
                  aria-pressed={active}>
                  <div className="strip-risk-dot" style={{ background: day.risk.riskColor, boxShadow: `0 0 6px ${day.risk.riskColor}` }} />
                  <div className="strip-day">{day.label}</div>
                  <div className="strip-icon"><WeatherIcon type={day.type} size={22} /></div>
                  <div className="strip-temp">{displayTemp(day.temp)}°</div>
                </button>
              );
            })}
          </nav>
        </section>

        {/* CONDITIONS — all five measurements in one condensed card,
            matching the Mountain Safety consolidation. */}
        <section className="section" ref={conditionsRef}>
          <h2 className="section-title"><span>Conditions</span></h2>
          <div className="conditions-card glass">
            <div className="conditions-wind">
              <div className="compass compass--lg" aria-hidden="true">
                <svg viewBox="0 0 82 82" width="82" height="82">
                  <circle cx="41" cy="41" r="36" fill="rgba(15, 25, 40, 0.4)"
                    stroke="rgba(255, 255, 255, 0.22)" strokeWidth="1" />
                  <line x1="41" y1="7"  x2="41" y2="12" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
                  <line x1="41" y1="70" x2="41" y2="75" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
                  <line x1="7"  y1="41" x2="12" y2="41" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
                  <line x1="70" y1="41" x2="75" y2="41" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
                  <text x="41" y="13" fill="rgba(245, 245, 247, 0.72)" fontSize="8.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">N</text>
                  <text x="71" y="44" fill="rgba(245, 245, 247, 0.55)" fontSize="8.5" fontWeight="700" textAnchor="middle">E</text>
                  <text x="41" y="76" fill="rgba(245, 245, 247, 0.55)" fontSize="8.5" fontWeight="700" textAnchor="middle">S</text>
                  <text x="11" y="44" fill="rgba(245, 245, 247, 0.55)" fontSize="8.5" fontWeight="700" textAnchor="middle">W</text>
                  {/* Arrow points FROM — meteorological convention. The
                      bearing IS the FROM direction, so rotate directly. */}
                 <g style={{ transform: `rotate(${(activeView.bearing + 180) % 360 || 0}deg)`, transformOrigin: '41px 41px', transition: 'transform 0.6s cubic-bezier(.4,0,.2,1)' }}>
                    <path
                      d="M41 13 L48 38 L41 34 L34 38 Z"
                      fill="#60a5fa"
                      stroke="rgba(15, 25, 40, 0.7)"
                      strokeWidth="0.8"
                      strokeLinejoin="round"
                    />
                    <circle cx="41" cy="41" r="2.4" fill="#ffffff" />
                  </g>
                </svg>
              </div>
              <div className="conditions-wind-info">
                <div className="conditions-wind-primary">
                  {activeView.wind} <small>mph {activeView.windDirLabel}</small>
                </div>
                <div className="conditions-wind-gust">Gusting {activeView.gust} mph</div>
                <div className="conditions-wind-bar">
                  <div className="conditions-wind-fill" style={{ width: `${Math.min(100, activeView.wind * 2)}%` }} />
                </div>
              </div>
            </div>

            <div className="conditions-metrics">
              <div className="conditions-metric">
                <div className="conditions-metric-head">Visibility</div>
                <div className="conditions-metric-value">
                  {activeView.visibility != null ? activeView.visibility : '—'}<small>km</small>
                </div>
                <div className="conditions-metric-sub">{visibilityLabel(activeView.visibility)}</div>
              </div>
              <div className="conditions-metric">
                <div className="conditions-metric-head">Humidity</div>
                <div className="conditions-metric-value">{activeView.humidity}<small>%</small></div>
                <div className="conditions-metric-sub">{humidityLabel(activeView.humidity)}</div>
              </div>
              <div className="conditions-metric">
                <div className="conditions-metric-head">Pressure</div>
                <div className="conditions-metric-value">{activeView.pressure || '—'}<small>hPa</small></div>
                <div className="conditions-metric-sub">{pressureLabel(activeView.pressure)}</div>
              </div>
              <div className="conditions-metric">
                <div className="conditions-metric-head">Precip</div>
                <div className="conditions-metric-value">{activeView.precip}<small>%</small></div>
                <div className="conditions-metric-sub">{precipLabel(activeView.precip)}</div>
              </div>
            </div>
          </div>
        </section>

         {/* RISK HUB — Overall + Mountain + Midge */}
         <div ref={riskHubRef}>
           <section className="section">
             <h2 className="section-title"><span>Mountain Safety · Ascent Rating</span></h2>
             <RiskHub activeView={activeView} midge={midge} unitF={useFahrenheit} midgeRef={midgeRef} />
           </section>
         </div>

         {/* WALKHIGHLANDS — route link for the current peak */}
         <section className="section">
           <h2 className="section-title"><span>Walking Routes</span></h2>
           <div className="walkhighlands-card glass">
            <div className="walkhighlands-body">
              <div className="walkhighlands-icon" aria-hidden="true">🥾</div>
              <div className="walkhighlands-text">
                <div className="walkhighlands-title">Walking routes</div>
                <div className="walkhighlands-sub">
                  Route guides, walk reports and conditions for {munro.name}
                </div>
              </div>
            </div>
            <a
              href={`https://www.walkhighlands.co.uk/munros/${munroToSlug(munro.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="walkhighlands-link"
              aria-label={`View walking routes for ${munro.name} on WalkHighlands`}
            >
              View on WalkHighlands
              <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </section>

        <footer className="app-footer">
          Summit weather: Open-Meteo · Risk: MWIS methodology · Midge: APS Biocontrol research
        </footer>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Peaks Page (full list)
// ════════════════════════════════════════════════════════════════════════════
function PeaksPage({ munros, currentMunro, regions, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState(null);

  const filtered = useMemo(() => {
    let list = munros;
    if (region) list = list.filter(m => m.region === region);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.region.toLowerCase().includes(q));
    }
    return list;
  }, [munros, region, search]);

  return (
    <div className="peaks-page">
      <div className="peaks-header">
        <div>
          <div className="peaks-eyebrow">All Munros</div>
          <div className="peaks-title">{filtered.length} of {munros.length}</div>
        </div>
        <button className="map-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="peaks-search-row">
        <input className="peaks-search"
          placeholder="Search peaks or region..."
          value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="peaks-chips">
        <button className={`chip ${!region ? 'active' : ''}`} onClick={() => setRegion(null)}>All</button>
        {regions.map(r => (
          <button key={r} className={`chip ${region === r ? 'active' : ''}`}
            onClick={() => setRegion(region === r ? null : r)}>{r}</button>
        ))}
      </div>

      <div className="peaks-list">
        {filtered.map(m => (
          <button key={m.name}
            className={`peak-item ${m.name === currentMunro.name ? 'active' : ''}`}
            onClick={() => onSelect(m)}>
            <div className="peak-info">
              <div className="peak-name">{m.name}</div>
              <div className="peak-region">{m.region}</div>
            </div>
            <div className="peak-height">{m.h}<small>m</small></div>
          </button>
        ))}
      </div>
    </div>
  );
}
