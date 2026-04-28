import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MUNROS } from './munros.js';

/**
 * MunroWindMap v9 — Clean speed labels + animated particles + peak overlay
 */

const STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

const BOUNDS = { west: -8.0, east: -1.2, south: 55.2, north: 59.2 };
const GRID_W = 10, GRID_H = 7;
const PARTICLE_COUNT = 300, MAX_AGE = 80, SPEED_FACTOR = 0.002;

// ~24 locations for good coverage across Scotland + islands
const LOCATIONS = [
  { name: 'Lerwick', lat: 60.15, lon: -1.14, kind: 'town' },
  { name: 'Kirkwall', lat: 58.98, lon: -2.96, kind: 'town' },
  { name: 'Wick', lat: 58.44, lon: -3.09, kind: 'town' },
  { name: 'Stornoway', lat: 58.21, lon: -6.39, kind: 'town' },
  { name: 'Durness', lat: 58.40, lon: -4.75, kind: 'town' },
  { name: 'Ullapool', lat: 57.90, lon: -5.16, kind: 'town' },
  { name: 'Inverness', lat: 57.48, lon: -4.22, kind: 'town' },
  { name: 'Portree', lat: 57.41, lon: -6.19, kind: 'town' },
  { name: 'Elgin', lat: 57.65, lon: -3.32, kind: 'town' },
  { name: 'Aberdeen', lat: 57.15, lon: -2.09, kind: 'town' },
  { name: 'Fort William', lat: 56.82, lon: -5.11, kind: 'town' },
  { name: 'Cairn Gorm', lat: 57.12, lon: -3.64, kind: 'peak' },
  { name: 'Ben Nevis', lat: 56.80, lon: -5.00, kind: 'peak' },
  { name: 'Braemar', lat: 57.01, lon: -3.40, kind: 'town' },
  { name: 'Perth', lat: 56.40, lon: -3.43, kind: 'town' },
  { name: 'Dundee', lat: 56.46, lon: -2.97, kind: 'town' },
  { name: 'Oban', lat: 56.42, lon: -5.47, kind: 'town' },
  { name: 'Ben Lawers', lat: 56.55, lon: -4.22, kind: 'peak' },
  { name: 'Stirling', lat: 56.12, lon: -3.94, kind: 'town' },
  { name: 'Glasgow', lat: 55.86, lon: -4.25, kind: 'town' },
  { name: 'Edinburgh', lat: 55.95, lon: -3.19, kind: 'town' },
  { name: 'Islay', lat: 55.77, lon: -6.20, kind: 'town' },
  { name: 'Campbeltown', lat: 55.43, lon: -5.60, kind: 'town' },
  { name: 'Dumfries', lat: 55.07, lon: -3.61, kind: 'town' },
];

function windColor(mph) { return mph < 10 ? '#22c55e' : mph < 20 ? '#84cc16' : mph < 30 ? '#eab308' : mph < 40 ? '#f97316' : '#ef4444'; }
function windLabel(mph) { return mph < 10 ? 'Calm' : mph < 20 ? 'Light' : mph < 30 ? 'Breezy' : mph < 40 ? 'Strong' : 'Dangerous'; }

const MUNRO_GEOJSON = {
  type: 'FeatureCollection',
  features: MUNROS.map(m => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
    properties: { name: m.name, h: m.h },
  })),
};

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
    u: (au*(1-dx)+bu*dx)*(1-dy)+(cu*(1-dx)+du*dx)*dy,
    v: (av*(1-dx)+bv*dx)*(1-dy)+(cv*(1-dx)+dv*dx)*dy,
    speed: (asp*(1-dx)+bsp*dx)*(1-dy)+(csp*(1-dx)+dsp*dx)*dy,
  };
}

function resetParticle() {
  return {
    lon: BOUNDS.west + Math.random() * (BOUNDS.east - BOUNDS.west),
    lat: BOUNDS.south + Math.random() * (BOUNDS.north - BOUNDS.south),
    age: 0, maxAge: 30 + Math.random() * MAX_AGE, rotation: 0,
  };
}

function createFlowArrow() {
  const s = 24, c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(12,2); ctx.lineTo(20,14); ctx.lineTo(15,12);
  ctx.lineTo(15,22); ctx.lineTo(9,22); ctx.lineTo(9,12);
  ctx.lineTo(4,14); ctx.closePath(); ctx.fill();
  return ctx.getImageData(0, 0, s, s);
}

// ════════════════════════════════════════════════════════════════════════

export default function MunroWindMap() {
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
  const [showPeaks, setShowPeaks] = useState(false);
  const [progress, setProgress] = useState(0);

  function addAllLayers(map, locFeatures, theme = 'dark') {
    const textColor = theme === 'light' ? '#1e293b' : '#ffffff';
    const haloColor = theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(10,13,20,0.85)';

    ['flow-arrows','wind-names','wind-badges','wind-hit','munros-halo','munros-dot'].forEach(id => { try { map.removeLayer(id); } catch {} });
    ['flow-src','wind-points','munros-wind'].forEach(id => { try { map.removeSource(id); } catch {} });

    // 1. Flow particles
    map.addSource('flow-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'flow-arrows', type: 'symbol', source: 'flow-src',
      layout: {
        'icon-image': 'flow-arrow', 'icon-size': 0.55,
        'icon-rotate': ['get', 'r'], 'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-padding': 0,
      },
      paint: {
        'icon-color': [
          'step', ['get', 's'],
          '#22c55e',   // <4.47 m/s (< 10mph) green
          4.47, '#84cc16',  // 10-20mph lime
          8.94, '#eab308',  // 20-30mph amber
          13.41, '#f97316', // 30-40mph orange
          17.88, '#ef4444', // 40+ red
        ],
        'icon-opacity': ['get', 'o'],
      },
    });

    // 2. Speed labels (no arrows — just clean numbers)
    if (locFeatures) {
      map.addSource('wind-points', { type: 'geojson', data: { type: 'FeatureCollection', features: locFeatures } });

      // Invisible hit circles for tapping
      map.addLayer({ id: 'wind-hit', type: 'circle', source: 'wind-points',
        paint: { 'circle-radius': 20, 'circle-color': 'transparent', 'circle-opacity': 0 },
      });

      // Speed number
      map.addLayer({ id: 'wind-badges', type: 'symbol', source: 'wind-points',
        layout: {
          'text-field': ['concat', ['to-string', ['get', 'speed']], ''],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 8, 14, 11, 16],
          'text-anchor': 'center', 'text-allow-overlap': true,
        },
        paint: { 'text-color': textColor, 'text-halo-color': haloColor, 'text-halo-width': 2.2 },
      });
      // Location name below
      map.addLayer({ id: 'wind-names', type: 'symbol', source: 'wind-points',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 8, 10, 11, 11],
          'text-anchor': 'top', 'text-offset': [0, 0.8], 'text-allow-overlap': false,
        },
        paint: {
          'text-color': theme === 'light' ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.5)',
          'text-halo-color': haloColor, 'text-halo-width': 1,
        },
      });

      map.on('click', 'wind-hit', (e) => {
        const f = e.features?.[0]; if (!f) return;
        setSelected({ name: f.properties.name, kind: f.properties.kind,
          speed: f.properties.speed, bearing: f.properties.bearing,
          gust: f.properties.gust, color: f.properties.color });
      });
      map.on('mouseenter', 'wind-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'wind-hit', () => { map.getCanvas().style.cursor = ''; });
      map.on('click', (e) => {
        if (!map.queryRenderedFeatures(e.point, { layers: ['wind-hit'] }).length) setSelected(null);
      });
    }
  }

  function togglePeakLayer(map, show, theme = 'dark') {
    if (show) {
      if (map.getSource('munros-wind')) return;
      map.addSource('munros-wind', { type: 'geojson', data: MUNRO_GEOJSON });
      const dotColor = theme === 'light' ? '#2563eb' : '#93c5fd';
      map.addLayer({ id: 'munros-halo', type: 'circle', source: 'munros-wind',
        paint: { 'circle-radius': ['interpolate',['linear'],['zoom'],5,4,8,6,11,9], 'circle-color': dotColor, 'circle-opacity': 0.2, 'circle-blur': 0.8 },
      }, 'flow-arrows');
      map.addLayer({ id: 'munros-dot', type: 'circle', source: 'munros-wind',
        paint: { 'circle-radius': ['interpolate',['linear'],['zoom'],5,2,8,3,11,4.5], 'circle-color': dotColor, 'circle-stroke-color': theme === 'light' ? '#fff' : 'rgba(15,25,40,0.8)', 'circle-stroke-width': 0.6 },
      }, 'flow-arrows');
    } else {
      try { map.removeLayer('munros-dot'); } catch {}
      try { map.removeLayer('munros-halo'); } catch {}
      try { map.removeSource('munros-wind'); } catch {}
    }
  }

  function startAnimation(map) {
    const grid = gridRef.current;
    const particles = particlesRef.current;
    if (!grid || !particles) return;
    let fc = 0;
    function tick() {
      fc++;
      if (fc % 3 !== 0) { animRef.current = requestAnimationFrame(tick); return; }
      const features = [];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age++;
        if (p.age >= p.maxAge) { particles[i] = resetParticle(); continue; }
        const w = sampleWind(gridRef.current, p.lon, p.lat);
        if (w.speed < 0.3) { particles[i] = resetParticle(); continue; }
        p.lon += w.u * SPEED_FACTOR; p.lat += w.v * SPEED_FACTOR;
        if (p.lon < BOUNDS.west-0.3||p.lon > BOUNDS.east+0.3||p.lat < BOUNDS.south-0.3||p.lat > BOUNDS.north+0.3) { particles[i] = resetParticle(); continue; }
        const deg = (Math.atan2(w.u, w.v) * 180 / Math.PI + 360) % 360;
        const life = p.age / p.maxAge;
        const fade = life < 0.12 ? life/0.12 : life > 0.8 ? (1-life)/0.2 : 1;
        const opacity = fade * (0.3 + Math.min(1, w.speed/10) * 0.5);
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { r: Math.round(deg), o: Math.round(opacity*100)/100, s: Math.round(w.speed*100)/100 } });
      }
      try { map.getSource('flow-src')?.setData({ type: 'FeatureCollection', features }); } catch {}
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current, style: STYLES.dark,
      center: [-4.2, 57.0], zoom: 6.0, minZoom: 5, maxZoom: 11,
      attributionControl: { compact: true }, pitchWithRotate: false, dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', async () => {
      map.addImage('flow-arrow', createFlowArrow(), { sdf: true });
      setProgress(10);
      const [gridData, locFeatures] = await Promise.all([fetchWindGrid(), fetchLocationData()]);
      setProgress(90);
      gridRef.current = gridData.grid; dataRef.current = locFeatures;
      setMaxMph(Math.round(gridData.maxSpeed * 2.237));
      addAllLayers(map, locFeatures);
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
        const p = resetParticle(); p.age = Math.floor(Math.random() * p.maxAge * 0.6); return p;
      });
      setProgress(100); setStatus('ready');
      startAnimation(map);
    });
    mapRef.current = map;
    return () => { cancelAnimationFrame(animRef.current); map.remove(); mapRef.current = null; };
  }, []);

  const toggleTheme = useCallback(() => {
    const map = mapRef.current; if (!map) return;
    cancelAnimationFrame(animRef.current);
    const next = isLight ? 'dark' : 'light';
    const center = map.getCenter(), zoom = map.getZoom();
    map.setStyle(STYLES[next]);
    const onReady = () => {
      try { map.addImage('flow-arrow', createFlowArrow(), { sdf: true }); } catch {}
      addAllLayers(map, dataRef.current, next);
      if (showPeaks) togglePeakLayer(map, true, next);
      map.jumpTo({ center, zoom });
      startAnimation(map);
    };
    map.once('idle', onReady);
    setTimeout(() => { try { if (!map.getSource('flow-src')) onReady(); } catch {} }, 2000);
    setIsLight(!isLight); setCtrlOpen(false);
  }, [isLight, showPeaks]);

  const handleTogglePeaks = () => {
    const map = mapRef.current; if (!map) return;
    const next = !showPeaks;
    togglePeakLayer(map, next, isLight ? 'light' : 'dark');
    setShowPeaks(next); setCtrlOpen(false);
  };

  const resetView = () => { mapRef.current?.flyTo({ center: [-4.2, 57.0], zoom: 6.0, duration: 700, essential: true }); setCtrlOpen(false); };

  return (
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title">
          <div className="map-eyebrow">Live Wind</div>
          <div className="map-subtitle">
            {status === 'loading' ? 'Building wind field…' : maxMph > 0 ? `Peak ${maxMph} mph` : 'Wind across Scotland'}
          </div>
        </div>
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
              <button className="map-ctrl-item" onClick={handleTogglePeaks}>
                <svg viewBox="0 0 20 20" width="14" height="14"><path d="M3 17 L10 5 L17 17 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                {showPeaks ? 'Hide peaks' : 'Show peaks'}
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
          <div className="wind-field-legend-title">Wind speed (mph)</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#22c55e' }} /> &lt;10</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#84cc16' }} /> 10–20</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#eab308' }} /> 20–30</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#f97316' }} /> 30–40</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#ef4444' }} /> 40+</div>
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
