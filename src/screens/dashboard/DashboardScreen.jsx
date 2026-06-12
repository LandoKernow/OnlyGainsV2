import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AuthGate } from '../../features/auth/AuthGate'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  HeroStatus,
  LogActivityCard,
  PressureCard,
  PressupLeaderboardCard,
  RecentActivityCard,
  RemoveEntryModal,
  WeeklyLeaderMessageCard,
} from '../../features/dashboard/DashboardSections'
import { useChase } from '../../hooks/useChase'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { useDeleteSubmission } from '../../hooks/useDeleteSubmission'
import { useActivityLeaderboard } from '../../hooks/useActivityLeaderboard'
import { useActivityLogger } from '../../hooks/useActivityLogger'
import { useWeeklyLeaderMessage } from '../../hooks/useWeeklyLeaderMessage'
import { useRecentSubmissions } from '../../hooks/useRecentSubmissions'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useToast } from '../../components/ToastProvider'
import { BossBattleCard } from '../../components/BossBattleCard'
import { MachoTakeover } from '../../components/MachoTakeover'
import { WarCard } from '../../components/WarCard'
import { useCrownHonors } from '../../hooks/useCrownHonors'
import { useWarriorXp } from '../../hooks/useWarriorXp'
import { parseKmValue, formatActivityGap } from '../../utils/activity'
import { ACTIVITY_META, getActivityQuickValues, isRepActivity, normalizeActivityType } from '../../utils/activityTypes'
import { MACHO_TAKEOVER_CONFIG } from '../../config/machoTakeover'
import { shareMachoCardImage } from '../../utils/machoCardImage'
import { dealMachoImage, preloadNextMachoImage } from '../../utils/machoRotation'
import { evaluateMachoTrigger, markMachoFired, resolveMachoPresentation } from '../../utils/machoTriggers'
import { pingEventEngine } from '../../api/notifications'
import { getToastMessage } from '../../utils/toastCopy'
import { calculateCombo, calculateStreak, getMilestone, getWarCardTagline, getWarTier, shareCallout } from '../../utils/war'
import { shareWarCardImage } from '../../utils/warCardImage'
import { getWarriorLevel, getXpForLog } from '../../utils/xp'

const BOARD_LIVE_FEED_LIMIT = 20
const BOARD_LIVE_DIAGNOSTICS_USER_ID = '69e4c6a4-9d17-41bd-a3d3-245205e9c9fb'

function parseManualValue(value, activityType) {
  const trimmed = value.trim()

  if (isRepActivity(activityType)) {
    const meta = ACTIVITY_META[normalizeActivityType(activityType)]

    if (trimmed === '') {
      return { error: meta.emptyError }
    }

    if (!/^\d+$/.test(trimmed)) {
      return { error: meta.wholeNumberError }
    }

    const parsed = Number(trimmed)

    if (parsed <= 0) {
      return { error: meta.positiveError }
    }

    return { value: parsed }
  }

  return parseKmValue(trimmed)
}

function AuthenticatedDashboard() {
  const { session } = useAuth()
  const location = useLocation()
  const { circleId, boards, activeBoard } = useBoardMeta()
  const profileQuery = useCurrentProfile()
  const recentActivityQuery = useRecentSubmissions(circleId, BOARD_LIVE_FEED_LIMIT, {
    userId: session.user.id,
    selectedBoardId: activeBoard?.id,
    selectedBoardName: activeBoard?.name,
  })
  const [manualValue, setManualValue] = useState('')
  const [activityType, setActivityType] = useState('pressups')
  const [manualError, setManualError] = useState('')
  const [entryToRemove, setEntryToRemove] = useState(null)
  const [warCard, setWarCard] = useState(null)
  const [takeover, setTakeover] = useState(null)
  const { showToast } = useToast()
  const logger = useActivityLogger({
    circleId,
    boardIds: boards.map((board) => board.id),
    userId: session.user.id,
    actorName: profileQuery.data?.name || session.user.email?.split('@')[0] || 'You',
    activityType: normalizeActivityType(activityType),
    limit: BOARD_LIVE_FEED_LIMIT,
  })
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    period: 'weekly',
    currentUserId: session.user.id,
    activityType: normalizeActivityType(activityType),
  })
  const isPressupWeeklyLeader =
    !leaderboardQuery.isLoading &&
    activityType === 'pressups' &&
    leaderboardQuery.currentUserRow?.rank === 1
  const weeklyLeaderMessageQuery = useWeeklyLeaderMessage({
    circleId,
    currentUserId: session.user.id,
    isCurrentWeeklyLeader: isPressupWeeklyLeader,
  })
  const leaderMessageOwnerName = weeklyLeaderMessageQuery.messageRow?.userId
    ? leaderboardQuery.rows.find((row) => row.userId === weeklyLeaderMessageQuery.messageRow.userId)?.actorName || 'Weekly leader'
    : 'Weekly leader'
  const chase = useChase(leaderboardQuery.rows, session.user.id, activityType)
  const deleteSubmission = useDeleteSubmission({
    circleId,
    userId: session.user.id,
    limit: BOARD_LIVE_FEED_LIMIT,
  })
  const diagnosticsEnabled = import.meta.env.DEV || session.user.id === BOARD_LIVE_DIAGNOSTICS_USER_ID

  useEffect(() => {
    console.info('[Only Gains Board Live] diagnostics active', {
      currentUserId: session.user.id ?? null,
      diagnosticsEnabled,
      selectedBoardId: activeBoard?.id ?? null,
      selectedBoardName: activeBoard?.name ?? null,
      appEnv: import.meta.env.VITE_APP_ENV ?? null,
      buildMode: import.meta.env.MODE ?? null,
    })
  }, [activeBoard?.id, activeBoard?.name, diagnosticsEnabled, session.user.id])

  if (diagnosticsEnabled) {
    console.debug('[Only Gains Board Live]', 'Dashboard board context', {
      selectedBoardName: activeBoard?.name ?? null,
      selectedBoardId: activeBoard?.id ?? null,
      boardIdPassedToUseRecentSubmissions: circleId ?? null,
      availableBoards: boards.map((board) => ({
        id: board.id,
        name: board.name,
      })),
    })
  }
  const isNewThisWeek = !leaderboardQuery.isLoading && !leaderboardQuery.currentUserRow
  const streak = calculateStreak(leaderboardQuery.data, session.user.id)
  const warriorLevel = useWarriorXp({ circleId, userId: session.user.id })
  const combo = calculateCombo(leaderboardQuery.data, session.user.id, normalizeActivityType(activityType))

  // Warm the next takeover image so the reveal never lags.
  useEffect(() => {
    void preloadNextMachoImage(session.user.id)
  }, [session.user.id])

  // TREBLE: the maximum event. First open after winning all three crowns
  // gets the full-screen takeover (once per treble, tracked locally), and
  // the takeover doubles as its own shareable war card.
  const honors = useCrownHonors()
  const latestTrebleId = honors.latestTreble?.id ?? ''

  useEffect(() => {
    if (!latestTrebleId || takeover) {
      return
    }

    const seenKey = `only_gains_treble_takeover_seen_v1_${session.user.id}_${latestTrebleId}`

    try {
      if (globalThis.localStorage?.getItem(seenKey) === 'true') {
        return
      }
      globalThis.localStorage?.setItem(seenKey, 'true')
    } catch {
      // Restrictive storage: show it anyway — better twice than never.
    }

    const treblePayload = honors.latestTreble?.payload ?? {}

    dealMachoImage(session.user.id).then((imageSrc) => {
      if (!imageSrc) {
        return
      }

      setTakeover({
        imageSrc,
        stat: 'TREBLE',
        sub: `ALL 3 CROWNS · ONE ${treblePayload.period === 'monthly' ? 'MONTH' : 'WEEK'}`,
        tagline: 'THE IMPOSSIBLE, DONE.',
        warriorName: profileQuery.data?.name || session.user.email?.split('@')[0] || 'WARRIOR',
        boardName: activeBoard?.name || 'GLOBAL BOARD',
        shareState: '',
      })
    })
    // Keyed on the treble event id — fires once per treble won.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestTrebleId, session.user.id])

  // Demo trigger: /dashboard?takeover=demo fires the full takeover + share
  // flow with a rotation-dealt image. No cooldowns marked, nothing persisted.
  useEffect(() => {
    const params = new URLSearchParams(location.search)

    if (params.get('takeover') !== 'demo') {
      return
    }

    let cancelled = false

    dealMachoImage(session.user.id).then((imageSrc) => {
      if (cancelled || !imageSrc) {
        return
      }

      setTakeover({
        imageSrc,
        stat: '+150',
        sub: 'ONE SESSION · DEMO',
        tagline: MACHO_TAKEOVER_CONFIG.triggers.bigSession.tagline,
        warriorName: profileQuery.data?.name || 'WARRIOR',
        boardName: activeBoard?.name || 'GLOBAL BOARD',
        shareState: '',
      })
    })

    return () => {
      cancelled = true
    }
    // Re-fires when the ?takeover=demo param (re)appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, session.user.id])

  // Earned-moment check. Runs AFTER a successful save — read-only on
  // leaderboard data, can never interfere with the write path.
  async function maybeFireMachoTakeover({ value, pendingWarCard }) {
    try {
      const trigger = evaluateMachoTrigger({
        userId: session.user.id,
        activityType,
        value,
        submissionRows: leaderboardQuery.data ?? [],
        previousRank: leaderboardQuery.currentUserRow?.rank ?? Number.POSITIVE_INFINITY,
        newRank: pendingWarCard.rank,
        streakDays: pendingWarCard.streakDays,
        todayTotalBefore: leaderboardQuery.currentUserRow?.todayTotal ?? 0,
        previousLevel: warriorLevel,
        newLevel: getWarriorLevel(warriorLevel.xp + getXpForLog(activityType, value)),
      })

      if (!trigger) {
        return false
      }

      const presentation = resolveMachoPresentation(session.user.id, trigger.type)

      if (!presentation) {
        return false
      }

      const imageSrc = await dealMachoImage(session.user.id)

      if (!imageSrc) {
        return false
      }

      markMachoFired(session.user.id, trigger.type, presentation)

      if (presentation === 'takeover') {
        setTakeover({
          imageSrc,
          stat: trigger.stat,
          sub: trigger.sub,
          tagline: trigger.tagline,
          warriorName: pendingWarCard.warriorName,
          boardName: pendingWarCard.boardName,
          shareState: '',
        })
        return true
      }

      showToast({
        tone: 'success',
        variant: 'macho',
        eyebrow: 'EARNED',
        title: trigger.stat === trigger.sub ? trigger.stat : `${trigger.stat} ${trigger.sub ?? ''}`.trim(),
        message: trigger.tagline,
        imagePath: imageSrc,
        durationMs: 4200,
      })
      return false
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Only Gains Takeover] trigger evaluation failed', error)
      }

      return false
    }
  }

  function handleQuickLog(value) {
    if (logger.isPending) {
      if (import.meta.env.DEV) {
        console.log('[Only Gains KM] handleQuickLog blocked: logger pending', { value, activityType })
      }
      return
    }

    setManualError('')
    submitActivity(value)
  }

  function handleManualSubmit(event) {
    event.preventDefault()

    if (logger.isPending) {
      if (import.meta.env.DEV) {
        console.log('[Only Gains KM] handleManualSubmit blocked: logger pending', { activityType, manualValue })
      }
      return
    }

    if (import.meta.env.DEV) {
      console.log('[Only Gains KM] handleManualSubmit', { activityType, manualValue })
    }

    const result = parseManualValue(manualValue, activityType)

    if (result.error) {
      if (import.meta.env.DEV) {
        console.log('[Only Gains KM] parseManualValue error', { activityType, manualValue, error: result.error })
      }
      setManualError(result.error)
      return
    }

    setManualError('')
    submitActivity(result.value)
    setManualValue('')
  }

  function buildWarCard(value) {
    const previousWeeklyTotal = leaderboardQuery.currentUserRow?.total ?? 0
    const weeklyTotal = previousWeeklyTotal + value

    // Re-rank cheaply against the current board: nobody else's total moved.
    const rivalsAhead = leaderboardQuery.rows.filter(
      (row) => row.userId !== session.user.id && (row.total ?? 0) > weeklyTotal,
    ).length
    const rank = rivalsAhead + 1

    const streak = calculateStreak(leaderboardQuery.data, session.user.id)
    const streakDays = streak.activeToday ? streak.streakDays : streak.streakDays + 1

    const rival = chase?.rowAbove ?? chase?.rowBelow ?? null
    const gapValue = chase?.rowAbove ? chase?.gapToCatch : chase?.gapToDefend
    const gapLabel = gapValue != null ? formatActivityGap(gapValue, activityType) : ''

    return {
      warriorName: profileQuery.data?.name || session.user.email?.split('@')[0] || 'WARRIOR',
      boardName: activeBoard?.name || 'GLOBAL BOARD',
      activityType,
      value,
      tier: getWarTier(weeklyTotal, activityType),
      rank,
      weeklyTotal,
      streakDays,
      rivalName: rival?.actorName || '',
      gapLabel,
      tagline: getWarCardTagline(`${session.user.id}:${weeklyTotal}`),
      milestone: getMilestone({ previousWeeklyTotal, weeklyTotal, streakDays, activityType }),
      combo: calculateCombo(leaderboardQuery.data, session.user.id, normalizeActivityType(activityType)),
      levelLabel: warriorLevel?.name ? `LVL ${warriorLevel.level} ${warriorLevel.name}` : '',
      shareState: '',
    }
  }

  function submitActivity(value) {
    if (!circleId) {
      showToast({ tone: 'error', message: getToastMessage('log_error') })
      if (import.meta.env.DEV) {
        console.log('[Only Gains KM] submitActivity blocked: missing circleId', { circleId, value, activityType })
      }
      return
    }

    if (import.meta.env.DEV) {
      console.log('[Only Gains KM] submitActivity', { activityType, value, circleId, userId: session.user.id })
    }

    const pendingWarCard = buildWarCard(value)

    logger.mutate(
      { value },
      {
        onError: (error) => {
          if (activityType === 'km') {
            const baseMessage = 'KM could not be saved.'
            const detailedMessage = import.meta.env.DEV && error?.message ? `${baseMessage} ${error.message}` : baseMessage
            setManualError(detailedMessage)
          }
        },
        onSuccess: async (savedSubmission) => {
          if (activityType === 'km') {
            setManualError('')
          }

          // Wake the notification engine (fire-and-forget; never blocks UI).
          if (savedSubmission?.id) {
            pingEventEngine(savedSubmission.id)
          }

          // Earned moment? Full takeover replaces the standard war card so
          // two reveals never stack. Toast-level repeats keep the war card.
          const tookOver = await maybeFireMachoTakeover({ value, pendingWarCard })

          if (!tookOver) {
            setWarCard(pendingWarCard)
          }
        },
      },
    )
  }

  async function handleWarCardShare() {
    setWarCard((current) => (current ? { ...current, shareState: 'pending' } : current))

    try {
      const result = await shareWarCardImage(warCard)

      if (result === 'cancelled') {
        setWarCard((current) => (current ? { ...current, shareState: '' } : current))
        return
      }

      setWarCard((current) => (current ? { ...current, shareState: result } : current))

      if (result === 'downloaded') {
        showToast({ tone: 'success', message: 'WAR CARD SAVED. POST IT.' })
      }
    } catch {
      setWarCard((current) => (current ? { ...current, shareState: '' } : current))
      showToast({ tone: 'error', message: getToastMessage('generic_error') })
    }
  }

  async function handleTakeoverShare() {
    setTakeover((current) => (current ? { ...current, shareState: 'pending' } : current))

    try {
      const result = await shareMachoCardImage(takeover)

      if (result === 'cancelled') {
        setTakeover((current) => (current ? { ...current, shareState: '' } : current))
        return
      }

      setTakeover((current) => (current ? { ...current, shareState: result } : current))

      if (result === 'downloaded') {
        showToast({ tone: 'success', message: 'WAR CARD SAVED. POST IT.' })
      }
    } catch {
      setTakeover((current) => (current ? { ...current, shareState: '' } : current))
      showToast({ tone: 'error', message: getToastMessage('generic_error') })
    }
  }

  async function handleWarCardCallout() {
    if (!warCard?.rivalName) {
      return
    }

    try {
      const result = await shareCallout({ rivalName: warCard.rivalName, gapLabel: warCard.gapLabel })

      if (result === 'shared' || result === 'copied') {
        showToast({ tone: 'success', message: 'CALL-OUT SENT. NO TAKEBACKS.' })
      }
    } catch {
      showToast({ tone: 'error', message: getToastMessage('generic_error') })
    }
  }

  function handleConfirmRemove() {
    if (!entryToRemove) {
      return
    }

    deleteSubmission.mutate(
      { submissionId: entryToRemove.legacySubmissionId || entryToRemove.id },
      {
        onSettled: () => {
          setEntryToRemove(null)
        },
      },
    )
  }

  return (
    <>
      <div className="stack-lg">
        <HeroStatus
          profile={profileQuery.data}
          currentUserRow={leaderboardQuery.currentUserRow}
          chase={chase}
          rows={leaderboardQuery.rows}
          activityType={activityType}
          streak={streak}
          level={warriorLevel}
          combo={combo}
        />

        <LogActivityCard
          quickValues={getActivityQuickValues(activityType)}
          manualValue={manualValue}
          manualError={manualError}
          onManualValueChange={setManualValue}
          onQuickLog={handleQuickLog}
          onManualSubmit={handleManualSubmit}
          isSaving={logger.isPending}
          activityType={activityType}
          onActivityTypeChange={setActivityType}
        />

        <PressureCard
          chase={chase}
          isLoading={leaderboardQuery.isLoading}
          activityType={activityType}
        />

        <BossBattleCard />

        <WeeklyLeaderMessageCard
          messageRow={weeklyLeaderMessageQuery.messageRow}
          leaderName={leaderMessageOwnerName}
          isLeader={isPressupWeeklyLeader}
          isLoading={weeklyLeaderMessageQuery.isLoading}
          saveMessage={weeklyLeaderMessageQuery.save}
        />

        <PressupLeaderboardCard
          period="weekly"
          onPeriodChange={() => {}}
          rows={leaderboardQuery.rows}
          currentUserRow={leaderboardQuery.currentUserRow}
          isLoading={leaderboardQuery.isLoading}
          error={leaderboardQuery.error}
          activityType={activityType}
          compact
        />

        <RecentActivityCard
          rows={recentActivityQuery.data ?? []}
          isLoading={recentActivityQuery.isLoading}
          error={recentActivityQuery.error}
          currentUserId={session.user.id}
          onRequestRemove={setEntryToRemove}
        />
      </div>
      <RemoveEntryModal
        submission={entryToRemove}
        onConfirm={handleConfirmRemove}
        onCancel={() => {
          if (!deleteSubmission.isPending) {
            setEntryToRemove(null)
          }
        }}
        isDeleting={deleteSubmission.isPending}
      />
      <WarCard
        card={warCard}
        onShare={handleWarCardShare}
        onCallout={handleWarCardCallout}
        onClose={() => setWarCard(null)}
      />
      <MachoTakeover
        takeover={takeover}
        onShare={handleTakeoverShare}
        onClose={() => setTakeover(null)}
      />
    </>
  )
}

export default function DashboardScreen() {
  return (
    <div className="screen screen--dashboard">
      <AuthGate>
        <AuthenticatedDashboard />
      </AuthGate>
    </div>
  )
}
