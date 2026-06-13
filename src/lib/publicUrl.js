// THE single source of truth for the public origin of every SHAREABLE link
// (referral /r/ links, board invites, war-card share text, app share).
//
// Hardcoded to the real domain on purpose: building share links from
// window.location.origin leaks the Worker dev domain
// (onlygainsv2.*.workers.dev) into shares, and a stale build env once shipped
// a dead link (the Telegram incident). An optional VITE_PUBLIC_BASE_URL
// override stays available for preview environments, but the code default is
// authoritative.
const FALLBACK_BASE_URL = 'https://onlygains.club'

function normalizeBase(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

let envOverride = ''
try {
  envOverride = normalizeBase(import.meta.env?.VITE_PUBLIC_BASE_URL)
} catch {
  envOverride = ''
}

export const PUBLIC_BASE_URL = envOverride || FALLBACK_BASE_URL

// Build a shareable URL from a path. NEVER use window.location.origin for
// shareable links — only for in-app auth redirects.
export function buildPublicUrl(path = '') {
  const suffix = String(path || '')

  if (!suffix) {
    return PUBLIC_BASE_URL
  }

  return `${PUBLIC_BASE_URL}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
}
