import { useState, useEffect, useRef, useMemo } from 'react';
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
}) {
  const tempC = view.temp;
  const tempF = Math.round((tempC * 9) / 5 + 32);
  const hour = view.rawHour ?? new Date().getHours();

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

  // ─── Subtle parallax on the sun/moon only ────────────────────────────
  const heroRef = useRef(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const reducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const onMouseMove = (e) => {
    if (reducedMotion.current) return;
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width - 0.5) * 2;   // -1..1
    const py = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setParallax({ x: px, y: py });
  };
  const onMouseLeave = () => setParallax({ x: 0, y: 0 });

  // Device orientation (mobile) — subtle tilt parallax
  useEffect(() => {
    if (reducedMotion.current) return;
    const handler = (e) => {
      const x = Math.max(-15, Math.min(15, e.gamma || 0)) / 15;
      const y = Math.max(-15, Math.min(15, (e.beta || 0) - 45)) / 15;
      setParallax({ x, y });
    };
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handler);
      return () => window.removeEventListener('deviceorientation', handler);
    }
  }, []);

  // Sun/moon drifts slightly with pointer — gives a subtle sense of depth
  const pyCelestial = parallax.y * 3;
  const pxCelestial = parallax.x * 3;

  return (
    <header
      className="mhero"
      ref={heroRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* ── Backdrop: sky + ridges in one scene ──────────────────── */}
      <svg
        className="mhero-scene"
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          {/* Sun glow */}
          <radialGradient id="sun-glow">
            <stop offset="0%"  stopColor="rgba(255, 235, 180, 0.9)" />
            <stop offset="40%" stopColor="rgba(255, 215, 140, 0.3)" />
            <stop offset="100%" stopColor="rgba(255, 200, 120, 0)" />
          </radialGradient>
          <radialGradient id="moon-glow">
            <stop offset="0%"  stopColor="rgba(220, 230, 250, 0.85)" />
            <stop offset="40%" stopColor="rgba(200, 215, 240, 0.15)" />
            <stop offset="100%" stopColor="rgba(180, 200, 230, 0)" />
          </radialGradient>
        </defs>

        {/* No sky fill — the page's .sky gradient shows through, so the hero
            is visually seamless with the rest of the page. Only the sun/moon
            and stars float on this transparent SVG layer. */}

        {/* Scattered distant stars (night only, clear or snow sky) */}
        {!celestial.daytime && (skyType === 'clear' || skyType === 'snow') && (
          <g opacity="0.7">
            {[
              [110, 40], [230, 28], [320, 70], [440, 35], [560, 55],
              [680, 30], [770, 65], [870, 45], [150, 85], [380, 95],
              [610, 90], [820, 100], [50, 110], [950, 75],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.1 : 0.7} fill="#e8eef8">
                <animate attributeName="opacity" values="0.3;1;0.3" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        )}

        {/* Celestial body — sun or moon */}
        <g style={{ transform: `translate(${pxCelestial}px, ${pyCelestial}px)` }}>
          <circle
            cx={celestial.cx}
            cy={celestial.cy}
            r="90"
            fill={celestial.daytime ? 'url(#sun-glow)' : 'url(#moon-glow)'}
            opacity="0.8"
          />
          <circle
            cx={celestial.cx}
            cy={celestial.cy}
            r={celestial.daytime ? 18 : 14}
            fill={celestial.daytime ? '#ffe4a8' : '#dce6f5'}
            opacity={celestial.daytime ? 0.95 : 0.9}
          />
          {!celestial.daytime && (
            <circle cx={celestial.cx + 5} cy={celestial.cy - 3} r="3.2" fill="rgba(100, 115, 140, 0.5)" />
          )}
        </g>
      </svg>

      {/* ── Foreground content ── */}
      <div className="mhero-content">
        <div className="mhero-top">
          <div className={`mhero-eyebrow ${isPreview ? 'mhero-eyebrow-preview' : ''}`}>
            <span className="mhero-dot" />
            {isPreview ? `Previewing · ${view.label}` : 'Live forecast'}
          </div>
          <h1 className="mhero-peak-name">{munro.name}</h1>
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
            <div className="mhero-stat">
              <dt>Wind</dt>
              <dd>
                <span className="mhero-stat-strong">{view.wind}</span>
                <span className="mhero-stat-unit"> mph </span>
                <span className="mhero-stat-dim">{view.windDirLabel}</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Ring trio sits below the main bottom row, aligned right, so they
            share horizontal rhythm with the stat stack above them.
            Wind shows direction inside the ring; Ascent shows the band
            number (1-5); Midge shows the level (1-5). */}
        <div className="mhero-rings">
          <Ring
            label="Wind"
            value={`${view.wind} mph`}
            percent={Math.min(100, view.wind * 2.5)}
            color={windRingColor(view.wind)}
            inner={(
              <svg
                className="mhero-ring-arrow"
                viewBox="0 0 12 12"
                width="14" height="14"
                style={{ transform: `rotate(${view.bearing || 0}deg)` }}
                aria-hidden="true"
              >
                <path
                  d="M6 1.5 L9 7 L6.8 7 L6.8 10.5 L5.2 10.5 L5.2 7 L3 7 Z"
                  fill={windRingColor(view.wind)}
                  stroke="rgba(15, 25, 40, 0.7)"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          />
          <Ring
            label="Ascent"
            value={toTitleCase(RISK_LABELS[view.risk.band])}
            percent={(view.risk.band + 1) * 20}
            color={view.risk.riskColor}
            inner={<span className="mhero-ring-num">{view.risk.band + 1}</span>}
          />
          {midge && (
            <Ring
              label="Midge"
              value={midge.label}
              percent={Math.max(20, (midge.level || 1) * 20)}
              color={midge.color || '#94a3b8'}
              inner={<span className="mhero-ring-num">{midge.level || 1}</span>}
            />
          )}
        </div>

        {hourBanner}
      </div>
    </header>
  );
}

/**
 * windRingColor — five-band colour mapping for the wind ring arc, matching
 * the wind map's legend so the visual language is consistent across the app.
 */
function windRingColor(mph) {
  if (mph < 10) return '#22c55e';
  if (mph < 20) return '#84cc16';
  if (mph < 30) return '#eab308';
  if (mph < 40) return '#f97316';
  return '#ef4444';
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
function Ring({ label, value, percent, color, inner }) {
  // Geometry: r=15 → circumference ≈ 94.25. Arc length = circumference * pct.
  const r = 15;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, percent / 100));
  return (
    <div className="mhero-ring">
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
    </div>
  );
}
