import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MUNROS } from './munros.js';

/**
 * MunroTileMap
 *
 * Full-screen real Scotland map using MapLibre GL vector tiles.
 * Peaks are shown as simple, clean location markers — no risk colouring,
 * no API calls required. Tap a dot to preview; confirm to load forecast.
 */
const MUNRO_GEOJSON = {
  type: 'FeatureCollection',
  features: MUNROS.map((m) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
    properties: { name: m.name, region: m.region, h: m.h },
  })),
};

export default function MunroTileMap({ onSelectMunro, selectedMunro, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(null);
  const [disambig, setDisambig] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-4.2, 57.0],
      zoom: 6.2,
      minZoom: 5,
      maxZoom: 14,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });

    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('munros', { type: 'geojson', data: MUNRO_GEOJSON });

      // Soft glow halo behind each dot
      map.addLayer({
        id: 'munros-halo',
        type: 'circle',
        source: 'munros',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 8, 8, 11, 11, 14, 15],
          'circle-color': '#60a5fa',
          'circle-opacity': 0.22,
          'circle-blur': 0.9,
        },
      });

      // Main dot — clean blue-white
      map.addLayer({
        id: 'munros-dot',
        type: 'circle',
        source: 'munros',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 8, 3.5, 11, 5, 14, 7],
          'circle-color': '#93c5fd',
          'circle-stroke-color': 'rgba(15, 25, 40, 0.8)',
          'circle-stroke-width': 0.8,
        },
      });

      // Selected peak ring
      map.addLayer({
        id: 'munros-selected',
        type: 'circle',
        source: 'munros',
        filter: ['==', ['get', 'name'], selectedMunro?.name || ''],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 8, 10, 11, 13, 14, 17],
          'circle-color': 'transparent',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.92,
        },
      });

      // Invisible fat-finger hit area
      map.addLayer({
        id: 'munros-hit',
        type: 'circle',
        source: 'munros',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 12, 8, 16, 11, 20, 14, 24],
          'circle-color': 'transparent',
          'circle-opacity': 0,
        },
      });

      // Peak name label at high zoom
      map.addLayer({
        id: 'munros-label',
        type: 'symbol',
        source: 'munros',
        minzoom: 9,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 12, 12],
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

      map.on('click', (e) => {
        const tol = 22;
        const bbox = [[e.point.x - tol, e.point.y - tol], [e.point.x + tol, e.point.y + tol]];
        const hits = map.queryRenderedFeatures(bbox, { layers: ['munros-hit'] });

        if (hits.length === 0) { setPreview(null); setDisambig(null); return; }

        const seen = new Set();
        const peaks = [];
        for (const f of hits) {
          const name = f.properties?.name;
          if (!name || seen.has(name)) continue;
          seen.add(name);
          const m = MUNROS.find((x) => x.name === name);
          if (m) peaks.push(m);
          if (peaks.length >= 6) break;
        }

        if (peaks.length === 1) {
          map.easeTo({ center: [peaks[0].lon, peaks[0].lat], duration: 400 });
          setDisambig(null);
          setPreview(peaks[0]);
        } else {
          setPreview(null);
          setDisambig(peaks);
        }
      });

      map.on('mouseenter', 'munros-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'munros-hit', () => { map.getCanvas().style.cursor = ''; });

      setReady(true);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update selected ring when selection changes
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setFilter('munros-selected', ['==', ['get', 'name'], selectedMunro?.name || '']);
    if (selectedMunro) {
      mapRef.current.flyTo({
        center: [selectedMunro.lon, selectedMunro.lat],
        zoom: Math.max(8, mapRef.current.getZoom()),
        duration: 800,
        essential: true,
      });
    }
  }, [ready, selectedMunro]);

  const resetView = () => {
    if (!mapRef.current) return;
    setPreview(null);
    mapRef.current.flyTo({ center: [-4.2, 57.0], zoom: 6.2, duration: 700, essential: true });
  };

  const [userPos, setUserPos] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const requestLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError('Location not supported'); setTimeout(() => setGeoError(null), 3000); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserPos(next);
        if (mapRef.current) mapRef.current.flyTo({ center: [next.lon, next.lat], zoom: Math.max(9, mapRef.current.getZoom()), duration: 900, essential: true });
      },
      () => { setGeoError('Location permission denied'); setTimeout(() => setGeoError(null), 3000); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    if (!ready || !mapRef.current || !userPos) return;
    const el = document.createElement('div');
    el.className = 'tile-map-userpos';
    el.innerHTML = '<span class="tile-map-userpos-dot"></span><span class="tile-map-userpos-pulse"></span>';
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([userPos.lon, userPos.lat]).addTo(mapRef.current);
    return () => marker.remove();
  }, [ready, userPos]);

  return (
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title">
          <div className="map-eyebrow">Scottish Munros</div>
          <div className="map-subtitle">All {MUNROS.length} peaks · tap to select</div>
        </div>
        <button className="map-close" onClick={onClose} aria-label="Close map">✕</button>
      </div>
      <div ref={containerRef} className="tile-map-viewport">
        <div className="tile-map-controls">
          <button className="tile-map-ctrl" onClick={resetView} aria-label="Reset view">
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
              <path d="M10 3 L10 7 M3 10 L7 10 M10 13 L10 17 M13 10 L17 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span>Reset</span>
          </button>
          <button className={`tile-map-ctrl ${userPos ? 'tile-map-ctrl-active' : ''}`} onClick={requestLocation} aria-label="Show my location">
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
              <circle cx="10" cy="10" r="3" fill="currentColor" />
              <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
              <line x1="10" y1="1.5" x2="10" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="10" y1="16" x2="10" y2="18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="1.5" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="16" y1="10" x2="18.5" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>My location</span>
          </button>
        </div>

        {geoError && <div className="tile-map-toast" role="status">{geoError}</div>}

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
              <button className="tile-map-preview-cancel" onClick={() => setPreview(null)}>Close</button>
              <button className="tile-map-preview-confirm" onClick={() => { const p = preview; setPreview(null); onSelectMunro(p); }}>View forecast →</button>
            </div>
          </div>
        )}

        {disambig && (
          <div className="tile-map-disambig" role="dialog" aria-label="Multiple peaks at this location">
            <div className="tile-map-disambig-head">
              <div className="tile-map-disambig-eyebrow">{disambig.length} peaks here</div>
              <button className="tile-map-disambig-close" onClick={() => setDisambig(null)} aria-label="Dismiss">✕</button>
            </div>
            <div className="tile-map-disambig-list">
              {disambig.sort((a, b) => b.h - a.h).map((m) => (
                <button key={m.name} className="tile-map-disambig-item"
                  onClick={() => { mapRef.current?.easeTo({ center: [m.lon, m.lat], duration: 400 }); setDisambig(null); setPreview(m); }}>
                  <div className="tile-map-disambig-item-name">{m.name}</div>
                  <div className="tile-map-disambig-item-meta">{m.region} · {m.h.toLocaleString()}m</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
