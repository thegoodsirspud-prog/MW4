/**
 * WMO Weather Interpretation Codes (World Meteorological Organisation)
 * Used by Open-Meteo's `weather_code` field.
 *
 * Each entry provides:
 *   label — human-readable name
 *   type  — sky animation category ('clear', 'cloudy', 'rain', 'snow', 'storm', 'fog')
 *   ds    — "danger score" for the mountain risk model (0–90)
 */
export const WMO_CODES = {
  0:  { label: 'Clear Sky',          type: 'clear',  ds: 0  },
  1:  { label: 'Mainly Clear',       type: 'clear',  ds: 0  },
  2:  { label: 'Partly Cloudy',      type: 'cloudy', ds: 5  },
  3:  { label: 'Overcast',           type: 'cloudy', ds: 10 },
  45: { label: 'Fog',                type: 'fog',    ds: 30 },
  48: { label: 'Icy Fog',            type: 'fog',    ds: 40 },
  51: { label: 'Light Drizzle',      type: 'rain',   ds: 10 },
  53: { label: 'Drizzle',            type: 'rain',   ds: 15 },
  55: { label: 'Heavy Drizzle',      type: 'rain',   ds: 20 },
  61: { label: 'Light Rain',         type: 'rain',   ds: 20 },
  63: { label: 'Rain',               type: 'rain',   ds: 30 },
  65: { label: 'Heavy Rain',         type: 'rain',   ds: 35 },
  71: { label: 'Light Snow',         type: 'snow',   ds: 35 },
  73: { label: 'Snow',               type: 'snow',   ds: 45 },
  75: { label: 'Heavy Snow',         type: 'snow',   ds: 55 },
  77: { label: 'Snow Grains',        type: 'snow',   ds: 30 },
  80: { label: 'Rain Showers',       type: 'rain',   ds: 20 },
  81: { label: 'Showers',            type: 'rain',   ds: 30 },
  82: { label: 'Heavy Showers',      type: 'storm',  ds: 40 },
  85: { label: 'Snow Showers',       type: 'snow',   ds: 40 },
  86: { label: 'Heavy Snow Showers', type: 'snow',   ds: 50 },
  95: { label: 'Thunderstorm',       type: 'storm',  ds: 70 },
  96: { label: 'Thunderstorm + Hail', type: 'storm', ds: 80 },
  99: { label: 'Severe Thunderstorm', type: 'storm', ds: 90 },
};

export function lookupWMO(code) {
  return WMO_CODES[code] || { label: 'Unknown', type: 'cloudy', ds: 0 };
}
