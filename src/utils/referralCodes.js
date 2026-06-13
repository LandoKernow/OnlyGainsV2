// Pending-referral capture — mirrors boardInvites.js exactly. The /r/:code
// route writes the recruiter's code here at click time; it survives the auth
// redirect (localStorage, same origin) and ReferralWatcher claims it after
// the new account authenticates.

import { buildPublicUrl } from '../lib/publicUrl'

const PENDING_REFERRAL_KEY = 'only_gains_pending_referral'

export function buildReferralUrl(referralCode) {
  return buildPublicUrl(`/r/${encodeURIComponent(String(referralCode || '').trim().toUpperCase())}`)
}

export function getPendingReferralCode() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(PENDING_REFERRAL_KEY) || ''
}

export function setPendingReferralCode(referralCode) {
  if (typeof window === 'undefined') {
    return
  }

  const normalized = String(referralCode || '').trim().toUpperCase()

  if (!normalized) {
    window.localStorage.removeItem(PENDING_REFERRAL_KEY)
    return
  }

  window.localStorage.setItem(PENDING_REFERRAL_KEY, normalized)
}

export function clearPendingReferralCode() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(PENDING_REFERRAL_KEY)
}

// War-voice share of the recruiter's own link. Native sheet -> clipboard.
export async function shareReferral(referralCode) {
  const url = buildReferralUrl(referralCode)
  const text = 'You think you train? Get on the board. First one to fold loses.'

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Only Gains', text, url })
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') {
        return 'cancelled'
      }
      throw error
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  }

  return 'unavailable'
}
