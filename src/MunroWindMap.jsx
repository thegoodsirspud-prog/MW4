import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MunroWindMap v6 — Windy.com-style animated particle flow
 *
 * Canvas-based particle system overlaid on MapLibre GL.
 * ~400 particles flow continuously with the wind field, creating
 * a subtle, living animation. Named location badges remain tappable.
 *
 * Grid: 10×7 = 70 points (down from 192 in v5) — good interpolation
 * coverage for Scotland at a fraction of the API cost.
 */

const STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

const BOUNDS = { west: -8.0, east: -1.2, south: 55.2, north: 59.2 };
const GRID_W = 10;
const GRID_H = 7;

// Particle system tuning
const PARTICLE_COUNT = 420;
const PARTICLE_MIN_AGE = 40;
const PARTICLE_MAX_AGE = 90;
const SPEED_FACTOR = 0.00012; // degrees per m/s per frame

// Named locations for tappable badges
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
  { name: 'Dundee', lat: 56.46, lon: -2.97, kind: 'town' },
  { name: 'Oban', lat: 56.42, lon: -5.47, kind: 'town' },
  { name: 'Ben Lawers', lat: 56.55, lon: -4.22, kind: 'peak' },
  { name: 'Stirling', lat: 56.12, lon: -3.94, kind: 'town' },
  { name: 'Glasgow', lat: 55.86, lon: -4.25, kind: 'town' },
  { name: 'Edinburgh', lat: 55.95, lon: -3.19, kind: 'town' },
  { name: 'Galloway', lat: 55.10, lon: -4.40, kind: 'town' },
];

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

// ── Data fetching ──────────────────────────────────────────────────────

async function fetchWindGrid() {
  const points = [];
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      points.push({
        i, j,
        lat: BOUNDS.south + (j / (GRID_H - 1)) * (BOUNDS.north - BOUNDS.south),
        lon: BOUNDS.west + (i / (GRID_W - 1)) * (BOUNDS.east - BOUNDS.west),
      });
    }
  }

  const results = await Promise.all(points.map(async (p) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe%2FLondon`;
      const r = await fetch(url);
      const d = await r.json();
      const speed = d.current?.wind_speed_10m ?? 0;
      const dir = d.current?.wind_direction_10m ?? 0;
      const a = ((dir + 180) % 360) * Math.PI / 180;
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
  return Promise.all(LOCATIONS.map(async (loc) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=mph&timezone=Europe%2FLondon`;
      const r = await fetch(url);
      const d = await r.json();
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
  })).then(r => r.filter(Boolean));
}

// ── Wind field sampling ────────────────────────────────────────────────

function sampleWind(grid, lon, lat) {
  if (lon < BOUNDS.west || lon > BOUNDS.east || lat < BOUNDS.south || lat > BOUNDS.north) {
    return { u: 0, v: 0, speed: 0 };
  }
  const fx = (lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west) * (GRID_W - 1);
  const fy = (lat - BOUNDS.south) / (BOUNDS.north - BOUNDS.south) * (GRID_H - 1);
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  const i1 = Math.min(i0 + 1, GRID_W - 1), j1 = Math.min(j0 + 1, GRID_H - 1);
  const dx = fx - i0, dy = fy - j0;
  const s = (i, j) => { const idx = (j * GRID_W + i) * 3; return [grid[idx], grid[idx + 1], grid[idx + 2]]; };
  const [au, av, asp] = s(i0, j0), [bu, bv, bsp] = s(i1, j0);
  const [cu, cv, csp] = s(i0, j1), [du, dv, dsp] = s(i1, j1);
  return {
    u: (au * (1 - dx) + bu * dx) * (1 - dy) + (cu * (1 - dx) + du * dx) * dy,
    v: (av * (1 - dx) + bv * dx) * (1 - dy) + (cv * (1 - dx) + dv * dx) * dy,
    speed: (asp * (1 - dx) + bsp * dx) * (1 - dy) + (csp * (1 - dx) + dsp * dx) * dy,
  };
}

// ── Particle system ────────────────────────────────────────────────────

function createParticle() {
  return {
    lon: BOUNDS.west + Math.random() * (BOUNDS.east - BOUNDS.west),
    lat: BOUNDS.south + Math.random() * (BOUNDS.north - BOUNDS.south),
    age: 0,
    maxAge: PARTICLE_MIN_AGE + Math.random() * (PARTICLE_MAX_AGE - PARTICLE_MIN_AGE),
  };
}

function createArrowImage() {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(15,25,40,0.88)';
  ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(24, 6); ctx.lineTo(36, 22); ctx.lineTo(29, 22);
  ctx.lineTo(29, 42); ctx.lineTo(19, 42); ctx.lineTo(19, 22);
  ctx.lineTo(12, 22); ctx.closePath();
  ctx.fill(); ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

// ── Component ──────────────────────────────────────────────────────────

export default function MunroWindMap({ onClose }) {
  const mapContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const gridRef = useRef(null);
  const particlesRef = useRef(null);
  const animRef = useRef(null);
  const dataRef = useRef(null);

  const [status, setStatus] = useState('loading');
  const [maxMph, setMaxMph] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isLight, setIsLight] = useState(false);
  const [progress, setProgress] = useState(0);

  // ── Map init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STYLES.dark,
      center: [-4.2, 57.0],
      zoom: 6.0,
      minZoom: 5, maxZoom: 11,
      attributionControl: { compact: true },
      pitchWithRotate: false, dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', async () => {
      if (!map.hasImage('wind-arrow')) {
        map.addImage('wind-arrow', createArrowImage(), { sdf: true });
      }

      // Fetch grid + locations in parallel
      setProgress(10);
      const [gridData, locFeatures] = await Promise.all([
        fetchWindGrid(),
        fetchLocationData(),
      ]);
      setProgress(80);

      gridRef.current = gridData.grid;
      dataRef.current = locFeatures;
      setMaxMph(Math.round(gridData.maxSpeed * 2.237));

      // Add location badges
      addBadgeLayers(map, locFeatures);
      setProgress(100);

      // Init particle system
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
        const p = createParticle();
        p.age = Math.random() * p.maxAge; // stagger
        return p;
      });

      // Start animation loop
      startAnimation(map);
      setStatus('ready');
    });

    mapRef.current = map;
    return () => { cancelAnimationFrame(animRef.current); map.remove(); mapRef.current = null; };
  }, []);

  function addBadgeLayers(map, features) {
    if (map.getSource('wind-points')) return;
    map.addSource('wind-points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });
    map.addLayer({
      id: 'wind-arrows', type: 'symbol', source: 'wind-points',
      layout: {
        'icon-image': 'wind-arrow',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.34, 8, 0.48, 11, 0.62],
        'icon-rotate': ['+', ['get', 'bearing'], 180],
        'icon-allow-overlap': true, 'icon-rotation-alignment': 'map',
        'icon-offset': [0, -18], 'icon-anchor': 'center',
      },
      paint: {
        'icon-color': ['get', 'color'],
        'icon-halo-color': 'rgba(15,25,40,0.7)', 'icon-halo-width': 0.8,
      },
    });
    map.addLayer({
      id: 'wind-badges', type: 'symbol', source: 'wind-points',
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'speed']], ' mph'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, 11, 11, 13],
        'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(10,13,20,0.85)', 'text-halo-width': 2,
      },
    });
    map.addLayer({
      id: 'wind-names', type: 'symbol', source: 'wind-points',
      minzoom: 7,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 11, 11],
        'text-anchor': 'bottom', 'text-offset': [0, -1.6], 'text-allow-overlap': false,
      },
      paint: {
        'text-color': 'rgba(255,255,255,0.7)',
        'text-halo-color': 'rgba(10,13,20,0.75)', 'text-halo-width': 1.2,
      },
    });
    // Click
    map.on('click', 'wind-arrows', (e) => {
      const f = e.features?.[0]; if (!f) return;
      setSelected({
        name: f.properties.name, kind: f.properties.kind,
        speed: f.properties.speed, bearing: f.properties.bearing,
        gust: f.properties.gust, color: f.properties.color,
      });
    });
    map.on('mouseenter', 'wind-arrows', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'wind-arrows', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', (e) => {
      if (!map.queryRenderedFeatures(e.point, { layers: ['wind-arrows'] }).length) setSelected(null);
    });
  }

  // ── Canvas animation loop ────────────────────────────────────────────
  function startAnimation(map) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function frame() {
      const grid = gridRef.current;
      const particles = particlesRef.current;
      if (!grid || !particles || !map) { animRef.current = requestAnimationFrame(frame); return; }

      // Sync canvas size with map
      const { width, height } = map.getCanvas();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height;
        canvas.style.width = (width / dpr) + 'px';
        canvas.style.height = (height / dpr) + 'px';
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age++;

        if (p.age >= p.maxAge) {
          particles[i] = createParticle();
          continue;
        }

        const w = sampleWind(grid, p.lon, p.lat);
        if (w.speed < 0.3) { particles[i] = createParticle(); continue; }

        // Advance position
        const prevLon = p.lon, prevLat = p.lat;
        p.lon += w.u * SPEED_FACTOR;
        p.lat += w.v * SPEED_FACTOR;

        // Check bounds
        if (p.lon < BOUNDS.west - 0.5 || p.lon > BOUNDS.east + 0.5 ||
            p.lat < BOUNDS.south - 0.5 || p.lat > BOUNDS.north + 0.5) {
          particles[i] = createParticle();
          continue;
        }

        // Project to screen
        const prev = map.project([prevLon, prevLat]);
        const curr = map.project([p.lon, p.lat]);

        // Fade in/out based on age
        const lifeRatio = p.age / p.maxAge;
        const fade = lifeRatio < 0.15 ? lifeRatio / 0.15
                   : lifeRatio > 0.8 ? (1 - lifeRatio) / 0.2
                   : 1;
        const speedAlpha = Math.min(1, w.speed / 12);
        const alpha = fade * (0.15 + speedAlpha * 0.45);

        // Draw as a small directional arrow
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.3) continue;

        const angle = Math.atan2(dy, dx);
        const arrowLen = Math.min(12, 4 + w.speed * 0.6);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(curr.x * dpr, curr.y * dpr);
        ctx.rotate(angle);

        // Arrow shaft
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-arrowLen * dpr, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // Arrow head
        const headSize = 3 * dpr;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-headSize, -headSize * 0.6);
        ctx.lineTo(-headSize, headSize * 0.6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
  }

  // ── Theme toggle ─────────────────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = isLight ? 'dark' : 'light';
    const center = map.getCenter(), zoom = map.getZoom();

    map.setStyle(STYLES[next]);
    map.once('style.load', () => {
      if (!map.hasImage('wind-arrow')) map.addImage('wind-arrow', createArrowImage(), { sdf: true });
      if (dataRef.current) addBadgeLayers(map, dataRef.current);
      map.jumpTo({ center, zoom });
    });
    setIsLight(!isLight);
  }, [isLight]);

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="tile-map-ctrl" onClick={toggleTheme} aria-label={isLight ? 'Dark map' : 'Light map'} style={{ position: 'static' }}>
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
              {isLight
                ? <path d="M10 3a7 7 0 1 0 0 14 5 5 0 0 1 0-14z" fill="currentColor" />
                : <><circle cx="10" cy="10" r="3.5" fill="currentColor" />{[0,45,90,135,180,225,270,315].map(a=>{const r=a*Math.PI/180;return <line key={a} x1={10+Math.cos(r)*5.5} y1={10+Math.sin(r)*5.5} x2={10+Math.cos(r)*7} y2={10+Math.sin(r)*7} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>})}</>
              }
            </svg>
          </button>
          <button className="map-close" onClick={onClose} aria-label="Close map">✕</button>
        </div>
      </div>

      <div className="tile-map-viewport" style={{ position: 'relative' }}>
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', inset: 0,
            pointerEvents: 'none', zIndex: 1,
          }}
        />

        {/* Legend */}
        <div className="wind-field-legend">
          <div className="wind-field-legend-title">Wind speed</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#22c55e' }} /> Calm</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#84cc16' }} /> Light</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#eab308' }} /> Breezy</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#f97316' }} /> Strong</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#ef4444' }} /> Danger</div>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="wind-progress-chip" role="status" aria-live="polite">
            <div className="wind-progress-bar-track">
              <div className="wind-progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="wind-progress-text">Fetching wind data…</span>
          </div>
        )}

        {/* Selected popup */}
        {selected && (
          <div className="wind-popup" role="dialog" aria-label={`Wind at ${selected.name}`}>
            <div className="wind-popup-head">
              <div>
                <div className="wind-popup-eyebrow">{selected.kind === 'peak' ? 'Summit' : 'Location'}</div>
                <div className="wind-popup-name">{selected.name}</div>
              </div>
              <button className="wind-popup-close" onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>
            <div className="wind-popup-body">
              <div className="wind-popup-speed" style={{ color: selected.color }}>
                {selected.speed}<span>mph</span>
              </div>
              <div className="wind-popup-detail">
                <div className="wind-popup-label-line">{windLabel(selected.speed)}</div>
                {selected.gust > selected.speed + 3 && (
                  <div className="wind-popup-gust">Gusting {selected.gust} mph</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
