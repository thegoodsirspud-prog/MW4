import { useState, useEffect } from 'react';
import { MUNROS } from './munros.js';
import { lookupWMO } from './weather-codes.js';
import { calcRisk } from './risk.js';

// Lightweight emoji icon per sky type — we can't import WeatherIcon from
// App.jsx without a circular import, and a small emoji set ships at zero
// byte cost and renders crisply at any size.
const SKY_EMOJI = {
  clear: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
  storm: '⛈️',
  fog: '🌫️',
};

/**
 * BestPeakToday
 *
 * The "advisor" view — not a reference tool. Answers the one question a
 * user actually has on a Saturday morning: "where should I go today?"
 *
 * How it works:
 * 1. Score 28 iconic, geographically-distributed Munros on today's conditions
 * 2. Rank by a composite score that weights mountain safety heavily, then
 *    visibility (for views), then wind chill comfort, then precipitation
 * 3. Present the top 3 with a human-readable reason why each made the list
 *
 * The 28 peaks are chosen to:
 *  • Cover every major region (no-one lives in Knoydart only)
 *  • Include famous peaks (Ben Nevis, Cairn Gorm, Lochnagar, etc)
 *  • Span elevation (927m up to 1345m) so not always the same names win
 *
 * Why 28 not 282:
 *  • Open-Meteo free tier handles 28 parallel fetches cleanly
 *  • 282 would take 5+ seconds even on fast connections
 *  • 28 named peaks produce a more meaningful recommendation than a
 *    statistical average across every hillock
 */

const RECOMMENDATION_PEAKS = [
  'Ben Hope', 'Ben More Assynt',
  'An Teallach', 'Liathach', 'Beinn Alligin',
  'Carn Eighe', 'The Saddle', 'Sgurr Fhuaran',
  'Sgurr Alasdair', 'Bla Bheinn',
  'Ladhar Bheinn', 'Sgurr na Ciche',
  'Ben Nevis', 'Aonach Beag', 'Stob Choire Claurigh',
  'Bidean nam Bian', 'Buachaille Etive Mor', 'Buachaille Etive Beag',
  'Ben Macdui', 'Cairn Gorm', 'Braeriach',
  'Lochnagar', 'Beinn a\' Ghlo',
  'Ben Lawers', 'Schiehallion', 'Ben Cruachan',
  'Ben More', 'Ben Lomond',
];

/**
 * Composite scoring — higher = better day to climb.
 * Inverted risk band (4-band = 4, 0-band = 0) dominates because safety
 * is paramount. Then visibility bonus (clear summits = views). Then
 * wind comfort. Then precipitation penalty.
 */
function scorePeak(wx, peak) {
  if (!wx?.current) return null;
  const c = wx.current;
  const risk = calcRisk(c);
  const wmo = lookupWMO(c.weather_code);

  // Safety is worth ~60 points (band 0 = 60, band 4 = 0)
  let score = (4 - risk.band) * 15;

  // Condition bonus — clear sky > cloudy > rain
  const condBonus = {
    clear: 20,
    cloudy: 12,
    fog: 4,
    snow: 8,
    rain: -5,
    storm: -15,
  }[wmo.type] || 10;
  score += condBonus;

  // Wind comfort — 10-20mph is perfect, above 30 is uncomfortable
  const wind = c.wind_speed_10m;
  if (wind < 25) score += 10;
  else if (wind < 35) score += 3;
  else score -= 8;

  // Precipitation penalty
  const precip = c.precipitation_probability || 0;
  score -= precip * 0.15;

  // Slight preference for higher peaks when safe — they offer better views
  if (risk.band <= 1 && peak.h > 1100) score += 5;

  return {
    peak,
    wx: c,
    cond: wmo.label,
    type: wmo.type,
    risk,
    score: Math.round(score),
  };
}

/**
 * Human-readable "why this peak" — two to three words that summarise
 * what's special about today's conditions here.
 */
function reasonFor(result) {
  const { wx, risk, type } = result;
  const wind = Math.round(wx.wind_speed_10m);
  const reasons = [];

  if (risk.band === 0) reasons.push('Safe conditions');
  else if (risk.band === 1) reasons.push('Fair conditions');
  if (type === 'clear') reasons.push('clear summit');
  else if (type === 'cloudy' && wind < 20) reasons.push('calm skies');
  if (wind < 15) reasons.push('light winds');
  else if (wind < 25) reasons.push(`${wind} mph wind`);
  if (wx.precipitation_probability < 15) reasons.push('dry');

  return reasons.slice(0, 2).join(' · ') || `${wind} mph wind`;
}

export default function BestPeakToday({ onSelectPeak, onClose }) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBest = async () => {
      try {
        const peaks = RECOMMENDATION_PEAKS
          .map((name) => MUNROS.find((m) => m.name === name))
          .filter(Boolean);

        // Parallel fetch — all 28 peaks at once
        const fetches = peaks.map(async (peak) => {
          try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${peak.lat}&longitude=${peak.lon}&elevation=${peak.h}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,precipitation_probability&wind_speed_unit=mph&temperature_unit=celsius&timezone=Europe%2FLondon`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            return scorePeak(data, peak);
          } catch {
            return null;
          }
        });

        const scored = (await Promise.all(fetches)).filter(Boolean);
        if (cancelled) return;

        // Sort by score, take top 3
        scored.sort((a, b) => b.score - a.score);
        setResults(scored.slice(0, 3));
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError('Could not fetch recommendations');
          setLoading(false);
        }
      }
    };

    fetchBest();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="best-peak-overlay">
      <div className="best-peak-header">
        <div>
          <div className="best-peak-eyebrow">Today's Recommendations</div>
          <div className="best-peak-title">Best peaks to climb</div>
        </div>
        <button className="map-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="best-peak-body">
        {loading && (
          <div className="best-peak-loading">
            <div className="best-peak-spinner" />
            <div className="best-peak-loading-title">Analysing today's conditions</div>
            <div className="best-peak-loading-sub">
              Scoring {RECOMMENDATION_PEAKS.length} iconic peaks on safety,
              visibility, wind, and weather…
            </div>
          </div>
        )}

        {error && (
          <div className="best-peak-error">
            {error}. Please try again in a moment.
          </div>
        )}

        {results && results.length > 0 && (
          <>
            <div className="best-peak-intro">
              Based on live summit weather for {RECOMMENDATION_PEAKS.length} of
              Scotland's most iconic peaks, here are today's three best options.
            </div>
            <div className="best-peak-list">
              {results.map((r, i) => (
                <button
                  key={r.peak.name}
                  className={`best-peak-card best-peak-rank-${i + 1}`}
                  onClick={() => onSelectPeak(r.peak)}
                >
                  <div className="best-peak-rank">{i + 1}</div>
                  <div className="best-peak-main">
                    <div className="best-peak-name">{r.peak.name}</div>
                    <div className="best-peak-region">
                      {r.peak.region} · {r.peak.h.toLocaleString()}m
                    </div>
                    <div className="best-peak-reason">{reasonFor(r)}</div>
                  </div>
                  <div className="best-peak-stats">
                    <div className="best-peak-icon">
                      {SKY_EMOJI[r.type] || '☁️'}
                    </div>
                    <div className="best-peak-temp">
                      {Math.round(r.wx.temperature_2m)}°
                    </div>
                    <div
                      className="best-peak-risk-dot"
                      style={{
                        background: r.risk.riskColor,
                        boxShadow: `0 0 8px ${r.risk.riskColor}`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
            <div className="best-peak-footer">
              Tap a peak for the full forecast.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
