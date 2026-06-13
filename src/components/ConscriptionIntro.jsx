import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFirstRun } from '../hooks/useFirstRun'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ONBOARDING_CONFIG } from '../config/onboarding'

// The conscription intro: 2-3 skippable war-voice screens shown once to a new
// warrior. Establishes the battleground, the three disciplines, the first
// mission — then gets out of the way and drops them into logging.
export function ConscriptionIntro() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showIntro, markIntroSeen } = useFirstRun()
  const [index, setIndex] = useState(0)

  const screens = ONBOARDING_CONFIG.intro.screens
  const isOpen =
    ONBOARDING_CONFIG.enabled &&
    ONBOARDING_CONFIG.intro.enabled &&
    showIntro &&
    !location.pathname.startsWith('/award/') &&
    !location.pathname.startsWith('/join/') &&
    !location.pathname.startsWith('/reset-password')

  function finish() {
    markIntroSeen()
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard')
    }
  }

  useEscapeKey(finish, isOpen)

  if (!isOpen) {
    return null
  }

  const screen = screens[index]
  const isLast = index === screens.length - 1

  return (
    <div className="conscription" role="dialog" aria-modal="true" aria-label="Conscription">
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
    </div>
  )
}
