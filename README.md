# SoilSight
SoilSight is an interactive web dashboard for visualizing and analyzing microplastic contamination in soil samples. The app focuses on exploring sample sites, microplastic counts and types, and temporal trends with map-based and chart visualizations.

## Features
- **Interactive Mapping:** Explore sampling locations with contamination levels visualized on a Leaflet map.
- **Smart Filtering:** Filter by microplastic type, counts, and site metadata.
- **Dynamic Charts:** Interactive charts (ApexCharts) for trends and distributions.
- **Responsive UI:** Built with Vuetify for desktop and mobile support.
- **Demo Data Included:** Comes with sample data so you can run the app without a backend.

## Technology Stack
- **Frontend:** Vue 3, Vite, Vuetify, Pinia, Vue Router
- **Visualization:** Leaflet, ApexCharts
- **Backend (optional):** Directus headless CMS / API

## Quick Start
Prerequisites: Node.js (16+ recommended) and `pnpm` (preferred). You can use `npm` or `yarn`, but `pnpm` is recommended because the repository contains a `pnpm-lock.yaml` file.

1. Install dependencies

```powershell
pnpm install
```

2. Add environment variables (optional)

Create a `.env` file in the project root (see `.env.example`) to point the app to a Directus instance:

```
DIRECTUS_URL=http://your-directus-instance.example.com
DIRECTUS_TOKEN=your_static_token
```

3. Run the dev server

```powershell
pnpm dev
```

4. Build / Preview

```powershell
pnpm build
pnpm preview
```

5. Lint (optional)

```powershell
pnpm run lint
```

## Data & Backend
- Demo/sample data: `src/assets/dummyData.json` (used by the app when Directus is not configured).
- GeoJSON boundary example: `src/assets/geojson/Tayabas.geojson`.
- Backend (optional): The project uses `@directus/sdk` in `src/composables/useDirectus.js`. Set `DIRECTUS_URL` and `DIRECTUS_TOKEN` to connect to a Directus API via the server-side proxy.

## Project Layout (high-level)
- `src/` — application source code
	- `components/` — Vue components (map, charts, cards)
	- `pages/` — page views (index, insight/farm pages)
	- `composables/` — composable utilities (`useDirectus`, chart helpers)
	- `assets/` — demo data and geojson
- `server/` — simple server assets and `uploads/` (if required)
- `vite.config.mjs`, `package.json` — build and dev scripts

## Development Notes
- The app will attempt to load `src/assets/dummyData.json` for markers and demo content. When a Directus API is configured via environment variables, some pages/components will fetch data from Directus instead.
- Environment variables are read using `import.meta.env.VITE_*` (see `src/composables/useDirectus.js`).

## Contributing
- Fork the repo, create a topic branch, and open a PR describing your changes. Keep changes focused and include screenshots for UI work.

## License
No license is specified in this repository. If you want to make this project open source, add a `LICENSE` file (for example, an MIT license).

---