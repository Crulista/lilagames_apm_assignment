"""
LILA BLACK Data Processor (Dynamic Version)
No hardcoded months or maps. Reads whatever data structure exists.

Usage: pip install pyarrow pandas && python scripts/process_data.py
"""
import os, json
import pandas as pd
import pyarrow.parquet as pq

DATA_DIR = "player_data"
OUTPUT_DIR = os.path.join("public", "data")

# Known map configs. Unknown maps get a fallback config.
MAP_CONFIG = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}
FALLBACK_CONFIG = {"scale": 1000, "origin_x": -500, "origin_z": -500}

def world_to_pixel(x, z, map_id):
    cfg = MAP_CONFIG.get(map_id, FALLBACK_CONFIG)
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    return round(u * 1024, 2), round((1 - v) * 1024, 2)

def is_bot(uid):
    try: int(uid); return True
    except: return False

def detect_day(fp):
    """Use the immediate parent folder name as the day label. No month assumptions."""
    parts = fp.replace("\\", "/").split("/")
    # Walk backwards to find a folder that isn't the base data dir
    for i in range(len(parts)-2, -1, -1):
        if parts[i] != DATA_DIR and parts[i] != os.path.basename(DATA_DIR):
            if os.path.isdir(os.path.join(*parts[:i+1])):
                return parts[i]
    return "Unknown"

def safe_ts(val):
    try:
        ts = pd.to_datetime(val)
        return int(ts.value) if pd.notna(ts) else 0
    except: return 0

def main():
    os.makedirs(os.path.join(OUTPUT_DIR, "matches"), exist_ok=True)
    matches = {}; fc = 0; all_maps = set(); all_days = set()
    
    print("Scanning...")
    for root, _, files in os.walk(DATA_DIR):
        for fn in files:
            if fn.endswith((".md",".png",".jpg",".jpeg")): continue
            fp = os.path.join(root, fn)
            day = detect_day(fp)
            try:
                df = pq.read_table(fp).to_pandas()
                df["event"] = df["event"].apply(lambda x: x.decode("utf-8") if isinstance(x,bytes) else str(x))
                fc += 1
                for _, r in df.iterrows():
                    mid, uid, mp = str(r["match_id"]), str(r["user_id"]), str(r["map_id"])
                    px, py = world_to_pixel(float(r["x"]), float(r["z"]), mp)
                    ts = safe_ts(r["ts"])
                    all_maps.add(mp); all_days.add(day)
                    if mid not in matches:
                        matches[mid] = {"map_id": mp, "day": day, "events": []}
                    matches[mid]["events"].append({"uid":uid,"bot":is_bot(uid),"px":px,"py":py,"ts":ts,"ev":str(r["event"])})
            except: continue
    
    print(f"{fc} files, {len(matches)} matches, maps: {all_maps}, days: {all_days}")

    # Collect all unique event types
    all_events = set()
    for m in matches.values():
        for e in m["events"]:
            all_events.add(e["ev"])
    print(f"Event types: {all_events}")

    # Index
    index = []
    for mid, m in matches.items():
        evts = m["events"]
        uids = set(e["uid"] for e in evts); bots = set(e["uid"] for e in evts if e["bot"])
        times = [e["ts"] for e in evts if e["ts"] > 0]
        mn, mx = (min(times), max(times)) if times else (0, 0)
        dur_ms = (mx - mn) / 1_000_000
        
        # Count each event type
        ev_counts = {}
        for e in evts:
            ev_counts[e["ev"]] = ev_counts.get(e["ev"], 0) + 1
        
        index.append({"id":mid,"map":m["map_id"],"day":m["day"],
            "humans":len(uids-bots),"bots":len(bots),
            "kills": ev_counts.get("Kill",0) + ev_counts.get("BotKill",0),
            "deaths": ev_counts.get("Killed",0) + ev_counts.get("BotKilled",0) + ev_counts.get("KilledByStorm",0),
            "storm_deaths": ev_counts.get("KilledByStorm",0),
            "loots": ev_counts.get("Loot",0),
            "bot_kills": ev_counts.get("BotKill",0),
            "human_kills": ev_counts.get("Kill",0),
            "dur_ms":round(dur_ms,1),"event_count":len(evts),
            "ev_counts": ev_counts})
    index.sort(key=lambda m: m["event_count"], reverse=True)
    
    # Metadata file (dynamic maps, days, event types for frontend dropdowns)
    meta = {
        "maps": sorted(list(all_maps)),
        "days": sorted(list(all_days)),
        "event_types": sorted(list(all_events)),
        "total_matches": len(matches),
        "total_files": fc,
        "map_config": {m: MAP_CONFIG.get(m, FALLBACK_CONFIG) for m in all_maps},
    }
    with open(os.path.join(OUTPUT_DIR, "meta.json"), "w") as f: json.dump(meta, f)
    with open(os.path.join(OUTPUT_DIR, "index.json"), "w") as f: json.dump(index, f)

    # Heatmaps (per map AND per day)
    heatmaps = {}
    for mid, m in matches.items():
        mp, day = m["map_id"], m["day"]
        if mp not in heatmaps: heatmaps[mp] = {}
        for bk in ["all", day]:
            if bk not in heatmaps[mp]:
                heatmaps[mp][bk] = {"kills":[],"deaths":[],"storm":[],"loot":[],"traffic":[]}
        for e in m["events"]:
            pt = {"px":e["px"],"py":e["py"]}
            for bk in ["all", day]:
                d = heatmaps[mp][bk]
                if e["ev"] in ("Kill","BotKill"): d["kills"].append(pt)
                elif e["ev"] in ("Killed","BotKilled"): d["deaths"].append(pt)
                elif e["ev"]=="KilledByStorm": d["storm"].append(pt)
                elif e["ev"]=="Loot": d["loot"].append(pt)
                elif e["ev"] in ("Position","BotPosition"): d["traffic"].append(pt)
    with open(os.path.join(OUTPUT_DIR, "heatmaps.json"), "w") as f: json.dump(heatmaps, f)

    # Per-match files
    for mid, m in matches.items():
        players = {}
        for e in m["events"]:
            uid = e["uid"]
            if uid not in players:
                players[uid] = {"uid":uid,"bot":e["bot"],"path":[],"events":[]}
            if e["ev"] in ("Position","BotPosition"):
                players[uid]["path"].append({"px":e["px"],"py":e["py"],"ts":e["ts"]})
            else:
                players[uid]["events"].append({"px":e["px"],"py":e["py"],"ts":e["ts"],"ev":e["ev"]})
        for p in players.values():
            p["path"].sort(key=lambda x:x["ts"]); p["events"].sort(key=lambda x:x["ts"])
        times = [e["ts"] for e in m["events"] if e["ts"]>0]
        mn, mx = (min(times),max(times)) if times else (0,0)
        sid = mid.replace(".","_")
        with open(os.path.join(OUTPUT_DIR,"matches",f"{sid}.json"),"w") as f:
            json.dump({"id":mid,"map":m["map_id"],"day":m["day"],
                       "min_ts":mn,"max_ts":mx,"players":list(players.values())},f)

    print(f"Done! Maps: {sorted(all_maps)}, Days: {sorted(all_days)}")

if __name__ == "__main__": main()
