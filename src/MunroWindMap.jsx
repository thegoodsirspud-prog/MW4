import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MunroWindMap
 *
 * Real-map wind visualisation. Same CARTO dark-matter vector basemap as
 * MunroTileMap so Scotland's coastlines/terrain are identical between
 * the two views, but instead of 282 peak dots this renders wind arrows
 * at 20 geographically-distributed iconic peaks.
 *
 * Why 20 peaks rather than 282 or a regular grid:
 * • 282 would be visually chaotic AND would require 282 API calls
 * • A regular grid is physically more accurate but abstract — arrows
 *   at named places (Nevis, Cairn Gorm, Lochnagar, Sgurr Alasdair...)
 *   give the wind a story
 * • 20 is the sweet spot: every major massif is represented, each arrow
 *   is legible, and 20 parallel fetches complete in under a second
 *
 * Arrow rendering approach:
 * • Each peak is a Point feature carrying its wind speed + direction
 * • An HTML overlay is used for each arrow so we can animate rotation
 *   via CSS transform (MapLibre's symbol rotation is static per-render)
 * • On pan/zoom, the overlays reposition via map.project()
 */

// 20 iconic peaks chosen for geographic spread across every major region.
// These are the peaks every mountaineer recognises AND together they
// cover the country from Skye in the west to the Cairngorms in the east,
// Sutherland in the north to Ben Lomond in the south.
const WIND_PEAKS = [
  // Far north
  { name: 'Ben Hope',           lat: 58.4157, lon: -4.6194, h: 927 },
  { name: 'Ben More Assynt',    lat: 58.1334, lon: -4.8577, h: 998 },
  // Torridon / Applecross
  { name: 'Liathach',           lat: 57.5510, lon: -5.4803, h: 1055 },
  { name: 'An Teallach',        lat: 57.8110, lon: -5.2700, h: 1062 },
  // Kintail / Affric
  { name: 'Carn Eighe',         lat: 57.2875, lon: -5.1155, h: 1183 },
  { name: 'The Saddle',         lat: 57.1666, lon: -5.4306, h: 1010 },
  // Skye Cuillin
  { name: 'Sgurr Alasdair',     lat: 57.2067, lon: -6.2261, h: 992 },
  // Knoydart
  { name: 'Ladhar Bheinn',      lat: 57.0653, lon: -5.6833, h: 1020 },
  // Lochaber / Nevis
  { name: 'Ben Nevis',          lat: 56.7967, lon: -5.0042, h: 1345 },
  { name: 'Aonach Beag',        lat: 56.8006, lon: -4.9537, h: 1234 },
  // Glen Coe
  { name: 'Bidean nam Bian',    lat: 56.6432, lon: -5.0295, h: 1150 },
  { name: 'Buachaille Etive Mor', lat: 56.6400, lon: -4.8958, h: 1022 },
  // Cairngorms
  { name: 'Ben Macdui',         lat: 57.0706, lon: -3.6700, h: 1309 },
  { name: 'Cairn Gorm',         lat: 57.1167, lon: -3.6440, h: 1245 },
  { name: 'Lochnagar',          lat: 56.9605, lon: -3.2457, h: 1155 },
  // Breadalbane / Central
  { name: 'Ben Lawers',         lat: 56.5452, lon: -4.2211, h: 1214 },
  { name: 'Schiehallion',       lat: 56.6685, lon: -4.0986, h: 1083 },
  // South
  { name: 'Ben More',           lat: 56.3863, lon: -4.5407, h: 1174 },
  { name: 'Ben Lomond',         lat: 56.1903, lon: -4.6328, h: 974 },
  // Mull
  { name: 'Ben More (Mull)',    lat: 56.4203, lon: -6.0144, h: 966 },
];

// Wind speed → colour. Five bands matching the mountain-risk palette so
// users immediately transfer meaning: green = safe, red = dangerous.
// Calibrated for mountain summits where 40+ mph is genuinely inadvisable.
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

export default function MunroWindMap({ onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [windData, setWindData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);

  // Fetch current wind for every peak in parallel
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all(WIND_PEAKS.map(async (pt) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lon}&elevation=${pt.h}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=mph&timezone=Europe%2FLondon`;
        const res = await fetch(url);
        const data = await res.json();
        return {
          ...pt,
          speed: data.current?.wind_speed_10m ?? 0,
          gust: data.current?.wind_gusts_10m ?? 0,
          dir: data.current?.wind_direction_10m ?? 0,
        };
      } catch {
        return { ...pt, speed: 0, gust: 0, dir: 0 };
      }
    })).then((results) => {
      if (!cancelled) {
        setWindData(results);
        setLoading(false);
      }
    });

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
  // Recomputed every render while map is moving; cheap (20 items).
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
            {loading ? 'Sampling 20 summits…' : 'Summit winds · updated live'}
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
          <div className="wind-loading">
            <div className="wind-loading-spinner" />
            <div className="wind-loading-text">Sampling 20 summits…</div>
          </div>
        )}
      </div>
    </div>
  );
}
