# Quick Start

## Install & run locally

```bash
# Clone or download this repo
git clone https://github.com/YOUR_USERNAME/munro-weather.git
cd munro-weather

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173 in your browser.

## Deploy to Vercel (recommended)

### Option 1: Using Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Your app will be live in ~30 seconds.

### Option 2: Using Vercel web UI

1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Connect your GitHub account and select this repo
4. Click "Deploy"

Done. Vercel auto-deploys on every push to main.

## Deploy elsewhere

### Netlify

```bash
npm run build
# Upload the dist/ folder to Netlify (drag & drop)
```

### GitHub Pages

```bash
npm run build
# Push dist/ contents to gh-pages branch
```

### Your own server

```bash
npm run build
# Deploy dist/ folder to your web server
```

## Environment variables

None required. The app works out of the box.

(Open-Meteo API is free with no API key. No authentication needed.)

## Troubleshooting

### Port 5173 already in use

```bash
npm run dev -- --port 3000
```

### Build fails with "module not found"

Make sure all 10 files are in `src/`:
- App.jsx, App.css
- main.jsx
- munros.js, weather-codes.js, weather-api.js
- risk.js, midge.js
- map-projection.js, scotland-geo.js

### App is blank / console errors

Hard-refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).

Open the browser console (F12) and check for red errors.

## File structure

```
munro-weather/
  src/
    main.jsx              # Entry point
    App.jsx               # Main component
    App.css               # Styles
    [7 data modules]      # munros, risk, midge, map, etc.
  index.html              # Root HTML
  vite.config.js          # Vite config
  vercel.json             # Vercel config
  package.json            # Dependencies
  README.md               # Full documentation
```

## What's included

✅ All 282 Scottish Munros with coordinates
✅ Live weather from Open-Meteo (no API key needed)
✅ Mountain safety risk model (MWIS methodology)
✅ Highland midge activity forecasts
✅ Zoomable Scotland map with all peaks
✅ Live wind map (real-time)
✅ Hamburger navigation
✅ Search + region filters
✅ °C/°F temperature toggle
✅ Expandable risk cards with explanations
✅ Accessible (ARIA, keyboard nav)
✅ Mobile-responsive
✅ Production-optimized

## Next steps

1. ✅ Deploy (see above)
2. Check the live app — tap around, test the menus
3. Share with Scottish mountaineers
4. (Optional) customize colours / text in App.css

## Support

See README.md for full documentation, architecture details, and API references.
