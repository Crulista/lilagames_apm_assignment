/**
 * Smart Insights Generator for LILA BLACK (Extraction Shooter)
 * Produces level-designer-actionable insights from match and heatmap data.
 */

export function generateMatchInsights(matchData) {
  if (!matchData?.players) return []
  const ins = []
  const players = matchData.players || []
  const humans = players.filter(p => !p.bot), bots = players.filter(p => p.bot)
  const allEvts = players.flatMap(p => p.events || [])
  const kills = allEvts.filter(e => e.ev === 'Kill')
  const botKills = allEvts.filter(e => e.ev === 'BotKill')
  const deaths = allEvts.filter(e => e.ev === 'Killed' || e.ev === 'BotKilled')
  const stormDeaths = allEvts.filter(e => e.ev === 'KilledByStorm')
  const loots = allEvts.filter(e => e.ev === 'Loot')
  const allPaths = players.flatMap(p => p.path || [])

  // 1. Bot ratio
  const botRatio = bots.length / (players.length || 1)
  if (botRatio > 0.8) {
    ins.push({ title: '🤖 High Bot Ratio', body: `${Math.round(botRatio*100)}% bots (${bots.length}B vs ${humans.length}H). Matches dominated by bots can feel artificial. In extraction shooters, bot encounters should complement PvP tension, not replace it. Consider reducing bot count or making bots patrol high-value loot areas to create risk-reward decisions.`, metric: `${bots.length}B/${humans.length}H`, severity: 'warning' })
  } else if (botRatio > 0.5) {
    ins.push({ title: '🤖 Moderate Bot Fill', body: `${Math.round(botRatio*100)}% of players are bots. This is typical for extraction shooters but monitor if players are avoiding PvP by farming bots instead.`, metric: `${bots.length}B/${humans.length}H`, severity: 'info' })
  }

  // 2. Bot farming detection
  if (botKills.length > kills.length * 2 && botKills.length > 2) {
    ins.push({ title: '🎯 Bot Farming Pattern', body: `${botKills.length} bot kills vs ${kills.length} PvP kills. Players may be prioritizing safe bot eliminations over engaging humans. Suggestion: reduce bot density in early zones or make bot loot less valuable to encourage PvP encounters near high-tier loot.`, metric: `${botKills.length} bot kills`, severity: 'warning' })
  }

  // 3. Storm deaths
  if (stormDeaths.length > 0) {
    const stormQuads = getQuadrants(stormDeaths)
    const worstQuad = Object.entries(stormQuads).sort((a,b) => b[1]-a[1])[0]
    ins.push({ title: '🌩️ Storm Casualties', body: `${stormDeaths.length} storm death${stormDeaths.length>1?'s':''}. ${stormDeaths.length > 2 ? `Most concentrated in the ${worstQuad[0]} quadrant (${worstQuad[1]} deaths). This area likely has poor escape routes or terrain bottlenecks. Consider adding alternate paths or extraction points nearby.` : 'Check the death location for terrain chokepoints.'}`, metric: `${stormDeaths.length} deaths`, severity: stormDeaths.length > 2 ? 'warning' : 'info' })
  }

  // 4. Combat clustering
  const combat = [...kills, ...botKills, ...deaths]
  if (combat.length > 3) {
    const quads = getQuadrants(combat)
    const entries = Object.entries(quads).sort((a,b) => b[1]-a[1])
    const hotQuad = entries[0], coldQuad = entries[entries.length-1]
    if (hotQuad[1] > combat.length * 0.5) {
      ins.push({ title: '🔥 Combat Hotspot', body: `${Math.round(hotQuad[1]/combat.length*100)}% of combat in the ${hotQuad[0]} area. In extraction shooters, concentrated combat zones create predictable encounters. Players may learn to avoid this area entirely or camp it. Consider distributing high-value objectives across the map to spread engagement.`, metric: `${hotQuad[1]}/${combat.length} events`, severity: 'warning' })
    }
    if (coldQuad[1] < combat.length * 0.1) {
      ins.push({ title: '🏜️ Dead Zone Detected', body: `The ${coldQuad[0]} area has almost no combat activity (${coldQuad[1]} events). This part of the map isn't creating interesting gameplay moments. Suggestions: add a high-tier loot cache, place an extraction point, or route bot patrols through this area.`, metric: `${coldQuad[1]} events`, severity: 'info' })
    }
  }

  // 5. Loot analysis
  if (loots.length > 0) {
    const lootQuads = getQuadrants(loots)
    const entries = Object.entries(lootQuads).sort((a,b) => b[1]-a[1])
    if (entries[0][1] > loots.length * 0.5) {
      ins.push({ title: '📦 Loot Imbalance', body: `Over ${Math.round(entries[0][1]/loots.length*100)}% of loot pickups in the ${entries[0][0]} area. Players are gravitating to one zone for loot. Spread high-value items more evenly to encourage full-map exploration and create more diverse encounter patterns.`, metric: `${loots.length} pickups`, severity: 'info' })
    }
  }

  // 6. Path coverage analysis (how much of the map is used)
  if (allPaths.length > 10) {
    const coverage = getGridCoverage(allPaths, 128) // 128px grid = 8x8 grid on 1024
    if (coverage < 40) {
      ins.push({ title: '🗺️ Low Map Utilization', body: `Players only utilized approximately ${coverage}% of the map area. Large portions are being ignored. For an extraction shooter, dead zones reduce replayability. Add points of interest, loot caches, or environmental storytelling in underused areas.`, metric: `${coverage}% used`, severity: 'warning' })
    } else if (coverage > 70) {
      ins.push({ title: '✅ Good Map Coverage', body: `Players explored approximately ${coverage}% of the map. Good distribution of movement suggests the map layout effectively encourages exploration.`, metric: `${coverage}% used`, severity: 'ok' })
    }
  }

  // 7. Early vs late game analysis
  if (allEvts.length > 5 && matchData.min_ts && matchData.max_ts) {
    const midTs = matchData.min_ts + (matchData.max_ts - matchData.min_ts) / 2
    const earlyKills = combat.filter(e => e.ts <= midTs).length
    const lateKills = combat.filter(e => e.ts > midTs).length
    if (earlyKills > lateKills * 3 && earlyKills > 3) {
      ins.push({ title: '⏱️ Front-Loaded Combat', body: `${earlyKills} combat events in the first half vs ${lateKills} in the second half. Most action happens early, then the match quiets down. This could mean players are extracting too early or the storm isn't creating enough late-game tension. Consider increasing late-game loot spawns or creating extraction windows that encourage staying longer.`, metric: `${earlyKills} early / ${lateKills} late`, severity: 'info' })
    } else if (lateKills > earlyKills * 3 && lateKills > 3) {
      ins.push({ title: '⏱️ Late-Game Heavy', body: `Most combat (${lateKills} events) happens in the second half. The early game may lack engagement. Consider adding early-game objectives or reducing initial safe zones to create quicker first encounters.`, metric: `${earlyKills} early / ${lateKills} late`, severity: 'info' })
    }
  }

  if (ins.length === 0) {
    ins.push({ title: '✅ Normal Match', body: `Standard gameplay patterns. ${humans.length} humans, ${bots.length} bots, ${allEvts.length} events.`, metric: `${allEvts.length} events`, severity: 'ok' })
  }

  return ins
}

export function generateHeatmapInsights(heatmapData, mapId, dayKey, heatmapType) {
  if (!heatmapData?.[mapId]) return []
  const ins = []
  const mapData = heatmapData[mapId]
  const dayData = mapData[dayKey] || mapData['all'] || {}
  const points = dayData[heatmapType] || []

  if (points.length === 0) {
    return [{ title: 'No Data', body: `No ${heatmapType} events for this selection.`, metric: '0', severity: 'info' }]
  }

  // Quadrant analysis
  const quads = getQuadrants(points)
  const entries = Object.entries(quads).sort((a,b) => b[1]-a[1])
  const dominant = entries[0], weakest = entries[entries.length-1]

  ins.push({
    title: `📊 ${capitalize(heatmapType)} Distribution`,
    body: `${points.length} total events. Strongest in ${dominant[0]} (${dominant[1]} events, ${Math.round(dominant[1]/points.length*100)}%). Weakest in ${weakest[0]} (${weakest[1]} events, ${Math.round(weakest[1]/points.length*100)}%).`,
    metric: `${points.length} total`, severity: 'info',
  })

  // Imbalance detection
  if (dominant[1] > points.length * 0.45) {
    const typeAdvice = {
      kills: 'Combat is concentrated. Players may be camping one zone. Redistribute high-value loot to draw fights elsewhere.',
      deaths: 'Death clustering suggests a chokepoint or unfair sightline. Check geometry in this area.',
      storm: 'Storm deaths concentrate here. This area likely has poor escape routes. Add alternate paths or wider corridors.',
      loot: 'Loot is concentrated. Players will beeline here every match, making gameplay predictable.',
      traffic: 'Heavy traffic in one zone means other areas are underused. Add objectives or loot in quiet zones.',
    }
    ins.push({
      title: `⚠️ ${capitalize(heatmapType)} Imbalance`,
      body: `${Math.round(dominant[1]/points.length*100)}% concentrated in ${dominant[0]}. ${typeAdvice[heatmapType] || 'Consider redistributing across the map.'}`,
      metric: `${dominant[1]} in ${dominant[0]}`, severity: 'warning',
    })
  }

  // Low activity zone
  if (weakest[1] < points.length * 0.1) {
    ins.push({
      title: `🏜️ Underserved Zone: ${weakest[0]}`,
      body: `Only ${Math.round(weakest[1]/points.length*100)}% of ${heatmapType} events in ${weakest[0]}. This area needs attention. For extraction shooters, every zone should offer a reason to visit — loot, objectives, or strategic positioning.`,
      metric: `${weakest[1]} events`, severity: 'info',
    })
  }

  // Day comparison
  const allDays = Object.keys(mapData).filter(k => k !== 'all')
  if (allDays.length > 1 && dayKey === 'all') {
    const dc = allDays.map(d => ({
      day: d, count: (mapData[d]?.[heatmapType] || []).length
    })).sort((a,b) => b.count - a.count)
    if (dc.length >= 2 && dc[0].count > 0) {
      const change = dc.length >= 2 ? Math.round((dc[0].count - dc[dc.length-1].count) / dc[0].count * 100) : 0
      ins.push({
        title: '📅 Day-over-Day',
        body: `Peak: ${dc[0].day.replace('_',' ')} (${dc[0].count}). Low: ${dc[dc.length-1].day.replace('_',' ')} (${dc[dc.length-1].count}). ${change > 50 ? 'Significant variance suggests player population changes or matchmaking shifts.' : 'Relatively stable across days.'}`,
        metric: `${change}% variance`, severity: change > 50 ? 'info' : 'ok',
      })
    }
  }

  // Extraction shooter specific: coverage for traffic
  if (heatmapType === 'traffic') {
    const coverage = getGridCoverage(points, 128)
    ins.push({
      title: '🗺️ Map Coverage',
      body: `Players utilize approximately ${coverage}% of the map area on ${mapId}. ${coverage < 40 ? 'Large dead zones exist. Add extraction points, loot, or objectives in underused areas to improve replayability.' : coverage > 70 ? 'Good map utilization. Players are exploring most of the map.' : 'Moderate utilization. Some areas could benefit from added incentives.'}`,
      metric: `${coverage}%`, severity: coverage < 40 ? 'warning' : 'ok',
    })
  }

  return ins
}

// ── Helpers ──

function getQuadrants(events) {
  const q = { 'NW': 0, 'NE': 0, 'SW': 0, 'SE': 0 }
  for (const e of events) {
    const x = e.px || e.x || 0, y = e.py || e.y || 0
    const key = (x < 512 ? 'N' : 'S') + (y < 512 ? 'W' : 'E')
    // Swap: in image coords, low Y = top = North
    const realKey = (y < 512 ? 'N' : 'S') + (x < 512 ? 'W' : 'E')
    q[realKey] = (q[realKey] || 0) + 1
  }
  return q
}

function getGridCoverage(points, gridSize) {
  const visited = new Set()
  for (const p of points) {
    const gx = Math.floor((p.px || 0) / gridSize)
    const gy = Math.floor((p.py || 0) / gridSize)
    visited.add(`${gx},${gy}`)
  }
  const totalCells = Math.ceil(1024 / gridSize) ** 2
  return Math.round(visited.size / totalCells * 100)
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }
