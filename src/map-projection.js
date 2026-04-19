/**
 * Scotland Map Projection
 *
 * Uses a calibrated equirectangular (Plate Carrée) projection with latitude
 * correction to minimise distortion at Scottish latitudes (~56-59°N).
 * Scotland is narrow enough north-to-south that this gives good results
 * without the overhead of full Mercator or OSGB36 transform.
 *
 * Bounds (slightly padded so coastal Munros aren't on the edge):
 *   West:  -6.8°   (Outer Hebrides, Skye)
 *   East:  -2.4°   (Aberdeenshire / Cairngorms east edge)
 *   South: 55.95°  (Loch Lomond, Arrochar)
 *   North: 58.55°  (Ben Hope)
 *
 * The constant REF_LAT = 57.5° is the approximate centre of Scottish Munros,
 * used as the reference for horizontal scaling (cos(lat) correction).
 */

export const MAP_BOUNDS = {
  west: -6.8,
  east: -2.4,
  south: 55.95,
  north: 58.55,
};

const REF_LAT = 57.5;
const LAT_CORRECTION = Math.cos((REF_LAT * Math.PI) / 180);

/**
 * Project a (lat, lon) pair onto a normalised [0..1] coordinate pair.
 * (0,0) is top-left (NW corner), (1,1) is bottom-right (SE corner).
 */
export function projectLatLon(lat, lon) {
  const { west, east, south, north } = MAP_BOUNDS;
  const lonRange = (east - west) * LAT_CORRECTION;
  const x = ((lon - west) * LAT_CORRECTION) / lonRange;
  const y = (north - lat) / (north - south);
  return { x, y };
}

/**
 * Project a Munro to pixel coordinates given a viewport size.
 */
export function projectMunro(munro, width, height) {
  const { x, y } = projectLatLon(munro.lat, munro.lon);
  return { x: x * width, y: y * height };
}

/**
 * Inverse: pixel → lat/lon. Useful for click-to-coords.
 */
export function unprojectPixel(px, py, width, height) {
  const { west, east, south, north } = MAP_BOUNDS;
  const lonRange = (east - west) * LAT_CORRECTION;
  const nx = px / width;
  const ny = py / height;
  const lon = west + (nx * lonRange) / LAT_CORRECTION;
  const lat = north - ny * (north - south);
  return { lat, lon };
}
