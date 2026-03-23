# TrailCenter

**A GPX prep tool for the [TrailPrint3D](https://makerworld.com/en/models/832982) Blender addon.**

Live: [latimer3001.github.io/trailcenter](https://latimer3001.github.io/trailcenter)

---

## The Problem

TrailPrint3D generates 3D-printable topographic maps from GPX trail data. It's excellent — but the terrain it generates is centered on whatever bounding box your GPX file defines. GPX files from AllTrails and most other sources are centered on the trail itself, not the mountain. If your trail approaches a summit from one side, the peak ends up at the edge of the print instead of the center.

TrailCenter fixes this.

## What It Does

- Loads GPX files from any source (AllTrails, Gaia GPS, Garmin, Strava, etc.)
- Searches OpenStreetMap for hiking routes directly — no GPX download required
- **Combines multiple trails** from any mix of sources into a single GPX output
- Expands the bounding box so a chosen summit or point is centered in the terrain
- Shows everything on an interactive topo map so you can verify before downloading
- Outputs a clean GPX ready to drop into TrailPrint3D

## Usage

### 1. Load Trail Data

**Upload GPX** — drop one or more `.gpx` files onto the drop zone, or click to browse. You can load multiple files and they will be merged into a single output. Mix sources freely — an AllTrails GPX plus an OSM route, for example.

**Search OSM** — type a trail name and search OpenStreetMap hiking routes. Click a result to import it. Works well for well-known named trails; quality varies for less-documented routes.

### 2. Center the Map

Choose a centering mode:

- **Auto Summit** — type a peak name (e.g. `Mount Washington, New Hampshire`), hit Lookup to resolve it via OpenStreetMap, and verify the red dot lands on the right summit.
- **Coordinates** — paste lat/lon directly if you already know them.
- **Manual Padding** — add raw padding in degrees per direction for full control.

The extra padding field adds breathing room beyond what's needed to include the full trail — `0.01°` is about 0.5 miles.

### 3. Generate and Download

Click **Generate Expanded GPX**. The map updates to show the new terrain extent as a dashed red rectangle — the summit marker should be centered inside it. Download the expanded GPX and load it into TrailPrint3D.

## TrailPrint3D Settings

When loading the expanded GPX in the TrailPrint3D Blender addon:

- Enable **Overwrite Path Elevation** — the phantom boundary points added by TrailCenter have `0` elevation; this ensures TrailPrint3D fetches real DEM data instead
- Enable **SingleColorMode** for two-piece prints — outputs separate terrain and trail inlay STLs that can be printed in different colors and assembled

## Degree Reference

| Degrees | Approximate distance |
|---------|----------------------|
| 0.01°   | ~0.5 miles           |
| 0.02°   | ~1.1 miles           |
| 0.03°   | ~1.7 miles           |
| 0.05°   | ~3.5 miles           |

*(at New Hampshire latitudes — scales slightly with latitude)*

## How It Works

GPX files define a bounding box by the extent of their track points. TrailPrint3D uses this box to determine what terrain to fetch. TrailCenter adds isolated single-point track segments at the corners of the desired new extent — single points cannot form trail lines, so TrailPrint3D expands the terrain without drawing phantom trails across the map.

## Local Use

No build step or server required. Download the three files, keep them in the same folder, and open `trailcenter.html` in a browser.

```
trailcenter.html
trailcenter.css
trailcenter.js
```

## Dependencies

- [Leaflet](https://leafletjs.com/) — map display
- [OpenTopoMap](https://opentopomap.org/) — topo tile layer
- [Nominatim](https://nominatim.org/) — summit coordinate lookup
- [Overpass API](https://overpass-api.de/) — OSM trail search

All loaded from CDN or free public APIs. No API keys required.

## License

MIT
