import { useState } from 'react'
import { AuthGate } from '../../features/auth/AuthGate'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  ChaseCard,
  HeroStatus,
  LogActivityCard,
  PressupLeaderboardCard,
  ProfileReadinessCard,
  RecentActivityCard,
  RemoveEntryModal,
} from '../../features/dashboard/DashboardSections'
import { useChase } from '../../hooks/useChase'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { useDeleteSubmission } from '../../hooks/useDeleteSubmission'
import { usePressupLeaderboard } from '../../hooks/usePressupLeaderboard'
import { usePressupLogger } from '../../hooks/usePressupLogger'
import { useRecentSubmissions } from '../../hooks/useRecentSubmissions'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useToast } from '../../components/ToastProvider'

const quickValues = [10, 20, 50]

function parseManualPressupValue(value) {
  const trimmed = value.trim()

  if (trimmed === '') {
    return { error: 'Enter a press-up count.' }
  }

  if (!/^\d+$/.test(trimmed)) {
    return { error: 'Press-ups must be a whole number.' }
  }

  const parsed = Number(trimmed)

  if (parsed <= 0) {
    return { error: 'Press-ups must be greater than 0.' }
  }

  return { value: parsed }
}

function AuthenticatedDashboard() {
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const profileQuery = useCurrentProfile()
  const recentActivityQuery = useRecentSubmissions(circleId, 5)
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('weekly')
  const [manualValue, setManualValue] = useState('')
  const [manualError, setManualError] = useState('')
  const [entryToRemove, setEntryToRemove] = useState(null)
  const { showToast } = useToast()
  const logger = usePressupLogger({
    circleId,
    userId: session.user.id,
    actorName: profileQuery.data?.name || session.user.email?.split('@')[0] || 'You',
    limit: 5,
  })
  const leaderboardQuery = usePressupLeaderboard({
    circleId,
    period: leaderboardPeriod,
    currentUserId: session.user.id,
  })
  const chase = useChase(leaderboardQuery.rows, session.user.id)
  const deleteSubmission = useDeleteSubmission({
    circleId,
    userId: session.user.id,
    limit: 5,
  })

  function submitPressups(value) {
    if (!circleId) {
      showToast({ tone: 'error', message: 'Could not save. Try again.' })
      return
    }

    logger.mutate({ value })
  }

  function handleQuickLog(value) {
    if (logger.isPending) {
      return
    }

    setManualError('')
    submitPressups(value)
  }

  function handleManualSubmit(event) {
    event.preventDefault()

    if (logger.isPending) {
      return
    }

    const result = parseManualPressupValue(manualValue)

    if (result.error) {
      setManualError(result.error)
      return
    }

    setManualError('')
    submitPressups(result.value)
    setManualValue('')
  }

  function handleConfirmRemove() {
    if (!entryToRemove) {
      return
    }

    deleteSubmission.mutate(
      { submissionId: entryToRemove.id },
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
        <HeroStatus profile={profileQuery.data} session={session} circleId={circleId} />
        <ProfileReadinessCard
          profile={profileQuery.data}
          isLoading={profileQuery.isLoading}
          error={profileQuery.error}
        />
        <LogActivityCard
          quickValues={quickValues}
          manualValue={manualValue}
          manualError={manualError}
          onManualValueChange={setManualValue}
          onQuickLog={handleQuickLog}
          onManualSubmit={handleManualSubmit}
          isSaving={logger.isPending}
        />
        <PressupLeaderboardCard
          period={leaderboardPeriod}
          onPeriodChange={setLeaderboardPeriod}
          rows={leaderboardQuery.rows}
          currentUserRow={leaderboardQuery.currentUserRow}
          isLoading={leaderboardQuery.isLoading}
          error={leaderboardQuery.error}
          compact
        />
        <ChaseCard chase={chase} isLoading={leaderboardQuery.isLoading} period={leaderboardPeriod} compact />
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
    </>
  )
}

export default function DashboardScreen() {
  return (
    <div className="screen">
      <AuthGate>
        <AuthenticatedDashboard />
      </AuthGate>
    </div>
  )
}
