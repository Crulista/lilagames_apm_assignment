# Architecture

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Data Processing | Python + PyArrow + Pandas | Best parquet support, handles .nakama-0 files natively |
| Frontend | React 18 + Vite | Fast iteration, component model fits interactive visualization |
| Rendering | HTML5 Canvas 2D | Direct pixel control for paths, emoji markers, and heatmap compositing |
| Heatmaps | Custom radial gradient renderer | Lightweight (~40 lines), no extra dependency, renders on same canvas |
| Hosting | Vercel | Zero-config static deployment, free tier |

## Code Structure

```
src/
├── App.jsx                    # Main orchestrator: data loading, state, layout
├── styles.css                 # All styles in one clean stylesheet
├── components/
│   ├── Sidebar.jsx            # Match browser + heatmap controls + player list
│   ├── MapCanvas.jsx          # Canvas rendering: map, paths, events, heatmaps
│   ├── Timeline.jsx           # Playback controls with speed selection
│   └── Legend.jsx             # Event type and color legend
└── utils/
    ├── constants.js           # Map config, colors, emoji mappings, coordinate helpers
    └── heatmap.js             # Custom radial gradient heatmap renderer
```

Components are separated by responsibility. Utilities contain pure functions with no React dependencies, making them testable independently.

## Data Flow

```
Raw .nakama-0 parquet files (1,243 files, ~89K events)
        │
   process_data.py
   ├── Reads all files recursively (handles .nakama-0 extension)
   ├── Decodes event bytes to strings (stored as binary in parquet)
   ├── Detects bots via user_id format (numeric = bot, UUID = human)
   ├── Converts world coords (x, z) → minimap pixel coords (per-map formula)
   ├── Groups events by match, then by player within each match
   └── Outputs:
        ├── index.json              Lightweight match summaries for sidebar
        ├── heatmaps.json           Aggregated events per map AND per day
        └── matches/<safe_id>.json  Per-match player paths + events
                │
          React Frontend
          ├── Loads index.json + heatmaps.json on startup (~instant)
          ├── Lazy-loads individual match JSON on user selection
          └── Renders everything on a single HTML5 Canvas
```

## Coordinate Mapping

The game uses 3D world coordinates `(x, y, z)` where `y` is elevation. For 2D minimap plotting, only `x` and `z` are used.

Each map has origin and scale parameters from the game engine:

| Map | Scale | Origin X | Origin Z |
|-----|-------|----------|----------|
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

**Conversion (in process_data.py):**
```
u = (world_x - origin_x) / scale          → UV horizontal (0–1)
v = (world_z - origin_z) / scale           → UV vertical (0–1)
pixel_x = u * 1024                         → Minimap X
pixel_y = (1 - v) * 1024                   → Minimap Y (flipped for image coords)
```

The Y-flip accounts for image coordinates having origin at top-left vs the game's bottom-left.

**Image scaling note:** Actual minimap images are larger than 1024×1024 (AmbroseValley: 4320×4320, GrandRift: 2160×2158, Lockdown: 9000×9000). All coordinates are normalized to 1024-space during preprocessing and scaled to canvas dimensions at render time. This keeps data portable across display resolutions.

## Data Nuances Handled

| Nuance | How It's Handled |
|--------|------------------|
| .nakama-0 file extension | Recursive scan, no extension filtering — any valid parquet file is read |
| Event column as bytes | Decoded with `.decode('utf-8')` during preprocessing |
| Bot detection | `int(user_id)` succeeds → bot. Fails → human (UUID format) |
| Timestamps | Match-relative (elapsed time, not wall-clock). Converted to ms integers. Duration = max_ts - min_ts |
| Y coordinate | Represents elevation in 3D — explicitly excluded from 2D minimap mapping |
| February 14 partial data | Treated as normal day, just with fewer matches |

## Heatmap Architecture

Heatmaps are aggregated in preprocessing, not computed in the browser. The data is structured per-map AND per-day:

```json
{
  "AmbroseValley": {
    "all": { "kills": [...], "deaths": [...], "traffic": [...] },
    "February_10": { "kills": [...], "deaths": [...], "traffic": [...] },
    "February_11": { ... }
  }
}
```

This allows the frontend to filter heatmaps by day without recomputation.

## Trade-offs

| Decision | Alternative | Why This Choice |
|----------|------------|-----------------|
| Pre-process to JSON | Parse parquet in browser (DuckDB-WASM) | Simpler, faster load, no 3MB WASM dependency |
| Per-match lazy loading | Single monolithic file | Keeps initial load <1s. Each match file is <50KB |
| Canvas 2D | deck.gl / WebGL | Sufficient for 89K events. Simpler, smaller bundle |
| Emoji event markers | Colored shapes | Instantly recognizable for non-technical users (level designers) |
| Per-day heatmap buckets | Frontend filtering of raw events | Keeps frontend computation minimal |
| Coordinate conversion in Python | Frontend conversion | Reduces client-side work to simple scaling |
| Playback speeds 10x-100x | 0.5x-10x | Matches last 10-20 minutes — lower speeds are impractical for analysis |

## What I'd Do With More Time

1. **In-browser zip upload**: Let designers drag-drop a zip file and process it client-side using a lightweight parquet reader, eliminating the Python dependency entirely
2. **Zoom and pan** on minimap for detailed area inspection
3. **Storm boundary animation**: Visualize the storm line moving across the map over time
4. **Auto-detected hotspots**: Cluster analysis to automatically label fight zones and dead zones
5. **Player search**: Find a specific player across all their matches to analyze behavior patterns
6. **Side-by-side comparison**: Compare heatmaps across different days to spot behavioral shifts
7. **Export**: Let designers save specific views as images for presentations
