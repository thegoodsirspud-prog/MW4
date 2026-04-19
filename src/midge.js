/**
 * Highland Midge Activity Model
 * Scientific basis: APS Biocontrol (makers of Smidge) research and
 * Scottish Midge Forecast (est. 2008) methodology.
 *
 * The Culicoides impunctatus (Highland Midge) is active from late April
 * through to October, with peak swarming in July–August. This model
 * weighs five environmental factors to predict activity level 1–5:
 *
 *   Wind          (30%) — the strongest suppressor.
 *                         Above ~6 mph midges struggle to fly.
 *   Temperature   (20%) — peak activity 12–18°C.
 *                         Below 9°C or above 22°C: reduced.
 *   Humidity      (20%) — high humidity (>75%) favours activity.
 *                         Drier air suppresses them.
 *   Time of day   (15%) — peak at dawn (5–8am) and dusk (6–10pm).
 *                         Midday is the calmest window.
 *   Season        (15%) — Jul–Aug = 100%, Apr/Sep shoulder, May/Jun rising.
 *                         Nov–Mar = dormant (hard-coded to level 1).
 *
 * Levels (1–5):
 *   1 Very Low    green   — "No nuisance expected"
 *   2 Low         lime    — "Repellent advisable"
 *   3 Moderate    yellow  — "Noticeable, use repellent"
 *   4 High        orange  — "Strong repellent & head net"
 *   5 Severe      red     — "Avoid sheltered glens at dawn/dusk"
 */

export const MIDGE_LABELS = ['', 'Very Low', 'Low', 'Moderate', 'High', 'Severe'];
// Midge scale in blues: light sky → deep navy.
// Chosen to stay readable against the hero's dark sky AND to be clearly
// distinct from the mountain-safety scale (which is green→red).
// Each step shifts hue and lightness so adjacent levels are distinguishable.
export const MIDGE_COLORS = ['', '#7dd3fc', '#38bdf8', '#0284c7', '#1e40af', '#1e1b4b'];
export const MIDGE_DESCRIPTIONS = [
  '',
  'Minimal midge activity expected',
  'Some midges possible — repellent advisable',
  'Noticeable midge activity — use repellent',
  'Heavy midge activity — strong repellent and head net recommended',
  'Extreme midge conditions — avoid sheltered glens at dawn and dusk',
];

// Seasonal weight by month (0 = Jan, 11 = Dec)
const SEASON_WEIGHTS = [0, 0, 0, 0.15, 0.4, 0.7, 0.95, 1.0, 0.6, 0.2, 0, 0];

export function calcMidge(wx, hour) {
  const month = new Date().getMonth();
  const isDormant = month < 3 || month > 9;

  // Off-season: always level 1
  if (isDormant) {
    return dormantResult('Outside midge season (Nov–Mar)');
  }

  if (!wx) {
    return dormantResult('Awaiting weather data...');
  }

  const temp = wx.temperature_2m ?? 10;
  const wind = wx.wind_speed_10m ?? 0;
  const humidity = wx.relative_humidity_2m ?? 60;
  const hr = hour ?? new Date().getHours();

  // Time-of-day factor (0–1)
  const timeFactor =
    hr >= 5 && hr <= 8  ? 1.0 :  // Dawn peak
    hr >= 18 && hr <= 22 ? 0.9 : // Dusk peak
    hr >= 9 && hr <= 11  ? 0.5 :
    hr >= 16 && hr <= 17 ? 0.6 :
    hr >= 12 && hr <= 15 ? 0.2 : // Midday low
                           0.05;  // Deep night

  // Wind factor — the dominant suppressor
  const windFactor =
    wind > 12 ? 0.0  :
    wind > 8  ? 0.05 :
    wind > 6  ? 0.15 :
    wind > 4  ? 0.4  :
    wind > 2  ? 0.7  :
                1.0;

  // Temperature factor — peak 12–18°C
  const tempFactor =
    (temp >= 12 && temp <= 18) ? 1.0 :
    (temp >= 9  && temp <= 22) ? 0.6 :
    (temp >= 5  && temp <= 25) ? 0.25 :
                                 0.0;

  // Humidity factor
  const humidityFactor =
    humidity > 85 ? 1.0 :
    humidity > 75 ? 0.8 :
    humidity > 65 ? 0.5 :
    humidity > 50 ? 0.2 :
                    0.05;

  const seasonFactor = SEASON_WEIGHTS[month] ?? 0;

  // Weighted composite score (0–1)
  const raw =
    windFactor     * 0.30 +
    tempFactor     * 0.20 +
    humidityFactor * 0.20 +
    seasonFactor   * 0.15 +
    timeFactor     * 0.15;

  const level =
    raw > 0.65 ? 5 :
    raw > 0.45 ? 4 :
    raw > 0.25 ? 3 :
    raw > 0.08 ? 2 : 1;

  const timeLabel =
    hr >= 5 && hr <= 8   ? 'Dawn — peak swarm window' :
    hr >= 18 && hr <= 22 ? 'Dusk — peak swarm window' :
    hr >= 12 && hr <= 15 ? 'Midday — lowest activity' :
                           'Moderate activity hours';

  const seasonLabel =
    month >= 6 && month <= 7 ? 'Peak season (Jul–Aug)' :
    month >= 3 && month <= 9 ? 'Active season (Apr–Oct)' :
                               'Dormant (Nov–Mar)';

  return {
    level,
    label: MIDGE_LABELS[level],
    desc: MIDGE_DESCRIPTIONS[level],
    color: MIDGE_COLORS[level],
    score: Math.round(raw * 100),
    factors: [
      {
        label: 'Wind',
        desc: wind > 6 ? `${Math.round(wind)} mph suppresses midges` : `${Math.round(wind)} mph — midges can fly`,
        pct: Math.max(0, 100 - wind * 8),
      },
      {
        label: 'Temperature',
        desc: (temp >= 12 && temp <= 18)
          ? `${Math.round(temp)}°C — peak range`
          : `${Math.round(temp)}°C — outside peak`,
        pct: Math.round(tempFactor * 100),
      },
      {
        label: 'Humidity',
        desc: humidity > 70 ? `${Math.round(humidity)}% — favours activity` : `${Math.round(humidity)}% — suppressing`,
        pct: Math.round(humidityFactor * 100),
      },
      { label: 'Time of day', desc: timeLabel, pct: Math.round(timeFactor * 100) },
      { label: 'Season',      desc: seasonLabel, pct: Math.round(seasonFactor * 100) },
    ],
  };
}

function dormantResult(reason) {
  return {
    level: 1,
    label: MIDGE_LABELS[1],
    desc: reason,
    color: MIDGE_COLORS[1],
    score: 0,
    factors: [],
    dormant: true,
  };
}
