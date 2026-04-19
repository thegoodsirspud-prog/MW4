/**
 * Scotland Geography
 *
 * Hand-simplified Scotland outline at a scale suitable for mountain app use.
 * Coordinates are normalised [0..1] matching map-projection.js output.
 *
 * Coverage: Scottish Highlands + Southern Uplands, plus main islands (Skye,
 * Mull, Lewis & Harris, Uists). Kept deliberately minimal — this is a
 * topographic reference, not a detailed OS map.
 *
 * Shielings (elevated regions) are suggested via a faint terrain-green fill
 * modulated by the MUNRO_DENSITY overlay computed from Munro positions.
 */

/**
 * Returns normalised path data for the Scottish mainland coastline.
 * Each entry is an SVG path `d` string with coords in [0..1].
 * Scale up by viewport (w, h) when rendering.
 */
export function scotlandOutlinePath(w, h) {
  // Simplified outline — Kintyre/Mull of Galloway to Cape Wrath and back down
  // the east coast, generalised from OS 1:1M base map.
  const p = [
    // Start: SW — Mull of Galloway area (off the bottom)
    [0.42, 1.00],
    // West coast going north through Kintyre
    [0.38, 0.95], [0.32, 0.90], [0.28, 0.85], [0.30, 0.82],
    // Firth of Lorne inlet
    [0.25, 0.78], [0.22, 0.74], [0.20, 0.70],
    // Ardnamurchan peninsula (westernmost mainland point)
    [0.10, 0.62], [0.08, 0.60], [0.12, 0.56],
    // Knoydart / Kintail
    [0.16, 0.52], [0.12, 0.46], [0.08, 0.42],
    // Assynt / Coigach
    [0.18, 0.32], [0.14, 0.26], [0.10, 0.22],
    // Cape Wrath (north-west tip)
    [0.08, 0.14], [0.10, 0.08], [0.18, 0.06],
    // North coast
    [0.28, 0.05], [0.40, 0.06], [0.52, 0.08], [0.64, 0.06],
    // Dunnet Head (northeast)
    [0.74, 0.06], [0.80, 0.10],
    // East coast going south
    [0.82, 0.18], [0.84, 0.26], [0.86, 0.34], [0.88, 0.42],
    // Moray Firth inlet
    [0.80, 0.42], [0.78, 0.46], [0.84, 0.48],
    // Aberdeenshire
    [0.92, 0.52], [0.94, 0.60], [0.92, 0.66],
    // Tay/Forth/Firth of Forth
    [0.88, 0.72], [0.82, 0.74], [0.84, 0.78],
    [0.80, 0.82], [0.74, 0.84],
    // Southern Uplands
    [0.70, 0.88], [0.64, 0.92], [0.58, 0.96], [0.52, 1.00],
    // Close back to start
    [0.42, 1.00],
  ];
  return pointsToPath(p, w, h);
}

/**
 * Isle of Skye — simplified
 */
export function skyePath(w, h) {
  const p = [
    [0.12, 0.48], [0.10, 0.52], [0.06, 0.54], [0.04, 0.58],
    [0.06, 0.62], [0.10, 0.60], [0.08, 0.56], [0.12, 0.54],
    [0.14, 0.50], [0.12, 0.48],
  ];
  return pointsToPath(p, w, h);
}

/**
 * Isle of Mull — simplified
 */
export function mullPath(w, h) {
  const p = [
    [0.18, 0.72], [0.14, 0.74], [0.12, 0.76], [0.14, 0.78],
    [0.18, 0.78], [0.20, 0.76], [0.18, 0.72],
  ];
  return pointsToPath(p, w, h);
}

/**
 * Outer Hebrides — Lewis/Harris and Uists, very simplified
 */
export function hebridesPath(w, h) {
  const lewis = pointsToPath([
    [0.02, 0.28], [0.00, 0.32], [0.00, 0.42], [0.03, 0.46],
    [0.04, 0.42], [0.03, 0.34], [0.02, 0.28],
  ], w, h);
  const uist = pointsToPath([
    [0.00, 0.50], [0.00, 0.58], [0.02, 0.60], [0.02, 0.52], [0.00, 0.50],
  ], w, h);
  return lewis + ' ' + uist;
}

/**
 * Orkney — NE of mainland
 */
export function orkneyPath(w, h) {
  return pointsToPath([
    [0.88, 0.00], [0.84, 0.02], [0.86, 0.04], [0.90, 0.03], [0.88, 0.00],
  ], w, h);
}

function pointsToPath(pts, w, h) {
  if (!pts.length) return '';
  let d = `M ${(pts[0][0] * w).toFixed(1)} ${(pts[0][1] * h).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${(pts[i][0] * w).toFixed(1)} ${(pts[i][1] * h).toFixed(1)}`;
  }
  d += ' Z';
  return d;
}

/**
 * Major geographical labels for the map.
 * Coordinates in [lat, lon] — projected at render time.
 */
export const MAP_LABELS = [
  { label: 'CAIRNGORMS',     lat: 57.08, lon: -3.68, kind: 'region', size: 'lg' },
  { label: 'LOCHABER',        lat: 56.78, lon: -4.95, kind: 'region', size: 'md' },
  { label: 'TORRIDON',        lat: 57.55, lon: -5.45, kind: 'region', size: 'md' },
  { label: 'GLEN COE',        lat: 56.65, lon: -5.00, kind: 'region', size: 'sm' },
  { label: 'SKYE',            lat: 57.22, lon: -6.22, kind: 'region', size: 'md' },
  { label: 'KNOYDART',        lat: 57.05, lon: -5.55, kind: 'region', size: 'sm' },
  { label: 'KINTAIL',         lat: 57.18, lon: -5.30, kind: 'region', size: 'sm' },
  { label: 'BREADALBANE',     lat: 56.50, lon: -4.40, kind: 'region', size: 'sm' },
  { label: 'SUTHERLAND',      lat: 58.30, lon: -4.60, kind: 'region', size: 'sm' },
  { label: 'ROSS-SHIRE',      lat: 57.70, lon: -5.00, kind: 'region', size: 'sm' },
  { label: 'GLEN AFFRIC',     lat: 57.30, lon: -5.10, kind: 'region', size: 'xs' },
  { label: 'ATHOLL',          lat: 56.82, lon: -3.80, kind: 'region', size: 'xs' },
  { label: 'BADENOCH',        lat: 56.85, lon: -4.50, kind: 'region', size: 'xs' },
  { label: 'ARGYLL',          lat: 56.45, lon: -5.10, kind: 'region', size: 'xs' },
  { label: 'MONADHLIATH',     lat: 57.15, lon: -4.20, kind: 'region', size: 'xs' },
];

/**
 * Major lochs (just a visual flourish, not to scale)
 */
export const MAJOR_LOCHS = [
  { name: 'Loch Ness',    lat: 57.30, lon: -4.45 },
  { name: 'Loch Lomond',  lat: 56.15, lon: -4.60 },
  { name: 'Loch Awe',     lat: 56.40, lon: -5.20 },
  { name: 'Loch Shin',    lat: 58.10, lon: -4.50 },
  { name: 'Loch Maree',   lat: 57.70, lon: -5.40 },
  { name: 'Loch Tay',     lat: 56.52, lon: -4.15 },
  { name: 'Loch Ericht',  lat: 56.82, lon: -4.38 },
  { name: 'Loch Laggan',  lat: 56.92, lon: -4.55 },
];
