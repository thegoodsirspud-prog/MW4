import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MunroWindMap v5 — hybrid streamlines + arrows
 *
 * The final architecture after four failed attempts:
 *   v1 DOM overlays (laggy)
 *   v2 GL particles as dots (TV noise)
 *   v3 ping-pong framebuffer trails (saturates screen)
 *   v4 arrows only (clean but static-feeling)
 *
 * v5 combines the two legitimate approaches:
 *   Layer 1 — streamlines traced through the wind field, rendered as
 *             GeoJSON LineStrings. Thin, low-opacity, hundreds of curves
 *             that give the whole country a sense of flow. STATIC —
 *             drawn once at load, redrawn on basemap zoom/pan for free.
 *   Layer 2 — bold arrows at 35 named locations (peaks + towns) rendered
 *             as a MapLibre symbol layer. Tappable. Precise data.
 *
 * Both layers are pure MapLibre primitives — no CustomLayer, no per-frame
 * JS, no WebGL state. The map draws them as efficiently as it draws the
 * coastlines. Performance ceiling = MapLibre itself.
 *
 * The streamlines are computed client-side by walking random seed points
 * forward through the wind vector field (bilinear interpolation from a
 * 16×12 grid). 80 seeds × 30 steps = 2400 vertices total — trivial for
 * MapLibre, which routinely draws entire cities worth of geometry.
 */

// Bounds around mainland + islands. Padded so streamlines flow off-screen
// gracefully rather than ending at the edge.
const BOUNDS = { west: -7.8, east: -1.5, south: 55.4, north: 59.0 };
const GRID_W = 16;
const GRID_H = 12;

// Streamline generation parameters.
// 80 lines × 30 steps is dense enough to read as a flow field but thin
// enough that individual curves remain legible, unlike the particle
// attempts which saturated the canvas.
const STREAMLINE_COUNT = 80;
const STREAMLINE_STEPS = 30;
// How far to advance per step, in degrees of lon/lat per (m/s).
// Tuned so a 10 m/s wind over 30 steps covers ~1.5° of lat — enough
// to show a clear curve across a region without overshooting Scotland.
const STEP_SCALE = 0.005;

// 35 named reference points — mix of iconic peaks and anchor towns
// covering every region from Shetland to the Borders.
const ARROW_LOCATIONS = [
  // Shetland / Orkney
  { name: 'Lerwick',        lat: 60.1548, lon: -1.1445, kind: 'town' },
  { name: 'Kirkwall',       lat: 58.9810, lon: -2.9603, kind: 'town' },
  // Outer Hebrides
  { name: 'Stornoway',      lat: 58.2090, lon: -6.3878, kind: 'town' },
  { name: 'Barra',          lat: 56.9660, lon: -7.4850, kind: 'town' },
  // Far North
  { name: 'Ben Hope',       lat: 58.4157, lon: -4.6194, kind: 'peak' },
  { name: 'Wick',           lat: 58.4390, lon: -3.0930, kind: 'town' },
  { name: 'Ben More Assynt', lat: 58.1334, lon: -4.8577, kind: 'peak' },
  // Ross-shire / Torridon
  { name: 'Ullapool',       lat: 57.8960, lon: -5.1570, kind: 'town' },
  { name: 'An Teallach',    lat: 57.8110, lon: -5.2700, kind: 'peak' },
  { name: 'Liathach',       lat: 57.5510, lon: -5.4803, kind: 'peak' },
  // Skye
  { name: 'Portree',        lat: 57.4130, lon: -6.1940, kind: 'town' },
  { name: 'Sgurr Alasdair', lat: 57.2067, lon: -6.2261, kind: 'peak' },
  // Kintail / Knoydart
  { name: 'Carn Eighe',     lat: 57.2875, lon: -5.1155, kind: 'peak' },
  { name: 'Ladhar Bheinn',  lat: 57.0653, lon: -5.6833, kind: 'peak' },
  // Moray / Inverness
  { name: 'Inverness',      lat: 57.4780, lon: -4.2247, kind: 'town' },
  { name: 'Elgin',          lat: 57.6498, lon: -3.3176, kind: 'town' },
  // Cairngorms
  { name: 'Cairn Gorm',     lat: 57.1167, lon: -3.6440, kind: 'peak' },
  { name: 'Ben Macdui',     lat: 57.0706, lon: -3.6700, kind: 'peak' },
  { name: 'Braemar',        lat: 57.0065, lon: -3.3973, kind: 'town' },
  // Aberdeenshire
  { name: 'Aberdeen',       lat: 57.1497, lon: -2.0943, kind: 'town' },
  { name: 'Lochnagar',      lat: 56.9605, lon: -3.2457, kind: 'peak' },
  // Lochaber
  { name: 'Ben Nevis',      lat: 56.7967, lon: -5.0042, kind: 'peak' },
  { name: 'Fort William',   lat: 56.8198, lon: -5.1052, kind: 'town' },
  // Glen Coe
  { name: 'Bidean nam Bian', lat: 56.6432, lon: -5.0295, kind: 'peak' },
  { name: 'Oban',           lat: 56.4155, lon: -5.4721, kind: 'town' },
  // Breadalbane
  { name: 'Ben Lawers',     lat: 56.5452, lon: -4.2211, kind: 'peak' },
  { name: 'Schiehallion',   lat: 56.6685, lon: -4.0986, kind: 'peak' },
  // Perthshire
  { name: 'Perth',          lat: 56.3950, lon: -3.4308, kind: 'town' },
  { name: 'Dundee',         lat: 56.4620, lon: -2.9707, kind: 'town' },
  // Central
  { name: 'Ben Lomond',     lat: 56.1903, lon: -4.6328, kind: 'peak' },
  { name: 'Stirling',       lat: 56.1165, lon: -3.9369, kind: 'town' },
  { name: 'Edinburgh',      lat: 55.9533, lon: -3.1883, kind: 'town' },
  { name: 'Glasgow',        lat: 55.8642, lon: -4.2518, kind: 'town' },
  // South
  { name: 'Galloway',       lat: 55.1000, lon: -4.4000, kind: 'town' },
  { name: 'Berwick',        lat: 55.7700, lon: -2.0100, kind: 'town' },
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

async function fetchGridAndArrows() {
  // Build the grid point list
  const gridPoints = [];
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const lon = BOUNDS.west + (i / (GRID_W - 1)) * (BOUNDS.east - BOUNDS.west);
      const lat = BOUNDS.south + (j / (GRID_H - 1)) * (BOUNDS.north - BOUNDS.south);
      gridPoints.push({ lat, lon, i, j });
    }
  }

  // Parallel fetch — 192 grid points + 35 named locations in one burst.
  // Open-Meteo handles this comfortably on its free tier (~1 second).
  const gridResults = await Promise.all(gridPoints.map(async (p) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe%2FLondon`;
      const r = await fetch(url);
      const d = await r.json();
      const speed = d.current?.wind_speed_10m ?? 0;
      const dir = d.current?.wind_direction_10m ?? 0;
      // Meteorological dir = FROM. Flow vector points the other way.
      const a = ((dir + 180) % 360) * Math.PI / 180;
      return {
        i: p.i, j: p.j, lat: p.lat, lon: p.lon,
        u: Math.sin(a) * speed,  // east m/s
        v: Math.cos(a) * speed,  // north m/s
        speed,
      };
    } catch {
      return { i: p.i, j: p.j, lat: p.lat, lon: p.lon, u: 0, v: 0, speed: 0 };
    }
  }));

  // Flatten grid to a Float32Array for fast bilinear sampling
  const grid = new Float32Array(GRID_W * GRID_H * 3);
  let maxSpeed = 0;
  for (const r of gridResults) {
    const idx = (r.j * GRID_W + r.i) * 3;
    grid[idx + 0] = r.u;
    grid[idx + 1] = r.v;
    grid[idx + 2] = r.speed;
    if (r.speed > maxSpeed) maxSpeed = r.speed;
  }

  // Named-arrow fetches (independent from the grid — these values are
  // the accurate point wind for each named location, shown in the popup)
  const arrowResults = await Promise.all(ARROW_LOCATIONS.map(async (loc) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=mph&timezone=Europe%2FLondon`;
      const r = await fetch(url);
      const d = await r.json();
      const mph = d.current?.wind_speed_10m ?? 0;
      const gust = d.current?.wind_gusts_10m ?? 0;
      const bearing = d.current?.wind_direction_10m ?? 0;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [loc.lon, loc.lat] },
        properties: {
          name: loc.name, kind: loc.kind,
          speed: Math.round(mph),
          gust: Math.round(gust),
          bearing,
          color: windColor(mph),
        },
      };
    } catch {
      return null;
    }
  }));

  return {
    grid,
    maxSpeed,
    arrowFeatures: arrowResults.filter(Boolean),
  };
}

/**
 * Bilinear sample of the wind grid at (lon, lat). Returns u, v in m/s
 * and wind speed. Zero outside the bounded region.
 */
function sampleWind(grid, lon, lat) {
  if (lon < BOUNDS.west || lon > BOUNDS.east || lat < BOUNDS.south || lat > BOUNDS.north) {
    return { u: 0, v: 0, speed: 0 };
  }
  const fx = (lon - BOUNDS.west)  / (BOUNDS.east  - BOUNDS.west)  * (GRID_W - 1);
  const fy = (lat - BOUNDS.south) / (BOUNDS.north - BOUNDS.south) * (GRID_H - 1);
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  const i1 = Math.min(i0 + 1, GRID_W - 1);
  const j1 = Math.min(j0 + 1, GRID_H - 1);
  const dx = fx - i0, dy = fy - j0;
  const s = (i, j) => {
    const idx = (j * GRID_W + i) * 3;
    return [grid[idx], grid[idx + 1], grid[idx + 2]];
  };
  const [au, av, asp] = s(i0, j0);
  const [bu, bv, bsp] = s(i1, j0);
  const [cu, cv, csp] = s(i0, j1);
  const [du, dv, dsp] = s(i1, j1);
  return {
    u: (au * (1 - dx) + bu * dx) * (1 - dy) + (cu * (1 - dx) + du * dx) * dy,
    v: (av * (1 - dx) + bv * dx) * (1 - dy) + (cv * (1 - dx) + dv * dx) * dy,
    speed: (asp * (1 - dx) + bsp * dx) * (1 - dy) + (csp * (1 - dx) + dsp * dx) * dy,
  };
}

/**
 * Trace a single streamline starting from a seed point. Walks through
 * the wind field via Euler integration for STREAMLINE_STEPS steps. Stops
 * early if the line leaves bounds or hits a calm zone.
 */
function traceStreamline(grid, seedLon, seedLat) {
  const coords = [[seedLon, seedLat]];
  let speedSum = 0;
  let lon = seedLon, lat = seedLat;
  for (let i = 0; i < STREAMLINE_STEPS; i++) {
    const w = sampleWind(grid, lon, lat);
    if (w.speed < 0.1) break;
    speedSum += w.speed;
    // Advance. v is m/s north, u is m/s east. Convert to approximate
    // degrees via STEP_SCALE. (Not geodesically precise but visually fine
    // at this scale — Scotland covers ~4° and we're drawing, not navigating.)
    lon += w.u * STEP_SCALE;
    lat += w.v * STEP_SCALE;
    if (lon < BOUNDS.west - 0.5 || lon > BOUNDS.east + 0.5 ||
        lat < BOUNDS.south - 0.5 || lat > BOUNDS.north + 0.5) break;
    coords.push([lon, lat]);
  }
  const avgSpeed = coords.length > 1 ? speedSum / (coords.length - 1) : 0;
  return { coords, avgSpeed };
}

/**
 * Generate streamline features. We seed from a jittered 8×7 grid so
 * streamlines start evenly distributed, not random-clumpy.
 */
function buildStreamlines(grid) {
  const features = [];
  const seedW = 8, seedH = 7;
  for (let j = 0; j < seedH; j++) {
    for (let i = 0; i < seedW; i++) {
      // Jitter keeps the field organic instead of gridded
      const jx = (Math.random() - 0.5) * 0.5;
      const jy = (Math.random() - 0.5) * 0.5;
      const lon = BOUNDS.west + ((i + 0.5) / seedW) * (BOUNDS.east - BOUNDS.west) + jx;
      const lat = BOUNDS.south + ((j + 0.5) / seedH) * (BOUNDS.north - BOUNDS.south) + jy;
      const { coords, avgSpeed } = traceStreamline(grid, lon, lat);
      if (coords.length < 4) continue;  // skip trivially short lines
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          speed: avgSpeed,
          opacity: avgSpeed < 2 ? 0.15 : avgSpeed < 6 ? 0.28 : 0.42,
        },
      });
    }
  }
  return features;
}

/** Canvas-rendered white arrow icon, registered as a map image at load. */
function createArrowImage() {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(15, 25, 40, 0.88)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(24, 6);
  ctx.lineTo(36, 22);
  ctx.lineTo(29, 22);
  ctx.lineTo(29, 42);
  ctx.lineTo(19, 42);
  ctx.lineTo(19, 22);
  ctx.lineTo(12, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

export default function MunroWindMap({ onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [maxMph, setMaxMph] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-4.2, 57.0],
      zoom: 6.0,
      minZoom: 5,
      maxZoom: 11,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', async () => {
      // Register the arrow icon so the symbol layer can reference it
      if (!map.hasImage('wind-arrow')) {
        map.addImage('wind-arrow', createArrowImage(), { sdf: true });
      }

      const { grid, maxSpeed, arrowFeatures } = await fetchGridAndArrows();

      // Build streamlines from the grid. CPU cost is ~1ms for 56 lines.
      const streamlineFeatures = buildStreamlines(grid);

      // Report peak in mph (grid is m/s → ×2.237)
      setMaxMph(Math.round(maxSpeed * 2.237));

      // ── LAYER 1: streamlines (background flow field) ──
      map.addSource('wind-streamlines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: streamlineFeatures },
      });
      map.addLayer({
        id: 'wind-streamlines-glow',
        type: 'line',
        source: 'wind-streamlines',
        paint: {
          // Colour-graded by wind speed — matches the 5-band palette used
          // for the arrow badges so the legend applies equally to both
          // layers. Thresholds in m/s correspond to 10/20/30/40 mph.
          'line-color': [
            'step', ['get', 'speed'],
            '#22c55e',
            4.47, '#84cc16',
            8.94, '#eab308',
            13.41, '#f97316',
            17.88, '#ef4444',
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            5, 2.2,
            8, 3.2,
            11, 4.2,
          ],
          'line-opacity': ['*', ['get', 'opacity'], 0.4],
          'line-blur': 1.8,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      map.addLayer({
        id: 'wind-streamlines',
        type: 'line',
        source: 'wind-streamlines',
        paint: {
          'line-color': [
            'step', ['get', 'speed'],
            '#34d399',
            4.47, '#a3e635',
            8.94, '#fbbf24',
            13.41, '#fb923c',
            17.88, '#f87171',
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.7,
            8, 1.0,
            11, 1.4,
          ],
          'line-opacity': ['*', ['get', 'opacity'], 1.2],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ── LAYER 2: arrow badges (foreground reference points) ──
      map.addSource('wind-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: arrowFeatures },
      });
      map.addLayer({
        id: 'wind-arrows',
        type: 'symbol',
        source: 'wind-points',
        layout: {
          'icon-image': 'wind-arrow',
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.38,
            8, 0.52,
            11, 0.68,
          ],
          'icon-rotate': ['+', ['get', 'bearing'], 180],
          'icon-allow-overlap': true,
          'icon-rotation-alignment': 'map',
          'icon-offset': [0, -18],
          'icon-anchor': 'center',
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-halo-color': 'rgba(15, 25, 40, 0.7)',
          'icon-halo-width': 0.8,
        },
      });
      map.addLayer({
        id: 'wind-badges',
        type: 'symbol',
        source: 'wind-points',
        layout: {
          'text-field': ['to-string', ['get', 'speed']],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            5, 10,
            8, 12,
            11, 14,
          ],
          'text-anchor': 'center',
          'text-offset': [0, 0.4],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(15, 25, 40, 0.92)',
          'text-halo-width': 2.2,
        },
      });

      // Click handling
      map.on('click', 'wind-arrows', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelected({
          name: f.properties.name,
          kind: f.properties.kind,
          speed: f.properties.speed,
          bearing: f.properties.bearing,
          gust: f.properties.gust,
          color: f.properties.color,
        });
      });
      map.on('mouseenter', 'wind-arrows', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'wind-arrows', () => { map.getCanvas().style.cursor = ''; });
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['wind-arrows'] });
        if (hits.length === 0) setSelected(null);
      });

      setStatus('ready');
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title">
          <div className="map-eyebrow">Live Wind Map</div>
          <div className="map-subtitle">
            {status === 'loading' && 'Building wind field…'}
            {status === 'ready' && (maxMph > 0 ? `Live · peak ${maxMph} mph` : 'Live · wind across Scotland')}
          </div>
        </div>
        <button className="map-close" onClick={onClose} aria-label="Close map">✕</button>
      </div>

      <div ref={containerRef} className="tile-map-viewport">
        <div className="wind-field-legend">
          <div className="wind-field-legend-title">Wind speed</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#22c55e' }} /> Calm · under 10 mph</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#84cc16' }} /> Light · 10–20</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#eab308' }} /> Breezy · 20–30</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#f97316' }} /> Strong · 30–40</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{ background: '#ef4444' }} /> Dangerous · 40+</div>
        </div>

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

        {status === 'loading' && (
          <div className="wind-progress-chip" role="status" aria-live="polite">
            <div className="wind-progress-spinner" />
            <span className="wind-progress-text">Loading…</span>
          </div>
        )}
      </div>
    </div>
  );
}
