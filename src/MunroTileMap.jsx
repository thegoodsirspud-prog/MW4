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
  // Disambiguation list — when a tap hits multiple densely-packed peaks
  // we show all of them and let the user pick.
  const [disambig, setDisambig] = useState(null);

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

      // INVISIBLE hit-area on top — much bigger than the visible dot so
      // fat-finger taps still find their target. Receives all click events
      // before the visible layer.
      map.addLayer({
        id: 'munros-hit',
        type: 'circle',
        source: 'munros',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, 12,
            8, 16,
            11, 20,
            14, 24,
          ],
          'circle-color': 'transparent',
          'circle-stroke-width': 0,
          'circle-opacity': 0,  // fully invisible
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

      // Tap a peak (via the invisible larger hit-area layer for fat-finger
      // tolerance). Query a 22px bbox around the tap to catch dense clusters
      // — if multiple peaks fall in that bbox, present a disambiguation
      // list so the user can pick the one they meant. If only one peak,
      // open the preview directly. The single source of truth is the dense
      // Cairngorms cluster: at zoom 7-8 you can have 6 Munros within 30px.
      map.on('click', (e) => {
        const tol = 22;
        const bbox = [
          [e.point.x - tol, e.point.y - tol],
          [e.point.x + tol, e.point.y + tol],
        ];
        const hits = map.queryRenderedFeatures(bbox, { layers: ['munros-hit'] });

        if (hits.length === 0) {
          // tap on empty water/land — dismiss any open preview/disambig
          setPreview(null);
          setDisambig(null);
          return;
        }

        // De-duplicate by peak name (the bbox can repeat features)
        const seen = new Set();
        const peaks = [];
        for (const f of hits) {
          const name = f.properties?.name;
          if (!name || seen.has(name)) continue;
          seen.add(name);
          const m = MUNROS.find((x) => x.name === name);
          if (m) peaks.push(m);
          if (peaks.length >= 6) break;  // never more than 6 in disambig
        }

        if (peaks.length === 1) {
          map.easeTo({ center: [peaks[0].lon, peaks[0].lat], duration: 400 });
          setDisambig(null);
          setPreview(peaks[0]);
        } else {
          // Multiple peaks within tolerance — show picker
          setPreview(null);
          setDisambig(peaks);
        }
      });

      map.on('mouseenter', 'munros-hit', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'munros-hit', () => {
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

  // User location — toggles a blue pulsing dot at the user's geo position
  // and flies the map to it. Permission failure is silent (we just show
  // a small toast). We deliberately don't continuously watch position —
  // a single fix is enough for "where am I relative to these peaks".
  const [userPos, setUserPos] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const requestLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Location not supported');
      setTimeout(() => setGeoError(null), 3000);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserPos(next);
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [next.lon, next.lat],
            zoom: Math.max(9, mapRef.current.getZoom()),
            duration: 900,
            essential: true,
          });
        }
      },
      () => {
        setGeoError('Location permission denied');
        setTimeout(() => setGeoError(null), 3000);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Render the user-position marker as a MapLibre marker so it follows
  // pan/zoom natively. Recreated on userPos change.
  useEffect(() => {
    if (!ready || !mapRef.current || !userPos) return;
    const el = document.createElement('div');
    el.className = 'tile-map-userpos';
    el.innerHTML = '<span class="tile-map-userpos-dot"></span><span class="tile-map-userpos-pulse"></span>';
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([userPos.lon, userPos.lat])
      .addTo(mapRef.current);
    return () => marker.remove();
  }, [ready, userPos]);

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
             {/* SEARCH BAR */}
       <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
         <div style={{ position: 'relative' }}>
           <input
             className="search-input"
             placeholder="Search 282 Munros..."
             value={search}
             onChange={(e) => handleSearch(e.target.value)}
             style={{ width: '100%' }}
           />
           {search && (
             <>
               <button 
                 className="search-clear"
                 onClick={() => { setSearch(''); setSearchResults([]); }}
                 style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}
               >✕</button>
               {searchResults.length > 0 && (
                 <div className="search-results glass" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 11, maxHeight: '250px', overflowY: 'auto' }}>
                   {searchResults.map(m => (
                     <button
                       key={m.name}
                       className="search-item"
                       onClick={() => { onSelectMunro(m); setSearch(''); setSearchResults([]); }}
                       style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                     >
                       <div style={{ fontSize: '13px', fontWeight: 500 }}>{m.name}</div>
                       <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{m.h}m · {m.region}</div>
                     </button>
                   ))}
                 </div>
               )}
             </>
           )}
         </div>
       </div>

       <div ref={containerRef} className="tile-map-viewport">
      <div ref={containerRef} className="tile-map-viewport">
        <div className="tile-map-controls">
          <button
            className="tile-map-ctrl"
            onClick={resetView}
            aria-label="Reset view to full Scotland"
          >
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
              <path
                d="M10 3 L10 7 M3 10 L7 10 M10 13 L10 17 M13 10 L17 10"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
              />
              <circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span>Reset</span>
          </button>

          <button
            className={`tile-map-ctrl ${userPos ? 'tile-map-ctrl-active' : ''}`}
            onClick={requestLocation}
            aria-label="Show my location"
          >
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

        {geoError && (
          <div className="tile-map-toast" role="status">{geoError}</div>
        )}

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

        {disambig && (
          <div className="tile-map-disambig" role="dialog" aria-label="Multiple peaks at this location">
            <div className="tile-map-disambig-head">
              <div className="tile-map-disambig-eyebrow">
                {disambig.length} peaks here
              </div>
              <button
                className="tile-map-disambig-close"
                onClick={() => setDisambig(null)}
                aria-label="Dismiss"
              >✕</button>
            </div>
            <div className="tile-map-disambig-list">
              {disambig
                .sort((a, b) => b.h - a.h)
                .map((m) => (
                <button
                  key={m.name}
                  className="tile-map-disambig-item"
                  onClick={() => {
                    mapRef.current?.easeTo({ center: [m.lon, m.lat], duration: 400 });
                    setDisambig(null);
                    setPreview(m);
                  }}
                >
                  <div className="tile-map-disambig-item-name">{m.name}</div>
                  <div className="tile-map-disambig-item-meta">
                    {m.region} · {m.h.toLocaleString()}m
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
