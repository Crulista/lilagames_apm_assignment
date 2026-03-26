/**
 * Adaptive heatmap renderer.
 * Auto-adjusts radius, sampling rate, and intensity based on point density.
 *
 * < 50 points:   radius 24, glow effect, full intensity
 * 50-500:        radius 16, normal
 * 500-2000:      radius 12, slightly reduced intensity
 * 2000+:         radius 6, sampled down to ~2000 points
 */
export function drawHeatmap(ctx, points, rgbColor, baseRadius, canvasSize, opacity = 1.0) {
  if (!points || points.length === 0) return

  const n = points.length
  let radius, sampleRate, intensityMul

  if (n < 50) {
    radius = 24; sampleRate = 1; intensityMul = 4.0  // glow
  } else if (n < 500) {
    radius = 16; sampleRate = 1; intensityMul = 2.5
  } else if (n < 2000) {
    radius = 12; sampleRate = 1; intensityMul = 2.0
  } else {
    radius = 6; sampleRate = Math.ceil(n / 2000); intensityMul = 1.8
  }

  const off = document.createElement('canvas')
  off.width = canvasSize; off.height = canvasSize
  const g = off.getContext('2d')
  const sc = canvasSize / 1024

  let drawn = 0
  for (let i = 0; i < points.length; i += sampleRate) {
    const p = points[i]
    const x = p.px * sc, y = p.py * sc
    const gr = g.createRadialGradient(x, y, 0, x, y, radius)
    gr.addColorStop(0, 'rgba(255,255,255,0.25)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    drawn++
  }

  const id = g.getImageData(0, 0, canvasSize, canvasSize), d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255
    if (a > 0.01) {
      d[i] = rgbColor[0]
      d[i + 1] = rgbColor[1]
      d[i + 2] = rgbColor[2]
      d[i + 3] = Math.min(255, a * 255 * intensityMul * opacity)
    }
  }
  g.putImageData(id, 0, 0)
  ctx.drawImage(off, 0, 0)
}
