// Session-level gate so at most ONE follow-up prompt (install OR share) shows
// per session — never two back-to-back. Resets when the tab/session ends.
const FOLLOWUP_KEY = 'only_gains_followup_prompt_shown'

export function hasShownFollowupThisSession() {
  try {
    return globalThis.sessionStorage?.getItem(FOLLOWUP_KEY) === 'true'
  } catch {
    return false
  }
}

export function markFollowupShownThisSession() {
  try {
    globalThis.sessionStorage?.setItem(FOLLOWUP_KEY, 'true')
  } catch {
    // Restrictive storage: degrade to per-render gating, never crash.
  }
}
