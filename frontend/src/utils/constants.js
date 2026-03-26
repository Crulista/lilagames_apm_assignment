/**
 * LILA BLACK Visualization Constants & Utilities
 */

// Known map images — new maps would need their images added to public/minimaps/
export const MAP_IMAGES = {
  AmbroseValley: 'minimaps/AmbroseValley_Minimap.png',
  GrandRift: 'minimaps/GrandRift_Minimap.png',
  Lockdown: 'minimaps/Lockdown_Minimap.jpg',
}

export function scaleToCanvas(px, py, canvasSize) {
  const s = canvasSize / 1024
  return { x: px * s, y: py * s }
}

const HUMAN_COLORS = [
  '#44aaff','#ff44aa','#44ffaa','#ffaa44','#aa44ff','#ff4444',
  '#44ffff','#ffff44','#aa88ff','#ff88aa','#88ffaa','#ffaa88',
]
export function getPlayerColor(i, isBot) {
  return isBot ? '#888888' : HUMAN_COLORS[i % HUMAN_COLORS.length]
}

export function formatDuration(ms) {
  if (!ms || !isFinite(ms) || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export const EVENT_EMOJI = {
  Kill:'⚔️', BotKill:'🤖', Killed:'💀', BotKilled:'☠️', KilledByStorm:'🌩️', Loot:'📦',
}
export const EVENT_COLORS = {
  Kill:'#ff3333', BotKill:'#ff8833', Killed:'#cc0000',
  BotKilled:'#993300', KilledByStorm:'#aa44ff', Loot:'#33ff88',
}
export const HEATMAP_OPTIONS = [
  {key:'kills',  label:'Kill Zones',  rgb:[255,50,50]},
  {key:'deaths', label:'Death Zones', rgb:[200,0,0]},
  {key:'storm',  label:'Storm Deaths',rgb:[170,68,255]},
  {key:'loot',   label:'Loot Spots',  rgb:[50,255,120]},
  {key:'traffic',label:'Traffic',      rgb:[255,200,40]},
]
