import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MunroWindMap v4 — static arrow grid, symbol-layer rendered
 *
 * Previous attempts:
 *   v1: 282 DOM overlays with map.project() per pan → laggy
 *   v2: 5000 WebGL point particles → looked like TV noise
 *   v3: ping-pong framebuffer trails → beautiful but the whole screen
 *       fills with blue, and at this density no breathing room
 *
 * v4: 30 arrows at geographically-distributed named locations,
 * rendered as a MapLibre symbol layer. One GPU draw call for all
 * arrows. Zero per-frame work. Arrows rotate via data-driven
 * icon-rotate expression; colour matches the risk-banding palette.
 *
 * Meteorologist credibility > particle flashiness. Arrows are
 * instantly understood by anyone who's seen a weather chart.
 */

// 30 representative locations — mix of iconic peaks and anchor towns
// so every region is covered, not just the western highlands cluster.
const WIND_LOCATIONS = [
  // Outer Hebrides
  { name: 'Stornoway',     lat: 58.2090, lon: -6.3878, kind: 'town' },
  { name: 'Barra',         lat: 56.9660, lon: -7.4850, kind: 'town' },
  // Shetland / Orkney
  { name: 'Lerwick',       lat: 60.1548, lon: -1.1445, kind: 'town' },
  { name: 'Kirkwall',      lat: 58.9810, lon: -2.9603, kind: 'town' },
  // Far North
  { name: 'Ben Hope',      lat: 58.4157, lon: -4.6194, kind: 'peak' },
  { name: 'Wick',          lat: 58.4390, lon: -3.0930, kind: 'town' },
  // Ross-shire / Torridon
  { name: 'Ullapool',      lat: 57.8960, lon: -5.1570, kind: 'town' },
  { name: 'An Teallach',   lat: 57.8110, lon: -5.2700, kind: 'peak' },
  { name: 'Liathach',      lat: 57.5510, lon: -5.4803, kind: 'peak' },
  // Skye
  { name: 'Portree',       lat: 57.4130, lon: -6.1940, kind: 'town' },
  { name: 'Sgurr Alasdair', lat: 57.2067, lon: -6.2261, kind: 'peak' },
  // Kintail / Knoydart
  { name: 'Carn Eighe',    lat: 57.2875, lon: -5.1155, kind: 'peak' },
  { name: 'Ladhar Bheinn', lat: 57.0653, lon: -5.6833, kind: 'peak' },
  // Moray / Inverness
  { name: 'Inverness',     lat: 57.4780, lon: -4.2247, kind: 'town' },
  { name: 'Elgin',         lat: 57.6498, lon: -3.3176, kind: 'town' },
  // Cairngorms
  { name: 'Cairn Gorm',    lat: 57.1167, lon: -3.6440, kind: 'peak' },
  { name: 'Ben Macdui',    lat: 57.0706, lon: -3.6700, kind: 'peak' },
  { name: 'Braemar',       lat: 57.0065, lon: -3.3973, kind: 'town' },
  // Aberdeenshire
  { name: 'Aberdeen',      lat: 57.1497, lon: -2.0943, kind: 'town' },
  { name: 'Lochnagar',     lat: 56.9605, lon: -3.2457, kind: 'peak' },
  // Lochaber
  { name: 'Ben Nevis',     lat: 56.7967, lon: -5.0042, kind: 'peak' },
  { name: 'Fort William',  lat: 56.8198, lon: -5.1052, kind: 'town' },
  // Glen Coe
  { name: 'Bidean nam Bian', lat: 56.6432, lon: -5.0295, kind: 'peak' },
  // Breadalbane
  { name: 'Ben Lawers',    lat: 56.5452, lon: -4.2211, kind: 'peak' },
  { name: 'Schiehallion',  lat: 56.6685, lon: -4.0986, kind: 'peak' },
  // Perthshire
  { name: 'Perth',         lat: 56.3950, lon: -3.4308, kind: 'town' },
  // Central / southern
  { name: 'Ben Lomond',    lat: 56.1903, lon: -4.6328, kind: 'peak' },
  { name: 'Stirling',      lat: 56.1165, lon: -3.9369, kind: 'town' },
  { name: 'Edinburgh',     lat: 55.9533, lon: -3.1883, kind: 'town' },
  { name: 'Glasgow',       lat: 55.8642, lon: -4.2518, kind: 'town' },
];

// Wind speed bands — matches the risk palette and the hero's wind ring.
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

/**
 * Generate an arrow icon as a Canvas ImageData so we can register it
 * as a map image. White fill with dark stroke for max readability at
 * any zoom, regardless of basemap colour.
 *
 * The SVG path draws a stout chevron arrow pointing up (0° = north).
 * MapLibre's icon-rotate then rotates it clockwise to match wind bearing.
 */
function createArrowImage() {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(15, 25, 40, 0.85)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  // Arrow shape, pointing up (toward smaller y). 48x48 viewport.
  ctx.beginPath();
  ctx.moveTo(24, 6);    // top point
  ctx.lineTo(36, 22);   // right shoulder
  ctx.lineTo(29, 22);   // right inner
  ctx.lineTo(29, 42);   // right bottom of shaft
  ctx.lineTo(19, 42);   // left bottom
  ctx.lineTo(19, 22);   // left inner
  ctx.lineTo(12, 22);   // left shoulder
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
      const arrow = createArrowImage();
      if (!map.hasImage('wind-arrow')) {
        map.addImage('wind-arrow', arrow, { sdf: true });  // SDF = colour via icon-color
      }

      // Fetch wind at every location in parallel. 30 points is light
      // enough that even on a slow connection this completes in ~1s.
      let peak = 0;
      const features = await Promise.all(WIND_LOCATIONS.map(async (pt) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=mph&timezone=Europe%2FLondon`;
          const res = await fetch(url);
          const data = await res.json();
          const speed = data.current?.wind_speed_10m ?? 0;
          const bearing = data.current?.wind_direction_10m ?? 0;
          const gust = data.current?.wind_gusts_10m ?? 0;
          if (speed > peak) peak = speed;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
            properties: {
              name: pt.name,
              kind: pt.kind,
              speed: Math.round(speed),
              bearing,
              gust: Math.round(gust),
              color: windColor(speed),
            },
          };
        } catch {
          return null;
        }
      }));

      const valid = features.filter(Boolean);
      setMaxMph(Math.round(peak));

      // Add the source + layers: arrow + speed-label circle + label text
      map.addSource('wind-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: valid },
      });

      // Arrow symbol — rotates to wind bearing, colours by speed band
      map.addLayer({
        id: 'wind-arrows',
        type: 'symbol',
        source: 'wind-points',
        layout: {
          'icon-image': 'wind-arrow',
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.42,
            8, 0.55,
            11, 0.7,
          ],
          // Icon painted pointing up = 0°. Wind bearing is the direction
          // the wind is coming FROM in degrees clockwise from N. We want
          // the arrow to show where the wind is going, so add 180°.
          'icon-rotate': ['+', ['get', 'bearing'], 180],
          'icon-allow-overlap': true,
          'icon-rotation-alignment': 'map',
          // Offset the arrow slightly above centre so the speed badge
          // (rendered as another layer below) doesn't overlap the arrow.
          'icon-offset': [0, -18],
          'icon-anchor': 'center',
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-halo-color': 'rgba(15, 25, 40, 0.6)',
          'icon-halo-width': 0.8,
        },
      });

      // Speed badge — small coloured pill with the mph value
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
          'text-halo-color': 'rgba(15, 25, 40, 0.9)',
          'text-halo-width': 2.2,
        },
      });

      // Click handler on arrows — open popup with name + full detail
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
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
        });
      });
      map.on('mouseenter', 'wind-arrows', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'wind-arrows', () => { map.getCanvas().style.cursor = ''; });

      // Click empty map → dismiss popup
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
            {status === 'loading' && 'Sampling wind across Scotland…'}
            {status === 'ready' && (maxMph > 0 ? `Live · peak ${maxMph} mph` : 'Live · wind across 30 locations')}
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
