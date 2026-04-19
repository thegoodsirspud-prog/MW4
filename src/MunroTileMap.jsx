import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MUNROS } from './munros.js';
import { RISK_COLORS } from './risk.js';

/**
 * Elevation-to-risk proxy. Without fetching all 282 forecasts we use
 * height as a stand-in for exposure risk — higher summits genuinely ARE
 * colder, windier, and more exposed, so this is physically defensible
 * rather than arbitrary. Thresholds are the 20/40/60/80 quintiles of
 * the real 282-peak distribution (909m min, 1345m max).
 *
 * When the user picks a peak and we have the real forecast, the
 * app-level riskByName overrides this proxy for that peak.
 */
function heightRiskColor(h) {
  if (h < 945) return RISK_COLORS[0];  // green — lowest quintile
  if (h < 981) return RISK_COLORS[1];  // yellow
  if (h < 1019) return RISK_COLORS[2]; // orange
  if (h < 1084) return RISK_COLORS[3]; // red
  return RISK_COLORS[4];               // deep red — top quintile (>= 1084m)
}

/**
 * MunroTileMap
 *
 * Full-screen real Scotland map using MapLibre GL vector tiles.
 *
 * Style: CARTO dark-matter — an open, attribution-only vector style that
 * renders a sophisticated dark basemap with subtle land/water contrast
 * and thin city labels. No API key required. Matches the dark aesthetic
 * of the rest of the app.
 *
 * All 282 Munros rendered as a single GeoJSON source so MapLibre can
 * handle clustering / hit-testing / zoom-dependent styling in native GL
 * rather than in React. The circle colour carries the current mountain
 * safety band — a quick national glance at where conditions are good,
 * moderate, or dangerous.
 *
 * Props:
 *   onSelectMunro(munro)  — called when the user taps a peak
 *   selectedMunro         — the currently selected peak (ringed + glowing)
 *   onClose()             — close button returns to home
 *   riskByName            — { [munro.name]: riskColor } precomputed in App
 *                           so we don't do 282 calcRisk() calls inside
 *                           a map component. Falls back to neutral when
 *                           missing.
 */
export default function MunroTileMap({ onSelectMunro, selectedMunro, onClose, riskByName = {} }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  // Tap-preview — first tap on a peak shows this floating card, the user
  // can confirm by tapping "View forecast" or tap elsewhere to dismiss.
  const [preview, setPreview] = useState(null);

  // Build GeoJSON once per riskByName change. Each feature carries the
  // peak's name, region, elevation, and risk colour so the GL style can
  // paint it without React rerenders. Default colour uses the elevation
  // proxy; real forecast data (if available via riskByName) overrides.
  const featureCollection = {
    type: 'FeatureCollection',
    features: MUNROS.map((m) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
      properties: {
        name: m.name,
        region: m.region,
        h: m.h,
        color: riskByName[m.name] || heightRiskColor(m.h),
      },
    })),
  };

  // Initialise the map once. The style URL is CARTO's public dark-matter
  // vector basemap — unlimited use under their attribution-only licence.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-4.2, 57.0],       // roughly centred on the highlands
      zoom: 6.2,                   // shows all of Scotland
      minZoom: 5,
      maxZoom: 14,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });

    // Disable rotation for a "map" feel rather than a "flight simulator" feel.
    map.touchZoomRotate.disableRotation();

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      // Munros source
      map.addSource('munros', {
        type: 'geojson',
        data: featureCollection,
      });

      // Glow halo — slightly larger, soft-coloured, behind the main circle.
      // Gives every peak a subtle aura at all zoom levels so they register
      // on the dark basemap without looking like floating stickers.
      map.addLayer({
        id: 'munros-halo',
        type: 'circle',
        source: 'munros',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, 4,    // small when zoomed out
            8, 7,
            11, 10,  // bigger when zoomed in
            14, 14,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.28,
          'circle-blur': 0.8,
        },
      });

      // Main marker — solid coloured dot
      map.addLayer({
        id: 'munros-dot',
        type: 'circle',
        source: 'munros',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, 2.5,
            8, 4,
            11, 5.5,
            14, 7.5,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': 'rgba(15, 25, 40, 0.85)',
          'circle-stroke-width': 0.8,
        },
      });

      // Selected peak — white ring outside the coloured dot. Updated via
      // setFeatureState whenever selectedMunro changes.
      map.addLayer({
        id: 'munros-selected',
        type: 'circle',
        source: 'munros',
        filter: ['==', ['get', 'name'], selectedMunro?.name || ''],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, 7,
            8, 10,
            11, 13,
            14, 17,
          ],
          'circle-color': 'transparent',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.92,
        },
      });

      // Label at higher zooms only — peak name floats above the dot when
      // the user zooms in enough to want to read them. At low zoom the
      // dots remain clean.
      map.addLayer({
        id: 'munros-label',
        type: 'symbol',
        source: 'munros',
        minzoom: 9,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            9, 10,
            12, 12,
          ],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(15, 25, 40, 0.9)',
          'text-halo-width': 1.3,
        },
      });

      // Tap a peak → open the preview card. User confirms via the card's
      // "View forecast" button rather than committing on first tap, which
      // prevents accidental navigation and lets them verify which peak
      // they actually hit (Munros are densely packed in the Cairngorms).
      map.on('click', 'munros-dot', (e) => {
        const name = e.features?.[0]?.properties?.name;
        if (!name) return;
        const munro = MUNROS.find((m) => m.name === name);
        if (!munro) return;
        // Gently nudge the peak into view if it's near the edge
        map.easeTo({
          center: [munro.lon, munro.lat],
          duration: 400,
        });
        setPreview(munro);
      });

      // Tap anywhere else on the map — dismiss the preview
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['munros-dot'] });
        if (hits.length === 0) setPreview(null);
      });

      map.on('mouseenter', 'munros-dot', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'munros-dot', () => {
        map.getCanvas().style.cursor = '';
      });

      setReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);  // Map itself only initialises once

  // When riskByName changes, update the GeoJSON source in place so colours
  // animate without rebuilding the map.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const src = mapRef.current.getSource('munros');
    if (src) src.setData(featureCollection);
  }, [ready, riskByName]);

  // When selection changes, update the filter on the selected layer so the
  // white ring jumps to the newly-picked peak.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setFilter('munros-selected', [
      '==', ['get', 'name'], selectedMunro?.name || '',
    ]);
    // Gently fly to the selection so user sees the context
    if (selectedMunro) {
      mapRef.current.flyTo({
        center: [selectedMunro.lon, selectedMunro.lat],
        zoom: Math.max(8, mapRef.current.getZoom()),
        duration: 800,
        essential: true,
      });
    }
  }, [ready, selectedMunro]);

  // Reset to full-Scotland view
  const resetView = () => {
    if (!mapRef.current) return;
    setPreview(null);
    mapRef.current.flyTo({
      center: [-4.2, 57.0],
      zoom: 6.2,
      duration: 700,
      essential: true,
    });
  };

  return (
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title">
          <div className="map-eyebrow">Scottish Munros</div>
          <div className="map-subtitle">
            All {MUNROS.length} peaks · tap to select
          </div>
        </div>
        <button className="map-close" onClick={onClose} aria-label="Close map">✕</button>
      </div>
      <div ref={containerRef} className="tile-map-viewport">
        <button
          className="tile-map-reset"
          onClick={resetView}
          aria-label="Reset view to full Scotland"
          title="Reset view"
        >
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path
              d="M10 3 L10 7 M3 10 L7 10 M10 13 L10 17 M13 10 L17 10"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
            />
            <circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>

        {preview && (
          <div className="tile-map-preview" role="dialog" aria-label={`Preview of ${preview.name}`}>
            <div className="tile-map-preview-eyebrow">{preview.region}</div>
            <div className="tile-map-preview-name">{preview.name}</div>
            <div className="tile-map-preview-meta">
              <span>{preview.h.toLocaleString()}m</span>
              <span className="tile-map-preview-sep" aria-hidden="true">·</span>
              <span>Munro</span>
            </div>
            <div className="tile-map-preview-actions">
              <button
                className="tile-map-preview-cancel"
                onClick={() => setPreview(null)}
              >Close</button>
              <button
                className="tile-map-preview-confirm"
                onClick={() => { const p = preview; setPreview(null); onSelectMunro(p); }}
              >View forecast →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
