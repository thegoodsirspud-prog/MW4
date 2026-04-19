import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MUNROS } from './munros.js';

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

  // Build GeoJSON once per riskByName change. Each feature carries the
  // peak's name, region, elevation, and risk colour so the GL style can
  // paint it without React rerenders.
  const featureCollection = {
    type: 'FeatureCollection',
    features: MUNROS.map((m) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
      properties: {
        name: m.name,
        region: m.region,
        h: m.h,
        color: riskByName[m.name] || '#60a5fa',
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

      // Click-to-select
      map.on('click', 'munros-dot', (e) => {
        const name = e.features?.[0]?.properties?.name;
        if (!name) return;
        const munro = MUNROS.find((m) => m.name === name);
        if (munro) onSelectMunro(munro);
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
      <div ref={containerRef} className="tile-map-viewport" />
    </div>
  );
}
