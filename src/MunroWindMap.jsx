import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MunroWindMap — flowing tapered particles, Windy.com aesthetic
 *
 * v3 — proper ping-pong framebuffers.
 *
 * v2's fade pass tried to read from and write to the same texture in
 * the same frame (WebGL undefined behaviour → effectively a no-op on
 * most GPUs). The screen filled with permanent streaks.
 *
 * v3 fixes this with ping-pong rendering:
 *   - Two framebuffers/textures, A and B, both viewport-sized
 *   - Each frame: bind B, draw A faded onto B, then draw new particle
 *     segments on top of B, then blit B to screen, then swap A↔B
 *   - Next frame: B becomes A, fresh B gets faded + drawn, etc.
 *
 * This is the textbook GPGPU ping-pong pattern. With it, the fade pass
 * actually dims pixels over time and trails decay gracefully.
 *
 * Each particle is drawn as a 2-vertex LINE with a taper:
 *   - Head (current position) alpha = 1
 *   - Tail (previous position) alpha = 0.3
 * Gives every streak a direction cue — like a comet — without being
 * a literal arrow shape. Reads as "moving in this direction".
 */

const BOUNDS = { west: -7.8, east: -1.5, south: 55.5, north: 59.0 };
const GRID_W = 16;
const GRID_H = 12;

// Calmer still than v2. 4000 particles at 0.00022 mercator units/frame
// at 60fps = roughly 6 pixels/second at zoom 6 — matches Windy's pace.
const PARTICLE_COUNT       = 4000;
const PARTICLE_LIFE_FRAMES = 150;
const PARTICLE_SPEED_MULT  = 0.00022;
// Fade is applied by multiplying the previous frame's alpha. 0.985 ≈
// trails visible for ~70 frames (>1 second) before dimming to near-zero.
const FADE_MULTIPLIER      = 0.985;
const DATA_CACHE_MS        = 15 * 60 * 1000;

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
      // Meteorological dir = FROM direction. Flow vector points the other way.
      const angle = ((dir + 180) % 360) * Math.PI / 180;
      return {
        i: p.i, j: p.j,
        u: Math.sin(angle) * speed,   // east m/s
        v: Math.cos(angle) * speed,   // north m/s
        speed,
      };
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

      // Trail shader — draws each particle as a tapered line (bright head,
      // faint tail). a_alpha is per-vertex so the taper is built in.
      this.trailProgram = linkProgram(gl, `
        attribute vec2 a_pos;
        attribute float a_intensity;
        attribute float a_alpha;
        uniform mat4 u_matrix;
        varying float v_intensity;
        varying float v_alpha;
        void main() {
          gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
          v_intensity = a_intensity;
          v_alpha = a_alpha;
        }
      `, `
        precision mediump float;
        varying float v_intensity;
        varying float v_alpha;
        void main() {
          // Desaturated Windy palette: soft cyan to pale frost
          vec3 cool = vec3(0.55, 0.80, 0.95);
          vec3 warm = vec3(0.88, 0.95, 1.00);
          vec3 col  = mix(cool, warm, clamp(v_intensity, 0.0, 1.0));
          gl_FragColor = vec4(col, v_alpha);
        }
      `);
      this.tPos       = gl.getAttribLocation(this.trailProgram, 'a_pos');
      this.tIntensity = gl.getAttribLocation(this.trailProgram, 'a_intensity');
      this.tAlpha     = gl.getAttribLocation(this.trailProgram, 'a_alpha');
      this.tMatrix    = gl.getUniformLocation(this.trailProgram, 'u_matrix');

      // Screen-space blit shader — used both to fade the previous frame
      // into the new one (u_fade < 1.0) AND for the final blit to canvas
      // (u_fade = 1.0). Full-screen quad in clip space.
      this.screenProgram = linkProgram(gl, `
        attribute vec2 a_pos;
        varying vec2 v_uv;
        void main() {
          gl_Position = vec4(a_pos, 0.0, 1.0);
          v_uv = a_pos * 0.5 + 0.5;
        }
      `, `
        precision mediump float;
        uniform sampler2D u_tex;
        uniform float u_fade;
        varying vec2 v_uv;
        void main() {
          vec4 c = texture2D(u_tex, v_uv);
          gl_FragColor = vec4(c.rgb, c.a * u_fade);
        }
      `);
      this.sPos  = gl.getAttribLocation(this.screenProgram, 'a_pos');
      this.sTex  = gl.getUniformLocation(this.screenProgram, 'u_tex');
      this.sFade = gl.getUniformLocation(this.screenProgram, 'u_fade');

      // Full-screen quad (two triangles) in clip space
      this.quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1,
      ]), gl.STATIC_DRAW);

      // Particle data: two vertices per particle (prev=tail, current=head).
      // Each vertex has [x, y], an intensity, and an alpha (head=1, tail=0.3).
      // Stored in Mercator coords so MapLibre's u_matrix projects them correctly.
      this.lineVerts   = new Float32Array(PARTICLE_COUNT * 4);  // 2 verts × 2 coords
      this.intensities = new Float32Array(PARTICLE_COUNT * 2);  // per vertex
      this.alphas      = new Float32Array(PARTICLE_COUNT * 2);  // per vertex — taper
      this.pos         = new Float32Array(PARTICLE_COUNT * 2);  // logical position (head only)
      this.ages        = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        this.alphas[i * 2 + 0] = 0.3;  // tail
        this.alphas[i * 2 + 1] = 1.0;  // head
        this.respawn(i);
      }

      this.vertBuffer      = gl.createBuffer();
      this.intensityBuffer = gl.createBuffer();
      this.alphaBuffer     = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.alphaBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.alphas, gl.STATIC_DRAW);

      // Ping-pong framebuffers. Both allocated at viewport size.
      this.texA = gl.createTexture();
      this.texB = gl.createTexture();
      this.fbA  = gl.createFramebuffer();
      this.fbB  = gl.createFramebuffer();
      this.fbW  = 0;
      this.fbH  = 0;
      this.resizeIfNeeded(gl);
    },

    resizeIfNeeded(gl) {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      if (w === this.fbW && h === this.fbH) return;
      this.fbW = w;
      this.fbH = h;

      for (const [tex, fb] of [[this.texA, this.fbA], [this.texB, this.fbB]]) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    respawn(i) {
      const lon = BOUNDS.west + Math.random() * (BOUNDS.east - BOUNDS.west);
      const lat = BOUNDS.south + Math.random() * (BOUNDS.north - BOUNDS.south);
      const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat]);
      this.pos[i * 2 + 0] = merc.x;
      this.pos[i * 2 + 1] = merc.y;
      // Line starts with zero length so the tail is hidden until the
      // particle has moved for a frame or two.
      const v = i * 4;
      this.lineVerts[v + 0] = merc.x;
      this.lineVerts[v + 1] = merc.y;
      this.lineVerts[v + 2] = merc.x;
      this.lineVerts[v + 3] = merc.y;
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
      const s = (ii, jj) => {
        const idx = (jj * GRID_W + ii) * 4;
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
        intensity: Math.min(1, speed / 20),  // 20 m/s ~ 45 mph visual ceiling
        speed,
      };
    },

    render(gl, matrix) {
      this.resizeIfNeeded(gl);

      // ── CPU step: advance each particle along the wind field ──
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const pi = i * 2;
        const x = this.pos[pi + 0];
        const y = this.pos[pi + 1];
        const wind = this.sampleWind(x, y);

        // Mercator y inverted vs lat
        const nx = x + wind.u * PARTICLE_SPEED_MULT;
        const ny = y - wind.v * PARTICLE_SPEED_MULT;

        this.pos[pi + 0] = nx;
        this.pos[pi + 1] = ny;

        // Line verts: vertex 0 = tail (previous), vertex 1 = head (current)
        const v = i * 4;
        this.lineVerts[v + 0] = x;
        this.lineVerts[v + 1] = y;
        this.lineVerts[v + 2] = nx;
        this.lineVerts[v + 3] = ny;

        this.intensities[i * 2 + 0] = wind.intensity;
        this.intensities[i * 2 + 1] = wind.intensity;

        this.ages[i]++;
        if (this.ages[i] >= PARTICLE_LIFE_FRAMES || wind.speed < 0.05) {
          this.respawn(i);
        }
      }

      // ── PASS 1: into fbB — faded copy of A + fresh trails ──
      // Clear B, then draw A onto B with alpha dimmed by FADE_MULTIPLIER,
      // then draw fresh particle lines into B. A is the "previous frame".
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbB);
      gl.viewport(0, 0, this.fbW, this.fbH);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // A → B (faded)
      gl.useProgram(this.screenProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texA);
      gl.uniform1i(this.sTex, 0);
      gl.uniform1f(this.sFade, FADE_MULTIPLIER);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(this.sPos);
      gl.vertexAttribPointer(this.sPos, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.BLEND);  // overwrite — this is a fresh copy
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Fresh particle lines drawn ON TOP of the faded previous frame
      gl.useProgram(this.trailProgram);
      gl.uniformMatrix4fv(this.tMatrix, false, matrix);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.lineVerts, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.tPos);
      gl.vertexAttribPointer(this.tPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.intensityBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.intensities, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.tIntensity);
      gl.vertexAttribPointer(this.tIntensity, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.alphaBuffer);
      gl.enableVertexAttribArray(this.tAlpha);
      gl.vertexAttribPointer(this.tAlpha, 1, gl.FLOAT, false, 0, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.LINES, 0, PARTICLE_COUNT * 2);

      // ── PASS 2: blit B to the screen ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.fbW, this.fbH);
      gl.useProgram(this.screenProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texB);
      gl.uniform1i(this.sTex, 0);
      gl.uniform1f(this.sFade, 1.0);  // no fade on final blit
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(this.sPos);
      gl.vertexAttribPointer(this.sPos, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Ping-pong: swap A ↔ B for next frame
      [this.texA, this.texB] = [this.texB, this.texA];
      [this.fbA,  this.fbB ] = [this.fbB,  this.fbA ];

      this.map.triggerRepaint();
    },

    onRemove(_map, gl) {
      if (this.trailProgram)    gl.deleteProgram(this.trailProgram);
      if (this.screenProgram)   gl.deleteProgram(this.screenProgram);
      if (this.vertBuffer)      gl.deleteBuffer(this.vertBuffer);
      if (this.intensityBuffer) gl.deleteBuffer(this.intensityBuffer);
      if (this.alphaBuffer)     gl.deleteBuffer(this.alphaBuffer);
      if (this.quadBuffer)      gl.deleteBuffer(this.quadBuffer);
      if (this.texA) gl.deleteTexture(this.texA);
      if (this.texB) gl.deleteTexture(this.texB);
      if (this.fbA)  gl.deleteFramebuffer(this.fbA);
      if (this.fbB)  gl.deleteFramebuffer(this.fbB);
    },
  };
}

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
