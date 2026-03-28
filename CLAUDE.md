# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Dev server at http://localhost:4200/ with hot reload
npm run build    # Production build to dist/tina-gis/
npm run watch    # Development build in watch mode
npm test         # Unit tests via Karma/Jasmine
```

No lint command is configured in this project.

## Architecture

**TinaGis** is a standalone Angular 18 GIS application for Taiwan, featuring Google Maps integration with drawing tools for spatial selection and marker management.

### Key Design Patterns

- **Standalone components** throughout (no NgModules beyond AppComponent imports)
- **Two-way communication** between `MapComponent` and `PanelComponent` via `GisService` using two BehaviorSubjects: `panelAction$` (map → panel) and `mapAction$` (panel → map)
- **Google Maps API** is lazy-loaded via JSONP in `GisService.loadMapView()` to work around CORS restrictions; `provideHttpClient(withJsonpSupport())` is required in `app.config.ts`

### Core Components & Services

**`MapComponent`** (`src/app/components/map/`) — The main component. Manages the full Google Maps lifecycle: circle drawing (click-drag interaction), CCTV/equipment box markers with clustering, region polygon overlays from GeoJSON, InfoWindow state, and sidebar toggle. The `isDrawing` flag drives mouse event handling for real-time circle radius rendering.

**`GisService`** (`src/app/services/gis.service.ts`) — Singleton that wraps the Google Maps API. Handles geocoding and reverse geocoding (restricted to Taiwan: `componentRestrictions: { country: 'TW' }`), owns `mapEditType` state (current editing mode, e.g. `'circle'`), and mediates map↔panel communication via the two action BehaviorSubjects.

**`JsonApiService`** (`src/app/services/json-api.service.ts`) — Thin HTTP wrapper used to fetch GeoJSON region boundary data from `/mapData/`. Expects responses in `{ data: ... }` format and adds a 100ms delay.

**`PanelComponent`** (`src/app/components/panel/`) — Currently a stub; intended as the sidebar for map controls.

### Geographic Focus

- Default map center: lat `24.9837`, lng `121.2` (Taiwan)
- Geocoding restricted to Taiwan
- GeoJSON data represents administrative region boundaries

### Configuration Notes

- `strict: false` in `tsconfig.json`, but `strictTemplates: true` is enabled for Angular templates
- PrimeNG 18 with Aura theme, configured in `app.config.ts` via `providePrimeNG()`
- Production build budgets: 500kB initial warning, 1MB error threshold
