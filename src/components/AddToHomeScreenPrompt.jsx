import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { fetchProfileYear, getProfileYearQueryKey } from '../api/profileYearSetup'
import { useToast } from './ToastProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { getPendingBoardInviteCode } from '../utils/boardInvites'
import { OPEN_ADD_TO_HOME_SCREEN_EVENT } from '../utils/community'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { OVERLAY_PRIORITY, useOverlaySlot } from './OverlayController'
import { getProfileBuildPromptDismissKey, hasDismissedProfileBuildPrompt } from './ProfileBuildPrompt'

const PROFILE_YEAR = 2026
const DISMISS_KEY_PREFIX = 'only_gains_add_to_home_screen_prompt_seen_v1'

export function getAddToHomeScreenPromptDismissKey(userId) {
  return `${DISMISS_KEY_PREFIX}_${userId}`
}

export function hasDismissedAddToHomeScreenPrompt(key) {
  if (!key) {
    return false
  }

  try {
    return globalThis.localStorage?.getItem(key) === 'true'
  } catch {
    return false
  }
}

function markDismissed(key) {
  if (!key) {
    return
  }

  try {
    globalThis.localStorage?.setItem(key, 'true')
  } catch {
    // Ignore restrictive storage environments.
  }
}

export function AddToHomeScreenPrompt() {
  const { session, status } = useAuth()
  const location = useLocation()
  const { activeToastCount, activeMachoToastCount } = useToast()
  const userId = session?.user?.id ?? ''
  const isAuthenticated = status === 'authenticated' && Boolean(userId)
  const dismissKey = useMemo(
    () => (userId ? getAddToHomeScreenPromptDismissKey(userId) : ''),
    [userId],
  )
  const profilePromptKey = useMemo(
    () => (userId ? getProfileBuildPromptDismissKey(userId) : ''),
    [userId],
  )
  const [isDismissed, setIsDismissed] = useState(true)
  const [isDismissStateReady, setIsDismissStateReady] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  // "Show me later" only snoozes for this session; "Got it" persists the dismissal.
  const [isSnoozed, setIsSnoozed] = useState(false)
  const isAwardRoute = location.pathname.startsWith('/award/')
  const isJoinRoute = location.pathname.startsWith('/join/')
  const isBoardInviteRoute = /^\/boards\/[^/]+\/invite$/.test(location.pathname)
  const isProfileYearRoute = location.pathname === `/profile/year/${PROFILE_YEAR}`
  const isResetPasswordRoute = location.pathname.startsWith('/reset-password')
  const isBlockedRoute = isAwardRoute || isJoinRoute || isBoardInviteRoute || isResetPasswordRoute
  const hasPendingInviteJoin = Boolean(getPendingBoardInviteCode())

  useEffect(() => {
    if (!isAuthenticated || !dismissKey) {
      setIsDismissed(true)
      setIsDismissStateReady(false)
      setIsOpen(false)
      return
    }

    setIsDismissed(hasDismissedAddToHomeScreenPrompt(dismissKey))
    setIsDismissStateReady(true)
  }, [dismissKey, isAuthenticated])

  const profileYearQuery = useQuery({
    queryKey: getProfileYearQueryKey(userId, PROFILE_YEAR),
    queryFn: () => fetchProfileYear(userId, PROFILE_YEAR),
    enabled: isAuthenticated && !isProfileYearRoute,
    staleTime: 60_000,
  })

  const profilePromptBlocks =
    isAuthenticated &&
    !isProfileYearRoute &&
    !profileYearQuery.isLoading &&
    !profileYearQuery.isFetching &&
    !profileYearQuery.error &&
    !profileYearQuery.data &&
    !hasDismissedProfileBuildPrompt(profilePromptKey)

  useEffect(() => {
    if (
      !isAuthenticated ||
      !isDismissStateReady ||
      isDismissed ||
      isSnoozed ||
      isOpen ||
      isBlockedRoute ||
      isProfileYearRoute ||
      hasPendingInviteJoin ||
      profileYearQuery.isLoading ||
      profileYearQuery.isFetching ||
      profilePromptBlocks ||
      activeMachoToastCount > 0 ||
      activeToastCount > 0
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setIsOpen(true)
    }, 1800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    activeMachoToastCount,
    activeToastCount,
    hasPendingInviteJoin,
    isAuthenticated,
    isBlockedRoute,
    isDismissStateReady,
    isDismissed,
    isOpen,
    isProfileYearRoute,
    isSnoozed,
    profilePromptBlocks,
    profileYearQuery.isFetching,
    profileYearQuery.isLoading,
  ])

  useEffect(() => {
    function handleOpenPrompt() {
      if (!isAuthenticated || isBlockedRoute || hasPendingInviteJoin) {
        return
      }

      setIsOpen(true)
    }

    window.addEventListener(OPEN_ADD_TO_HOME_SCREEN_EVENT, handleOpenPrompt)

    return () => {
      window.removeEventListener(OPEN_ADD_TO_HOME_SCREEN_EVENT, handleOpenPrompt)
    }
  }, [hasPendingInviteJoin, isAuthenticated, isBlockedRoute])

  function dismissPrompt() {
    markDismissed(dismissKey)
    setIsDismissed(true)
    setIsOpen(false)
  }

  function snoozePrompt() {
    setIsSnoozed(true)
    setIsOpen(false)
  }

  // Escape = "show me later", not a permanent dismissal.
  useEscapeKey(snoozePrompt, isOpen)

  // One overlay at a time, lowest priority of the prompts.
  const canShow = useOverlaySlot('addToHomeScreen', OVERLAY_PRIORITY.addToHomeScreen, isOpen)

  if (!isOpen || !canShow) {
    return null
  }

  return (
    <div className="prompt-backdrop" role="presentation">
      <div
        className="prompt-modal prompt-modal--home-screen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-home-screen-title"
        aria-describedby="add-to-home-screen-body"
      >
        <div className="prompt-modal__image-shell">
          <img
            className="prompt-modal__image"
            src="/images/macho-toasts/vault-rocky.webp"
            alt="Only Gains home screen guidance"
          />
        </div>
        <div className="stack prompt-modal__content">
          <div>
            <p className="eyebrow prompt-modal__eyebrow">ONLY GAINS</p>
            <h2 id="add-to-home-screen-title" className="prompt-modal__title">
              ADD ONLY GAINS
              <br />
              TO YOUR HOME SCREEN
            </h2>
            <p id="add-to-home-screen-body" className="prompt-modal__body">
              This works best like an app.
            </p>
          </div>

          <div className="stack prompt-modal__copy prompt-modal__copy--compact">
            <p>iPhone: Tap Share -&gt; Add to Home Screen.</p>
            <p>Android: Tap menu -&gt; Add to Home screen.</p>
          </div>

          <p className="muted prompt-modal__microcopy">Keep the Board one tap away.</p>

          <div className="prompt-modal__actions">
            <button className="button" type="button" onClick={dismissPrompt}>
              Got it
            </button>
            <button className="button button--ghost" type="button" onClick={snoozePrompt}>
              Show me later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
