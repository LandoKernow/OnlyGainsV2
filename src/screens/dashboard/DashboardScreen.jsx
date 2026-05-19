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
import { useActivityLeaderboard } from '../../hooks/useActivityLeaderboard'
import { useActivityLogger } from '../../hooks/useActivityLogger'
import { useRecentSubmissions } from '../../hooks/useRecentSubmissions'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useToast } from '../../components/ToastProvider'

const quickValues = [10, 20, 50]

function parseManualValue(value, activityType) {
  const trimmed = value.trim()

  if (trimmed === '') {
    return { error: activityType === 'km' ? 'Enter a distance in km.' : 'Enter a press-up count.' }
  }

  if (activityType === 'pressups') {
    if (!/^\d+$/.test(trimmed)) {
      return { error: 'Press-ups must be a whole number.' }
    }

    const parsed = Number(trimmed)

    if (parsed <= 0) {
      return { error: 'Press-ups must be greater than 0.' }
    }

    return { value: parsed }
  }

  // km parsing: allow decimals
  const parsed = Number(trimmed)

  if (Number.isNaN(parsed)) {
    return { error: 'Enter a valid number for km.' }
  }

  if (parsed <= 0) {
    return { error: 'KM must be greater than 0.' }
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
  const [activityType, setActivityType] = useState('pressups')
  const [manualError, setManualError] = useState('')
  const [entryToRemove, setEntryToRemove] = useState(null)
  const { showToast } = useToast()
  const logger = useActivityLogger({
    circleId,
    userId: session.user.id,
    actorName: profileQuery.data?.name || session.user.email?.split('@')[0] || 'You',
    activityType: activityType === 'km' ? 'km' : 'pressups',
    limit: 5,
  })
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    period: leaderboardPeriod,
    currentUserId: session.user.id,
    activityType: activityType === 'km' ? 'km' : 'pressups',
  })
  const chase = useChase(leaderboardQuery.rows, session.user.id)
  const deleteSubmission = useDeleteSubmission({
    circleId,
    userId: session.user.id,
    limit: 5,
  })
  const isNewThisWeek = !leaderboardQuery.isLoading && !leaderboardQuery.currentUserRow

  function submitActivity(value) {
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
    submitActivity(value)
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
    submitActivity(result.value)
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
        <div className="beta-note">
          <strong>Board Beta is live.</strong>
          <p>Log press-ups. Climb ranks. Chase the warrior above you.</p>
          <p>Arena, The 1% and Profiles return soon — rebuilt properly.</p>
        </div>
        {isNewThisWeek ? (
          <div className="dashboard-onboarding-note">
            <strong>Start here.</strong>
            <p>Log your first set and the board reacts.</p>
          </div>
        ) : null}
        <div className="activity-toggle" style={{display: 'flex', gap: '0.4rem', alignItems: 'center'}}>
          <button className={activityType === 'pressups' ? 'pill-button pill-button--active' : 'pill-button'} type="button" onClick={() => setActivityType('pressups')}>Press Ups</button>
          <button className={activityType === 'km' ? 'pill-button pill-button--active' : 'pill-button'} type="button" onClick={() => setActivityType('km')}>KM Ran</button>
        </div>

        <LogActivityCard
          quickValues={quickValues}
          manualValue={manualValue}
          manualError={manualError}
          onManualValueChange={setManualValue}
          onQuickLog={handleQuickLog}
          onManualSubmit={handleManualSubmit}
          isSaving={logger.isPending}
          activityType={activityType}
        />
        <PressupLeaderboardCard
          period={leaderboardPeriod}
          onPeriodChange={setLeaderboardPeriod}
          rows={leaderboardQuery.rows}
          currentUserRow={leaderboardQuery.currentUserRow}
          isLoading={leaderboardQuery.isLoading}
          error={leaderboardQuery.error}
          activityType={activityType}
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
        <HeroStatus profile={profileQuery.data} />
        <ProfileReadinessCard
          profile={profileQuery.data}
          isLoading={profileQuery.isLoading}
          error={profileQuery.error}
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
