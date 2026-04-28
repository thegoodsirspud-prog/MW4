import { useState, useMemo } from 'react';
import { RISK_LABELS } from './risk.js';

/**
 * MunroHero
 *
 * The hero card: a sky panorama with the peak name, temperature, and a
 * sun/moon that tracks the forecast hour. Uses only atmospheric sky
 * gradients and celestial tracking — no terrain graphics.
 *
 * Design decisions:
 *   • The sun/moon position is derived from the current forecast hour
 *     so it tracks across the sky through the day.
 *   • The background gradient is time-of-day aware — dawn, midday, dusk,
 *     night — cross-faded to the weather-driven gradient so storms still
 *     look stormy at any hour.
 *   • The °C/°F toggle swaps which unit is primary. Both are always
 *     visible — active one large, inactive one small below.
 *   • Wind and ascent-safety are shown as compact chips in the hero so
 *     the user has everything at-a-glance. Detailed breakdowns live below.
 *
 * Props:
 *   view         — active forecast view (temp, feels, cond, type, precip, wind, windDirLabel, risk)
 *   munro        — selected Munro object (name, region, h)
 *   useF         — boolean, °F preference
 *   onUnitToggle — () => void
 *   skyType      — sky category: clear | cloudy | rain | snow | storm | fog
 *   midge        — { label, level, color } for the midge chip
 *   hourBanner   — optional banner render when previewing a non-now hour
 */
export default function MunroHero({
  view, munro, useF, onUnitToggle, skyType, midge, hourBanner,
  onPeakNameClick, onRingClick,
}) {
  const tempC = view.temp;
  const tempF = Math.round((tempC * 9) / 5 + 32);

  // Format an ISO datetime to HH:MM in the user's locale, falling back
  // gracefully when the data isn't present (e.g. first render before fetch).
  const fmtTime = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return null;
    }
  };
  const sunriseText = fmtTime(view.sunrise);
  const sunsetText = fmtTime(view.sunset);

  // When the user taps a specific hour or day, viewKey is not 'current'.
  // The eyebrow reflects this — live green dot becomes amber "previewing".
  const isPreview = view.viewKey !== 'current';
  // Daily previews represent a whole day, not a moment — so we hide the
  // sun/moon tracker (it would be misleading for a summary view) and
  // pin the sky to a mid-morning hour regardless of when the user
  // opened the app. Hourly and current views still animate through the day.
  const isDailyPreview = typeof view.viewKey === 'string' && view.viewKey.startsWith('day-');
  const hour = isDailyPreview ? 11 : (view.rawHour ?? new Date().getHours());

  // Convert "MODERATE" to "Moderate" — Ascent and Midge values should
  // read with identical case so the ring pair looks like a set, not a
  // typographic mismatch. RISK_LABELS stays uppercase at the source
  // because other parts of the app (outlook badges) want it that way.
  const toTitleCase = (s) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

  // ─── Celestial body position (sun/moon) ──────────────────────────────
  // Sun is up between 6:00 and 20:00 — we map that window to a horizontal
  // arc across the sky, with the peak at noon. Outside daylight we show
  // a moon instead, positioned on the opposite arc so it rises as the sun
  // sets. Tracks the actual day whether the forecast is current or previewed.
  const celestial = useMemo(() => {
    const daytime = hour >= 6 && hour <= 20;
    const t = daytime
      ? (hour - 6) / 14          // 0 at dawn → 1 at dusk
      : ((hour + 24 - 20) % 24) / 10;  // night progress
    const cx = 140 + t * 720;    // 140 left → 860 right across viewBox
    const arcY = 150 + Math.sin(t * Math.PI) * -70;  // rises & sets
    return { cx, cy: daytime ? arcY + 20 : arcY + 40, daytime };
  }, [hour]);

  return (
    <header
      className="mhero"
    >
      {/* ── Backdrop: atmospheric sky scene ────────────────────────── */}
      <svg
        className="mhero-scene"
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          {/* ── Sun system: three-layer corona + bright core ──────── */}
          <radialGradient id="sun-corona-outer">
            <stop offset="0%"  stopColor="rgba(255, 225, 160, 0.35)" />
            <stop offset="35%" stopColor="rgba(255, 210, 140, 0.15)" />
            <stop offset="70%" stopColor="rgba(255, 200, 120, 0.05)" />
            <stop offset="100%" stopColor="rgba(255, 190, 100, 0)" />
          </radialGradient>
          <radialGradient id="sun-corona-mid">
            <stop offset="0%"  stopColor="rgba(255, 240, 200, 0.8)" />
            <stop offset="30%" stopColor="rgba(255, 225, 170, 0.4)" />
            <stop offset="65%" stopColor="rgba(255, 215, 150, 0.1)" />
            <stop offset="100%" stopColor="rgba(255, 205, 130, 0)" />
          </radialGradient>
          <radialGradient id="sun-core">
            <stop offset="0%"  stopColor="#fffef8" />
            <stop offset="50%" stopColor="#fff0d0" />
            <stop offset="80%" stopColor="#ffe8b0" />
            <stop offset="100%" stopColor="#ffd880" />
          </radialGradient>
          {/* ── Moon system: soft blue glow + body + crescent mask ── */}
          <radialGradient id="moon-outer-glow">
            <stop offset="0%"  stopColor="rgba(200, 215, 240, 0.5)" />
            <stop offset="30%" stopColor="rgba(190, 210, 238, 0.2)" />
            <stop offset="65%" stopColor="rgba(180, 200, 230, 0.06)" />
            <stop offset="100%" stopColor="rgba(170, 195, 225, 0)" />
          </radialGradient>
          <radialGradient id="moon-surface">
            <stop offset="0%"  stopColor="#e8eef8" />
            <stop offset="60%" stopColor="#dce4f0" />
            <stop offset="100%" stopColor="#d0d8e8" />
          </radialGradient>
          <mask id="moon-crescent">
            <rect width="1000" height="400" fill="white" />
            <circle cx="0" cy="0" r="12" fill="black" id="moon-shadow" />
          </mask>
          {/* ── Soft cloud shapes for sky depth ──────────────────── */}
          <radialGradient id="cloud-soft">
            <stop offset="0%"  stopColor="rgba(255,255,255,0.18)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="cloud-blur">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* Scattered distant stars — night only, clear/snow skies.
            More stars, varied brightness, subtle twinkling animation. */}
        {!celestial.daytime && !isDailyPreview && (skyType === 'clear' || skyType === 'snow') && (
          <g opacity="0.85">
            {[
              [80, 30, 1.2], [160, 55, 0.8], [240, 22, 1.0], [320, 70, 0.7],
              [410, 28, 1.1], [480, 82, 0.6], [560, 42, 0.9], [640, 18, 1.3],
              [720, 65, 0.7], [800, 35, 1.0], [880, 55, 0.8], [940, 25, 0.9],
              [130, 95, 0.6], [350, 105, 0.7], [530, 92, 0.5], [710, 100, 0.6],
              [870, 88, 0.8], [50, 110, 0.5], [450, 12, 0.9], [760, 8, 0.7],
            ].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="#dce4f5">
                <animate attributeName="opacity" values={`${0.2 + (i%4)*0.15};${0.7 + (i%3)*0.1};${0.2 + (i%4)*0.15}`} dur={`${2.5 + (i % 5) * 0.8}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        )}

        {/* ── Atmospheric cloud wisps — give the hero sky depth ──── */}
        {(skyType === 'cloudy' || skyType === 'rain' || skyType === 'storm') && (
          <g opacity="0.6" filter="url(#cloud-blur)">
            <ellipse cx="200" cy="120" rx="180" ry="45" fill="url(#cloud-soft)">
              <animateTransform attributeName="transform" type="translate" values="0,0;30,2;0,0" dur="45s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="600" cy="80" rx="220" ry="55" fill="url(#cloud-soft)">
              <animateTransform attributeName="transform" type="translate" values="0,0;-25,3;0,0" dur="55s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="850" cy="140" rx="160" ry="40" fill="url(#cloud-soft)">
              <animateTransform attributeName="transform" type="translate" values="0,0;20,-2;0,0" dur="38s" repeatCount="indefinite" />
            </ellipse>
          </g>
        )}
        {(skyType === 'clear' || skyType === 'snow' || skyType === 'fog') && celestial.daytime && (
          <g opacity="0.35" filter="url(#cloud-blur)">
            <ellipse cx="300" cy="100" rx="160" ry="35" fill="url(#cloud-soft)">
              <animateTransform attributeName="transform" type="translate" values="0,0;35,1;0,0" dur="60s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="750" cy="130" rx="140" ry="30" fill="url(#cloud-soft)">
              <animateTransform attributeName="transform" type="translate" values="0,0;-30,2;0,0" dur="50s" repeatCount="indefinite" />
            </ellipse>
          </g>
        )}

        {/* ── Celestial body — rich sun or detailed moon ─────────── */}
        {!isDailyPreview && celestial.daytime && (
          <g>
            {/* Outer corona — very large, very soft warm glow */}
            <circle cx={celestial.cx} cy={celestial.cy} r="140" fill="url(#sun-corona-outer)" opacity="0.7" />
            {/* Middle corona — tighter, brighter halo */}
            <circle cx={celestial.cx} cy={celestial.cy} r="55" fill="url(#sun-corona-mid)" opacity="0.85" />
            {/* Core — bright white-gold disc */}
            <circle cx={celestial.cx} cy={celestial.cy} r="22" fill="url(#sun-core)" opacity="0.95" />
            {/* Subtle lens bloom — horizontal light streak */}
            <ellipse cx={celestial.cx} cy={celestial.cy} rx="80" ry="3" fill="rgba(255,240,200,0.12)" opacity="0.6">
              <animate attributeName="rx" values="80;90;80" dur="6s" repeatCount="indefinite" />
            </ellipse>
          </g>
        )}
        {!isDailyPreview && !celestial.daytime && (
          <g>
            {/* Outer glow — large cool-blue aura */}
            <circle cx={celestial.cx} cy={celestial.cy} r="90" fill="url(#moon-outer-glow)" opacity="0.75" />
            {/* Moon body with crescent */}
            <g>
              <circle cx={celestial.cx} cy={celestial.cy} r="16" fill="url(#moon-surface)" opacity="0.92" />
              {/* Crescent shadow — offset circle creates the phase */}
              <circle cx={celestial.cx + 6} cy={celestial.cy - 2} r="13" fill="rgba(20,30,55,0.75)" />
              {/* Surface craters — subtle marks */}
              <circle cx={celestial.cx - 5} cy={celestial.cy + 2} r="1.8" fill="rgba(160,175,200,0.4)" />
              <circle cx={celestial.cx - 2} cy={celestial.cy - 5} r="1.2" fill="rgba(160,175,200,0.3)" />
              <circle cx={celestial.cx - 7} cy={celestial.cy - 3} r="0.8" fill="rgba(160,175,200,0.25)" />
            </g>
          </g>
        )}
      </svg>

      {/* ── Foreground content ── */}
      <div className="mhero-content">
        <div className="mhero-top">
          <div className={`mhero-eyebrow ${isPreview ? 'mhero-eyebrow-preview' : ''}`}>
            <span className="mhero-dot" />
            {isPreview ? `Previewing · ${view.label}` : 'Live forecast'}
          </div>
          <h1 className="mhero-peak-name">
            {onPeakNameClick ? (
              <button
                type="button"
                className="mhero-peak-name-btn"
                onClick={onPeakNameClick}
                aria-label={`Show ${munro.name} on map`}
              >
                {munro.name}
                <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" className="mhero-peak-name-icon">
                  <path d="M2 7 L12 7 M8 3 L12 7 L8 11" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : munro.name}
          </h1>
          <div className="mhero-peak-meta">
            <span>{munro.region}</span>
            <span className="mhero-peak-sep" aria-hidden="true">·</span>
            <span>{munro.h.toLocaleString()}m</span>
          </div>
          {(sunriseText || sunsetText) && (
            <div className="mhero-sun-times" aria-label="Sunrise and sunset times">
              {sunriseText && (
                <span className="mhero-sun-item">
                  <svg className="mhero-sun-ico" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                    <circle cx="7" cy="9" r="2.6" fill="#ffd27a" />
                    <path d="M7 3 L7 5.5 M2.5 7 L4 7 M10 7 L11.5 7 M4 4.2 L5.1 5.3 M8.9 5.3 L10 4.2" stroke="#ffd27a" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
                    <path d="M1 11 L13 11" stroke="#ffd27a" strokeWidth="0.9" strokeLinecap="round" opacity="0.7"/>
                    <path d="M5 2.8 L7 0.8 L9 2.8" stroke="#ffd27a" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  {sunriseText}
                </span>
              )}
              {sunsetText && (
                <span className="mhero-sun-item">
                  <svg className="mhero-sun-ico" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                    <circle cx="7" cy="9" r="2.6" fill="#f0a66e" />
                    <path d="M7 3 L7 5.5 M2.5 7 L4 7 M10 7 L11.5 7 M4 4.2 L5.1 5.3 M8.9 5.3 L10 4.2" stroke="#f0a66e" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
                    <path d="M1 11 L13 11" stroke="#f0a66e" strokeWidth="0.9" strokeLinecap="round" opacity="0.7"/>
                    <path d="M5 0.8 L7 2.8 L9 0.8" stroke="#f0a66e" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  {sunsetText}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mhero-bottom">
          <div className="mhero-temp-wrap">
            <button
              className="mhero-temp"
              onClick={onUnitToggle}
              aria-label={`Temperature ${useF ? tempF + ' Fahrenheit' : tempC + ' Celsius'}. Tap to switch units.`}
              title="Tap to switch °C / °F"
            >
              <span className="mhero-temp-primary">
                <span className="mhero-temp-number">
                  {useF ? tempF : tempC}
                </span>
                <span className="mhero-temp-unit">°{useF ? 'F' : 'C'}</span>
              </span>
              <span className="mhero-temp-secondary" aria-hidden="true">
                {useF ? tempC : tempF}°{useF ? 'C' : 'F'}
              </span>
            </button>
          </div>

          <dl className="mhero-stats" aria-label="Current summit conditions">
            <div className="mhero-stat">
              <dt>Conditions</dt>
              <dd>{view.cond}</dd>
            </div>
            <div className="mhero-stat">
              <dt>Feels like</dt>
              <dd>
                {useF ? Math.round((view.feels * 9) / 5 + 32) : view.feels}°{useF ? 'F' : 'C'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Ring trio sits below the main bottom row, aligned right, so they
            share horizontal rhythm with the stat stack above them.
            Wind shows direction inside the ring; Ascent shows the band
            number (1-5); Midge shows the level (1-5). */}
        <div className="mhero-rings">
          <button
            type="button"
            className="mhero-ring mhero-ring--compass mhero-ring-btn"
            onClick={() => onRingClick?.('wind')}
            aria-label="Jump to conditions"
          >
            <div className="mhero-compass" aria-hidden="true">
              <svg viewBox="0 0 40 40" width="40" height="40">
                <circle cx="20" cy="20" r="17" fill="rgba(15, 25, 40, 0.45)"
                  stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1" />
                <line x1="20" y1="4"  x2="20" y2="7"  stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
                <line x1="20" y1="33" x2="20" y2="36" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
                <line x1="4"  y1="20" x2="7"  y2="20" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
                <line x1="33" y1="20" x2="36" y2="20" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1" />
                {/* Arrow points TO — shows where the wind is going,
                    matching the conditions card and user expectation.
                    bearing is the FROM direction, so +180 gives the TO. */}
                <g style={{ transform: `rotate(${(view.bearing + 180) % 360 || 0}deg)`, transformOrigin: '20px 20px', transition: 'transform 0.6s cubic-bezier(.4,0,.2,1)' }}>
                  <path
                    d="M20 7 L23.6 18 L20 16 L16.4 18 Z"
                    fill="#60a5fa"
                    stroke="rgba(15, 25, 40, 0.7)"
                    strokeWidth="0.6"
                    strokeLinejoin="round"
                  />
                  <circle cx="20" cy="20" r="1.6" fill="#ffffff" />
                </g>
              </svg>
              <span className="mhero-compass-letter mhero-compass-n">N</span>
            </div>
            <div className="mhero-ring-text">
              <div className="mhero-ring-label">Wind</div>
              <div className="mhero-ring-value">{view.wind} mph {view.windDirLabel}</div>
            </div>
          </button>

          <Ring
            label="Ascent"
            value={toTitleCase(RISK_LABELS[view.risk.band])}
            percent={(view.risk.band + 1) * 20}
            color={view.risk.riskColor}
            inner={<span className="mhero-ring-num">{view.risk.band + 1}</span>}
            onClick={onRingClick ? () => onRingClick('ascent') : undefined}
          />
          {midge && (
            <Ring
              label="Midge"
              value={midge.label}
              percent={Math.max(20, (midge.level || 1) * 20)}
              color="#ffffff"
              inner={<span className="mhero-ring-num">{midge.level || 1}</span>}
              onClick={onRingClick ? () => onRingClick('midge') : undefined}
            />
          )}
        </div>

        {hourBanner}
      </div>
    </header>
  );
}

/**
 * Ring — compact radial severity gauge used in the hero.
 * Identical visual language across Wind, Ascent, and Midge — a 40px
 * stroked circle with an animated arc whose length represents the
 * severity, content rendered inside the ring (number or arrow), and
 * the value + label beside it.
 *
 * Props:
 *   label  — small uppercase label beside the ring
 *   value  — value rendered beside the ring (e.g. "Moderate" / "12 SW")
 *   percent — 0-100, drives the arc length
 *   color  — arc + content tint
 *   inner  — optional ReactNode rendered INSIDE the ring (number, arrow)
 *            falls back to a small white dot if not provided
 */
function Ring({ label, value, percent, color, inner, onClick }) {
  // Geometry: r=15 → circumference ≈ 94.25. Arc length = circumference * pct.
  const r = 15;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, percent / 100));
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      className={`mhero-ring ${onClick ? 'mhero-ring-btn' : ''}`}
      onClick={onClick}
      {...(onClick ? { type: 'button', 'aria-label': `Jump to ${label.toLowerCase()}` } : {})}
    >
      <div className="mhero-ring-stack">
        <svg className="mhero-ring-svg" viewBox="0 0 40 40" aria-hidden="true">
          <circle
            cx="20" cy="20" r={r}
            fill="none"
            stroke="rgba(15, 25, 40, 0.45)"
            strokeWidth="3.5"
          />
          <circle
            cx="20" cy="20" r={r}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.16,1,.3,1)' }}
          />
        </svg>
        <div className="mhero-ring-inner">
          {inner ?? <div className="mhero-ring-dot" />}
        </div>
      </div>
      <div className="mhero-ring-text">
        <div className="mhero-ring-label">{label}</div>
        <div className="mhero-ring-value">{value}</div>
      </div>
    </Component>
  );
}
