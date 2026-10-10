// Brand stamping for the canvas-rendered share cards. The wordmark is drawn
// from the official artwork (never typeset); the /// mark is the same path as
// <EffortMark />.

export const BRAND_FONT_STACK = '"Space Grotesk", "Segoe UI", system-ui, -apple-system, sans-serif'

const EFFORT_MARK_PATH = 'M44 0h18L18 64H0zM73 0h18L47 64H29zM102 0h18L76 64H58z'
const WORDMARK_SRC = '/brand/wordmark.png'
const WORDMARK_ASPECT = 110 / 998

let wordmarkPromise = null

function loadWordmark() {
  if (!wordmarkPromise) {
    wordmarkPromise = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => {
        wordmarkPromise = null
        reject(new Error('Could not load wordmark'))
      }
      image.src = WORDMARK_SRC
    })
  }

  return wordmarkPromise
}

// Canvas text silently falls back to a system face if the web font isn't
// loaded yet, so wait for the weights the cards use before drawing.
export async function ensureBrandFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) {
    return
  }

  try {
    await Promise.all([
      document.fonts.load(`700 40px "Space Grotesk"`),
      document.fonts.load(`600 40px "Space Grotesk"`),
    ])
  } catch {
    // System fallback is acceptable; never block a share on fonts.
  }
}

// align: 'left' | 'center'. Falls back to tracked text if the artwork fails.
export async function drawWordmark(ctx, x, y, width, align = 'center') {
  const height = width * WORDMARK_ASPECT
  const left = align === 'center' ? x - width / 2 : x

  try {
    const image = await loadWordmark()
    ctx.drawImage(image, left, y, width, height)
  } catch {
    ctx.save()
    ctx.font = `700 ${Math.round(height * 0.9)}px ${BRAND_FONT_STACK}`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = align
    ctx.textBaseline = 'top'
    ctx.fillText('ONLYGAINS', x, y)
    ctx.restore()
  }

  return height
}

export function drawEffortMark(ctx, cx, cy, width, fillStyle = '#ffffff') {
  const scale = width / 120
  ctx.save()
  ctx.translate(cx - width / 2, cy - (64 * scale) / 2)
  ctx.scale(scale, scale)
  ctx.fillStyle = fillStyle
  ctx.fill(new Path2D(EFFORT_MARK_PATH))
  ctx.restore()
}
