/**
 * Summit Risk Model — MWIS-aligned mountain safety assessment.
 * Factors (max 100 pts): Wind 40, Wind chill 25, Conditions 20, Precip 10, Humidity 5.
 * Bands: 0-19 LOW, 20-39 MODERATE, 40-59 HIGH, 60-79 SEVERE, 80+ EXTREME
 */
import { WMO_CODES } from './weather-codes.js';

export const RISK_LABELS = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'EXTREME'];
export const RISK_COLORS = ['#22c55e', '#84cc16', '#f59e0b', '#f97316', '#dc2626'];

export function calcRisk(wx) {
  if (!wx) return { score: 0, band: 0, risk10: 0, riskColor: '#666', label: 'UNKNOWN', detail: [] };

  const wind = wx.wind_speed_10m || 0;
  const apparent = wx.apparent_temperature ?? 10;
  const wc = wx.weather_code ?? 0;
  const precip = wx.precipitation_probability ?? 0;
  const humidity = wx.relative_humidity_2m ?? 60;
  const wmo = WMO_CODES[wc] || { ds: 0, label: 'Unknown' };

  const windScore = wind > 50 ? 40 : wind > 40 ? 32 : wind > 30 ? 24 : wind > 20 ? 16 : wind > 10 ? 8 : 0;
  const chillScore = apparent < -10 ? 25 : apparent < -5 ? 18 : apparent < 0 ? 12 : apparent < 5 ? 5 : 0;
  const condScore = Math.round((wmo.ds / 80) * 20);
  const precipScore = Math.round((precip / 100) * 10);
  const humScore = humidity > 90 ? 5 : humidity > 80 ? 3 : humidity > 70 ? 1 : 0;

  const score = Math.min(100, windScore + chillScore + condScore + precipScore + humScore);
  const band = score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0;

  return {
    score,
    band,
    risk10: Math.round(score / 10),
    riskColor: RISK_COLORS[band],
    label: RISK_LABELS[band],
    detail: [
      { factor: 'Wind',          score: windScore,   max: 40, value: `${Math.round(wind)} mph`,        explain: windExplain(wind) },
      { factor: 'Wind chill',    score: chillScore,  max: 25, value: `Feels ${Math.round(apparent)}°C`, explain: chillExplain(apparent) },
      { factor: 'Conditions',    score: condScore,   max: 20, value: wmo.label,                         explain: `${wmo.label}. Affects visibility, footing and underfoot hazards.` },
      { factor: 'Precipitation', score: precipScore, max: 10, value: `${precip}%`,                      explain: precipExplain(precip) },
      { factor: 'Humidity',      score: humScore,    max:  5, value: `${humidity}%`,                    explain: humidityExplain(humidity) },
    ],
  };
}

function windExplain(w) {
  if (w > 50) return 'Extreme winds — walking very difficult or impossible. Do not ascend.';
  if (w > 40) return 'Severe winds — risk of being blown off balance on ridges.';
  if (w > 30) return 'Strong winds — exposed ridges significantly harder.';
  if (w > 20) return 'Fresh winds — secure loose items, expect resistance.';
  if (w > 10) return 'Moderate breeze — comfortable walking.';
  return 'Light wind — excellent ridge conditions.';
}

function chillExplain(app) {
  if (app < -10) return 'Severe wind chill — hypothermia risk without insulation.';
  if (app < -5)  return 'Significant chill — full winter clothing and gloves essential.';
  if (app < 0)   return 'Cold — waterproof layers and hat recommended.';
  if (app < 5)   return 'Cool — light insulation for summits.';
  return 'Mild — comfortable conditions.';
}

function precipExplain(p) {
  if (p > 80) return 'Very high chance of precipitation — waterproofs essential.';
  if (p > 60) return 'Likely precipitation — pack waterproofs.';
  if (p > 30) return 'Possible precipitation — bring waterproofs.';
  return 'Low chance of rain.';
}

function humidityExplain(h) {
  if (h > 90) return 'Very damp air — hill fog and summit cloud very likely.';
  if (h > 80) return 'High humidity — expect mist and reduced views.';
  if (h > 70) return 'Humid — summits may be in cloud.';
  return 'Dry air — good visibility likely.';
}

export function riskTitle(band) {
  return band >= 4 ? 'Extreme · do not ascend' :
         band >= 3 ? 'Severe · not recommended' :
         band >= 2 ? 'High · take serious care' :
         band >= 1 ? 'Moderate · exercise caution' :
                     'Low · favourable conditions';
}

export function riskDescription(detail) {
  return detail.slice().sort((a, b) => b.score - a.score).slice(0, 2)
    .map(d => `${d.factor}: ${d.value}`).join('. ') + '.';
}

/**
 * Overall Ascent Rating — blends mountain safety (85%) with midge (15%).
 * Weather can kill; midges only ruin the day.
 */
export function calcOverallRisk(mountainRisk, midge) {
  const mountainScore = mountainRisk.score;
  const midgeScore = (midge.level - 1) * 25;
  const combined = Math.round(mountainScore * 0.85 + midgeScore * 0.15);

  const band =
    combined >= 80 ? 4 :
    combined >= 60 ? 3 :
    combined >= 40 ? 2 :
    combined >= 20 ? 1 : 0;

  const headlines = [
    'Excellent ascent window',
    'Good day with preparation',
    'Manageable with care',
    'Poor for a Munro ascent',
    'Not recommended today',
  ];

  return {
    score: combined,
    band,
    riskColor: RISK_COLORS[band],
    label: RISK_LABELS[band],
    headline: headlines[band],
  };
}
