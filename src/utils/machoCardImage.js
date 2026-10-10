// Renders the macho takeover to a story-sized PNG: the dealt photo as a
// full-bleed background, dark legibility gradients, the earned stat in heavy
// type, and the brand. Same zero-dependency canvas approach as the war card.

import { shareCardBlob } from './warCardImage'
import { PUBLIC_BASE_URL } from '../lib/publicUrl'
import { BRAND_FONT_STACK, drawEffortMark, drawWordmark, ensureBrandFonts } from './brandCanvas'

const W = 1080
const H = 1920

function font(weight, size) {
  return `${weight} ${size}px ${BRAND_FONT_STACK}`
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

  await ensureBrandFonts()

  // Photo background (falls back to flat obsidian if the image fails).
  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, W, H)

  try {
    const image = await loadImage(card.imageSrc)
    // Mono brand. Browsers without canvas filter support draw the photo as-is.
    ctx.filter = 'grayscale(1) contrast(1.06)'
    drawCover(ctx, image)
    ctx.filter = 'none'
  } catch {
    // Flat dark background already painted.
  }

  // Legibility gradients: heavy at the bottom (where the stat lives),
  // light at the top (brand).
  const top = ctx.createLinearGradient(0, 0, 0, 360)
  top.addColorStop(0, 'rgba(6, 6, 6, 0.85)')
  top.addColorStop(1, 'rgba(6, 6, 6, 0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 360)

  const bottom = ctx.createLinearGradient(0, H - 980, 0, H)
  bottom.addColorStop(0, 'rgba(6, 6, 6, 0)')
  bottom.addColorStop(0.45, 'rgba(6, 6, 6, 0.78)')
  bottom.addColorStop(1, 'rgba(6, 6, 6, 0.95)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, H - 980, W, 980)

  // Brand.
  await drawWordmark(ctx, W / 2, 110, 440)
  drawEffortMark(ctx, W / 2, 222, 64)

  // Crown cards are visually distinct: a tier band + a three-discipline stat
  // row, instead of one giant number.
  if (card.crown) {
    return finishCrownCard(ctx, canvas, card)
  }

  // Stat block, lower third.
  let cursorY = H - 640

  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
  ctx.shadowBlur = 40
  drawCentered(ctx, String(card.stat ?? ''), cursorY, '#ffffff', font(800, 190))
  ctx.restore()

  cursorY += 90

  if (card.sub) {
    drawCentered(ctx, String(card.sub).toUpperCase(), cursorY, '#cfcfcf', font(700, 42), 6)
    cursorY += 110
  }

  if (card.tagline) {
    drawCentered(ctx, String(card.tagline).toUpperCase(), cursorY, '#ffffff', font(800, 50), 2)
    cursorY += 90
  }

  if (card.warriorName) {
    drawCentered(ctx, String(card.warriorName).toUpperCase(), cursorY, '#8a8a8a', font(700, 38), 4)
  }

  // Footer.
  ctx.save()
  ctx.font = font(700, 30)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#8a8a8a'
  ctx.fillText(String(card.boardName || 'GLOBAL BOARD').toUpperCase(), 96, H - 110)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
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

// Distinct crown war card: tier band, three-discipline stat row.
// card.crown = { tier, isTreble, stats: { pressups, pullups, km }, period }
function finishCrownCard(ctx, canvas, card) {
  const crown = card.crown
  const accent = '#ffffff'
  const crownGlyphs = crown.isTreble ? '👑 👑 👑' : crown.tier === 'DOUBLE_CROWN' ? '👑 👑' : '👑'
  const tierLabel = crown.isTreble ? 'TREBLE CROWN' : crown.tier === 'DOUBLE_CROWN' ? 'DOUBLE CROWN' : 'CROWN'

  // Tier band.
  drawCentered(ctx, crownGlyphs, H - 760, accent, font(800, 110))
  drawCentered(ctx, tierLabel, H - 630, accent, font(800, 96), 4)
  drawCentered(ctx, `${(crown.period === 'monthly' ? 'MONTH' : 'WEEK')} ${crown.isTreble ? '· ALL THREE THRONES' : 'CHAMPION'}`, H - 560, '#cfcfcf', font(700, 36), 6)

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
    ctx.fillStyle = held ? '#ffffff' : '#3d3d3d'
    ctx.font = font(800, 96)
    const display = !held ? '—' : col.label === 'DIST' ? String(Number(col.value).toFixed(col.value % 1 ? 1 : 0)) : String(Math.round(col.value))
    ctx.fillText(display, cx, rowY)
    ctx.fillStyle = held ? accent : '#3d3d3d'
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
  ctx.fillStyle = '#8a8a8a'
  ctx.fillText(String(card.boardName || 'GLOBAL BOARD').toUpperCase(), 96, H - 110)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
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
    filename: 'onlygains-war-card.png',
    text: `${card.tagline || 'EARNED.'} ONLYGAINS: ${PUBLIC_BASE_URL}`,
  })
}
