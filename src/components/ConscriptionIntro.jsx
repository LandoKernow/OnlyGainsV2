import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFirstRun } from '../hooks/useFirstRun'
import { OverlayShell, OVERLAY_PRIORITY, useOverlaySlot } from './OverlayController'
import { ONBOARDING_CONFIG } from '../config/onboarding'

// The conscription intro: 2-3 skippable war-voice screens shown once to a
// genuine newcomer. Routed through the overlay controller (one overlay at a
// time, solid backdrop) and dismissed via local state so the exit is instant
// and reliable — never waits on a localStorage re-read or a route change.
export function ConscriptionIntro() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showIntro, markIntroSeen } = useFirstRun()
  const [index, setIndex] = useState(0)
  // Local guard: once dismissed, this overlay is gone for the session
  // regardless of how fast the hook/query catches up. This is what fixes the
  // "stuck on the last screen" trap.
  const [dismissed, setDismissed] = useState(false)

  const onBlockedRoute =
    location.pathname.startsWith('/award/') ||
    location.pathname.startsWith('/join/') ||
    location.pathname.startsWith('/reset-password')

  const wants =
    ONBOARDING_CONFIG.enabled &&
    ONBOARDING_CONFIG.intro.enabled &&
    showIntro &&
    !dismissed &&
    !onBlockedRoute

  const isActive = useOverlaySlot('intro', OVERLAY_PRIORITY.intro, wants)

  function finish() {
    markIntroSeen()
    setDismissed(true) // close NOW — no dependency on a re-render from elsewhere
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard')
    }
  }

  if (!isActive) {
    return null
  }

  const screens = ONBOARDING_CONFIG.intro.screens
  const screen = screens[index]
  const isLast = index === screens.length - 1

  return (
    <OverlayShell label="Conscription" onDismiss={finish} className="conscription">
      <div className="conscription__inner">
        <button className="conscription__skip" type="button" onClick={finish}>
          Skip
        </button>

        <div className="conscription__body">
          <p className="conscription__eyebrow">{screen.eyebrow}</p>
          <h2 className="conscription__title">{screen.title}</h2>
          <p className="conscription__copy">{screen.body}</p>
        </div>

        <div className="conscription__foot">
          <div className="conscription__dots" aria-hidden="true">
            {screens.map((_, dotIndex) => (
              <span key={dotIndex} className={dotIndex === index ? 'conscription__dot conscription__dot--on' : 'conscription__dot'} />
            ))}
          </div>
          <button
            className="button conscription__next"
            type="button"
            onClick={() => (isLast ? finish() : setIndex((current) => current + 1))}
          >
            {isLast ? screen.cta || 'ENTER THE WAR' : 'NEXT'}
          </button>
        </div>
      </div>
    </OverlayShell>
  )
}
