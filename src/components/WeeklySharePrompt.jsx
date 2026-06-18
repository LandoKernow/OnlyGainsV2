import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { fetchProfileYear, getProfileYearQueryKey } from '../api/profileYearSetup'
import { useToast } from './ToastProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { getLondonPeriodKeys } from '../utils/dates'
import { shareOnlyGains } from '../utils/shareApp'
import { getToastMessage } from '../utils/toastCopy'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { OVERLAY_PRIORITY, useOverlaySlot } from './OverlayController'
import { useFirstRun } from '../hooks/useFirstRun'
import { hasShownFollowupThisSession, markFollowupShownThisSession } from '../utils/sessionPrompts'
import { getPendingBoardInviteCode } from '../utils/boardInvites'
import {
  getAddToHomeScreenPromptDismissKey,
  hasDismissedAddToHomeScreenPrompt,
} from './AddToHomeScreenPrompt'
import { getProfileBuildPromptDismissKey, hasDismissedProfileBuildPrompt } from './ProfileBuildPrompt'

const PROFILE_YEAR = 2026
const WEEKLY_SHARE_PROMPT_KEY_PREFIX = 'only_gains_weekly_share_prompt_seen'

function getWeeklySharePromptKey(userId, weekKey) {
  return `${WEEKLY_SHARE_PROMPT_KEY_PREFIX}_${userId}_${weekKey}`
}

function hasSeenWeeklySharePrompt(key) {
  if (!key) {
    return false
  }

  try {
    return globalThis.localStorage?.getItem(key) === 'true'
  } catch {
    return false
  }
}

function markWeeklySharePromptSeen(key) {
  if (!key) {
    return
  }

  try {
    globalThis.localStorage?.setItem(key, 'true')
  } catch {
    // Ignore restrictive storage environments.
  }
}

export function WeeklySharePrompt() {
  const { session, status } = useAuth()
  const location = useLocation()
  const { showToast, activeToastCount, activeMachoToastCount } = useToast()
  const firstRun = useFirstRun()
  const [imageFailed, setImageFailed] = useState(false)
  const userId = session?.user?.id ?? ''
  const isAuthenticated = status === 'authenticated' && Boolean(userId)
  const weekKey = getLondonPeriodKeys(new Date()).weekKey
  const promptKey = useMemo(() => (userId ? getWeeklySharePromptKey(userId, weekKey) : ''), [userId, weekKey])
  const profilePromptKey = useMemo(
    () => (userId ? getProfileBuildPromptDismissKey(userId) : ''),
    [userId],
  )
  const addToHomeScreenPromptKey = useMemo(
    () => (userId ? getAddToHomeScreenPromptDismissKey(userId) : ''),
    [userId],
  )
  const [isSeen, setIsSeen] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const isAwardRoute = location.pathname.startsWith('/award/')
  const isProfileYearRoute = location.pathname === `/profile/year/${PROFILE_YEAR}`
  const hasPendingInviteJoin = Boolean(getPendingBoardInviteCode())

  useEffect(() => {
    if (!isAuthenticated || !promptKey) {
      setIsSeen(true)
      setIsOpen(false)
      return
    }

    setIsSeen(hasSeenWeeklySharePrompt(promptKey))
  }, [isAuthenticated, promptKey])

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
    !profileYearQuery.error &&
    !profileYearQuery.data &&
    !hasDismissedProfileBuildPrompt(profilePromptKey)
  const addToHomeScreenPromptBlocks =
    isAuthenticated &&
    !isAwardRoute &&
    !isProfileYearRoute &&
    !hasPendingInviteJoin &&
    !profilePromptBlocks &&
    !hasDismissedAddToHomeScreenPrompt(addToHomeScreenPromptKey)

  useEffect(() => {
    if (
      !isAuthenticated ||
      isSeen ||
      isOpen ||
      isAwardRoute ||
      isProfileYearRoute ||
      hasPendingInviteJoin ||
      profileYearQuery.isLoading ||
      profilePromptBlocks ||
      addToHomeScreenPromptBlocks ||
      // First-run gauntlet fix: defer until after the first qualifying log, and
      // only one follow-up prompt (install OR share) per session.
      !firstRun.firstBloodDone ||
      hasShownFollowupThisSession() ||
      activeMachoToastCount > 0 ||
      activeToastCount > 0
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      if (hasShownFollowupThisSession()) {
        return
      }
      markFollowupShownThisSession()
      setIsOpen(true)
    }, 2600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    activeMachoToastCount,
    activeToastCount,
    firstRun.firstBloodDone,
    isAuthenticated,
    isAwardRoute,
    addToHomeScreenPromptBlocks,
    isOpen,
    isProfileYearRoute,
    isSeen,
    hasPendingInviteJoin,
    profilePromptBlocks,
    profileYearQuery.isLoading,
  ])

  function dismissPrompt() {
    markWeeklySharePromptSeen(promptKey)
    setIsSeen(true)
    setIsOpen(false)
  }

  // Escape behaves like "Not now" — seen for this week.
  useEscapeKey(dismissPrompt, isOpen)

  async function handleShare() {
    try {
      const result = await shareOnlyGains()
      dismissPrompt()

      if (result === 'cancelled') {
        return
      }

      showToast({
        tone: 'success',
        message: result === 'shared' ? getToastMessage('share_success') : getToastMessage('copy_success'),
      })
    } catch {
      showToast({ tone: 'error', message: 'Could not share Only Gains.' })
    }
  }

  const canShow = useOverlaySlot('weeklyShare', OVERLAY_PRIORITY.weeklyShare, isOpen)

  if (!isOpen || !canShow) {
    return null
  }

  return (
    <div className="prompt-backdrop" role="presentation">
      <div
        className="prompt-modal prompt-modal--share"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-share-prompt-title"
        aria-describedby="weekly-share-prompt-body"
      >
        {imageFailed ? null : (
          <div className="prompt-modal__image-shell">
            <img
              className="prompt-modal__image"
              src="/images/macho-toasts/vault-rocky.webp"
              alt="Only Gains share prompt"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="stack prompt-modal__content">
          <div>
            <p className="eyebrow prompt-modal__eyebrow">RAISE THE BAR</p>
            <h2 id="weekly-share-prompt-title" className="prompt-modal__title">
              KNOW A
              <br />
              WARRIOR?
            </h2>
            <p id="weekly-share-prompt-body" className="prompt-modal__body">
              The board needs stronger enemies. Send it to someone who can raise the standard.
            </p>
          </div>

          <div className="stack prompt-modal__copy">
            <p>Bring better enemies.</p>
            <p>Iron sharpens iron.</p>
            <p>Send the link.</p>
          </div>

          <p className="muted prompt-modal__microcopy">Know someone who thinks they train? Put them on the board.</p>

          <div className="prompt-modal__actions">
            <button className="button" type="button" onClick={handleShare}>
              Share Only Gains
            </button>
            <button className="button button--ghost" type="button" onClick={dismissPrompt}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
