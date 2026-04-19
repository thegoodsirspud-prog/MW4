import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MunroWindMap — flowing particle wind field, Windy.com aesthetic
 *
 * The trick Windy uses (and that my first attempt missed) is framebuffer
 * accumulation. Instead of drawing particles-as-dots every frame to the
 * screen, we draw into a persistent texture. Each frame:
 *
 *   1. Bind the accumulation framebuffer
 *   2. Draw a subtly-dark semi-transparent quad over it so old trails
 *      fade slightly (95-97% opacity = ~25 frame persistence)
 *   3. Draw particles as LINE segments from previous → current position
 *   4. Unbind; blit the accumulation texture to the screen
 *
 * Result: gentle flowing streaks instead of random dots. The map stays
 * calm and readable; wind has direction AND continuity.
 *
 * Everything else stays the same: 192-point wind grid sampled from
 * Open-Meteo, cached 15 min, bilinear interpolation, MapLibre
 * CustomLayer for seamless integration.
 */

const BOUNDS = { west: -7.8, east: -1.5, south: 55.5, north: 59.0 };
const GRID_W = 16;
const GRID_H = 12;

// Particle tuning — calmer than v1. Fewer particles, longer life, slower
// visual speed. Trail fade holds them on screen 25ish frames at 0.96
// which is ~0.4s of visible trail at 60fps — feels like flowing wind.
const PARTICLE_COUNT = 2500;
const PARTICLE_LIFE_FRAMES = 120;
const PARTICLE_SPEED_MULT = 0.00035;  // half the speed of v1
const FADE_ALPHA = 0.04;              // higher = shorter trails. 0.04 = long & gentle
const DATA_CACHE_MS = 15 * 60 * 1000;

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
      // Meteorological dir is the FROM direction; flow points the other way.
      const angle = ((dir + 180) % 360) * Math.PI / 180;
      const u = Math.sin(angle) * speed;  // east m/s
      const v = Math.cos(angle) * speed;  // north m/s
      return { i: p.i, j: p.j, u, v, speed };
    } catch {
      return { i: p.i, j: p.j, u: 0, v: 0, speed: 0 };
    }
  }));

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

function makeWindParticleLayer(gridData) {
  return {
    id: 'wind-particles',
    type: 'custom',
    renderingMode: '2d',

    onAdd(map, gl) {
      this.map = map;

      // ── Shader 1: draw particle trails (lines) ─────────────────────
      const trailVs = `
        attribute vec2 a_pos;
        attribute float a_intensity;
        uniform mat4 u_matrix;
        varying float v_intensity;
        void main() {
          gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
          v_intensity = a_intensity;
        }
      `;
      const trailFs = `
        precision mediump float;
        varying float v_intensity;
        void main() {
          // Cyan → pale white as intensity rises. Windy's calmer range.
          vec3 cool = vec3(0.55, 0.80, 0.95);   // soft cyan
          vec3 warm = vec3(0.90, 0.95, 1.00);   // pale white, never fully saturated
          vec3 col  = mix(cool, warm, clamp(v_intensity, 0.0, 1.0));
          gl_FragColor = vec4(col, 0.85);
        }
      `;
      this.trailProgram = linkProgram(gl, trailVs, trailFs);
      this.tPos       = gl.getAttribLocation(this.trailProgram, 'a_pos');
      this.tIntensity = gl.getAttribLocation(this.trailProgram, 'a_intensity');
      this.tMatrix    = gl.getUniformLocation(this.trailProgram, 'u_matrix');

      // ── Shader 2: fade-and-blit the accumulation texture ───────────
      const screenVs = `
        attribute vec2 a_pos;
        varying vec2 v_uv;
        void main() {
          gl_Position = vec4(a_pos, 0.0, 1.0);
          v_uv = a_pos * 0.5 + 0.5;
        }
      `;
      const screenFs = `
        precision mediump float;
        uniform sampler2D u_tex;
        uniform float u_fade;
        varying vec2 v_uv;
        void main() {
          vec4 c = texture2D(u_tex, v_uv);
          // Multiply alpha down each frame so old trails fade gracefully.
          gl_FragColor = vec4(c.rgb, c.a * (1.0 - u_fade));
        }
      `;
      this.screenProgram = linkProgram(gl, screenVs, screenFs);
      this.sPos   = gl.getAttribLocation(this.screenProgram, 'a_pos');
      this.sTex   = gl.getUniformLocation(this.screenProgram, 'u_tex');
      this.sFade  = gl.getUniformLocation(this.screenProgram, 'u_fade');

      // Full-screen quad for the blit pass
      this.quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1,
      ]), gl.STATIC_DRAW);

      // Particles live in Mercator coords (0..1 world space).
      // For line drawing we upload pairs (prev, current) per particle.
      this.particles = new Float32Array(PARTICLE_COUNT * 4);  // x, y, prevX, prevY
      this.intensities = new Float32Array(PARTICLE_COUNT * 2); // per-vertex
      this.ages = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) this.respawn(i);

      this.lineBuffer      = gl.createBuffer();
      this.intensityBuffer = gl.createBuffer();

      // Accumulation framebuffer — same size as the map viewport
      this.setupFramebuffer(gl);
      this.resizeIfNeeded(gl);
    },

    setupFramebuffer(gl) {
      this.accumTexture = gl.createTexture();
      this.accumFb = gl.createFramebuffer();
      this.fbW = 0;
      this.fbH = 0;
    },

    resizeIfNeeded(gl) {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      if (w === this.fbW && h === this.fbH) return;
      this.fbW = w;
      this.fbH = h;

      gl.bindTexture(gl.TEXTURE_2D, this.accumTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.accumFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.accumTexture, 0);
      // Clear fresh
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    respawn(i) {
      const lon = BOUNDS.west + Math.random() * (BOUNDS.east - BOUNDS.west);
      const lat = BOUNDS.south + Math.random() * (BOUNDS.north - BOUNDS.south);
      const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat]);
      this.particles[i * 4 + 0] = merc.x;
      this.particles[i * 4 + 1] = merc.y;
      this.particles[i * 4 + 2] = merc.x;
      this.particles[i * 4 + 3] = merc.y;
      this.ages[i] = Math.random() * PARTICLE_LIFE_FRAMES;
    },

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

      const s = (i, j) => {
        const idx = (j * GRID_W + i) * 4;
        return [gridData.data[idx], gridData.data[idx + 1], gridData.data[idx + 2]];
      };
      const [au, av, asp] = s(i0, j0);
      const [bu, bv, bsp] = s(i1, j0);
      const [cu, cv, csp] = s(i0, j1);
      const [du, dv, dsp] = s(i1, j1);
      const tu = au * (1 - dx) + bu * dx;
      const tv = av * (1 - dx) + bv * dx;
      const ts = asp * (1 - dx) + bsp * dx;
      const xu = cu * (1 - dx) + du * dx;
      const xv = cv * (1 - dx) + dv * dx;
      const xs = csp * (1 - dx) + dsp * dx;
      const speed = ts * (1 - dy) + xs * dy;
      return {
        u: tu * (1 - dy) + xu * dy,
        v: tv * (1 - dy) + xv * dy,
        intensity: Math.min(1, speed / 22),  // 22 m/s ~ 49 mph visual ceiling
        speed,
      };
    },

    render(gl, matrix) {
      this.resizeIfNeeded(gl);

      // Step particles in CPU — store prev, advance, update intensity, age.
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const pi = i * 4;
        const x = this.particles[pi + 0];
        const y = this.particles[pi + 1];
        this.particles[pi + 2] = x;
        this.particles[pi + 3] = y;
        const wind = this.sampleWind(x, y);
        // Mercator y is inverted vs lat (north = smaller y), so flip v.
        this.particles[pi + 0] = x + wind.u * PARTICLE_SPEED_MULT;
        this.particles[pi + 1] = y + (-wind.v) * PARTICLE_SPEED_MULT;
        // Intensity for both vertices of the line segment
        this.intensities[i * 2 + 0] = wind.intensity;
        this.intensities[i * 2 + 1] = wind.intensity;

        this.ages[i]++;
        if (this.ages[i] >= PARTICLE_LIFE_FRAMES || wind.speed < 0.05) {
          this.respawn(i);
        }
      }

      // ── PASS 1: draw faded previous frame + new trails into framebuffer ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.accumFb);
      gl.viewport(0, 0, this.fbW, this.fbH);

      // Fade the existing accumulation by drawing it to itself with reduced alpha
      gl.useProgram(this.screenProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.accumTexture);
      gl.uniform1i(this.sTex, 0);
      gl.uniform1f(this.sFade, FADE_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(this.sPos);
      gl.vertexAttribPointer(this.sPos, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.BLEND);  // overwrite — this IS the fade pass
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Now draw fresh particle lines on top of the faded previous frame
      gl.useProgram(this.trailProgram);
      gl.uniformMatrix4fv(this.tMatrix, false, matrix);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.particles, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.tPos);
      gl.vertexAttribPointer(this.tPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.intensityBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.intensities, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.tIntensity);
      gl.vertexAttribPointer(this.tIntensity, 1, gl.FLOAT, false, 0, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.LINES, 0, PARTICLE_COUNT * 2);

      // ── PASS 2: blit the accumulation to the screen ───────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.fbW, this.fbH);

      gl.useProgram(this.screenProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.accumTexture);
      gl.uniform1i(this.sTex, 0);
      gl.uniform1f(this.sFade, 0);  // no fade on the final blit
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(this.sPos);
      gl.vertexAttribPointer(this.sPos, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      this.map.triggerRepaint();
    },

    onRemove(_map, gl) {
      if (this.trailProgram) gl.deleteProgram(this.trailProgram);
      if (this.screenProgram) gl.deleteProgram(this.screenProgram);
      if (this.lineBuffer) gl.deleteBuffer(this.lineBuffer);
      if (this.intensityBuffer) gl.deleteBuffer(this.intensityBuffer);
      if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
      if (this.accumTexture) gl.deleteTexture(this.accumTexture);
      if (this.accumFb) gl.deleteFramebuffer(this.accumFb);
    },
  };
}

/** Compile + link a GL program. Logs errors but never throws. */
function linkProgram(gl, vsSrc, fsSrc) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSrc);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error('[Wind vs]', gl.getShaderInfoLog(vs));
  }
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error('[Wind fs]', gl.getShaderInfoLog(fs));
  }
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[Wind link]', gl.getProgramInfoLog(p));
  }
  return p;
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
        map.addLayer(makeWindParticleLayer(grid));
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
