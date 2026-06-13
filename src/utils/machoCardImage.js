// Renders the macho takeover to a story-sized PNG: the dealt photo as a
// full-bleed background, dark legibility gradients, the earned stat in heavy
// type, and the brand. Same zero-dependency canvas approach as the war card.

import { shareCardBlob } from './warCardImage'
import { PUBLIC_BASE_URL } from '../lib/publicUrl'

const W = 1080
const H = 1920

function font(weight, size) {
  return `${weight} ${size}px "Segoe UI", system-ui, -apple-system, sans-serif`
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${src}`))
    image.src = src
  })
}

// Cover-fit: fill the full canvas, crop overflow, never stretch.
function drawCover(ctx, image) {
  const scale = Math.max(W / image.width, H / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  ctx.drawImage(image, (W - drawWidth) / 2, (H - drawHeight) / 2, drawWidth, drawHeight)
}

function drawCentered(ctx, text, y, fillStyle, fontSpec, letterSpacing = 0) {
  ctx.save()
  ctx.font = fontSpec
  ctx.fillStyle = fillStyle
  ctx.textBaseline = 'alphabetic'

  if (letterSpacing > 0) {
    const chars = [...text]
    const widths = chars.map((char) => ctx.measureText(char).width + letterSpacing)
    const totalWidth = widths.reduce((sum, value) => sum + value, 0) - letterSpacing
    let cursor = W / 2 - totalWidth / 2
    ctx.textAlign = 'left'

    chars.forEach((char, index) => {
      ctx.fillText(char, cursor, y)
      cursor += widths[index]
    })
  } else {
    ctx.textAlign = 'center'
    ctx.fillText(text, W / 2, y)
  }

  ctx.restore()
}

// card: { imageSrc, stat, sub, tagline, warriorName, boardName }
export async function renderMachoCardImage(card) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas unavailable')
  }

  // Photo background (falls back to flat dark if the image fails).
  ctx.fillStyle = '#0a0708'
  ctx.fillRect(0, 0, W, H)

  try {
    const image = await loadImage(card.imageSrc)
    drawCover(ctx, image)
  } catch {
    // Flat dark background already painted.
  }

  // Legibility gradients: heavy at the bottom (where the stat lives),
  // light at the top (brand).
  const top = ctx.createLinearGradient(0, 0, 0, 360)
  top.addColorStop(0, 'rgba(8, 5, 4, 0.85)')
  top.addColorStop(1, 'rgba(8, 5, 4, 0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 360)

  const bottom = ctx.createLinearGradient(0, H - 980, 0, H)
  bottom.addColorStop(0, 'rgba(8, 5, 4, 0)')
  bottom.addColorStop(0.45, 'rgba(8, 5, 4, 0.78)')
  bottom.addColorStop(1, 'rgba(8, 5, 4, 0.95)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, H - 980, W, 980)

  // Brand.
  drawCentered(ctx, 'ONLY GAINS', 150, '#d56a2c', font(800, 44), 12)

  // Crown cards are visually distinct: a tier band + a three-discipline stat
  // row, instead of one giant number. Treble gets the gold treatment.
  if (card.crown) {
    return finishCrownCard(ctx, canvas, card)
  }

  // Stat block, lower third.
  let cursorY = H - 640

  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
  ctx.shadowBlur = 40
  drawCentered(ctx, String(card.stat ?? ''), cursorY, '#fff7f1', font(800, 190))
  ctx.restore()

  cursorY += 90

  if (card.sub) {
    drawCentered(ctx, String(card.sub).toUpperCase(), cursorY, '#f0c9a8', font(700, 42), 6)
    cursorY += 110
  }

  if (card.tagline) {
    drawCentered(ctx, String(card.tagline).toUpperCase(), cursorY, '#ffffff', font(800, 50), 2)
    cursorY += 90
  }

  if (card.warriorName) {
    drawCentered(ctx, String(card.warriorName).toUpperCase(), cursorY, '#bdaea2', font(700, 38), 4)
  }

  // Footer.
  ctx.save()
  ctx.font = font(700, 30)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#bdaea2'
  ctx.fillText(String(card.boardName || 'GLOBAL BOARD').toUpperCase(), 96, H - 110)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#d56a2c'
  ctx.fillText('onlygains.club', W - 96, H - 110)
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not export macho card'))
      }
    }, 'image/png')
  })
}

// Distinct crown war card: tier band, three-discipline stat row, treble gold.
// card.crown = { tier, isTreble, stats: { pressups, pullups, km }, period }
function finishCrownCard(ctx, canvas, card) {
  const crown = card.crown
  const gold = crown.isTreble
  const accent = gold ? '#ffd54a' : '#f0a36e'
  const crownGlyphs = crown.isTreble ? '👑 👑 👑' : crown.tier === 'DOUBLE_CROWN' ? '👑 👑' : '👑'
  const tierLabel = crown.isTreble ? 'TREBLE CROWN' : crown.tier === 'DOUBLE_CROWN' ? 'DOUBLE CROWN' : 'CROWN'

  // Tier band.
  drawCentered(ctx, crownGlyphs, H - 760, accent, font(800, 110))
  drawCentered(ctx, tierLabel, H - 630, accent, font(800, 96), 4)
  drawCentered(ctx, `${(crown.period === 'monthly' ? 'MONTH' : 'WEEK')} ${crown.isTreble ? '· ALL THREE THRONES' : 'CHAMPION'}`, H - 560, '#f0c9a8', font(700, 36), 6)

  // Three-discipline stat row.
  const cols = [
    { label: 'PUSH', value: crown.stats?.pressups },
    { label: 'PULL', value: crown.stats?.pullups },
    { label: 'DIST', value: crown.stats?.km },
  ]
  const colWidth = W / 3
  const rowY = H - 380

  cols.forEach((col, index) => {
    const cx = colWidth * index + colWidth / 2
    const held = col.value != null
    ctx.save()
    ctx.textAlign = 'center'
    ctx.fillStyle = held ? '#fff7f1' : '#564c45'
    ctx.font = font(800, 96)
    const display = !held ? '—' : col.label === 'DIST' ? String(Number(col.value).toFixed(col.value % 1 ? 1 : 0)) : String(Math.round(col.value))
    ctx.fillText(display, cx, rowY)
    ctx.fillStyle = held ? accent : '#564c45'
    ctx.font = font(700, 34)
    ctx.fillText(col.label, cx, rowY + 56)
    ctx.restore()
  })

  // Warrior + footer.
  drawCentered(ctx, String(card.warriorName || 'WARRIOR').toUpperCase(), H - 230, '#ffffff', font(800, 56), 3)

  ctx.save()
  ctx.font = font(700, 30)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#bdaea2'
  ctx.fillText(String(card.boardName || 'GLOBAL BOARD').toUpperCase(), 96, H - 110)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#d56a2c'
  ctx.fillText('onlygains.club', W - 96, H - 110)
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not export crown card'))
      }
    }, 'image/png')
  })
}

// Returns: 'shared' | 'downloaded' | 'copied' | 'cancelled'
export async function shareMachoCardImage(card) {
  let blob = null

  try {
    blob = await renderMachoCardImage(card)
  } catch {
    blob = null
  }

  return shareCardBlob(blob, {
    filename: 'only-gains-war-card.png',
    text: `${card.tagline || 'EARNED.'} Only Gains: ${PUBLIC_BASE_URL}`,
  })
}
