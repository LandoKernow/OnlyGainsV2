import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { OverlayShell, OVERLAY_PRIORITY, useOverlaySlot } from './OverlayController'
import { useEventCountdown } from '../hooks/useEventCountdown'
import { AIR_SQUAT_ASSAULT_CONFIG, getLaunchTime, isTease } from '../config/airSquatAssault'
import { AIR_SQUAT_ASSAULT_COPY } from '../copy/airSquatAssaultCopy'

const SEEN_KEY_PREFIX = 'only_gains_asa_takeover_seen_v1'

function seenKey(userId) {
  return `${SEEN_KEY_PREFIX}_${userId}`
}

function hasSeen(userId) {
  try {
    return globalThis.localStorage?.getItem(seenKey(userId)) === 'true'
  } catch {
    return false
  }
}

function markSeen(userId) {
  try {
    globalThis.localStorage?.setItem(seenKey(userId), 'true')
  } catch {
    // ignore restrictive storage
  }
}

// The AIR SQUAT ASSAULT announcement — a full-screen countdown takeover shown
// ONCE per user on app open during the TEASE week, then demoted to the
// persistent dashboard banner. Routed through the overlay controller so it
// never stacks with coronations or prompts (priority below both).
export function AirSquatTakeover() {
  const { session, status } = useAuth()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)
  const userId = session?.user?.id ?? ''
  const countdown = useEventCountdown(getLaunchTime())
  const copy = AIR_SQUAT_ASSAULT_COPY.takeover

  const onBlockedRoute =
    location.pathname.startsWith('/award/') ||
    location.pathname.startsWith('/join/') ||
    location.pathname.startsWith('/reset-password')

  const wants =
    isTease() &&
    AIR_SQUAT_ASSAULT_CONFIG.takeover.enabled &&
    status === 'authenticated' &&
    Boolean(userId) &&
    !dismissed &&
    !hasSeen(userId) &&
    !onBlockedRoute

  const isActive = useOverlaySlot('eventTakeover', OVERLAY_PRIORITY.eventTakeover, wants)

  function dismiss() {
    markSeen(userId)
    setDismissed(true)
  }

  if (!isActive) {
    return null
  }

  return (
    <OverlayShell label="Air Squat Assault" onDismiss={dismiss} className="asa-takeover">
      <img className="asa-takeover__image" src={AIR_SQUAT_ASSAULT_CONFIG.takeover.imageSrc} alt="" aria-hidden="true" />
      <div className="asa-takeover__shade" aria-hidden="true" />
      <div className="asa-takeover__inner">
        <p className="asa-takeover__eyebrow">{copy.eyebrow}</p>
        <h2 className="asa-takeover__title">{copy.title}</h2>
        <p className="asa-takeover__dread">{copy.dread}</p>

        <div className="asa-takeover__countdown">
          <span className="asa-takeover__countdown-label">{copy.sub}</span>
          <strong className="asa-takeover__countdown-value">
            {countdown.days}d {countdown.hours}h {countdown.minutes}m
          </strong>
        </div>

        <button className="button asa-takeover__cta" type="button" onClick={dismiss}>
          {copy.cta}
        </button>
        <p className="asa-takeover__footnote">{copy.footnote}</p>
      </div>
    </OverlayShell>
  )
}
