# LILA BLACK Player Journey Visualizing Tool

A web-based tool for Level Designers to explore player behavior, identify map design issues, and generate actionable insights from LILA BLACK match telemetry.

**Live Demo:** [Frontend URL] | **Backend API:** [Railway URL]

## Features

**Match Explorer**
- Player journey visualization on correct minimaps with world-to-pixel coordinate mapping
- Separate toggles for human paths and bot paths (independent of event markers)
- Emoji event markers with per-event-type opacity sliders for layered analysis
- Advanced filters: Storm Deaths, PvP Kills, Player Deaths (Any/Yes/No), Sort by Events/Kills/Deaths/Players
- Match ID search
- Timeline playback with 0.1x, 0.25x, 0.5x, 1x, 2x, 5x speed controls
- Zoom (scroll wheel, 1x-5x) and pan (drag) with bounds clamping
- Hover tooltips showing event type and player ID on any marker
- Player list with color-coded entries per match

**Map Analytics**
- Heatmap overlays: Kill Zones, Death Zones, Storm Deaths, Loot Spots, Traffic
- Adaptive rendering: rare events glow large, dense events auto-sample for clarity
- Global opacity slider for seeing the map underneath overlays
- Per-map and per-day filtering
- Context-aware stats bar (updates based on selected map and day)
- Compass (N/S/E/W) for spatial reference

**Smart Insights (permanent right panel)**
- Code-based analysis engine generating extraction-shooter-specific insights
- Bot farming detection, dead zone identification, storm route analysis
- Map coverage percentage, early vs late game combat balance
- Quadrant-based spatial analysis with compass reference
- Updates dynamically based on what the designer is viewing

**Data Upload**
- Upload a player_data.zip via the Upload tab
- Backend processes with pyarrow (handles .nakama-0 binary event columns)
- Real-time progress bar with SSE streaming
- Specific error messages if processing fails
- Minimap images extracted from zip and served dynamically
- No command-line steps required

## Architecture

Two-service deployment:
- **Frontend** (React + Vite): Static site on Vercel
- **Backend** (FastAPI + PyArrow): API on Railway for zip processing

See ARCHITECTURE.md for full technical details.

## Setup

### Prerequisites

- Node.js 18+
- Python 3.8+ (for local data preprocessing)
- The player_data.zip dataset

### Option A: Local Development (preprocessed data)

```bash
# 1. Clone the repo
git clone https://github.com/[your-repo]/lila-viz.git
cd lila-viz/frontend

# 2. Install dependencies
npm install

# 3. Process the data
pip install pyarrow pandas
# Place player_data/ directory at project root
cp player_data/minimaps/* public/minimaps/
python scripts/process_data.py

# 4. Run
npm run dev
```

Open http://localhost:5173

### Option B: With Backend (upload support)

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Update `API_URL` in `src/App.jsx` line 10 to point to your backend URL.

### Deployment

**Backend (Railway):**
1. Push `backend/` to a GitHub repository
2. Connect to Railway: New Project > GitHub repo > Deploy
3. Railway auto-detects Python, installs requirements, starts uvicorn
4. Copy the deployed URL

**Frontend (Vercel):**
1. Set `API_URL` in App.jsx to your Railway URL
2. Run `python scripts/process_data.py` to generate JSON data
3. Push `frontend/` to GitHub
4. Connect to Vercel: New Project > GitHub repo > Deploy

## Project Structure

```
backend/
    main.py              # FastAPI: upload, processing, SSE progress, minimap serving
    requirements.txt     # Python dependencies
    runtime.txt          # Python 3.12 for Railway
    Procfile             # Railway start command
    nixpacks.toml        # Railway build config

frontend/
    src/
        App.jsx          # Main application (3-column layout, all state, render loop)
        styles.css       # Dark theme, responsive 3-column layout
        main.jsx         # React entry
        utils/
            constants.js # Map config, colors, emojis, coordinate helpers
            heatmap.js   # Adaptive radial gradient renderer
            insights.js  # Extraction-shooter analysis engine
    scripts/
        process_data.py  # Offline parquet-to-JSON preprocessor
    public/
        minimaps/        # Map images
        data/            # Preprocessed JSON
            index.json   # Match summaries
            heatmaps.json # Aggregated spatial data (per map, per day)
            meta.json    # Maps, days, event types, map coordinate config
            matches/     # One JSON per match (lazy-loaded)
    ARCHITECTURE.md      # Technical decisions and system design
    INSIGHTS.md          # Data-driven game design insights
    README.md            # This file
```

## Data Nuances

These are the key details about the dataset that affect how the tool processes data:

- **File format**: .nakama-0 extension but valid Apache Parquet. PyArrow reads them natively.
- **Event column**: Stored as binary bytes. Requires `.decode('utf-8')` to get readable strings.
- **Bot detection**: Numeric user_id = bot, UUID user_id = human.
- **Coordinates**: Y column is elevation (3D height). Only X and Z map to the 2D minimap.
- **Timestamps**: Represent sub-second telemetry recording windows (300-900ms per match). Timeline uses percentage progress, not clock time.
- **February 14**: Partial day (data collection was ongoing).
- **Dynamic data**: The tool does not hardcode months, maps, or event types. New data with different folder names or new maps will work automatically.

## Coordinate Mapping

```
u = (world_x - origin_x) / scale
v = (world_z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024    <- Y flipped for image coordinates
```

Map configurations are stored in `meta.json` and loaded dynamically. Unknown maps use a fallback config (scale: 1000, origin: -500, -500).
