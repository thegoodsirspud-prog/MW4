import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MUNROS } from './munros.js';

const STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};
const THEME = {
  dark: { dot: '#93c5fd', dotStroke: 'rgba(15,25,40,0.8)', halo: '#60a5fa', ring: '#ffffff', label: '#ffffff', labelHalo: 'rgba(15,25,40,0.9)' },
  light: { dot: '#2563eb', dotStroke: 'rgba(255,255,255,0.9)', halo: '#3b82f6', ring: '#1e3a5f', label: '#1e293b', labelHalo: 'rgba(255,255,255,0.9)' },
};
const MUNRO_GEOJSON = {
  type: 'FeatureCollection',
  features: MUNROS.map(m => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [m.lon, m.lat] }, properties: { name: m.name, region: m.region, h: m.h } })),
};

// ── Wind overlay (shared constants) ────────────────────────────────────
const BOUNDS = { west: -8.0, east: -1.2, south: 55.2, north: 59.2 };
const GRID_W = 10, GRID_H = 7, PARTICLE_COUNT = 250, MAX_AGE = 80, SPEED_FACTOR = 0.002;

function sampleWind(grid, lon, lat) {
  if (lon < BOUNDS.west || lon > BOUNDS.east || lat < BOUNDS.south || lat > BOUNDS.north) return { u:0, v:0, speed:0 };
  const fx = (lon-BOUNDS.west)/(BOUNDS.east-BOUNDS.west)*(GRID_W-1), fy = (lat-BOUNDS.south)/(BOUNDS.north-BOUNDS.south)*(GRID_H-1);
  const i0 = Math.floor(fx), j0 = Math.floor(fy), i1 = Math.min(i0+1,GRID_W-1), j1 = Math.min(j0+1,GRID_H-1);
  const dx = fx-i0, dy = fy-j0;
  const s = (i,j) => { const idx=(j*GRID_W+i)*3; return [grid[idx],grid[idx+1],grid[idx+2]]; };
  const [au,av,asp]=s(i0,j0),[bu,bv,bsp]=s(i1,j0),[cu,cv,csp]=s(i0,j1),[du,dv,dsp]=s(i1,j1);
  return { u:(au*(1-dx)+bu*dx)*(1-dy)+(cu*(1-dx)+du*dx)*dy, v:(av*(1-dx)+bv*dx)*(1-dy)+(cv*(1-dx)+dv*dx)*dy, speed:(asp*(1-dx)+bsp*dx)*(1-dy)+(csp*(1-dx)+dsp*dx)*dy };
}

function resetParticle() {
  return { lon: BOUNDS.west+Math.random()*(BOUNDS.east-BOUNDS.west), lat: BOUNDS.south+Math.random()*(BOUNDS.north-BOUNDS.south), age:0, maxAge:30+Math.random()*MAX_AGE };
}
function createFlowArrow() {
  const s=24,c=document.createElement('canvas'); c.width=s; c.height=s;
  const ctx=c.getContext('2d'); ctx.fillStyle='#ffffff';
  ctx.beginPath(); ctx.moveTo(12,2); ctx.lineTo(20,14); ctx.lineTo(15,12); ctx.lineTo(15,22); ctx.lineTo(9,22); ctx.lineTo(9,12); ctx.lineTo(4,14); ctx.closePath(); ctx.fill();
  return ctx.getImageData(0,0,s,s);
}

function addLayers(map, theme, selName) {
  const t = THEME[theme];
  ['munros-label','munros-hit','munros-selected','munros-pulse','munros-dot','munros-halo'].forEach(id => { try { map.removeLayer(id); } catch {} });
  try { map.removeSource('munros'); } catch {};

  map.addSource('munros', { type: 'geojson', data: MUNRO_GEOJSON });
  map.addLayer({ id: 'munros-halo', type: 'circle', source: 'munros', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'],5,5,8,8,11,11,14,15], 'circle-color': t.halo, 'circle-opacity': 0.22, 'circle-blur': 0.9 }});
  map.addLayer({ id: 'munros-dot', type: 'circle', source: 'munros', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'],5,2.5,8,3.5,11,5,14,7], 'circle-color': t.dot, 'circle-stroke-color': t.dotStroke, 'circle-stroke-width': 0.8 }});
  // Pulsing selection ring — animated via timer
  map.addLayer({ id: 'munros-pulse', type: 'circle', source: 'munros',
    filter: ['==', ['get','name'], ''], paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'],5,12,8,16,11,20,14,24],
    'circle-color': 'transparent', 'circle-stroke-color': t.ring, 'circle-stroke-width': 2, 'circle-stroke-opacity': 0 }});
  map.addLayer({ id: 'munros-selected', type: 'circle', source: 'munros',
    filter: ['==',['get','name'], selName || ''], paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'],5,7,8,10,11,13,14,17],
    'circle-color': 'transparent', 'circle-stroke-color': t.ring, 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.92 }});
  map.addLayer({ id: 'munros-hit', type: 'circle', source: 'munros', paint: {
    'circle-radius': ['interpolate',['linear'],['zoom'],5,12,8,16,11,20,14,24], 'circle-color': 'transparent', 'circle-opacity': 0 }});
  map.addLayer({ id: 'munros-label', type: 'symbol', source: 'munros', minzoom: 9,
    layout: { 'text-field':['get','name'], 'text-font':['Open Sans Semibold','Arial Unicode MS Bold'],
      'text-size':['interpolate',['linear'],['zoom'],9,10,12,12], 'text-offset':[0,1.2], 'text-anchor':'top', 'text-allow-overlap':false, 'text-optional':true },
    paint: { 'text-color': t.label, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.3 }});
}

export default function MunroTileMap({ onSelectMunro, selectedMunro }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(null);
  const [disambig, setDisambig] = useState(null);
  const [isLight, setIsLight] = useState(false);
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const themeRef = useRef('dark');
  const pulseRef = useRef(null);
  const windGridRef = useRef(null);
  const windParticlesRef = useRef(null);
  const windAnimRef = useRef(null);

  // ── Pulse animation for previewed peak ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (pulseRef.current) { clearInterval(pulseRef.current); pulseRef.current = null; }

    if (preview) {
      try { map.setFilter('munros-pulse', ['==', ['get','name'], preview.name]); } catch {}
      let phase = 0;
      pulseRef.current = setInterval(() => {
        phase = (phase + 1) % 40;
        const t = phase / 40;
        const ease = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
        try {
          map.setPaintProperty('munros-pulse', 'circle-stroke-opacity', 0.2 + ease * 0.5);
          map.setPaintProperty('munros-pulse', 'circle-stroke-width', 1.5 + ease * 1.5);
        } catch {}
      }, 50);
    } else {
      try { map.setFilter('munros-pulse', ['==', ['get','name'], '']); } catch {}
    }
    return () => { if (pulseRef.current) clearInterval(pulseRef.current); };
  }, [preview, ready]);

  // ── Wind overlay ─────────────────────────────────────────────────────
  const startWindAnimation = useCallback((map, grid) => {
    if (!windParticlesRef.current) {
      windParticlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
        const p = resetParticle(); p.age = Math.floor(Math.random() * p.maxAge * 0.6); return p;
      });
    }
    let fc = 0;
    function tick() {
      fc++;
      if (fc % 3 !== 0) { windAnimRef.current = requestAnimationFrame(tick); return; }
      const features = [];
      for (let i = 0; i < windParticlesRef.current.length; i++) {
        const p = windParticlesRef.current[i];
        p.age++;
        if (p.age >= p.maxAge) { windParticlesRef.current[i] = resetParticle(); continue; }
        const w = sampleWind(grid, p.lon, p.lat);
        if (w.speed < 0.3) { windParticlesRef.current[i] = resetParticle(); continue; }
        p.lon += w.u * SPEED_FACTOR; p.lat += w.v * SPEED_FACTOR;
        if (p.lon < BOUNDS.west-0.3||p.lon > BOUNDS.east+0.3||p.lat < BOUNDS.south-0.3||p.lat > BOUNDS.north+0.3) { windParticlesRef.current[i] = resetParticle(); continue; }
        const deg = (Math.atan2(w.u, w.v) * 180 / Math.PI + 360) % 360;
        const life = p.age / p.maxAge;
        const fade = life < 0.12 ? life/0.12 : life > 0.8 ? (1-life)/0.2 : 1;
        const opacity = fade * (0.25 + Math.min(1, w.speed/10) * 0.45);
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { r: Math.round(deg), o: Math.round(opacity*100)/100, s: Math.round(w.speed*100)/100 } });
      }
      try { map.getSource('wind-flow')?.setData({ type: 'FeatureCollection', features }); } catch {}
      windAnimRef.current = requestAnimationFrame(tick);
    }
    windAnimRef.current = requestAnimationFrame(tick);
  }, []);

  const handleToggleWind = useCallback(async () => {
    const map = mapRef.current; if (!map) return;
    const next = !showWind;
    if (next) {
      // Fetch grid if needed
      if (!windGridRef.current) {
        const points = [];
        for (let j = 0; j < GRID_H; j++)
          for (let i = 0; i < GRID_W; i++)
            points.push({ i, j, lat: BOUNDS.south+(j/(GRID_H-1))*(BOUNDS.north-BOUNDS.south), lon: BOUNDS.west+(i/(GRID_W-1))*(BOUNDS.east-BOUNDS.west) });
        const results = await Promise.all(points.map(async p => {
          try {
            const d = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe%2FLondon`)).json();
            const speed = d.current?.wind_speed_10m ?? 0;
            const a = ((d.current?.wind_direction_10m ?? 0)+180)%360*Math.PI/180;
            return { ...p, u: Math.sin(a)*speed, v: Math.cos(a)*speed, speed };
          } catch { return { ...p, u:0, v:0, speed:0 }; }
        }));
        const grid = new Float32Array(GRID_W*GRID_H*3);
        for (const r of results) { const idx=(r.j*GRID_W+r.i)*3; grid[idx]=r.u; grid[idx+1]=r.v; grid[idx+2]=r.speed; }
        windGridRef.current = grid;
      }
      // Add layer
      try { if (!map.hasImage('flow-arrow')) map.addImage('flow-arrow', createFlowArrow(), { sdf: true }); } catch {}
      try { map.removeLayer('wind-flow-layer'); } catch {}
      try { map.removeSource('wind-flow'); } catch {}
      map.addSource('wind-flow', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'wind-flow-layer', type: 'symbol', source: 'wind-flow',
        layout: { 'icon-image': 'flow-arrow', 'icon-size': 0.5, 'icon-rotate': ['get','r'],
          'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-padding': 0 },
        paint: { 'icon-color': ['step',['get','s'],'#22c55e',4.47,'#84cc16',8.94,'#eab308',13.41,'#f97316',17.88,'#ef4444'], 'icon-opacity': ['get','o'] },
      }, 'munros-halo'); // insert below peaks
      startWindAnimation(map, windGridRef.current);
    } else {
      cancelAnimationFrame(windAnimRef.current);
      try { map.removeLayer('wind-flow-layer'); } catch {}
      try { map.removeSource('wind-flow'); } catch {}
    }
    setShowWind(next); setCtrlOpen(false);
  }, [showWind, startWindAnimation]);

  // ── Map init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current, style: STYLES.dark,
      center: [-4.2, 57.0], zoom: 6.2, minZoom: 5, maxZoom: 14,
      attributionControl: { compact: true }, pitchWithRotate: false, dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      addLayers(map, 'dark', selectedMunro?.name);
      map.on('click', (e) => {
        const tol = 22, bbox = [[e.point.x-tol,e.point.y-tol],[e.point.x+tol,e.point.y+tol]];
        const hits = map.queryRenderedFeatures(bbox, { layers: ['munros-hit'] });
        if (!hits.length) { setPreview(null); setDisambig(null); return; }
        const seen = new Set(), peaks = [];
        for (const f of hits) { const n = f.properties?.name; if (!n||seen.has(n)) continue; seen.add(n); const m = MUNROS.find(x=>x.name===n); if (m) peaks.push(m); if (peaks.length>=6) break; }
        if (peaks.length === 1) { map.easeTo({ center: [peaks[0].lon, peaks[0].lat], duration: 400 }); setDisambig(null); setPreview(peaks[0]); }
        else { setPreview(null); setDisambig(peaks); }
      });
      map.on('mouseenter','munros-hit',()=>{map.getCanvas().style.cursor='pointer'});
      map.on('mouseleave','munros-hit',()=>{map.getCanvas().style.cursor=''});
      setReady(true);
    });
    mapRef.current = map;
    return () => { cancelAnimationFrame(windAnimRef.current); map.remove(); mapRef.current = null; };
  }, []);

  const toggleTheme = useCallback(() => {
    const map = mapRef.current; if (!map) return;
    cancelAnimationFrame(windAnimRef.current);
    const next = isLight ? 'dark' : 'light'; themeRef.current = next;
    const center = map.getCenter(), zoom = map.getZoom();
    map.setStyle(STYLES[next]);
    const onReady = () => {
      addLayers(map, next, selectedMunro?.name);
      if (showWind && windGridRef.current) {
        try { if (!map.hasImage('flow-arrow')) map.addImage('flow-arrow', createFlowArrow(), { sdf: true }); } catch {}
        try { map.removeLayer('wind-flow-layer'); } catch {}
        try { map.removeSource('wind-flow'); } catch {}
        map.addSource('wind-flow', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'wind-flow-layer', type: 'symbol', source: 'wind-flow',
          layout: { 'icon-image':'flow-arrow','icon-size':0.5,'icon-rotate':['get','r'],'icon-rotation-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true,'icon-padding':0 },
          paint: { 'icon-color': ['step',['get','s'],'#22c55e',4.47,'#84cc16',8.94,'#eab308',13.41,'#f97316',17.88,'#ef4444'], 'icon-opacity': ['get','o'] },
        }, 'munros-halo');
        startWindAnimation(map, windGridRef.current);
      }
      map.jumpTo({ center, zoom });
    };
    map.once('idle', onReady);
    setTimeout(() => { try { if (!map.getSource('munros')) onReady(); } catch {} }, 2000);
    setIsLight(!isLight); setCtrlOpen(false);
  }, [isLight, selectedMunro, showWind, startWindAnimation]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    try { mapRef.current.setFilter('munros-selected', ['==',['get','name'], selectedMunro?.name || '']); } catch {}
    if (selectedMunro) mapRef.current.flyTo({ center: [selectedMunro.lon, selectedMunro.lat], zoom: Math.max(8, mapRef.current.getZoom()), duration: 800, essential: true });
  }, [ready, selectedMunro]);

  const resetView = () => { mapRef.current?.flyTo({ center: [-4.2, 57.0], zoom: 6.2, duration: 700, essential: true }); setCtrlOpen(false); setPreview(null); };

  const [userPos, setUserPos] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const requestLocation = () => {
    setGeoError(null); setCtrlOpen(false);
    if (!navigator.geolocation) { setGeoError('Location not supported'); setTimeout(()=>setGeoError(null),3000); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { const p = { lat: pos.coords.latitude, lon: pos.coords.longitude }; setUserPos(p); mapRef.current?.flyTo({ center: [p.lon,p.lat], zoom: Math.max(9, mapRef.current.getZoom()), duration: 900, essential: true }); },
      () => { setGeoError('Location denied'); setTimeout(()=>setGeoError(null),3000); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };
  useEffect(() => {
    if (!ready || !mapRef.current || !userPos) return;
    const el = document.createElement('div'); el.className = 'tile-map-userpos';
    el.innerHTML = '<span class="tile-map-userpos-dot"></span><span class="tile-map-userpos-pulse"></span>';
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([userPos.lon, userPos.lat]).addTo(mapRef.current);
    return () => marker.remove();
  }, [ready, userPos]);

  return (
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title"><div className="map-eyebrow">Scottish Munros</div><div className="map-subtitle">All {MUNROS.length} peaks · tap to select</div></div>
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
              <button className="map-ctrl-item" onClick={requestLocation}>
                <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="10" r="3" fill="currentColor" /><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.5" /></svg>
                My location
              </button>
              <button className="map-ctrl-item" onClick={handleToggleWind}>
                <svg viewBox="0 0 20 20" width="14" height="14"><path d="M3 10 Q7 6 11 10 Q15 14 19 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                {showWind ? 'Hide wind' : 'Show wind'}
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

        {geoError && <div className="tile-map-toast" role="status">{geoError}</div>}

        {preview && (
          <div className="tile-map-preview" role="dialog">
            <div className="tile-map-preview-eyebrow">{preview.region}</div>
            <div className="tile-map-preview-name">{preview.name}</div>
            <div className="tile-map-preview-meta">
              <span>{preview.h.toLocaleString()}m</span>
              <span className="tile-map-preview-sep">·</span>
              <span>Munro</span>
            </div>
            <div className="tile-map-preview-actions">
              <button className="tile-map-preview-cancel" onClick={() => setPreview(null)}>Close</button>
              <button className="tile-map-preview-confirm" onClick={() => { const p = preview; setPreview(null); onSelectMunro(p); }}>View forecast →</button>
            </div>
          </div>
        )}

        {disambig && (
          <div className="tile-map-disambig" role="dialog">
            <div className="tile-map-disambig-head">
              <div className="tile-map-disambig-eyebrow">{disambig.length} peaks here</div>
              <button className="tile-map-disambig-close" onClick={() => setDisambig(null)}>✕</button>
            </div>
            <div className="tile-map-disambig-list">
              {disambig.sort((a,b)=>b.h-a.h).map(m => (
                <button key={m.name} className="tile-map-disambig-item"
                  onClick={() => { mapRef.current?.easeTo({ center: [m.lon,m.lat], duration: 400 }); setDisambig(null); setPreview(m); }}>
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
