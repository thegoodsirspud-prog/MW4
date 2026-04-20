import { useState, useEffect } from 'react';
import { MUNROS } from './munros.js';
import { lookupWMO } from './weather-codes.js';
import { calcRisk } from './risk.js';

const SKY_EMOJI = {
  clear: '☀️', cloudy: '☁️', rain: '🌧️',
  snow: '❄️', storm: '⛈️', fog: '🌫️',
};

// Batch all 282 in waves of 30 — Open-Meteo handles this on the free tier.
const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 100;

function scorePeak(wx, peak) {
  if (!wx?.current) return null;
  const c = wx.current;
  const risk = calcRisk(c);
  const wmo = lookupWMO(c.weather_code);

  let score = (4 - risk.band) * 15;  // safety dominates: 0–60 pts

  score += ({ clear: 20, cloudy: 12, fog: 4, snow: 8, rain: -5, storm: -15 }[wmo.type] ?? 10);

  const wind = c.wind_speed_10m;
  if (wind < 25) score += 10;
  else if (wind < 35) score += 3;
  else score -= 8;

  score -= (c.precipitation_probability || 0) * 0.15;

  if (risk.band <= 1 && peak.h > 1100) score += 5;

  return { peak, wx: c, cond: wmo.label, type: wmo.type, risk, score: Math.round(score) };
}

function reasonFor({ wx, risk, type }) {
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

const MEDAL = ['🥇', '🥈', '🥉'];

export default function BestPeakToday({ onSelectPeak, onClose }) {
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const total = MUNROS.length;

  useEffect(() => {
    let cancelled = false;
    const all = [];

    const run = async () => {
      try {
        for (let i = 0; i < MUNROS.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const batch = MUNROS.slice(i, i + BATCH_SIZE);
          const fetched = await Promise.all(batch.map(async (peak) => {
            try {
              const url = `https://api.open-meteo.com/v1/forecast?latitude=${peak.lat}&longitude=${peak.lon}&elevation=${peak.h}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,precipitation_probability&wind_speed_unit=mph&temperature_unit=celsius&timezone=Europe%2FLondon`;
              const res = await fetch(url);
              if (!res.ok) return null;
              return scorePeak(await res.json(), peak);
            } catch { return null; }
          }));
          fetched.filter(Boolean).forEach(r => all.push(r));
          if (!cancelled) setProgress(Math.min(i + BATCH_SIZE, MUNROS.length));
          if (i + BATCH_SIZE < MUNROS.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
        if (cancelled) return;
        all.sort((a, b) => b.score - a.score);
        setResults(all.slice(0, 10));
      } catch (e) {
        if (!cancelled) setError('Could not load recommendations');
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  const loading = results === null && !error;

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
            <div className="best-peak-loading-title">Scoring all {total} Munros</div>
            <div className="best-peak-loading-bar-track">
              <div
                className="best-peak-loading-bar-fill"
                style={{ width: `${Math.round((progress / total) * 100)}%` }}
              />
            </div>
            <div className="best-peak-loading-sub">
              {progress} / {total} peaks analysed
            </div>
          </div>
        )}

        {error && <div className="best-peak-error">{error}</div>}

        {results && (
          <>
            <div className="best-peak-intro">
              Scored all {total} Munros on safety, conditions, wind and precipitation.
              Here are the top 10 for today.
            </div>
            <div className="best-peak-list">
              {results.map((r, i) => (
                <button
                  key={r.peak.name}
                  className={`best-peak-card best-peak-rank-${Math.min(i + 1, 4)}`}
                  onClick={() => onSelectPeak(r.peak)}
                >
                  <div className="best-peak-rank">
                    {i < 3 ? MEDAL[i] : <span className="best-peak-rank-num">{i + 1}</span>}
                  </div>
                  <div className="best-peak-main">
                    <div className="best-peak-name">{r.peak.name}</div>
                    <div className="best-peak-region">{r.peak.region} · {r.peak.h.toLocaleString()}m</div>
                    <div className="best-peak-reason">{reasonFor(r)}</div>
                  </div>
                  <div className="best-peak-stats">
                    <div className="best-peak-icon">{SKY_EMOJI[r.type] || '☁️'}</div>
                    <div className="best-peak-temp">{Math.round(r.wx.temperature_2m)}°</div>
                    <div className="best-peak-risk-dot" style={{ background: r.risk.riskColor, boxShadow: `0 0 8px ${r.risk.riskColor}` }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="best-peak-footer">Tap a peak for the full forecast.</div>
          </>
        )}
      </div>
    </div>
  );
}
