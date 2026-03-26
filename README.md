# LILA BLACK - Player Journey Visualizer

A web-based tool for Level Designers to explore player behavior across LILA BLACK's three maps.

**Live Demo:** https://lilagames-apm-assignment.vercel.app/

## Features

- **Player Journeys**: Visualize movement paths on correct minimaps with world-to-pixel coordinate mapping
- **Human vs Bot**: Colored paths for humans, grey for bots (detected by user_id format)
- **Event Markers**: Emoji markers — ⚔️ Kills, 💀 Deaths, 🌩️ Storm Deaths, 📦 Loot
- **Match Browser**: Filter by map, day, and match ID search
- **Timeline Playback**: Play/pause/scrub with 10x–100x speed controls
- **Heatmap Overlays**: Kill zones, death zones, storm deaths, loot spots, traffic density
- **Day Filtering**: Heatmaps can be filtered by specific day or viewed as aggregate
- **Player List**: Per-match breakdown of humans and bots with color-coded entries

## Project Structure

```
├── scripts/
│   └── process_data.py          # Parquet → JSON processor (well-commented)
├── src/
│   ├── App.jsx                  # Main orchestrator
│   ├── styles.css               # Stylesheet
│   ├── components/
│   │   ├── Sidebar.jsx          # Match browser + heatmap controls
│   │   ├── MapCanvas.jsx        # Canvas rendering engine
│   │   ├── Timeline.jsx         # Playback controls
│   │   └── Legend.jsx           # Event legend
│   └── utils/
│       ├── constants.js         # Config, colors, coordinate helpers
│       └── heatmap.js           # Custom heatmap renderer
├── public/
│   ├── minimaps/                # Map images (from dataset)
│   └── data/                    # Generated JSON (from process_data.py)
├── ARCHITECTURE.md              # System design decisions
├── INSIGHTS.md                  # Three game insights with evidence
└── README.md                    # This file
```

## Local Setup

### Prerequisites
- Node.js 18+
- Python 3.8+ (for data processing)
- `player_data` folder from the provided zip

### Step 1: Place data
Copy the `player_data/` folder into the project root. Structure should be:
```
project/
├── player_data/
│   ├── February_10/
│   ├── February_11/
│   ├── February_12/
│   ├── February_13/
│   ├── February_14/
│   ├── minimaps/
│   └── README.md
├── scripts/
└── ...
```

### Step 2: Copy minimap images
```bash
mkdir -p public/minimaps
cp player_data/minimaps/* public/minimaps/
```
Windows:
```cmd
mkdir public\minimaps
copy player_data\minimaps\* public\minimaps\
```

### Step 3: Process data
```bash
pip install pyarrow pandas
python scripts/process_data.py
```
Expected output: `Done! 1243 files across 796 matches`

This generates JSON files in `public/data/`.

### Step 4: Install and run
```bash
npm install
npm run dev
```
Open http://localhost:5173

### Step 5: Build for production
```bash
npm run build
```
Deploy the `dist/` folder to Vercel, Netlify, or any static host.
