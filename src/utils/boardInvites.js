const PENDING_BOARD_INVITE_KEY = 'only_gains_pending_board_invite'

function getShareOrigin() {
  if (typeof window === 'undefined') {
    return 'https://onlygains.club'
  }

  return window.location.origin
}

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

export function formatBoardTypeLabel(boardType) {
  const normalized = String(boardType || '').trim()

  if (!normalized) {
    return 'Board'
  }

  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function buildBoardInviteUrl(inviteCode) {
  return `${getShareOrigin()}/join/${encodeURIComponent(String(inviteCode || '').trim())}`
}

export function buildBoardInviteQrUrl(inviteCode) {
  const inviteUrl = buildBoardInviteUrl(inviteCode)
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(inviteUrl)}`
}

export function buildBoardInviteSharePayload(board) {
  const inviteUrl = buildBoardInviteUrl(board?.inviteCode)
  const boardName = board?.name || 'This board'
  const text = `This board is live.\n\nJoin ${boardName} on Only Gains:`

  return {
    title: 'Only Gains Board',
    text,
    url: inviteUrl,
    clipboardText: `${text}\n${inviteUrl}`,
  }
}

export async function shareBoardInvite(board) {
  const payload = buildBoardInviteSharePayload(board)

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

export function getPendingBoardInviteCode() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(PENDING_BOARD_INVITE_KEY) || ''
}

export function setPendingBoardInviteCode(inviteCode) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedInviteCode = String(inviteCode || '').trim()

  if (!normalizedInviteCode) {
    window.localStorage.removeItem(PENDING_BOARD_INVITE_KEY)
    return
  }

  window.localStorage.setItem(PENDING_BOARD_INVITE_KEY, normalizedInviteCode)
}

export function clearPendingBoardInviteCode() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(PENDING_BOARD_INVITE_KEY)
}
