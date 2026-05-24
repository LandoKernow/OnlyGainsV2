const LIVE_SHARE_ORIGIN = 'https://onlygains.club'

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()

  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }

  return Promise.resolve()
}

export function buildOnlyGainsSharePayload() {
  const text = 'Know someone who can raise the bar?\n\nOnly Gains:'
  const url = LIVE_SHARE_ORIGIN

  return {
    title: 'Only Gains',
    text,
    url,
    clipboardText: `${text}\n${url}`,
  }
}

export async function shareOnlyGains() {
  const payload = buildOnlyGainsSharePayload()

  if (navigator.share) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      })
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') {
        return 'cancelled'
      }

      throw error
    }
  }

  await copyText(payload.clipboardText)
  return 'copied'
}
