"""
LILA BLACK Backend API (Final Build)
- Accepts zip uploads, processes parquet with pyarrow
- Extracts and serves minimap images dynamically
- Streams progress via SSE
- Detailed error reporting
"""
import os, json, uuid, shutil, tempfile, asyncio, zipfile, base64, threading
from pathlib import Path
from typing import Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, Response
import pandas as pd
import pyarrow.parquet as pq

app = FastAPI(title="LILA BLACK Data Processor")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

jobs: Dict[str, Dict[str, Any]] = {}

MAP_CONFIG = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}
FALLBACK = {"scale": 1000, "origin_x": -500, "origin_z": -500}

def w2p(x, z, mid):
    c = MAP_CONFIG.get(mid, FALLBACK)
    u = (x - c["origin_x"]) / c["scale"]
    v = (z - c["origin_z"]) / c["scale"]
    return round(u * 1024, 2), round((1 - v) * 1024, 2)

def is_bot(uid):
    try: int(uid); return True
    except: return False

def detect_day_from_zip_path(zip_internal_path):
    """Extract day from the path INSIDE the zip, not the temp extraction path.
    Example: 'player_data/February_10/abc.nakama-0' -> 'February_10'
    """
    parts = zip_internal_path.replace("\\", "/").split("/")
    for p in parts:
        # Match patterns like February_10, January_05, March_21, etc.
        if "_" in p and any(month in p for month in 
            ["January","February","March","April","May","June",
             "July","August","September","October","November","December"]):
            return p
        # Also match generic date-like folders (2026_02_10, etc.)
        if p.replace("_","").replace("-","").isdigit() and len(p) > 4:
            return p
    # Fallback: use the first non-root, non-file folder name
    for p in parts:
        if p and not p.startswith(".") and "." not in p and p != "player_data":
            return p
    return "Unknown"

def safe_ts(val):
    try:
        ts = pd.to_datetime(val)
        return int(ts.value) if pd.notna(ts) else 0
    except: return 0

def process_zip(zip_path: str, job_id: str):
    job = jobs[job_id]
    job["status"] = "extracting"; job["message"] = "Extracting zip..."; job["progress"] = 5

    extract_dir = tempfile.mkdtemp()
    try:
        zf = zipfile.ZipFile(zip_path, 'r')
    except zipfile.BadZipFile:
        job["status"] = "error"; job["message"] = "Invalid zip file. Could not extract."; return
    except Exception as e:
        job["status"] = "error"; job["message"] = f"Zip extraction failed: {str(e)}"; return

    # Build a map of zip internal paths to extracted paths
    zip_names = zf.namelist()
    zf.extractall(extract_dir)
    zf.close()

    # Categorize files using ZIP INTERNAL paths (not temp paths)
    data_entries = []  # (extracted_path, zip_internal_path)
    minimap_entries = []  # (extracted_path, zip_internal_path, filename)

    for zn in zip_names:
        if zn.endswith("/") or "__MACOSX" in zn:
            continue
        extracted = os.path.join(extract_dir, zn)
        if not os.path.isfile(extracted):
            continue
        fname = os.path.basename(zn).lower()
        if fname.endswith((".png", ".jpg", ".jpeg")):
            if "minimap" in fname or "map" in fname:
                minimap_entries.append((extracted, zn, os.path.basename(zn)))
        elif not fname.endswith(".md"):
            data_entries.append((extracted, zn))

    if not data_entries:
        job["status"] = "error"
        job["message"] = f"No data files found. Found {len(minimap_entries)} minimap(s) but 0 parquet files.\nExpected: folders like February_10/ containing .nakama-0 files."
        shutil.rmtree(extract_dir, True); return

    job["message"] = f"Found {len(data_entries)} data files, {len(minimap_entries)} minimaps"
    job["progress"] = 10

    # Extract minimaps as base64 for serving
    minimap_data = {}
    for ext_path, zip_path_internal, fname in minimap_entries:
        try:
            with open(ext_path, "rb") as f:
                raw = f.read()
            # Derive map name from filename: AmbroseValley_Minimap.png -> AmbroseValley
            map_name = fname.split("_Minimap")[0].split("_minimap")[0].split(".")[0]
            ext = fname.rsplit(".", 1)[-1].lower()
            mime = "image/png" if ext == "png" else "image/jpeg"
            minimap_data[map_name] = {
                "data": base64.b64encode(raw).decode("utf-8"),
                "mime": mime, "filename": fname
            }
        except: continue

    # Process parquet files
    matches = {}; all_maps = set(); all_days = set()
    processed = 0; failed = 0; fail_reasons = []

    for i, (ext_path, zip_internal) in enumerate(data_entries):
        try:
            df = pq.read_table(ext_path).to_pandas()
            df["event"] = df["event"].apply(lambda x: x.decode("utf-8") if isinstance(x, bytes) else str(x))

            # Use ZIP INTERNAL path for day detection (not temp path)
            day = detect_day_from_zip_path(zip_internal)

            for _, r in df.iterrows():
                mid, uid, mp = str(r["match_id"]), str(r["user_id"]), str(r["map_id"])
                px, py = w2p(float(r["x"]), float(r["z"]), mp)
                ts = safe_ts(r["ts"])
                all_maps.add(mp); all_days.add(day)
                if mid not in matches:
                    matches[mid] = {"map_id": mp, "day": day, "events": []}
                matches[mid]["events"].append({"uid":uid,"bot":is_bot(uid),"px":px,"py":py,"ts":ts,"ev":str(r["event"])})
            processed += 1
        except Exception as e:
            failed += 1
            if len(fail_reasons) < 5:
                fail_reasons.append(f"{os.path.basename(ext_path)}: {str(e)[:80]}")
            continue

        if (i+1) % 25 == 0:
            job["progress"] = 10 + int((i+1)/len(data_entries)*60)
            job["message"] = f"Reading files: {i+1}/{len(data_entries)} ({failed} failed)"

    if not matches:
        detail = "\n".join(fail_reasons) if fail_reasons else "No specific errors captured"
        job["status"] = "error"
        job["message"] = f"0 matches found from {processed} files ({failed} failed).\n\nErrors:\n{detail}"
        shutil.rmtree(extract_dir, True); return

    job["message"] = "Building index..."; job["progress"] = 75

    # Build index
    index = []
    for mid, m in matches.items():
        evts = m["events"]
        uids = set(e["uid"] for e in evts); bots = set(e["uid"] for e in evts if e["bot"])
        times = [e["ts"] for e in evts if e["ts"] > 0]
        mn, mx = (min(times), max(times)) if times else (0, 0)
        ec = {}
        for e in evts: ec[e["ev"]] = ec.get(e["ev"], 0) + 1
        index.append({"id":mid,"map":m["map_id"],"day":m["day"],
            "humans":len(uids-bots),"bots":len(bots),
            "kills":ec.get("Kill",0)+ec.get("BotKill",0),
            "deaths":ec.get("Killed",0)+ec.get("BotKilled",0)+ec.get("KilledByStorm",0),
            "storm_deaths":ec.get("KilledByStorm",0),"loots":ec.get("Loot",0),
            "dur_ms":round((mx-mn)/1e6,1),"event_count":len(evts),"ev_counts":ec})
    index.sort(key=lambda m: m["event_count"], reverse=True)

    job["message"] = "Building heatmaps..."; job["progress"] = 80

    # Heatmaps
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

    job["message"] = "Building match details..."; job["progress"] = 85

    # Match details
    match_details = {}
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
            p["path"].sort(key=lambda x:x["ts"])
            p["events"].sort(key=lambda x:x["ts"])
        times = [e["ts"] for e in m["events"] if e["ts"]>0]
        mn, mx = (min(times), max(times)) if times else (0, 0)
        match_details[mid] = {"id":mid,"map":m["map_id"],"day":m["day"],
            "min_ts":mn,"max_ts":mx,"players":list(players.values())}

    job["progress"] = 95; job["message"] = "Finalizing..."

    meta = {
        "maps": sorted(list(all_maps)),
        "days": sorted(list(all_days)),
        "total_matches": len(matches), "total_files": processed,
        "map_config": {m: MAP_CONFIG.get(m, FALLBACK) for m in all_maps},
        "minimaps": {name: {"filename": info["filename"], "mime": info["mime"]} for name, info in minimap_data.items()},
    }

    job["result"] = {"meta": meta, "index": index, "heatmaps": heatmaps,
                     "match_details": match_details, "minimaps": minimap_data}
    job["status"] = "complete"; job["progress"] = 100
    skip_note = f" ({failed} unreadable files skipped)" if failed else ""
    job["message"] = f"Done! {len(matches)} matches from {processed} files, {len(all_maps)} maps, {len(all_days)} days.{skip_note}"
    shutil.rmtree(extract_dir, True)
    try: os.remove(zip_path)
    except: pass

# ── Routes ──

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(400, "Must be .zip file")
    jid = str(uuid.uuid4())[:8]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    tmp.write(await file.read()); tmp.close()
    jobs[jid] = {"status":"starting","message":"Starting...","progress":0,"result":None}
    threading.Thread(target=process_zip, args=(tmp.name, jid)).start()
    return {"job_id": jid}

@app.get("/api/progress/{jid}")
async def progress(jid: str):
    if jid not in jobs: raise HTTPException(404)
    async def stream():
        while True:
            j = jobs.get(jid, {})
            yield f"data: {json.dumps({'status':j.get('status','?'),'message':j.get('message',''),'progress':j.get('progress',0)})}\n\n"
            if j.get("status") in ("complete","error"): break
            await asyncio.sleep(0.5)
    return StreamingResponse(stream(), media_type="text/event-stream")

@app.get("/api/data/{jid}/meta.json")
async def get_meta(jid: str):
    j = jobs.get(jid)
    if not j or j["status"]!="complete": raise HTTPException(404)
    return JSONResponse(j["result"]["meta"])

@app.get("/api/data/{jid}/index.json")
async def get_index(jid: str):
    j = jobs.get(jid)
    if not j or j["status"]!="complete": raise HTTPException(404)
    return JSONResponse(j["result"]["index"])

@app.get("/api/data/{jid}/heatmaps.json")
async def get_heatmaps(jid: str):
    j = jobs.get(jid)
    if not j or j["status"]!="complete": raise HTTPException(404)
    return JSONResponse(j["result"]["heatmaps"])

@app.get("/api/data/{jid}/matches/{match_id}.json")
async def get_match(jid: str, match_id: str):
    j = jobs.get(jid)
    if not j or j["status"]!="complete": raise HTTPException(404)
    d = j["result"]["match_details"]
    m = d.get(match_id) or d.get(match_id.replace("_","."))
    if not m: raise HTTPException(404, "Match not found")
    return JSONResponse(m)

@app.get("/api/data/{jid}/minimap/{map_name}")
async def get_minimap(jid: str, map_name: str):
    """Serve dynamically extracted minimap images."""
    j = jobs.get(jid)
    if not j or j["status"]!="complete": raise HTTPException(404)
    mm = j["result"].get("minimaps", {}).get(map_name)
    if not mm: raise HTTPException(404, f"Minimap '{map_name}' not found")
    raw = base64.b64decode(mm["data"])
    return Response(content=raw, media_type=mm["mime"])

@app.get("/api/health")
async def health():
    return {"status":"ok","jobs":len(jobs)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
