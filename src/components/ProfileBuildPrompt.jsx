import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchProfileYear, getProfileYearQueryKey } from '../api/profileYearSetup'
import { useAuth } from '../features/auth/AuthProvider'

const PROFILE_YEAR = 2026
const DISMISS_KEY_PREFIX = 'only_gains_profile_build_prompt_dismissed_v1'

function getDismissKey(userId) {
  return `${DISMISS_KEY_PREFIX}_${userId}`
}

function readDismissed(key) {
  if (!key) {
    return false
  }

  try {
    return globalThis.localStorage?.getItem(key) === 'true'
  } catch {
    return false
  }
}

function writeDismissed(key) {
  if (!key) {
    return
  }

  try {
    globalThis.localStorage?.setItem(key, 'true')
  } catch {
    // Ignore storage issues in restrictive mobile webviews.
  }
}

export function ProfileBuildPrompt() {
  const { session, status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const userId = session?.user?.id ?? ''
  const dismissKey = useMemo(() => (userId ? getDismissKey(userId) : ''), [userId])
  const [isDismissed, setIsDismissed] = useState(true)
  const isAuthenticated = status === 'authenticated' && Boolean(userId)
  const isProfileYearRoute = location.pathname === `/profile/year/${PROFILE_YEAR}`

  useEffect(() => {
    if (!isAuthenticated || !dismissKey) {
      setIsDismissed(true)
      return
    }

    setIsDismissed(readDismissed(dismissKey))
  }, [dismissKey, isAuthenticated])

  const profileYearQuery = useQuery({
    queryKey: getProfileYearQueryKey(userId, PROFILE_YEAR),
    queryFn: () => fetchProfileYear(userId, PROFILE_YEAR),
    enabled: isAuthenticated && !isDismissed && !isProfileYearRoute,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!isAuthenticated || isDismissed || isProfileYearRoute) {
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        dismissPrompt()
      }
    }

    globalThis.window?.addEventListener('keydown', handleKeyDown)

    return () => {
      globalThis.window?.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAuthenticated, isDismissed, isProfileYearRoute])

  function dismissPrompt() {
    if (!dismissKey) {
      return
    }

    writeDismissed(dismissKey)
    setIsDismissed(true)
  }

  function handleBuildProfile() {
    dismissPrompt()
    navigate(`/profile/year/${PROFILE_YEAR}`)
  }

  const shouldShow =
    isAuthenticated &&
    !isDismissed &&
    !isProfileYearRoute &&
    !profileYearQuery.data

  if (!shouldShow) {
    return null
  }

  return (
    <div className="prompt-backdrop" role="presentation">
      <div
        className="prompt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-build-prompt-title"
        aria-describedby="profile-build-prompt-body"
      >
        <div className="prompt-modal__image-shell">
          <img
            className="prompt-modal__image"
            src="/images/profile-build-prompt.webp"
            alt="Bodybuilder posing under stage lights."
          />
        </div>
        <div className="stack prompt-modal__content">
          <div>
            <p className="eyebrow prompt-modal__eyebrow">ONLY GAINS</p>
            <h2 id="profile-build-prompt-title" className="prompt-modal__title">
              BUILD YOUR
              <br />
              2026 PROFILE
            </h2>
            <p id="profile-build-prompt-body" className="prompt-modal__body">
              The board shows what you do today. Your profile shows what you&apos;re made of this year.
            </p>
          </div>

          <div className="stack prompt-modal__copy">
            <p>Claim your records.</p>
            <p>Set your best efforts.</p>
            <p>Put your name in the Vault.</p>
          </div>

          <p className="muted prompt-modal__microcopy">No excuses. Add what you know now. Edit later.</p>

          <div className="prompt-modal__actions">
            <button className="button" type="button" onClick={handleBuildProfile}>
              Build my 2026 profile
            </button>
            <button className="button button--ghost" type="button" onClick={dismissPrompt}>
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
