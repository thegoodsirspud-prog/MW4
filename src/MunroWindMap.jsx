import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MunroWindMap — Windy.com-style animated wind field
 *
 * Replaces the old 282-DOM-arrows implementation. That approach put 282
 * React components on top of the map and re-projected each one on every
 * pan/zoom — the cause of the lag.
 *
 * This implementation:
 * 1. Samples wind on a 16×12 = 192 grid covering Scotland (parallel fetch).
 * 2. Renders ~5000 particles via a MapLibre CustomLayer. Each frame, every
 *    particle samples the wind vector at its position via bilinear
 *    interpolation, advances by velocity * dt, and draws as a point.
 * 3. Particles fade with age and respawn when they expire or leave bounds.
 *
 * Result: a flowing river of wind across Scotland, single GL draw call per
 * frame, ~60fps. The map stays fully interactive.
 *
 * Design colour: cyan-to-white particles. Iconic, reads at a glance against
 * the dark CARTO basemap, identical visual language to Windy.com.
 */

// Geographic bounds, padded around mainland Scotland + Hebrides + Skye + Orkney.
const BOUNDS = { west: -7.8, east: -1.5, south: 55.5, north: 59.0 };
const GRID_W = 16;
const GRID_H = 12;
const PARTICLE_COUNT = 5000;
const PARTICLE_LIFE = 60;          // frames before respawn
const PARTICLE_SPEED_MULT = 0.0008; // tunes visual speed
const DATA_CACHE_MS = 15 * 60 * 1000; // 15 min

let cachedGrid = null;
let cachedAt = 0;

async function fetchWindGrid() {
  if (cachedGrid && Date.now() - cachedAt < DATA_CACHE_MS) return cachedGrid;

  const points = [];
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const lon = BOUNDS.west + (i / (GRID_W - 1)) * (BOUNDS.east - BOUNDS.west);
      const lat = BOUNDS.south + (j / (GRID_H - 1)) * (BOUNDS.north - BOUNDS.south);
      points.push({ lat, lon, i, j });
    }
  }

  const results = await Promise.all(points.map(async (p) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe%2FLondon`;
      const res = await fetch(url);
      const data = await res.json();
      const speed = data.current?.wind_speed_10m ?? 0;
      const dir = data.current?.wind_direction_10m ?? 0;
      // dir is degrees clockwise from N (FROM direction).
      // We want the TO vector, which points opposite (dir + 180).
      const angle = ((dir + 180) % 360) * Math.PI / 180;
      const u = Math.sin(angle) * speed;  // east component (m/s)
      const v = Math.cos(angle) * speed;  // north component (m/s)
      return { i: p.i, j: p.j, u, v, speed };
    } catch {
      return { i: p.i, j: p.j, u: 0, v: 0, speed: 0 };
    }
  }));

  // Flat Float32Array, [u, v, speed, _] per cell, row-major.
  const data = new Float32Array(GRID_W * GRID_H * 4);
  let maxSpeed = 0;
  for (const r of results) {
    const idx = (r.j * GRID_W + r.i) * 4;
    data[idx + 0] = r.u;
    data[idx + 1] = r.v;
    data[idx + 2] = r.speed;
    data[idx + 3] = 1;
    if (r.speed > maxSpeed) maxSpeed = r.speed;
  }

  cachedGrid = { data, maxSpeed };
  cachedAt = Date.now();
  return cachedGrid;
}

/**
 * Build a MapLibre CustomLayer that renders the particle field. Owns its
 * GL state (program, buffers, particle positions/ages) and is driven by
 * the map's render loop via map.triggerRepaint() at the end of each frame.
 */
function makeWindParticleLayer(gridData) {
  return {
    id: 'wind-particles',
    type: 'custom',
    renderingMode: '2d',
    map: null,
    program: null,
    posBuffer: null,
    ageBuffer: null,
    particles: null,
    ages: null,

    onAdd(map, gl) {
      this.map = map;

      const vertexSrc = `
        attribute vec2 a_pos;
        attribute float a_age;
        attribute float a_intensity;
        uniform mat4 u_matrix;
        varying float v_age;
        varying float v_intensity;
        void main() {
          gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
          gl_PointSize = 2.0;
          v_age = a_age;
          v_intensity = a_intensity;
        }
      `;
      const fragmentSrc = `
        precision mediump float;
        varying float v_age;
        varying float v_intensity;
        void main() {
          float life = 1.0 - v_age;
          // Cyan when slow, white when fast. Intensity 0-1 = wind speed normalised.
          vec3 cool = vec3(0.40, 0.85, 1.00);  // cyan
          vec3 hot  = vec3(1.00, 1.00, 1.00);  // white
          vec3 col  = mix(cool, hot, clamp(v_intensity, 0.0, 1.0));
          gl_FragColor = vec4(col, life * 0.85);
        }
      `;

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, vertexSrc);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error('[Wind] vertex shader', gl.getShaderInfoLog(vs));
      }
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, fragmentSrc);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error('[Wind] fragment shader', gl.getShaderInfoLog(fs));
      }
      this.program = gl.createProgram();
      gl.attachShader(this.program, vs);
      gl.attachShader(this.program, fs);
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        console.error('[Wind] program link', gl.getProgramInfoLog(this.program));
      }

      this.aPos       = gl.getAttribLocation(this.program, 'a_pos');
      this.aAge       = gl.getAttribLocation(this.program, 'a_age');
      this.aIntensity = gl.getAttribLocation(this.program, 'a_intensity');
      this.uMatrix    = gl.getUniformLocation(this.program, 'u_matrix');

      // Particles in MapLibre Mercator coords (0..1 across the world).
      // u_matrix handles all camera projection automatically.
      this.particles  = new Float32Array(PARTICLE_COUNT * 2);
      this.ages       = new Float32Array(PARTICLE_COUNT);
      this.intensities = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) this.respawn(i);

      this.posBuffer       = gl.createBuffer();
      this.ageBuffer       = gl.createBuffer();
      this.intensityBuffer = gl.createBuffer();
    },

    respawn(i) {
      const lon = BOUNDS.west + Math.random() * (BOUNDS.east - BOUNDS.west);
      const lat = BOUNDS.south + Math.random() * (BOUNDS.north - BOUNDS.south);
      const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat]);
      this.particles[i * 2 + 0] = merc.x;
      this.particles[i * 2 + 1] = merc.y;
      this.ages[i] = Math.random();  // stagger so respawn doesn't pulse
      this.intensities[i] = 0;
    },

    /**
     * Sample wind at a Mercator coord. Bilinear interpolation inside bounds.
     * Returns m/s and a 0-1 intensity for shader colour mixing.
     */
    sampleWind(mercX, mercY) {
      const ll = new maplibregl.MercatorCoordinate(mercX, mercY).toLngLat();
      const lon = ll.lng;
      const lat = ll.lat;
      if (lon < BOUNDS.west || lon > BOUNDS.east || lat < BOUNDS.south || lat > BOUNDS.north) {
        return { u: 0, v: 0, intensity: 0, speed: 0 };
      }
      const fx = (lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west) * (GRID_W - 1);
      const fy = (lat - BOUNDS.south) / (BOUNDS.north - BOUNDS.south) * (GRID_H - 1);
      const i0 = Math.floor(fx), j0 = Math.floor(fy);
      const i1 = Math.min(i0 + 1, GRID_W - 1);
      const j1 = Math.min(j0 + 1, GRID_H - 1);
      const dx = fx - i0, dy = fy - j0;

      const sample = (i, j) => {
        const idx = (j * GRID_W + i) * 4;
        return [gridData.data[idx], gridData.data[idx + 1], gridData.data[idx + 2]];
      };
      const [au, av, asp] = sample(i0, j0);
      const [bu, bv, bsp] = sample(i1, j0);
      const [cu, cv, csp] = sample(i0, j1);
      const [du, dv, dsp] = sample(i1, j1);

      const tu = au * (1 - dx) + bu * dx;
      const tv = av * (1 - dx) + bv * dx;
      const ts = asp * (1 - dx) + bsp * dx;
      const xu = cu * (1 - dx) + du * dx;
      const xv = cv * (1 - dx) + dv * dx;
      const xs = csp * (1 - dx) + dsp * dx;

      const speed = ts * (1 - dy) + xs * dy;
      const intensity = Math.min(1, speed / 25);  // 25 m/s ~ 56 mph = max heat
      return {
        u: tu * (1 - dy) + xu * dy,
        v: tv * (1 - dy) + xv * dy,
        intensity,
        speed,
      };
    },

    render(gl, matrix) {
      // Step every particle
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = this.particles[i * 2 + 0];
        const y = this.particles[i * 2 + 1];
        const wind = this.sampleWind(x, y);

        // Mercator y is inverted vs latitude (north = smaller y), so flip v.
        const dx = wind.u * PARTICLE_SPEED_MULT;
        const dy = -wind.v * PARTICLE_SPEED_MULT;
        this.particles[i * 2 + 0] = x + dx;
        this.particles[i * 2 + 1] = y + dy;
        this.intensities[i] = wind.intensity;

        this.ages[i] += 1 / PARTICLE_LIFE;
        if (this.ages[i] >= 1 || wind.speed < 0.05) {
          this.respawn(i);
        }
      }

      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.uMatrix, false, matrix);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.particles, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.ageBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.ages, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aAge);
      gl.vertexAttribPointer(this.aAge, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.intensityBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.intensities, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aIntensity);
      gl.vertexAttribPointer(this.aIntensity, 1, gl.FLOAT, false, 0, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);  // additive — bright streaks build
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);

      // Keep the animation going even when the camera is idle
      this.map.triggerRepaint();
    },

    onRemove(_map, gl) {
      if (this.program) gl.deleteProgram(this.program);
      if (this.posBuffer) gl.deleteBuffer(this.posBuffer);
      if (this.ageBuffer) gl.deleteBuffer(this.ageBuffer);
      if (this.intensityBuffer) gl.deleteBuffer(this.intensityBuffer);
    },
  };
}

export default function MunroWindMap({ onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [maxSpeedMs, setMaxSpeedMs] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-4.2, 57.0],
      zoom: 6.2,
      minZoom: 5,
      maxZoom: 11,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', async () => {
      try {
        const grid = await fetchWindGrid();
        setMaxSpeedMs(grid.maxSpeed);
        const layer = makeWindParticleLayer(grid);
        map.addLayer(layer);
        setStatus('ready');
      } catch (err) {
        console.error('[Wind] failed', err);
        setStatus('error');
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const peakMph = Math.round(maxSpeedMs * 2.237);

  return (
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title">
          <div className="map-eyebrow">Live Wind Field</div>
          <div className="map-subtitle">
            {status === 'loading' && 'Sampling wind across Scotland…'}
            {status === 'ready' && (peakMph > 0 ? `Live · peak ${peakMph} mph` : 'Live · particles flow with the wind')}
            {status === 'error' && 'Could not load wind data'}
          </div>
        </div>
        <button className="map-close" onClick={onClose} aria-label="Close map">✕</button>
      </div>

      <div ref={containerRef} className="tile-map-viewport">
        <div className="wind-field-legend">
          <div className="wind-field-legend-title">Wind</div>
          <div className="wind-field-legend-bar" />
          <div className="wind-field-legend-row">
            <span>Calm</span>
            <span>Strong</span>
          </div>
        </div>

        {status === 'loading' && (
          <div className="wind-progress-chip" role="status" aria-live="polite">
            <div className="wind-progress-spinner" />
            <span className="wind-progress-text">Loading wind…</span>
          </div>
        )}
      </div>
    </div>
  );
}
