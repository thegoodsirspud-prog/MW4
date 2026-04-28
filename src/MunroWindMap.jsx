import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MunroWindMap v8 — Screen-space animated arrow particles
 *
 * Each particle is a MapLibre symbol (screen-space icon) that drifts
 * with the wind field. Icons stay the same pixel size at every zoom
 * level — always visible, always readable.
 */

const STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

const BOUNDS = { west: -8.0, east: -1.2, south: 55.2, north: 59.2 };
const GRID_W = 10, GRID_H = 7;
const PARTICLE_COUNT = 300;
const MAX_AGE = 80;
// 13× the old value — gives ~30px/sec drift at zoom 6
const SPEED_FACTOR = 0.002;

const LOCATIONS = [
  { name: 'Lerwick', lat: 60.15, lon: -1.14, kind: 'town' },
  { name: 'Kirkwall', lat: 58.98, lon: -2.96, kind: 'town' },
  { name: 'Stornoway', lat: 58.21, lon: -6.39, kind: 'town' },
  { name: 'Ullapool', lat: 57.90, lon: -5.16, kind: 'town' },
  { name: 'Inverness', lat: 57.48, lon: -4.22, kind: 'town' },
  { name: 'Portree', lat: 57.41, lon: -6.19, kind: 'town' },
  { name: 'Aberdeen', lat: 57.15, lon: -2.09, kind: 'town' },
  { name: 'Fort William', lat: 56.82, lon: -5.11, kind: 'town' },
  { name: 'Cairn Gorm', lat: 57.12, lon: -3.64, kind: 'peak' },
  { name: 'Ben Nevis', lat: 56.80, lon: -5.00, kind: 'peak' },
  { name: 'Perth', lat: 56.40, lon: -3.43, kind: 'town' },
  { name: 'Oban', lat: 56.42, lon: -5.47, kind: 'town' },
  { name: 'Glasgow', lat: 55.86, lon: -4.25, kind: 'town' },
  { name: 'Edinburgh', lat: 55.95, lon: -3.19, kind: 'town' },
];

function windColor(mph) { return mph < 10 ? '#22c55e' : mph < 20 ? '#84cc16' : mph < 30 ? '#eab308' : mph < 40 ? '#f97316' : '#ef4444'; }
function windLabel(mph) { return mph < 10 ? 'Calm' : mph < 20 ? 'Light' : mph < 30 ? 'Breezy' : mph < 40 ? 'Strong' : 'Dangerous'; }

// ── Data fetching ──────────────────────────────────────────────────────

async function fetchWindGrid() {
  const points = [];
  for (let j = 0; j < GRID_H; j++)
    for (let i = 0; i < GRID_W; i++)
      points.push({ i, j,
        lat: BOUNDS.south + (j / (GRID_H - 1)) * (BOUNDS.north - BOUNDS.south),
        lon: BOUNDS.west + (i / (GRID_W - 1)) * (BOUNDS.east - BOUNDS.west),
      });
  const results = await Promise.all(points.map(async (p) => {
    try {
      const d = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe%2FLondon`)).json();
      const speed = d.current?.wind_speed_10m ?? 0;
      const a = ((d.current?.wind_direction_10m ?? 0) + 180) % 360 * Math.PI / 180;
      return { ...p, u: Math.sin(a) * speed, v: Math.cos(a) * speed, speed };
    } catch { return { ...p, u: 0, v: 0, speed: 0 }; }
  }));
  const grid = new Float32Array(GRID_W * GRID_H * 3);
  let maxSpeed = 0;
  for (const r of results) {
    const idx = (r.j * GRID_W + r.i) * 3;
    grid[idx] = r.u; grid[idx + 1] = r.v; grid[idx + 2] = r.speed;
    if (r.speed > maxSpeed) maxSpeed = r.speed;
  }
  return { grid, maxSpeed };
}

async function fetchLocationData() {
  return (await Promise.all(LOCATIONS.map(async (loc) => {
    try {
      const d = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=mph&timezone=Europe%2FLondon`)).json();
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [loc.lon, loc.lat] },
        properties: {
          name: loc.name, kind: loc.kind,
          speed: Math.round(d.current?.wind_speed_10m ?? 0),
          gust: Math.round(d.current?.wind_gusts_10m ?? 0),
          bearing: d.current?.wind_direction_10m ?? 0,
          color: windColor(d.current?.wind_speed_10m ?? 0),
        },
      };
    } catch { return null; }
  }))).filter(Boolean);
}

// ── Wind sampling ──────────────────────────────────────────────────────

function sampleWind(grid, lon, lat) {
  if (lon < BOUNDS.west || lon > BOUNDS.east || lat < BOUNDS.south || lat > BOUNDS.north) return { u: 0, v: 0, speed: 0 };
  const fx = (lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west) * (GRID_W - 1);
  const fy = (lat - BOUNDS.south) / (BOUNDS.north - BOUNDS.south) * (GRID_H - 1);
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  const i1 = Math.min(i0 + 1, GRID_W - 1), j1 = Math.min(j0 + 1, GRID_H - 1);
  const dx = fx - i0, dy = fy - j0;
  const s = (i, j) => { const idx = (j * GRID_W + i) * 3; return [grid[idx], grid[idx+1], grid[idx+2]]; };
  const [au,av,asp]=s(i0,j0),[bu,bv,bsp]=s(i1,j0),[cu,cv,csp]=s(i0,j1),[du,dv,dsp]=s(i1,j1);
  return {
    u: (au*(1-dx)+bu*dx)*(1-dy) + (cu*(1-dx)+du*dx)*dy,
    v: (av*(1-dx)+bv*dx)*(1-dy) + (cv*(1-dx)+dv*dx)*dy,
    speed: (asp*(1-dx)+bsp*dx)*(1-dy) + (csp*(1-dx)+dsp*dx)*dy,
  };
}

// ── Particles ──────────────────────────────────────────────────────────

function resetParticle() {
  return {
    lon: BOUNDS.west + Math.random() * (BOUNDS.east - BOUNDS.west),
    lat: BOUNDS.south + Math.random() * (BOUNDS.north - BOUNDS.south),
    age: 0, maxAge: 30 + Math.random() * MAX_AGE,
    rotation: 0,
  };
}

/** Small white chevron arrow — 24×24, pointing UP. Will be rotated by symbol layer. */
function createFlowArrow() {
  const s = 24, c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  // Arrow pointing up
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(12, 2);   // top center
  ctx.lineTo(20, 14);   // bottom right
  ctx.lineTo(15, 12);   // inner right
  ctx.lineTo(15, 22);   // tail right
  ctx.lineTo(9, 22);    // tail left
  ctx.lineTo(9, 12);    // inner left
  ctx.lineTo(4, 14);    // bottom left
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, s, s);
}

/** Larger badge arrow for named locations */
function createBadgeArrow() {
  const s = 48, c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(15,25,40,0.88)';
  ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(24,6); ctx.lineTo(36,22); ctx.lineTo(29,22);
  ctx.lineTo(29,42); ctx.lineTo(19,42); ctx.lineTo(19,22); ctx.lineTo(12,22); ctx.closePath();
  ctx.fill(); ctx.stroke();
  return ctx.getImageData(0, 0, s, s);
}

// ════════════════════════════════════════════════════════════════════════

export default function MunroWindMap({ onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const gridRef = useRef(null);
  const particlesRef = useRef(null);
  const animRef = useRef(null);
  const dataRef = useRef(null);

  const [status, setStatus] = useState('loading');
  const [maxMph, setMaxMph] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isLight, setIsLight] = useState(false);
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  // ── Layer setup (idempotent — safe to call after theme swap) ─────────

  function addAllLayers(map, locFeatures) {
    // Clean slate
    ['flow-arrows','wind-names','wind-badges','wind-arrows'].forEach(id => { try { map.removeLayer(id); } catch {} });
    ['flow-src','wind-points'].forEach(id => { try { map.removeSource(id); } catch {} });

    // 1. Flow particle layer (below badges)
    map.addSource('flow-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'flow-arrows', type: 'symbol', source: 'flow-src',
      layout: {
        'icon-image': 'flow-arrow',
        'icon-size': 0.55, // CONSTANT — same pixel size at every zoom
        'icon-rotate': ['get', 'r'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-padding': 0,
      },
      paint: {
        'icon-color': '#ffffff',
        'icon-opacity': ['get', 'o'],
      },
    });

    // 2. Named location badges (on top)
    if (locFeatures) {
      map.addSource('wind-points', { type: 'geojson', data: { type: 'FeatureCollection', features: locFeatures } });
      map.addLayer({ id: 'wind-arrows', type: 'symbol', source: 'wind-points',
        layout: {
          'icon-image': 'badge-arrow', 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.34, 8, 0.48, 11, 0.62],
          'icon-rotate': ['+', ['get', 'bearing'], 180], 'icon-allow-overlap': true,
          'icon-rotation-alignment': 'map', 'icon-offset': [0, -18], 'icon-anchor': 'center',
        },
        paint: { 'icon-color': ['get', 'color'], 'icon-halo-color': 'rgba(15,25,40,0.7)', 'icon-halo-width': 0.8 },
      });
      map.addLayer({ id: 'wind-badges', type: 'symbol', source: 'wind-points',
        layout: {
          'text-field': ['concat', ['to-string', ['get', 'speed']], ' mph'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, 11, 11, 13],
          'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(10,13,20,0.85)', 'text-halo-width': 2 },
      });
      map.addLayer({ id: 'wind-names', type: 'symbol', source: 'wind-points', minzoom: 7,
        layout: {
          'text-field': ['get', 'name'], 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 11, 11],
          'text-anchor': 'bottom', 'text-offset': [0, -1.6], 'text-allow-overlap': false,
        },
        paint: { 'text-color': 'rgba(255,255,255,0.7)', 'text-halo-color': 'rgba(10,13,20,0.75)', 'text-halo-width': 1.2 },
      });
      // Clicks
      map.on('click', 'wind-arrows', (e) => {
        const f = e.features?.[0]; if (!f) return;
        setSelected({ name: f.properties.name, kind: f.properties.kind,
          speed: f.properties.speed, bearing: f.properties.bearing,
          gust: f.properties.gust, color: f.properties.color });
      });
      map.on('mouseenter', 'wind-arrows', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'wind-arrows', () => { map.getCanvas().style.cursor = ''; });
      map.on('click', (e) => {
        if (!map.queryRenderedFeatures(e.point, { layers: ['wind-arrows'] }).length) setSelected(null);
      });
    }
  }

  // ── Animation loop ───────────────────────────────────────────────────

  function startAnimation(map) {
    const grid = gridRef.current;
    const particles = particlesRef.current;
    if (!grid || !particles) return;

    let frameCount = 0;

    function tick() {
      frameCount++;
      // Throttle GeoJSON updates to ~20fps for perf (every 3rd frame at 60fps)
      if (frameCount % 3 !== 0) { animRef.current = requestAnimationFrame(tick); return; }

      const features = [];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age++;
        if (p.age >= p.maxAge) { particles[i] = resetParticle(); continue; }

        const w = sampleWind(grid, p.lon, p.lat);
        if (w.speed < 0.3) { particles[i] = resetParticle(); continue; }

        p.lon += w.u * SPEED_FACTOR;
        p.lat += w.v * SPEED_FACTOR;

        if (p.lon < BOUNDS.west - 0.3 || p.lon > BOUNDS.east + 0.3 ||
            p.lat < BOUNDS.south - 0.3 || p.lat > BOUNDS.north + 0.3) {
          particles[i] = resetParticle(); continue;
        }

        // Wind direction in degrees (for icon rotation).
        // atan2 gives radians from east CCW; convert to degrees CW from north for MapLibre.
        const deg = (Math.atan2(w.u, w.v) * 180 / Math.PI + 360) % 360;
        p.rotation = deg;

        // Fade in/out
        const life = p.age / p.maxAge;
        const fade = life < 0.12 ? life / 0.12 : life > 0.8 ? (1 - life) / 0.2 : 1;
        const speedNorm = Math.min(1, w.speed / 10);
        const opacity = fade * (0.3 + speedNorm * 0.5);

        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { r: Math.round(deg), o: Math.round(opacity * 100) / 100 },
        });
      }

      try {
        const src = map.getSource('flow-src');
        if (src) src.setData({ type: 'FeatureCollection', features });
      } catch {}

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
  }

  // ── Map init ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES.dark,
      center: [-4.2, 57.0], zoom: 6.0,
      minZoom: 5, maxZoom: 11,
      attributionControl: { compact: true }, pitchWithRotate: false, dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', async () => {
      // Register both arrow icons
      map.addImage('flow-arrow', createFlowArrow(), { sdf: true });
      map.addImage('badge-arrow', createBadgeArrow(), { sdf: true });

      setProgress(10);
      const [gridData, locFeatures] = await Promise.all([fetchWindGrid(), fetchLocationData()]);
      setProgress(90);

      gridRef.current = gridData.grid;
      dataRef.current = locFeatures;
      setMaxMph(Math.round(gridData.maxSpeed * 2.237));

      addAllLayers(map, locFeatures);

      // Init particles — stagger so they don't all appear at once
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
        const p = resetParticle();
        p.age = Math.floor(Math.random() * p.maxAge * 0.6);
        return p;
      });

      setProgress(100);
      setStatus('ready');
      startAnimation(map);
    });

    mapRef.current = map;
    return () => { cancelAnimationFrame(animRef.current); map.remove(); mapRef.current = null; };
  }, []);

  // ── Theme toggle ─────────────────────────────────────────────────────

  const toggleTheme = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    cancelAnimationFrame(animRef.current);
    const next = isLight ? 'dark' : 'light';
    const center = map.getCenter(), zoom = map.getZoom();
    map.setStyle(STYLES[next]);
    const onReady = () => {
      try { map.addImage('flow-arrow', createFlowArrow(), { sdf: true }); } catch {}
      try { map.addImage('badge-arrow', createBadgeArrow(), { sdf: true }); } catch {}
      addAllLayers(map, dataRef.current);
      map.jumpTo({ center, zoom });
      startAnimation(map);
    };
    map.once('idle', onReady);
    setTimeout(() => { try { if (!map.getSource('flow-src')) onReady(); } catch {} }, 2000);
    setIsLight(!isLight); setCtrlOpen(false);
  }, [isLight]);

  const resetView = () => { mapRef.current?.flyTo({ center: [-4.2, 57.0], zoom: 6.0, duration: 700, essential: true }); setCtrlOpen(false); };

  return (
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title">
          <div className="map-eyebrow">Live Wind</div>
          <div className="map-subtitle">
            {status === 'loading' ? 'Building wind field…' :
             maxMph > 0 ? `Peak ${maxMph} mph across Scotland` : 'Wind across Scotland'}
          </div>
        </div>
        <button className="map-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div ref={containerRef} className="tile-map-viewport">
        <div className="map-ctrl-wrap">
          <button className="map-ctrl-toggle" onClick={() => setCtrlOpen(!ctrlOpen)} aria-label="Map controls">
            <svg viewBox="0 0 20 20" width="16" height="16"><circle cx="4" cy="10" r="1.5" fill="currentColor" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /><circle cx="16" cy="10" r="1.5" fill="currentColor" /></svg>
          </button>
          {ctrlOpen && (
            <div className="map-ctrl-menu">
              <button className="map-ctrl-item" onClick={resetView}>
                <svg viewBox="0 0 20 20" width="14" height="14"><path d="M10 3 L10 7 M3 10 L7 10 M10 13 L10 17 M13 10 L17 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
                Reset view
              </button>
              <button className="map-ctrl-item" onClick={toggleTheme}>
                <svg viewBox="0 0 20 20" width="14" height="14">
                  {isLight ? <path d="M10 3a7 7 0 1 0 0 14 5 5 0 0 1 0-14z" fill="currentColor" />
                    : <><circle cx="10" cy="10" r="3.5" fill="currentColor" />{[0,45,90,135,180,225,270,315].map(a=>{const r=a*Math.PI/180;return <line key={a} x1={10+Math.cos(r)*5.5} y1={10+Math.sin(r)*5.5} x2={10+Math.cos(r)*7} y2={10+Math.sin(r)*7} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>})}</>}
                </svg>
                {isLight ? 'Dark map' : 'Light map'}
              </button>
            </div>
          )}
        </div>

        <div className="wind-field-legend">
          <div className="wind-field-legend-title">Wind speed</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#22c55e' }} /> Calm</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#84cc16' }} /> Light</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#eab308' }} /> Breezy</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#f97316' }} /> Strong</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#ef4444' }} /> Danger</div>
        </div>

        {status === 'loading' && (
          <div className="wind-progress-chip" role="status">
            <div className="wind-progress-bar-track"><div className="wind-progress-bar-fill" style={{ width: `${progress}%` }} /></div>
            <span className="wind-progress-text">Fetching wind data…</span>
          </div>
        )}

        {selected && (
          <div className="wind-popup" role="dialog">
            <div className="wind-popup-head">
              <div>
                <div className="wind-popup-eyebrow">{selected.kind === 'peak' ? 'Summit' : 'Location'}</div>
                <div className="wind-popup-name">{selected.name}</div>
              </div>
              <button className="wind-popup-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="wind-popup-body">
              <div className="wind-popup-speed" style={{ color: selected.color }}>{selected.speed}<span>mph</span></div>
              <div className="wind-popup-detail">
                <div className="wind-popup-label-line">{windLabel(selected.speed)}</div>
                {selected.gust > selected.speed + 3 && <div className="wind-popup-gust">Gusting {selected.gust} mph</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
