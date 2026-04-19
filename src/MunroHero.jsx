import { useState, useEffect, useRef, useMemo } from 'react';

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
 *
 * Props:
 *   view         — active forecast view (temp, feels, cond, type, precip)
 *   munro        — selected Munro object (name, region, h)
 *   useF         — boolean, °F preference
 *   onUnitToggle — () => void
 *   onPickPeak   — () => void, opens peak picker
 *   skyType      — sky category: clear | cloudy | rain | snow | storm | fog
 *   hourBanner   — optional banner render when previewing a non-now hour
 */
export default function MunroHero({
  view, munro, useF, onUnitToggle, onPickPeak, skyType, hourBanner,
}) {
  const tempC = view.temp;
  const tempF = Math.round((tempC * 9) / 5 + 32);
  const hour = view.rawHour ?? new Date().getHours();

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

  // ─── Sky gradient — composite of time-of-day + weather ────────────────
  const skyGradientId = `sky-${skyType}-${celestial.daytime ? 'day' : 'night'}`;

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
          {/* Sky gradients per mood + time */}
          <linearGradient id="sky-clear-day" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#1e3a62" />
            <stop offset="40%" stopColor="#3b6ea5" />
            <stop offset="75%" stopColor="#8fb4d4" />
            <stop offset="100%" stopColor="#d4c7a8" />
          </linearGradient>
          <linearGradient id="sky-clear-night" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#0a0f1f" />
            <stop offset="50%" stopColor="#1a2340" />
            <stop offset="100%" stopColor="#3d4a6b" />
          </linearGradient>
          <linearGradient id="sky-cloudy-day" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#2a3340" />
            <stop offset="50%" stopColor="#4a5360" />
            <stop offset="100%" stopColor="#7a8290" />
          </linearGradient>
          <linearGradient id="sky-cloudy-night" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#101521" />
            <stop offset="100%" stopColor="#2a3340" />
          </linearGradient>
          <linearGradient id="sky-rain-day" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#253040" />
            <stop offset="60%" stopColor="#405060" />
            <stop offset="100%" stopColor="#6a7682" />
          </linearGradient>
          <linearGradient id="sky-rain-night" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#0d1420" />
            <stop offset="100%" stopColor="#283440" />
          </linearGradient>
          <linearGradient id="sky-storm-day" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#15202b" />
            <stop offset="50%" stopColor="#28323e" />
            <stop offset="100%" stopColor="#4a5562" />
          </linearGradient>
          <linearGradient id="sky-storm-night" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#080c14" />
            <stop offset="100%" stopColor="#1e2732" />
          </linearGradient>
          <linearGradient id="sky-snow-day" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#3d4b5e" />
            <stop offset="50%" stopColor="#6a7894" />
            <stop offset="100%" stopColor="#9daac0" />
          </linearGradient>
          <linearGradient id="sky-snow-night" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#18202e" />
            <stop offset="100%" stopColor="#384458" />
          </linearGradient>
          <linearGradient id="sky-fog-day" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#485260" />
            <stop offset="100%" stopColor="#a5afbb" />
          </linearGradient>
          <linearGradient id="sky-fog-night" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"  stopColor="#1a2028" />
            <stop offset="100%" stopColor="#4a5460" />
          </linearGradient>

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

          {/* Subtle grain overlay for texture — cheap SVG turbulence */}
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.04 0" />
          </filter>

          {/* Bottom vignette for text contrast */}
          <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"  stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </linearGradient>
        </defs>

        {/* Sky background */}
        <rect width="1000" height="400" fill={`url(#${skyGradientId})`} />

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

        {/* Grain overlay */}
        <rect width="1000" height="400" filter="url(#grain)" opacity="0.5" />

        {/* Bottom vignette for text contrast */}
        <rect width="1000" height="120" y="280"
          fill="url(#vignette)" opacity="0.7" pointerEvents="none" />
      </svg>

      {/* ── Foreground content ── */}
      <div className="mhero-content">
        <div className="mhero-top">
          <div className="mhero-eyebrow">
            <span className="mhero-dot" />
            Live · summit elevation forecast
          </div>
          <button className="mhero-peak" onClick={onPickPeak} aria-label="Change peak">
            <span className="mhero-peak-name">{munro.name}</span>
            <span className="mhero-peak-sub">
              {munro.region} · {munro.h.toLocaleString()}m
            </span>
            <svg className="mhero-peak-chev" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
              <path d="M3 5 L6 8 L9 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
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
          <div className="mhero-meta">
            <div className="mhero-cond">{view.cond}</div>
            <div className="mhero-feels">
              Feels {useF ? Math.round((view.feels * 9) / 5 + 32) : view.feels}°{useF ? 'F' : 'C'}
            </div>
          </div>
        </div>

        {hourBanner}
      </div>
    </header>
  );
}
