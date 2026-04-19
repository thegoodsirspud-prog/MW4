import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MUNROS } from './munros.js';

/**
 * MunroWindMap
 *
 * Real-map wind visualisation. Same CARTO dark-matter vector basemap as
 * MunroTileMap so Scotland's coastlines/terrain are identical between
 * the two views. Renders a wind arrow at EVERY one of Scotland's 282
 * Munros — a complete national wind picture.
 *
 * Why all 282 (vs a sampling): a sample of 20 peaks looks tidy but
 * loses the ability to see actual weather PATTERNS — pressure systems
 * sweeping in from the Atlantic show up clearly only when you can see
 * the gradient across Skye → Knoydart → Lochaber. With all 282 you
 * literally see weather moving across Scotland in real time.
 *
 * Performance: 282 parallel fetches against Open-Meteo's free tier is
 * acceptable but rough. We batch in waves of 30 with a small delay so
 * the API isn't hammered, and we render arrows progressively as data
 * arrives — not waiting for all 282 to finish before showing anything.
 */

// Wind speed → colour. Five bands matching the mountain-risk palette so
// users immediately transfer meaning: green = safe, red = dangerous.
function windColor(mph) {
  if (mph < 10) return '#22c55e';
  if (mph < 20) return '#84cc16';
  if (mph < 30) return '#eab308';
  if (mph < 40) return '#f97316';
  return '#ef4444';
}

function windLabel(mph) {
  if (mph < 10) return 'Calm';
  if (mph < 20) return 'Light';
  if (mph < 30) return 'Breezy';
  if (mph < 40) return 'Strong';
  return 'Dangerous';
}

const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 120;

export default function MunroWindMap({ onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [windData, setWindData] = useState([]);  // grows progressively
  const [loaded, setLoaded] = useState(0);
  const [hovered, setHovered] = useState(null);

  const total = MUNROS.length;
  const loading = loaded < total;

  // Batched fetch: 30 peaks per wave, 120ms between waves. Renders arrows
  // progressively as each wave completes — user sees the map populate
  // gradually rather than waiting for all 282 to finish.
  useEffect(() => {
    let cancelled = false;
    const collected = [];

    const fetchBatch = async (batch) => {
      const results = await Promise.all(batch.map(async (pt) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lon}&elevation=${pt.h}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=mph&timezone=Europe%2FLondon`;
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = await res.json();
          return {
            name: pt.name, lat: pt.lat, lon: pt.lon, h: pt.h, region: pt.region,
            speed: data.current?.wind_speed_10m ?? 0,
            gust: data.current?.wind_gusts_10m ?? 0,
            dir: data.current?.wind_direction_10m ?? 0,
          };
        } catch {
          return null;
        }
      }));
      return results.filter(Boolean);
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      for (let i = 0; i < MUNROS.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = MUNROS.slice(i, i + BATCH_SIZE);
        const results = await fetchBatch(batch);
        if (cancelled) return;
        collected.push(...results);
        setWindData([...collected]);
        setLoaded(Math.min(i + BATCH_SIZE, MUNROS.length));
        if (i + BATCH_SIZE < MUNROS.length) await sleep(BATCH_DELAY_MS);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Initialise the map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-4.2, 57.0],
      zoom: 6.2,
      minZoom: 5,
      maxZoom: 11,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => setReady(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Force-update on pan/zoom so the HTML arrow overlays follow
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const bump = () => setTick((t) => t + 1);
    map.on('move', bump);
    map.on('zoom', bump);
    return () => {
      map.off('move', bump);
      map.off('zoom', bump);
    };
  }, [ready]);

  // Project each wind-peak to screen coordinates for HTML overlay positioning.
  // Recomputed every render while map is moving; cheap even at 282 items.
  const projected = (() => {
    if (!ready || !mapRef.current || !windData) return [];
    const map = mapRef.current;
    return windData.map((pt) => {
      const { x, y } = map.project([pt.lon, pt.lat]);
      return { ...pt, x, y };
    });
  })();

  return (
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title">
          <div className="map-eyebrow">Live Wind Map</div>
          <div className="map-subtitle">
            {loading
              ? `Sampling all ${total} summits · ${loaded}/${total}`
              : `All ${total} summits · live wind`}
          </div>
        </div>
        <button className="map-close" onClick={onClose} aria-label="Close map">✕</button>
      </div>

      <div ref={containerRef} className="tile-map-viewport">
        {/* Arrow overlays — positioned absolutely, follow the map via project() */}
        {projected.map((pt) => (
          <div
            key={pt.name}
            className="wind-arrow-wrap"
            style={{ left: pt.x, top: pt.y }}
            onMouseEnter={() => setHovered(pt.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setHovered(hovered === pt.name ? null : pt.name)}
          >
            <div
              className="wind-arrow"
              style={{
                transform: `rotate(${pt.dir}deg)`,
                color: windColor(pt.speed),
              }}
              aria-label={`${pt.name}: ${Math.round(pt.speed)} mph wind`}
            >
              {/* The arrow itself — clean chevron that reads at a glance */}
              <svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">
                <path
                  d="M12 2 L20 12 L14 12 L14 28 L10 28 L10 12 L4 12 Z"
                  fill="currentColor"
                  stroke="rgba(15, 25, 40, 0.8)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="wind-arrow-speed" style={{ color: windColor(pt.speed) }}>
              {Math.round(pt.speed)}
            </div>
            {hovered === pt.name && (
              <div className="wind-arrow-tooltip">
                <div className="wind-arrow-tooltip-name">{pt.name}</div>
                <div className="wind-arrow-tooltip-detail">
                  <span className="wind-arrow-tooltip-speed" style={{ color: windColor(pt.speed) }}>
                    {Math.round(pt.speed)} mph
                  </span>
                  <span className="wind-arrow-tooltip-label">{windLabel(pt.speed)}</span>
                </div>
                {pt.gust > pt.speed + 3 && (
                  <div className="wind-arrow-tooltip-gust">
                    Gusting {Math.round(pt.gust)} mph
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Legend — bottom-left */}
        <div className="wind-legend">
          <div className="wind-legend-title">Wind speed</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#22c55e' }} /> Calm · under 10 mph</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#84cc16' }} /> Light · 10–20</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#eab308' }} /> Breezy · 20–30</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#f97316' }} /> Strong · 30–40</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#ef4444' }} /> Dangerous · 40+</div>
        </div>

        {loading && (
          <div className="wind-progress-chip" role="status" aria-live="polite">
            <div className="wind-progress-spinner" />
            <span className="wind-progress-text">{loaded} / {total}</span>
          </div>
        )}
      </div>
    </div>
  );
}
