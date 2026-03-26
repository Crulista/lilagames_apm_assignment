import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { drawHeatmap } from './utils/heatmap.js'
import { scaleToCanvas, getPlayerColor, formatDuration, EVENT_EMOJI, EVENT_COLORS, HEATMAP_OPTIONS } from './utils/constants.js'
import { generateMatchInsights, generateHeatmapInsights } from './utils/insights.js'
import './styles.css'

// Default local map images (used when data is preprocessed locally)
const LOCAL_MAPS = {
  AmbroseValley: 'minimaps/AmbroseValley_Minimap.png',
  GrandRift: 'minimaps/GrandRift_Minimap.png',
  Lockdown: 'minimaps/Lockdown_Minimap.jpg',
}

const API_URL = window.LILA_API_URL || 'http://localhost:8000'

export default function App(){
  const[activeTab,setActiveTab]=useState('explorer')
  const[meta,setMeta]=useState(null)
  const[matchIndex,setMatchIndex]=useState(null)
  const[heatmapData,setHeatmapData]=useState(null)
  const[selectedMatch,setSelectedMatch]=useState(null)
  const[matchData,setMatchData]=useState(null)
  const[loading,setLoading]=useState(true)
  const[matchLoading,setMatchLoading]=useState(false)

  // Filters
  const[filterMap,setFilterMap]=useState('all')
  const[filterDay,setFilterDay]=useState('all')
  const[searchQuery,setSearchQuery]=useState('')
  const[filterStorm,setFilterStorm]=useState('any')
  const[filterHumanKills,setFilterHumanKills]=useState('any')
  const[filterPlayerKilled,setFilterPlayerKilled]=useState('any')
  const[sortBy,setSortBy]=useState('events')

  // Display
  const[showHumanPaths,setShowHumanPaths]=useState(true)
  const[showBotPaths,setShowBotPaths]=useState(true)
  const[visibleEvents,setVisibleEvents]=useState({Kill:true,BotKill:true,Killed:true,BotKilled:true,KilledByStorm:true,Loot:true})
  const[eventOpacity,setEventOpacity]=useState({Kill:1,BotKill:1,Killed:1,BotKilled:1,KilledByStorm:1,Loot:1})
  const[heatmapOpacity,setHeatmapOpacity]=useState(0.8)

  // Analytics
  const[heatmapType,setHeatmapType]=useState('kills')
  const[heatmapMap,setHeatmapMap]=useState('AmbroseValley')
  const[heatmapDay,setHeatmapDay]=useState('all')

  // Timeline
  const[timeProgress,setTimeProgress]=useState(1)
  const[isPlaying,setIsPlaying]=useState(false)
  const[playSpeed,setPlaySpeed]=useState(1)
  const animRef=useRef(null),lastFrame=useRef(null)

  // Canvas + zoom
  const[canvasSize,setCanvasSize]=useState(700)
  const wrapperRef=useRef(null),canvasRef=useRef(null),mapImgRef=useRef(null)
  const[imgTick,setImgTick]=useState(0)
  const[zoom,setZoom]=useState(1)
  const[panX,setPanX]=useState(0)
  const[panY,setPanY]=useState(0)
  const isPanning=useRef(false),panStart=useRef({x:0,y:0})
  const[tooltip,setTooltip]=useState(null)

  // Upload
  const[uploadStatus,setUploadStatus]=useState(null)
  const[uploadProgress,setUploadProgress]=useState(0)
  const[uploadMsg,setUploadMsg]=useState('')
  const[uploadJobId,setUploadJobId]=useState(null)
  const[dynamicMaps,setDynamicMaps]=useState(null) // {mapName: blobUrl}

  // Insights
  const[showInsights,setShowInsights]=useState(true)

  // ── Load local data ──
  useEffect(()=>{
    Promise.all([
      fetch('./data/meta.json').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('./data/index.json').then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch('./data/heatmaps.json').then(r=>r.ok?r.json():{}).catch(()=>({})),
    ]).then(([m,idx,heat])=>{
      setMeta(m);setMatchIndex(idx);setHeatmapData(heat);if(m?.maps?.[0])setHeatmapMap(m.maps[0]);setLoading(false)
      // Preload all minimap images in background
      const maps=m?.maps||Object.keys(LOCAL_MAPS)
      maps.forEach(mapName=>{const src=LOCAL_MAPS[mapName];if(src){const img=new Image();img.src='./'+src}})
    }).catch(()=>setLoading(false))
  },[])

  // ── Load match ──
  useEffect(()=>{
    if(!selectedMatch){setMatchData(null);return}
    setMatchLoading(true);setTimeProgress(1);setIsPlaying(false);setZoom(1);setPanX(0);setPanY(0)
    if(window.__uploadedMatches?.[selectedMatch.id]){setMatchData(window.__uploadedMatches[selectedMatch.id]);setMatchLoading(false);return}
    if(uploadJobId){
      fetch(`${API_URL}/api/data/${uploadJobId}/matches/${selectedMatch.id.replace(/\./g,'_')}.json`)
        .then(r=>r.ok?r.json():null).then(d=>{if(d){setMatchData(d);setMatchLoading(false)}else throw'x'})
        .catch(()=>{const s=selectedMatch.id.replace(/\./g,'_');fetch(`./data/matches/${s}.json`).then(r=>r.ok?r.json():null).then(d=>{setMatchData(d);setMatchLoading(false)}).catch(()=>{setMatchData(null);setMatchLoading(false)})})
      return
    }
    const s=selectedMatch.id.replace(/\./g,'_')
    fetch(`./data/matches/${s}.json`).then(r=>r.ok?r.json():null).then(d=>{setMatchData(d);setMatchLoading(false)}).catch(()=>{setMatchData(null);setMatchLoading(false)})
  },[selectedMatch,uploadJobId])

  // ── Map image (dynamic: check uploaded maps first, then local) ──
  const currentMap=activeTab==='analytics'?heatmapMap:(matchData?.map||(filterMap!=='all'?filterMap:(meta?.maps?.[0]||'AmbroseValley')))
  useEffect(()=>{
    // Try dynamic (uploaded) map first
    if(dynamicMaps?.[currentMap]){
      const img=new Image();img.src=dynamicMaps[currentMap]
      img.onload=()=>{mapImgRef.current=img;setImgTick(t=>t+1)};return
    }
    // Try backend-served map
    if(uploadJobId){
      const img=new Image();img.src=`${API_URL}/api/data/${uploadJobId}/minimap/${currentMap}`
      img.onload=()=>{mapImgRef.current=img;setImgTick(t=>t+1)}
      img.onerror=()=>{/* fall through to local */
        const src=LOCAL_MAPS[currentMap];if(!src)return
        const img2=new Image();img2.src=`./`+src;img2.onload=()=>{mapImgRef.current=img2;setImgTick(t=>t+1)}
      };return
    }
    // Local map
    const src=LOCAL_MAPS[currentMap];if(!src)return
    const img=new Image();img.src=`./`+src;img.onload=()=>{mapImgRef.current=img;setImgTick(t=>t+1)}
  },[currentMap,dynamicMaps,uploadJobId])

  // ── Resize (fill available space) ──
  useEffect(()=>{const fn=()=>{if(!wrapperRef.current)return;const r=wrapperRef.current.getBoundingClientRect();setCanvasSize(Math.max(300,Math.min(r.width-8,r.height-8)))};fn();window.addEventListener('resize',fn);return()=>window.removeEventListener('resize',fn)},[showInsights])

  // ── Zoom with bounds ──
  const handleWheel=useCallback(e=>{e.preventDefault();setZoom(z=>Math.max(1,Math.min(5,z+(e.deltaY>0?-0.15:0.15))))
    // Reset pan if zooming back to 1
    setZoom(z=>{if(z<=1){setPanX(0);setPanY(0)};return z})
  },[])

  // ── Pan with bounds ──
  const handleMouseDown=useCallback(e=>{if(zoom<=1)return;isPanning.current=true;panStart.current={x:e.clientX-panX,y:e.clientY-panY}},[zoom,panX,panY])
  const handleMouseMove=useCallback(e=>{
    if(isPanning.current){
      let nx=e.clientX-panStart.current.x, ny=e.clientY-panStart.current.y
      // Clamp pan so map doesn't leave viewport
      const maxPan=canvasSize*(zoom-1)/2
      nx=Math.max(-maxPan,Math.min(maxPan,nx))
      ny=Math.max(-maxPan,Math.min(maxPan,ny))
      setPanX(nx);setPanY(ny);return
    }
    // Tooltip
    if(!matchData?.players||!canvasRef.current){setTooltip(null);return}
    const rect=canvasRef.current.getBoundingClientRect()
    const mx=(e.clientX-rect.left-panX)/zoom,my=(e.clientY-rect.top-panY)/zoom,sc=canvasSize/1024
    let closest=null,minD=25/zoom
    for(const pl of matchData.players){for(const ev of(pl.events||[])){if(!visibleEvents[ev.ev])continue;const d=Math.hypot(mx-ev.px*sc,my-ev.py*sc);if(d<minD){minD=d;closest={...ev,uid:pl.uid,bot:pl.bot}}}}
    if(closest)setTooltip({x:e.clientX-rect.left+15,y:e.clientY-rect.top-10,text:`${EVENT_EMOJI[closest.ev]||'?'} ${closest.ev} ${closest.bot?'Bot':'Human'} ${closest.uid.substring(0,12)}…`})
    else setTooltip(null)
  },[matchData,canvasSize,zoom,panX,panY,visibleEvents])
  const handleMouseUp=useCallback(()=>{isPanning.current=false},[])

  // ── Playback ──
  useEffect(()=>{
    if(!isPlaying||!matchData)return;lastFrame.current=performance.now()
    const go=now=>{const dt=(now-lastFrame.current)/1000;lastFrame.current=now;setTimeProgress(p=>{const n=p+(dt*playSpeed)/5;if(n>=1){setIsPlaying(false);return 1}return n});animRef.current=requestAnimationFrame(go)}
    animRef.current=requestAnimationFrame(go);return()=>{if(animRef.current)cancelAnimationFrame(animRef.current)}
  },[isPlaying,matchData,playSpeed])

  // ── Draw compass ──
  const drawCompass=(ctx,size)=>{
    const cx=size-40,cy=40,r=18
    ctx.save()
    ctx.globalAlpha=0.85
    // Background circle
    ctx.beginPath();ctx.fillStyle='rgba(17,17,24,0.8)';ctx.arc(cx,cy,r+4,0,Math.PI*2);ctx.fill()
    ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.stroke()
    // N arrow
    ctx.beginPath();ctx.fillStyle='#ff4444';ctx.moveTo(cx,cy-r);ctx.lineTo(cx-5,cy);ctx.lineTo(cx+5,cy);ctx.closePath();ctx.fill()
    // S arrow
    ctx.beginPath();ctx.fillStyle='#666';ctx.moveTo(cx,cy+r);ctx.lineTo(cx-5,cy);ctx.lineTo(cx+5,cy);ctx.closePath();ctx.fill()
    // Labels
    ctx.fillStyle='#ff4444';ctx.font='bold 9px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle'
    ctx.fillText('N',cx,cy-r-7)
    ctx.fillStyle='#666';ctx.fillText('S',cx,cy+r+7)
    ctx.fillStyle='#888';ctx.fillText('W',cx-r-7,cy);ctx.fillText('E',cx+r+7,cy)
    ctx.globalAlpha=1.0;ctx.restore()
  }

  // ── Render ──
  const render=useCallback(()=>{
    const c=canvasRef.current;if(!c)return;const ctx=c.getContext('2d');c.width=canvasSize;c.height=canvasSize
    ctx.clearRect(0,0,canvasSize,canvasSize);ctx.fillStyle='#08080c';ctx.fillRect(0,0,canvasSize,canvasSize)
    ctx.save();ctx.translate(panX,panY);ctx.scale(zoom,zoom)
    if(mapImgRef.current){ctx.drawImage(mapImgRef.current,0,0,canvasSize,canvasSize);ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(0,0,canvasSize,canvasSize)}
    const sc=canvasSize/1024

    if(activeTab==='analytics'&&heatmapData){
      const mh=heatmapData[heatmapMap];if(mh){const dk=heatmapDay==='all'?'all':heatmapDay;const pts=(mh[dk]||mh['all']||{})[heatmapType]||[];const opt=HEATMAP_OPTIONS.find(h=>h.key===heatmapType);if(opt&&pts.length>0)drawHeatmap(ctx,pts,opt.rgb,0,canvasSize,heatmapOpacity)}
      ctx.restore();drawCompass(ctx,canvasSize);return
    }

    if(!matchData?.players){ctx.restore();drawCompass(ctx,canvasSize);return}
    const minTs=matchData.min_ts||0,maxTs=matchData.max_ts||1,tsRange=maxTs-minTs||1,curTs=minTs+timeProgress*tsRange
    let hi=0

    if(showHumanPaths){for(const pl of matchData.players){
      if(pl.bot)continue;const col=getPlayerColor(hi,false);hi++
      const path=(pl.path||[]).filter(p=>p.ts<=curTs);if(path.length<2)continue
      ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=2.5/zoom;ctx.globalAlpha=0.75
      const s0=scaleToCanvas(path[0].px,path[0].py,canvasSize);ctx.moveTo(s0.x,s0.y)
      for(let i=1;i<path.length;i++){const s=scaleToCanvas(path[i].px,path[i].py,canvasSize);ctx.lineTo(s.x,s.y)}
      ctx.stroke();ctx.globalAlpha=1.0
      if(path.length>0){const last=path[path.length-1];const p=scaleToCanvas(last.px,last.py,canvasSize);ctx.beginPath();ctx.fillStyle=col;ctx.globalAlpha=1.0;ctx.arc(p.x,p.y,5/zoom,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#000';ctx.lineWidth=0.8/zoom;ctx.stroke();ctx.globalAlpha=1.0}
    }}

    if(showBotPaths){for(const pl of matchData.players){
      if(!pl.bot)continue
      const path=(pl.path||[]).filter(p=>p.ts<=curTs);if(path.length<2)continue
      ctx.beginPath();ctx.strokeStyle='#888';ctx.lineWidth=1.5/zoom;ctx.globalAlpha=0.45
      const s0=scaleToCanvas(path[0].px,path[0].py,canvasSize);ctx.moveTo(s0.x,s0.y)
      for(let i=1;i<path.length;i++){const s=scaleToCanvas(path[i].px,path[i].py,canvasSize);ctx.lineTo(s.x,s.y)}
      ctx.stroke();ctx.globalAlpha=1.0
      if(path.length>0){const last=path[path.length-1];const p=scaleToCanvas(last.px,last.py,canvasSize);ctx.beginPath();ctx.fillStyle='#888';ctx.globalAlpha=1.0;ctx.arc(p.x,p.y,3/zoom,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#000';ctx.lineWidth=0.5/zoom;ctx.stroke();ctx.globalAlpha=1.0}
    }}

    ctx.globalAlpha=1.0
    for(const pl of matchData.players){
      for(const ev of(pl.events||[])){
        if(ev.ts>curTs||!visibleEvents[ev.ev])continue
        const op=eventOpacity[ev.ev]??1
        const p=scaleToCanvas(ev.px,ev.py,canvasSize);const emoji=EVENT_EMOJI[ev.ev];ctx.globalAlpha=op
        if(emoji){ctx.font=`${Math.round(14/zoom*canvasSize/700)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(emoji,p.x,p.y)}
        else{ctx.beginPath();ctx.fillStyle=EVENT_COLORS[ev.ev]||'#fff';ctx.arc(p.x,p.y,4/zoom,0,Math.PI*2);ctx.fill()}
      }
    }
    ctx.globalAlpha=1.0;ctx.restore()
    // Draw compass OUTSIDE zoom/pan transform
    drawCompass(ctx,canvasSize)
  },[canvasSize,matchData,heatmapData,heatmapType,heatmapMap,heatmapDay,currentMap,timeProgress,showHumanPaths,showBotPaths,visibleEvents,eventOpacity,heatmapOpacity,activeTab,imgTick,zoom,panX,panY])
  useEffect(()=>{render()},[render])

  // ── Filtered ──
  const filteredMatches=useMemo(()=>{
    if(!matchIndex)return[]
    let r=matchIndex.filter(m=>{
      if(filterMap!=='all'&&m.map!==filterMap)return false
      if(filterDay!=='all'&&m.day!==filterDay)return false
      if(searchQuery&&!m.id.toLowerCase().includes(searchQuery.toLowerCase()))return false
      if(filterStorm==='yes'&&!(m.storm_deaths>0))return false
      if(filterStorm==='no'&&m.storm_deaths>0)return false
      if(filterHumanKills==='yes'&&!((m.ev_counts?.Kill||0)>0))return false
      if(filterHumanKills==='no'&&(m.ev_counts?.Kill||0)>0)return false
      if(filterPlayerKilled==='yes'&&!((m.ev_counts?.Killed||0)>0))return false
      if(filterPlayerKilled==='no'&&(m.ev_counts?.Killed||0)>0)return false
      return true
    })
    if(sortBy==='kills')r.sort((a,b)=>b.kills-a.kills)
    else if(sortBy==='deaths')r.sort((a,b)=>b.deaths-a.deaths)
    else if(sortBy==='players')r.sort((a,b)=>(b.humans+b.bots)-(a.humans+a.bots))
    else r.sort((a,b)=>b.event_count-a.event_count)
    return r
  },[matchIndex,filterMap,filterDay,searchQuery,filterStorm,filterHumanKills,filterPlayerKilled,sortBy])

  // ── Stats ──
  const stats=useMemo(()=>{
    if(activeTab==='analytics'&&matchIndex){
      const am=matchIndex.filter(m=>m.map===heatmapMap&&(heatmapDay==='all'||m.day===heatmapDay))
      return{label:heatmapMap,matches:am.length,kills:am.reduce((s,m)=>s+m.kills,0),deaths:am.reduce((s,m)=>s+m.deaths,0),storm:am.reduce((s,m)=>s+(m.storm_deaths||0),0),loots:am.reduce((s,m)=>s+(m.loots||0),0)}
    }
    if(selectedMatch&&activeTab==='explorer')return{label:'Match',matches:1,kills:selectedMatch.kills,deaths:selectedMatch.deaths,storm:selectedMatch.storm_deaths||0,loots:selectedMatch.loots||0}
    const fm=filteredMatches;return{label:'Total',matches:fm.length,kills:fm.reduce((s,m)=>s+m.kills,0),deaths:fm.reduce((s,m)=>s+m.deaths,0),storm:fm.reduce((s,m)=>s+(m.storm_deaths||0),0),loots:fm.reduce((s,m)=>s+(m.loots||0),0)}
  },[filteredMatches,selectedMatch,activeTab,matchIndex,heatmapMap,heatmapDay])

  // ── Insights ──
  const insights=useMemo(()=>{
    if(activeTab==='analytics')return generateHeatmapInsights(heatmapData,heatmapMap,heatmapDay==='all'?'all':heatmapDay,heatmapType)
    if(matchData)return generateMatchInsights(matchData)
    return[{title:'👈 Select Data',body:'Choose a match in Explorer or switch to Analytics for map-level analysis.',metric:'',severity:'info'}]
  },[activeTab,matchData,heatmapData,heatmapMap,heatmapDay,heatmapType])

  const mapOptions=meta?.maps||['AmbroseValley','GrandRift','Lockdown']
  const dayOptions=meta?.days||[]

  // ── Upload ──
  const handleUpload=async(e)=>{
    const file=e.target.files?.[0];if(!file)return
    setUploadStatus('uploading');setUploadProgress(0);setUploadMsg('Uploading...')
    try{
      const form=new FormData();form.append('file',file)
      const res=await fetch(`${API_URL}/api/upload`,{method:'POST',body:form})
      if(!res.ok)throw new Error(`Upload failed: ${await res.text()}`)
      const{job_id}=await res.json()
      setUploadJobId(job_id);setUploadStatus('processing')
      const es=new EventSource(`${API_URL}/api/progress/${job_id}`)
      es.onmessage=ev=>{
        const d=JSON.parse(ev.data);setUploadProgress(d.progress);setUploadMsg(d.message)
        if(d.status==='complete'){
          es.close();setUploadStatus('complete')
          Promise.all([
            fetch(`${API_URL}/api/data/${job_id}/meta.json`).then(r=>r.json()),
            fetch(`${API_URL}/api/data/${job_id}/index.json`).then(r=>r.json()),
            fetch(`${API_URL}/api/data/${job_id}/heatmaps.json`).then(r=>r.json()),
          ]).then(([m,idx,heat])=>{
            setMeta(m);setMatchIndex(idx);setHeatmapData(heat)
            if(m?.maps?.[0])setHeatmapMap(m.maps[0])
            setActiveTab('explorer')
          })
        }else if(d.status==='error'){es.close();setUploadStatus('error')}
      }
      es.onerror=()=>{es.close();setUploadStatus('error');setUploadMsg('Connection to server lost. Is the backend running?')}
    }catch(err){setUploadStatus('error');setUploadMsg(err.message)}
  }

  if(loading)return<div className="app"><div className="loading-screen">Loading LILA BLACK data...</div></div>

  return(<div className="app">
    {/* LEFT SIDEBAR */}
    <div className="sidebar">
      <div className="sidebar-header"><h1>LILA BLACK</h1><p>Player Journey Visualizing Tool</p></div>
      <div className="tab-bar">
        <button className={`tab ${activeTab==='explorer'?'active':''}`} onClick={()=>setActiveTab('explorer')}>Explorer</button>
        <button className={`tab ${activeTab==='analytics'?'active':''}`} onClick={()=>setActiveTab('analytics')}>Analytics</button>
        <button className={`tab ${activeTab==='upload'?'active':''}`} onClick={()=>setActiveTab('upload')}>Upload</button>
      </div>

      {activeTab==='explorer'&&<>
        <div className="sidebar-section"><h3>Filters</h3>
          <div className="filter-row">
            <select value={filterMap} onChange={e=>{setFilterMap(e.target.value);setSelectedMatch(null)}}><option value="all">All Maps</option>{mapOptions.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <select value={filterDay} onChange={e=>{setFilterDay(e.target.value);setSelectedMatch(null)}}><option value="all">All Days</option>{dayOptions.map(d=><option key={d} value={d}>{d.replace('_',' ')}</option>)}</select>
          </div>
          <input type="text" placeholder="Search match ID..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
          <div className="filter-row" style={{marginTop:4}}>
            <select value={filterStorm} onChange={e=>setFilterStorm(e.target.value)}><option value="any">Storm: Any</option><option value="yes">Has Storm Deaths</option><option value="no">No Storm Deaths</option></select>
          </div>
          <div className="filter-row">
            <select value={filterHumanKills} onChange={e=>setFilterHumanKills(e.target.value)}><option value="any">PvP Kills: Any</option><option value="yes">Has PvP Kills</option><option value="no">No PvP Kills</option></select>
          </div>
          <div className="filter-row">
            <select value={filterPlayerKilled} onChange={e=>setFilterPlayerKilled(e.target.value)}><option value="any">Player Deaths: Any</option><option value="yes">Has Player Deaths</option><option value="no">No Player Deaths</option></select>
          </div>
          <div className="filter-row">
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="events">Sort: Events</option><option value="kills">Sort: Kills</option><option value="deaths">Sort: Deaths</option><option value="players">Sort: Players</option></select>
          </div>
        </div>
        <div className="sidebar-section"><h3>Paths</h3>
          <label className="toggle-row"><input type="checkbox" checked={showHumanPaths} onChange={e=>setShowHumanPaths(e.target.checked)}/> Human Paths</label>
          <label className="toggle-row"><input type="checkbox" checked={showBotPaths} onChange={e=>setShowBotPaths(e.target.checked)}/> Bot Paths</label>
        </div>
        <div className="sidebar-section"><h3>Events</h3>
          {Object.entries(EVENT_EMOJI).map(([ev,emoji])=><div key={ev} className="event-row">
            <label className="toggle-row" style={{flex:'0 0 auto'}}><input type="checkbox" checked={visibleEvents[ev]} onChange={e=>setVisibleEvents(p=>({...p,[ev]:e.target.checked}))}/> {emoji} {ev}</label>
            {visibleEvents[ev]&&<input type="range" className="opacity-slider" min="0.1" max="1" step="0.1" value={eventOpacity[ev]??1} onChange={e=>setEventOpacity(p=>({...p,[ev]:+e.target.value}))} title={`Opacity: ${Math.round((eventOpacity[ev]??1)*100)}%`}/>}
          </div>)}
        </div>
        {zoom>1&&<div className="sidebar-section"><h3>Zoom {zoom.toFixed(1)}x</h3><button className="btn" onClick={()=>{setZoom(1);setPanX(0);setPanY(0)}} style={{width:'100%'}}>Reset</button><p className="sidebar-hint" style={{marginTop:3}}>Scroll to zoom, drag to pan</p></div>}
        <div className="sidebar-section" style={{padding:'6px 12px 2px'}}><h3>Matches ({filteredMatches.length})</h3></div>
        <div className="sidebar-scroll"><div style={{padding:'0 12px 12px'}}>
          {filteredMatches.slice(0,80).map(m=>(
            <div key={m.id} className={`match-item ${selectedMatch?.id===m.id?'selected':''}`} onClick={()=>setSelectedMatch(m)}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span className="match-map">{m.map}</span><span className="match-day">{(m.day||'').replace('_',' ')}</span></div>
              <div className="match-meta"><span>{m.humans}H+{m.bots}B</span><span>⚔️{m.kills}</span><span>💀{m.deaths}</span><span>{formatDuration(m.dur_ms)}</span></div>
            </div>
          ))}
        </div></div>
        {matchData&&<div className="sidebar-section player-list">
          <h3>Players ({(matchData.players||[]).filter(p=>!p.bot).length}H + {(matchData.players||[]).filter(p=>p.bot).length}B)</h3>
          {(matchData.players||[]).sort((a,b)=>a.bot-b.bot).map((p,i)=>(
            <div key={p.uid} className="player-item"><div className="player-dot" style={{background:getPlayerColor(i,p.bot)}}/><span className={`player-tag ${p.bot?'bot':'human'}`}>{p.bot?'BOT':'HUMAN'}</span><span className="player-uid">{p.uid}</span></div>
          ))}
        </div>}
      </>}

      {activeTab==='analytics'&&<>
        <div className="sidebar-section"><h3>Map & Day</h3>
          <div className="filter-row"><select value={heatmapMap} onChange={e=>setHeatmapMap(e.target.value)}>{mapOptions.map(m=><option key={m} value={m}>{m}</option>)}</select><select value={heatmapDay} onChange={e=>setHeatmapDay(e.target.value)}><option value="all">All Days</option>{dayOptions.map(d=><option key={d} value={d}>{d.replace('_',' ')}</option>)}</select></div>
        </div>
        <div className="sidebar-section"><h3>Overlay</h3>
          <div className="button-group">{HEATMAP_OPTIONS.map(h=>(<button key={h.key} className={`btn ${heatmapType===h.key?'active':''}`} onClick={()=>setHeatmapType(h.key)} style={heatmapType===h.key?{background:`rgb(${h.rgb})`,borderColor:`rgb(${h.rgb})`}:{}}>{h.label}</button>))}</div>
        </div>
        <div className="sidebar-section"><h3>Opacity {Math.round(heatmapOpacity*100)}%</h3>
          <input type="range" className="opacity-slider full" min="0.1" max="1" step="0.05" value={heatmapOpacity} onChange={e=>setHeatmapOpacity(+e.target.value)}/>
        </div>
        <div className="sidebar-section"><h3>About</h3><p className="sidebar-hint">
          {heatmapType==='kills'&&'Kill locations. Bright = frequent combat.'}
          {heatmapType==='deaths'&&'Death locations. Clusters = chokepoints.'}
          {heatmapType==='storm'&&'Storm deaths. Clusters = poor escapes.'}
          {heatmapType==='loot'&&'Loot pickups. Distribution patterns.'}
          {heatmapType==='traffic'&&'Movement density. Dark = ignored areas.'}
        </p></div>
      </>}

      {activeTab==='upload'&&<>
        <div className="sidebar-section"><h3>Upload Dataset</h3>
          <p className="sidebar-hint" style={{marginBottom:8}}>Upload a player_data.zip. The server processes it automatically with full progress tracking.</p>
          <label className="upload-btn">
            {uploadStatus==='uploading'||uploadStatus==='processing'?'Processing...':'Choose ZIP File'}
            <input type="file" accept=".zip" onChange={handleUpload} style={{display:'none'}} disabled={uploadStatus==='uploading'||uploadStatus==='processing'}/>
          </label>
          {uploadProgress>0&&<div className="progress-bar"><div className="progress-fill" style={{width:`${uploadProgress}%`}}/></div>}
          {uploadMsg&&<pre className={`upload-status ${uploadStatus||''}`}>{uploadMsg}</pre>}
        </div>
        <div className="sidebar-section"><h3>Manual Alternative</h3>
          <div className="upload-steps">
            <div className="upload-step">1. Extract zip into <code>player_data/</code></div>
            <div className="upload-step">2. <code>cp minimaps/* public/minimaps/</code></div>
            <div className="upload-step">3. <code>python scripts/process_data.py</code></div>
            <div className="upload-step">4. Reload page</div>
          </div>
        </div>
      </>}
    </div>

    {/* CENTER MAP */}
    <div className="main">
      <div className="topbar">
        <div className="topbar-info">
          {activeTab==='analytics'?<><span>{heatmapMap}</span> {HEATMAP_OPTIONS.find(h=>h.key===heatmapType)?.label} {heatmapDay==='all'?'All Days':heatmapDay.replace('_',' ')}</>
           :activeTab==='upload'?<span>Upload new dataset</span>
           :matchData?<><span>{matchData.map}</span> {(matchData.day||'').replace('_',' ')} {Math.round(timeProgress*100)}%</>
           :<><span>LILA BLACK</span> {filteredMatches.length} matches</>}
        </div>
        <div className="stats-bar">
          <div className="stat"><div className="stat-value">{stats.matches}</div><div className="stat-label">{stats.label==='Match'?'Match':'Matches'}</div></div>
          <div className="stat"><div className="stat-value">{stats.kills}</div><div className="stat-label">Kills</div></div>
          <div className="stat"><div className="stat-value">{stats.deaths}</div><div className="stat-label">Deaths</div></div>
          <div className="stat"><div className="stat-value">{stats.storm}</div><div className="stat-label">Storm</div></div>
          <div className="stat"><div className="stat-value">{stats.loots}</div><div className="stat-label">Loots</div></div>
        </div>
        <button className={`btn insights-toggle ${showInsights?'active':''}`} onClick={()=>setShowInsights(!showInsights)}>{showInsights?'◀ Hide':'▶ Show'} Insights</button>
      </div>

      <div className="canvas-wrapper" ref={wrapperRef}>
        {matchLoading?<div className="loading-screen">Loading match...</div>
          :activeTab==='upload'&&!matchData?<div className="empty-state"><h2>Upload Dataset</h2><p>Use the sidebar to upload a zip file.</p></div>
          :activeTab==='explorer'&&!matchData?<div className="empty-state"><h2>Select a Match</h2><p>Pick a match from the sidebar.<br/>Scroll to zoom, drag to pan.</p></div>
          :<canvas ref={canvasRef} width={canvasSize} height={canvasSize} style={{width:canvasSize,height:canvasSize,cursor:zoom>1?'grab':'crosshair'}} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={()=>{isPanning.current=false;setTooltip(null)}}/>}
        {tooltip&&<div className="tooltip" style={{left:tooltip.x,top:tooltip.y}}>{tooltip.text}</div>}
        {(matchData||activeTab==='analytics')&&activeTab!=='upload'&&<div className="legend"><h4>Legend</h4>
          {activeTab==='explorer'&&matchData&&<>{Object.entries(EVENT_EMOJI).map(([t,e])=><div key={t} className="legend-item" style={{opacity:visibleEvents[t]?1:0.3}}><span className="legend-emoji">{e}</span><span>{t}</span></div>)}<div className="legend-item"><div className="legend-color" style={{background:'#44aaff'}}/><span>Human</span></div><div className="legend-item"><div className="legend-color" style={{background:'#888'}}/><span>Bot</span></div></>}
          {activeTab==='analytics'&&<div className="legend-item"><div className="legend-color" style={{background:`rgb(${HEATMAP_OPTIONS.find(h=>h.key===heatmapType)?.rgb||[255,255,255]})`}}/><span>{HEATMAP_OPTIONS.find(h=>h.key===heatmapType)?.label}</span></div>}
        </div>}
      </div>

      {activeTab==='explorer'&&matchData&&<div className="timeline">
        <div className="timeline-controls">
          <button className={`timeline-btn ${isPlaying?'playing':''}`} onClick={()=>{if(timeProgress>=1)setTimeProgress(0);setIsPlaying(!isPlaying)}}>{isPlaying?'⏸':'▶'}</button>
          <button className="timeline-btn" onClick={()=>{setTimeProgress(0);setIsPlaying(false)}}>⏮</button>
          <button className="timeline-btn" onClick={()=>{setTimeProgress(1);setIsPlaying(false)}}>⏭</button>
        </div>
        <div className="timeline-slider"><input type="range" min="0" max="1" step="0.001" value={timeProgress} onChange={e=>{setTimeProgress(+e.target.value);setIsPlaying(false)}}/></div>
        <div className="speed-controls">{[0.1,0.25,0.5,1,2,5].map(s=><button key={s} className={`speed-btn ${playSpeed===s?'active':''}`} onClick={()=>setPlaySpeed(s)}>{s}x</button>)}</div>
        <div className="timeline-time">{Math.round(timeProgress*100)}%</div>
      </div>}
    </div>

    {/* RIGHT INSIGHTS PANEL */}
    {showInsights&&<div className="insights-panel">
      <div className="insights-header"><h3>Insights</h3></div>
      <div className="insights-scroll">
        {insights.map((ins,i)=>(<div key={i} className={`insight-card ${ins.severity}`}><div className="insight-top"><span className="insight-title">{ins.title}</span><span className="insight-metric">{ins.metric}</span></div><p className="insight-body">{ins.body}</p></div>))}
      </div>
    </div>}
  </div>)
}
