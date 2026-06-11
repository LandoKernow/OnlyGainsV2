// Renders the war card to a real 1080x1920 PNG on an offscreen canvas, then
// shares it as a file (native share sheet -> Instagram story) with graceful
// fallbacks. No dependencies, no network — works fully offline.

import { formatActivityValue } from './activity'
import { shareOnlyGains } from './shareApp'

const W = 1080
const H = 1920

function roundRectPath(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    return
  }

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function font(weight, size) {
  return `${weight} ${size}px "Segoe UI", system-ui, -apple-system, sans-serif`
}

function drawCentered(ctx, text, x, y, fillStyle, fontSpec, letterSpacing = 0) {
  ctx.save()
  ctx.font = fontSpec
  ctx.fillStyle = fillStyle
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  if (letterSpacing > 0) {
    // Manual letter spacing for the chunky uppercase labels.
    const chars = [...text]
    const widths = chars.map((char) => ctx.measureText(char).width + letterSpacing)
    const totalWidth = widths.reduce((sum, value) => sum + value, 0) - letterSpacing
    let cursor = x - totalWidth / 2
    ctx.textAlign = 'left'

    chars.forEach((char, index) => {
      ctx.fillText(char, cursor, y)
      cursor += widths[index]
    })
  } else {
    ctx.fillText(text, x, y)
  }

  ctx.restore()
}

export async function renderWarCardImage(card) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas unavailable')
  }

  // Base background.
  const base = ctx.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0, '#1c1310')
  base.addColorStop(1, '#0a0708')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  // Orange glow from the top.
  const glow = ctx.createRadialGradient(W / 2, -120, 120, W / 2, -120, 1000)
  glow.addColorStop(0, 'rgba(213, 106, 44, 0.55)')
  glow.addColorStop(1, 'rgba(213, 106, 44, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Scanlines.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
  for (let y = 0; y < H; y += 6) {
    ctx.fillRect(0, y, W, 2)
  }

  // Border frame.
  ctx.strokeStyle = 'rgba(213, 106, 44, 0.55)'
  ctx.lineWidth = 4
  roundRectPath(ctx, 24, 24, W - 48, H - 48, 48)
  ctx.stroke()

  const pad = 96

  // Brand + tier row.
  drawCentered(ctx, 'ONLY GAINS', pad + 150, 180, '#d56a2c', font(700, 34), 10)

  const tierText = String(card.tier || 'RECRUIT')
  ctx.font = font(800, 34)
  const tierWidth = ctx.measureText(tierText).width + 70
  const tierX = W - pad - tierWidth
  const tierGrad = ctx.createLinearGradient(tierX, 0, tierX + tierWidth, 0)
  tierGrad.addColorStop(0, '#d56a2c')
  tierGrad.addColorStop(1, '#f7a15c')
  ctx.fillStyle = tierGrad
  roundRectPath(ctx, tierX, 150, tierWidth, 56, 28)
  ctx.fill()
  drawCentered(ctx, tierText, tierX + tierWidth / 2, 190, '#140d0a', font(800, 30), 4)

  // Hit block.
  drawCentered(ctx, 'REP COUNTED. WEAKNESS DENIED.', W / 2, 620, '#bdaea2', font(600, 32), 6)

  ctx.save()
  ctx.shadowColor = 'rgba(213, 106, 44, 0.65)'
  ctx.shadowBlur = 60
  const hitText = `+${formatActivityValue(card.value, card.activityType)}`
  drawCentered(ctx, hitText, W / 2, 820, '#fff7f1', font(800, 200))
  ctx.restore()

  drawCentered(ctx, String(card.warriorName || 'WARRIOR').toUpperCase(), W / 2, 920, '#f7f1eb', font(700, 48), 3)

  if (card.levelLabel) {
    drawCentered(ctx, String(card.levelLabel).toUpperCase(), W / 2, 975, '#d56a2c', font(700, 32), 5)
  }

  let cursorY = 1030

  // Combo earns the banner slot when no milestone claimed it.
  if (!card.milestone && card.combo >= 2) {
    card = { ...card, milestone: `×${card.combo} HEAVY COMBO. STILL HUNGRY.` }
  }

  // Milestone banner.
  if (card.milestone) {
    ctx.fillStyle = 'rgba(213, 106, 44, 0.16)'
    ctx.strokeStyle = 'rgba(213, 106, 44, 0.5)'
    ctx.lineWidth = 2
    roundRectPath(ctx, pad, cursorY, W - pad * 2, 96, 24)
    ctx.fill()
    ctx.stroke()
    drawCentered(ctx, card.milestone, W / 2, cursorY + 60, '#ffe8d4', font(800, 32))
    cursorY += 150
  }

  // Stat boxes.
  const rankLabel = Number.isFinite(card.rank) && card.rank > 0 ? `#${card.rank}` : 'UNRANKED'
  const stats = [
    { label: 'RANK', value: rankLabel },
    { label: 'WEEK', value: formatActivityValue(card.weeklyTotal, card.activityType) },
    { label: 'STREAK', value: card.streakDays > 0 ? `${card.streakDays}` : '0' },
  ]
  const gap = 28
  const boxWidth = (W - pad * 2 - gap * 2) / 3
  const boxY = cursorY
  const boxHeight = 200

  stats.forEach((stat, index) => {
    const x = pad + index * (boxWidth + gap)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 2
    roundRectPath(ctx, x, boxY, boxWidth, boxHeight, 28)
    ctx.fill()
    ctx.stroke()
    drawCentered(ctx, stat.label, x + boxWidth / 2, boxY + 60, '#bdaea2', font(700, 28), 5)
    drawCentered(ctx, stat.value, x + boxWidth / 2, boxY + 150, '#fff4ed', font(800, 76))
  })

  cursorY = boxY + boxHeight + 120

  // Tagline.
  drawCentered(ctx, String(card.tagline || 'THE BOARD SAW IT.').toUpperCase(), W / 2, cursorY, '#ffffff', font(800, 44), 2)

  // Footer.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(pad, H - 200)
  ctx.lineTo(W - pad, H - 200)
  ctx.stroke()

  ctx.save()
  ctx.font = font(700, 30)
  ctx.fillStyle = '#bdaea2'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillText(String(card.boardName || 'GLOBAL BOARD').toUpperCase(), pad, H - 140)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#d56a2c'
  ctx.fillText('onlygains.club', W - pad, H - 140)
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not export war card'))
      }
    }, 'image/png')
  })
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Generic share ladder for any rendered card blob:
// native file share (Instagram story) -> download -> link-as-text.
// Returns: 'shared' | 'downloaded' | 'copied' | 'cancelled'
export async function shareCardBlob(blob, { filename, text }) {
  if (blob && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' })

    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Only Gains',
          text,
        })
        return 'shared'
      } catch (error) {
        if (error?.name === 'AbortError') {
          return 'cancelled'
        }
        // fall through to download
      }
    }
  }

  if (blob) {
    downloadBlob(blob, filename)
    return 'downloaded'
  }

  // Last resort: share the link as text.
  return shareOnlyGains()
}

// Returns: 'shared' | 'downloaded' | 'copied' | 'cancelled'
export async function shareWarCardImage(card) {
  let blob = null

  try {
    blob = await renderWarCardImage(card)
  } catch {
    blob = null
  }

  return shareCardBlob(blob, {
    filename: 'only-gains-war-card.png',
    text: 'Logged. No hiding now. Only Gains: https://onlygains.club',
  })
}
