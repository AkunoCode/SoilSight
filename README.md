# SoilSight

SoilSight is an interactive web dashboard for visualizing and analyzing microplastic contamination in soil samples. The app enables researchers and analysts to explore sampling sites, understand microplastic composition and distribution, track temporal trends, and identify contamination patterns through interactive maps and dynamic visualizations.

## Features

- **Interactive Mapping:** Explore sampling locations on a Leaflet map with markers color-coded by microplastic contamination levels and composition.
- **Site Analytics:** View detailed KPIs (key performance indicators) for each site including total microplastic counts, type distributions, and temporal trends.
- **Dynamic Charts:** Interactive ApexCharts visualizations including:
  - Temporal trends (microplastics over time)
  - Distribution analysis (by type, size, color)
  - Heatmaps for categorical relationships
  - Grouped/stacked views for comparative analysis
- **Smart Filtering:** Filter and explore data by microplastic type, count ranges, site attributes, and date ranges.
- **Responsive UI:** Built with Vuetify 3 for desktop and mobile support (desktop optimized).
- **Demo Data Included:** Comes with sample soil contamination data so you can run the app without a backend.
- **Directus Integration (Optional):** Connect to a Directus headless CMS for live data or seamlessly use included demo data.

## Technology Stack
- **Frontend:** Vue 3, Vite, Vuetify, Pinia, Vue Router
- **Visualization:** Leaflet, ApexCharts
- **Backend (optional):** Directus headless CMS / API

## Quick Start

**Prerequisites:** Node.js (16+ recommended) and `pnpm`. The repository uses `pnpm-lock.yaml`, so `pnpm` is strongly recommended (you can use `npm` or `yarn`, but lock file consistency may be affected).

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment (Optional)

Create a `.env` file in the project root (see `.env.example`):

```bash
# Optional: Connect to a Directus instance (uses demo data if not configured)
DIRECTUS_URL=http://your-directus-instance.example.com
DIRECTUS_TOKEN=your_static_token

# Set this if deploying to a sub-path (e.g., GitHub Pages)
VITE_BASE_PATH=/SoilSight/
```

If `.env` is blank or missing, the app will use demo data from `src/assets/dummyData.json`.

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Tests (Optional but Recommended)

```bash
# Run all tests once
pnpm test

# Or watch mode for development
pnpm test:watch
```

### 5. Lint Code

```bash
pnpm lint
```

### 6. Build for Production

```bash
pnpm build      # Build to dist/
pnpm preview    # Preview the production build locally
pnpm deploy     # Deploy to GitHub Pages (requires git remote)
```

## Data & Backend

### Demo Data
- **Location:** `src/assets/dummyData.json`
- **Used when:** `DIRECTUS_URL` is not configured or `.env` is empty
- **Structure:** Contains sample sites, soil samples, and microplastic measurements

### Live Data (Optional)
The app can connect to a **Directus headless CMS** for live data:
1. Set `DIRECTUS_URL` and `DIRECTUS_TOKEN` in `.env`
2. The app automatically fetches data via `useInsightData.js` composable
3. A server-side proxy (`/api/directus`) handles authentication securely — tokens never reach the browser

### GeoJSON
- **Location:** `src/assets/geojson/Tayabas.geojson`
- **Purpose:** Example boundary layer for map visualization

### Data Schema
The app expects the following data structure (whether from demo data or Directus):
- **Sites:** Sampling locations with metadata (coordinates, name, etc.)
- **Samples:** Soil samples collected from sites with dates
- **Microplastics:** Individual microplastic observations per sample (type, size, color, count)

## Project Structure

```
src/
├── pages/              File-based routing (auto-generates routes from .vue files)
│   ├── index.vue       Home page with map and markers
│   ├── insight/        Insight pages (data visualization)
│   │   ├── index.vue   Dashboard overview
│   │   └── [farm_name].vue  Individual farm/site details
│   └── mobile-warning.vue    Displayed on mobile devices
├── components/         Vue components
│   ├── graphs/         Chart components (trends, distributions, heatmaps)
│   ├── LeafletMap.vue  Interactive map
│   └── ...other UI components
├── composables/        Utility functions (logic & data management)
│   ├── useInsightData.js      Fetch and cache core data
│   ├── useInsightKPIs.js      Compute metrics (totals, averages, etc.)
│   ├── useInsightCharts.js    Transform data for charts
│   ├── useMapMarkers.js       Generate map markers
│   ├── useDirectus.js         Directus API client
│   └── ...other utilities
├── stores/             Pinia state management
├── layouts/            Page layouts (default.vue wraps all pages)
├── styles/             Global SCSS (Vuetify theme config)
├── assets/             Demo data (dummyData.json) & GeoJSON
├── plugins/            Vue plugin initialization
├── config/             Configuration files
└── main.js             App entry point
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/pages/` | Create new pages here (auto-routing) |
| `src/components/` | Reusable Vue components |
| `src/composables/` | Data fetching & business logic |
| `src/stores/` | Global state (Pinia) |
| `src/assets/` | Static files & demo data |

## Architecture Highlights

### Auto-Import System
- Components in `src/components/` are auto-imported (no explicit imports needed)
- Vue composables (`ref`, `computed`, `watch`) are auto-imported
- Pinia and Vue Router utilities are auto-imported
- See `vite.config.mjs` for auto-import configuration

### File-Based Routing
- Pages in `src/pages/` automatically become routes
- File structure determines URL structure:
  - `src/pages/index.vue` → `/`
  - `src/pages/insight/index.vue` → `/insight`
  - `src/pages/insight/[farm_name].vue` → `/insight/:farm_name`

### Data Flow
1. `useInsightData.js` fetches raw data (sites, samples, microplastics)
2. `useInsightKPIs.js` computes metrics from raw data
3. `useInsightCharts.js` transforms data into chart formats
4. `useMapMarkers.js` converts data into map visualizations
5. Components render the transformed data

### Environment Variables
- `DIRECTUS_URL` & `DIRECTUS_TOKEN` — Directus backend (server-side, never exposed to browser)
- `VITE_BASE_PATH` — Deployment path for GitHub Pages (default: `/`)
- Variables read via `import.meta.env.VITE_*`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Port 3000 already in use** | Change the port in `vite.config.mjs` under `server.port`, or kill the process using port 3000 |
| **Directus API returns 401/403** | Verify `DIRECTUS_TOKEN` is set in `.env` and correct; restart dev server after changing `.env` |
| **Charts not rendering** | Check browser console for errors; verify data structure matches expected format |
| **Map not showing** | Ensure Leaflet CSS is loaded; check `src/styles/settings.scss` for Vuetify theme issues |
| **Auto-import not working** | Run `pnpm dev` or `pnpm lint` to regenerate `.eslintrc-auto-import.json`; restart dev server |
| **Tests failing** | Run `pnpm test` to see detailed error messages; check that demo data exists in `src/assets/dummyData.json` |
| **Mobile warning page shown on desktop** | Check `useMobileWarning.js` detection logic; may be overriding detection in dev tools |
| **Build fails** | Clear `node_modules` and `.pnpm` with `rm -rf node_modules .pnpm && pnpm install`; then `pnpm build` |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make focused changes and test thoroughly (`pnpm test:watch`)
4. Run `pnpm lint` to fix code style issues
5. Open a pull request with a clear description of changes
6. Include screenshots for UI changes

**Note:** This project uses `pnpm`, so please use `pnpm` instead of `npm` for consistency with the lock file.

## Development Tips

- **Use demo data during development:** Leave `.env` blank to use `src/assets/dummyData.json` (no Directus needed)
- **Watch mode testing:** `pnpm test:watch` runs tests automatically as you edit files
- **Hot reload:** All changes in `src/` are reflected instantly without restarting the dev server
- **Debugging:** Use browser DevTools and Vue DevTools extension (Vue 3 compatible)

## License

No license is currently specified. If you want to make this project open source, add a `LICENSE` file to the repository (e.g., MIT, Apache 2.0, or GPL).

---