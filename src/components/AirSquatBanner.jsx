import { useState } from 'react'
import { Card } from './Card'
import { useToast } from './ToastProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { useEventCountdown } from '../hooks/useEventCountdown'
import { armPushAlerts, isPushSupported, needsIosInstall } from '../utils/pushManager'
import { openAddToHomeScreenPrompt } from '../utils/community'
import { AIR_SQUAT_ASSAULT_CONFIG, getLaunchTime, isTease, isEnded } from '../config/airSquatAssault'
import { AIR_SQUAT_ASSAULT_COPY } from '../copy/airSquatAssaultCopy'

const ANSWERED_KEY_PREFIX = 'only_gains_asa_answered_v1'

function answeredKey(userId) {
  return `${ANSWERED_KEY_PREFIX}_${userId}`
}

function hasAnswered(userId) {
  try {
    return globalThis.localStorage?.getItem(answeredKey(userId)) === 'true'
  } catch {
    return false
  }
}

function markAnswered(userId) {
  try {
    globalThis.localStorage?.setItem(answeredKey(userId), 'true')
  } catch {
    // ignore
  }
}

// Persistent dashboard banner for the TEASE (and ENDED afterglow) phases:
// live countdown, a tappable WHAT IS THIS reveal, and the ANSWER THE CALL
// opt-in (arms push so the warrior lands on the launch-day push list).
export function AirSquatBanner() {
  const { session, status } = useAuth()
  const { showToast } = useToast()
  const userId = session?.user?.id ?? ''
  const countdown = useEventCountdown(getLaunchTime())
  const [revealOpen, setRevealOpen] = useState(false)
  const [answered, setAnswered] = useState(() => hasAnswered(userId))
  const [arming, setArming] = useState(false)

  // Only shows during TEASE or the ENDED afterglow. LIVE is owned by the arena.
  if (status !== 'authenticated' || (!isTease() && !isEnded())) {
    return null
  }

  if (isEnded()) {
    const endedCopy = AIR_SQUAT_ASSAULT_COPY.ended
    return (
      <Card title={endedCopy.eyebrow} body={endedCopy.title}>
        <p className="muted">{endedCopy.line}</p>
      </Card>
    )
  }

  const banner = AIR_SQUAT_ASSAULT_COPY.banner
  const reveal = AIR_SQUAT_ASSAULT_COPY.reveal
  const optIn = AIR_SQUAT_ASSAULT_COPY.optIn

  async function handleAnswer() {
    if (needsIosInstall()) {
      openAddToHomeScreenPrompt()
      return
    }

    markAnswered(userId)
    setAnswered(true)

    // Arm push if supported so they're on the launch-day list. Being "in"
    // doesn't depend on it — the intent is captured either way.
    if (isPushSupported()) {
      setArming(true)
      const result = await armPushAlerts(userId)
      setArming(false)
      showToast({
        tone: result === 'granted' ? 'success' : 'success',
        message: optIn.armed,
      })
      return
    }

    showToast({ tone: 'success', message: optIn.armed })
  }

  return (
    <Card
      title={banner.eyebrow}
      body={banner.title}
      aside={<span className="asa-banner__countdown">{countdown.days}d {countdown.hours}h {countdown.minutes}m</span>}
      className="asa-banner"
    >
      <div className="stack">
        <p className="asa-banner__dread">{banner.dread}</p>

        <div className="asa-banner__actions">
          {answered ? (
            <span className="asa-banner__answered">✓ {optIn.armedShort}</span>
          ) : (
            <button className="button asa-banner__answer" type="button" onClick={handleAnswer} disabled={arming}>
              {arming ? 'ARMING...' : optIn.cta}
            </button>
          )}
          <button
            className="button button--ghost"
            type="button"
            onClick={() => setRevealOpen((open) => !open)}
            aria-expanded={revealOpen}
          >
            {banner.reveal}
          </button>
        </div>

        {revealOpen ? (
          <div className="asa-reveal">
            <strong className="asa-reveal__tagline">{reveal.tagline}</strong>
            <ul className="asa-reveal__rules">
              {reveal.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="asa-reveal__closer">{reveal.closer}</p>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
