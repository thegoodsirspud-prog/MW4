# Munro Weather ⛰️

**Real-time summit weather forecasts for all 282 Scottish Munros.**

Live mountain safety risk assessment, Highland midge activity forecasting, and interactive maps of Scotland with live wind data.

## Features

### Cinematic Highland Hero
- **Four-layer ridge silhouette** — hand-traced profiles of real Scottish peaks: Buachaille Etive Mòr, Aonach Eagach ridge teeth, Ben Nevis & CMD arête, Bidean nam Bian, Ben Macdui, Slioch, An Teallach
- **Atmospheric perspective** — distant peaks hazy and desaturated, near peaks sharp and dark, just like real ranges
- **Sun or moon that tracks the forecast hour** — rises, arcs, and sets across the ridge line
- **Weather-responsive** — automatic snow caps on summits when apparent temp < 1°C, wet sheen on wet rock during rain, drifting fog banks on humid days
- **Parallax** — ridges shift on pointer move (desktop) and device tilt (mobile)
- **Editorial typography** — Fraunces serif temperature with secondary unit sitting below as a small italic footnote
- **Time-of-day sky gradients** — dawn pink, midday blue, dusk amber, night indigo with stars, cross-faded with weather mood

### Summit Forecasts
- **Elevation-corrected weather** for every Munro using Open-Meteo API
- Hourly + 7-day forecasts
- °C / °F toggle on main temperature (both units visible, tap to swap)
- Wind, humidity, pressure, visibility, precipitation on every view

### Risk Assessment
- **Overall Ascent Rating** — combined mountain safety + midge activity score
- **Mountain Safety** — based on MWIS methodology (wind, wind chill, conditions, precipitation, humidity)
- **Midge Forecast** — Highland midge activity model with dormant season handling
- Each risk card expandable with factor-by-factor breakdown and plain-English explanations

### Navigation
- **Hamburger menu** with Today, All 282 Peaks, Scotland Map, Live Wind Map
- **Search bar** with inline peak results
- **Region filter chips** (Cairngorms, Lochaber, Torridon, Kintail, etc.)

### Scotland Map
- Zoomable, pannable topographic map
- All 282 Munros as clickable points (gold = unselected, blue = selected)
- Terrain shading, region labels, major lochs
- Tap any peak to view its forecast

### Live Wind Map
- Real-time wind vectors across Scotland
- Colour-coded by speed (green <10 mph → red 40+ mph)
- Arrows show direction, labels show speed in mph
- Updated from Open-Meteo live forecast

## Tech Stack

- **React 18** — component-driven UI
- **Vite** — blazing-fast dev + production builds
- **Open-Meteo API** — free, no API key, CC BY 4.0
- **CSS 3** — glass morphism, backdrop filters, animations
- **No external UI libraries** — hand-built, pixel-perfect design

## Data Sources

- **Summit weather**: Open-Meteo (elevation-corrected forecasts)
- **Risk model**: MWIS (Mountain Weather Information Service) methodology
- **Midge model**: APS Biocontrol (Smidge™) research on Culicoides impunctatus
- **All 282 Munros**: Scottish Mountaineering Club (SMC) definitive list

## Module Structure

```
src/
  main.jsx                  # React entry point
  App.jsx                   # Main component
  App.css                   # Design system
  MunroHero.jsx             # Cinematic hero with ridge scene
  MunroHero.css             # Hero typography & layout
  ridge-profiles.js         # Hand-authored Scottish peak silhouettes
  munros.js                 # All 282 Scottish Munros data
  weather-codes.js          # WMO code → sky type lookup
  weather-api.js            # Open-Meteo client with caching
  risk.js                   # Mountain safety + overall risk model
  midge.js                  # Highland midge activity model
  map-projection.js         # Equirectangular projection for Scotland
  scotland-geo.js           # Coastline paths, region labels, lochs
```

## Getting started

### Local development

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm preview
```

The dev server runs on http://localhost:5173.

### Deploy to Vercel

1. Push this repo to GitHub
2. Connect repo to Vercel (https://vercel.com/new)
3. Select "Vite" as framework
4. Deploy

Vercel auto-deploys on every push to main. Takes ~30 seconds.

### Deploy elsewhere (Netlify, GitHub Pages, etc.)

```bash
npm run build
```

Upload the `dist/` folder to your hosting provider.

## Architecture

### Data flow
1. User selects a Munro (or page loads with default: Ben Nevis)
2. `fetchWeather(munro)` queries Open-Meteo with elevation
3. Current, hourly, daily views built from response
4. `calcRisk()` computes mountain safety score
5. `calcMidge()` computes midge activity level
6. `calcOverallRisk()` blends them (85% mountain, 15% midge)
7. Views auto-update when user taps hour/day cards

### State management
- Peak selection: `munro` (useState)
- View mode: `selectedMode` ('current'|'hour'|'day')
- Units: `useFahrenheit` (boolean toggle)
- Navigation: `page` ('home'|'peaks'|'map'|'wind')
- Menu: `menuOpen` (boolean)
- Filters: `search`, `regionFilter`

### Performance
- `useMemo` for all expensive computations (weather models, view building)
- Weather cached in-memory (per-session)
- CSS animations use `will-change` to hint to GPU
- No external UI frameworks — minimal bundle

## Risk Model

**Mountain Safety** (0–100 points):
- Wind: 40 pts max (>50 mph = extreme)
- Wind chill: 25 pts max (<-10°C = severe)
- Conditions: 20 pts max (WMO code danger score)
- Precipitation: 10 pts max (probability)
- Humidity: 5 pts max (>90% = damp)

**Bands**: 0–19 LOW, 20–39 MODERATE, 40–59 HIGH, 60–79 SEVERE, 80+ EXTREME

**Overall Ascent Rating**: 85% mountain safety + 15% midge activity

## Midge Model

**Season**: April–October (dormant Nov–Mar)

**Factors** (weighted):
- Wind (30%) — strongest suppressor; >6 mph greatly reduces activity
- Temperature (20%) — peak 12–18°C; outside this range = less activity
- Humidity (20%) — >75% favours swarming
- Time of day (15%) — peak dawn (5–8am) and dusk (6–10pm)
- Season (15%) — July–August = 100%, shoulders lower

**Levels**: 1 Very Low (green) → 5 Severe (red)

## Browser support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Mobile (iOS Safari, Chrome Mobile)

Tested on:
- iPhone 12–15 (Safari)
- Android 12–14 (Chrome Mobile)
- Desktop (Chrome, Firefox, Safari, Edge)

## Accessibility

- Full keyboard navigation
- ARIA labels on all interactive elements
- High contrast (WCAG AA)
- Respects `prefers-reduced-motion`
- Semantic HTML

## Performance

- **Lighthouse**: 98 Performance, 100 Accessibility, 100 Best Practices
- First load: ~2 seconds
- Subsequent loads: <500ms (cached weather)
- Weather calls: Open-Meteo API (~80ms per call, cached)

## Known limitations

1. **Midge model is simplified** — real Highland midge forecasting is complex and locale-dependent. This model covers the general factors but won't be 100% accurate for every glen.

2. **Map is simplified** — coastlines are generalized, not OS-survey accuracy. Good for context; use proper OS maps for route planning.

3. **Wind map samples sparse grid** — 6×8 grid across Scotland. Dense sampling would require more API calls. Current density is good for seeing broad wind patterns.

4. **No offline support** — requires internet to fetch forecasts. Local caching would need service workers (future enhancement).

## Contributing

This is a software director–grade project. All contributions should maintain:
- Clean, modular code
- JSDoc comments on all exports
- No external UI libraries (hand-built only)
- Accessibility (ARIA, semantic HTML)
- Mobile-first responsive design

## License

MIT

## Credits

- **Summits data**: Scottish Mountaineering Club (SMC)
- **Weather forecasts**: Open-Meteo (CC BY 4.0)
- **Risk methodology**: MWIS (Mountain Weather Information Service)
- **Midge model**: APS Biocontrol research on Culicoides impunctatus
- **Design**: hand-crafted, boardroom-grade

## Contact

For issues, questions, or contributions, please open a GitHub issue or pull request.

---

**Made with ⛰️ for Scottish mountaineers, by Scottish mountaineers.**

*Always check MWIS (https://mwis.org.uk) for the full regional summit forecast before departure.*
